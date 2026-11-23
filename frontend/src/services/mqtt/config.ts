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

export type MqttConnectionMode = 'lan' | 'remote';
export type MqttWsProtocol = 'ws' | 'wss';

/**
 * Perfil de conexión del proyecto al broker MQTT.
 *
 * Solo vive en memoria de la pestaña actual: nunca persiste credenciales en
 * `localStorage`, URL, documento colaborativo ni mensajes retenidos.
 */
export interface MqttConnectionProfile {
  mode: MqttConnectionMode;
  protocol: MqttWsProtocol;
  host: string;
  port: number;
  path: string;
  username: string;
  password: string;
}

export interface MqttConfig {
  mode: MqttConnectionMode;
  protocol: MqttWsProtocol;
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

/** Distingue direcciones de red doméstica/laboratorio frente a hosts públicos. */
export const esHostLocalOLan = (host: string): boolean => {
  const limpio = host.trim().toLowerCase();
  if (!limpio) return true;
  if (limpio === 'localhost' || limpio === '127.0.0.1' || limpio === '::1' || limpio.endsWith('.local')) {
    return true;
  }
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(limpio)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(limpio)) return true;
  const privado172 = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(limpio);
  if (privado172) {
    const segundo = Number(privado172[1]);
    return segundo >= 16 && segundo <= 31;
  }
  return false;
};

export interface ValidacionPerfilMqtt {
  errores: string[];
  advertencias: string[];
}

export const validarPerfilConexionMqtt = (
  perfil: MqttConnectionProfile,
  paginaHttps = typeof window !== 'undefined' && window.location.protocol === 'https:',
): ValidacionPerfilMqtt => {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const host = perfil.host.trim();

  if (!host) {
    errores.push('Escribe la IP o el dominio del broker MQTT.');
  } else if (/\s/.test(host) || host.includes('://') || host.includes('/')) {
    errores.push('Escribe solo el host o IP del broker, sin ws:// ni barras.');
  }

  if (!Number.isInteger(perfil.port) || perfil.port < 1 || perfil.port > 65535) {
    errores.push('El puerto WebSocket debe estar entre 1 y 65535.');
  }

  if (!perfil.path.trim() || /\s/.test(perfil.path)) {
    errores.push('La ruta WebSocket no puede estar vacía ni tener espacios (ej. /mqtt).');
  }

  if (perfil.protocol !== 'ws' && perfil.protocol !== 'wss') {
    errores.push('El protocolo debe ser ws o wss.');
  }

  if (paginaHttps && perfil.protocol === 'ws') {
    errores.push('Esta página usa HTTPS: el navegador bloquea conexiones ws:// sin cifrar; selecciona wss://.');
  }

  if (perfil.mode === 'remote') {
    if (perfil.protocol !== 'wss') {
      advertencias.push('Conexión remota sin TLS (ws://): no es segura para Internet; usa wss://.');
    }
    if (!perfil.username.trim()) {
      advertencias.push('Conexión remota sin usuario: usa un broker con autenticación y control de acceso.');
    }
  } else if (host === 'localhost' || host === '127.0.0.1') {
    advertencias.push('Con localhost solo conecta este equipo; para otros celulares o PCs en la LAN usa la IP local del broker.');
  }

  return { errores, advertencias };
};

export const getDefaultMqttProfile = (): MqttConnectionProfile => {
  const host = readEnv('VITE_MQTT_HOST', 'localhost');
  const port = Number(readEnv('VITE_MQTT_WS_PORT', '9001')) || 9001;
  const path = readEnv('VITE_MQTT_WS_PATH', '/mqtt');
  const rawProtocol = readEnv(
    'VITE_MQTT_WS_PROTOCOL',
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? 'wss'
      : 'ws',
  ).replace('://', '').toLowerCase();
  const protocol: MqttWsProtocol = rawProtocol === 'wss' ? 'wss' : 'ws';
  const username = readEnv('VITE_MQTT_USERNAME', '');
  const password = readEnv('VITE_MQTT_PASSWORD', '');
  const mode: MqttConnectionMode = protocol === 'wss' && !esHostLocalOLan(host) ? 'remote' : 'lan';

  return Object.freeze({
    mode,
    protocol,
    host,
    port,
    path: path.startsWith('/') ? path : `/${path}`,
    username,
    password,
  });
};

let activeProfile: Readonly<MqttConnectionProfile> | null = null;
const profileListeners = new Set<() => void>();

const notifyProfileListeners = (): void => {
  profileListeners.forEach((listener) => listener());
};

/** Snapshot inmutable para `useSyncExternalStore`. */
export const getActiveMqttProfile = (): Readonly<MqttConnectionProfile> => {
  if (!activeProfile) {
    activeProfile = getDefaultMqttProfile();
  }
  return activeProfile;
};

export const setActiveMqttProfile = (
  next: MqttConnectionProfile,
): Readonly<MqttConnectionProfile> => {
  const normalizado: MqttConnectionProfile = {
    mode: next.mode,
    protocol: next.protocol,
    host: next.host.trim(),
    port: Number(next.port),
    path: next.path.trim().startsWith('/') ? next.path.trim() : `/${next.path.trim()}`,
    username: next.username.trim(),
    password: next.password,
  };
  const { errores } = validarPerfilConexionMqtt(normalizado);
  if (errores.length > 0) {
    throw new Error(errores[0]);
  }
  activeProfile = Object.freeze(normalizado);
  notifyProfileListeners();
  return activeProfile;
};

export const resetActiveMqttProfile = (): Readonly<MqttConnectionProfile> => {
  activeProfile = getDefaultMqttProfile();
  notifyProfileListeners();
  return activeProfile;
};

export const subscribeMqttProfile = (listener: () => void): (() => void) => {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
};

export const etiquetaModoConexionMqtt = (perfil: Pick<MqttConnectionProfile, 'mode' | 'protocol'>): string =>
  perfil.mode === 'remote'
    ? `Remoto (${perfil.protocol})`
    : 'Local/LAN';

export const getMqttConfig = (): MqttConfig => {
  const perfil = getActiveMqttProfile();
  const clientId = `hiles-web-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  return {
    mode: perfil.mode,
    protocol: perfil.protocol,
    host: perfil.host,
    port: perfil.port,
    path: perfil.path,
    username: perfil.username || undefined,
    password: perfil.password || undefined,
    webSocketUrl: buildMqttWebSocketUrl(perfil.host, perfil.port, perfil.path, perfil.protocol),
    clientId,
  };
};
