import type { MensajeEstadoEjecutorV3 } from '../../services/distributed/messages';

export const UMBRAL_EJECUTOR_OBSOLETO_MS = 15_000;

export type MotivoNoDisponible =
  | 'proyecto_distinto'
  | 'protocolo_incompatible'
  | 'sin_actividad'
  | 'obsoleto'
  | 'offline'
  | 'degraded'
  | 'deploying'
  | 'ir_incompatible'
  | 'lenguaje_incompatible'
  | 'capacidad_invalida';

export interface DisponibilidadEjecutor {
  visible: boolean;
  seleccionable: boolean;
  desplegable: boolean;
  motivo: MotivoNoDisponible | null;
  detalle: string | null;
}

const noDisponible = (motivo: MotivoNoDisponible, detalle: string, seleccionable = false): DisponibilidadEjecutor => ({
  visible: true,
  seleccionable,
  desplegable: false,
  motivo,
  detalle,
});

/** Decisión única utilizada por selector, botón Desplegar y store. */
export function evaluarDisponibilidadEjecutor(
  ejecutor: MensajeEstadoEjecutorV3,
  opciones: { projectId: string; recibidoEn?: number; ahora?: number },
): DisponibilidadEjecutor {
  if (ejecutor.project_id !== opciones.projectId) return noDisponible('proyecto_distinto', `Pertenece al proyecto ${ejecutor.project_id}.`);
  if (ejecutor.protocol_version !== 3) return noDisponible('protocolo_incompatible', 'No usa el protocolo distribuido v3.');
  if (!opciones.recibidoEn) return noDisponible('sin_actividad', 'No se ha recibido actividad de este ejecutor.');
  if (ejecutor.estado === 'offline') return noDisponible('offline', 'Está desconectado.');
  if (ejecutor.estado === 'degraded') return noDisponible('degraded', 'Está degradado y requiere revisión.');
  const ahora = opciones.ahora ?? Date.now();
  if (ahora - opciones.recibidoEn > UMBRAL_EJECUTOR_OBSOLETO_MS) {
    return noDisponible('obsoleto', 'No ha actualizado su estado durante más de 15 segundos.');
  }
  if (!ejecutor.capacidades.ir_versions.includes(2)) return noDisponible('ir_incompatible', 'No declara soporte para IR v2.');
  if (!ejecutor.capacidades.lenguajes.some((lenguaje) => lenguaje === 'python' || lenguaje === 'expresion')) {
    return noDisponible('lenguaje_incompatible', 'No soporta Python ni expresiones HiLeS.');
  }
  if (ejecutor.capacidades.max_fragment_bytes <= 0 || ejecutor.capacidades.max_elementos <= 0) {
    return noDisponible('capacidad_invalida', 'Publicó límites de capacidad inválidos.');
  }
  if (ejecutor.estado === 'deploying') return noDisponible('deploying', 'Está procesando otro despliegue.', true);
  return { visible: true, seleccionable: true, desplegable: true, motivo: null, detalle: null };
}
