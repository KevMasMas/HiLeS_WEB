import type { Edge, Node } from '@xyflow/react';
import {
  isModelDocument,
  migrateV1toV2,
  type HilesModelDocument as DomainHilesModelDocument,
} from '../../domain/modelDocument';
import { nombreVariable } from '../../engine/elementos/ElementoBloqueFuncional';
import type { MotorSimulacion } from '../../engine/MotorSimulacion';
import {
  HilesConnectionType,
  HilesElementType,
  type HilesEdgeData,
  type HilesNodeData,
  type HilesNodeProperties,
  type HilesPort,
  type PortDataType,
} from '../../types/hiles';
import { compilarExpresion, renombrarVariables } from './expresiones';
import { IR_PUERTO_CONDICION } from './tiposIr';
import {
  IR_LIMITES_CANALES_V2,
  IR_VERSION_V2,
  type IrConexionV2,
  type IrDiagnosticoValidacionV2,
  type IrElementoV2,
  type IrEntradaExternaV2,
  type IrEstadoElementoV2,
  type IrFunctionalBlockElementV2,
  type IrHoldElementV2,
  type IrModeloV2,
  type IrPlaceElementV2,
  type IrPuertoTipadoV2,
  type IrSampleElementV2,
  type IrServiceElementV2,
  type IrTipoDatoV2,
  type IrTransitionElementV2,
  type IrValorRuntimeV2,
  type ResultadoValidacionIrV2,
} from './tiposIrV2';
import {
  ErrorPythonPerfilIrV2,
  esIdentificadorPythonValido,
  PYTHON_FORBIDDEN_WORDS,
  validarCodigoPythonPerfilV2,
  validarModeloIrV2,
  validarValorRuntimeIrV2,
} from './validadorIrV2';

type HilesDataType = PortDataType;
type HilesElementProperties = HilesNodeProperties;
type HilesModelElement = DomainHilesModelDocument['allElements'][number];
type HilesModelConnection = DomainHilesModelDocument['connections'][number];

export interface OpcionesCompilacionIrV2 {
  modeloId?: string;
  version?: number;
  nombre?: string;
  descripcion?: string;
  compiladoEn?: string;
  permitirVacio?: boolean;
}

export type DocumentoCompilableIrV2 =
  | DomainHilesModelDocument
  | Record<string, unknown>;

const PUERTO_CONDICION_POR_DEFECTO = 'transition-condition-in';
const PUERTO_ACCION_POR_DEFECTO = 'transition-action-out';
const PUERTO_MUESTRA_DATO_POR_DEFECTO = 'sample-data-in';
const PUERTO_MUESTRA_CONTROL_POR_DEFECTO = 'sample-control-in';
const PUERTO_MUESTRA_SALIDA_POR_DEFECTO = 'sample-out';
const PUERTO_HOLD_ENTRADA_POR_DEFECTO = 'hold-in';
const PUERTO_HOLD_CCH_POR_DEFECTO = 'hold-cch-out';
const PUERTO_HOLD_LCH_POR_DEFECTO = 'hold-lch-out';

function normalizarIdentificador(texto: string): string {
  const limpio = texto
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio || 'modelo-hiles';
}

function normalizarNombreVariablePython(
  texto: string,
  prefijo: string,
  indice: number,
  usados: Set<string>,
): string {
  const candidatoBase = nombreVariable(texto || '');
  let base =
    candidatoBase &&
    esIdentificadorPythonValido(candidatoBase) &&
    !PYTHON_FORBIDDEN_WORDS.has(candidatoBase) &&
    !candidatoBase.startsWith('__')
      ? candidatoBase
      : indice === 0
        ? prefijo
        : `${prefijo}_${indice + 1}`;

  if (
    !esIdentificadorPythonValido(base) ||
    PYTHON_FORBIDDEN_WORDS.has(base) ||
    base.startsWith('__')
  ) {
    base = `${prefijo}_${indice + 1}`;
  }

  let final = base;
  let sufijo = 2;
  while (usados.has(final)) {
    final = `${base}_${sufijo}`;
    sufijo += 1;
  }
  usados.add(final);
  return final;
}

function mapearTipoDatoV2(tipo?: HilesDataType | string): IrTipoDatoV2 {
  if (
    tipo === 'boolean' ||
    tipo === 'integer' ||
    tipo === 'real' ||
    tipo === 'string' ||
    tipo === 'vector' ||
    tipo === 'custom'
  ) {
    return tipo;
  }
  return 'real';
}

function parsearValorInicialV2(
  raw: unknown,
  tipoDato: IrTipoDatoV2,
): IrValorRuntimeV2 | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string' && raw.trim() === '') return undefined;

  if (typeof raw === 'boolean' || typeof raw === 'number' || Array.isArray(raw)) {
    try {
      return validarValorRuntimeIrV2(raw, tipoDato, { coerce: true });
    } catch {
      return undefined;
    }
  }

  if (typeof raw === 'object') {
    try {
      return validarValorRuntimeIrV2(raw, tipoDato, { coerce: true });
    } catch {
      return undefined;
    }
  }

  if (typeof raw === 'string') {
    const limpio = raw.trim();
    if (tipoDato === 'boolean') {
      if (limpio.toLowerCase() === 'true' || limpio === '1') return true;
      if (limpio.toLowerCase() === 'false' || limpio === '0') return false;
      return undefined;
    }
    if (tipoDato === 'integer') {
      const n = Number.parseInt(limpio, 10);
      return Number.isNaN(n) ? undefined : n;
    }
    if (tipoDato === 'real') {
      const n = Number.parseFloat(limpio);
      return Number.isNaN(n) ? undefined : n;
    }
    if (tipoDato === 'vector' || tipoDato === 'custom') {
      try {
        const parsed = JSON.parse(limpio);
        return validarValorRuntimeIrV2(parsed, tipoDato, { coerce: true });
      } catch {
        return undefined;
      }
    }
    return limpio;
  }

  return undefined;
}

function normalizarRetardoMs(valor: unknown): number | undefined {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return undefined;
  }
  const redondeado = Math.round(valor);
  return Math.min(redondeado, IR_LIMITES_CANALES_V2.MAX_DELAY_MS);
}

function obtenerPuertosDireccion(
  puertos: readonly HilesPort[] | undefined,
  direction: 'input' | 'output',
): HilesPort[] {
  return (puertos ?? []).filter((p) => p.direction === direction);
}

function extraerElementosYConexiones(documento: DocumentoCompilableIrV2): {
  elementos: HilesModelElement[];
  conexiones: HilesModelConnection[];
  schemaVersion: number;
  rootBlockId: string | null;
  nombreDoc?: string;
} {
  if (isModelDocument(documento)) {
    const migrado = migrateV1toV2(documento);
    const migradoRec = migrado as unknown as Record<string, unknown>;
    const metaRec =
      typeof migradoRec.meta === 'object' && migradoRec.meta !== null
        ? (migradoRec.meta as Record<string, unknown>)
        : undefined;
    return {
      elementos: migrado.allElements,
      conexiones: migrado.connections,
      schemaVersion: migrado.schemaVersion ?? 2,
      rootBlockId:
        typeof migradoRec.rootStructuralBlockId === 'string'
          ? migradoRec.rootStructuralBlockId
          : null,
      nombreDoc: typeof metaRec?.name === 'string' ? metaRec.name : undefined,
    };
  }

  const docRecord = documento as Record<string, unknown>;
  const elementos = Array.isArray(docRecord.allElements)
    ? (docRecord.allElements as HilesModelElement[])
    : Array.isArray(docRecord.elements)
      ? (docRecord.elements as HilesModelElement[])
      : [];
  const conexiones = Array.isArray(docRecord.connections)
    ? (docRecord.connections as HilesModelConnection[])
    : [];
  const meta =
    typeof docRecord.meta === 'object' && docRecord.meta !== null
      ? (docRecord.meta as Record<string, unknown>)
      : undefined;

  return {
    elementos,
    conexiones,
    schemaVersion:
      typeof docRecord.schemaVersion === 'number' ? docRecord.schemaVersion : 2,
    rootBlockId:
      typeof docRecord.rootStructuralBlockId === 'string'
        ? docRecord.rootStructuralBlockId
        : null,
    nombreDoc: typeof meta?.name === 'string' ? meta.name : undefined,
  };
}

interface EndpointResuelto {
  nodoId: string;
  puertoId: string;
  bloquesAplanados: string[];
}

function aplanarConexionesFrontera(
  elementos: HilesModelElement[],
  conexiones: HilesModelConnection[],
): {
  conexionesAplanadas: HilesModelConnection[];
  structuralBlocksAplanados: string[];
} {
  const mapaElementos = new Map<string, HilesModelElement>(
    elementos.map((e) => [e.id, e]),
  );

  const estructurales = new Set<string>(
    elementos
      .filter((e) => e.type === HilesElementType.STRUCTURAL_BLOCK)
      .map((e) => e.id),
  );
  const nodosPort = new Set<string>(
    elementos.filter((e) => e.type === HilesElementType.PORT).map((e) => e.id),
  );

  const entrantesPorDestino = new Map<string, HilesModelConnection[]>();
  const salientesPorOrigen = new Map<string, HilesModelConnection[]>();

  for (const conn of conexiones) {
    const listaDest = entrantesPorDestino.get(conn.target) ?? [];
    listaDest.push(conn);
    entrantesPorDestino.set(conn.target, listaDest);

    const listaOrig = salientesPorOrigen.get(conn.source) ?? [];
    listaOrig.push(conn);
    salientesPorOrigen.set(conn.source, listaOrig);
  }

  const esNodoPuente = (id: string): boolean =>
    estructurales.has(id) || nodosPort.has(id);

  const resolverOrigenReal = (
    conn: HilesModelConnection,
    visitados = new Set<string>(),
  ): EndpointResuelto[] => {
    if (!esNodoPuente(conn.source)) {
      return [
        {
          nodoId: conn.source,
          puertoId: conn.sourceHandle ?? '',
          bloquesAplanados: [],
        },
      ];
    }

    const claveVisita = `${conn.id}:src:${conn.source}:${conn.sourceHandle ?? ''}`;
    if (visitados.has(claveVisita)) return [];
    visitados.add(claveVisita);

    const entrantes = (entrantesPorDestino.get(conn.source) ?? []).filter(
      (c) => {
        if (nodosPort.has(conn.source)) return true;
        if (!conn.sourceHandle || !c.targetHandle) return true;
        return c.targetHandle === conn.sourceHandle;
      },
    );

    const resultados: EndpointResuelto[] = [];
    for (const previa of entrantes) {
      for (const res of resolverOrigenReal(previa, new Set(visitados))) {
        resultados.push({
          nodoId: res.nodoId,
          puertoId: res.puertoId,
          bloquesAplanados: estructurales.has(conn.source)
            ? [...res.bloquesAplanados, conn.source]
            : res.bloquesAplanados,
        });
      }
    }
    return resultados;
  };

  const resolverDestinoReal = (
    conn: HilesModelConnection,
    visitados = new Set<string>(),
  ): EndpointResuelto[] => {
    if (!esNodoPuente(conn.target)) {
      return [
        {
          nodoId: conn.target,
          puertoId: conn.targetHandle ?? '',
          bloquesAplanados: [],
        },
      ];
    }

    const claveVisita = `${conn.id}:dst:${conn.target}:${conn.targetHandle ?? ''}`;
    if (visitados.has(claveVisita)) return [];
    visitados.add(claveVisita);

    const salientes = (salientesPorOrigen.get(conn.target) ?? []).filter(
      (c) => {
        if (nodosPort.has(conn.target)) return true;
        if (!conn.targetHandle || !c.sourceHandle) return true;
        return c.sourceHandle === conn.targetHandle;
      },
    );

    const resultados: EndpointResuelto[] = [];
    for (const siguiente of salientes) {
      for (const res of resolverDestinoReal(siguiente, new Set(visitados))) {
        resultados.push({
          nodoId: res.nodoId,
          puertoId: res.puertoId,
          bloquesAplanados: estructurales.has(conn.target)
            ? [...res.bloquesAplanados, conn.target]
            : res.bloquesAplanados,
        });
      }
    }
    return resultados;
  };

  const conexionesAplanadas: HilesModelConnection[] = [];
  const bloquesUsados = new Set<string>();
  const clavesUnicas = new Set<string>();

  for (const conn of conexiones) {
    if (esNodoPuente(conn.source) && esNodoPuente(conn.target)) {
      continue;
    }
    if (!esNodoPuente(conn.source) && esNodoPuente(conn.target)) {
      const destinos = resolverDestinoReal(conn);
      destinos.forEach((dst, idx) => {
        dst.bloquesAplanados.forEach((b) => bloquesUsados.add(b));
        const clave = `${conn.source}:${conn.sourceHandle ?? ''}->${dst.nodoId}:${dst.puertoId}:${conn.data?.hilesConnectionType ?? ''}`;
        if (!clavesUnicas.has(clave)) {
          clavesUnicas.add(clave);
          conexionesAplanadas.push({
            ...conn,
            id: destinos.length === 1 ? conn.id : `${conn.id}__flat_${idx + 1}`,
            target: dst.nodoId,
            targetHandle: dst.puertoId || undefined,
          });
        }
      });
      continue;
    }
    if (esNodoPuente(conn.source) && !esNodoPuente(conn.target)) {
      const origenes = resolverOrigenReal(conn);
      origenes.forEach((src, idx) => {
        src.bloquesAplanados.forEach((b) => bloquesUsados.add(b));
        const clave = `${src.nodoId}:${src.puertoId}->${conn.target}:${conn.targetHandle ?? ''}:${conn.data?.hilesConnectionType ?? ''}`;
        if (!clavesUnicas.has(clave)) {
          clavesUnicas.add(clave);
          conexionesAplanadas.push({
            ...conn,
            id: origenes.length === 1 ? conn.id : `${conn.id}__flat_${idx + 1}`,
            source: src.nodoId,
            sourceHandle: src.puertoId || undefined,
          });
        }
      });
      continue;
    }

    const elemSrc = mapaElementos.get(conn.source);
    const elemDst = mapaElementos.get(conn.target);
    if (elemSrc?.parentId && estructurales.has(elemSrc.parentId)) {
      bloquesUsados.add(elemSrc.parentId);
    }
    if (elemDst?.parentId && estructurales.has(elemDst.parentId)) {
      bloquesUsados.add(elemDst.parentId);
    }

    const clave = `${conn.source}:${conn.sourceHandle ?? ''}->${conn.target}:${conn.targetHandle ?? ''}:${conn.data?.hilesConnectionType ?? ''}:${conn.id}`;
    if (!clavesUnicas.has(clave)) {
      clavesUnicas.add(clave);
      conexionesAplanadas.push(conn);
    }
  }

  for (const idBloque of estructurales) {
    bloquesUsados.add(idBloque);
  }

  return {
    conexionesAplanadas,
    structuralBlocksAplanados: [...bloquesUsados],
  };
}

function esArcoPetriConexion(
  conn: HilesModelConnection,
  origenTipo?: string,
  destinoTipo?: string,
): boolean {
  const tipo = conn.data?.hilesConnectionType;
  if (tipo === HilesConnectionType.TOKEN_FLOW) {
    return true;
  }
  const tocaPlace =
    origenTipo === HilesElementType.PLACE ||
    destinoTipo === HilesElementType.PLACE ||
    origenTipo === 'place' ||
    destinoTipo === 'place';
  if (tocaPlace && tipo === HilesConnectionType.PETRI) {
    return true;
  }
  const srcHandle = conn.sourceHandle ?? '';
  const dstHandle = conn.targetHandle ?? '';
  if (
    tipo === HilesConnectionType.PETRI &&
    (srcHandle.startsWith('petri') || dstHandle.startsWith('petri'))
  ) {
    return true;
  }
  return false;
}

/**
 * Compila un `HilesModelDocument` del editor al formato ejecutable `IrModeloV2`.
 */
export function compilarModeloEditorAIrV2(
  documento: DocumentoCompilableIrV2,
  opciones: OpcionesCompilacionIrV2 = {},
): ResultadoValidacionIrV2 {
  const errores: IrDiagnosticoValidacionV2[] = [];
  const advertencias: IrDiagnosticoValidacionV2[] = [];
  const normalizacionesLegadas = new Set<string>();

  const infoDoc = extraerElementosYConexiones(documento);
  const elementosOriginales = infoDoc.elementos;
  const conexionesOriginales = infoDoc.conexiones;

  const tokensAdicionalesPorPlace = new Map<string, number>();
  for (const el of elementosOriginales) {
    if (el.type === HilesElementType.TOKEN) {
      normalizacionesLegadas.add('token_node_migrado_a_place');
      if (el.parentId) {
        const cant =
          typeof el.properties?.tokens === 'number' && el.properties.tokens > 0
            ? Math.trunc(el.properties.tokens)
            : 1;
        tokensAdicionalesPorPlace.set(
          el.parentId,
          (tokensAdicionalesPorPlace.get(el.parentId) ?? 0) + cant,
        );
      }
    }
  }

  const { conexionesAplanadas, structuralBlocksAplanados } =
    aplanarConexionesFrontera(elementosOriginales, conexionesOriginales);

  if (structuralBlocksAplanados.length > 0) {
    normalizacionesLegadas.add('structural_block_aplanado');
  }

  const elementosIr: IrElementoV2[] = [];
  const entradasExternas: IrEntradaExternaV2[] = [];
  const mapaElementosIr = new Map<string, IrElementoV2>();
  const mapaElementosOriginales = new Map<string, HilesModelElement>();

  for (const elemento of elementosOriginales) {
    if (
      elemento.type === HilesElementType.STRUCTURAL_BLOCK ||
      elemento.type === HilesElementType.PORT ||
      elemento.type === HilesElementType.TOKEN
    ) {
      continue;
    }

    mapaElementosOriginales.set(elemento.id, elemento);
    const props = (elemento.properties ?? {}) as Partial<HilesElementProperties> &
      Record<string, unknown>;
    const entradasPort = obtenerPuertosDireccion(elemento.ports, 'input');
    const salidasPort = obtenerPuertosDireccion(elemento.ports, 'output');
    const retardoElemento = normalizarRetardoMs(
      props.executionDelay ?? props.delay,
    );

    switch (elemento.type) {
      case HilesElementType.SERVICE: {
        const puertoPrincipal = salidasPort[0] ?? entradasPort[0];
        const tipoDato = mapearTipoDatoV2(puertoPrincipal?.dataType);
        const salidas =
          salidasPort.length > 0
            ? salidasPort.map((p) => p.id)
            : entradasPort.length === 0
              ? ['service-out']
              : [];
        const entradas = entradasPort.map((p) => p.id);
        const valorInicial = parsearValorInicialV2(
          props.initialValue ?? props.heldValue,
          tipoDato,
        );

        const serviceIr: IrServiceElementV2 = {
          id: elemento.id,
          tipo: 'service',
          nombre: elemento.name || elemento.id,
          tipo_dato: tipoDato,
          salidas,
          entradas,
          ...(valorInicial !== undefined ? { valor_inicial: valorInicial } : {}),
          ...(retardoElemento !== undefined
            ? { retardo_ms: retardoElemento }
            : {}),
        };

        elementosIr.push(serviceIr);
        mapaElementosIr.set(elemento.id, serviceIr);

        if (salidas.length > 0) {
          entradasExternas.push({
            elemento_id: elemento.id,
            nombre: elemento.name || elemento.id,
            puerto_salida: salidas[0],
            tipo_dato: tipoDato,
            ...(valorInicial !== undefined ? { valor_inicial: valorInicial } : {}),
          });
        }
        break;
      }

      case HilesElementType.FUNCTIONAL_BLOCK: {
        const usadosIn = new Set<string>();
        const entradasTipadas: IrPuertoTipadoV2[] = entradasPort.map(
          (p, idx) => ({
            puerto: p.id,
            variable: normalizarNombreVariablePython(
              p.name || p.id,
              'in',
              idx,
              usadosIn,
            ),
            tipo_dato: mapearTipoDatoV2(p.dataType),
          }),
        );

        const usadosOut = new Set<string>();
        const salidasTipadas: IrPuertoTipadoV2[] = (
          salidasPort.length > 0
            ? salidasPort
            : [
                {
                  id: 'fb-out-1',
                  name: 'out',
                  direction: 'output' as const,
                  dataType: 'real' as const,
                  nature: 'continuous' as const,
                  side: 'right' as const,
                  offset: 0.5,
                },
              ]
        ).map((p, idx) => ({
          puerto: p.id,
          variable: normalizarNombreVariablePython(
            p.name || p.id,
            'out',
            idx,
            usadosOut,
          ),
          tipo_dato: mapearTipoDatoV2(p.dataType),
        }));

        const codigoTexto =
          typeof props.code === 'string' && props.code.trim().length > 0
            ? props.code.trim()
            : '';
        const exprTexto =
          typeof props.expression === 'string' &&
          props.expression.trim().length > 0
            ? props.expression.trim()
            : '';
        const lenguajeEditor = props.codeLanguage;

        if (codigoTexto.length > 0 && lenguajeEditor === 'javascript') {
          errores.push({
            codigo: 'IR_CODIGO_NO_SOPORTADO',
            severidad: 'error',
            mensaje: `El bloque funcional '${elemento.name || elemento.id}' usa JavaScript imperativo; la IR v2 exige perfil Python o expresión pura.`,
            elemento_id: elemento.id,
          });
          break;
        }

        if (codigoTexto.length > 0) {
          try {
            validarCodigoPythonPerfilV2(
              codigoTexto,
              entradasTipadas,
              salidasTipadas,
            );
          } catch (err) {
            if (err instanceof ErrorPythonPerfilIrV2) {
              errores.push({
                codigo: err.codigo,
                severidad: 'error',
                mensaje: `Bloque funcional '${elemento.name || elemento.id}': ${err.message}`,
                elemento_id: elemento.id,
              });
              break;
            }
          }

          const fbPython: IrFunctionalBlockElementV2 = {
            id: elemento.id,
            tipo: 'functional_block',
            nombre: elemento.name || elemento.id,
            habilitado: props.enabled !== false,
            lenguaje: 'python',
            codigo: codigoTexto,
            entradas: entradasTipadas,
            salidas: salidasTipadas,
            ...(retardoElemento !== undefined
              ? { retardo_ms: retardoElemento }
              : {}),
          };
          elementosIr.push(fbPython);
          mapaElementosIr.set(elemento.id, fbPython);
        } else {
          const compiladoExpr = compilarExpresion(exprTexto);
          if (!compiladoExpr.ok) {
            errores.push({
              codigo: 'IR_EXPRESION_INVALIDA',
              severidad: 'error',
              mensaje: `Expresión inválida en '${elemento.name || elemento.id}': ${compiladoExpr.mensaje}`,
              elemento_id: elemento.id,
            });
            break;
          }

          const renombres = new Map<string, string>();
          entradasPort.forEach((puerto, idx) => {
            const varFinal = entradasTipadas[idx].variable;
            renombres.set(varFinal, varFinal);
            renombres.set(nombreVariable(puerto.name), varFinal);
            renombres.set(puerto.name, varFinal);
            renombres.set(puerto.id, varFinal);
          });

          const desconocida = compiladoExpr.variables.find(
            (variable) => !renombres.has(variable),
          );
          if (desconocida) {
            errores.push({
              codigo: 'IR_REFERENCIA_INVALIDA',
              severidad: 'error',
              mensaje: `La expresión de '${elemento.name || elemento.id}' usa '${desconocida}', que no coincide con ningún puerto de entrada.`,
              elemento_id: elemento.id,
            });
            break;
          }

          const fbExpr: IrFunctionalBlockElementV2 = {
            id: elemento.id,
            tipo: 'functional_block',
            nombre: elemento.name || elemento.id,
            habilitado: props.enabled !== false,
            lenguaje: 'expresion',
            expresion: compiladoExpr.expresion
              ? renombrarVariables(compiladoExpr.expresion, renombres)
              : null,
            entradas: entradasTipadas,
            salidas: salidasTipadas,
            ...(retardoElemento !== undefined
              ? { retardo_ms: retardoElemento }
              : {}),
          };
          elementosIr.push(fbExpr);
          mapaElementosIr.set(elemento.id, fbExpr);
        }
        break;
      }

      case HilesElementType.SAMPLE: {
        const puertoControlPort =
          entradasPort.find(
            (p) =>
              p.nature === 'control' ||
              p.id.includes('control') ||
              p.name.toLowerCase().includes('control') ||
              p.name.toLowerCase().includes('trigger'),
          ) ?? entradasPort[1];
        const puertoDatoPort =
          entradasPort.find((p) => p.id !== puertoControlPort?.id) ??
          entradasPort[0];
        const puertoSalidaPort = salidasPort[0];
        const tipoDato = mapearTipoDatoV2(
          puertoDatoPort?.dataType ?? puertoSalidaPort?.dataType,
        );

        const sampleIr: IrSampleElementV2 = {
          id: elemento.id,
          tipo: 'sample',
          nombre: elemento.name || elemento.id,
          habilitado: props.enabled !== false,
          tipo_dato: tipoDato,
          puerto_dato: puertoDatoPort?.id ?? PUERTO_MUESTRA_DATO_POR_DEFECTO,
          puerto_control:
            puertoControlPort?.id ?? PUERTO_MUESTRA_CONTROL_POR_DEFECTO,
          puerto_salida:
            puertoSalidaPort?.id ?? PUERTO_MUESTRA_SALIDA_POR_DEFECTO,
          ...(retardoElemento !== undefined
            ? { retardo_ms: retardoElemento }
            : {}),
        };
        elementosIr.push(sampleIr);
        mapaElementosIr.set(elemento.id, sampleIr);
        break;
      }

      case HilesElementType.HOLD: {
        const puertoEntradaPort = entradasPort[0];
        const puertoLchPort =
          salidasPort.find(
            (p) =>
              p.nature === 'control' ||
              p.id.includes('lch') ||
              p.name.toLowerCase().includes('lch') ||
              p.name.toLowerCase().includes('event'),
          ) ?? salidasPort[1];
        const puertoCchPort =
          salidasPort.find((p) => p.id !== puertoLchPort?.id) ?? salidasPort[0];
        const tipoDato = mapearTipoDatoV2(
          puertoCchPort?.dataType ?? puertoEntradaPort?.dataType,
        );
        const valorInicial = parsearValorInicialV2(
          props.heldValue ?? props.initialValue,
          tipoDato,
        );

        const holdIr: IrHoldElementV2 = {
          id: elemento.id,
          tipo: 'hold',
          nombre: elemento.name || elemento.id,
          habilitado: props.enabled !== false,
          tipo_dato: tipoDato,
          puerto_entrada:
            puertoEntradaPort?.id ?? PUERTO_HOLD_ENTRADA_POR_DEFECTO,
          puerto_cch: puertoCchPort?.id ?? PUERTO_HOLD_CCH_POR_DEFECTO,
          puerto_lch: puertoLchPort?.id ?? PUERTO_HOLD_LCH_POR_DEFECTO,
          ...(valorInicial !== undefined ? { valor_inicial: valorInicial } : {}),
          ...(retardoElemento !== undefined
            ? { retardo_ms: retardoElemento }
            : {}),
        };
        elementosIr.push(holdIr);
        mapaElementosIr.set(elemento.id, holdIr);
        break;
      }

      case HilesElementType.PLACE: {
        const tokensBase =
          typeof props.tokens === 'number' && Number.isInteger(props.tokens)
            ? props.tokens
            : 0;
        const tokensExtra = tokensAdicionalesPorPlace.get(elemento.id) ?? 0;
        const tokensTotales = tokensBase + tokensExtra;
        const capacidadRaw = props.maxTokens;
        const capacidad =
          typeof capacidadRaw === 'number' && Number.isInteger(capacidadRaw)
            ? capacidadRaw
            : null;

        const placeIr: IrPlaceElementV2 = {
          id: elemento.id,
          tipo: 'place',
          nombre: elemento.name || elemento.id,
          tokens: tokensTotales,
          capacidad,
        };
        elementosIr.push(placeIr);
        mapaElementosIr.set(elemento.id, placeIr);
        break;
      }

      case HilesElementType.TRANSITION: {
        const puertoCondPort =
          entradasPort.find((p) => p.nature === 'control') ?? entradasPort[0];
        const puertoAccPort =
          salidasPort.find((p) => p.nature === 'control') ?? salidasPort[0];

        const transIr: IrTransitionElementV2 = {
          id: elemento.id,
          tipo: 'transition',
          nombre: elemento.name || elemento.id,
          habilitada: props.enabled !== false,
          puerto_condicion:
            puertoCondPort?.id ?? PUERTO_CONDICION_POR_DEFECTO,
          puerto_accion: puertoAccPort?.id ?? PUERTO_ACCION_POR_DEFECTO,
          ...(retardoElemento !== undefined
            ? { retardo_ms: retardoElemento }
            : {}),
        };
        elementosIr.push(transIr);
        mapaElementosIr.set(elemento.id, transIr);
        break;
      }

      default:
        errores.push({
          codigo: 'IR_TIPO_NO_SOPORTADO',
          severidad: 'error',
          mensaje: `El elemento '${elemento.name || elemento.id}' (${String(elemento.type)}) no está soportado en IR v2.`,
          elemento_id: elemento.id,
        });
    }
  }

  if (errores.length > 0) {
    return { ok: false, valido: false, modelo: null, errores, advertencias };
  }

  const conexionesIr: IrConexionV2[] = [];

  for (const conn of conexionesAplanadas) {
    const origenIr = mapaElementosIr.get(conn.source);
    const destinoIr = mapaElementosIr.get(conn.target);
    const origenDoc = mapaElementosOriginales.get(conn.source);
    const destinoDoc = mapaElementosOriginales.get(conn.target);

    if (!origenIr || !destinoIr || !origenDoc || !destinoDoc) {
      errores.push({
        codigo: 'IR_REFERENCIA_INVALIDA',
        severidad: 'error',
        mensaje: `La conexión '${conn.id}' referencia un elemento inexistente.`,
        conexion_id: conn.id,
      });
      continue;
    }

    const tipoHiles = conn.data?.hilesConnectionType;
    if (tipoHiles === HilesConnectionType.TOKEN_FLOW) {
      normalizacionesLegadas.add('token_flow_a_arco');
    }

    if (esArcoPetriConexion(conn, origenDoc.type, destinoDoc.type)) {
      const pesoRaw = conn.data?.weight;
      const peso =
        typeof pesoRaw === 'number' && Number.isInteger(pesoRaw) && pesoRaw >= 1
          ? pesoRaw
          : 1;
      conexionesIr.push({
        id: conn.id,
        tipo: 'arco',
        origen: origenIr.id,
        destino: destinoIr.id,
        peso,
      });
      continue;
    }

    if (origenIr.tipo === 'place' || destinoIr.tipo === 'place') {
      errores.push({
        codigo: 'IR_CONEXION_NO_SOPORTADA',
        severidad: 'error',
        mensaje: `La conexión '${conn.id}' conecta un Place mediante un canal de datos; use un arco Petri.`,
        conexion_id: conn.id,
      });
      continue;
    }

    let puertoOrigen = conn.sourceHandle ?? '';
    if (!puertoOrigen) {
      if (origenIr.tipo === 'service') puertoOrigen = origenIr.salidas[0] ?? '';
      else if (origenIr.tipo === 'functional_block')
        puertoOrigen = origenIr.salidas[0]?.puerto ?? '';
      else if (origenIr.tipo === 'sample')
        puertoOrigen = origenIr.puerto_salida;
      else if (origenIr.tipo === 'hold') puertoOrigen = origenIr.puerto_cch;
      else if (origenIr.tipo === 'transition')
        puertoOrigen = origenIr.puerto_accion ?? PUERTO_ACCION_POR_DEFECTO;
    }

    let puertoDestino = conn.targetHandle ?? '';
    if (destinoIr.tipo === 'transition') {
      const aceptados = [
        destinoIr.puerto_condicion,
        IR_PUERTO_CONDICION,
        PUERTO_CONDICION_POR_DEFECTO,
        'petri-in',
      ];
      if (!puertoDestino || aceptados.includes(puertoDestino)) {
        puertoDestino = destinoIr.puerto_condicion;
      }
    } else if (!puertoDestino) {
      if (destinoIr.tipo === 'service')
        puertoDestino = destinoIr.entradas[0] ?? '';
      else if (destinoIr.tipo === 'functional_block')
        puertoDestino = destinoIr.entradas[0]?.puerto ?? '';
      else if (destinoIr.tipo === 'sample')
        puertoDestino = destinoIr.puerto_dato;
      else if (destinoIr.tipo === 'hold')
        puertoDestino = destinoIr.puerto_entrada;
    }

    const retardoConexion = normalizarRetardoMs(conn.data?.delay);

    let tipoCanal: 'cch' | 'dch' | 'lch' = 'cch';
    if (
      (origenIr.tipo === 'transition' &&
        puertoOrigen === origenIr.puerto_accion) ||
      (origenIr.tipo === 'hold' && puertoOrigen === origenIr.puerto_lch) ||
      (destinoIr.tipo === 'sample' &&
        puertoDestino === destinoIr.puerto_control) ||
      (destinoIr.tipo === 'transition' &&
        (puertoDestino === destinoIr.puerto_condicion ||
          puertoDestino === IR_PUERTO_CONDICION)) ||
      tipoHiles === HilesConnectionType.PETRI
    ) {
      tipoCanal = 'lch';
    } else if (
      tipoHiles === HilesConnectionType.DISCRETE ||
      origenIr.tipo === 'sample' ||
      destinoIr.tipo === 'hold'
    ) {
      tipoCanal = 'dch';
    }

    if (tipoCanal === 'cch') {
      conexionesIr.push({
        id: conn.id,
        tipo: 'cch',
        origen: origenIr.id,
        puerto_origen: puertoOrigen,
        destino: destinoIr.id,
        puerto_destino: puertoDestino,
        ...(retardoConexion !== undefined
          ? { retardo_ms: retardoConexion }
          : {}),
      });
    } else if (tipoCanal === 'dch') {
      conexionesIr.push({
        id: conn.id,
        tipo: 'dch',
        origen: origenIr.id,
        puerto_origen: puertoOrigen,
        destino: destinoIr.id,
        puerto_destino: puertoDestino,
        capacidad_cola: IR_LIMITES_CANALES_V2.DEFAULT_DCH_QUEUE_CAPACITY,
        ...(retardoConexion !== undefined
          ? { retardo_ms: retardoConexion }
          : {}),
      });
    } else {
      conexionesIr.push({
        id: conn.id,
        tipo: 'lch',
        origen: origenIr.id,
        puerto_origen: puertoOrigen,
        destino: destinoIr.id,
        puerto_destino: puertoDestino,
        ...(retardoConexion !== undefined
          ? { retardo_ms: retardoConexion }
          : {}),
      });
    }
  }

  if (errores.length > 0) {
    return { ok: false, valido: false, modelo: null, errores, advertencias };
  }

  const nombreModelo =
    opciones.nombre?.trim() || infoDoc.nombreDoc?.trim() || 'Modelo HiLeS';
  const modeloId =
    opciones.modeloId?.trim() || normalizarIdentificador(nombreModelo);

  const candidatoIr: IrModeloV2 = {
    ir_version: IR_VERSION_V2,
    modelo_id: modeloId,
    version: opciones.version ?? 1,
    nombre: nombreModelo,
    ...(opciones.descripcion !== undefined
      ? { descripcion: opciones.descripcion }
      : {}),
    metadata: {
      documento_schema_version: infoDoc.schemaVersion,
      compilado_en: opciones.compiladoEn ?? new Date().toISOString(),
      bloque_raiz_id: infoDoc.rootBlockId,
      ...(structuralBlocksAplanados.length > 0
        ? { structural_blocks_aplanados: structuralBlocksAplanados }
        : {}),
      ...(normalizacionesLegadas.size > 0
        ? { normalizaciones_legadas: [...normalizacionesLegadas] }
        : {}),
    },
    entradas_externas: entradasExternas,
    elementos: elementosIr,
    conexiones: conexionesIr,
  };

  return validarModeloIrV2(candidatoIr, {
    permitirVacio: opciones.permitirVacio ?? true,
  });
}

export const compilarDocumentoAIrV2 = compilarModeloEditorAIrV2;

/**
 * Extrae la instantánea `elementos` en el formato oficial de `simulacion/estado`
 * para IR v2 a partir de un `MotorSimulacion` y el modelo `IrModeloV2`.
 */
export function extraerElementosEstadoIrV2(
  ir: IrModeloV2,
  motor: MotorSimulacion,
): Record<string, IrEstadoElementoV2> {
  const estadosMotor = motor.obtenerEstadoIrV2();
  const resultado: Record<string, IrEstadoElementoV2> = {};

  for (const el of ir.elementos) {
    const est = estadosMotor[el.id];
    switch (el.tipo) {
      case 'service':
        resultado[el.id] =
          est?.valor !== undefined
            ? {
                valor: est.valor,
                ...(est.timer_pendiente ? { timer_pendiente: true } : {}),
              }
            : {};
        break;
      case 'functional_block':
        resultado[el.id] = {
          ...(est?.salida !== undefined ? { salida: est.salida } : {}),
          ...(est?.salidas && Object.keys(est.salidas).length > 1
            ? { salidas: est.salidas }
            : {}),
          ...(est?.cola_dch !== undefined && est.cola_dch > 0
            ? { cola_dch: est.cola_dch }
            : {}),
          ...(est?.cola_desbordada ? { cola_desbordada: true } : {}),
          ...(est?.timer_pendiente ? { timer_pendiente: true } : {}),
          ...(est?.error ? { error: est.error } : {}),
        };
        break;
      case 'sample':
        resultado[el.id] = {
          ...(est?.salida !== undefined ? { salida: est.salida } : {}),
          ...(est?.cola_dch !== undefined && est.cola_dch > 0
            ? { cola_dch: est.cola_dch }
            : {}),
          ...(est?.cola_desbordada ? { cola_desbordada: true } : {}),
          ...(est?.timer_pendiente ? { timer_pendiente: true } : {}),
        };
        break;
      case 'hold':
        resultado[el.id] = {
          ...(est?.valor_retenido !== undefined
            ? { valor_retenido: est.valor_retenido }
            : {}),
          ...(est?.salida !== undefined ? { salida: est.salida } : {}),
          ...(est?.evento_pendiente !== undefined
            ? { evento_pendiente: est.evento_pendiente }
            : {}),
          ...(est?.cola_dch !== undefined && est.cola_dch > 0
            ? { cola_dch: est.cola_dch }
            : {}),
          ...(est?.cola_desbordada ? { cola_desbordada: true } : {}),
          ...(est?.timer_pendiente ? { timer_pendiente: true } : {}),
        };
        break;
      case 'place':
        resultado[el.id] = {
          tokens: est?.tokens ?? el.tokens,
        };
        break;
      case 'transition':
        resultado[el.id] = {
          habilitada: Boolean(est?.habilitada),
          disparada: Boolean(est?.disparada),
          ...(est?.timer_pendiente ? { timer_pendiente: true } : {}),
        };
        break;
    }
  }

  return resultado;
}

export type { Edge, Node, HilesEdgeData, HilesNodeData };
