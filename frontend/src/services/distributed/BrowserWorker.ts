/**
 * Worker de navegador para la ejecución distribuida HiLeS v3 (Persona 3).
 *
 * Cumple el mismo contrato que `firmware/pico/hiles/distributed_worker.py`:
 * anuncia su estado, acepta únicamente el fragmento dirigido a su
 * `executorId`, verifica SHA-256 sobre los bytes recibidos, publica ACK,
 * intercambia canales remotos con los 7 pasos de validación del contrato y
 * publica snapshots parciales de sus propios elementos.
 *
 * El fragmento se ejecuta con `MotorSimulacion` sin modificarlo:
 * - cada ruta de entrada se conecta a un Service proxy local, de modo que una
 *   muestra remota recorre el mismo bus CCH/DCH/LCH que una conexión local;
 * - cada ruta de salida se observa en el bus del motor y se publica con la
 *   semántica remota de la Pico (CCH solo al cambiar, DCH por evento, LCH solo
 *   en pulsos verdaderos y `retardo_ms` como fecha límite).
 *
 * La identidad `browser:<sessionId>` es independiente del colaborador visual.
 */
import { MotorSimulacion } from '../../engine/MotorSimulacion';
import type { ValorRuntime } from '../../engine/tipos';
import { serializarCanonico, sha256 } from '../ir/particionarIr';
import {
  PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
  type CapacidadesEjecutorV3,
  type EstadoEjecutorV3,
  type FragmentoDespliegueV3,
  type ManifiestoDespliegueV3,
  type MensajeCanalDistribuidoV3,
  type RutaRemotaV3,
} from '../ir/tiposIrDistribuida';
import type {
  IrConexionV2,
  IrElementoV2,
  IrModeloV2,
  IrServiceElementV2,
  IrTipoDatoV2,
  IrValorRuntimeV2,
} from '../ir/tiposIrV2';
import { extraerElementosEstadoIrV2 } from '../ir/compiladorIrV2';
import { validarModeloIrV2, validarValorRuntimeIrV2 } from '../ir/validadorIrV2';
import type { MensajeAckFragmentoV3, MensajeErrorDistribuidoV3, MensajeSnapshotParcialV3 } from './messages';
import { topicsDistribuidosV3, validarSegmentoTopicV3 } from './topics';

export const BROWSER_WORKER_VERSION = '3.0.0';
export const PREFIJO_PROXY_REMOTO = '__remoto__';

const encoder = new TextEncoder();

/** Políticas QoS/retain del contrato v3 (§3). */
export const POLITICAS_V3 = {
  status: { qos: 1, retain: true },
  ack: { qos: 1, retain: true },
  channel: { qos: 1, retain: false },
  snapshot: { qos: 0, retain: false },
  error: { qos: 1, retain: false },
} as const;

export interface OpcionesPublicacionV3 {
  qos: 0 | 1;
  retain: boolean;
}

/** Transporte mínimo: el worker no conoce mqtt.js ni el broker concreto. */
export interface TransporteWorkerV3 {
  readonly conectado: boolean;
  publicar(topic: string, payload: string, opciones: OpcionesPublicacionV3): boolean;
  suscribir(topic: string): void;
  desuscribir(topic: string): void;
  onMensaje(handler: (topic: string, raw: string) => void): () => void;
  onConexion(handler: (conectado: boolean) => void): () => void;
}

export interface RelojWorker {
  ahoraMs(): number;
  programarIntervalo(fn: () => void, ms: number): unknown;
  cancelarIntervalo(handle: unknown): void;
}

export const relojNavegador: RelojWorker = {
  ahoraMs: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  programarIntervalo: (fn, ms) => setInterval(fn, ms),
  cancelarIntervalo: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export interface OpcionesBrowserWorker {
  projectId: string;
  sessionId: string;
  transporte: TransporteWorkerV3;
  reloj?: RelojWorker;
  intervaloPasoMs?: number;
  intervaloEstadoMs?: number;
  capacidades?: Partial<CapacidadesEjecutorV3>;
  capacidadDedup?: number;
  capacidadOutbox?: number;
  /** Fábrica inyectable para pruebas; por defecto `new MotorSimulacion()`. */
  crearMotor?: () => MotorSimulacion;
}

export interface EstadisticasBrowserWorker {
  executorId: string;
  estado: EstadoEjecutorV3;
  activeDeploymentId: string | null;
  activeEpoch: number | null;
  ownedElementIds: string[];
  fragmentsAccepted: number;
  fragmentsRejected: number;
  channelsPublished: number;
  channelsAccepted: number;
  channelsDiscarded: number;
  outboxPending: number;
  steps: number;
  lastError: string | null;
}

export type EventoBrowserWorker = { tipo: 'estado' | 'snapshot' | 'error' | 'ack'; detalle?: string };

export const construirExecutorIdNavegador = (sessionId: string): string =>
  validarSegmentoTopicV3(`browser:${sessionId}`, 'executorId');

/** SHA-256 hexadecimal de los bytes UTF-8 de un texto. */
export async function sha256Texto(texto: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(texto));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);
const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor.length > 0;
const esEntero = (valor: unknown): valor is number => typeof valor === 'number' && Number.isInteger(valor);

/** Igualdad con la semántica de `JSON.stringify`, como `same_value` en la Pico. */
export const mismoValorV3 = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return serializarCanonico(a) === serializarCanonico(b);
  }
  return false;
};

/**
 * IR que ejecuta el motor local: el fragmento más un Service proxy por ruta de
 * entrada. Los proxies nunca aparecen en snapshots ni se publican.
 */
export const construirModeloEjecutable = (fragmento: FragmentoDespliegueV3): IrModeloV2 => {
  const proxies: IrServiceElementV2[] = fragmento.inbound_routes.map((ruta) => ({
    id: `${PREFIJO_PROXY_REMOTO}${ruta.connection_id}`,
    tipo: 'service',
    nombre: `Entrada remota ${ruta.connection_id}`,
    tipo_dato: ruta.tipo_dato,
    salidas: ['out'],
    entradas: [],
  }));
  // En la Pico una ruta remota entrante entrega cada mensaje una sola vez al
  // inicio del paso. Un Service conectado por DCH emite únicamente las muestras
  // inyectadas, así que reproduce esa entrega única tanto para CCH como para DCH.
  // LCH se conserva como LCH para que el pulso hacia una Transition se limpie al
  // cerrar el paso.
  const conexiones: IrConexionV2[] = fragmento.inbound_routes.map((ruta) => ({
    id: `${PREFIJO_PROXY_REMOTO}${ruta.connection_id}`,
    tipo: ruta.tipo === 'lch' ? 'lch' : 'dch',
    origen: `${PREFIJO_PROXY_REMOTO}${ruta.connection_id}`,
    puerto_origen: 'out',
    destino: ruta.target_element_id,
    puerto_destino: ruta.target_port_id,
    ...(ruta.tipo === 'lch'
      ? {}
      : { capacidad_cola: ruta.tipo === 'dch' && typeof ruta.capacidad_cola === 'number' ? ruta.capacidad_cola : 32 }),
  }) as IrConexionV2);
  return {
    ...fragmento.modelo,
    elementos: [...fragmento.modelo.elementos, ...proxies] as IrElementoV2[],
    conexiones: [...fragmento.modelo.conexiones, ...conexiones],
  };
};

interface EntregaRemotaDiferida {
  ruta: RutaRemotaV3;
  valor: IrValorRuntimeV2;
  venceEnMs: number;
}

/**
 * Motor de un fragmento con puertos remotos. Encapsula `MotorSimulacion` y
 * reproduce las rutas remotas de `ChannelBus` de la Pico.
 */
export class MotorFragmentoNavegador {
  readonly motor: MotorSimulacion;
  readonly modeloEjecutable: IrModeloV2;
  readonly idsPropios: ReadonlySet<string>;
  private readonly rutasEntrada = new Map<string, RutaRemotaV3>();
  private readonly rutasSalidaPorPuerto = new Map<string, RutaRemotaV3[]>();
  private readonly servicios: ReadonlyMap<string, IrServiceElementV2>;
  private readonly ultimoCch = new Map<string, unknown>();
  private readonly muestrasServicio = new Map<string, IrValorRuntimeV2[]>();
  private diferidas: EntregaRemotaDiferida[] = [];

  readonly fragmento: FragmentoDespliegueV3;
  private readonly emitirRemoto: (ruta: RutaRemotaV3, valor: IrValorRuntimeV2) => void;

  constructor(
    fragmento: FragmentoDespliegueV3,
    emitirRemoto: (ruta: RutaRemotaV3, valor: IrValorRuntimeV2) => void,
    crearMotor: () => MotorSimulacion = () => new MotorSimulacion(),
  ) {
    this.fragmento = fragmento;
    this.emitirRemoto = emitirRemoto;
    this.modeloEjecutable = construirModeloEjecutable(fragmento);
    this.idsPropios = new Set(fragmento.modelo.elementos.map((elemento) => elemento.id));
    this.servicios = new Map(
      fragmento.modelo.elementos
        .filter((elemento): elemento is IrServiceElementV2 => elemento.tipo === 'service')
        .map((elemento) => [elemento.id, elemento]),
    );
    fragmento.inbound_routes.forEach((ruta) => this.rutasEntrada.set(ruta.connection_id, ruta));
    fragmento.outbound_routes.forEach((ruta) => {
      const clave = `${ruta.source_element_id}\u0000${ruta.source_port_id}`;
      this.rutasSalidaPorPuerto.set(clave, [...(this.rutasSalidaPorPuerto.get(clave) ?? []), ruta]);
    });

    this.motor = crearMotor();
    this.motor.construirDesdeIrV2(this.modeloEjecutable);
    const bus = this.motor.obtenerBus();
    const notificarOriginal = bus.notificar.bind(bus);
    bus.notificar = (nodoId: string, puertoId: string, valor: ValorRuntime) => {
      notificarOriginal(nodoId, puertoId, valor);
      const rutas = this.rutasSalidaPorPuerto.get(`${nodoId}\u0000${puertoId}`);
      rutas?.forEach((ruta) => this.alEmitir(ruta, nodoId, valor as IrValorRuntimeV2));
    };
  }

  /** Inyecta una entrada externa en un Service propio del fragmento. */
  establecerEntrada(servicioId: string, valor: unknown): void {
    const servicio = this.servicios.get(servicioId);
    if (!servicio) throw new Error(`El Service ${servicioId} no pertenece a este fragmento.`);
    const validado = validarValorRuntimeIrV2(valor, servicio.tipo_dato as IrTipoDatoV2);
    const resultado = this.motor.inyectarEntrada(servicioId, validado);
    if (!resultado.exito) throw new Error(resultado.mensaje);
    this.muestrasServicio.set(servicioId, [...(this.muestrasServicio.get(servicioId) ?? []), validado]);
  }

  /** Aplica un valor recibido por una ruta remota de entrada en el siguiente paso. */
  inyectarRemoto(connectionId: string, valor: IrValorRuntimeV2): void {
    const ruta = this.rutasEntrada.get(connectionId);
    if (!ruta) throw new Error(`La ruta remota ${connectionId} no pertenece a este fragmento.`);
    const resultado = this.motor.inyectarEntrada(`${PREFIJO_PROXY_REMOTO}${connectionId}`, valor);
    if (!resultado.exito) throw new Error(resultado.mensaje);
  }

  async paso(avanceMs: number): Promise<void> {
    const relojDestino = this.motor.obtenerRelojMs() + Math.max(0, Math.trunc(avanceMs));
    if (this.diferidas.length > 0) {
      const vencidas = this.diferidas.filter((entrega) => entrega.venceEnMs <= relojDestino);
      this.diferidas = this.diferidas.filter((entrega) => entrega.venceEnMs > relojDestino);
      vencidas.forEach((entrega) => this.entregar(entrega.ruta, entrega.valor));
    }
    try {
      await this.motor.paso(avanceMs);
    } finally {
      this.muestrasServicio.clear();
    }
  }

  reiniciar(): void {
    this.motor.reiniciar();
    this.ultimoCch.clear();
    this.muestrasServicio.clear();
    this.diferidas = [];
  }

  /** Estado observable únicamente de los elementos propietarios. */
  snapshot(): Record<string, unknown> {
    const completo = extraerElementosEstadoIrV2(this.modeloEjecutable, this.motor);
    const propio: Record<string, unknown> = {};
    for (const elemento of this.fragmento.modelo.elementos) {
      if (completo[elemento.id] !== undefined) propio[elemento.id] = completo[elemento.id];
    }
    return propio;
  }

  tieneTrabajoPendiente(): boolean {
    return this.diferidas.length > 0;
  }

  private alEmitir(ruta: RutaRemotaV3, origenId: string, valor: IrValorRuntimeV2): void {
    const retardo = ruta.retardo_ms ?? 0;
    if (this.servicios.has(origenId) && (ruta.tipo === 'dch' || ruta.tipo === 'lch')) {
      // Un Service solo emite eventos discretos por las muestras inyectadas en el paso.
      for (const muestra of this.muestrasServicio.get(origenId) ?? []) {
        if (retardo > 0) this.programar(ruta, muestra, retardo);
        else this.entregar(ruta, muestra);
      }
      return;
    }
    if (ruta.tipo === 'cch') {
      const teniaValor = this.ultimoCch.has(ruta.connection_id);
      const sinCambio = teniaValor && mismoValorV3(this.ultimoCch.get(ruta.connection_id), valor);
      this.ultimoCch.set(ruta.connection_id, valor);
      if (sinCambio) return;
      if (retardo > 0) {
        this.diferidas = this.diferidas.filter((entrega) => entrega.ruta.connection_id !== ruta.connection_id);
        this.programar(ruta, valor, retardo);
        return;
      }
      this.entregar(ruta, valor);
      return;
    }
    if (retardo > 0) this.programar(ruta, valor, retardo);
    else this.entregar(ruta, valor);
  }

  private programar(ruta: RutaRemotaV3, valor: IrValorRuntimeV2, retardo: number): void {
    this.diferidas.push({ ruta, valor, venceEnMs: this.motor.obtenerRelojMs() + retardo });
  }

  private entregar(ruta: RutaRemotaV3, valor: IrValorRuntimeV2): void {
    if (ruta.tipo === 'lch') {
      if (valor) this.emitirRemoto(ruta, true);
      return;
    }
    this.emitirRemoto(ruta, valor);
  }
}

interface FragmentoPendiente {
  topic: string;
  raw: string;
  payload: FragmentoDespliegueV3;
}

/** Ejecutor `browser:<sessionId>` con el mismo contrato que una Pico. */
export class BrowserWorker {
  readonly executorId: string;
  readonly projectId: string;
  estado: EstadoEjecutorV3 = 'offline';
  activeManifest: ManifiestoDespliegueV3 | null = null;
  activeFragment: FragmentoDespliegueV3 | null = null;
  activeFragmentHash: string | null = null;
  motor: MotorFragmentoNavegador | null = null;

  private readonly transporte: TransporteWorkerV3;
  private readonly reloj: RelojWorker;
  private readonly intervaloPasoMs: number;
  private readonly intervaloEstadoMs: number;
  private readonly capacidades: CapacidadesEjecutorV3;
  private readonly capacidadDedup: number;
  private readonly capacidadOutbox: number;
  private readonly crearMotor?: () => MotorSimulacion;
  private readonly listeners = new Set<(evento: EventoBrowserWorker) => void>();
  private readonly desuscriptores: Array<() => void> = [];
  private manifiestoPendiente: ManifiestoDespliegueV3 | null = null;
  private fragmentosPendientes = new Map<string, FragmentoPendiente>();
  private topicsDespliegue: string[] = [];
  private secuenciasSalida = new Map<string, number>();
  private secuenciasEntrada = new Map<string, number>();
  private dedupOrden: string[] = [];
  private dedup = new Set<string>();
  private outbox: Array<{ topic: string; payload: string }> = [];
  private secuenciaSnapshot = 0;
  private resincronizando = false;
  private ejecutando = false;
  private intervaloPaso: unknown = null;
  private intervaloEstado: unknown = null;
  private ultimoTick: number | null = null;
  private pasoEnCurso: Promise<void> | null = null;
  private cola: Promise<void> = Promise.resolve();
  private iniciado = false;
  readonly stats: EstadisticasBrowserWorker;

  constructor(opciones: OpcionesBrowserWorker) {
    this.projectId = validarSegmentoTopicV3(opciones.projectId, 'projectId');
    this.executorId = construirExecutorIdNavegador(opciones.sessionId);
    this.transporte = opciones.transporte;
    this.reloj = opciones.reloj ?? relojNavegador;
    this.intervaloPasoMs = opciones.intervaloPasoMs ?? 1000;
    this.intervaloEstadoMs = opciones.intervaloEstadoMs ?? 5000;
    this.capacidadDedup = opciones.capacidadDedup ?? 64;
    this.capacidadOutbox = opciones.capacidadOutbox ?? 32;
    this.crearMotor = opciones.crearMotor;
    this.capacidades = {
      ir_versions: [2],
      lenguajes: ['python', 'expresion'],
      max_fragment_bytes: 31744,
      max_elementos: 64,
      ...opciones.capacidades,
    };
    this.stats = {
      executorId: this.executorId,
      estado: this.estado,
      activeDeploymentId: null,
      activeEpoch: null,
      ownedElementIds: [],
      fragmentsAccepted: 0,
      fragmentsRejected: 0,
      channelsPublished: 0,
      channelsAccepted: 0,
      channelsDiscarded: 0,
      outboxPending: 0,
      steps: 0,
      lastError: null,
    };
  }

  // ------------------------------------------------------------------
  // Ciclo de vida.
  // ------------------------------------------------------------------

  /** Payload `offline` retenido que el transporte debe usar como Last Will. */
  static payloadUltimaVoluntad(projectId: string, sessionId: string): { topic: string; payload: string } {
    const executorId = construirExecutorIdNavegador(sessionId);
    return {
      topic: topicsDistribuidosV3.executorStatus(projectId, executorId),
      payload: JSON.stringify({
        protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
        project_id: projectId,
        executor_id: executorId,
        tipo: 'browser',
        estado: 'offline',
        version: BROWSER_WORKER_VERSION,
        capacidades: { ir_versions: [2], lenguajes: ['python', 'expresion'], max_fragment_bytes: 31744, max_elementos: 64 },
        last_seen_ms: 0,
      }),
    };
  }

  iniciar(): void {
    if (this.iniciado) return;
    this.iniciado = true;
    this.desuscriptores.push(this.transporte.onMensaje((topic, raw) => this.procesarMensaje(topic, raw)));
    this.desuscriptores.push(this.transporte.onConexion((conectado) => this.alCambiarConexion(conectado)));
    this.transporte.suscribir(topicsDistribuidosV3.manifest(this.projectId));
    this.transporte.suscribir(this.filtroFragmentos());
    this.intervaloEstado = this.reloj.programarIntervalo(() => this.publicarEstado(), this.intervaloEstadoMs);
    this.alCambiarConexion(this.transporte.conectado);
  }

  /** Libera el fragmento, publica `offline` y deja de escuchar. */
  detener(): void {
    if (!this.iniciado) return;
    this.detenerEjecucion();
    this.liberarFragmento(false);
    this.estado = 'offline';
    this.publicarEstado();
    this.transporte.desuscribir(topicsDistribuidosV3.manifest(this.projectId));
    this.transporte.desuscribir(this.filtroFragmentos());
    if (this.intervaloEstado !== null) this.reloj.cancelarIntervalo(this.intervaloEstado);
    this.intervaloEstado = null;
    this.desuscriptores.splice(0).forEach((fn) => fn());
    this.iniciado = false;
  }

  onEvento(listener: (evento: EventoBrowserWorker) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Espera a que se procesen los mensajes recibidos hasta ahora (pruebas). */
  async esperarInactividad(): Promise<void> {
    let actual: Promise<void>;
    do {
      actual = this.cola;
      await actual;
      if (this.pasoEnCurso) await this.pasoEnCurso;
    } while (actual !== this.cola);
  }

  private encolar(tarea: () => Promise<void> | void): void {
    this.cola = this.cola.then(tarea).catch((error: unknown) => {
      this.registrarError(error instanceof Error ? error.message : String(error));
    });
  }

  private emitir(evento: EventoBrowserWorker): void {
    this.actualizarStats();
    this.listeners.forEach((listener) => listener(evento));
  }

  private filtroFragmentos(): string {
    return `udfjc/hiles/v3/projects/${this.projectId}/deployments/+/fragments/${this.executorId}`;
  }

  private alCambiarConexion(conectado: boolean): void {
    if (!this.iniciado) return;
    if (!conectado) {
      this.estado = this.activeFragment ? 'degraded' : 'offline';
      this.emitir({ tipo: 'estado' });
      return;
    }
    if (this.activeFragment) {
      // Al volver el broker no se aceptan canales hasta releer manifiesto y fragmento.
      this.resincronizando = true;
      this.estado = 'deploying';
    } else {
      this.estado = 'online';
    }
    this.publicarEstado();
    this.vaciarOutbox();
  }

  // ------------------------------------------------------------------
  // Estado y publicaciones.
  // ------------------------------------------------------------------

  capacidadesPublicadas(): CapacidadesEjecutorV3 {
    return { ...this.capacidades, ir_versions: [...this.capacidades.ir_versions], lenguajes: [...this.capacidades.lenguajes] };
  }

  publicarEstado(): boolean {
    const payload: Record<string, unknown> = {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: this.projectId,
      executor_id: this.executorId,
      tipo: 'browser',
      estado: this.estado,
      version: BROWSER_WORKER_VERSION,
      capacidades: this.capacidadesPublicadas(),
      last_seen_ms: Math.round(this.reloj.ahoraMs()),
    };
    if (this.activeFragment) {
      payload.active_deployment_id = this.activeFragment.deployment_id;
      payload.active_epoch = this.activeFragment.epoch;
    }
    this.emitir({ tipo: 'estado' });
    return this.publicarJson(topicsDistribuidosV3.executorStatus(this.projectId, this.executorId), payload, POLITICAS_V3.status);
  }

  private publicarJson(topic: string, payload: unknown, politica: OpcionesPublicacionV3): boolean {
    if (!this.transporte.conectado) return false;
    return this.transporte.publicar(topic, JSON.stringify(payload), politica);
  }

  private publicarAck(deploymentId: string, epoch: number, fragmentId: string, aceptado: boolean, hash: string, error?: MensajeAckFragmentoV3['error']): void {
    const ack: MensajeAckFragmentoV3 = {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: this.projectId,
      deployment_id: deploymentId,
      epoch,
      executor_id: this.executorId,
      fragment_id: fragmentId,
      accepted: aceptado,
      fragment_hash: hash,
      ...(error ? { error } : {}),
    };
    this.publicarJson(topicsDistribuidosV3.ack(this.projectId, deploymentId, this.executorId), ack, POLITICAS_V3.ack);
    this.emitir({ tipo: 'ack', detalle: aceptado ? 'aceptado' : error?.mensaje });
  }

  private publicarError(
    codigo: string,
    mensaje: string,
    detalle: Partial<Pick<MensajeErrorDistribuidoV3, 'deployment_id' | 'epoch' | 'fragment_id' | 'connection_id' | 'element_id' | 'stage'>> = {},
  ): void {
    this.registrarError(`${codigo}: ${mensaje}`);
    const deploymentId = detalle.deployment_id ?? this.activeFragment?.deployment_id;
    if (!esTexto(deploymentId)) return;
    const payload: MensajeErrorDistribuidoV3 = {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: this.projectId,
      deployment_id: deploymentId,
      epoch: detalle.epoch ?? this.activeFragment?.epoch ?? 0,
      executor_id: this.executorId,
      codigo,
      mensaje,
      stage: detalle.stage ?? 'runtime',
      ...(detalle.fragment_id ?? this.activeFragment?.fragment_id
        ? { fragment_id: detalle.fragment_id ?? this.activeFragment?.fragment_id }
        : {}),
      ...(detalle.connection_id ? { connection_id: detalle.connection_id } : {}),
      ...(detalle.element_id ? { element_id: detalle.element_id } : {}),
    };
    this.publicarJson(topicsDistribuidosV3.error(this.projectId, deploymentId), payload, POLITICAS_V3.error);
  }

  private registrarError(texto: string): void {
    this.stats.lastError = texto;
    this.emitir({ tipo: 'error', detalle: texto });
  }

  publicarSnapshotParcial(): boolean {
    if (!this.activeFragment || !this.motor) return false;
    this.secuenciaSnapshot += 1;
    const payload: MensajeSnapshotParcialV3 = {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: this.projectId,
      deployment_id: this.activeFragment.deployment_id,
      epoch: this.activeFragment.epoch,
      executor_id: this.executorId,
      sequence: this.secuenciaSnapshot,
      elements: this.motor.snapshot(),
    };
    this.emitir({ tipo: 'snapshot' });
    return this.publicarJson(
      topicsDistribuidosV3.snapshot(this.projectId, this.activeFragment.deployment_id, this.executorId),
      payload,
      POLITICAS_V3.snapshot,
    );
  }

  // ------------------------------------------------------------------
  // Recepción.
  // ------------------------------------------------------------------

  /** Punto de entrada único: los mensajes se procesan en orden de llegada. */
  procesarMensaje(topic: string, raw: string): void {
    this.encolar(() => this.alRecibir(topic, raw));
  }

  private async alRecibir(topic: string, raw: string): Promise<void> {
    const base = `udfjc/hiles/v3/projects/${this.projectId}/`;
    if (!topic.startsWith(base)) return;
    const segmentos = topic.slice(base.length).split('/');
    let payload: unknown = null;
    if (raw.length > 0) {
      try {
        payload = JSON.parse(raw);
      } catch {
        this.registrarError(`Mensaje no JSON descartado en ${topic}.`);
        return;
      }
    }
    if (segmentos[0] !== 'deployments') return;
    if (segmentos.length === 2 && segmentos[1] === 'manifest') {
      await this.alRecibirManifiesto(payload);
    } else if (segmentos.length === 4 && segmentos[2] === 'fragments' && segmentos[3] === this.executorId) {
      await this.alRecibirFragmento(topic, raw, payload);
    } else if (segmentos.length === 4 && segmentos[2] === 'channels') {
      this.alRecibirCanal(payload);
    } else if (segmentos.length === 3 && segmentos[2] === 'command') {
      this.alRecibirComando(payload);
    } else if (segmentos.length === 3 && segmentos[2] === 'input') {
      this.alRecibirEntrada(payload);
    }
  }

  private async alRecibirManifiesto(payload: unknown): Promise<void> {
    if (payload === null) {
      // Retained vacío: limpieza explícita del despliegue.
      this.manifiestoPendiente = null;
      if (this.activeFragment) this.liberarFragmento(true);
      return;
    }
    if (!esObjeto(payload)) return;
    if (payload.protocol_version !== PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION || payload.project_id !== this.projectId) return;
    const manifiesto = payload as unknown as ManifiestoDespliegueV3;
    if (!esTexto(manifiesto.deployment_id) || !esEntero(manifiesto.epoch) || manifiesto.epoch < 1) {
      this.publicarError('DISTRIBUCION_IDENTIFICADOR_INVALIDO', 'Manifiesto con deployment_id o epoch inválido.', { stage: 'manifest' });
      return;
    }
    const activo = this.activeFragment;
    if (activo && manifiesto.epoch < activo.epoch) return;
    if (
      this.resincronizando
      && activo
      && manifiesto.deployment_id === activo.deployment_id
      && manifiesto.epoch === activo.epoch
    ) {
      this.activeManifest = manifiesto;
      return;
    }
    const meIncluye = Array.isArray(manifiesto.fragments)
      && manifiesto.fragments.some((resumen) => resumen.executor_id === this.executorId);
    if (activo && manifiesto.epoch > activo.epoch && !meIncluye) {
      this.manifiestoPendiente = manifiesto;
      this.liberarFragmento(true);
      return;
    }
    this.manifiestoPendiente = manifiesto;
    const clave = `${manifiesto.deployment_id}\u0000${manifiesto.epoch}`;
    const pendiente = this.fragmentosPendientes.get(clave);
    if (pendiente) {
      this.fragmentosPendientes.delete(clave);
      await this.aplicarFragmento(manifiesto, pendiente);
    }
  }

  private async alRecibirFragmento(topic: string, raw: string, payload: unknown): Promise<void> {
    if (payload === null) {
      if (this.activeFragment && topic === topicsDistribuidosV3.fragment(this.projectId, this.activeFragment.deployment_id, this.executorId)) {
        this.liberarFragmento(true);
      }
      return;
    }
    if (!esObjeto(payload)) return;
    if (payload.protocol_version !== PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION || payload.project_id !== this.projectId) return;
    const fragmento = payload as unknown as FragmentoDespliegueV3;
    if (!esTexto(fragmento.deployment_id) || !esEntero(fragmento.epoch)) return;
    if (this.activeFragment && fragmento.epoch < this.activeFragment.epoch) return;
    const manifiesto = this.manifiestoPendiente ?? this.activeManifest;
    if (manifiesto && manifiesto.deployment_id === fragmento.deployment_id && manifiesto.epoch === fragmento.epoch) {
      await this.aplicarFragmento(manifiesto, { topic, raw, payload: fragmento });
      return;
    }
    // El fragmento llegó antes que su manifiesto: se conserva acotado.
    this.fragmentosPendientes.set(`${fragmento.deployment_id}\u0000${fragmento.epoch}`, { topic, raw, payload: fragmento });
    while (this.fragmentosPendientes.size > 4) {
      const primera = this.fragmentosPendientes.keys().next().value as string;
      this.fragmentosPendientes.delete(primera);
    }
  }

  private async aplicarFragmento(manifiesto: ManifiestoDespliegueV3, pendiente: FragmentoPendiente): Promise<void> {
    const fragmento = pendiente.payload;
    const fragmentId = fragmento.fragment_id || `${fragmento.deployment_id}:${this.executorId}`;
    let hash = await sha256Texto(pendiente.raw);

    if (
      this.activeFragment
      && fragmento.deployment_id === this.activeFragment.deployment_id
      && fragmento.epoch === this.activeFragment.epoch
      && hash === this.activeFragmentHash
    ) {
      // Reconexión o redespliegue idéntico: ACK idempotente sin reiniciar el estado.
      this.resincronizando = false;
      this.estado = this.ejecutando ? 'running' : 'ready';
      this.publicarAck(fragmento.deployment_id, fragmento.epoch, fragmentId, true, hash);
      this.publicarEstado();
      return;
    }

    const rechazar = (codigo: NonNullable<MensajeAckFragmentoV3['error']>['codigo'], mensaje: string, elementoId?: string) => {
      this.stats.fragmentsRejected += 1;
      this.publicarAck(fragmento.deployment_id, fragmento.epoch, fragmentId, false, hash, {
        codigo,
        mensaje,
        executor_id: this.executorId,
        ...(elementoId ? { elemento_id: elementoId } : {}),
      });
      this.publicarError(codigo, mensaje, {
        deployment_id: fragmento.deployment_id,
        epoch: fragmento.epoch,
        fragment_id: fragmentId,
        stage: 'fragment',
        ...(elementoId ? { element_id: elementoId } : {}),
      });
    };

    if (fragmento.executor_id !== this.executorId || fragmento.owner_executor_id !== this.executorId) {
      rechazar('DISTRIBUCION_ASIGNACION_INVALIDA', `El fragmento está dirigido a ${fragmento.executor_id} (propietario ${fragmento.owner_executor_id}), no a ${this.executorId}.`);
      return;
    }
    const resumen = manifiesto.fragments?.find((item) => item.executor_id === this.executorId);
    if (!resumen) {
      rechazar('DISTRIBUCION_DESTINO_INEXISTENTE', `El manifiesto no declara un fragmento para ${this.executorId}.`);
      return;
    }
    if (resumen.hash?.toLowerCase() !== hash) {
      const canonico = await sha256(fragmento);
      if (resumen.hash?.toLowerCase() !== canonico) {
        rechazar('DISTRIBUCION_MODELO_INVALIDO', `Hash SHA-256 del fragmento (${hash}) no coincide con el manifiesto (${resumen.hash}).`);
        return;
      }
      hash = canonico;
    }
    const tamano = encoder.encode(pendiente.raw).byteLength;
    if (tamano > this.capacidades.max_fragment_bytes) {
      rechazar('DISTRIBUCION_CAPACIDAD_EXCEDIDA', `El fragmento ocupa ${tamano} bytes y supera el límite ${this.capacidades.max_fragment_bytes} de ${this.executorId}.`);
      return;
    }
    const modelo = fragmento.modelo;
    if (!esObjeto(modelo) || !Array.isArray(modelo.elementos)) {
      rechazar('DISTRIBUCION_MODELO_INVALIDO', 'El fragmento no incluye un objeto modelo IR v2.');
      return;
    }
    const irVersion = modelo.ir_version ?? 2;
    if (!this.capacidades.ir_versions.includes(irVersion)) {
      rechazar('DISTRIBUCION_CAPACIDAD_EXCEDIDA', `El ejecutor ${this.executorId} no soporta ir_version ${irVersion}.`);
      return;
    }
    if (modelo.elementos.length > this.capacidades.max_elementos) {
      rechazar('DISTRIBUCION_CAPACIDAD_EXCEDIDA', `El fragmento contiene ${modelo.elementos.length} elementos y supera el máximo ${this.capacidades.max_elementos}.`);
      return;
    }
    const lenguajeNoSoportado = modelo.elementos.find(
      (elemento) => elemento.tipo === 'functional_block' && !this.capacidades.lenguajes.includes(elemento.lenguaje),
    );
    if (lenguajeNoSoportado) {
      rechazar('DISTRIBUCION_CAPACIDAD_EXCEDIDA', `El ejecutor ${this.executorId} no soporta el lenguaje del bloque ${lenguajeNoSoportado.id}.`, lenguajeNoSoportado.id);
      return;
    }
    const ajeno = modelo.elementos.find((elemento) => manifiesto.owners?.[elemento.id] !== this.executorId);
    if (ajeno) {
      rechazar('DISTRIBUCION_ASIGNACION_INVALIDA', `El elemento ${ajeno.id} no pertenece a ${this.executorId} según el manifiesto.`, ajeno.id);
      return;
    }
    if (!Array.isArray(fragmento.inbound_routes) || !Array.isArray(fragmento.outbound_routes)) {
      rechazar('DISTRIBUCION_MODELO_INVALIDO', 'inbound_routes y outbound_routes deben ser listas.');
      return;
    }
    const validacion = validarModeloIrV2(modelo);
    if (!validacion.ok) {
      rechazar('DISTRIBUCION_MODELO_INVALIDO', `${validacion.errores[0]?.codigo ?? 'IR_INVALIDA'}: ${validacion.errores[0]?.mensaje ?? 'IR v2 inválida'}`, validacion.errores[0]?.elemento_id);
      return;
    }

    let motor: MotorFragmentoNavegador;
    try {
      motor = new MotorFragmentoNavegador(fragmento, (ruta, valor) => this.alEmitirRemoto(ruta, valor), this.crearMotor);
    } catch (error) {
      rechazar('DISTRIBUCION_MODELO_INVALIDO', `Error construyendo el motor del fragmento: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    // Sustitución atómica: el fragmento anterior solo se descarta ahora.
    this.detenerEjecucion();
    this.estado = 'deploying';
    this.activeManifest = manifiesto;
    this.manifiestoPendiente = null;
    this.activeFragment = fragmento;
    this.activeFragmentHash = hash;
    this.motor = motor;
    this.secuenciasSalida = new Map();
    this.secuenciasEntrada = new Map();
    this.dedup = new Set();
    this.dedupOrden = [];
    this.outbox = [];
    this.secuenciaSnapshot = 0;
    this.resincronizando = false;
    this.fragmentosPendientes.clear();
    this.reenlazarTopicsDespliegue(fragmento);
    this.stats.fragmentsAccepted += 1;
    this.estado = 'ready';
    this.publicarAck(fragmento.deployment_id, fragmento.epoch, fragmentId, true, hash);
    this.publicarEstado();
    this.publicarSnapshotParcial();
  }

  private reenlazarTopicsDespliegue(fragmento: FragmentoDespliegueV3 | null): void {
    this.topicsDespliegue.forEach((topic) => this.transporte.desuscribir(topic));
    this.topicsDespliegue = [];
    if (!fragmento) return;
    // Solo se escuchan las rutas que llegan a este worker: sus propias salidas
    // nunca vuelven como entrada (sin eco).
    this.topicsDespliegue = [
      topicsDistribuidosV3.command(this.projectId, fragmento.deployment_id),
      topicsDistribuidosV3.input(this.projectId, fragmento.deployment_id),
      ...fragmento.inbound_routes.map((ruta) => ruta.topic || topicsDistribuidosV3.channel(this.projectId, fragmento.deployment_id, ruta.connection_id)),
    ];
    this.topicsDespliegue.forEach((topic) => this.transporte.suscribir(topic));
  }

  /** Libera el fragmento activo; el worker queda disponible para otro despliegue. */
  liberarFragmento(publicar = true): void {
    this.detenerEjecucion();
    this.reenlazarTopicsDespliegue(null);
    this.activeFragment = null;
    this.activeFragmentHash = null;
    this.activeManifest = null;
    this.motor = null;
    this.outbox = [];
    this.resincronizando = false;
    this.estado = this.transporte.conectado ? 'online' : 'offline';
    if (publicar) this.publicarEstado();
    else this.emitir({ tipo: 'estado' });
  }

  // ------------------------------------------------------------------
  // Canales remotos.
  // ------------------------------------------------------------------

  private alEmitirRemoto(ruta: RutaRemotaV3, valor: IrValorRuntimeV2): void {
    const fragmento = this.activeFragment;
    if (!fragmento) return;
    const secuencia = (this.secuenciasSalida.get(ruta.connection_id) ?? 0) + 1;
    this.secuenciasSalida.set(ruta.connection_id, secuencia);
    const mensaje: MensajeCanalDistribuidoV3 = {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: this.projectId,
      deployment_id: fragmento.deployment_id,
      epoch: fragmento.epoch,
      message_id: `${this.executorId}:${ruta.connection_id}:${secuencia}`,
      connection_id: ruta.connection_id,
      owner_executor_id: this.executorId,
      sequence: secuencia,
      value: JSON.parse(JSON.stringify(valor)) as IrValorRuntimeV2,
    };
    if (this.outbox.length >= this.capacidadOutbox) this.outbox.shift();
    this.outbox.push({
      topic: ruta.topic || topicsDistribuidosV3.channel(this.projectId, fragmento.deployment_id, ruta.connection_id),
      payload: JSON.stringify(mensaje),
    });
  }

  private vaciarOutbox(): void {
    while (this.outbox.length > 0 && this.transporte.conectado) {
      const siguiente = this.outbox[0];
      if (!this.transporte.publicar(siguiente.topic, siguiente.payload, POLITICAS_V3.channel)) break;
      this.outbox.shift();
      this.stats.channelsPublished += 1;
    }
  }

  private descartar(): void {
    this.stats.channelsDiscarded += 1;
  }

  /** Valida un mensaje de canal en el orden del contrato v3 (§6). */
  private alRecibirCanal(payload: unknown): void {
    const fragmento = this.activeFragment;
    if (!esObjeto(payload) || !fragmento || !this.motor || this.resincronizando) {
      this.descartar();
      return;
    }
    // 1 y 2. Protocolo, proyecto, despliegue y época activos.
    if (
      payload.protocol_version !== PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION
      || payload.project_id !== this.projectId
      || payload.deployment_id !== fragmento.deployment_id
      || payload.epoch !== fragmento.epoch
    ) {
      this.descartar();
      return;
    }
    // 3. Conexión declarada en inbound_routes.
    const connectionId = payload.connection_id;
    const ruta = esTexto(connectionId)
      ? fragmento.inbound_routes.find((item) => item.connection_id === connectionId)
      : undefined;
    if (!ruta || !esTexto(connectionId)) {
      this.descartar();
      this.publicarError('CANAL_CONEXION_NO_DECLARADA', `La conexión ${String(connectionId)} no pertenece a las inbound_routes de ${this.executorId}.`, { stage: 'channel' });
      return;
    }
    // 4. Propietario autorizado.
    if (payload.owner_executor_id !== ruta.source_executor_id) {
      this.descartar();
      this.publicarError('CANAL_PROPIETARIO_INVALIDO', `El emisor ${String(payload.owner_executor_id)} no es el propietario autorizado (${ruta.source_executor_id}) de ${connectionId}.`, { stage: 'channel', connection_id: connectionId });
      return;
    }
    // 5. Valor compatible con tipo_dato y límites.
    let valor: IrValorRuntimeV2;
    try {
      valor = validarValorRuntimeIrV2(payload.value, ruta.tipo_dato);
    } catch (error) {
      this.descartar();
      this.publicarError('VALOR_TIPO_INVALIDO', `Valor inválido en canal ${connectionId}: ${error instanceof Error ? error.message : String(error)}`, { stage: 'channel', connection_id: connectionId });
      return;
    }
    // 6 y 7. Secuencia creciente y deduplicación por message_id.
    const messageId = payload.message_id;
    const secuencia = payload.sequence;
    if (!esTexto(messageId) || !esEntero(secuencia) || secuencia < 1 || this.dedup.has(messageId)) {
      this.descartar();
      return;
    }
    if (secuencia <= (this.secuenciasEntrada.get(connectionId) ?? 0)) {
      this.descartar();
      return;
    }
    this.secuenciasEntrada.set(connectionId, secuencia);
    this.dedup.add(messageId);
    this.dedupOrden.push(messageId);
    while (this.dedupOrden.length > this.capacidadDedup) {
      this.dedup.delete(this.dedupOrden.shift()!);
    }
    try {
      this.motor.inyectarRemoto(connectionId, valor);
      this.stats.channelsAccepted += 1;
    } catch (error) {
      this.descartar();
      this.publicarError('ENTRADA_HILES_RECHAZADA', error instanceof Error ? error.message : String(error), { stage: 'channel', connection_id: connectionId });
    }
  }

  // ------------------------------------------------------------------
  // Comandos y entradas.
  // ------------------------------------------------------------------

  private validoParaDespliegueActivo(payload: unknown): payload is Record<string, unknown> {
    const fragmento = this.activeFragment;
    return esObjeto(payload)
      && !!fragmento
      && !this.resincronizando
      && payload.protocol_version === PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION
      && payload.project_id === this.projectId
      && payload.deployment_id === fragmento.deployment_id
      && payload.epoch === fragmento.epoch;
  }

  private alRecibirComando(payload: unknown): void {
    if (!this.validoParaDespliegueActivo(payload)) return;
    const comando = payload.command;
    if (comando === 'start') this.iniciarEjecucion();
    else if (comando === 'stop') {
      this.detenerEjecucion();
      this.estado = 'ready';
      this.publicarEstado();
      this.publicarSnapshotParcial();
    } else if (comando === 'reset') {
      this.detenerEjecucion();
      this.motor?.reiniciar();
      this.secuenciasSalida = new Map();
      this.secuenciasEntrada = new Map();
      this.dedup = new Set();
      this.dedupOrden = [];
      this.outbox = [];
      this.estado = 'ready';
      this.publicarEstado();
      this.publicarSnapshotParcial();
    } else if (comando === 'step') {
      void this.ejecutarPaso();
    } else {
      this.publicarError('COMANDO_RECHAZADO', `Comando distribuido no soportado: ${String(comando)}.`, { stage: 'command' });
    }
  }

  private alRecibirEntrada(payload: unknown): void {
    if (!this.validoParaDespliegueActivo(payload) || !this.motor) return;
    const servicioId = payload.servicio_id;
    // En el tópico compartido de entradas cada worker ignora Services ajenos.
    if (!esTexto(servicioId) || !this.motor.idsPropios.has(servicioId)) return;
    try {
      this.motor.establecerEntrada(servicioId, payload.valor);
    } catch (error) {
      this.publicarError('ENTRADA_HILES_RECHAZADA', error instanceof Error ? error.message : String(error), { stage: 'input', element_id: servicioId });
    }
  }

  private iniciarEjecucion(): void {
    if (this.ejecutando) return;
    this.ejecutando = true;
    this.ultimoTick = this.reloj.ahoraMs();
    this.intervaloPaso = this.reloj.programarIntervalo(() => {
      // Si el paso anterior aún no termina, se omite este tick: nunca se acumulan pasos.
      if (!this.pasoEnCurso) void this.ejecutarPaso();
    }, this.intervaloPasoMs);
    this.estado = 'running';
    this.publicarEstado();
    this.publicarSnapshotParcial();
  }

  private detenerEjecucion(): void {
    this.ejecutando = false;
    if (this.intervaloPaso !== null) this.reloj.cancelarIntervalo(this.intervaloPaso);
    this.intervaloPaso = null;
  }

  /** Un paso acotado; el avance de tiempo se mide con el reloj del navegador. */
  ejecutarPaso(): Promise<void> {
    if (this.pasoEnCurso) return this.pasoEnCurso;
    const motor = this.motor;
    if (!motor) return Promise.resolve();
    const ahora = this.reloj.ahoraMs();
    const avance = this.ultimoTick === null ? 0 : Math.max(0, ahora - this.ultimoTick);
    this.ultimoTick = ahora;
    this.pasoEnCurso = motor
      .paso(avance)
      .then(() => {
        if (this.motor !== motor) return;
        this.stats.steps += 1;
        this.vaciarOutbox();
        this.publicarSnapshotParcial();
      })
      .catch((error: unknown) => {
        this.publicarError('ERROR_INTERNO_MOTOR', error instanceof Error ? error.message : String(error), { stage: 'runtime' });
      })
      .finally(() => {
        this.pasoEnCurso = null;
      });
    return this.pasoEnCurso;
  }

  private actualizarStats(): void {
    this.stats.estado = this.estado;
    this.stats.activeDeploymentId = this.activeFragment?.deployment_id ?? null;
    this.stats.activeEpoch = this.activeFragment?.epoch ?? null;
    this.stats.ownedElementIds = this.activeFragment?.modelo.elementos.map((elemento) => elemento.id) ?? [];
    this.stats.outboxPending = this.outbox.length;
  }
}
