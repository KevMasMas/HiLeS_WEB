import mqtt, { type IClientOptions, type MqttClient as BrowserMqttClient } from 'mqtt';
import {
  getMqttConfig,
  MQTT_MAX_PAYLOAD_BYTES,
  MQTT_TOPIC_POLICIES,
  MQTT_TOPICS,
  type MqttConnectionStatus,
  type MqttTopic,
} from './config';
import { validarMensajeMqtt, type AccionLed, type MensajeMqtt } from './messages';

export type MqttMessageHandler = (topic: MqttTopic, payload: MensajeMqtt) => void;
export type MqttStatusHandler = (status: MqttConnectionStatus) => void;
export interface MqttValidationError {
  topic: string;
  error: string;
  rawPayload: string;
}
export type MqttValidationErrorHandler = (validationError: MqttValidationError) => void;

class MqttBrowserClient {
  private client: BrowserMqttClient | null = null;
  private status: MqttConnectionStatus = 'DISCONNECTED';
  private readonly statusListeners = new Set<MqttStatusHandler>();
  private readonly messageListeners = new Set<MqttMessageHandler>();
  private readonly validationErrorListeners = new Set<MqttValidationErrorHandler>();
  private readonly subscriptions = new Set<string>();

  public getStatus(): MqttConnectionStatus {
    return this.status;
  }

  public onStatusChange(listener: MqttStatusHandler): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public onMessage(listener: MqttMessageHandler): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onValidationError(listener: MqttValidationErrorHandler): () => void {
    this.validationErrorListeners.add(listener);
    return () => this.validationErrorListeners.delete(listener);
  }

  private notifyStatus(nextStatus: MqttConnectionStatus): void {
    this.status = nextStatus;
    this.statusListeners.forEach((listener) => listener(nextStatus));
  }

  private notifyMessage(topic: MqttTopic, payload: MensajeMqtt): void {
    this.messageListeners.forEach((listener) => listener(topic, payload));
  }

  private notifyValidationError(validationError: MqttValidationError): void {
    this.validationErrorListeners.forEach((listener) => listener(validationError));
  }

  public connect(): void {
    if (this.status === 'CONNECTING' || this.client?.connected) {
      return;
    }

    this.client?.end(true);

    const config = getMqttConfig();
    const options: IClientOptions = {
      clientId: config.clientId,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      protocolVersion: 4,
      username: config.username,
      password: config.password,
    };

    this.notifyStatus('CONNECTING');

    const client = mqtt.connect(config.webSocketUrl, options);
    this.client = client;

    client.on('connect', () => {
      if (this.client !== client) return;
      this.notifyStatus('CONNECTED');
      this.subscriptions.forEach((topic) => {
        client.subscribe(topic, (error) => {
          if (error) {
            console.error(`MQTT subscribe failed: ${topic}`, error);
            this.notifyStatus('ERROR');
          }
        });
      });
    });

    client.on('reconnect', () => {
      if (this.client !== client) return;
      this.notifyStatus('CONNECTING');
    });

    client.on('close', () => {
      if (this.client !== client) return;
      if (this.status !== 'DISCONNECTED' && this.status !== 'ERROR') {
        this.notifyStatus('DISCONNECTED');
      }
    });

    client.on('offline', () => {
      if (this.client !== client) return;
      this.notifyStatus('ERROR');
    });

    client.on('error', (error) => {
      if (this.client !== client) return;
      console.error('MQTT client error', error);
      this.notifyStatus('ERROR');
    });

    client.on('message', (topic, payload) => {
      if (this.client !== client) return;
      const raw = payload.toString();
      let parsed: unknown;

      try {
        parsed = JSON.parse(raw);
      } catch {
        this.notifyValidationError({
          topic,
          error: `Mensaje inválido en ${topic}: el contenido no es JSON válido.`,
          rawPayload: raw,
        });
        return;
      }

      const resultado = validarMensajeMqtt(topic, parsed);
      if (!resultado.valido) {
        this.notifyValidationError({ topic, error: resultado.error, rawPayload: raw });
        return;
      }

      this.notifyMessage(resultado.topic, resultado.mensaje);
    });
  }

  public subscribe(topic: string): void {
    this.subscriptions.add(topic);
    if (this.client?.connected) {
      this.client.subscribe(topic, (error) => {
        if (error) {
          console.error(`MQTT subscribe failed: ${topic}`, error);
          this.notifyStatus('ERROR');
        }
      });
    }
  }

  public unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
    this.client?.unsubscribe(topic);
  }

  public publish(topic: string, payload: unknown): boolean {
    if (!this.client?.connected) {
      this.notifyStatus('ERROR');
      return false;
    }

    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (new TextEncoder().encode(message).byteLength > MQTT_MAX_PAYLOAD_BYTES) {
        console.error(`MQTT publish failed: ${topic}; payload exceeds ${MQTT_MAX_PAYLOAD_BYTES} bytes`);
        this.notifyStatus('ERROR');
        return false;
      }
      const policy = MQTT_TOPIC_POLICIES[topic as MqttTopic] ?? { qos: 0 as const, retain: false };
      this.client.publish(topic, message, policy, (error) => {
        if (error) {
          console.error(`MQTT publish failed: ${topic}`, error);
          this.notifyStatus('ERROR');
        }
      });
    } catch (error) {
      console.error(`MQTT publish failed: ${topic}`, error);
      this.notifyStatus('ERROR');
      return false;
    }

    return true;
  }

  public sendLedCommand(accion: AccionLed, extra: Record<string, unknown> = {}): boolean {
    return this.publish(MQTT_TOPICS.LED_COMANDO, {
      accion,
      id_mensaje: `web-${Date.now()}`,
      ...extra,
    });
  }

  public disconnect(): void {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.notifyStatus('DISCONNECTED');
  }
}

export const mqttClient = new MqttBrowserClient();
