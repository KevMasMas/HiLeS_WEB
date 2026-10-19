import { esProjectIdValido, normalizarProjectId } from './projectUrl';

export const PREFIJO_PROYECTOS_V2_POR_DEFECTO = 'hiles/v2/proyectos';

export type SufijoTopicoProyectoV2 =
  | 'edicion/estado'
  | 'edicion/operacion'
  | 'edicion/presencia'
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
  edicionEstado: string;
  edicionOperacion: string;
  edicionPresencia: string;
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
  'edicion/estado': { qos: 1, retain: true },
  'edicion/operacion': { qos: 1, retain: false },
  'edicion/presencia': { qos: 0, retain: false },
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
 * Construye todos los tópicos dinámicos del protocolo por proyecto v2 (`hiles/v2/proyectos/<project_id>/...`).
 */
export function construirTopicosProyectoV2(
  projectIdRaw: string,
  prefijo: string = PREFIJO_PROYECTOS_V2_POR_DEFECTO,
): TopicosProyectoV2 {
  const projectId = normalizarProjectId(projectIdRaw);
  const prefijoLimpio = normalizarPrefijoProyectos(prefijo);
  const base = `${prefijoLimpio}/${projectId}`;

  return {
    projectId,
    base,
    edicionEstado: `${base}/edicion/estado`,
    edicionOperacion: `${base}/edicion/operacion`,
    edicionPresencia: `${base}/edicion/presencia`,
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
  const sufijo = resto.slice(idxBarra + 1);

  if (!esProjectIdValido(projectId) || !SUFIJOS_VALIDOS.has(sufijo)) {
    return null;
  }

  return {
    projectId,
    sufijo: sufijo as SufijoTopicoProyectoV2,
    topicoCompleto: topic,
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
