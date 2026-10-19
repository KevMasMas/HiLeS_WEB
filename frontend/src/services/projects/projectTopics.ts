import { esProjectIdValido, normalizarProjectId } from './projectUrl';

export const PREFIJO_PROYECTOS_V2_POR_DEFECTO = 'udfjc/hiles/v2/projects';

export type SufijoTopicoProyectoV2 =
  | 'document/snapshot'
  | 'document/ops'
  | 'presence'
  | 'cursor'
  | 'simulacion/modelo/cargar'
  | 'simulacion/modelo/confirmacion'
  | 'simulacion/comando'
  | 'simulacion/entrada/establecer'
  | 'simulacion/estado'
  | 'simulacion/salida'
  | 'error';

export type CanalTopicoProyectoV2 = SufijoTopicoProyectoV2;

export interface TopicosProyectoV2 {
  projectId: string;
  base: string;
  documentSnapshot: string;
  documentOps: string;
  presence: string;
  presenceWildcard: string;
  cursor: string;
  /** Alias hacia `documentSnapshot` (`udfjc/hiles/v2/projects/<projectId>/document/snapshot`). */
  edicionEstado: string;
  /** Alias hacia `documentOps` (`udfjc/hiles/v2/projects/<projectId>/document/ops`). */
  edicionOperacion: string;
  /** Alias hacia la raíz de `presence` (`udfjc/hiles/v2/projects/<projectId>/presence`). */
  edicionPresencia: string;
  /** Alias hacia `cursor` (`udfjc/hiles/v2/projects/<projectId>/cursor`). */
  edicionCursor: string;
  simulacionModeloCargar: string;
  simulacionModeloConfirmacion: string;
  simulacionComando: string;
  simulacionEntradaEstablecer: string;
  simulacionEstado: string;
  simulacionSalida: string;
  error: string;
}

export interface PoliticaPublicacionProyectoV2 {
  qos: 0 | 1;
  retain: boolean;
}

export const POLITICAS_PUBLICACION_PROYECTO_V2: Record<
  SufijoTopicoProyectoV2,
  PoliticaPublicacionProyectoV2
> = {
  'document/snapshot': { qos: 1, retain: true },
  'document/ops': { qos: 1, retain: false },
  presence: { qos: 1, retain: true },
  cursor: { qos: 0, retain: false },
  'simulacion/modelo/cargar': { qos: 1, retain: true },
  'simulacion/modelo/confirmacion': { qos: 1, retain: false },
  'simulacion/comando': { qos: 1, retain: false },
  'simulacion/entrada/establecer': { qos: 1, retain: false },
  'simulacion/estado': { qos: 0, retain: true },
  'simulacion/salida': { qos: 0, retain: false },
  error: { qos: 1, retain: false },
};

const SUFIJOS_VALIDOS = new Set<string>(
  Object.keys(POLITICAS_PUBLICACION_PROYECTO_V2),
);

function normalizarPrefijoProyectos(
  prefijo: string = PREFIJO_PROYECTOS_V2_POR_DEFECTO,
): string {
  const limpio = prefijo.trim().replace(/^\/+|\/+$/g, '');
  return limpio || PREFIJO_PROYECTOS_V2_POR_DEFECTO;
}

/**
 * Construye todos los tópicos dinámicos del protocolo por proyecto v2 (`udfjc/hiles/v2/projects/<projectId>/...`).
 */
export function construirTopicosProyectoV2(
  projectIdRaw: string,
  prefijo: string = PREFIJO_PROYECTOS_V2_POR_DEFECTO,
): TopicosProyectoV2 {
  const projectId = normalizarProjectId(projectIdRaw);
  const prefijoLimpio = normalizarPrefijoProyectos(prefijo);
  const base = `${prefijoLimpio}/${projectId}`;
  const documentSnapshot = `${base}/document/snapshot`;
  const documentOps = `${base}/document/ops`;
  const presence = `${base}/presence`;
  const presenceWildcard = `${presence}/+`;
  const cursor = `${base}/cursor`;

  return {
    projectId,
    base,
    documentSnapshot,
    documentOps,
    presence,
    presenceWildcard,
    cursor,
    edicionEstado: documentSnapshot,
    edicionOperacion: documentOps,
    edicionPresencia: presence,
    edicionCursor: cursor,
    simulacionModeloCargar: `${base}/simulacion/modelo/cargar`,
    simulacionModeloConfirmacion: `${base}/simulacion/modelo/confirmacion`,
    simulacionComando: `${base}/simulacion/comando`,
    simulacionEntradaEstablecer: `${base}/simulacion/entrada/establecer`,
    simulacionEstado: `${base}/simulacion/estado`,
    simulacionSalida: `${base}/simulacion/salida`,
    error: `${base}/error`,
  };
}

export interface TopicoProyectoParseadoV2 {
  projectId: string;
  sufijo: SufijoTopicoProyectoV2;
  topicoCompleto: string;
  clientIdPresencia?: string;
}

const esSegmentoMqttValido = (valor: string): boolean =>
  valor.length > 0 && !/[+#/]/.test(valor);

/** Construye el topic retenido exclusivo de un colaborador. */
export function construirTopicoPresenciaProyectoV2(
  topicos: Pick<TopicosProyectoV2, 'presence'>,
  clientId: string,
): string {
  const limpio = clientId.trim();
  if (!esSegmentoMqttValido(limpio)) {
    throw new Error('clientId de presencia no puede estar vacío ni contener /, + o #.');
  }
  return `${topicos.presence}/${limpio}`;
}

/**
 * Analiza un topic MQTT entrante y extrae `{ projectId, sufijo, topicoCompleto }`
 * si pertenece al espacio de proyectos v2.
 */
export function parsearTopicoProyectoV2(
  topic: string,
  prefijo: string = PREFIJO_PROYECTOS_V2_POR_DEFECTO,
): TopicoProyectoParseadoV2 | null {
  if (typeof topic !== 'string') return null;
  const prefijoLimpio = normalizarPrefijoProyectos(prefijo);
  const prefijoConBarra = `${prefijoLimpio}/`;
  if (!topic.startsWith(prefijoConBarra)) {
    return null;
  }

  const resto = topic.slice(prefijoConBarra.length);
  const idxBarra = resto.indexOf('/');
  if (idxBarra <= 0) {
    return null;
  }

  const projectId = resto.slice(0, idxBarra);
  const sufijoCrudo = resto.slice(idxBarra + 1);
  let sufijo = sufijoCrudo;
  let clientIdPresencia: string | undefined;

  if (sufijoCrudo.startsWith('presence/')) {
    clientIdPresencia = sufijoCrudo.slice('presence/'.length);
    if (!esSegmentoMqttValido(clientIdPresencia)) {
      return null;
    }
    sufijo = 'presence';
  }

  if (!esProjectIdValido(projectId) || !SUFIJOS_VALIDOS.has(sufijo)) {
    return null;
  }

  return {
    projectId,
    sufijo: sufijo as SufijoTopicoProyectoV2,
    topicoCompleto: topic,
    ...(clientIdPresencia ? { clientIdPresencia } : {}),
  };
}

/**
 * Obtiene la política QoS y retain correspondiente a un sufijo de tópico de proyecto v2.
 */
export function obtenerPoliticaTopicoProyectoV2(
  sufijo: SufijoTopicoProyectoV2 | string,
): PoliticaPublicacionProyectoV2 {
  return (
    POLITICAS_PUBLICACION_PROYECTO_V2[sufijo as SufijoTopicoProyectoV2] ?? {
      qos: 0,
      retain: false,
    }
  );
}

/**
 * Resuelve la política QoS/retain tanto a partir de un topic completo de proyecto v2
 * como de un sufijo directo (`document/snapshot`, `document/ops`, `presence`, `cursor`).
 */
export function resolverPoliticaTopicoProyectoV2(
  topicOSufijo: string,
  prefijo: string = PREFIJO_PROYECTOS_V2_POR_DEFECTO,
): PoliticaPublicacionProyectoV2 | null {
  if (SUFIJOS_VALIDOS.has(topicOSufijo)) {
    return POLITICAS_PUBLICACION_PROYECTO_V2[topicOSufijo as SufijoTopicoProyectoV2];
  }
  const parseado = parsearTopicoProyectoV2(topicOSufijo, prefijo);
  if (!parseado) return null;
  return POLITICAS_PUBLICACION_PROYECTO_V2[parseado.sufijo];
}

export function normalizarIdProyectoV2(
  entrada: string,
): { ok: true; projectId: string } | { ok: false; error: string } {
  if (typeof entrada !== 'string' || !entrada.trim()) {
    return { ok: false, error: 'El identificador de proyecto no puede estar vacío.' };
  }
  const limpio = entrada.trim();
  if (esProjectIdValido(limpio)) {
    return { ok: true, projectId: limpio };
  }
  const normalizado = normalizarProjectId(limpio, '');
  if (esProjectIdValido(normalizado)) {
    return { ok: true, projectId: normalizado };
  }
  return {
    ok: false,
    error: 'El identificador de proyecto debe tener entre 3 y 64 caracteres [a-z0-9_-].',
  };
}

