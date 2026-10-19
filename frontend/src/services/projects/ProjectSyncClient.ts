import { HILES_DOCUMENT_VERSION, type HilesModelDocument } from '../../domain/modelDocument';
import type { MqttConnectionStatus, MqttTopic, MqttTopicPolicy } from '../mqtt/config';
import type { MensajeMqtt } from '../mqtt/messages';
import {
  aplicarOperacionIncrementalADocumento,
  calcularOperacionesEntreDocumentos,
  claveEntidadOperacionProyectoV2,
  clonarDocumentoHiles,
  ControlConvergenciaProyectoV2,
  crearMensajeCursorProyecto,
  crearMensajeEdicionEstado,
  crearMensajeEdicionOperacion,
  crearMensajePresenciaProyecto,
  PRESENCIA_TTL_MS_POR_DEFECTO,
  validarMensajeProyectoPorSufijo,
  type DecisionConvergenciaProyectoV2,
  type MensajeProyectoCursor,
  type MensajeProyectoEdicionEstado,
  type MensajeProyectoEdicionOperacion,
  type MensajeProyectoPresencia,
  type OperacionIncrementalProyectoV2,
} from './projectMessages';
import {
  construirTopicosProyectoV2,
  normalizarIdProyectoV2,
  parsearTopicoProyectoV2,
  PREFIJO_PROYECTOS_V2_POR_DEFECTO,
  resolverPoliticaTopicoProyectoV2,
  type TopicosProyectoV2,
} from './projectTopics';

export interface TransporteMqttProyectoV2 {
  getStatus: () => MqttConnectionStatus;
  onStatusChange: (listener: (status: MqttConnectionStatus) => void) => () => void;
  onMessage: (listener: (topic: MqttTopic, payload: MensajeMqtt) => void) => () => void;
  connect: () => void;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  publish: (topic: string, payload: unknown, customPolicy?: MqttTopicPolicy) => boolean;
  setWillMessage?: (will: {
    topic: string;
    payload: unknown;
    qos?: 0 | 1;
    retain?: boolean;
  } | null) => void;
}

export interface ColaboradorProyectoV2 {
  clientId: string;
  usuario: string;
  color: string;
  conectado: boolean;
  actualizadoEn: string;
  ttlMs: number;
  vistaActiva: string | null;
}

export interface CursorRemotoProyectoV2 {
  clientId: string;
  usuario: string;
  color: string;
  x: number;
  y: number;
  vistaActiva: string | null;
  clock: number;
  actualizadoEn: string;
}

export interface EventoDocumentoRemotoProyectoV2 {
  projectId: string;
  documento: HilesModelDocument;
  clock: number;
  revision: number;
  clientId: string;
  actualizadoEn: string;
  origenTopico: 'document/snapshot' | 'document/ops';
  operacion?: OperacionIncrementalProyectoV2;
  resumen?: string;
}

export interface OpcionesProjectSyncClient {
  projectId: string;
  mqtt: TransporteMqttProyectoV2;
  clientId?: string;
  usuario?: string;
  color?: string;
  prefijoTopicos?: string;
  debounceMs?: number;
  presenciaTtlMs?: number;
  documentoInicial?: HilesModelDocument;
  generarIdMensaje?: () => string;
  ahoraIso?: () => string;
}

const COLORES_COLABORADOR_POR_DEFECTO = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#fb7185',
] as const;

const elegirColorDeterminista = (semilla: string): string => {
  let hash = 0;
  for (let i = 0; i < semilla.length; i += 1) {
    hash = (hash * 31 + semilla.charCodeAt(i)) >>> 0;
  }
  return COLORES_COLABORADOR_POR_DEFECTO[hash % COLORES_COLABORADOR_POR_DEFECTO.length];
};

const crearDocumentoBaseVacio = (_projectId: string, ahoraIso: string): HilesModelDocument => ({
  schemaVersion: HILES_DOCUMENT_VERSION,
  metadata: { savedAt: ahoraIso },
  network: { topology: null, protocol: null, nodes: [] },
  allElements: [],
  relationNode: [],
  connections: [],
});

/**
 * Cliente de sincronización colaborativa por proyecto (`?project=<id>`).
 * Opera desacoplado de React sobre los tópicos canónicos `udfjc/hiles/v2/projects/<projectId>/...`
 * con reloj lógico Lamport, operaciones incrementales (`document/ops`), snapshots retenidos
 * (`document/snapshot`), presencia retenida con Last Will + TTL (`presence`) y cursores (`cursor`).
 */
export class ProjectSyncClient {
  private projectId: string;
  private readonly mqtt: TransporteMqttProyectoV2;
  private readonly clientId: string;
  private usuario: string;
  private color: string;
  private readonly prefijoTopicos: string;
  private readonly debounceMs: number;
  private readonly presenciaTtlMs: number;
  private readonly generarIdMensaje: () => string;
  private readonly ahoraIso: () => string;

  private topicos: TopicosProyectoV2;
  private convergencia: ControlConvergenciaProyectoV2;
  private documentoActual: HilesModelDocument | null = null;
  private readonly colaboradores = new Map<string, ColaboradorProyectoV2>();
  private readonly cursoresRemotos = new Map<string, CursorRemotoProyectoV2>();
  private readonly listenersDocumentoRemoto = new Set<
    (evento: EventoDocumentoRemotoProyectoV2) => void
  >();
  private readonly listenersOperacionRemota = new Set<
    (mensaje: MensajeProyectoEdicionOperacion) => void
  >();
  private readonly listenersPresencia = new Set<
    (colaboradores: ColaboradorProyectoV2[]) => void
  >();
  private readonly listenersCursor = new Set<
    (cursores: CursorRemotoProyectoV2[]) => void
  >();
  private readonly listenersDescarte = new Set<
    (decision: DecisionConvergenciaProyectoV2 & { aplicar: false }) => void
  >();

  private cancelarSuscripcionMensajes: (() => void) | null = null;
  private cancelarSuscripcionEstado: (() => void) | null = null;
  private timerDebounce: ReturnType<typeof setTimeout> | null = null;
  private borradorPendiente: { documento: HilesModelDocument; resumen?: string } | null = null;
  private suprimiendoCambioRemoto = false;
  private conectado = false;

  constructor(opciones: OpcionesProjectSyncClient) {
    const normalizado = normalizarIdProyectoV2(opciones.projectId);
    this.projectId = normalizado.ok ? normalizado.projectId : 'default';
    this.mqtt = opciones.mqtt;
    this.clientId =
      opciones.clientId?.trim() || `collab-${Math.random().toString(16).slice(2, 10)}`;
    this.usuario = opciones.usuario?.trim() || `Usuario-${this.clientId.slice(-4)}`;
    this.color = opciones.color?.trim() || elegirColorDeterminista(this.clientId);
    this.prefijoTopicos = opciones.prefijoTopicos ?? PREFIJO_PROYECTOS_V2_POR_DEFECTO;
    this.debounceMs = Math.max(0, opciones.debounceMs ?? 150);
    this.presenciaTtlMs = Math.max(1000, opciones.presenciaTtlMs ?? PRESENCIA_TTL_MS_POR_DEFECTO);
    this.generarIdMensaje =
      opciones.generarIdMensaje ??
      (() => `msg-${this.clientId}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`);
    this.ahoraIso = opciones.ahoraIso ?? (() => new Date().toISOString());

    this.topicos = construirTopicosProyectoV2(this.projectId, this.prefijoTopicos);
    this.convergencia = new ControlConvergenciaProyectoV2(this.projectId, this.clientId);
    if (opciones.documentoInicial) {
      this.documentoActual = clonarDocumentoHiles(opciones.documentoInicial);
    }
  }

  public obtenerProjectId(): string {
    return this.projectId;
  }

  public obtenerClientId(): string {
    return this.clientId;
  }

  public obtenerTopicos(): TopicosProyectoV2 {
    return this.topicos;
  }

  public obtenerRevisionLocal(): number {
    return this.convergencia.obtenerReloj();
  }

  public obtenerRelojLamport(): number {
    return this.convergencia.obtenerReloj();
  }

  public obtenerDocumentoActual(): HilesModelDocument | null {
    return this.documentoActual ? clonarDocumentoHiles(this.documentoActual) : null;
  }

  public establecerDocumentoBase(documento: HilesModelDocument): void {
    this.documentoActual = clonarDocumentoHiles(documento);
  }

  public estaAplicandoCambioRemoto(): boolean {
    return this.suprimiendoCambioRemoto;
  }

  public ejecutarConGuardiaRemota<T>(fn: () => T): T {
    this.suprimiendoCambioRemoto = true;
    try {
      return fn();
    } finally {
      this.suprimiendoCambioRemoto = false;
    }
  }

  public conectar(): void {
    if (this.conectado) return;
    this.conectado = true;

    this.configurarLastWillPresencia();
    this.suscribirTopicosProyecto();

    this.cancelarSuscripcionMensajes = this.mqtt.onMessage((topic, payload) => {
      this.procesarMensajeMqtt(topic, payload);
    });

    this.cancelarSuscripcionEstado = this.mqtt.onStatusChange((status) => {
      if (status === 'CONNECTED') {
        this.suscribirTopicosProyecto();
        this.publicarPresencia(true, null);
      }
    });

    if (this.mqtt.getStatus() === 'DISCONNECTED') {
      this.mqtt.connect();
    } else if (this.mqtt.getStatus() === 'CONNECTED') {
      this.publicarPresencia(true, null);
    }
  }

  public desconectar(): void {
    if (!this.conectado) return;
    this.limpiarDebounce();
    this.publicarPresencia(false, null);

    this.desuscribirTopicosProyecto();
    this.mqtt.setWillMessage?.(null);
    this.cancelarSuscripcionMensajes?.();
    this.cancelarSuscripcionMensajes = null;
    this.cancelarSuscripcionEstado?.();
    this.cancelarSuscripcionEstado = null;
    this.conectado = false;
  }

  public cambiarProyecto(nuevoProjectId: string, documentoInicial?: HilesModelDocument): void {
    const normalizado = normalizarIdProyectoV2(nuevoProjectId);
    const destino = normalizado.ok ? normalizado.projectId : 'default';
    if (destino === this.projectId && this.conectado) return;

    const estabaConectado = this.conectado;
    if (estabaConectado) {
      this.limpiarDebounce();
      this.publicarPresencia(false, null);
      this.desuscribirTopicosProyecto();
    }

    this.projectId = destino;
    this.topicos = construirTopicosProyectoV2(this.projectId, this.prefijoTopicos);
    this.convergencia = new ControlConvergenciaProyectoV2(this.projectId, this.clientId);
    this.documentoActual = documentoInicial ? clonarDocumentoHiles(documentoInicial) : null;
    this.colaboradores.clear();
    this.cursoresRemotos.clear();
    this.emitirPresencia();
    this.emitirCursores();

    if (estabaConectado) {
      this.configurarLastWillPresencia();
      this.suscribirTopicosProyecto();
      this.publicarPresencia(true, null);
    }
  }

  public publicarOperacionIncremental(
    operacion: OperacionIncrementalProyectoV2,
    resumen?: string
  ): boolean {
    if (this.suprimiendoCambioRemoto) {
      return false;
    }

    const base =
      this.documentoActual ?? crearDocumentoBaseVacio(this.projectId, this.ahoraIso());
    this.documentoActual = aplicarOperacionIncrementalADocumento(base, operacion);

    const claveEntidad = claveEntidadOperacionProyectoV2(operacion);
    const metadatos = this.convergencia.prepararPublicacionLocal(this.ahoraIso(), claveEntidad);
    const opId = this.generarIdMensaje();

    const mensajeOperacion = crearMensajeEdicionOperacion({
      idMensaje: opId,
      operationId: opId,
      projectId: this.projectId,
      clientId: this.clientId,
      clock: metadatos.clock,
      revision: metadatos.revision,
      actualizadoEn: metadatos.actualizado_en,
      operacion,
      resumen,
    });

    const politicaOperacion = resolverPoliticaTopicoProyectoV2(this.topicos.documentOps);
    return this.mqtt.publish(
      this.topicos.documentOps as MqttTopic,
      mensajeOperacion,
      politicaOperacion ?? undefined
    );
  }

  public notificarCambioLocal(documento: HilesModelDocument, resumen?: string): boolean {
    if (this.suprimiendoCambioRemoto) {
      return false;
    }

    if (this.debounceMs <= 0) {
      return this.publicarDiferenciasLocales(documento, resumen);
    }

    this.borradorPendiente = {
      documento: clonarDocumentoHiles(documento),
      resumen,
    };

    if (this.timerDebounce !== null) {
      clearTimeout(this.timerDebounce);
    }

    this.timerDebounce = setTimeout(() => {
      this.timerDebounce = null;
      const pendiente = this.borradorPendiente;
      this.borradorPendiente = null;
      if (pendiente) {
        this.publicarDiferenciasLocales(pendiente.documento, pendiente.resumen);
      }
    }, this.debounceMs);

    return true;
  }

  public publicarSnapshotInmediato(documento: HilesModelDocument, resumen?: string): boolean {
    if (this.suprimiendoCambioRemoto) {
      return false;
    }
    this.limpiarDebounce();
    this.documentoActual = clonarDocumentoHiles(documento);

    const metadatos = this.convergencia.prepararPublicacionLocal(this.ahoraIso(), 'document');
    const opId = this.generarIdMensaje();
    const mensajeEstado = crearMensajeEdicionEstado({
      idMensaje: opId,
      operationId: opId,
      projectId: this.projectId,
      clientId: this.clientId,
      clock: metadatos.clock,
      revision: metadatos.revision,
      actualizadoEn: metadatos.actualizado_en,
      documento: this.documentoActual,
      resumen,
    });

    const politicaEstado = resolverPoliticaTopicoProyectoV2(this.topicos.documentSnapshot);
    return this.mqtt.publish(
      this.topicos.documentSnapshot as MqttTopic,
      mensajeEstado,
      politicaEstado ?? undefined
    );
  }

  public publicarPresencia(conectado: boolean, vistaActiva?: string | null): boolean {
    const metadatos = this.convergencia.prepararPublicacionLocal(
      this.ahoraIso(),
      `presence:${this.clientId}`
    );
    const opId = this.generarIdMensaje();
    const mensaje = crearMensajePresenciaProyecto({
      idMensaje: opId,
      operationId: opId,
      projectId: this.projectId,
      clientId: this.clientId,
      usuario: this.usuario,
      color: this.color,
      conectado,
      clock: metadatos.clock,
      revision: metadatos.revision,
      vistaActiva,
      ttlMs: this.presenciaTtlMs,
      actualizadoEn: metadatos.actualizado_en,
    });

    const politica = resolverPoliticaTopicoProyectoV2(this.topicos.presence);
    return this.mqtt.publish(
      this.topicos.presence as MqttTopic,
      mensaje,
      politica ?? undefined
    );
  }

  public publicarCursor(x: number, y: number, vistaActiva?: string | null): boolean {
    const metadatos = this.convergencia.prepararPublicacionLocal(
      this.ahoraIso(),
      `cursor:${this.clientId}`
    );
    const opId = this.generarIdMensaje();
    const mensaje = crearMensajeCursorProyecto({
      idMensaje: opId,
      operationId: opId,
      projectId: this.projectId,
      clientId: this.clientId,
      usuario: this.usuario,
      color: this.color,
      x,
      y,
      vistaActiva,
      clock: metadatos.clock,
      actualizadoEn: metadatos.actualizado_en,
    });

    const politica = resolverPoliticaTopicoProyectoV2(this.topicos.cursor);
    return this.mqtt.publish(
      this.topicos.cursor as MqttTopic,
      mensaje,
      politica ?? undefined
    );
  }

  public expirarColaboradoresInactivos(ahoraMs = Date.now()): ColaboradorProyectoV2[] {
    let huboCambios = false;
    for (const [clientId, colab] of this.colaboradores.entries()) {
      if (!colab.conectado) continue;
      const marcaMs = Date.parse(colab.actualizadoEn);
      if (Number.isFinite(marcaMs) && ahoraMs - marcaMs > colab.ttlMs) {
        this.colaboradores.set(clientId, {
          ...colab,
          conectado: false,
        });
        this.cursoresRemotos.delete(clientId);
        huboCambios = true;
      }
    }
    if (huboCambios) {
      this.emitirPresencia();
      this.emitirCursores();
    }
    return this.obtenerColaboradores();
  }

  public obtenerColaboradores(): ColaboradorProyectoV2[] {
    return Array.from(this.colaboradores.values());
  }

  public obtenerCursoresRemotos(): CursorRemotoProyectoV2[] {
    return Array.from(this.cursoresRemotos.values());
  }

  public onRemoteDocument(
    listener: (evento: EventoDocumentoRemotoProyectoV2) => void
  ): () => void {
    this.listenersDocumentoRemoto.add(listener);
    return () => this.listenersDocumentoRemoto.delete(listener);
  }

  public onRemoteOperation(
    listener: (mensaje: MensajeProyectoEdicionOperacion) => void
  ): () => void {
    this.listenersOperacionRemota.add(listener);
    return () => this.listenersOperacionRemota.delete(listener);
  }

  public onPresenceChange(
    listener: (colaboradores: ColaboradorProyectoV2[]) => void
  ): () => void {
    this.listenersPresencia.add(listener);
    return () => this.listenersPresencia.delete(listener);
  }

  public onRemoteCursor(
    listener: (cursores: CursorRemotoProyectoV2[]) => void
  ): () => void {
    this.listenersCursor.add(listener);
    return () => this.listenersCursor.delete(listener);
  }

  public onMensajeDescartado(
    listener: (decision: DecisionConvergenciaProyectoV2 & { aplicar: false }) => void
  ): () => void {
    this.listenersDescarte.add(listener);
    return () => this.listenersDescarte.delete(listener);
  }

  private publicarDiferenciasLocales(documento: HilesModelDocument, resumen?: string): boolean {
    const operaciones = calcularOperacionesEntreDocumentos(this.documentoActual, documento);
    this.documentoActual = clonarDocumentoHiles(documento);

    if (operaciones.length === 0) {
      return false;
    }

    let exito = true;
    const politicaOperacion = resolverPoliticaTopicoProyectoV2(this.topicos.documentOps);
    for (const operacion of operaciones) {
      const claveEntidad = claveEntidadOperacionProyectoV2(operacion);
      const metadatos = this.convergencia.prepararPublicacionLocal(this.ahoraIso(), claveEntidad);
      const opId = this.generarIdMensaje();
      const mensajeOperacion = crearMensajeEdicionOperacion({
        idMensaje: opId,
        operationId: opId,
        projectId: this.projectId,
        clientId: this.clientId,
        clock: metadatos.clock,
        revision: metadatos.revision,
        actualizadoEn: metadatos.actualizado_en,
        operacion,
        resumen,
      });

      const okOp = this.mqtt.publish(
        this.topicos.documentOps as MqttTopic,
        mensajeOperacion,
        politicaOperacion ?? undefined
      );
      exito = exito && okOp;
    }

    return exito;
  }

  private configurarLastWillPresencia(): void {
    if (!this.mqtt.setWillMessage) return;
    const opId = `will-${this.clientId}-${Date.now()}`;
    const mensajeWill = crearMensajePresenciaProyecto({
      idMensaje: opId,
      operationId: opId,
      projectId: this.projectId,
      clientId: this.clientId,
      usuario: this.usuario,
      color: this.color,
      conectado: false,
      clock: Math.max(1, this.convergencia.obtenerReloj() + 1),
      vistaActiva: null,
      ttlMs: this.presenciaTtlMs,
      actualizadoEn: this.ahoraIso(),
    });
    const politica = resolverPoliticaTopicoProyectoV2(this.topicos.presence);
    this.mqtt.setWillMessage({
      topic: this.topicos.presence,
      payload: mensajeWill,
      qos: politica?.qos ?? 1,
      retain: politica?.retain ?? true,
    });
  }

  private suscribirTopicosProyecto(): void {
    this.mqtt.subscribe(this.topicos.documentSnapshot as MqttTopic);
    this.mqtt.subscribe(this.topicos.documentOps as MqttTopic);
    this.mqtt.subscribe(this.topicos.presence as MqttTopic);
    this.mqtt.subscribe(this.topicos.cursor as MqttTopic);
  }

  private desuscribirTopicosProyecto(): void {
    this.mqtt.unsubscribe(this.topicos.documentSnapshot as MqttTopic);
    this.mqtt.unsubscribe(this.topicos.documentOps as MqttTopic);
    this.mqtt.unsubscribe(this.topicos.presence as MqttTopic);
    this.mqtt.unsubscribe(this.topicos.cursor as MqttTopic);
  }

  private procesarMensajeMqtt(topic: string, payload: unknown): void {
    const parseado = parsearTopicoProyectoV2(topic, this.prefijoTopicos);
    if (!parseado || parseado.projectId !== this.projectId) {
      return;
    }

    const validacion = validarMensajeProyectoPorSufijo(parseado.sufijo, payload);
    if (!validacion.ok || !validacion.mensaje) {
      return;
    }

    if (parseado.sufijo === 'presence') {
      const presencia = validacion.mensaje as MensajeProyectoPresencia;
      if (presencia.proyecto_id !== this.projectId || presencia.client_id === this.clientId) {
        return;
      }

      if (!presencia.conectado) {
        this.colaboradores.set(presencia.client_id, {
          clientId: presencia.client_id,
          usuario: presencia.usuario,
          color: presencia.color ?? elegirColorDeterminista(presencia.client_id),
          conectado: false,
          actualizadoEn: presencia.actualizado_en,
          ttlMs: presencia.ttl_ms,
          vistaActiva: presencia.vista_activa ?? null,
        });
        this.cursoresRemotos.delete(presencia.client_id);
        this.emitirCursores();
      } else {
        this.colaboradores.set(presencia.client_id, {
          clientId: presencia.client_id,
          usuario: presencia.usuario,
          color: presencia.color ?? elegirColorDeterminista(presencia.client_id),
          conectado: true,
          actualizadoEn: presencia.actualizado_en,
          ttlMs: presencia.ttl_ms,
          vistaActiva: presencia.vista_activa ?? null,
        });
      }
      this.emitirPresencia();
      return;
    }

    if (parseado.sufijo === 'cursor') {
      const cursor = validacion.mensaje as MensajeProyectoCursor;
      if (cursor.proyecto_id !== this.projectId || cursor.client_id === this.clientId) {
        return;
      }
      this.cursoresRemotos.set(cursor.client_id, {
        clientId: cursor.client_id,
        usuario: cursor.usuario,
        color: cursor.color ?? elegirColorDeterminista(cursor.client_id),
        x: cursor.x,
        y: cursor.y,
        vistaActiva: cursor.vista_activa ?? null,
        clock: cursor.clock,
        actualizadoEn: cursor.actualizado_en,
      });
      this.emitirCursores();
      return;
    }

    if (parseado.sufijo === 'document/snapshot' || parseado.sufijo === 'document/ops') {
      const mensajeEdicion = validacion.mensaje as
        | MensajeProyectoEdicionEstado
        | MensajeProyectoEdicionOperacion;
      const decision = this.convergencia.evaluarMensajeRemoto(mensajeEdicion);
      if (!decision.aplicar) {
        this.listenersDescarte.forEach((listener) => listener(decision));
        return;
      }

      let documentoResultante: HilesModelDocument;
      let operacionAplicada: OperacionIncrementalProyectoV2 | undefined;

      if (parseado.sufijo === 'document/snapshot') {
        const msgSnapshot = mensajeEdicion as MensajeProyectoEdicionEstado;
        documentoResultante = clonarDocumentoHiles(msgSnapshot.documento);
        this.documentoActual = documentoResultante;
      } else {
        const msgOp = mensajeEdicion as MensajeProyectoEdicionOperacion;
        operacionAplicada = msgOp.operacion;
        if (msgOp.operacion) {
          const base =
            this.documentoActual ??
            crearDocumentoBaseVacio(this.projectId, msgOp.actualizado_en);
          documentoResultante = aplicarOperacionIncrementalADocumento(base, msgOp.operacion);
          this.documentoActual = documentoResultante;
        } else if (msgOp.documento) {
          documentoResultante = clonarDocumentoHiles(msgOp.documento);
          this.documentoActual = documentoResultante;
        } else {
          return;
        }
        this.listenersOperacionRemota.forEach((listener) => listener(msgOp));
      }

      this.ejecutarConGuardiaRemota(() => {
        const evento: EventoDocumentoRemotoProyectoV2 = {
          projectId: this.projectId,
          documento: clonarDocumentoHiles(documentoResultante),
          clock: decision.clock,
          revision: decision.revision,
          clientId: decision.client_id,
          actualizadoEn: decision.actualizado_en,
          origenTopico: parseado.sufijo as 'document/snapshot' | 'document/ops',
          operacion: operacionAplicada,
          resumen: mensajeEdicion.resumen,
        };
        this.listenersDocumentoRemoto.forEach((listener) => listener(evento));
      });
    }
  }

  private emitirPresencia(): void {
    const lista = this.obtenerColaboradores();
    this.listenersPresencia.forEach((listener) => listener(lista));
  }

  private emitirCursores(): void {
    const lista = this.obtenerCursoresRemotos();
    this.listenersCursor.forEach((listener) => listener(lista));
  }

  private limpiarDebounce(): void {
    if (this.timerDebounce !== null) {
      clearTimeout(this.timerDebounce);
      this.timerDebounce = null;
    }
    this.borradorPendiente = null;
  }
}
