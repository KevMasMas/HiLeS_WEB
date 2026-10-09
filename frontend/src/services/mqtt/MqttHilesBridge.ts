import type { ResultadoInyeccion, ServicioInyectable, ValorRuntime } from '../../engine/tipos';
import { MQTT_TOPICS, type MqttTopic } from './config';
import type {
  MensajeEntradaEstablecer,
  MensajeErrorMqtt,
  MensajeMqtt,
  MensajeSalidaHiles,
} from './messages';

export interface ClienteMqttPuente {
  onMessage: (listener: (topic: MqttTopic, payload: MensajeMqtt) => void) => () => void;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  publish: (topic: string, payload: unknown) => boolean;
}

export interface GatewayHilesService {
  obtenerServicios: () => ServicioInyectable[];
  inyectarEntrada: (servicioId: string, valor: ValorRuntime) => ResultadoInyeccion;
}

export interface EventoPuenteMqtt {
  nivel: 'info' | 'error';
  mensaje: string;
  topic: MqttTopic;
  idMensaje?: string;
}

export type EventoPuenteHandler = (evento: EventoPuenteMqtt) => void;

const valorCompatibleConServicio = (servicio: ServicioInyectable, valor: ValorRuntime): boolean => {
  switch (servicio.tipoDato) {
    case 'boolean':
      return typeof valor === 'boolean';
    case 'integer':
      return typeof valor === 'number' && Number.isInteger(valor);
    case 'real':
      return typeof valor === 'number' && Number.isFinite(valor);
    case 'string':
      return typeof valor === 'string';
    case 'vector':
      return false;
    default:
      return typeof valor === 'boolean' || typeof valor === 'number' || typeof valor === 'string';
  }
};

/**
 * Frontera entre MQTT y el motor HiLeS.
 *
 * MQTT nunca conoce la implementación interna del motor: solo consulta los
 * Services publicados e inyecta valores mediante su interfaz pública.
 */
export class MqttHilesBridge {
  private unsubscribeMessage: (() => void) | null = null;
  private readonly eventListeners = new Set<EventoPuenteHandler>();
  private readonly mqtt: ClienteMqttPuente;
  private readonly hiles: GatewayHilesService;

  constructor(mqtt: ClienteMqttPuente, hiles: GatewayHilesService) {
    this.mqtt = mqtt;
    this.hiles = hiles;
  }

  public start(): void {
    if (this.unsubscribeMessage) return;
    this.unsubscribeMessage = this.mqtt.onMessage((topic, payload) => {
      if (topic === MQTT_TOPICS.ENTRADA_ESTABLECER) {
        this.procesarEntrada(payload as MensajeEntradaEstablecer);
      }
    });
    this.mqtt.subscribe(MQTT_TOPICS.ENTRADA_ESTABLECER);
  }

  public stop(): void {
    if (!this.unsubscribeMessage) return;
    this.unsubscribeMessage();
    this.unsubscribeMessage = null;
    this.mqtt.unsubscribe(MQTT_TOPICS.ENTRADA_ESTABLECER);
  }

  public onEvent(listener: EventoPuenteHandler): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public publicarSalida(servicioId: string, valor: ValorRuntime, idMensaje = `salida-${Date.now()}`): boolean {
    const mensaje: MensajeSalidaHiles = {
      servicio_id: servicioId,
      valor,
      id_mensaje: idMensaje,
    };
    const publicado = this.mqtt.publish(MQTT_TOPICS.SALIDA, mensaje);
    this.notify({
      nivel: publicado ? 'info' : 'error',
      topic: MQTT_TOPICS.SALIDA,
      idMensaje,
      mensaje: publicado
        ? `La salida del Service ${servicioId} se publicó por MQTT.`
        : `No fue posible publicar la salida del Service ${servicioId}: MQTT no está conectado.`,
    });
    return publicado;
  }

  private procesarEntrada(mensaje: MensajeEntradaEstablecer): void {
    const servicio = this.hiles.obtenerServicios().find(({ id }) => id === mensaje.servicio_id);
    if (!servicio) {
      this.reportarError(
        `No existe un Service HiLeS con id ${mensaje.servicio_id}.`,
        mensaje.id_mensaje,
      );
      return;
    }

    if (!valorCompatibleConServicio(servicio, mensaje.valor)) {
      this.reportarError(
        `El valor recibido no es compatible con el tipo ${servicio.tipoDato} del Service ${servicio.nombre}.`,
        mensaje.id_mensaje,
      );
      return;
    }

    const resultado = this.hiles.inyectarEntrada(servicio.id, mensaje.valor);
    if (!resultado.exito) {
      this.reportarError(resultado.mensaje, mensaje.id_mensaje);
      return;
    }

    this.notify({
      nivel: 'info',
      topic: MQTT_TOPICS.ENTRADA_ESTABLECER,
      idMensaje: mensaje.id_mensaje,
      mensaje: `Entrada MQTT aplicada al Service ${servicio.nombre}: ${String(mensaje.valor)}.`,
    });
  }

  private reportarError(mensaje: string, idMensaje: string): void {
    const payload: MensajeErrorMqtt = {
      codigo: 'ENTRADA_HILES_RECHAZADA',
      mensaje,
      id_mensaje: idMensaje,
    };
    this.mqtt.publish(MQTT_TOPICS.ERROR, payload);
    this.notify({
      nivel: 'error',
      topic: MQTT_TOPICS.ENTRADA_ESTABLECER,
      idMensaje,
      mensaje,
    });
  }

  private notify(evento: EventoPuenteMqtt): void {
    this.eventListeners.forEach((listener) => listener(evento));
  }
}
