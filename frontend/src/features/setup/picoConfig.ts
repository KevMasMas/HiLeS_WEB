export interface DatosConfiguracionPico {
  wifiSsid: string;
  wifiPassword: string;
  mqttHost: string;
  mqttPort: number;
  mqttUsername: string;
  mqttPassword: string;
  mqttClientId: string;
  deviceId: string;
  projectId: string;
  teamId: string;
}

const SEGMENTO_MQTT = /^[^/+#\s]+$/;

export const validarConfiguracionPico = (datos: DatosConfiguracionPico): string[] => {
  const errores: string[] = [];
  if (!datos.wifiSsid.trim()) errores.push('Escribe el nombre de la red Wi-Fi.');
  if (!datos.wifiPassword) errores.push('Escribe la contraseña de la red Wi-Fi.');
  if (!datos.mqttHost.trim()) errores.push('Escribe la dirección del broker MQTT.');
  if (!Number.isInteger(datos.mqttPort) || datos.mqttPort < 1 || datos.mqttPort > 65535) errores.push('El puerto MQTT debe estar entre 1 y 65535.');
  if (!datos.mqttClientId.trim()) errores.push('Escribe un MQTT_CLIENT_ID único.');
  for (const [etiqueta, valor] of [['DEVICE_ID', datos.deviceId], ['HILES_PROJECT_ID', datos.projectId], ['HILES_TEAM_ID', datos.teamId]] as const) {
    if (!SEGMENTO_MQTT.test(valor)) errores.push(`${etiqueta} no puede contener espacios, /, + ni #.`);
  }
  return errores;
};

const cadenaPython = (valor: string): string => JSON.stringify(valor);

/** Genera el archivo local sin persistir ni registrar las credenciales. */
export const generarConfigLocalPico = (datos: DatosConfiguracionPico): string => {
  const errores = validarConfiguracionPico(datos);
  if (errores.length > 0) throw new Error(errores.join(' '));
  return `"""Configuración local generada por HiLeS Web. No subir a Git."""

WIFI_SSID = ${cadenaPython(datos.wifiSsid)}
WIFI_PASSWORD = ${cadenaPython(datos.wifiPassword)}

MQTT_HOST = ${cadenaPython(datos.mqttHost)}
MQTT_PORT = ${datos.mqttPort}
MQTT_USERNAME = ${cadenaPython(datos.mqttUsername)}
MQTT_PASSWORD = ${cadenaPython(datos.mqttPassword)}
MQTT_CLIENT_ID = ${cadenaPython(datos.mqttClientId)}
MQTT_CONNECT_TIMEOUT_SECONDS = 2

DEVICE_ID = ${cadenaPython(datos.deviceId)}
HILES_TEAM_ID = ${cadenaPython(datos.teamId)}
HILES_PROJECT_ID = ${cadenaPython(datos.projectId)}
WORKER_MAX_FRAGMENT_BYTES = 30000
WORKER_MAX_ELEMENTS = 64
WORKER_STATUS_PERIOD_MS = 5000

ENGINE_PERIOD_MS = 20
ENGINE_STEP_INTERVAL_MS = 1000
ENGINE_QUEUE_SIZE = 32
WATCHDOG_PERIOD_MS = 5000
`;
};

export const webSerialDisponible = (navegador: object = navigator): boolean =>
  'serial' in navegador;
