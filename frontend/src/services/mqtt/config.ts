export const MQTT_TOPICS = {
  LED_COMANDO: 'udfjc/hiles/v1/equipo1/pico01/led/comando',
  LED_ESTADO: 'udfjc/hiles/v1/equipo1/pico01/led/estado',
  ESTADO_CONEXION: 'udfjc/hiles/v1/equipo1/pico01/estado/conexion',
  TELEMETRIA: 'udfjc/hiles/v1/equipo1/pico01/telemetria',
  SALIDA: 'udfjc/hiles/v1/equipo1/pico01/salida',
  ERROR: 'udfjc/hiles/v1/equipo1/pico01/error',
  SIMULACION_COMANDO: 'udfjc/hiles/v1/equipo1/pico01/simulacion/comando',
  ENTRADA_ESTABLECER: 'udfjc/hiles/v1/equipo1/pico01/entrada/establecer',
  MODELO_CARGAR: 'udfjc/hiles/v1/equipo1/pico01/modelo/cargar',
  MODELO_CONFIRMACION: 'udfjc/hiles/v1/equipo1/pico01/modelo/confirmacion',
  SIMULACION_ESTADO: 'udfjc/hiles/v1/equipo1/pico01/simulacion/estado',
} as const;

export type MqttTopic = (typeof MQTT_TOPICS)[keyof typeof MQTT_TOPICS];

export interface MqttTopicPolicy {
  qos: 0 | 1;
  retain: boolean;
}

/**
 * Los comandos nunca se retienen: un cliente que reconecta no debe volver a
 * ejecutar accidentalmente un paso anterior. Los estados oficiales sí se
 * retienen para que la interfaz pueda reconstruirse al reconectar.
 */
export const MQTT_TOPIC_POLICIES: Record<MqttTopic, MqttTopicPolicy> = {
  [MQTT_TOPICS.LED_COMANDO]: { qos: 1, retain: false },
  [MQTT_TOPICS.LED_ESTADO]: { qos: 1, retain: true },
  [MQTT_TOPICS.ESTADO_CONEXION]: { qos: 1, retain: true },
  [MQTT_TOPICS.TELEMETRIA]: { qos: 0, retain: false },
  [MQTT_TOPICS.SALIDA]: { qos: 1, retain: false },
  [MQTT_TOPICS.ERROR]: { qos: 1, retain: false },
  [MQTT_TOPICS.SIMULACION_COMANDO]: { qos: 1, retain: false },
  [MQTT_TOPICS.ENTRADA_ESTABLECER]: { qos: 1, retain: false },
  [MQTT_TOPICS.MODELO_CARGAR]: { qos: 1, retain: false },
  [MQTT_TOPICS.MODELO_CONFIRMACION]: { qos: 1, retain: false },
  [MQTT_TOPICS.SIMULACION_ESTADO]: { qos: 1, retain: true },
};

/** Límite conservador para no agotar la memoria de la Pico al decodificar JSON. */
export const MQTT_MAX_PAYLOAD_BYTES = 32 * 1024;
export const MQTT_IR_VERSION = 1;
export const MQTT_MAX_MODEL_ELEMENTS = 64;
export const MQTT_MAX_MODEL_CONNECTIONS = 128;

export type MqttConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface MqttConfig {
  host: string;
  port: number;
  path: string;
  username?: string;
  password?: string;
  webSocketUrl: string;
  clientId: string;
}

const readEnv = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
};

export const buildMqttWebSocketUrl = (host: string, port: number, path: string, protocol = 'ws'): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedProtocol = protocol.replace('://', '').toLowerCase();
  if (normalizedProtocol !== 'ws' && normalizedProtocol !== 'wss') {
    throw new Error(`Protocolo MQTT WebSocket no válido: ${protocol}`);
  }
  return `${normalizedProtocol}://${host}:${port}${normalizedPath}`;
};

export const getMqttConfig = (): MqttConfig => {
  const host = readEnv('VITE_MQTT_HOST', 'localhost');
  const port = Number(readEnv('VITE_MQTT_WS_PORT', '9001')) || 9001;
  const path = readEnv('VITE_MQTT_WS_PATH', '/mqtt');
  const protocol = readEnv(
    'VITE_MQTT_WS_PROTOCOL',
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws',
  );
  const username = readEnv('VITE_MQTT_USERNAME', '');
  const password = readEnv('VITE_MQTT_PASSWORD', '');
  const clientId = `hiles-web-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  return {
    host,
    port,
    path,
    username: username || undefined,
    password: password || undefined,
    webSocketUrl: buildMqttWebSocketUrl(host, port, path, protocol),
    clientId,
  };
};
