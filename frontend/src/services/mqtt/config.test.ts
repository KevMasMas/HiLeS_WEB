import { describe, expect, it } from 'vitest';
import { buildMqttWebSocketUrl } from './config';

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
});
