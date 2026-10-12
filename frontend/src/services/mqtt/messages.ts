import {
  MQTT_IR_VERSION,
  MQTT_MAX_MODEL_CONNECTIONS,
  MQTT_MAX_MODEL_ELEMENTS,
  MQTT_MAX_PAYLOAD_BYTES,
  MQTT_TOPICS,
  type MqttTopic,
} from './config';
import { validarIrV1, type IrModeloV1 } from '../ir';

export type ValorMensajeMqtt = boolean | number | string;
export type AccionLed = 'encender' | 'apagar' | 'titilar';
export type AccionLedEstado = AccionLed | 'inicio';
export type AccionSimulacion = 'iniciar' | 'detener' | 'reiniciar' | 'paso';
export type EstadoSimulacion = 'sin_modelo' | 'lista' | 'ejecutando' | 'pausada' | 'detenida' | 'error';

export interface MensajeLedComando {
  accion: AccionLed;
  id_mensaje: string;
}

export interface MensajeLedEstado {
  encendido: boolean;
  accion_aplicada: AccionLedEstado;
  /** No existe en el estado inicial espontáneo de la Pico. */
  id_mensaje?: string;
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
  /** Forma usada por la web. */
  mensaje?: string;
  /** Forma usada actualmente por MicroPython en la Pico. */
  error?: string;
  codigo?: string;
  id_mensaje?: string;
}

export interface MensajeSimulacionComando {
  accion: AccionSimulacion;
  id_mensaje: string;
  /** Obligatorios cuando el comando se dirige al motor remoto. */
  modelo_id?: string;
  version?: number;
}

/** Mensaje que convierte un topic MQTT en una entrada externa de un Service. */
export interface MensajeEntradaEstablecer {
  servicio_id: string;
  valor: ValorMensajeMqtt;
  id_mensaje: string;
  /** Obligatorios cuando la entrada se dirige al motor remoto. */
  modelo_id?: string;
  version?: number;
}

/** Salida del motor que puede publicarse nuevamente por MQTT. */
export interface MensajeSalidaHiles {
  servicio_id: string;
  valor: ValorMensajeMqtt;
  id_mensaje: string;
}

export type ModeloEjecutableMqtt = IrModeloV1;

export interface MensajeModeloCargar {
  modelo_id: string;
  version: number;
  ir_version: number;
  modelo: ModeloEjecutableMqtt;
  id_mensaje: string;
}

export interface MensajeModeloConfirmacion {
  modelo_id: string;
  version: number;
  ir_version: number;
  aceptado: boolean;
  id_mensaje: string;
  codigo?: string;
  error?: string;
}

export interface EstadoElementoSimulacion {
  valor?: ValorMensajeMqtt;
  salida?: ValorMensajeMqtt;
  tokens?: number;
  habilitada?: boolean;
  disparada?: boolean;
}

export interface MensajeSimulacionEstado {
  modelo_id: string;
  version: number;
  secuencia: number;
  estado: EstadoSimulacion;
  elementos: Record<string, EstadoElementoSimulacion>;
  /** Puede omitirse en estados espontáneos, por ejemplo después de reconectar. */
  id_mensaje?: string;
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
  [MQTT_TOPICS.SIMULACION_ESTADO]: MensajeSimulacionEstado;
}

export type MensajeMqtt = MensajesMqttPorTopic[keyof MensajesMqttPorTopic];

export type ResultadoValidacionMensaje =
  | { valido: true; topic: MqttTopic; mensaje: MensajeMqtt }
  | { valido: false; error: string };

const TOPICS_CONOCIDOS = new Set<string>(Object.values(MQTT_TOPICS));
const ACCIONES_LED = new Set<AccionLed>(['encender', 'apagar', 'titilar']);
const ACCIONES_ESTADO_LED = new Set<AccionLedEstado>(['encender', 'apagar', 'titilar', 'inicio']);
const ACCIONES_SIMULACION = new Set<AccionSimulacion>(['iniciar', 'detener', 'reiniciar', 'paso']);
const ESTADOS_SIMULACION = new Set<EstadoSimulacion>(['sin_modelo', 'lista', 'ejecutando', 'pausada', 'detenida', 'error']);

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor.trim().length > 0;
const esValorMqtt = (valor: unknown): valor is ValorMensajeMqtt =>
  typeof valor === 'boolean' || typeof valor === 'number' || typeof valor === 'string';
const esEnteroPositivo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 1;
const esEnteroNoNegativo = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;

const calcularTamanoJson = (payload: unknown): number => {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

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
  if (calcularTamanoJson(payload) > MQTT_MAX_PAYLOAD_BYTES) {
    return error(topic, `el contenido supera el límite de ${MQTT_MAX_PAYLOAD_BYTES} bytes`);
  }

  switch (topic as MqttTopic) {
    case MQTT_TOPICS.LED_COMANDO: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!ACCIONES_LED.has(payload.accion as AccionLed)) return error(topic, 'accion debe ser encender, apagar o titilar');
      break;
    }
    case MQTT_TOPICS.LED_ESTADO: {
      if (typeof payload.encendido !== 'boolean') return error(topic, 'encendido debe ser booleano');
      if (!ACCIONES_ESTADO_LED.has(payload.accion_aplicada as AccionLedEstado)) return error(topic, 'accion_aplicada no es válida');
      if (payload.id_mensaje !== undefined && !esTexto(payload.id_mensaje)) return error(topic, 'id_mensaje debe ser texto');
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
      if (!esTexto(payload.mensaje) && !esTexto(payload.error)) {
        return error(topic, 'mensaje o error debe ser un texto no vacío');
      }
      if (payload.mensaje !== undefined && !esTexto(payload.mensaje)) return error(topic, 'mensaje debe ser texto');
      if (payload.error !== undefined && !esTexto(payload.error)) return error(topic, 'error debe ser texto');
      if (payload.codigo !== undefined && !esTexto(payload.codigo)) return error(topic, 'codigo debe ser texto');
      if (payload.id_mensaje !== undefined && !esTexto(payload.id_mensaje)) return error(topic, 'id_mensaje debe ser texto');
      break;
    case MQTT_TOPICS.SIMULACION_COMANDO: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!ACCIONES_SIMULACION.has(payload.accion as AccionSimulacion)) return error(topic, 'accion de simulación no válida');
      if (payload.modelo_id !== undefined && !esTexto(payload.modelo_id)) return error(topic, 'modelo_id debe ser texto');
      if (payload.version !== undefined && !esEnteroPositivo(payload.version)) return error(topic, 'version debe ser un entero positivo');
      break;
    }
    case MQTT_TOPICS.ENTRADA_ESTABLECER:
    case MQTT_TOPICS.SALIDA: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!esTexto(payload.servicio_id)) return error(topic, 'servicio_id debe ser un texto no vacío');
      if (!esValorMqtt(payload.valor)) return error(topic, 'valor debe ser booleano, numérico o texto');
      if (payload.modelo_id !== undefined && !esTexto(payload.modelo_id)) return error(topic, 'modelo_id debe ser texto');
      if (payload.version !== undefined && !esEnteroPositivo(payload.version)) return error(topic, 'version debe ser un entero positivo');
      break;
    }
    case MQTT_TOPICS.MODELO_CARGAR: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!esTexto(payload.modelo_id)) return error(topic, 'modelo_id debe ser un texto no vacío');
      if (!esEnteroPositivo(payload.version)) return error(topic, 'version debe ser un entero positivo');
      if (payload.ir_version !== MQTT_IR_VERSION) return error(topic, `ir_version debe ser ${MQTT_IR_VERSION}`);
      if (!esObjeto(payload.modelo)) return error(topic, 'modelo debe ser un objeto JSON');
      if (!Array.isArray(payload.modelo.elementos)) return error(topic, 'modelo.elementos debe ser una lista');
      if (!Array.isArray(payload.modelo.conexiones)) return error(topic, 'modelo.conexiones debe ser una lista');
      if (payload.modelo.elementos.length > MQTT_MAX_MODEL_ELEMENTS) {
        return error(topic, `modelo.elementos supera el límite de ${MQTT_MAX_MODEL_ELEMENTS}`);
      }
      if (payload.modelo.conexiones.length > MQTT_MAX_MODEL_CONNECTIONS) {
        return error(topic, `modelo.conexiones supera el límite de ${MQTT_MAX_MODEL_CONNECTIONS}`);
      }
      const validacionIr = validarIrV1(payload.modelo);
      if (!validacionIr.valido) {
        return error(topic, validacionIr.avisos[0].mensaje);
      }
      break;
    }
    case MQTT_TOPICS.MODELO_CONFIRMACION: {
      const idError = validarId(topic, payload);
      if (idError) return idError;
      if (!esTexto(payload.modelo_id)) return error(topic, 'modelo_id debe ser un texto no vacío');
      if (!esEnteroPositivo(payload.version)) return error(topic, 'version debe ser un entero positivo');
      if (payload.ir_version !== MQTT_IR_VERSION) return error(topic, `ir_version debe ser ${MQTT_IR_VERSION}`);
      if (typeof payload.aceptado !== 'boolean') return error(topic, 'aceptado debe ser booleano');
      if (payload.codigo !== undefined && !esTexto(payload.codigo)) return error(topic, 'codigo debe ser texto');
      if (payload.error !== undefined && !esTexto(payload.error)) return error(topic, 'error debe ser texto');
      break;
    }
    case MQTT_TOPICS.SIMULACION_ESTADO: {
      if (!esTexto(payload.modelo_id)) return error(topic, 'modelo_id debe ser un texto no vacío');
      if (!esEnteroPositivo(payload.version)) return error(topic, 'version debe ser un entero positivo');
      if (!esEnteroNoNegativo(payload.secuencia)) return error(topic, 'secuencia debe ser un entero no negativo');
      if (!ESTADOS_SIMULACION.has(payload.estado as EstadoSimulacion)) return error(topic, 'estado de simulación no válido');
      if (!esObjeto(payload.elementos)) return error(topic, 'elementos debe ser un objeto');
      if (payload.id_mensaje !== undefined && !esTexto(payload.id_mensaje)) return error(topic, 'id_mensaje debe ser texto');
      for (const [elementoId, estadoElemento] of Object.entries(payload.elementos)) {
        if (!esTexto(elementoId) || !esObjeto(estadoElemento)) return error(topic, 'cada estado de elemento debe ser un objeto');
        if (estadoElemento.valor !== undefined && !esValorMqtt(estadoElemento.valor)) return error(topic, `elementos.${elementoId}.valor no es válido`);
        if (estadoElemento.salida !== undefined && !esValorMqtt(estadoElemento.salida)) return error(topic, `elementos.${elementoId}.salida no es válida`);
        if (estadoElemento.tokens !== undefined && !esEnteroNoNegativo(estadoElemento.tokens)) return error(topic, `elementos.${elementoId}.tokens debe ser un entero no negativo`);
        if (estadoElemento.habilitada !== undefined && typeof estadoElemento.habilitada !== 'boolean') return error(topic, `elementos.${elementoId}.habilitada debe ser booleana`);
        if (estadoElemento.disparada !== undefined && typeof estadoElemento.disparada !== 'boolean') return error(topic, `elementos.${elementoId}.disparada debe ser booleana`);
      }
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
  [MQTT_TOPICS.SIMULACION_COMANDO]: { accion: 'paso', modelo_id: 'paso-token-01', version: 1, id_mensaje: 'sim-001' },
  [MQTT_TOPICS.ENTRADA_ESTABLECER]: { servicio_id: 'confirmacion', valor: true, modelo_id: 'paso-token-01', version: 1, id_mensaje: 'entrada-001' },
  [MQTT_TOPICS.MODELO_CARGAR]: {
    modelo_id: 'paso-token-01',
    version: 1,
    ir_version: MQTT_IR_VERSION,
    modelo: { elementos: [], conexiones: [] },
    id_mensaje: 'modelo-001',
  },
  [MQTT_TOPICS.MODELO_CONFIRMACION]: {
    modelo_id: 'paso-token-01',
    version: 1,
    ir_version: MQTT_IR_VERSION,
    aceptado: true,
    id_mensaje: 'modelo-001',
  },
  [MQTT_TOPICS.SIMULACION_ESTADO]: {
    modelo_id: 'paso-token-01',
    version: 1,
    secuencia: 3,
    estado: 'pausada',
    elementos: {
      confirmacion: { valor: true },
      validar: { salida: true },
      espera: { tokens: 0 },
      avanzar: { habilitada: true, disparada: true },
      confirmado: { tokens: 1 },
    },
    id_mensaje: 'sim-001',
  },
};

export const MQTT_VENTANA_DEDUPLICACION = 32;

export type DecisionInstantanea =
  | { aplicar: true; secuencia: number }
  | { aplicar: false; motivo: 'sin_sesion' | 'modelo_distinto' | 'version_distinta' | 'secuencia_antigua' };

/**
 * Administra la sesión activa (`modelo_id` y `version`) y descarta instantáneas
 * remotas repetidas, antiguas o pertenecientes a otro modelo/versión.
 */
export class ControlSecuenciaRemota {
  private modeloId: string | null = null;
  private version: number | null = null;
  private ultimaSecuencia = -1;

  activarModelo(modeloId: string, version: number): void {
    this.modeloId = modeloId;
    this.version = version;
    this.ultimaSecuencia = -1;
  }

  evaluar(estado: MensajeSimulacionEstado): DecisionInstantanea {
    if (this.modeloId === null || this.version === null) {
      return { aplicar: false, motivo: 'sin_sesion' };
    }
    if (estado.modelo_id !== this.modeloId) {
      return { aplicar: false, motivo: 'modelo_distinto' };
    }
    if (estado.version !== this.version) {
      return { aplicar: false, motivo: 'version_distinta' };
    }
    if (estado.secuencia <= this.ultimaSecuencia) {
      return { aplicar: false, motivo: 'secuencia_antigua' };
    }
    this.ultimaSecuencia = estado.secuencia;
    return { aplicar: true, secuencia: estado.secuencia };
  }

  obtenerUltimaSecuencia(): number {
    return this.ultimaSecuencia;
  }
}

/**
 * Conserva los últimos `capacidad` identificadores `id_mensaje` (por defecto 32)
 * para detectar entregas duplicadas de MQTT QoS 1.
 */
export class DeduplicadorMensajes<T = unknown> {
  private readonly capacidad: number;
  private readonly respuestas = new Map<string, T>();

  constructor(capacidad = MQTT_VENTANA_DEDUPLICACION) {
    this.capacidad = Math.max(1, capacidad);
  }

  esDuplicado(idMensaje: string): boolean {
    return this.respuestas.has(idMensaje);
  }

  obtenerRespuesta(idMensaje: string): T | undefined {
    return this.respuestas.get(idMensaje);
  }

  registrar(idMensaje: string, respuesta: T): void {
    if (this.respuestas.has(idMensaje)) {
      this.respuestas.delete(idMensaje);
    } else if (this.respuestas.size >= this.capacidad) {
      const masAntiguo = this.respuestas.keys().next().value;
      if (masAntiguo !== undefined) this.respuestas.delete(masAntiguo);
    }
    this.respuestas.set(idMensaje, respuesta);
  }

  limpiar(): void {
    this.respuestas.clear();
  }
}
