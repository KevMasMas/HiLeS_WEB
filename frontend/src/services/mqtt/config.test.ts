import { afterEach, describe, expect, it } from 'vitest';
import {
  buildMqttDeviceTopics,
  buildMqttDeviceConnectionWildcard,
  buildMqttWebSocketUrl,
  esHostLocalOLan,
  etiquetaModoConexionMqtt,
  getActiveMqttProfile,
  getMqttConfig,
  getMqttDynamicTopicPolicy,
  MQTT_TOPIC_POLICIES,
  MQTT_TOPICS,
  parseMqttDeviceConnectionTopic,
  resetActiveMqttProfile,
  setActiveMqttProfile,
  validarPerfilConexionMqtt,
} from './config';

describe('configuración MQTT WebSocket', () => {
  afterEach(() => {
    resetActiveMqttProfile();
  });

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

  it('distingue hosts Local/LAN frente a remotos y advierte conexiones remotas sin TLS', () => {
    expect(esHostLocalOLan('localhost')).toBe(true);
    expect(esHostLocalOLan('192.168.1.25')).toBe(true);
    expect(esHostLocalOLan('172.20.0.4')).toBe(true);
    expect(esHostLocalOLan('broker.ejemplo.org')).toBe(false);

    const inseguro = validarPerfilConexionMqtt({
      mode: 'remote',
      protocol: 'ws',
      host: 'broker.ejemplo.org',
      port: 9001,
      path: '/mqtt',
      username: '',
      password: '',
    }, false);
    expect(inseguro.errores).toEqual([]);
    expect(inseguro.advertencias.some((item) => item.includes('wss://'))).toBe(true);
  });

  it('aplica perfiles Local/LAN y Remoto solo en memoria de sesión sin persistir secretos', () => {
    const escriturasLocalStorage: Array<[string, string]> = [];
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: (clave: string, valor: string) => escriturasLocalStorage.push([clave, valor]),
      },
    });

    const snapshotInicial = getActiveMqttProfile();
    expect(getActiveMqttProfile()).toBe(snapshotInicial);

    const aplicado = setActiveMqttProfile({
      mode: 'remote',
      protocol: 'wss',
      host: 'mqtt.ejemplo.org',
      port: 8884,
      path: 'mqtt',
      username: 'operador',
      password: 'secreto-temporal',
    });
    expect(etiquetaModoConexionMqtt(aplicado)).toBe('Remoto (wss)');
    expect(getMqttConfig()).toMatchObject({
      mode: 'remote',
      protocol: 'wss',
      webSocketUrl: 'wss://mqtt.ejemplo.org:8884/mqtt',
      username: 'operador',
      password: 'secreto-temporal',
    });
    expect(escriturasLocalStorage).toEqual([]);

    const restaurado = resetActiveMqttProfile();
    expect(restaurado.password).not.toBe('secreto-temporal');
  });
});
