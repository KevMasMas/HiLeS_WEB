import { MQTT_TOPICS, type MqttTopic } from './config';

export type ValorMensajeMqtt = boolean | number | string;
export type AccionLed = 'encender' | 'apagar' | 'titilar';
export type AccionSimulacion = 'iniciar' | 'detener' | 'reiniciar' | 'paso';

export interface MensajeLedComando {
  accion: AccionLed;
  id_mensaje: string;
}

export interface MensajeLedEstado {
  encendido: boolean;
  accion_aplicada: AccionLed;
  id_mensaje: string;
}

export interface MensajeEstadoConexion {
  conectado: boolean;
  dispositivo: string;
}

export interface MensajeTelemetria {
  dispositivo: string;
  rssi?: number;
  memoria_libre?: number;
  tiempo_activo?: number;
}

export interface MensajeErrorMqtt {
  mensaje: string;
  codigo?: string;
  id_mensaje?: string;
}

export interface MensajeSimulacionComando {
  accion: AccionSimulacion;
  id_mensaje: string;
}

/** Mensaje que convierte un topic MQTT en una entrada externa de un Service. */
export interface MensajeEntradaEstablecer {
  servicio_id: string;
  valor: ValorMensajeMqtt;
  id_mensaje: string;
}

/** Salida del motor que puede publicarse nuevamente por MQTT. */
export interface MensajeSalidaHiles {
  servicio_id: string;
  valor: ValorMensajeMqtt;
  id_mensaje: string;
}

export interface MensajeModeloCargar {
  modelo_id: string;
  version: number;
  modelo: Record<string, unknown>;
  id_mensaje: string;
}

export interface MensajeModeloConfirmacion {
  modelo_id: string;
  aceptado: boolean;
  id_mensaje: string;
  error?: string;
}

export interface MensajesMqttPorTopic {
  [MQTT_TOPICS.LED_COMANDO]: MensajeLedComando;
  [MQTT_TOPICS.LED_ESTADO]: MensajeLedEstado;
  [MQTT_TOPICS.ESTADO_CONEXION]: MensajeEstadoConexion;
  [MQTT_TOPICS.TELEMETRIA]: MensajeTelemetria;
  [MQTT_TOPICS.SALIDA]: MensajeSalidaHiles;
  [MQTT_TOPICS.ERROR]: MensajeErrorMqtt;
  [MQTT_TOPICS.SIMULACION_COMANDO]: MensajeSimulacionComando;
  [MQTT_TOPICS.ENTRADA_ESTABLECER]: MensajeEntradaEstablecer;
  [MQTT_TOPICS.MODELO_CARGAR]: MensajeModeloCargar;
  [MQTT_TOPICS.MODELO_CONFIRMACION]: MensajeModeloConfirmacion;
}

export type MensajeMqtt = MensajesMqttPorTopic[keyof MensajesMqttPorTopic];

export type ResultadoValidacionMensaje =
  | { valido: true; topic: MqttTopic; mensaje: MensajeMqtt }
  | { valido: false; error: string };

const TOPICS_CONOCIDOS = new Set<string>(Object.values(MQTT_TOPICS));
const ACCIONES_LED = new Set<AccionLed>(['encender', 'apagar', 'titilar']);
const ACCIONES_SIMULACION = new Set<AccionSimulacion>(['iniciar', 'detener', 'reiniciar', 'paso']);

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor.trim().length > 0;
const esValorMqtt = (valor: unknown): valor is ValorMensajeMqtt =>
  typeof valor === 'boolean' || typeof valor === 'number' || typeof valor === 'string';

const error = (topic: string, detalle: string): ResultadoValidacionMensaje => ({
  valido: false,
  error: `Mensaje inválido en ${topic}: ${detalle}.`,
});

const validarId = (topic: string, payload: Record<string, unknown>): ResultadoValidacionMensaje | null =>
  esTexto(payload.id_mensaje) ? null : error(topic, 'id_mensaje debe ser un texto no vacío');

/**
 * Valida el contrato del mensaje según el topic antes de entregarlo a la UI o
 * al motor HiLeS. Los errores están redactados para poder mostrarlos al usuario.
 */
export const validarMensajeMqtt = (topic: string, payload: unknown): ResultadoValidacionMensaje => {
  if (!TOPICS_CONOCIDOS.has(topic)) return error(topic, 'el topic no pertenece al contrato MQTT de HiLeS');
  if (!esObjeto(payload)) return error(topic, 'el contenido debe ser un objeto JSON');

  switch (topic as MqttTopic) {
    case MQTT_TOPICS.LED_COMANDO: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!ACCIONES_LED.has(payload.accion as AccionLed)) return error(topic, 'accion debe ser encender, apagar o titilar');
      break;
    }
    case MQTT_TOPICS.LED_ESTADO: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (typeof payload.encendido !== 'boolean') return error(topic, 'encendido debe ser booleano');
      if (!ACCIONES_LED.has(payload.accion_aplicada as AccionLed)) return error(topic, 'accion_aplicada no es válida');
      break;
    }
    case MQTT_TOPICS.ESTADO_CONEXION:
      if (typeof payload.conectado !== 'boolean') return error(topic, 'conectado debe ser booleano');
      if (!esTexto(payload.dispositivo)) return error(topic, 'dispositivo debe ser un texto no vacío');
      break;
    case MQTT_TOPICS.TELEMETRIA:
      if (!esTexto(payload.dispositivo)) return error(topic, 'dispositivo debe ser un texto no vacío');
      for (const campo of ['rssi', 'memoria_libre', 'tiempo_activo'] as const) {
        if (payload[campo] !== undefined && typeof payload[campo] !== 'number') {
          return error(topic, `${campo} debe ser numérico`);
        }
      }
      break;
    case MQTT_TOPICS.ERROR:
      if (!esTexto(payload.mensaje)) return error(topic, 'mensaje debe ser un texto no vacío');
      if (payload.codigo !== undefined && !esTexto(payload.codigo)) return error(topic, 'codigo debe ser texto');
      if (payload.id_mensaje !== undefined && !esTexto(payload.id_mensaje)) return error(topic, 'id_mensaje debe ser texto');
      break;
    case MQTT_TOPICS.SIMULACION_COMANDO: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!ACCIONES_SIMULACION.has(payload.accion as AccionSimulacion)) return error(topic, 'accion de simulación no válida');
      break;
    }
    case MQTT_TOPICS.ENTRADA_ESTABLECER:
    case MQTT_TOPICS.SALIDA: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!esTexto(payload.servicio_id)) return error(topic, 'servicio_id debe ser un texto no vacío');
      if (!esValorMqtt(payload.valor)) return error(topic, 'valor debe ser booleano, numérico o texto');
      break;
    }
    case MQTT_TOPICS.MODELO_CARGAR: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!esTexto(payload.modelo_id)) return error(topic, 'modelo_id debe ser un texto no vacío');
      if (typeof payload.version !== 'number' || !Number.isInteger(payload.version) || payload.version < 1) {
        return error(topic, 'version debe ser un entero positivo');
      }
      if (!esObjeto(payload.modelo)) return error(topic, 'modelo debe ser un objeto JSON');
      break;
    }
    case MQTT_TOPICS.MODELO_CONFIRMACION: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!esTexto(payload.modelo_id)) return error(topic, 'modelo_id debe ser un texto no vacío');
      if (typeof payload.aceptado !== 'boolean') return error(topic, 'aceptado debe ser booleano');
      if (payload.error !== undefined && !esTexto(payload.error)) return error(topic, 'error debe ser texto');
      break;
    }
  }

  return { valido: true, topic: topic as MqttTopic, mensaje: payload as unknown as MensajeMqtt };
};

/** Ejemplos compartidos por código, pruebas y documentación. */
export const EJEMPLOS_MENSAJES_MQTT: MensajesMqttPorTopic = {
  [MQTT_TOPICS.LED_COMANDO]: { accion: 'encender', id_mensaje: 'cmd-001' },
  [MQTT_TOPICS.LED_ESTADO]: { encendido: true, accion_aplicada: 'encender', id_mensaje: 'cmd-001' },
  [MQTT_TOPICS.ESTADO_CONEXION]: { conectado: true, dispositivo: 'pico01' },
  [MQTT_TOPICS.TELEMETRIA]: { dispositivo: 'pico01', rssi: -48, memoria_libre: 81232, tiempo_activo: 120 },
  [MQTT_TOPICS.SALIDA]: { servicio_id: 'service-output', valor: true, id_mensaje: 'salida-001' },
  [MQTT_TOPICS.ERROR]: { codigo: 'JSON_INVALIDO', mensaje: 'No fue posible interpretar el comando.', id_mensaje: 'cmd-001' },
  [MQTT_TOPICS.SIMULACION_COMANDO]: { accion: 'paso', id_mensaje: 'sim-001' },
  [MQTT_TOPICS.ENTRADA_ESTABLECER]: { servicio_id: 'sensor-humedad', valor: 70, id_mensaje: 'entrada-001' },
  [MQTT_TOPICS.MODELO_CARGAR]: { modelo_id: 'demo-01', version: 1, modelo: { schemaVersion: 2 }, id_mensaje: 'modelo-001' },
  [MQTT_TOPICS.MODELO_CONFIRMACION]: { modelo_id: 'demo-01', aceptado: true, id_mensaje: 'modelo-001' },
};
