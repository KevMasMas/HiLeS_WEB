import type { MqttConnectionStatus, MqttTopicPolicy } from '../mqtt/config';
import {
  ControlConvergenciaProyectoV2,
  crearMensajeEdicionEstado,
  crearMensajeEdicionOperacion,
  crearMensajePresenciaProyecto,
  validarMensajeProyectoPorSufijo,
  type HilesModelDocument,
  type MensajeProyectoEdicionEstado,
  type MensajeProyectoEdicionOperacion,
  type MensajeProyectoPresencia,
  type RolColaboradorProyectoV2,
} from './projectMessages';
import {
  construirTopicosProyectoV2,
  obtenerPoliticaTopicoProyectoV2,
  parsearTopicoProyectoV2,
  PREFIJO_PROYECTOS_V2_POR_DEFECTO,
  type TopicosProyectoV2,
} from './projectTopics';
import { normalizarProjectId } from './projectUrl';

export const DEBOUNCE_SINCRONIZACION_PROYECTO_MS = 300;

export interface TransporteMqttProyectoV2 {
  getStatus: () => MqttConnectionStatus;
  connect: () => void;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  publish: (
    topic: string,
    payload: unknown,
    customPolicy?: MqttTopicPolicy,
  ) => boolean;
  onRawMessage: (
    listener: (topic: string, rawPayload: string) => void,
  ) => () => void;
  onStatusChange: (
    listener: (status: MqttConnectionStatus) => void,
  ) => () => void;
}

export interface ColaboradorProyectoV2 {
  clientId: string;
  alias: string;
  conectado: boolean;
  rol: RolColaboradorProyectoV2;
  actualizadoEn: string;
}

export interface EventoDocumentoRemotoProyectoV2 {
  projectId: string;
  clientId: string;
  revision: number;
  origen: 'estado' | 'operacion';
  resumen?: string;
  documento: HilesModelDocument;
  idMensaje: string;
  actualizadoEn: string;
}

export interface OpcionesProjectSyncClient {
  projectId: string;
  clientId?: string;
  alias?: string;
  rol?: RolColaboradorProyectoV2;
  debounceMs?: number;
  revisionInicial?: number;
  prefijoTopicos?: string;
}

function clonarDocumento(doc: HilesModelDocument): HilesModelDocument {
  return JSON.parse(JSON.stringify(doc)) as HilesModelDocument;
}

/**
 * Cliente de sincronización colaborativa de proyectos sobre MQTT v2,
 * completamente desacoplado de React, con control de revisiones,
 * deduplicación por `id_mensaje`, filtro de eco propio (`own_echo`),
 * publicación agrupada con debounce y aislamiento por `projectId`.
 */
export class ProjectSyncClient {
  private readonly transporte: TransporteMqttProyectoV2;
  private projectId: string;
  private readonly clientId: string;
  private alias: string;
  private rol: RolColaboradorProyectoV2;
  private readonly debounceMs: number;
  private readonly prefijoTopicos: string;

  private convergencia: ControlConvergenciaProyectoV2;
  private topicos: TopicosProyectoV2;
  private conectado = false;
  private aplicandoRemoto = false;

  private timerDebounce: ReturnType<typeof setTimeout> | null = null;
  private cambioPendiente: {
    documento: HilesModelDocument;
    resumen?: string;
  } | null = null;

  private unsubscribeRaw: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;

  private readonly colaboradores = new Map<string, ColaboradorProyectoV2>();
  private readonly remoteDocumentListeners = new Set<
    (evento: EventoDocumentoRemotoProyectoV2) => void
  >();
  private readonly collaboratorsListeners = new Set<
    (colaboradores: ColaboradorProyectoV2[]) => void
  >();

  constructor(
    transporte: TransporteMqttProyectoV2,
    opciones: OpcionesProjectSyncClient,
  ) {
    this.transporte = transporte;
    this.projectId = normalizarProjectId(opciones.projectId);
    this.clientId =
      opciones.clientId?.trim() ||
      `web-${Math.random().toString(36).slice(2, 10)}`;
    this.alias =
      opciones.alias?.trim() || `Editor ${this.clientId.slice(-4)}`;
    this.rol = opciones.rol ?? 'editor';
    this.debounceMs =
      opciones.debounceMs ?? DEBOUNCE_SINCRONIZACION_PROYECTO_MS;
    this.prefijoTopicos =
      opciones.prefijoTopicos ?? PREFIJO_PROYECTOS_V2_POR_DEFECTO;

    this.convergencia = new ControlConvergenciaProyectoV2(
      this.clientId,
      opciones.revisionInicial ?? 0,
    );
    this.topicos = construirTopicosProyectoV2(
      this.projectId,
      this.prefijoTopicos,
    );
  }

  public obtenerProjectId(): string {
    return this.projectId;
  }

  public obtenerClientId(): string {
    return this.clientId;
  }

  public obtenerRevision(): number {
    return this.convergencia.obtenerRevisionActual();
  }

  public obtenerTopicos(): TopicosProyectoV2 {
    return this.topicos;
  }

  public obtenerColaboradores(): ColaboradorProyectoV2[] {
    return [...this.colaboradores.values()];
  }

  public onRemoteDocument(
    listener: (evento: EventoDocumentoRemotoProyectoV2) => void,
  ): () => void {
    this.remoteDocumentListeners.add(listener);
    return () => this.remoteDocumentListeners.delete(listener);
  }

  public onCollaboratorsChange(
    listener: (colaboradores: ColaboradorProyectoV2[]) => void,
  ): () => void {
    this.collaboratorsListeners.add(listener);
    return () => this.collaboratorsListeners.delete(listener);
  }

  public conectar(): void {
    if (this.conectado) return;
    this.conectado = true;

    this.unsubscribeRaw = this.transporte.onRawMessage((topic, rawPayload) => {
      this.procesarMensajeRaw(topic, rawPayload);
    });

    this.unsubscribeStatus = this.transporte.onStatusChange((status) => {
      if (status === 'CONNECTED' && this.conectado) {
        this.publicarPresencia(true);
      }
    });

    this.suscribirTopicosActuales();
    this.transporte.connect();
    if (this.transporte.getStatus() === 'CONNECTED') {
      this.publicarPresencia(true);
    }
  }

  public desconectar(): void {
    if (!this.conectado) return;
    this.limpiarDebounce();
    if (this.transporte.getStatus() === 'CONNECTED') {
      this.publicarPresencia(false);
    }
    this.desuscribirTopicosActuales();
    this.unsubscribeRaw?.();
    this.unsubscribeStatus?.();
    this.unsubscribeRaw = null;
    this.unsubscribeStatus = null;
    this.conectado = false;
  }

  public cambiarProyecto(
    nuevoProjectId: string,
    revisionInicial: number = 0,
  ): TopicosProyectoV2 {
    const normalizado = normalizarProjectId(nuevoProjectId);
    if (normalizado === this.projectId) {
      return this.topicos;
    }

    this.limpiarDebounce();
    if (this.conectado) {
      this.desuscribirTopicosActuales();
    }

    this.projectId = normalizado;
    this.topicos = construirTopicosProyectoV2(
      this.projectId,
      this.prefijoTopicos,
    );
    this.convergencia = new ControlConvergenciaProyectoV2(
      this.clientId,
      revisionInicial,
    );
    this.colaboradores.clear();
    this.notificarColaboradores();

    if (this.conectado) {
      this.suscribirTopicosActuales();
      if (this.transporte.getStatus() === 'CONNECTED') {
        this.publicarPresencia(true);
      }
    }

    return this.topicos;
  }

  /**
   * Notifica un cambio local del documento en el editor.
   * Si el cambio se originó mientras se aplicaba una actualización remota,
   * se ignora automáticamente para evitar bucles infinitos.
   */
  public notificarCambioLocal(
    documento: HilesModelDocument,
    resumen?: string,
  ): void {
    if (this.aplicandoRemoto) return;

    this.cambioPendiente = {
      documento: clonarDocumento(documento),
      resumen,
    };

    if (this.debounceMs <= 0) {
      this.flushCambioPendiente();
      return;
    }

    if (this.timerDebounce) {
      clearTimeout(this.timerDebounce);
    }
    this.timerDebounce = setTimeout(() => {
      this.timerDebounce = null;
      this.flushCambioPendiente();
    }, this.debounceMs);
  }

  public publicarSnapshotInmediato(
    documento: HilesModelDocument,
    resumen?: string,
  ): boolean {
    this.limpiarDebounce();
    return this.publicarRevisionLocal(clonarDocumento(documento), resumen);
  }

  public publicarPresencia(conectado: boolean): boolean {
    const msg = crearMensajePresenciaProyecto({
      projectId: this.projectId,
      clientId: this.clientId,
      alias: this.alias,
      conectado,
      rol: this.rol,
    });
    return this.transporte.publish(
      this.topicos.edicionPresencia,
      msg,
      obtenerPoliticaTopicoProyectoV2('edicion/presencia'),
    );
  }

  private suscribirTopicosActuales(): void {
    this.transporte.subscribe(this.topicos.edicionEstado);
    this.transporte.subscribe(this.topicos.edicionOperacion);
    this.transporte.subscribe(this.topicos.edicionPresencia);
  }

  private desuscribirTopicosActuales(): void {
    this.transporte.unsubscribe(this.topicos.edicionEstado);
    this.transporte.unsubscribe(this.topicos.edicionOperacion);
    this.transporte.unsubscribe(this.topicos.edicionPresencia);
  }

  private limpiarDebounce(): void {
    if (this.timerDebounce) {
      clearTimeout(this.timerDebounce);
      this.timerDebounce = null;
    }
    this.cambioPendiente = null;
  }

  private flushCambioPendiente(): void {
    if (!this.cambioPendiente) return;
    const { documento, resumen } = this.cambioPendiente;
    this.cambioPendiente = null;
    this.publicarRevisionLocal(documento, resumen);
  }

  private publicarRevisionLocal(
    documento: HilesModelDocument,
    resumen?: string,
  ): boolean {
    const baseRevision = this.convergencia.obtenerRevisionActual();
    const ahoraIso = new Date().toISOString();
    const nuevaRevision = this.convergencia.avanzarRevisionLocal(ahoraIso);

    const msgOp = crearMensajeEdicionOperacion({
      projectId: this.projectId,
      clientId: this.clientId,
      revision: nuevaRevision,
      baseRevision,
      documento,
      resumen,
      actualizadoEn: ahoraIso,
    });
    this.convergencia.registrarIdMensajePropio(msgOp.id_mensaje);

    const msgEstado = crearMensajeEdicionEstado({
      projectId: this.projectId,
      clientId: this.clientId,
      revision: nuevaRevision,
      documento,
      actualizadoEn: ahoraIso,
    });
    this.convergencia.registrarIdMensajePropio(msgEstado.id_mensaje);

    const pubOp = this.transporte.publish(
      this.topicos.edicionOperacion,
      msgOp,
      obtenerPoliticaTopicoProyectoV2('edicion/operacion'),
    );
    const pubEstado = this.transporte.publish(
      this.topicos.edicionEstado,
      msgEstado,
      obtenerPoliticaTopicoProyectoV2('edicion/estado'),
    );

    return pubOp && pubEstado;
  }

  private procesarMensajeRaw(topic: string, rawPayload: string): void {
    const infoTopico = parsearTopicoProyectoV2(topic, this.prefijoTopicos);
    if (!infoTopico || infoTopico.projectId !== this.projectId) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      return;
    }

    const validacion = validarMensajeProyectoPorSufijo(
      infoTopico.sufijo,
      parsed,
    );
    if (!validacion.ok || !validacion.mensaje) {
      return;
    }

    if (infoTopico.sufijo === 'edicion/presencia') {
      const msgPresencia = validacion.mensaje as MensajeProyectoPresencia;
      if (msgPresencia.client_id === this.clientId) return;
      if (msgPresencia.conectado) {
        this.colaboradores.set(msgPresencia.client_id, {
          clientId: msgPresencia.client_id,
          alias: msgPresencia.alias,
          conectado: true,
          rol: msgPresencia.rol,
          actualizadoEn: msgPresencia.actualizado_en,
        });
      } else {
        this.colaboradores.delete(msgPresencia.client_id);
      }
      this.notificarColaboradores();
      return;
    }

    if (
      infoTopico.sufijo === 'edicion/estado' ||
      infoTopico.sufijo === 'edicion/operacion'
    ) {
      const msgDoc = validacion.mensaje as
        | MensajeProyectoEdicionEstado
        | MensajeProyectoEdicionOperacion;
      const decision = this.convergencia.evaluarMensajeEntrante(msgDoc);
      if (!decision.aceptar) {
        return;
      }

      const evento: EventoDocumentoRemotoProyectoV2 = {
        projectId: msgDoc.project_id,
        clientId: msgDoc.client_id,
        revision: msgDoc.revision,
        origen: infoTopico.sufijo === 'edicion/estado' ? 'estado' : 'operacion',
        ...('resumen' in msgDoc && msgDoc.resumen
          ? { resumen: msgDoc.resumen }
          : {}),
        documento: clonarDocumento(msgDoc.documento),
        idMensaje: msgDoc.id_mensaje,
        actualizadoEn: msgDoc.actualizado_en,
      };

      this.aplicandoRemoto = true;
      try {
        this.remoteDocumentListeners.forEach((listener) => listener(evento));
      } finally {
        this.aplicandoRemoto = false;
      }
    }
  }

  private notificarColaboradores(): void {
    const lista = this.obtenerColaboradores();
    this.collaboratorsListeners.forEach((listener) => listener(lista));
  }
}
