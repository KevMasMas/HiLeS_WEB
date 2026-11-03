import {
  obtenerPoliticaTopicoProyectoV2,
  parsearTopicoProyectoV2,
  PREFIJO_PROYECTOS_V2_POR_DEFECTO,
} from '../projects/projectTopics';

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
export type MqttTopicKey = keyof typeof MQTT_TOPICS;
export type MqttDeviceTopics = Record<MqttTopicKey, string>;

const MQTT_TOPIC_SUFFIXES: Record<MqttTopicKey, string> = {
  LED_COMANDO: 'led/comando',
  LED_ESTADO: 'led/estado',
  ESTADO_CONEXION: 'estado/conexion',
  TELEMETRIA: 'telemetria',
  SALIDA: 'salida',
  ERROR: 'error',
  SIMULACION_COMANDO: 'simulacion/comando',
  ENTRADA_ESTABLECER: 'entrada/establecer',
  MODELO_CARGAR: 'modelo/cargar',
  MODELO_CONFIRMACION: 'modelo/confirmacion',
  SIMULACION_ESTADO: 'simulacion/estado',
};

const validarSegmentoV1 = (valor: string, nombre: string): string => {
  const limpio = valor.trim();
  if (!limpio || /[/+#]/.test(limpio)) {
    throw new Error(`${nombre} no puede estar vacío ni contener /, + o #.`);
  }
  return limpio;
};

/** Construye los topics v1 para cualquier Pico sin fijar el panel a pico01. */
export const buildMqttDeviceTopics = (
  deviceId: string,
  teamId = 'equipo1',
): MqttDeviceTopics => {
  const dispositivo = validarSegmentoV1(deviceId, 'deviceId');
  const equipo = validarSegmentoV1(teamId, 'teamId');
  const prefijo = `udfjc/hiles/v1/${equipo}/${dispositivo}`;
  return Object.fromEntries(
    Object.entries(MQTT_TOPIC_SUFFIXES).map(([clave, sufijo]) => [clave, `${prefijo}/${sufijo}`]),
  ) as MqttDeviceTopics;
};

export const buildMqttDeviceConnectionWildcard = (teamId = 'equipo1'): string =>
  `udfjc/hiles/v1/${validarSegmentoV1(teamId, 'teamId')}/+/estado/conexion`;

/** Extrae el DEVICE_ID de un topic de presencia v1 del equipo indicado. */
export const parseMqttDeviceConnectionTopic = (
  topic: string,
  teamId = 'equipo1',
): string | null => {
  const equipo = validarSegmentoV1(teamId, 'teamId');
  const match = new RegExp(`^udfjc/hiles/v1/${equipo}/([^/+#]+)/estado/conexion$`).exec(topic);
  return match?.[1] ?? null;
};

/** Devuelve el topic canónico pico01 usado como esquema para un topic v1 dinámico. */
export const normalizeMqttDeviceTopic = (topic: string): MqttTopic | null => {
  const match = /^udfjc\/hiles\/v1\/[^/+#]+\/[^/+#]+\/(.+)$/.exec(topic);
  if (!match) return null;
  const entrada = (Object.entries(MQTT_TOPIC_SUFFIXES) as Array<[MqttTopicKey, string]>)
    .find(([, sufijo]) => sufijo === match[1]);
  return entrada ? MQTT_TOPICS[entrada[0]] : null;
};

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
export const MQTT_IR_VERSION_V2 = 2;
export const MQTT_SUPPORTED_IR_VERSIONS = [1, 2] as const;
export type MqttIrVersion = (typeof MQTT_SUPPORTED_IR_VERSIONS)[number];
export const MQTT_MAX_MODEL_ELEMENTS = 64;
export const MQTT_MAX_MODEL_CONNECTIONS = 128;
export const MQTT_PROJECT_V2_TOPIC_PREFIX = PREFIJO_PROYECTOS_V2_POR_DEFECTO;

export type MqttConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'ERROR';

export interface MqttConfig {
  host: string;
  port: number;
  path: string;
  username?: string;
  password?: string;
  webSocketUrl: string;
  clientId: string;
}

/**
 * Obtiene la política QoS/retain tanto para topics estáticos v1 como para
 * topics dinámicos de proyectos colaborativos v2.
 */
export const getMqttDynamicTopicPolicy = (topic: string): MqttTopicPolicy => {
  const staticPolicy = MQTT_TOPIC_POLICIES[topic as MqttTopic];
  if (staticPolicy) {
    return staticPolicy;
  }
  const deviceTopic = normalizeMqttDeviceTopic(topic);
  if (deviceTopic) {
    return MQTT_TOPIC_POLICIES[deviceTopic];
  }
  const projectTopic = parsearTopicoProyectoV2(
    topic,
    MQTT_PROJECT_V2_TOPIC_PREFIX,
  );
  if (projectTopic) {
    return obtenerPoliticaTopicoProyectoV2(projectTopic.sufijo);
  }
  return { qos: 0, retain: false };
};

export const resolverPoliticaTopicoMqtt = getMqttDynamicTopicPolicy;

const readEnv = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
};

export const buildMqttWebSocketUrl = (
  host: string,
  port: number,
  path: string,
  protocol = 'ws',
): string => {
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
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'wss'
      : 'ws',
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
