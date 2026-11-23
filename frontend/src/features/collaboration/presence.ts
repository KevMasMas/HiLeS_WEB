import type { ColaboradorProyectoV2 } from '../../services/projects/ProjectSyncClient';

/**
 * La presencia v2 tiene un campo libre `vista_activa`. Se usa para anunciar la
 * selección actual sin crear un tópico nuevo: `canvas` sin selección o
 * `canvas#<nodeId>` con un nodo seleccionado.
 */
export const VISTA_CANVAS = 'canvas';

export const codificarVista = (seleccionId: string | null): string =>
  seleccionId ? `${VISTA_CANVAS}#${seleccionId}` : VISTA_CANVAS;

export const decodificarSeleccion = (vista: string | null | undefined): string | null => {
  if (!vista || !vista.startsWith(`${VISTA_CANVAS}#`)) return null;
  const id = vista.slice(VISTA_CANVAS.length + 1);
  return id || null;
};

export type EstadoColaborador = 'activo' | 'inactivo' | 'desconectado';

/** Activo si su último latido es reciente; inactivo pasado medio TTL. */
export const estadoColaborador = (colaborador: ColaboradorProyectoV2, ahoraMs = Date.now()): EstadoColaborador => {
  if (!colaborador.conectado) return 'desconectado';
  const marca = Date.parse(colaborador.actualizadoEn);
  if (!Number.isFinite(marca)) return 'activo';
  return ahoraMs - marca > colaborador.ttlMs / 2 ? 'inactivo' : 'activo';
};

export const ETIQUETA_ESTADO_COLABORADOR: Record<EstadoColaborador, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  desconectado: 'Desconectado',
};

export const iniciales = (nombre: string): string => {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
};
