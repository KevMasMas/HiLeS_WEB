import { MQTT_IR_VERSION, MQTT_TOPICS, type MqttConnectionStatus, type MqttTopic } from './config';
import {
  ControlSecuenciaRemota,
  type AccionSimulacion,
  type MensajeModeloConfirmacion,
  type MensajeErrorMqtt,
  type MensajeMqtt,
  type MensajeSimulacionEstado,
  type ModeloEjecutableMqtt,
  type ValorMensajeMqtt,
} from './messages';

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

/**
 * Cliente de aplicación para controlar el motor de la Pico.
 *
 * No conoce React ni el canvas. Su única responsabilidad es publicar comandos
 * con la sesión activa y filtrar los estados oficiales recibidos por MQTT.
 */
export class RemoteExecutionClient {
  private readonly mqtt: ClienteMqttRemoto;
  private readonly idFactory: () => string;
  private readonly secuencias = new ControlSecuenciaRemota();
  private readonly listeners = new Set<EventoRemotoHandler>();
  private unsubscribeMessage: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private sesion: SesionRemota | null = null;

  constructor(mqtt: ClienteMqttRemoto, idFactory: () => string = crearIdMensaje) {
    this.mqtt = mqtt;
    this.idFactory = idFactory;
  }

  public start(): void {
    if (!this.unsubscribeMessage) {
      this.unsubscribeMessage = this.mqtt.onMessage((topic, payload) => this.procesarMensaje(topic, payload));
      this.unsubscribeStatus = this.mqtt.onStatusChange((estado) => this.emitir({ tipo: 'estado_mqtt', estado }));
      this.mqtt.subscribe(MQTT_TOPICS.MODELO_CONFIRMACION);
      this.mqtt.subscribe(MQTT_TOPICS.SIMULACION_ESTADO);
      this.mqtt.subscribe(MQTT_TOPICS.ERROR);
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
    this.mqtt.unsubscribe(MQTT_TOPICS.MODELO_CONFIRMACION);
    this.mqtt.unsubscribe(MQTT_TOPICS.SIMULACION_ESTADO);
    this.mqtt.unsubscribe(MQTT_TOPICS.ERROR);
  }

  public onEvent(listener: EventoRemotoHandler): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public activarSesion(modeloId: string, version: number): SesionRemota {
    const modeloNormalizado = modeloId.trim();
    if (!modeloNormalizado) throw new Error('El identificador del modelo no puede estar vacío.');
    if (!Number.isInteger(version) || version < 1) throw new Error('La versión debe ser un entero positivo.');
    this.sesion = { modeloId: modeloNormalizado, version };
    this.secuencias.activarModelo(modeloNormalizado, version);
    return this.sesion;
  }

  public obtenerSesion(): SesionRemota | null {
    return this.sesion ? { ...this.sesion } : null;
  }

  public cargarModelo(modelo: ModeloEjecutableMqtt): boolean {
    const sesion = this.requerirSesion();
    return this.mqtt.publish(MQTT_TOPICS.MODELO_CARGAR, {
      modelo_id: sesion.modeloId,
      version: sesion.version,
      ir_version: MQTT_IR_VERSION,
      modelo,
      id_mensaje: this.idFactory(),
    });
  }

  public enviarComando(accion: AccionSimulacion): boolean {
    const sesion = this.requerirSesion();
    return this.mqtt.publish(MQTT_TOPICS.SIMULACION_COMANDO, {
      accion,
      modelo_id: sesion.modeloId,
      version: sesion.version,
      id_mensaje: this.idFactory(),
    });
  }

  public establecerEntrada(servicioId: string, valor: ValorMensajeMqtt): boolean {
    const sesion = this.requerirSesion();
    return this.mqtt.publish(MQTT_TOPICS.ENTRADA_ESTABLECER, {
      servicio_id: servicioId,
      valor,
      modelo_id: sesion.modeloId,
      version: sesion.version,
      id_mensaje: this.idFactory(),
    });
  }

  private requerirSesion(): SesionRemota {
    if (!this.sesion) throw new Error('Primero debes unirte a una sesión remota.');
    return this.sesion;
  }

  private procesarMensaje(topic: MqttTopic, payload: MensajeMqtt): void {
    if (topic === MQTT_TOPICS.MODELO_CONFIRMACION) {
      const confirmacion = payload as MensajeModeloConfirmacion;
      if (this.perteneceALaSesion(confirmacion.modelo_id, confirmacion.version)) {
        // Una carga aceptada reinicia la secuencia del motor, incluso cuando
        // otro navegador de la misma sesión fue quien publicó el modelo.
        if (confirmacion.aceptado) {
          this.secuencias.activarModelo(confirmacion.modelo_id, confirmacion.version);
        }
        this.emitir({ tipo: 'confirmacion', confirmacion });
      }
      return;
    }
    if (topic === MQTT_TOPICS.ERROR) {
      this.emitir({ tipo: 'error_remoto', error: payload as MensajeErrorMqtt });
      return;
    }
    if (topic !== MQTT_TOPICS.SIMULACION_ESTADO) return;
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
