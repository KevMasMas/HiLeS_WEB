import mqtt, { type IClientOptions, type MqttClient } from 'mqtt';
import { getMqttConfig, MQTT_MAX_PAYLOAD_BYTES } from '../../services/mqtt/config';
import type { OpcionesPublicacionV3, TransporteWorkerV3 } from '../../services/distributed/BrowserWorker';

export interface UltimaVoluntadV3 {
  topic: string;
  payload: string;
}

/**
 * Conexión MQTT exclusiva del plano de ejecución distribuida v3.
 *
 * Es independiente del cliente de colaboración: así el Last Will retenido
 * `offline` describe a este ejecutor y los mensajes v3 no pasan por el
 * validador de topics v1/v2 de la colaboración.
 */
export class TransporteMqttDistribuido implements TransporteWorkerV3 {
  private cliente: MqttClient | null = null;
  private readonly filtros = new Map<string, number>();
  private readonly handlers = new Set<(topic: string, raw: string) => void>();
  private readonly conexion = new Set<(conectado: boolean) => void>();
  private ultimaVoluntad: UltimaVoluntadV3 | null = null;

  get conectado(): boolean {
    return Boolean(this.cliente?.connected);
  }

  /** Cambiar el Last Will exige reconectar para que el broker lo registre. */
  conectar(ultimaVoluntad: UltimaVoluntadV3 | null = null): void {
    this.ultimaVoluntad = ultimaVoluntad;
    this.cliente?.end(true);
    const config = getMqttConfig();
    const opciones: IClientOptions = {
      clientId: `hiles-v3-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 4000,
      connectTimeout: 15000,
      protocolVersion: 4,
      username: config.username,
      password: config.password,
      ...(this.ultimaVoluntad
        ? { will: { topic: this.ultimaVoluntad.topic, payload: this.ultimaVoluntad.payload, qos: 1, retain: true } }
        : {}),
    };
    const cliente = mqtt.connect(config.webSocketUrl, opciones);
    this.cliente = cliente;
    cliente.on('connect', () => {
      if (this.cliente !== cliente) return;
      this.filtros.forEach((_cantidad, filtro) => cliente.subscribe(filtro, { qos: 1 }));
      this.conexion.forEach((handler) => handler(true));
    });
    const caida = () => {
      if (this.cliente !== cliente) return;
      this.conexion.forEach((handler) => handler(false));
    };
    cliente.on('close', caida);
    cliente.on('offline', caida);
    cliente.on('message', (topic, payload) => {
      if (this.cliente !== cliente) return;
      const raw = payload.toString();
      this.handlers.forEach((handler) => handler(topic, raw));
    });
  }

  desconectar(): void {
    const cliente = this.cliente;
    this.cliente = null;
    // Cierre limpio: el broker no publica el Last Will.
    cliente?.end(false);
    this.conexion.forEach((handler) => handler(false));
  }

  publicar(topic: string, payload: string, opciones: OpcionesPublicacionV3): boolean {
    if (!this.cliente?.connected) return false;
    if (new TextEncoder().encode(payload).byteLength > MQTT_MAX_PAYLOAD_BYTES) return false;
    this.cliente.publish(topic, payload, { qos: opciones.qos, retain: opciones.retain });
    return true;
  }

  suscribir(topic: string): void {
    const cantidad = this.filtros.get(topic) ?? 0;
    this.filtros.set(topic, cantidad + 1);
    if (cantidad === 0 && this.cliente?.connected) this.cliente.subscribe(topic, { qos: 1 });
  }

  desuscribir(topic: string): void {
    const cantidad = this.filtros.get(topic) ?? 0;
    if (cantidad > 1) {
      this.filtros.set(topic, cantidad - 1);
      return;
    }
    this.filtros.delete(topic);
    if (this.cliente?.connected) this.cliente.unsubscribe(topic);
  }

  onMensaje(handler: (topic: string, raw: string) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConexion(handler: (conectado: boolean) => void): () => void {
    this.conexion.add(handler);
    return () => this.conexion.delete(handler);
  }
}
