import type { Edge, Node } from '@xyflow/react';
import type { HilesModelDocument } from '../../domain/modelDocument';
import { nombreVariable } from '../../engine/elementos/ElementoBloqueFuncional';
import type { MotorSimulacion } from '../../engine/MotorSimulacion';
import { HilesConnectionType, HilesElementType, type HilesEdgeData, type HilesNodeData, type HilesPort } from '../../types/hiles';
import { MQTT_MAX_PAYLOAD_BYTES } from '../mqtt/config';
import { compilarExpresion, renombrarVariables } from './expresiones';
import {
  CodigoIr,
  IR_MAX_CONEXIONES,
  IR_MAX_ELEMENTOS,
  IR_PUERTO_CONDICION,
  type AvisoIr,
  type IrConexion,
  type IrElemento,
  type IrEstadoElemento,
  type IrModeloV1,
  type IrTipoDato,
} from './tiposIr';
import { elementosEnCicloDeDatos, validarIrV1 } from './validadorIr';

/**
 * Compilador `HilesModelDocument → IR v1`.
 *
 * Traduce el documento del editor al formato mínimo que ejecuta la Pico. Si
 * algún elemento del modelo no es compatible con la ejecución remota, no se
 * lanza una excepción: se devuelven avisos informativos y el circuito sigue
 * disponible para la simulación local.
 */
export type ResultadoCompilacionIr =
  | { ok: true; ir: IrModeloV1; avisos: [] }
  | { ok: false; avisos: AvisoIr[] };

type ElementoDocumento = HilesModelDocument['allElements'][number];
type ConexionDocumento = HilesModelDocument['connections'][number];

/** Margen reservado para el sobre de `modelo/cargar` (ids, versión, etc.). */
const MARGEN_SOBRE_MENSAJE = 1024;
const PUERTO_CONDICION_POR_DEFECTO = 'transition-condition-in';
const PUERTO_ACCION_POR_DEFECTO = 'transition-action-out';
const TIPOS_DATO_IR = new Set<string>(['boolean', 'integer', 'real', 'string']);

/** Tipos del editor sin semántica de ejecución propia en la IR v1: se aplanan u omiten. */
const TIPOS_OMITIDOS = new Set<string>([
  HilesElementType.STRUCTURAL_BLOCK,
  HilesElementType.PORT,
  HilesElementType.TOKEN,
]);

const entradasDe = (puertos: readonly HilesPort[]) => puertos.filter((puerto) => puerto.direction === 'input');
const salidasDe = (puertos: readonly HilesPort[]) => puertos.filter((puerto) => puerto.direction === 'output');

const puertoCondicion = (elemento: ElementoDocumento): string =>
  elemento.ports.find((puerto) => puerto.direction === 'input' && puerto.nature === 'control')?.id
  ?? entradasDe(elemento.ports)[0]?.id
  ?? PUERTO_CONDICION_POR_DEFECTO;
const puertoAccion = (elemento: ElementoDocumento): string =>
  elemento.ports.find((puerto) => puerto.direction === 'output' && puerto.nature === 'control')?.id
  ?? salidasDe(elemento.ports)[0]?.id
  ?? PUERTO_ACCION_POR_DEFECTO;

const esArcoPetri = (conexion: ConexionDocumento): boolean => {
  const tipo = conexion.data?.hilesConnectionType;
  if (tipo === HilesConnectionType.TOKEN_FLOW) return true;
  return tipo === HilesConnectionType.PETRI
    && (Boolean(conexion.sourceHandle?.startsWith('petri')) || Boolean(conexion.targetHandle?.startsWith('petri')));
};

const nombreLegible = (elemento: ElementoDocumento | undefined, id: string): string =>
  elemento?.name ? `«${elemento.name}»` : id;

const compilarElemento = (elemento: ElementoDocumento, avisos: AvisoIr[]): IrElemento | null => {
  const avisar = (codigo: AvisoIr['codigo'], mensaje: string): null => {
    avisos.push({ codigo, mensaje, elementoId: elemento.id });
    return null;
  };
  const base = { id: elemento.id, nombre: elemento.name };

  switch (elemento.type) {
    case HilesElementType.SERVICE: {
      const tipo = (salidasDe(elemento.ports)[0] ?? entradasDe(elemento.ports)[0])?.dataType ?? 'real';
      if (!TIPOS_DATO_IR.has(tipo)) {
        return avisar(CodigoIr.TIPO_DATO_INVALIDO,
          `Aviso: el Service ${nombreLegible(elemento, elemento.id)} usa el tipo «${tipo}»; la ejecución en Pico admite boolean, integer, real o string.`);
      }
      return {
        ...base,
        tipo: 'service',
        tipo_dato: tipo as IrTipoDato,
        salidas: salidasDe(elemento.ports).map((puerto) => puerto.id),
        entradas: entradasDe(elemento.ports).map((puerto) => puerto.id),
      };
    }

    case HilesElementType.FUNCTIONAL_BLOCK: {
      if (elemento.properties.code?.trim()) {
        const lenguaje = elemento.properties.codeLanguage === 'python' ? 'Python' : 'JavaScript';
        return avisar(CodigoIr.CODIGO_NO_SOPORTADO,
          `Aviso: el Functional Block ${nombreLegible(elemento, elemento.id)} contiene código ${lenguaje} que no se transfiere a la Pico en esta versión; puedes simularlo en modo local o definirlo con una expresión simple (por ejemplo «carros >= 6»).`);
      }
      const resultado = compilarExpresion(elemento.properties.expression ?? '');
      if (!resultado.ok) return avisar(CodigoIr.EXPRESION_INVALIDA, `${nombreLegible(elemento, elemento.id)}: ${resultado.mensaje}`);

      const entradas = entradasDe(elemento.ports).map((puerto) => ({ puerto: puerto.id, variable: nombreVariable(puerto.name) }));
      const renombres = new Map<string, string>();
      entradasDe(elemento.ports).forEach((puerto) => {
        renombres.set(nombreVariable(puerto.name), nombreVariable(puerto.name));
        renombres.set(puerto.name, nombreVariable(puerto.name));
      });
      const desconocida = resultado.variables.find((variable) => !renombres.has(variable));
      if (desconocida) {
        return avisar(CodigoIr.REFERENCIA_INVALIDA,
          `Aviso: la expresión de ${nombreLegible(elemento, elemento.id)} usa «${desconocida}», que no coincide con ningún puerto de entrada del bloque.`);
      }
      return {
        ...base,
        tipo: 'functional_block',
        habilitado: elemento.properties.enabled !== false,
        entradas,
        salidas: salidasDe(elemento.ports).map((puerto) => puerto.id),
        expresion: resultado.expresion ? renombrarVariables(resultado.expresion, renombres) : null,
      };
    }

    case HilesElementType.PLACE: {
      const tokens = elemento.properties.tokens ?? 0;
      const capacidad = elemento.properties.maxTokens ?? 1;
      if (!Number.isInteger(tokens) || !Number.isInteger(capacidad) || tokens < 0 || capacidad < 0 || tokens > capacidad) {
        return avisar(CodigoIr.ESTRUCTURA_INVALIDA,
          `Aviso: el Place ${nombreLegible(elemento, elemento.id)} debe tener tokens y capacidad enteros, con tokens ≤ capacidad.`);
      }
      return { ...base, tipo: 'place', tokens, capacidad };
    }

    case HilesElementType.TRANSITION:
      return {
        ...base,
        tipo: 'transition',
        habilitada: elemento.properties.enabled !== false,
        puerto_accion: puertoAccion(elemento),
      };

    default:
      return avisar(CodigoIr.TIPO_NO_SOPORTADO,
        `Aviso: el elemento ${nombreLegible(elemento, elemento.id)} es de tipo ${elemento.type}, que solo se ejecuta en simulación local en esta versión.`);
  }
};

const compilarConexion = (
  conexion: ConexionDocumento,
  documento: ReadonlyMap<string, ElementoDocumento>,
  compilados: ReadonlyMap<string, IrElemento>,
  avisos: AvisoIr[],
): IrConexion | null => {
  const avisar = (codigo: AvisoIr['codigo'], mensaje: string): null => {
    avisos.push({ codigo, mensaje, conexionId: conexion.id });
    return null;
  };
  const origenDoc = documento.get(conexion.source);
  const destinoDoc = documento.get(conexion.target);
  if (!origenDoc || !destinoDoc) {
    return avisar(CodigoIr.REFERENCIA_INVALIDA, `Aviso: la conexión ${conexion.id} apunta a un elemento que no existe.`);
  }
  if (TIPOS_OMITIDOS.has(origenDoc.type) || TIPOS_OMITIDOS.has(destinoDoc.type)) {
    return avisar(CodigoIr.CONEXION_NO_SOPORTADA,
      `Aviso: la conexión ${conexion.id} llega a un bloque estructural o puerto; en la Pico las conexiones deben unir elementos ejecutables directamente.`);
  }
  const origen = compilados.get(conexion.source);
  const destino = compilados.get(conexion.target);
  // El elemento ya generó su propio aviso; no se repite por cada conexión.
  if (!origen || !destino) return null;

  if (esArcoPetri(conexion)) {
    const valido = (origen.tipo === 'place' && destino.tipo === 'transition')
      || (origen.tipo === 'transition' && destino.tipo === 'place');
    if (!valido) {
      return avisar(CodigoIr.ARCO_INVALIDO,
        `Aviso: el arco ${conexion.id} une ${nombreLegible(origenDoc, origen.id)} con ${nombreLegible(destinoDoc, destino.id)}; un arco debe unir un Place con una Transition.`);
    }
    const peso = conexion.data?.weight ?? 1;
    return {
      id: conexion.id,
      tipo: 'arco',
      origen: origen.id,
      destino: destino.id,
      // Igual que EvaluadorPetri: un peso inválido se normaliza a 1.
      peso: Number.isInteger(peso) && peso > 0 ? peso : 1,
    };
  }

  const tipoConexion = conexion.data?.hilesConnectionType;
  if (tipoConexion !== HilesConnectionType.CONTINUOUS && tipoConexion !== HilesConnectionType.DISCRETE) {
    return avisar(CodigoIr.CONEXION_NO_SOPORTADA,
      `Aviso: la conexión ${conexion.id} es de tipo ${String(tipoConexion)} sin arcos Petri; la Pico solo ejecuta conexiones de datos (CCH/DCH) y arcos de tokens.`);
  }
  if (origen.tipo === 'place' || destino.tipo === 'place') {
    return avisar(CodigoIr.CONEXION_NO_SOPORTADA,
      `Aviso: la conexión de datos ${conexion.id} toca un Place; los Places solo se conectan mediante arcos de tokens.`);
  }

  const puertoPorDefectoOrigen = origen.tipo === 'transition'
    ? (origen.puerto_accion ?? undefined)
    : salidasDe(origenDoc.ports)[0]?.id;
  const puertoOrigen = conexion.sourceHandle ?? puertoPorDefectoOrigen;
  const salidasValidas: readonly string[] = origen.tipo === 'transition'
    ? (origen.puerto_accion ? [origen.puerto_accion] : [])
    : origen.salidas;
  if (!puertoOrigen || !salidasValidas.includes(puertoOrigen)) {
    return avisar(CodigoIr.PUERTO_INVALIDO,
      `Aviso: la conexión ${conexion.id} sale por «${String(puertoOrigen)}», que no es un puerto de salida de ${nombreLegible(origenDoc, origen.id)}.`);
  }

  let puertoDestino = conexion.targetHandle ?? entradasDe(destinoDoc.ports)[0]?.id;
  if (destino.tipo === 'transition') {
    const aceptados = [puertoCondicion(destinoDoc), 'petri-in'];
    if (puertoDestino && !aceptados.includes(puertoDestino)) {
      return avisar(CodigoIr.PUERTO_INVALIDO,
        `Aviso: la conexión ${conexion.id} llega a «${puertoDestino}», que no es la entrada de condición de ${nombreLegible(destinoDoc, destino.id)}.`);
    }
    puertoDestino = IR_PUERTO_CONDICION;
  } else {
    const entradasValidas = destino.tipo === 'service' ? destino.entradas : destino.entradas.map((entrada) => entrada.puerto);
    if (!puertoDestino || !entradasValidas.includes(puertoDestino)) {
      return avisar(CodigoIr.PUERTO_INVALIDO,
        `Aviso: la conexión ${conexion.id} llega a «${String(puertoDestino)}», que no es un puerto de entrada de ${nombreLegible(destinoDoc, destino.id)}.`);
    }
  }

  return {
    id: conexion.id,
    tipo: 'dato',
    origen: origen.id,
    puerto_origen: puertoOrigen,
    destino: destino.id,
    puerto_destino: puertoDestino,
  };
};

const tamanoJson = (valor: unknown): number => new TextEncoder().encode(JSON.stringify(valor)).byteLength;

export const compilarDocumentoAIr = (documento: HilesModelDocument): ResultadoCompilacionIr => {
  const avisos: AvisoIr[] = [];
  const porId = new Map<string, ElementoDocumento>();
  documento.allElements.forEach((elemento) => {
    if (porId.has(elemento.id)) {
      avisos.push({ codigo: CodigoIr.ID_DUPLICADO, mensaje: `Aviso: el id ${elemento.id} está repetido en el documento.`, elementoId: elemento.id });
    }
    porId.set(elemento.id, elemento);
  });

  const compilados = new Map<string, IrElemento>();
  documento.allElements.forEach((elemento) => {
    if (TIPOS_OMITIDOS.has(elemento.type)) return;
    const resultado = compilarElemento(elemento, avisos);
    if (resultado) compilados.set(resultado.id, resultado);
  });

  const conexiones: IrConexion[] = [];
  documento.connections.forEach((conexion) => {
    const resultado = compilarConexion(conexion, porId, compilados, avisos);
    if (resultado) conexiones.push(resultado);
  });

  const ir: IrModeloV1 = { elementos: [...compilados.values()], conexiones };

  if (ir.elementos.length > IR_MAX_ELEMENTOS || ir.conexiones.length > IR_MAX_CONEXIONES) {
    avisos.push({
      codigo: CodigoIr.LIMITE_EXCEDIDO,
      mensaje: `Aviso: el modelo tiene ${ir.elementos.length} elementos y ${ir.conexiones.length} conexiones; la Pico admite hasta ${IR_MAX_ELEMENTOS} y ${IR_MAX_CONEXIONES}.`,
    });
  }
  const enCiclo = elementosEnCicloDeDatos(ir);
  if (enCiclo.length > 0) {
    avisos.push({ codigo: CodigoIr.CICLO_DATOS, mensaje: `Aviso: hay un ciclo en el flujo de datos entre: ${enCiclo.join(', ')}.` });
  }
  if (tamanoJson(ir) > MQTT_MAX_PAYLOAD_BYTES - MARGEN_SOBRE_MENSAJE) {
    avisos.push({
      codigo: CodigoIr.LIMITE_EXCEDIDO,
      mensaje: `Aviso: el modelo compilado ocupa ${tamanoJson(ir)} bytes y supera el tamaño que puede recibir la Pico.`,
    });
  }
  if (avisos.length > 0) return { ok: false, avisos };

  // Red de seguridad: lo que se publica debe pasar el mismo validador que la Pico.
  const validacion = validarIrV1(ir);
  if (!validacion.valido) return { ok: false, avisos: validacion.avisos };
  return { ok: true, ir, avisos: [] };
};

/** Convierte un `HilesModelDocument` en nodos y aristas para `MotorSimulacion`. */
export const documentoAGrafoMotor = (
  documento: HilesModelDocument,
): { nodes: Node<HilesNodeData>[]; edges: Edge<HilesEdgeData>[] } => ({
  nodes: documento.allElements.map((elemento) => ({
    id: elemento.id,
    type: 'hilesNode',
    position: { x: elemento.layout.x, y: elemento.layout.y },
    ...(elemento.parentId ? { parentId: elemento.parentId } : {}),
    data: {
      hilesType: elemento.type,
      name: elemento.name,
      ports: elemento.ports,
      properties: elemento.properties,
    },
  })) as Node<HilesNodeData>[],
  edges: documento.connections as Edge<HilesEdgeData>[],
});

/**
 * Extrae la instantánea `elementos` en el formato oficial de `simulacion/estado`
 * a partir de un `MotorSimulacion` y el modelo IR v1 correspondiente.
 */
export const extraerElementosEstadoIr = (
  ir: IrModeloV1,
  motor: MotorSimulacion,
): Record<string, IrEstadoElemento> => {
  const estados = motor.obtenerEstadosElementos();
  const resultado: Record<string, IrEstadoElemento> = {};

  ir.elementos.forEach((elemento) => {
    const estado = estados.get(elemento.id);
    switch (elemento.tipo) {
      case 'service':
        resultado[elemento.id] = estado?.valor !== undefined ? { valor: estado.valor } : {};
        break;
      case 'functional_block':
        resultado[elemento.id] = estado?.valor !== undefined ? { salida: estado.valor } : {};
        break;
      case 'place':
        resultado[elemento.id] = { tokens: estado?.tokens ?? elemento.tokens };
        break;
      case 'transition':
        resultado[elemento.id] = {
          habilitada: elemento.habilitada && estado?.valor === true && !estado?.error,
          disparada: Boolean(estado?.activo),
        };
        break;
    }
  });

  return resultado;
};
