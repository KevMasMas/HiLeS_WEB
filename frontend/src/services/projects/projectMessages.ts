import type { HilesModelDocument as DomainHilesModelDocument } from '../../domain/modelDocument';
import { esProjectIdValido, normalizarProjectId } from './projectUrl';
import type { SufijoTopicoProyectoV2 } from './projectTopics';

export type HilesModelDocument =
  | DomainHilesModelDocument
  | {
      schemaVersion: number;
      meta?: {
        name?: string;
        description?: string;
        createdAt?: string;
        updatedAt?: string;
      };
      metadata?: { savedAt: string };
      elements?: unknown[];
      allElements?: unknown[];
      connections: unknown[];
      [clave: string]: unknown;
    };

export const PROTOCOLO_PROYECTO_VERSION_V2 = 2 as const;
export const VENTANA_DEDUPLICACION_PROYECTO_V2 = 64;

export type RolColaboradorProyectoV2 = 'editor' | 'lector';

export interface MensajeProyectoEdicionEstado {
  project_id: string;
  client_id: string;
  revision: number;
  id_mensaje: string;
  actualizado_en: string;
  documento: HilesModelDocument;
}

export interface MensajeProyectoEdicionOperacion {
  project_id: string;
  client_id: string;
  revision: number;
  base_revision: number;
  id_mensaje: string;
  resumen?: string;
  actualizado_en: string;
  documento: HilesModelDocument;
}

export interface MensajeProyectoPresencia {
  project_id: string;
  client_id: string;
  alias: string;
  conectado: boolean;
  rol: RolColaboradorProyectoV2;
  actualizado_en: string;
}

export type PayloadMensajeProyectoV2 =
  | MensajeProyectoEdicionEstado
  | MensajeProyectoEdicionOperacion
  | MensajeProyectoPresencia;

export interface ResultadoValidacionMensajeProyectoV2 {
  ok: boolean;
  mensaje: PayloadMensajeProyectoV2 | null;
  error?: string;
}

export type MotivoRechazoConvergenciaV2 =
  | 'own_echo'
  | 'duplicate_message'
  | 'stale_revision';

export type DecisionConvergenciaProyectoV2 =
  | { aceptar: true; revisionAdoptada: number }
  | { aceptar: false; motivo: MotivoRechazoConvergenciaV2 };

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esTextoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;
}

function validarDocumentoBasico(doc: unknown): doc is HilesModelDocument {
  if (!esObjeto(doc)) return false;
  const tieneElementos =
    Array.isArray(doc.elements) || Array.isArray(doc.allElements);
  const tieneConexiones = Array.isArray(doc.connections);
  return tieneElementos && tieneConexiones;
}

function generarIdMensajeProyecto(prefijo = 'sync'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefijo}-${uuid}`;
  return `${prefijo}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function crearMensajeEdicionEstado(params: {
  projectId: string;
  clientId: string;
  revision: number;
  documento: HilesModelDocument;
  idMensaje?: string;
  actualizadoEn?: string;
}): MensajeProyectoEdicionEstado {
  return {
    project_id: normalizarProjectId(params.projectId),
    client_id: params.clientId.trim(),
    revision: Math.max(0, Math.trunc(params.revision)),
    id_mensaje: params.idMensaje?.trim() || generarIdMensajeProyecto('sync'),
    actualizado_en: params.actualizadoEn ?? new Date().toISOString(),
    documento: params.documento,
  };
}

export function crearMensajeEdicionOperacion(params: {
  projectId: string;
  clientId: string;
  revision: number;
  baseRevision: number;
  documento: HilesModelDocument;
  resumen?: string;
  idMensaje?: string;
  actualizadoEn?: string;
}): MensajeProyectoEdicionOperacion {
  return {
    project_id: normalizarProjectId(params.projectId),
    client_id: params.clientId.trim(),
    revision: Math.max(0, Math.trunc(params.revision)),
    base_revision: Math.max(0, Math.trunc(params.baseRevision)),
    id_mensaje: params.idMensaje?.trim() || generarIdMensajeProyecto('op'),
    ...(params.resumen ? { resumen: params.resumen } : {}),
    actualizado_en: params.actualizadoEn ?? new Date().toISOString(),
    documento: params.documento,
  };
}

export function crearMensajePresenciaProyecto(params: {
  projectId: string;
  clientId: string;
  alias: string;
  conectado: boolean;
  rol?: RolColaboradorProyectoV2;
  actualizadoEn?: string;
}): MensajeProyectoPresencia {
  return {
    project_id: normalizarProjectId(params.projectId),
    client_id: params.clientId.trim(),
    alias: params.alias.trim() || params.clientId.trim(),
    conectado: Boolean(params.conectado),
    rol: params.rol ?? 'editor',
    actualizado_en: params.actualizadoEn ?? new Date().toISOString(),
  };
}

export function validarMensajeProyectoPorSufijo(
  sufijo: SufijoTopicoProyectoV2 | string,
  payload: unknown,
): ResultadoValidacionMensajeProyectoV2 {
  if (!esObjeto(payload)) {
    return {
      ok: false,
      mensaje: null,
      error: 'el payload de proyecto debe ser un objeto JSON',
    };
  }

  if (!esProjectIdValido(payload.project_id)) {
    return {
      ok: false,
      mensaje: null,
      error: 'project_id es inválido o no cumple el formato v2',
    };
  }

  if (!esTextoNoVacio(payload.client_id)) {
    return {
      ok: false,
      mensaje: null,
      error: 'client_id debe ser un texto no vacío',
    };
  }

  if (!esTextoNoVacio(payload.actualizado_en)) {
    return {
      ok: false,
      mensaje: null,
      error: 'actualizado_en debe ser una marca de tiempo ISO-8601 no vacía',
    };
  }

  if (sufijo === 'edicion/estado') {
    if (!esEnteroNoNegativo(payload.revision)) {
      return {
        ok: false,
        mensaje: null,
        error: 'revision debe ser un entero no negativo',
      };
    }
    if (!esTextoNoVacio(payload.id_mensaje)) {
      return {
        ok: false,
        mensaje: null,
        error: 'id_mensaje debe ser un texto no vacío',
      };
    }
    if (!validarDocumentoBasico(payload.documento)) {
      return {
        ok: false,
        mensaje: null,
        error: 'documento debe ser un HilesModelDocument válido',
      };
    }
    return {
      ok: true,
      mensaje: {
        project_id: payload.project_id.trim(),
        client_id: payload.client_id.trim(),
        revision: payload.revision,
        id_mensaje: payload.id_mensaje.trim(),
        actualizado_en: payload.actualizado_en.trim(),
        documento: payload.documento,
      },
    };
  }

  if (sufijo === 'edicion/operacion') {
    if (!esEnteroNoNegativo(payload.revision)) {
      return {
        ok: false,
        mensaje: null,
        error: 'revision debe ser un entero no negativo',
      };
    }
    if (!esEnteroNoNegativo(payload.base_revision)) {
      return {
        ok: false,
        mensaje: null,
        error: 'base_revision debe ser un entero no negativo',
      };
    }
    if (!esTextoNoVacio(payload.id_mensaje)) {
      return {
        ok: false,
        mensaje: null,
        error: 'id_mensaje debe ser un texto no vacío',
      };
    }
    if (
      payload.resumen !== undefined &&
      typeof payload.resumen !== 'string'
    ) {
      return {
        ok: false,
        mensaje: null,
        error: 'resumen debe ser texto cuando se incluye',
      };
    }
    if (!validarDocumentoBasico(payload.documento)) {
      return {
        ok: false,
        mensaje: null,
        error: 'documento debe ser un HilesModelDocument válido',
      };
    }
    return {
      ok: true,
      mensaje: {
        project_id: payload.project_id.trim(),
        client_id: payload.client_id.trim(),
        revision: payload.revision,
        base_revision: payload.base_revision,
        id_mensaje: payload.id_mensaje.trim(),
        ...(payload.resumen !== undefined ? { resumen: payload.resumen } : {}),
        actualizado_en: payload.actualizado_en.trim(),
        documento: payload.documento,
      },
    };
  }

  if (sufijo === 'edicion/presencia') {
    if (!esTextoNoVacio(payload.alias)) {
      return {
        ok: false,
        mensaje: null,
        error: 'alias debe ser un texto no vacío',
      };
    }
    if (typeof payload.conectado !== 'boolean') {
      return {
        ok: false,
        mensaje: null,
        error: 'conectado debe ser booleano',
      };
    }
    if (payload.rol !== 'editor' && payload.rol !== 'lector') {
      return {
        ok: false,
        mensaje: null,
        error: "rol debe ser 'editor' o 'lector'",
      };
    }
    return {
      ok: true,
      mensaje: {
        project_id: payload.project_id.trim(),
        client_id: payload.client_id.trim(),
        alias: payload.alias.trim(),
        conectado: payload.conectado,
        rol: payload.rol,
        actualizado_en: payload.actualizado_en.trim(),
      },
    };
  }

  return {
    ok: false,
    mensaje: null,
    error: `sufijo de proyecto '${String(sufijo)}' no corresponde a un mensaje de edición/presencia`,
  };
}

/**
 * Controla la convergencia de revisiones, filtro de eco propio (`own_echo`)
 * y deduplicación por `id_mensaje` (`duplicate_message`).
 */
export class ControlConvergenciaProyectoV2 {
  private readonly clientIdLocal: string;
  private revisionActual: number;
  private ultimaMarcaTiempo = '';
  private ultimoClientId = '';
  private readonly maxHistorial: number;
  private readonly colaIds: string[] = [];
  private readonly setIds = new Set<string>();

  constructor(
    clientIdLocal: string,
    revisionInicial: number = 0,
    maxHistorial: number = VENTANA_DEDUPLICACION_PROYECTO_V2,
  ) {
    this.clientIdLocal = clientIdLocal.trim();
    this.revisionActual = Math.max(0, Math.trunc(revisionInicial));
    this.maxHistorial = Math.max(8, Math.trunc(maxHistorial));
  }

  public obtenerRevisionActual(): number {
    return this.revisionActual;
  }

  public avanzarRevisionLocal(actualizadoEn?: string): number {
    this.revisionActual += 1;
    this.ultimaMarcaTiempo = actualizadoEn ?? new Date().toISOString();
    this.ultimoClientId = this.clientIdLocal;
    return this.revisionActual;
  }

  public registrarIdMensajePropio(idMensaje: string): void {
    this.recordarId(idMensaje);
  }

  private recordarId(idMensaje: string): void {
    if (this.setIds.has(idMensaje)) return;
    this.setIds.add(idMensaje);
    this.colaIds.push(idMensaje);
    while (this.colaIds.length > this.maxHistorial) {
      const viejo = this.colaIds.shift();
      if (viejo) this.setIds.delete(viejo);
    }
  }

  public evaluarMensajeEntrante(
    mensaje: MensajeProyectoEdicionEstado | MensajeProyectoEdicionOperacion,
  ): DecisionConvergenciaProyectoV2 {
    if (mensaje.client_id === this.clientIdLocal) {
      return { aceptar: false, motivo: 'own_echo' };
    }

    if (this.setIds.has(mensaje.id_mensaje)) {
      return { aceptar: false, motivo: 'duplicate_message' };
    }

    if (mensaje.revision < this.revisionActual) {
      return { aceptar: false, motivo: 'stale_revision' };
    }

    if (mensaje.revision === this.revisionActual && this.ultimaMarcaTiempo) {
      const cmpTiempo = mensaje.actualizado_en.localeCompare(
        this.ultimaMarcaTiempo,
      );
      if (
        cmpTiempo < 0 ||
        (cmpTiempo === 0 &&
          mensaje.client_id.localeCompare(this.ultimoClientId) <= 0)
      ) {
        return { aceptar: false, motivo: 'stale_revision' };
      }
    }

    this.recordarId(mensaje.id_mensaje);
    this.revisionActual = mensaje.revision;
    this.ultimaMarcaTiempo = mensaje.actualizado_en;
    this.ultimoClientId = mensaje.client_id;

    return {
      aceptar: true,
      revisionAdoptada: this.revisionActual,
    };
  }
}
