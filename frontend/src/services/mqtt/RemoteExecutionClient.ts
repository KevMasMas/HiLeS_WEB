import {
  MQTT_IR_VERSION,
  MQTT_TOPICS,
  type MqttConnectionStatus,
  type MqttIrVersion,
  type MqttTopic,
} from './config';
import {
  ControlSecuenciaRemota,
  type AccionSimulacion,
  type MensajeErrorMqtt,
  type MensajeModeloConfirmacion,
  type MensajeMqtt,
  type MensajeSimulacionEstado,
  type ModeloEjecutableMqtt,
  type ValorMensajeMqtt,
} from './messages';
import {
  construirTopicosProyectoV2,
  type TopicosProyectoV2,
} from '../projects/projectTopics';

export interface ClienteMqttRemoto {
  getStatus: () => MqttConnectionStatus;
  onStatusChange: (listener: (status: MqttConnectionStatus) => void) => () => void;
  onMessage: (listener: (topic: MqttTopic, payload: MensajeMqtt) => void) => () => void;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  publish: (topic: string, payload: unknown) => boolean;
  connect: () => void;
}

export interface SesionRemota {
  modeloId: string;
  version: number;
  projectId?: string;
}

export type EventoEjecucionRemota =
  | { tipo: 'estado_mqtt'; estado: MqttConnectionStatus }
  | { tipo: 'confirmacion'; confirmacion: MensajeModeloConfirmacion }
  | { tipo: 'instantanea'; instantanea: MensajeSimulacionEstado }
  | { tipo: 'error_remoto'; error: MensajeErrorMqtt }
  | { tipo: 'descartada'; motivo: 'sin_sesion' | 'modelo_distinto' | 'version_distinta' | 'secuencia_antigua' };

type EventoRemotoHandler = (evento: EventoEjecucionRemota) => void;

const crearIdMensaje = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `web-${uuid}` : `web-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const inferirVersionIr = (
  modelo: ModeloEjecutableMqtt,
  versionExplicita?: MqttIrVersion,
): MqttIrVersion => {
  if (versionExplicita === 1 || versionExplicita === 2) {
    return versionExplicita;
  }
  if (
    typeof modelo === 'object' &&
    modelo !== null &&
    'ir_version' in modelo &&
    modelo.ir_version === 2
  ) {
    return 2;
  }
  return MQTT_IR_VERSION;
};

/**
 * Cliente de aplicación para controlar el motor de la Pico.
 *
 * No conoce React ni el canvas. Su única responsabilidad es publicar comandos
 * con la sesión activa y filtrar los estados oficiales recibidos por MQTT.
 * Soporta tanto los topics legados de IR v1 como los topics por proyecto v2.
 */
export class RemoteExecutionClient {
  private readonly mqtt: ClienteMqttRemoto;
  private readonly idFactory: () => string;
  private readonly secuencias = new ControlSecuenciaRemota();
  private readonly listeners = new Set<EventoRemotoHandler>();
  private unsubscribeMessage: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private sesion: SesionRemota | null = null;
  private topicosProyecto: TopicosProyectoV2 | null = null;

  constructor(mqtt: ClienteMqttRemoto, idFactory: () => string = crearIdMensaje) {
    this.mqtt = mqtt;
    this.idFactory = idFactory;
  }

  public start(): void {
    if (!this.unsubscribeMessage) {
      this.unsubscribeMessage = this.mqtt.onMessage((topic, payload) => this.procesarMensaje(topic, payload));
      this.unsubscribeStatus = this.mqtt.onStatusChange((estado) => this.emitir({ tipo: 'estado_mqtt', estado }));
      for (const topic of this.obtenerTopicosSuscripcion()) {
        this.mqtt.subscribe(topic);
      }
    }
    this.emitir({ tipo: 'estado_mqtt', estado: this.mqtt.getStatus() });
    // Volver a pulsar «Unirse» también debe reintentar la conexión si el
    // broker estaba apagado o la primera conexión falló.
    this.mqtt.connect();
  }

  public stop(): void {
    this.unsubscribeMessage?.();
    this.unsubscribeStatus?.();
    this.unsubscribeMessage = null;
    this.unsubscribeStatus = null;
    for (const topic of this.obtenerTopicosSuscripcion()) {
      this.mqtt.unsubscribe(topic);
    }
  }

  public onEvent(listener: EventoRemotoHandler): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public activarProyecto(projectId: string | null): void {
    const estabaActivo = Boolean(this.unsubscribeMessage);
    if (estabaActivo) {
      for (const topic of this.obtenerTopicosSuscripcion()) {
        this.mqtt.unsubscribe(topic);
      }
    }
    this.topicosProyecto = projectId ? construirTopicosProyectoV2(projectId) : null;
    if (this.sesion) {
      this.sesion = {
        ...this.sesion,
        ...(this.topicosProyecto ? { projectId: this.topicosProyecto.projectId } : { projectId: undefined }),
      };
    }
    if (estabaActivo) {
      for (const topic of this.obtenerTopicosSuscripcion()) {
        this.mqtt.subscribe(topic);
      }
    }
  }

  public activarSesion(modeloId: string, version: number, projectId?: string): SesionRemota {
    const modeloNormalizado = modeloId.trim();
    if (!modeloNormalizado) throw new Error('El identificador del modelo no puede estar vacío.');
    if (!Number.isInteger(version) || version < 1) throw new Error('La versión debe ser un entero positivo.');
    if (projectId !== undefined) {
      this.activarProyecto(projectId);
    }
    this.sesion = {
      modeloId: modeloNormalizado,
      version,
      ...(this.topicosProyecto ? { projectId: this.topicosProyecto.projectId } : {}),
    };
    this.secuencias.activarModelo(modeloNormalizado, version);
    return this.sesion;
  }

  public obtenerSesion(): SesionRemota | null {
    return this.sesion ? { ...this.sesion } : null;
  }

  public cargarModelo(
    modelo: ModeloEjecutableMqtt,
    opciones: { irVersion?: MqttIrVersion } = {},
  ): boolean {
    const sesion = this.requerirSesion();
    const irVersion = inferirVersionIr(modelo, opciones.irVersion);
    const topic = this.topicosProyecto?.simulacionModeloCargar ?? MQTT_TOPICS.MODELO_CARGAR;
    return this.mqtt.publish(topic, {
      modelo_id: sesion.modeloId,
      version: sesion.version,
      ir_version: irVersion,
      modelo,
      id_mensaje: this.idFactory(),
    });
  }

  public enviarComando(accion: AccionSimulacion): boolean {
    const sesion = this.requerirSesion();
    const topic = this.topicosProyecto?.simulacionComando ?? MQTT_TOPICS.SIMULACION_COMANDO;
    return this.mqtt.publish(topic, {
      accion,
      modelo_id: sesion.modeloId,
      version: sesion.version,
      id_mensaje: this.idFactory(),
    });
  }

  public establecerEntrada(servicioId: string, valor: ValorMensajeMqtt): boolean {
    const sesion = this.requerirSesion();
    const topic = this.topicosProyecto?.simulacionEntradaEstablecer ?? MQTT_TOPICS.ENTRADA_ESTABLECER;
    return this.mqtt.publish(topic, {
      servicio_id: servicioId,
      valor,
      modelo_id: sesion.modeloId,
      version: sesion.version,
      id_mensaje: this.idFactory(),
    });
  }

  private obtenerTopicosSuscripcion(): string[] {
    if (this.topicosProyecto) {
      return [
        this.topicosProyecto.simulacionModeloConfirmacion,
        this.topicosProyecto.simulacionEstado,
        this.topicosProyecto.error,
      ];
    }
    return [
      MQTT_TOPICS.MODELO_CONFIRMACION,
      MQTT_TOPICS.SIMULACION_ESTADO,
      MQTT_TOPICS.ERROR,
    ];
  }

  private requerirSesion(): SesionRemota {
    if (!this.sesion) throw new Error('Primero debes unirte a una sesión remota.');
    return this.sesion;
  }

  private procesarMensaje(topic: MqttTopic, payload: MensajeMqtt): void {
    const topicConfirmacion = this.topicosProyecto?.simulacionModeloConfirmacion ?? MQTT_TOPICS.MODELO_CONFIRMACION;
    const topicError = this.topicosProyecto?.error ?? MQTT_TOPICS.ERROR;
    const topicEstado = this.topicosProyecto?.simulacionEstado ?? MQTT_TOPICS.SIMULACION_ESTADO;

    if (topic === topicConfirmacion || topic === MQTT_TOPICS.MODELO_CONFIRMACION) {
      const confirmacion = payload as MensajeModeloConfirmacion;
      if (this.perteneceALaSesion(confirmacion.modelo_id, confirmacion.version)) {
        if (confirmacion.aceptado) {
          this.secuencias.activarModelo(confirmacion.modelo_id, confirmacion.version);
        }
        this.emitir({ tipo: 'confirmacion', confirmacion });
      }
      return;
    }
    if (topic === topicError || topic === MQTT_TOPICS.ERROR) {
      this.emitir({ tipo: 'error_remoto', error: payload as MensajeErrorMqtt });
      return;
    }
    if (topic !== topicEstado && topic !== MQTT_TOPICS.SIMULACION_ESTADO) return;
    const instantanea = payload as MensajeSimulacionEstado;
    const decision = this.secuencias.evaluar(instantanea);
    if (decision.aplicar) this.emitir({ tipo: 'instantanea', instantanea });
    else this.emitir({ tipo: 'descartada', motivo: decision.motivo });
  }

  private perteneceALaSesion(modeloId: string, version: number): boolean {
    return this.sesion?.modeloId === modeloId && this.sesion.version === version;
  }

  private emitir(evento: EventoEjecucionRemota): void {
    this.listeners.forEach((listener) => listener(evento));
  }
}
