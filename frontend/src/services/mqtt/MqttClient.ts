import mqtt, { type IClientOptions, type MqttClient as BrowserMqttClient } from 'mqtt';
import { getMqttConfig, MQTT_TOPICS, type MqttConnectionStatus } from './config';

export type MqttMessageHandler = (topic: string, payload: unknown) => void;
export type MqttStatusHandler = (status: MqttConnectionStatus) => void;

class MqttBrowserClient {
  private client: BrowserMqttClient | null = null;
  private status: MqttConnectionStatus = 'DISCONNECTED';
  private readonly statusListeners = new Set<MqttStatusHandler>();
  private readonly messageListeners = new Set<MqttMessageHandler>();
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

  private notifyStatus(nextStatus: MqttConnectionStatus): void {
    this.status = nextStatus;
    this.statusListeners.forEach((listener) => listener(nextStatus));
  }

  private notifyMessage(topic: string, payload: unknown): void {
    this.messageListeners.forEach((listener) => listener(topic, payload));
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
      if (this.status !== 'DISCONNECTED') {
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
        parsed = raw;
      }

      this.notifyMessage(topic, parsed);
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
      this.client.publish(topic, message, (error) => {
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

  public sendLedCommand(accion: 'encender' | 'apagar' | 'titilar', extra: Record<string, unknown> = {}): boolean {
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
