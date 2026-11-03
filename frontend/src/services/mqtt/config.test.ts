import { describe, expect, it } from 'vitest';
import {
  buildMqttDeviceTopics,
  buildMqttDeviceConnectionWildcard,
  buildMqttWebSocketUrl,
  getMqttDynamicTopicPolicy,
  MQTT_TOPIC_POLICIES,
  MQTT_TOPICS,
  parseMqttDeviceConnectionTopic,
} from './config';

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

  it('construye topics y políticas para cualquier DEVICE_ID', () => {
    const topics = buildMqttDeviceTopics('pico02');
    expect(topics.LED_COMANDO).toBe('udfjc/hiles/v1/equipo1/pico02/led/comando');
    expect(getMqttDynamicTopicPolicy(topics.LED_COMANDO)).toEqual({ qos: 1, retain: false });
    expect(getMqttDynamicTopicPolicy(topics.LED_ESTADO)).toEqual({ qos: 1, retain: true });
  });

  it('descubre el DEVICE_ID desde los topics de presencia', () => {
    expect(buildMqttDeviceConnectionWildcard()).toBe('udfjc/hiles/v1/equipo1/+/estado/conexion');
    expect(parseMqttDeviceConnectionTopic('udfjc/hiles/v1/equipo1/pico02/estado/conexion')).toBe('pico02');
    expect(parseMqttDeviceConnectionTopic('udfjc/hiles/v1/otro/pico02/estado/conexion')).toBeNull();
  });
});
