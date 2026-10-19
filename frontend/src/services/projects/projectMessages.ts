import { isModelDocument, type HilesModelDocument } from '../../domain/modelDocument';
import { normalizarIdProyectoV2, type SufijoTopicoProyectoV2 } from './projectTopics';

export type { HilesModelDocument };

export type ElementoDocumentoHiles = HilesModelDocument['allElements'][number];
export type ConexionDocumentoHiles = HilesModelDocument['connections'][number];

export type OrigenEdicionProyecto = 'remoto' | 'local';

export const PRESENCIA_TTL_MS_POR_DEFECTO = 30000;

export type TipoOperacionIncrementalProyectoV2 =
  | 'node.add'
  | 'node.move'
  | 'node.update'
  | 'node.remove'
  | 'connection.add'
  | 'connection.update'
  | 'connection.remove'
  | 'document.patch'
  | 'snapshot_documento'
  | 'reemplazo_documento';

export type OperacionIncrementalProyectoV2 =
  | {
      kind: 'node.add';
      element: ElementoDocumentoHiles;
    }
  | {
      kind: 'node.move';
      elementId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'node.update';
      elementId: string;
      changes: Partial<ElementoDocumentoHiles>;
    }
  | {
      kind: 'node.remove';
      elementId: string;
    }
  | {
      kind: 'connection.add';
      connection: ConexionDocumentoHiles;
    }
  | {
      kind: 'connection.update';
      connectionId: string;
      changes: Partial<ConexionDocumentoHiles>;
    }
  | {
      kind: 'connection.remove';
      connectionId: string;
    }
  | {
      kind: 'document.patch';
      changes: Partial<Pick<HilesModelDocument, 'metadata' | 'network' | 'relationNode'>>;
    };

export interface MensajeProyectoEdicionEstado {
  id_mensaje: string;
  operationId: string;
  proyecto_id: string;
  client_id: string;
  clock: number;
  revision: number;
  actualizado_en: string;
  documento: HilesModelDocument;
  resumen?: string;
}

export interface MensajeProyectoEdicionOperacion {
  id_mensaje: string;
  operationId: string;
  proyecto_id: string;
  client_id: string;
  clock: number;
  revision: number;
  actualizado_en: string;
  tipo_operacion: TipoOperacionIncrementalProyectoV2;
  operacion?: OperacionIncrementalProyectoV2;
  documento?: HilesModelDocument;
  resumen?: string;
}

export interface MensajeProyectoPresencia {
  id_mensaje: string;
  operationId: string;
  proyecto_id: string;
  client_id: string;
  usuario: string;
  color?: string;
  conectado: boolean;
  clock: number;
  revision?: number;
  actualizado_en: string;
  ttl_ms: number;
  vista_activa?: string | null;
}

export interface MensajeProyectoCursor {
  id_mensaje: string;
  operationId: string;
  proyecto_id: string;
  client_id: string;
  usuario: string;
  color?: string;
  x: number;
  y: number;
  vista_activa?: string | null;
  clock: number;
  actualizado_en: string;
}

export type MensajeProyectoColaborativoV2 =
  | MensajeProyectoEdicionEstado
  | MensajeProyectoEdicionOperacion
  | MensajeProyectoPresencia
  | MensajeProyectoCursor;

export type PayloadMensajeProyectoV2 = MensajeProyectoColaborativoV2;

export interface ResultadoValidacionMensajeProyectoV2 {
  ok: boolean;
  mensaje?: MensajeProyectoColaborativoV2;
  error?: string;
}

export type MotivoDescarteConvergenciaV2 =
  | 'proyecto_distinto'
  | 'eco_propio'
  | 'mensaje_duplicado'
  | 'version_antigua';

export type DecisionConvergenciaProyectoV2 =
  | {
      aplicar: true;
      clock: number;
      revision: number;
      client_id: string;
      actualizado_en: string;
    }
  | {
      aplicar: false;
      motivo: MotivoDescarteConvergenciaV2;
    };

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const esTextoNoVacio = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.trim().length > 0;

const esEnteroPositivo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;

const esNumeroFinito = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor);

const clonarProfundo = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

export const clonarDocumentoHiles = (documento: HilesModelDocument): HilesModelDocument =>
  clonarProfundo(documento);

export const claveEntidadOperacionProyectoV2 = (
  operacion?: OperacionIncrementalProyectoV2
): string => {
  if (!operacion) return 'document';
  switch (operacion.kind) {
    case 'node.add':
      return `node:${operacion.element.id}`;
    case 'node.move':
    case 'node.update':
    case 'node.remove':
      return `node:${operacion.elementId}`;
    case 'connection.add':
      return `connection:${operacion.connection.id}`;
    case 'connection.update':
    case 'connection.remove':
      return `connection:${operacion.connectionId}`;
    case 'document.patch':
      return 'document:meta';
  }
};

export const aplicarOperacionIncrementalADocumento = (
  base: HilesModelDocument,
  operacion: OperacionIncrementalProyectoV2
): HilesModelDocument => {
  const siguiente = clonarDocumentoHiles(base);

  switch (operacion.kind) {
    case 'node.add': {
      const idx = siguiente.allElements.findIndex((el) => el.id === operacion.element.id);
      const copiaElemento = clonarProfundo(operacion.element);
      if (idx >= 0) {
        siguiente.allElements[idx] = copiaElemento;
      } else {
        siguiente.allElements.push(copiaElemento);
      }
      break;
    }
    case 'node.move': {
      const elemento = siguiente.allElements.find((el) => el.id === operacion.elementId);
      if (elemento) {
        elemento.layout = {
          ...elemento.layout,
          x: operacion.x,
          y: operacion.y,
        };
      }
      break;
    }
    case 'node.update': {
      const idx = siguiente.allElements.findIndex((el) => el.id === operacion.elementId);
      if (idx >= 0) {
        siguiente.allElements[idx] = {
          ...siguiente.allElements[idx],
          ...clonarProfundo(operacion.changes),
          id: operacion.elementId,
        };
      }
      break;
    }
    case 'node.remove': {
      siguiente.allElements = siguiente.allElements.filter(
        (el) => el.id !== operacion.elementId
      );
      siguiente.connections = siguiente.connections.filter(
        (conn) =>
          conn.source !== operacion.elementId &&
          conn.target !== operacion.elementId
      );
      break;
    }
    case 'connection.add': {
      const idx = siguiente.connections.findIndex((conn) => conn.id === operacion.connection.id);
      const copiaConexion = clonarProfundo(operacion.connection);
      if (idx >= 0) {
        siguiente.connections[idx] = copiaConexion;
      } else {
        siguiente.connections.push(copiaConexion);
      }
      break;
    }
    case 'connection.update': {
      const idx = siguiente.connections.findIndex((conn) => conn.id === operacion.connectionId);
      if (idx >= 0) {
        siguiente.connections[idx] = {
          ...siguiente.connections[idx],
          ...clonarProfundo(operacion.changes),
          id: operacion.connectionId,
        };
      }
      break;
    }
    case 'connection.remove': {
      siguiente.connections = siguiente.connections.filter(
        (conn) => conn.id !== operacion.connectionId
      );
      break;
    }
    case 'document.patch': {
      Object.assign(siguiente, clonarProfundo(operacion.changes));
      break;
    }
  }

  return siguiente;
};

/**
 * Calcula las operaciones incrementales mínimas entre dos estados de `HilesModelDocument`
 * para publicarlas por `document/ops` sin sobrescribir elementos o conexiones no modificados.
 */
export const calcularOperacionesEntreDocumentos = (
  anterior: HilesModelDocument | null,
  siguiente: HilesModelDocument
): OperacionIncrementalProyectoV2[] => {
  if (!anterior) {
    const opsIniciales: OperacionIncrementalProyectoV2[] = [
      {
        kind: 'document.patch',
        changes: {
          metadata: clonarProfundo(siguiente.metadata),
          network: clonarProfundo(siguiente.network),
          relationNode: clonarProfundo(siguiente.relationNode),
        },
      },
    ];
    for (const element of siguiente.allElements) {
      opsIniciales.push({ kind: 'node.add', element: clonarProfundo(element) });
    }
    for (const connection of siguiente.connections) {
      opsIniciales.push({ kind: 'connection.add', connection: clonarProfundo(connection) });
    }
    return opsIniciales;
  }

  const operaciones: OperacionIncrementalProyectoV2[] = [];

  if (
    JSON.stringify(anterior.network) !== JSON.stringify(siguiente.network) ||
    JSON.stringify(anterior.relationNode) !== JSON.stringify(siguiente.relationNode)
  ) {
    operaciones.push({
      kind: 'document.patch',
      changes: {
        metadata: clonarProfundo(siguiente.metadata),
        network: clonarProfundo(siguiente.network),
        relationNode: clonarProfundo(siguiente.relationNode),
      },
    });
  }

  const mapaAnterioresElementos = new Map(anterior.allElements.map((el) => [el.id, el]));
  const mapaSiguientesElementos = new Map(siguiente.allElements.map((el) => [el.id, el]));

  for (const [id, elSiguiente] of mapaSiguientesElementos.entries()) {
    const elAnterior = mapaAnterioresElementos.get(id);
    if (!elAnterior) {
      operaciones.push({
        kind: 'node.add',
        element: clonarProfundo(elSiguiente),
      });
      continue;
    }

    const serialAnterior = JSON.stringify(elAnterior);
    const serialSiguiente = JSON.stringify(elSiguiente);
    if (serialAnterior === serialSiguiente) continue;

    const anteriorSinPos = {
      ...elAnterior,
      layout: { ...elAnterior.layout, x: 0, y: 0 },
    };
    const siguienteSinPos = {
      ...elSiguiente,
      layout: { ...elSiguiente.layout, x: 0, y: 0 },
    };
    if (JSON.stringify(anteriorSinPos) === JSON.stringify(siguienteSinPos)) {
      operaciones.push({
        kind: 'node.move',
        elementId: id,
        x: elSiguiente.layout.x,
        y: elSiguiente.layout.y,
      });
    } else {
      operaciones.push({
        kind: 'node.update',
        elementId: id,
        changes: clonarProfundo(elSiguiente),
      });
    }
  }

  for (const id of mapaAnterioresElementos.keys()) {
    if (!mapaSiguientesElementos.has(id)) {
      operaciones.push({
        kind: 'node.remove',
        elementId: id,
      });
    }
  }

  const mapaAnterioresConexiones = new Map(anterior.connections.map((conn) => [conn.id, conn]));
  const mapaSiguientesConexiones = new Map(siguiente.connections.map((conn) => [conn.id, conn]));

  for (const [id, connSiguiente] of mapaSiguientesConexiones.entries()) {
    const connAnterior = mapaAnterioresConexiones.get(id);
    if (!connAnterior) {
      operaciones.push({
        kind: 'connection.add',
        connection: clonarProfundo(connSiguiente),
      });
      continue;
    }
    if (JSON.stringify(connAnterior) !== JSON.stringify(connSiguiente)) {
      operaciones.push({
        kind: 'connection.update',
        connectionId: id,
        changes: clonarProfundo(connSiguiente),
      });
    }
  }

  for (const id of mapaAnterioresConexiones.keys()) {
    if (!mapaSiguientesConexiones.has(id)) {
      operaciones.push({
        kind: 'connection.remove',
        connectionId: id,
      });
    }
  }

  if (
    operaciones.length === 0 &&
    JSON.stringify(anterior.metadata) !== JSON.stringify(siguiente.metadata)
  ) {
    operaciones.push({
      kind: 'document.patch',
      changes: {
        metadata: clonarProfundo(siguiente.metadata),
      },
    });
  }

  return operaciones;
};

const resolverRelojMensaje = (payload: Record<string, unknown>): number | null => {
  if (esEnteroPositivo(payload.clock)) return payload.clock;
  if (esEnteroPositivo(payload.revision)) return payload.revision;
  return null;
};

const resolverOperationIdMensaje = (payload: Record<string, unknown>): string | null => {
  if (esTextoNoVacio(payload.operationId)) return payload.operationId.trim();
  if (esTextoNoVacio(payload.id_mensaje)) return payload.id_mensaje.trim();
  return null;
};

const validarOperacionIncremental = (
  valor: unknown
): { ok: true; operacion: OperacionIncrementalProyectoV2 } | { ok: false; error: string } => {
  if (!esObjeto(valor) || !esTextoNoVacio(valor.kind)) {
    return { ok: false, error: 'operacion debe incluir kind no vacío.' };
  }
  switch (valor.kind) {
    case 'node.add':
      if (!esObjeto(valor.element) || !esTextoNoVacio(valor.element.id)) {
        return { ok: false, error: 'node.add requiere element con id válido.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'node.add',
          element: clonarProfundo(valor.element as unknown as ElementoDocumentoHiles),
        },
      };
    case 'node.move':
      if (!esTextoNoVacio(valor.elementId) || !esNumeroFinito(valor.x) || !esNumeroFinito(valor.y)) {
        return { ok: false, error: 'node.move requiere elementId, x e y numéricos.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'node.move',
          elementId: valor.elementId.trim(),
          x: valor.x,
          y: valor.y,
        },
      };
    case 'node.update':
      if (!esTextoNoVacio(valor.elementId) || !esObjeto(valor.changes)) {
        return { ok: false, error: 'node.update requiere elementId y changes.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'node.update',
          elementId: valor.elementId.trim(),
          changes: clonarProfundo(valor.changes as Partial<ElementoDocumentoHiles>),
        },
      };
    case 'node.remove':
      if (!esTextoNoVacio(valor.elementId)) {
        return { ok: false, error: 'node.remove requiere elementId.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'node.remove',
          elementId: valor.elementId.trim(),
        },
      };
    case 'connection.add':
      if (!esObjeto(valor.connection) || !esTextoNoVacio(valor.connection.id)) {
        return { ok: false, error: 'connection.add requiere connection con id válido.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'connection.add',
          connection: clonarProfundo(valor.connection as unknown as ConexionDocumentoHiles),
        },
      };
    case 'connection.update':
      if (!esTextoNoVacio(valor.connectionId) || !esObjeto(valor.changes)) {
        return { ok: false, error: 'connection.update requiere connectionId y changes.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'connection.update',
          connectionId: valor.connectionId.trim(),
          changes: clonarProfundo(valor.changes as Partial<ConexionDocumentoHiles>),
        },
      };
    case 'connection.remove':
      if (!esTextoNoVacio(valor.connectionId)) {
        return { ok: false, error: 'connection.remove requiere connectionId.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'connection.remove',
          connectionId: valor.connectionId.trim(),
        },
      };
    case 'document.patch':
      if (!esObjeto(valor.changes)) {
        return { ok: false, error: 'document.patch requiere changes.' };
      }
      return {
        ok: true,
        operacion: {
          kind: 'document.patch',
          changes: clonarProfundo(valor.changes),
        },
      };
    default:
      return { ok: false, error: `kind de operación incremental no soportado: ${String(valor.kind)}` };
  }
};

export const validarMensajeProyectoPorSufijo = (
  sufijo: SufijoTopicoProyectoV2,
  payload: unknown
): ResultadoValidacionMensajeProyectoV2 => {
  if (!esObjeto(payload)) {
    return { ok: false, error: 'El mensaje de proyecto debe ser un objeto JSON.' };
  }

  const operationId = resolverOperationIdMensaje(payload);
  if (!operationId) {
    return { ok: false, error: 'operationId o id_mensaje debe ser un texto no vacío.' };
  }
  if (!esTextoNoVacio(payload.proyecto_id)) {
    return { ok: false, error: 'proyecto_id debe ser un texto no vacío.' };
  }
  const proyectoNormalizado = normalizarIdProyectoV2(payload.proyecto_id);
  if (!proyectoNormalizado.ok) {
    return { ok: false, error: proyectoNormalizado.error ?? 'proyecto_id inválido.' };
  }
  if (!esTextoNoVacio(payload.client_id)) {
    return { ok: false, error: 'client_id debe ser un texto no vacío.' };
  }
  if (!esTextoNoVacio(payload.actualizado_en)) {
    return { ok: false, error: 'actualizado_en debe ser una marca ISO no vacía.' };
  }

  if (sufijo === 'document/snapshot') {
    const clock = resolverRelojMensaje(payload);
    if (clock === null) {
      return { ok: false, error: 'clock (o revision) debe ser un entero positivo.' };
    }
    if (!isModelDocument(payload.documento)) {
      return { ok: false, error: 'documento no cumple el contrato HilesModelDocument.' };
    }
    if (payload.resumen !== undefined && typeof payload.resumen !== 'string') {
      return { ok: false, error: 'resumen debe ser texto cuando se incluye.' };
    }

    return {
      ok: true,
      mensaje: {
        id_mensaje: operationId,
        operationId,
        proyecto_id: proyectoNormalizado.projectId,
        client_id: payload.client_id.trim(),
        clock,
        revision: clock,
        actualizado_en: payload.actualizado_en.trim(),
        documento: clonarDocumentoHiles(payload.documento),
        resumen: payload.resumen,
      },
    };
  }

  if (sufijo === 'document/ops') {
    const clock = resolverRelojMensaje(payload);
    if (clock === null) {
      return { ok: false, error: 'clock (o revision) debe ser un entero positivo.' };
    }
    if (payload.resumen !== undefined && typeof payload.resumen !== 'string') {
      return { ok: false, error: 'resumen debe ser texto cuando se incluye.' };
    }

    if (payload.operacion !== undefined) {
      const opVal = validarOperacionIncremental(payload.operacion);
      if (!opVal.ok) {
        return { ok: false, error: opVal.error };
      }
      return {
        ok: true,
        mensaje: {
          id_mensaje: operationId,
          operationId,
          proyecto_id: proyectoNormalizado.projectId,
          client_id: payload.client_id.trim(),
          clock,
          revision: clock,
          actualizado_en: payload.actualizado_en.trim(),
          tipo_operacion: opVal.operacion.kind,
          operacion: opVal.operacion,
          documento: isModelDocument(payload.documento)
            ? clonarDocumentoHiles(payload.documento)
            : undefined,
          resumen: payload.resumen,
        },
      };
    }

    if (
      (payload.tipo_operacion === 'snapshot_documento' ||
        payload.tipo_operacion === 'reemplazo_documento') &&
      isModelDocument(payload.documento)
    ) {
      return {
        ok: true,
        mensaje: {
          id_mensaje: operationId,
          operationId,
          proyecto_id: proyectoNormalizado.projectId,
          client_id: payload.client_id.trim(),
          clock,
          revision: clock,
          actualizado_en: payload.actualizado_en.trim(),
          tipo_operacion: payload.tipo_operacion,
          documento: clonarDocumentoHiles(payload.documento),
          resumen: payload.resumen,
        },
      };
    }

    return {
      ok: false,
      error: 'El mensaje en document/ops debe incluir operacion incremental válida o documento de respaldo.',
    };
  }

  if (sufijo === 'presence') {
    if (!esTextoNoVacio(payload.usuario)) {
      return { ok: false, error: 'usuario debe ser un texto no vacío en presencia.' };
    }
    if (typeof payload.conectado !== 'boolean') {
      return { ok: false, error: 'conectado debe ser booleano en presencia.' };
    }
    if (payload.color !== undefined && !esTextoNoVacio(payload.color)) {
      return { ok: false, error: 'color debe ser texto no vacío cuando se incluye.' };
    }
    if (
      payload.vista_activa !== undefined &&
      payload.vista_activa !== null &&
      typeof payload.vista_activa !== 'string'
    ) {
      return { ok: false, error: 'vista_activa debe ser texto o null.' };
    }
    const clock = resolverRelojMensaje(payload) ?? 1;
    const ttlMs = esEnteroPositivo(payload.ttl_ms) ? payload.ttl_ms : PRESENCIA_TTL_MS_POR_DEFECTO;

    return {
      ok: true,
      mensaje: {
        id_mensaje: operationId,
        operationId,
        proyecto_id: proyectoNormalizado.projectId,
        client_id: payload.client_id.trim(),
        usuario: payload.usuario.trim(),
        color: payload.color?.trim(),
        conectado: payload.conectado,
        clock,
        revision: clock,
        actualizado_en: payload.actualizado_en.trim(),
        ttl_ms: ttlMs,
        vista_activa: payload.vista_activa ?? null,
      },
    };
  }

  if (sufijo === 'cursor') {
    if (!esTextoNoVacio(payload.usuario)) {
      return { ok: false, error: 'usuario debe ser un texto no vacío en cursor.' };
    }
    if (!esNumeroFinito(payload.x) || !esNumeroFinito(payload.y)) {
      return { ok: false, error: 'x e y deben ser coordenadas numéricas finitas en cursor.' };
    }
    if (payload.color !== undefined && !esTextoNoVacio(payload.color)) {
      return { ok: false, error: 'color debe ser texto no vacío cuando se incluye.' };
    }
    if (
      payload.vista_activa !== undefined &&
      payload.vista_activa !== null &&
      typeof payload.vista_activa !== 'string'
    ) {
      return { ok: false, error: 'vista_activa debe ser texto o null.' };
    }
    const clock = resolverRelojMensaje(payload) ?? 1;

    return {
      ok: true,
      mensaje: {
        id_mensaje: operationId,
        operationId,
        proyecto_id: proyectoNormalizado.projectId,
        client_id: payload.client_id.trim(),
        usuario: payload.usuario.trim(),
        color: payload.color?.trim(),
        x: payload.x,
        y: payload.y,
        vista_activa: payload.vista_activa ?? null,
        clock,
        actualizado_en: payload.actualizado_en.trim(),
      },
    };
  }

  return {
    ok: false,
    error: `El sufijo '${sufijo}' no corresponde a un mensaje colaborativo de proyecto.`,
  };
};

interface MarcaLwwEntidad {
  clock: number;
  client_id: string;
}

/**
 * Controla la convergencia determinista con reloj lógico Lamport (`clock`),
 * deduplicación por `operationId` y desempate Last-Writer-Wins `(clock, client_id)`
 * por entidad o sobre el documento completo.
 */
export class ControlConvergenciaProyectoV2 {
  private readonly projectId: string;
  private readonly localClientId: string;
  private clock = 0;
  private ultimoClientId = '';
  private ultimoActualizadoEn = '';
  private readonly marcasPorEntidad = new Map<string, MarcaLwwEntidad>();
  private readonly mensajesVistos = new Set<string>();
  private readonly colaMensajesVistos: string[] = [];
  private readonly capacidadDeduplicacion: number;

  constructor(projectId: string, localClientId: string, capacidadDeduplicacion = 128) {
    const normalizado = normalizarIdProyectoV2(projectId);
    this.projectId = normalizado.ok ? normalizado.projectId : projectId;
    this.localClientId = localClientId.trim();
    this.capacidadDeduplicacion = Math.max(16, capacidadDeduplicacion);
  }

  public obtenerReloj(): number {
    return this.clock;
  }

  public obtenerRevision(): number {
    return this.clock;
  }

  public prepararPublicacionLocal(
    actualizadoEn = new Date().toISOString(),
    claveEntidad = 'document'
  ): {
    clock: number;
    revision: number;
    client_id: string;
    actualizado_en: string;
  } {
    this.clock += 1;
    this.ultimoClientId = this.localClientId;
    this.ultimoActualizadoEn = actualizadoEn;
    this.marcasPorEntidad.set(claveEntidad, {
      clock: this.clock,
      client_id: this.localClientId,
    });
    return {
      clock: this.clock,
      revision: this.clock,
      client_id: this.localClientId,
      actualizado_en: this.ultimoActualizadoEn,
    };
  }

  public evaluarMensajeRemoto(
    mensaje: MensajeProyectoEdicionEstado | MensajeProyectoEdicionOperacion
  ): DecisionConvergenciaProyectoV2 {
    if (mensaje.proyecto_id !== this.projectId) {
      return { aplicar: false, motivo: 'proyecto_distinto' };
    }
    if (mensaje.client_id === this.localClientId) {
      return { aplicar: false, motivo: 'eco_propio' };
    }

    const opId = mensaje.operationId || mensaje.id_mensaje;
    if (this.mensajesVistos.has(opId)) {
      return { aplicar: false, motivo: 'mensaje_duplicado' };
    }

    const clockRemoto = mensaje.clock ?? mensaje.revision;
    const esOperacionIncremental =
      'operacion' in mensaje && mensaje.operacion !== undefined;
    const claveEntidad = esOperacionIncremental
      ? claveEntidadOperacionProyectoV2(mensaje.operacion)
      : 'document';

    const marcaActual =
      this.marcasPorEntidad.get(claveEntidad) ??
      (claveEntidad !== 'document' ? this.marcasPorEntidad.get('document') : undefined);

    if (marcaActual && !this.esMarcaMayor(clockRemoto, mensaje.client_id, marcaActual)) {
      this.registrarIdMensaje(opId);
      this.clock = Math.max(this.clock, clockRemoto) + 1;
      return { aplicar: false, motivo: 'version_antigua' };
    }

    this.registrarIdMensaje(opId);
    this.clock = Math.max(this.clock, clockRemoto) + 1;
    this.ultimoClientId = mensaje.client_id;
    this.ultimoActualizadoEn = mensaje.actualizado_en;

    const nuevaMarca: MarcaLwwEntidad = {
      clock: clockRemoto,
      client_id: mensaje.client_id,
    };
    this.marcasPorEntidad.set(claveEntidad, nuevaMarca);
    if (!esOperacionIncremental) {
      this.marcasPorEntidad.clear();
      this.marcasPorEntidad.set('document', nuevaMarca);
    }

    return {
      aplicar: true,
      clock: this.clock,
      revision: this.clock,
      client_id: this.ultimoClientId,
      actualizado_en: this.ultimoActualizadoEn,
    };
  }

  private esMarcaMayor(
    clockRemoto: number,
    clientIdRemoto: string,
    actual: MarcaLwwEntidad
  ): boolean {
    if (clockRemoto !== actual.clock) {
      return clockRemoto > actual.clock;
    }
    return clientIdRemoto.localeCompare(actual.client_id) > 0;
  }

  private registrarIdMensaje(idMensaje: string): void {
    if (this.mensajesVistos.has(idMensaje)) return;
    if (this.colaMensajesVistos.length >= this.capacidadDeduplicacion) {
      const antiguo = this.colaMensajesVistos.shift();
      if (antiguo) {
        this.mensajesVistos.delete(antiguo);
      }
    }
    this.colaMensajesVistos.push(idMensaje);
    this.mensajesVistos.add(idMensaje);
  }
}

export const crearMensajeEdicionEstado = (params: {
  idMensaje?: string;
  operationId?: string;
  projectId: string;
  clientId: string;
  clock?: number;
  revision?: number;
  documento: HilesModelDocument;
  actualizadoEn?: string;
  resumen?: string;
}): MensajeProyectoEdicionEstado => {
  const normalizado = normalizarIdProyectoV2(params.projectId);
  const projectId = normalizado.ok ? normalizado.projectId : params.projectId;
  const clock = params.clock ?? params.revision ?? 1;
  const opId = params.operationId ?? params.idMensaje ?? `estado-${Date.now()}-${clock}`;
  return {
    id_mensaje: opId,
    operationId: opId,
    proyecto_id: projectId,
    client_id: params.clientId.trim(),
    clock,
    revision: clock,
    actualizado_en: params.actualizadoEn ?? new Date().toISOString(),
    documento: clonarDocumentoHiles(params.documento),
    resumen: params.resumen,
  };
};

export const crearMensajeEdicionOperacion = (params: {
  idMensaje?: string;
  operationId?: string;
  projectId: string;
  clientId: string;
  clock?: number;
  revision?: number;
  operacion?: OperacionIncrementalProyectoV2;
  documento?: HilesModelDocument;
  tipoOperacion?: TipoOperacionIncrementalProyectoV2;
  actualizadoEn?: string;
  resumen?: string;
}): MensajeProyectoEdicionOperacion => {
  const normalizado = normalizarIdProyectoV2(params.projectId);
  const projectId = normalizado.ok ? normalizado.projectId : params.projectId;
  const clock = params.clock ?? params.revision ?? 1;
  const opId = params.operationId ?? params.idMensaje ?? `op-${Date.now()}-${clock}`;
  const tipoOperacion =
    params.operacion?.kind ?? params.tipoOperacion ?? 'snapshot_documento';
  return {
    id_mensaje: opId,
    operationId: opId,
    proyecto_id: projectId,
    client_id: params.clientId.trim(),
    clock,
    revision: clock,
    actualizado_en: params.actualizadoEn ?? new Date().toISOString(),
    tipo_operacion: tipoOperacion,
    operacion: params.operacion ? clonarProfundo(params.operacion) : undefined,
    documento: params.documento ? clonarDocumentoHiles(params.documento) : undefined,
    resumen: params.resumen,
  };
};

export const crearMensajePresenciaProyecto = (params: {
  idMensaje?: string;
  operationId?: string;
  projectId: string;
  clientId: string;
  usuario: string;
  color?: string;
  conectado: boolean;
  clock?: number;
  revision?: number;
  vistaActiva?: string | null;
  ttlMs?: number;
  actualizadoEn?: string;
}): MensajeProyectoPresencia => {
  const normalizado = normalizarIdProyectoV2(params.projectId);
  const projectId = normalizado.ok ? normalizado.projectId : params.projectId;
  const clock = params.clock ?? params.revision ?? 1;
  const opId = params.operationId ?? params.idMensaje ?? `pres-${Date.now()}`;
  return {
    id_mensaje: opId,
    operationId: opId,
    proyecto_id: projectId,
    client_id: params.clientId.trim(),
    usuario: params.usuario.trim() || 'Colaborador',
    color: params.color,
    conectado: params.conectado,
    clock,
    revision: clock,
    actualizado_en: params.actualizadoEn ?? new Date().toISOString(),
    ttl_ms: params.ttlMs ?? PRESENCIA_TTL_MS_POR_DEFECTO,
    vista_activa: params.vistaActiva ?? null,
  };
};

export const crearMensajeCursorProyecto = (params: {
  idMensaje?: string;
  operationId?: string;
  projectId: string;
  clientId: string;
  usuario: string;
  color?: string;
  x: number;
  y: number;
  vistaActiva?: string | null;
  clock?: number;
  actualizadoEn?: string;
}): MensajeProyectoCursor => {
  const normalizado = normalizarIdProyectoV2(params.projectId);
  const projectId = normalizado.ok ? normalizado.projectId : params.projectId;
  const clock = params.clock ?? 1;
  const opId = params.operationId ?? params.idMensaje ?? `cur-${Date.now()}`;
  return {
    id_mensaje: opId,
    operationId: opId,
    proyecto_id: projectId,
    client_id: params.clientId.trim(),
    usuario: params.usuario.trim() || 'Colaborador',
    color: params.color,
    x: params.x,
    y: params.y,
    vista_activa: params.vistaActiva ?? null,
    clock,
    actualizado_en: params.actualizadoEn ?? new Date().toISOString(),
  };
};
