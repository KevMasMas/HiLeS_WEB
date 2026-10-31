import type { Node } from '@xyflow/react';
import {
  HilesElementType,
  type HilesNodeData,
  type HilesNodeProperties,
} from '../../types/hiles';
import type {
  EjecutorDisponibleV3,
  EstadoEjecutorV3,
  ManifiestoDespliegueV3,
  PlanAsignacionDespliegueV3,
} from '../../services/ir/tiposIrDistribuida';
import type {
  MensajeAckFragmentoV3,
  MensajeEstadoEjecutorV3,
  MensajeSnapshotParcialV3,
} from '../../services/distributed/messages';

/**
 * Propiedad del documento compartido que guarda el ejecutor elegido.
 *
 * Vive en `properties` del nodo, así que viaja por la sincronización
 * colaborativa v2 como cualquier otra edición: un cambio produce una sola
 * operación `node.update` deduplicada por `operationId`.
 */
export const CLAVE_DESTINO = 'deploymentTarget' as const;

export type NodoHiles = Node<HilesNodeData>;

const EJECUTABLES = new Set<HilesElementType>([
  HilesElementType.SERVICE,
  HilesElementType.FUNCTIONAL_BLOCK,
  HilesElementType.SAMPLE,
  HilesElementType.HOLD,
  HilesElementType.PLACE,
  HilesElementType.TRANSITION,
]);

export const obtenerDestino = (nodo: NodoHiles): string | null => {
  const valor = nodo.data.properties.deploymentTarget;
  return typeof valor === 'string' && valor.trim() ? valor : null;
};

/** Cambios de propiedades para asignar o quitar un ejecutor. */
export const cambioDestino = (
  executorId: string | null,
): Pick<HilesNodeProperties, 'deploymentTarget'> => ({
  [CLAVE_DESTINO]: executorId ?? undefined,
});

export const esAsignable = (nodo: NodoHiles): boolean =>
  nodo.data.hilesType === HilesElementType.STRUCTURAL_BLOCK
  || nodo.data.hilesType === HilesElementType.FUNCTIONAL_BLOCK
  || (EJECUTABLES.has(nodo.data.hilesType) && !nodo.parentId);

/**
 * Plan de asignación a partir del documento: Structural Blocks heredan,
 * Functional Blocks pueden sobreescribir y los ejecutables de nivel raíz se
 * asignan directamente (contrato v3 §1).
 */
export const construirPlanDesdeNodos = (nodos: readonly NodoHiles[]): PlanAsignacionDespliegueV3 => {
  const plan: PlanAsignacionDespliegueV3 = { structural_blocks: {}, functional_blocks: {}, elementos: {} };
  for (const nodo of nodos) {
    const destino = obtenerDestino(nodo);
    if (!destino) continue;
    if (nodo.data.hilesType === HilesElementType.STRUCTURAL_BLOCK) plan.structural_blocks[nodo.id] = destino;
    else if (nodo.data.hilesType === HilesElementType.FUNCTIONAL_BLOCK && nodo.parentId) plan.functional_blocks![nodo.id] = destino;
    else if (EJECUTABLES.has(nodo.data.hilesType) && !nodo.parentId) plan.elementos![nodo.id] = destino;
  }
  return plan;
};

export interface AsignacionEfectiva {
  executorId: string | null;
  origen: 'propio' | 'heredado' | 'ninguno';
  heredadoDe?: string;
}

/** Destino efectivo de un nodo ejecutable siguiendo la herencia del contrato. */
export const destinoEfectivo = (nodo: NodoHiles, porId: ReadonlyMap<string, NodoHiles>): AsignacionEfectiva => {
  const propio = obtenerDestino(nodo);
  if (propio && (nodo.data.hilesType === HilesElementType.FUNCTIONAL_BLOCK || !nodo.parentId)) {
    return { executorId: propio, origen: 'propio' };
  }
  const visitados = new Set<string>();
  let padreId = nodo.parentId;
  while (padreId && !visitados.has(padreId)) {
    visitados.add(padreId);
    const padre = porId.get(padreId);
    if (!padre) break;
    const destino = padre.data.hilesType === HilesElementType.STRUCTURAL_BLOCK ? obtenerDestino(padre) : null;
    if (destino) return { executorId: destino, origen: 'heredado', heredadoDe: padre.id };
    padreId = padre.parentId;
  }
  return { executorId: null, origen: 'ninguno' };
};

export interface FilaMapaAsignacion {
  nodoId: string;
  nombre: string;
  tipo: HilesElementType;
  nivel: number;
  asignable: boolean;
  destinoPropio: string | null;
  efectivo: AsignacionEfectiva;
  ejecutablesInternos: number;
  sinAsignarInternos: number;
}

/** Filas del mapa de asignaciones en orden jerárquico estable. */
export const construirMapaAsignaciones = (nodos: readonly NodoHiles[]): FilaMapaAsignacion[] => {
  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]));
  const hijos = new Map<string | undefined, NodoHiles[]>();
  for (const nodo of nodos) {
    const clave = nodo.parentId && porId.has(nodo.parentId) ? nodo.parentId : undefined;
    hijos.set(clave, [...(hijos.get(clave) ?? []), nodo]);
  }
  hijos.forEach((lista) => lista.sort((a, b) => a.data.name.localeCompare(b.data.name) || a.id.localeCompare(b.id)));

  const ejecutablesBajo = (id: string): NodoHiles[] => {
    const resultado: NodoHiles[] = [];
    const pendiente = [...(hijos.get(id) ?? [])];
    while (pendiente.length) {
      const actual = pendiente.shift()!;
      if (EJECUTABLES.has(actual.data.hilesType)) resultado.push(actual);
      pendiente.push(...(hijos.get(actual.id) ?? []));
    }
    return resultado;
  };

  const filas: FilaMapaAsignacion[] = [];
  const recorrer = (padre: string | undefined, nivel: number) => {
    for (const nodo of hijos.get(padre) ?? []) {
      const esBloque = nodo.data.hilesType === HilesElementType.STRUCTURAL_BLOCK;
      if (esBloque || esAsignable(nodo)) {
        const internos = esBloque ? ejecutablesBajo(nodo.id) : [];
        filas.push({
          nodoId: nodo.id,
          nombre: nodo.data.name,
          tipo: nodo.data.hilesType,
          nivel,
          asignable: esAsignable(nodo),
          destinoPropio: obtenerDestino(nodo),
          efectivo: destinoEfectivo(nodo, porId),
          ejecutablesInternos: internos.length,
          sinAsignarInternos: internos.filter((item) => !destinoEfectivo(item, porId).executorId).length,
        });
      }
      if (esBloque) recorrer(nodo.id, nivel + 1);
    }
  };
  recorrer(undefined, 0);
  return filas;
};

/** Nodos ejecutables que quedarían sin destino al desplegar. */
export const ejecutablesSinDestino = (nodos: readonly NodoHiles[]): NodoHiles[] => {
  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]));
  return nodos.filter((nodo) => EJECUTABLES.has(nodo.data.hilesType) && !destinoEfectivo(nodo, porId).executorId);
};

// ---------------------------------------------------------------------------
// Etiquetas y estados visibles.
// ---------------------------------------------------------------------------

export const etiquetaEjecutor = (executorId: string | null, executorLocal: string | null): string => {
  if (!executorId) return 'Sin asignar';
  if (executorId === executorLocal) return 'Este navegador';
  if (executorId.startsWith('pico:')) return `Pico ${executorId.slice(5)}`;
  if (executorId.startsWith('browser:')) return `Navegador ${executorId.slice(8, 14)}`;
  return executorId;
};

export const ETIQUETA_ESTADO_EJECUTOR: Record<EstadoEjecutorV3, string> = {
  online: 'Disponible',
  deploying: 'Desplegando',
  ready: 'Listo',
  running: 'Ejecutando',
  degraded: 'Degradado',
  offline: 'Desconectado',
};

export type FaseDistribuida = 'desconectado' | 'sin_despliegue' | 'desplegando' | 'listo' | 'ejecutando' | 'error';

export interface DescripcionFase {
  fase: FaseDistribuida;
  etiqueta: string;
  detalle: string;
}

export interface EntradaFase {
  conectado: boolean;
  manifest: ManifiestoDespliegueV3 | null;
  acks: Record<string, MensajeAckFragmentoV3>;
  ejecutores: Record<string, MensajeEstadoEjecutorV3>;
  ejecutando: boolean;
  errorLocal: string | null;
}

/** Estado agregado que la interfaz muestra sin abrir la consola. */
export const describirFase = (entrada: EntradaFase): DescripcionFase => {
  if (!entrada.conectado) {
    return { fase: 'desconectado', etiqueta: 'Desconectado', detalle: 'Sin conexión con el broker MQTT de ejecución distribuida.' };
  }
  if (entrada.errorLocal) {
    return { fase: 'error', etiqueta: 'Error', detalle: entrada.errorLocal };
  }
  const manifest = entrada.manifest;
  if (!manifest) {
    return { fase: 'sin_despliegue', etiqueta: 'Sin despliegue', detalle: 'Asigna los bloques y pulsa Desplegar.' };
  }
  const destinos = manifest.fragments.map((fragmento) => fragmento.executor_id);
  const rechazados = destinos.filter((id) => entrada.acks[id]?.epoch === manifest.epoch && entrada.acks[id]?.accepted === false);
  if (rechazados.length) {
    return { fase: 'error', etiqueta: 'Error', detalle: `${rechazados.join(', ')} rechazó su fragmento.` };
  }
  const caidos = destinos.filter((id) => entrada.ejecutores[id]?.estado === 'offline');
  if (caidos.length) {
    return { fase: 'error', etiqueta: 'Error', detalle: `${caidos.join(', ')} está desconectado; sus elementos quedan obsoletos.` };
  }
  const pendientes = destinos.filter((id) => !(entrada.acks[id]?.epoch === manifest.epoch && entrada.acks[id]?.accepted));
  if (pendientes.length) {
    return { fase: 'desplegando', etiqueta: 'Desplegando', detalle: `Esperando confirmación de ${pendientes.join(', ')}.` };
  }
  if (entrada.ejecutando) {
    return { fase: 'ejecutando', etiqueta: 'Ejecutando', detalle: `Época ${manifest.epoch} en ${destinos.length} ejecutor(es).` };
  }
  return { fase: 'listo', etiqueta: 'Listo', detalle: `Todos los fragmentos de la época ${manifest.epoch} fueron aceptados.` };
};

export interface ElementoAgregado {
  elementId: string;
  executorId: string;
  estado: Record<string, unknown> | null;
  obsoleto: boolean;
}

/**
 * Compone la vista del modelo a partir de snapshots parciales. Solo acepta el
 * propietario declarado en el manifiesto y la época activa (contrato v3 §7).
 */
export const agregarSnapshots = (
  manifest: ManifiestoDespliegueV3 | null,
  snapshots: Record<string, MensajeSnapshotParcialV3>,
  ejecutores: Record<string, MensajeEstadoEjecutorV3>,
): ElementoAgregado[] => {
  if (!manifest) return [];
  return Object.entries(manifest.owners)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([elementId, executorId]) => {
      const snapshot = snapshots[executorId];
      const vigente = snapshot
        && snapshot.deployment_id === manifest.deployment_id
        && snapshot.epoch === manifest.epoch
        && snapshot.executor_id === executorId;
      const estado = vigente ? (snapshot.elements[elementId] as Record<string, unknown> | undefined) ?? null : null;
      return {
        elementId,
        executorId,
        estado,
        obsoleto: !vigente || ejecutores[executorId]?.estado === 'offline',
      };
    });
};

/** Acepta un snapshot solo si es del despliegue activo y más nuevo que el anterior. */
export const aceptarSnapshot = (
  manifest: ManifiestoDespliegueV3 | null,
  anterior: MensajeSnapshotParcialV3 | undefined,
  nuevo: MensajeSnapshotParcialV3,
): boolean => {
  if (!manifest || nuevo.deployment_id !== manifest.deployment_id || nuevo.epoch !== manifest.epoch) return false;
  if (!manifest.fragments.some((fragmento) => fragmento.executor_id === nuevo.executor_id)) return false;
  return !anterior || anterior.epoch !== nuevo.epoch || nuevo.sequence > anterior.sequence;
};

export const ejecutoresDisponibles = (ejecutores: Record<string, MensajeEstadoEjecutorV3>): EjecutorDisponibleV3[] =>
  Object.values(ejecutores)
    .filter((ejecutor) => ejecutor.estado !== 'offline')
    .map((ejecutor) => ({
      executor_id: ejecutor.executor_id,
      tipo: ejecutor.tipo,
      estado: ejecutor.estado,
      capacidades: ejecutor.capacidades,
    }));

const RECOMENDACIONES: Record<string, string> = {
  DISTRIBUCION_DESTINO_FALTANTE: 'Asigna un ejecutor al bloque que lo contiene o al propio elemento en el mapa de asignaciones.',
  DISTRIBUCION_DESTINO_INEXISTENTE: 'El ejecutor elegido no está disponible: conéctalo o elige otro destino.',
  DISTRIBUCION_ARCO_REMOTO: 'Places y Transitions conectados deben quedar en el mismo ejecutor: asígnalos al mismo bloque.',
  DISTRIBUCION_TIPO_NO_RESUELTO: 'Revisa que los dos puertos de la conexión tengan el mismo tipo de dato.',
  DISTRIBUCION_CAPACIDAD_EXCEDIDA: 'El fragmento es demasiado grande o usa un lenguaje no soportado: divide el bloque o usa otro ejecutor.',
  DISTRIBUCION_MODELO_INVALIDO: 'Corrige el error del modelo indicado antes de volver a desplegar.',
  DISTRIBUCION_ASIGNACION_INVALIDA: 'Vuelve a elegir el destino del bloque; la asignación no corresponde al documento.',
  DISTRIBUCION_IDENTIFICADOR_INVALIDO: 'Usa un identificador de proyecto sin /, + ni #.',
  CANAL_PROPIETARIO_INVALIDO: 'Otro ejecutor publica en una conexión que no le pertenece: vuelve a desplegar.',
  CANAL_CONEXION_NO_DECLARADA: 'Un ejecutor usa un despliegue anterior: vuelve a desplegar para sincronizar la época.',
  VALOR_TIPO_INVALIDO: 'El valor no coincide con el tipo del puerto: revisa el tipo de dato de la conexión.',
  ENTRADA_HILES_RECHAZADA: 'La entrada no corresponde al tipo del Service o el Service no existe en ese ejecutor.',
  COMANDO_RECHAZADO: 'El ejecutor no reconoce el comando: verifica que use el mismo protocolo v3.',
};

export const recomendacionError = (codigo: string): string =>
  RECOMENDACIONES[codigo] ?? 'Revisa el detalle, corrige el modelo o la asignación y vuelve a desplegar.';
