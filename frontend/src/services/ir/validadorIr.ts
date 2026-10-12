import { profundidadExpresion } from './expresiones';
import {
  CodigoIr,
  IR_MAX_CONEXIONES,
  IR_MAX_ELEMENTOS,
  IR_MAX_PROFUNDIDAD_EXPRESION,
  IR_PUERTO_CONDICION,
  type AvisoIr,
  type IrConexion,
  type IrElemento,
  type IrExpresion,
  type IrModeloV1,
  type IrTipoDato,
} from './tiposIr';

/**
 * Validador de referencia de la IR v1.
 *
 * Recibe JSON sin tipar (lo que llegaría por MQTT) y aplica las mismas reglas
 * que debe aplicar el cargador MicroPython de la Pico. Los vectores de
 * `docs/mqtt/vectores_ir_v1/invalidos` se comprueban con esta función.
 */
export type ResultadoValidacionIr =
  | { valido: true; modelo: IrModeloV1 }
  | { valido: false; avisos: AvisoIr[] };

const TIPOS_ELEMENTO = new Set(['service', 'functional_block', 'place', 'transition']);
const TIPOS_DATO = new Set<string>(['boolean', 'integer', 'real', 'string']);
const OPERADORES_BINARIOS = new Set(['==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '%', 'and', 'or']);
const OPERADORES_UNARIOS = new Set(['not', '-']);

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);
const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor.length > 0;
const esListaTextos = (valor: unknown): valor is string[] => Array.isArray(valor) && valor.every(esTexto);
const esEnteroNoNegativo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;

const coincideTipoDato = (valor: unknown, tipoDato: IrTipoDato): boolean => {
  if (tipoDato === 'boolean') return typeof valor === 'boolean';
  if (tipoDato === 'string') return typeof valor === 'string';
  if (tipoDato === 'integer') return typeof valor === 'number' && Number.isInteger(valor);
  return typeof valor === 'number' && Number.isFinite(valor);
};

/** Valida la forma de un árbol de expresión y retorna las variables usadas. */
const validarExpresion = (valor: unknown, variables: Set<string>): valor is IrExpresion => {
  if (!esObjeto(valor)) return false;
  const claves = Object.keys(valor);
  if (claves.length === 1 && 'lit' in valor) {
    return typeof valor.lit === 'boolean' || typeof valor.lit === 'string'
      || (typeof valor.lit === 'number' && Number.isFinite(valor.lit));
  }
  if (claves.length === 1 && 'var' in valor) {
    if (!esTexto(valor.var)) return false;
    variables.add(valor.var);
    return true;
  }
  if ('op' in valor && 'args' in valor && claves.length === 2 && typeof valor.op === 'string' && Array.isArray(valor.args)) {
    if (valor.args.length === 1 && OPERADORES_UNARIOS.has(valor.op)) {
      return validarExpresion(valor.args[0], variables);
    }
    if (valor.args.length === 2 && OPERADORES_BINARIOS.has(valor.op)) {
      return valor.args.every((argumento) => validarExpresion(argumento, variables));
    }
  }
  return false;
};

/** Kahn sobre las conexiones de datos; retorna los ids que quedan en un ciclo. */
export const elementosEnCicloDeDatos = (modelo: IrModeloV1): string[] => {
  const grado = new Map(modelo.elementos.map((elemento) => [elemento.id, 0]));
  const sucesores = new Map<string, string[]>(modelo.elementos.map((elemento) => [elemento.id, []]));
  modelo.conexiones.forEach((conexion) => {
    if (conexion.tipo !== 'dato') return;
    sucesores.get(conexion.origen)?.push(conexion.destino);
    grado.set(conexion.destino, (grado.get(conexion.destino) ?? 0) + 1);
  });
  const pendientes = modelo.elementos.filter((elemento) => grado.get(elemento.id) === 0).map((elemento) => elemento.id);
  const resueltos = new Set<string>();
  while (pendientes.length > 0) {
    const actual = pendientes.shift() as string;
    resueltos.add(actual);
    (sucesores.get(actual) ?? []).forEach((sucesor) => {
      const restante = (grado.get(sucesor) ?? 0) - 1;
      grado.set(sucesor, restante);
      if (restante === 0) pendientes.push(sucesor);
    });
  }
  return modelo.elementos.filter((elemento) => !resueltos.has(elemento.id)).map((elemento) => elemento.id);
};

const puertosSalida = (elemento: IrElemento): string[] => {
  if (elemento.tipo === 'service' || elemento.tipo === 'functional_block') return elemento.salidas;
  if (elemento.tipo === 'transition') return elemento.puerto_accion ? [elemento.puerto_accion] : [];
  return [];
};

const puertosEntrada = (elemento: IrElemento): string[] => {
  if (elemento.tipo === 'service') return elemento.entradas;
  if (elemento.tipo === 'functional_block') return elemento.entradas.map((entrada) => entrada.puerto);
  if (elemento.tipo === 'transition') return [IR_PUERTO_CONDICION];
  return [];
};

const validarElemento = (valor: unknown, indice: number): AvisoIr | IrElemento => {
  const aviso = (codigo: AvisoIr['codigo'], detalle: string, elementoId?: string): AvisoIr =>
    ({ codigo, mensaje: `Aviso en elemento ${elementoId ?? `#${indice}`}: ${detalle}.`, ...(elementoId ? { elementoId } : {}) });

  if (!esObjeto(valor) || !esTexto(valor.id)) return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'debe ser un objeto con id de texto');
  const id = valor.id;
  if (typeof valor.tipo !== 'string' || !TIPOS_ELEMENTO.has(valor.tipo)) {
    return aviso(CodigoIr.TIPO_NO_SOPORTADO, `el tipo «${String(valor.tipo)}» no está soportado en la IR v1`, id);
  }
  if (typeof valor.nombre !== 'string') return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'nombre debe ser texto', id);

  switch (valor.tipo) {
    case 'service':
      if (typeof valor.tipo_dato !== 'string' || !TIPOS_DATO.has(valor.tipo_dato)) {
        return aviso(CodigoIr.TIPO_DATO_INVALIDO, 'tipo_dato debe ser boolean, integer, real o string', id);
      }
      if (!esListaTextos(valor.salidas) || !esListaTextos(valor.entradas)) {
        return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'salidas y entradas deben ser listas de texto', id);
      }
      if (valor.valor_inicial !== undefined && !coincideTipoDato(valor.valor_inicial, valor.tipo_dato as IrTipoDato)) {
        return aviso(CodigoIr.TIPO_DATO_INVALIDO, 'valor_inicial no coincide con tipo_dato', id);
      }
      break;
    case 'functional_block': {
      if (typeof valor.habilitado !== 'boolean') return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'habilitado debe ser booleano', id);
      if (!esListaTextos(valor.salidas)) return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'salidas debe ser una lista de texto', id);
      if (!Array.isArray(valor.entradas)
        || !valor.entradas.every((entrada) => esObjeto(entrada) && esTexto(entrada.puerto) && esTexto(entrada.variable))) {
        return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'entradas debe ser una lista de { puerto, variable }', id);
      }
      if (valor.expresion !== null) {
        const usadas = new Set<string>();
        if (!validarExpresion(valor.expresion, usadas)) {
          return aviso(CodigoIr.EXPRESION_INVALIDA, 'la expresión no respeta la gramática de la IR v1', id);
        }
        if (profundidadExpresion(valor.expresion) > IR_MAX_PROFUNDIDAD_EXPRESION) {
          return aviso(CodigoIr.LIMITE_EXCEDIDO, `la expresión supera la profundidad ${IR_MAX_PROFUNDIDAD_EXPRESION}`, id);
        }
        const declaradas = new Set((valor.entradas as Array<{ variable: string }>).map((entrada) => entrada.variable));
        const faltante = [...usadas].find((variable) => !declaradas.has(variable));
        if (faltante) return aviso(CodigoIr.REFERENCIA_INVALIDA, `la variable «${faltante}» no corresponde a ninguna entrada`, id);
      }
      break;
    }
    case 'place':
      if (!esEnteroNoNegativo(valor.tokens) || !esEnteroNoNegativo(valor.capacidad) || valor.tokens > valor.capacidad) {
        return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'tokens y capacidad deben ser enteros ≥ 0 y tokens ≤ capacidad', id);
      }
      break;
    case 'transition':
      if (typeof valor.habilitada !== 'boolean') return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'habilitada debe ser booleano', id);
      if (valor.puerto_accion !== null && !esTexto(valor.puerto_accion)) {
        return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'puerto_accion debe ser texto o null', id);
      }
      break;
  }
  return valor as unknown as IrElemento;
};

const validarConexion = (valor: unknown, indice: number, elementos: ReadonlyMap<string, IrElemento>): AvisoIr | IrConexion => {
  const aviso = (codigo: AvisoIr['codigo'], detalle: string, conexionId?: string): AvisoIr =>
    ({ codigo, mensaje: `Aviso en conexión ${conexionId ?? `#${indice}`}: ${detalle}.`, ...(conexionId ? { conexionId } : {}) });

  if (!esObjeto(valor) || !esTexto(valor.id)) return aviso(CodigoIr.ESTRUCTURA_INVALIDA, 'debe ser un objeto con id de texto');
  const id = valor.id;
  if (valor.tipo !== 'dato' && valor.tipo !== 'arco') {
    return aviso(CodigoIr.CONEXION_NO_SOPORTADA, 'tipo debe ser «dato» o «arco»', id);
  }
  const origen = esTexto(valor.origen) ? elementos.get(valor.origen) : undefined;
  const destino = esTexto(valor.destino) ? elementos.get(valor.destino) : undefined;
  if (!origen || !destino) return aviso(CodigoIr.REFERENCIA_INVALIDA, 'origen y destino deben ser elementos existentes', id);

  if (valor.tipo === 'arco') {
    const lugarATransicion = origen.tipo === 'place' && destino.tipo === 'transition';
    const transicionALugar = origen.tipo === 'transition' && destino.tipo === 'place';
    if (!lugarATransicion && !transicionALugar) return aviso(CodigoIr.ARCO_INVALIDO, 'un arco une un place con una transition', id);
    if (typeof valor.peso !== 'number' || !Number.isInteger(valor.peso) || valor.peso < 1) {
      return aviso(CodigoIr.ARCO_INVALIDO, 'peso debe ser un entero ≥ 1', id);
    }
    return valor as unknown as IrConexion;
  }

  if (!esTexto(valor.puerto_origen) || !puertosSalida(origen).includes(valor.puerto_origen)) {
    return aviso(CodigoIr.PUERTO_INVALIDO, `«${String(valor.puerto_origen)}» no es una salida de ${origen.id}`, id);
  }
  if (!esTexto(valor.puerto_destino) || !puertosEntrada(destino).includes(valor.puerto_destino)) {
    return aviso(CodigoIr.PUERTO_INVALIDO, `«${String(valor.puerto_destino)}» no es una entrada de ${destino.id}`, id);
  }
  return valor as unknown as IrConexion;
};

/**
 * Valida un modelo IR v1. Se detiene en el primer problema: así la Pico y la
 * web reportan el mismo código para el mismo modelo.
 */
export const validarIrV1 = (modelo: unknown): ResultadoValidacionIr => {
  const falla = (aviso: AvisoIr): ResultadoValidacionIr => ({ valido: false, avisos: [aviso] });

  if (!esObjeto(modelo) || !Array.isArray(modelo.elementos) || !Array.isArray(modelo.conexiones)) {
    return falla({ codigo: CodigoIr.ESTRUCTURA_INVALIDA, mensaje: 'Aviso: el modelo debe contener las listas elementos y conexiones.' });
  }
  if (modelo.elementos.length > IR_MAX_ELEMENTOS || modelo.conexiones.length > IR_MAX_CONEXIONES) {
    return falla({
      codigo: CodigoIr.LIMITE_EXCEDIDO,
      mensaje: `Aviso: la IR v1 admite hasta ${IR_MAX_ELEMENTOS} elementos y ${IR_MAX_CONEXIONES} conexiones.`,
    });
  }

  const elementos = new Map<string, IrElemento>();
  for (const [indice, crudo] of modelo.elementos.entries()) {
    const resultado = validarElemento(crudo, indice);
    if ('codigo' in resultado) return falla(resultado);
    if (elementos.has(resultado.id)) {
      return falla({ codigo: CodigoIr.ID_DUPLICADO, mensaje: `Aviso: el id ${resultado.id} está repetido.`, elementoId: resultado.id });
    }
    elementos.set(resultado.id, resultado);
  }

  const conexiones: IrConexion[] = [];
  const idsConexion = new Set<string>();
  for (const [indice, crudo] of modelo.conexiones.entries()) {
    const resultado = validarConexion(crudo, indice, elementos);
    if ('codigo' in resultado) return falla(resultado);
    if (idsConexion.has(resultado.id) || elementos.has(resultado.id)) {
      return falla({ codigo: CodigoIr.ID_DUPLICADO, mensaje: `Aviso: el id ${resultado.id} está repetido.`, conexionId: resultado.id });
    }
    idsConexion.add(resultado.id);
    conexiones.push(resultado);
  }

  const valido: IrModeloV1 = { elementos: [...elementos.values()], conexiones };
  const enCiclo = elementosEnCicloDeDatos(valido);
  if (enCiclo.length > 0) {
    return falla({ codigo: CodigoIr.CICLO_DATOS, mensaje: `Aviso: hay un ciclo de datos entre: ${enCiclo.join(', ')}.` });
  }
  return { valido: true, modelo: valido };
};
