import type {
  EjecutorDisponibleV3,
  ErrorDistribucionV3,
  FragmentoDespliegueV3,
  ManifiestoDespliegueV3,
  MensajeCanalDistribuidoV3,
} from '../ir/tiposIrDistribuida';

export interface MensajeEstadoEjecutorV3 extends EjecutorDisponibleV3 {
  protocol_version: 3;
  project_id: string;
  last_seen_ms: number;
  active_deployment_id?: string;
  active_epoch?: number;
}

export type ResultadoValidacionEstadoEjecutor =
  | { ok: true; mensaje: MensajeEstadoEjecutorV3 }
  | { ok: false; motivo: string };

const ESTADOS_EJECUTOR = new Set(['online', 'deploying', 'ready', 'running', 'degraded', 'offline']);
const TIPOS_EJECUTOR = new Set(['pico', 'browser']);
const LENGUAJES_EJECUTOR = new Set(['python', 'expresion']);

/**
 * Valida el mensaje MQTT antes de incorporarlo al estado de la interfaz.
 * También cruza el payload con el proyecto activo y con el executorId del
 * tópico para impedir que un retenido mal formado habilite un destino ajeno.
 */
export function validarMensajeEstadoEjecutorV3(
  valor: unknown,
  esperado: { projectId: string; executorId: string },
): ResultadoValidacionEstadoEjecutor {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, motivo: 'El estado del ejecutor no es un objeto JSON.' };
  }
  const mensaje = valor as Record<string, unknown>;
  if (mensaje.protocol_version !== 3) return { ok: false, motivo: 'El ejecutor no usa el protocolo distribuido v3.' };
  if (mensaje.project_id !== esperado.projectId) return { ok: false, motivo: `El ejecutor pertenece al proyecto ${String(mensaje.project_id ?? 'desconocido')}.` };
  if (mensaje.executor_id !== esperado.executorId) return { ok: false, motivo: 'El executorId del payload no coincide con el tópico MQTT.' };
  if (typeof mensaje.tipo !== 'string' || !TIPOS_EJECUTOR.has(mensaje.tipo)) return { ok: false, motivo: 'El tipo de ejecutor no es válido.' };
  if (typeof mensaje.estado !== 'string' || !ESTADOS_EJECUTOR.has(mensaje.estado)) return { ok: false, motivo: 'El estado publicado no es válido.' };
  for (const campo of ['version', 'firmware_version', 'board_model']) {
    const valorCampo = mensaje[campo];
    if (valorCampo !== undefined && (typeof valorCampo !== 'string' || valorCampo.trim() === '')) {
      return { ok: false, motivo: `El campo ${campo} del ejecutor no es válido.` };
    }
  }
  if (typeof mensaje.last_seen_ms !== 'number' || !Number.isFinite(mensaje.last_seen_ms) || mensaje.last_seen_ms < 0) {
    return { ok: false, motivo: 'El ejecutor no publicó una marca de actividad válida.' };
  }
  const capacidades = mensaje.capacidades;
  if (!capacidades || typeof capacidades !== 'object' || Array.isArray(capacidades)) {
    return { ok: false, motivo: 'El ejecutor no publicó sus capacidades.' };
  }
  const caps = capacidades as Record<string, unknown>;
  if (!Array.isArray(caps.ir_versions) || !caps.ir_versions.every((item) => typeof item === 'number')) {
    return { ok: false, motivo: 'Las versiones IR publicadas no son válidas.' };
  }
  if (!Array.isArray(caps.lenguajes) || !caps.lenguajes.every((item) => typeof item === 'string' && LENGUAJES_EJECUTOR.has(item))) {
    return { ok: false, motivo: 'Los lenguajes publicados no son válidos.' };
  }
  if (typeof caps.max_fragment_bytes !== 'number' || caps.max_fragment_bytes <= 0
    || typeof caps.max_elementos !== 'number' || caps.max_elementos <= 0) {
    return { ok: false, motivo: 'Los límites de capacidad del ejecutor no son válidos.' };
  }
  return { ok: true, mensaje: valor as MensajeEstadoEjecutorV3 };
}

export interface MensajeAckFragmentoV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  executor_id: string;
  fragment_id: string;
  accepted: boolean;
  fragment_hash: string;
  error?: ErrorDistribucionV3;
}

export interface MensajeSnapshotParcialV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  executor_id: string;
  sequence: number;
  elements: Record<string, unknown>;
}

export type ComandoDespliegueV3 = 'start' | 'stop' | 'reset' | 'step';

export interface MensajeComandoDespliegueV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  command: ComandoDespliegueV3;
  id_mensaje?: string;
}

export interface MensajeEntradaDistribuidaV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  servicio_id: string;
  valor: MensajeCanalDistribuidoV3['value'];
  id_mensaje?: string;
}

export interface MensajeErrorDistribuidoV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  executor_id: string;
  codigo: string;
  mensaje: string;
  fragment_id?: string;
  connection_id?: string;
  element_id?: string;
  stage?: 'manifest' | 'fragment' | 'channel' | 'command' | 'input' | 'runtime' | 'transport';
  id_mensaje?: string;
}

export type MensajeEjecucionDistribuidaV3 =
  | ManifiestoDespliegueV3
  | FragmentoDespliegueV3
  | MensajeCanalDistribuidoV3
  | MensajeEstadoEjecutorV3
  | MensajeAckFragmentoV3
  | MensajeSnapshotParcialV3
  | MensajeComandoDespliegueV3
  | MensajeEntradaDistribuidaV3
  | MensajeErrorDistribuidoV3;
