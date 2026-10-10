import { describe, expect, it } from 'vitest';
import { buildMqttWebSocketUrl, MQTT_TOPIC_POLICIES, MQTT_TOPICS } from './config';

describe('configuración MQTT WebSocket', () => {
  it('construye la URL local con la ruta normalizada', () => {
    expect(buildMqttWebSocketUrl('localhost', 9001, 'mqtt')).toBe('ws://localhost:9001/mqtt');
  });

  it('permite WebSocket seguro para despliegues HTTPS', () => {
    expect(buildMqttWebSocketUrl('broker.example.com', 443, '/mqtt', 'wss')).toBe(
      'wss://broker.example.com:443/mqtt',
    );
  });

  it('rechaza protocolos diferentes de ws y wss', () => {
    expect(() => buildMqttWebSocketUrl('localhost', 9001, '/mqtt', 'http')).toThrow(
      'Protocolo MQTT WebSocket no válido',
    );
  });

  it('no retiene comandos y sí retiene estados oficiales', () => {
    expect(MQTT_TOPIC_POLICIES[MQTT_TOPICS.SIMULACION_COMANDO]).toEqual({ qos: 1, retain: false });
    expect(MQTT_TOPIC_POLICIES[MQTT_TOPICS.MODELO_CARGAR]).toEqual({ qos: 1, retain: false });
    expect(MQTT_TOPIC_POLICIES[MQTT_TOPICS.SIMULACION_ESTADO]).toEqual({ qos: 1, retain: true });
  });
});
