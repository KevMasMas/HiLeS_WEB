import { create } from 'zustand';
import { serializeModel } from '../domain/modelDocument';
import { BrowserWorker, construirExecutorIdNavegador, type EstadisticasBrowserWorker } from '../services/distributed/BrowserWorker';
import { topicsDistribuidosV3 } from '../services/distributed/topics';
import type {
  ComandoDespliegueV3,
  MensajeAckFragmentoV3,
  MensajeErrorDistribuidoV3,
  MensajeEstadoEjecutorV3,
  MensajeSnapshotParcialV3,
} from '../services/distributed/messages';
import { compilarDocumentoAIrV2 } from '../services/ir/compiladorIrV2';
import { particionarIrV2Distribuida, resolverAsignacionesDistribuidasV3, serializarCanonico } from '../services/ir/particionarIr';
import { PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION, type ManifiestoDespliegueV3 } from '../services/ir/tiposIrDistribuida';
import type { HilesNodeData, HilesNodeProperties } from '../types/hiles';
import { safeRandomUUID } from '../utils/uuid';
import {
  aceptarSnapshot,
  agregarSnapshots,
  cambioDestino,
  construirPlanDesdeNodos,
  ejecutoresDisponibles,
  type NodoHiles,
} from '../features/distributed/assignments';
import { TransporteMqttDistribuido } from '../features/distributed/distributedTransport';
import { useEditorStore } from './useEditorStore';

export interface ErrorVisibleDistribuido {
  id: string;
  codigo: string;
  mensaje: string;
  executorId?: string;
  elementId?: string;
  connectionId?: string;
  etapa?: string;
  instante: number;
}

interface DistributedExecutionState {
  projectId: string | null;
  conectado: boolean;
  ejecutores: Record<string, MensajeEstadoEjecutorV3>;
  /** Hora local (ms) del último estado recibido de cada ejecutor. */
  vistoEn: Record<string, number>;
  workerSessionId: string;
  workerExecutorId: string | null;
  workerHabilitado: boolean;
  workerStats: EstadisticasBrowserWorker | null;
  manifest: ManifiestoDespliegueV3 | null;
  acks: Record<string, MensajeAckFragmentoV3>;
  snapshots: Record<string, MensajeSnapshotParcialV3>;
  errores: ErrorVisibleDistribuido[];
  ejecutando: boolean;
  desplegando: boolean;
  errorLocal: string | null;
  mensaje: string | null;
  iniciar: (projectId: string) => () => void;
  habilitarWorker: (habilitar: boolean) => void;
  asignar: (nodoId: string, executorId: string | null) => void;
  desplegar: () => Promise<boolean>;
  retirarDespliegue: () => void;
  enviarComando: (comando: ComandoDespliegueV3) => boolean;
  enviarEntrada: (servicioId: string, valor: unknown) => boolean;
  limpiarErrores: () => void;
}

const CLAVE_SESION_WORKER = 'hiles_browser_executor_v1';
const MAX_ERRORES = 20;

/** Identidad del ejecutor: por pestaña e independiente del colaborador visual. */
const sesionWorker = (): string => {
  try {
    const previa = sessionStorage.getItem(CLAVE_SESION_WORKER);
    if (previa && /^[a-z0-9-]{4,32}$/.test(previa)) return previa;
    const nueva = safeRandomUUID().replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
    sessionStorage.setItem(CLAVE_SESION_WORKER, nueva);
    return nueva;
  } catch {
    return safeRandomUUID().replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  }
};

let control: TransporteMqttDistribuido | null = null;
let transporteWorker: TransporteMqttDistribuido | null = null;
let worker: BrowserWorker | null = null;
let liberarWorker: Array<() => void> = [];
let topicsDespliegue: string[] = [];

const parsear = <T,>(raw: string): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Refleja el estado agregado en el canvas sin tocar el documento compartido. */
const pintarEnCanvas = (): void => {
  const { manifest, snapshots, ejecutores } = useDistributedExecutionStore.getState();
  const vista = new Map(agregarSnapshots(manifest, snapshots, ejecutores).map((item) => [item.elementId, item]));
  useEditorStore.setState((estado) => {
    let cambio = false;
    const nodes = estado.nodes.map((nodo) => {
      const item = vista.get(nodo.id);
      if (!item) return nodo;
      const datos = item.estado ?? {};
      const runtime: NonNullable<HilesNodeData['runtime']> = {
        ...(datos.valor !== undefined ? { value: datos.valor as never } : {}),
        ...(datos.salida !== undefined ? { value: datos.salida as never } : {}),
        ...(datos.valor_retenido !== undefined ? { value: datos.valor_retenido as never } : {}),
        ...(typeof datos.tokens === 'number' ? { tokens: datos.tokens } : {}),
        ...(typeof datos.disparada === 'boolean' ? { active: datos.disparada } : {}),
        ...(typeof datos.error === 'string' ? { error: datos.error } : {}),
        ...(item.obsoleto ? { stale: true } : {}),
      };
      if (JSON.stringify(nodo.data.runtime ?? {}) === JSON.stringify(runtime)) return nodo;
      cambio = true;
      return { ...nodo, data: { ...nodo.data, runtime } };
    });
    return cambio ? { nodes } : {};
  });
};

const registrarError = (error: Omit<ErrorVisibleDistribuido, 'id' | 'instante'>): void => {
  useDistributedExecutionStore.setState((estado) => ({
    errores: [{ ...error, id: safeRandomUUID(), instante: Date.now() }, ...estado.errores].slice(0, MAX_ERRORES),
  }));
};

const suscribirDespliegue = (projectId: string, manifest: ManifiestoDespliegueV3 | null): void => {
  topicsDespliegue.forEach((topic) => control?.desuscribir(topic));
  topicsDespliegue = [];
  if (!manifest || !control) return;
  const base = `udfjc/hiles/v3/projects/${projectId}/deployments/${manifest.deployment_id}`;
  topicsDespliegue = [`${base}/ack/+`, `${base}/snapshot/+`, `${base}/error`];
  topicsDespliegue.forEach((topic) => control?.suscribir(topic));
};

const alMensajeControl = (topic: string, raw: string): void => {
  const estado = useDistributedExecutionStore.getState();
  const projectId = estado.projectId;
  if (!projectId) return;
  const base = `udfjc/hiles/v3/projects/${projectId}/`;
  if (!topic.startsWith(base)) return;
  const partes = topic.slice(base.length).split('/');

  if (partes[0] === 'executors' && partes[2] === 'status') {
    const mensaje = parsear<MensajeEstadoEjecutorV3>(raw);
    useDistributedExecutionStore.setState((actual) => {
      const ejecutores = { ...actual.ejecutores };
      const vistoEn = { ...actual.vistoEn };
      if (!mensaje) {
        delete ejecutores[partes[1]];
        delete vistoEn[partes[1]];
      } else if (mensaje.executor_id === partes[1] && mensaje.protocol_version === PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION) {
        ejecutores[partes[1]] = mensaje;
        vistoEn[partes[1]] = Date.now();
      }
      return { ejecutores, vistoEn };
    });
    pintarEnCanvas();
    return;
  }
  if (partes[0] !== 'deployments') return;
  if (partes[1] === 'manifest') {
    const manifest = parsear<ManifiestoDespliegueV3>(raw);
    if (manifest && manifest.project_id !== projectId) return;
    const anterior = estado.manifest;
    const mismo = anterior && manifest && anterior.deployment_id === manifest.deployment_id && anterior.epoch === manifest.epoch;
    useDistributedExecutionStore.setState({
      manifest,
      ...(mismo ? {} : { acks: {}, snapshots: {}, ejecutando: false }),
    });
    if (!mismo) suscribirDespliegue(projectId, manifest);
    pintarEnCanvas();
    return;
  }
  const manifest = estado.manifest;
  if (!manifest || partes[1] !== manifest.deployment_id) return;
  if (partes[2] === 'ack') {
    const ack = parsear<MensajeAckFragmentoV3>(raw);
    if (!ack || ack.epoch !== manifest.epoch || ack.executor_id !== partes[3]) return;
    useDistributedExecutionStore.setState((actual) => ({ acks: { ...actual.acks, [ack.executor_id]: ack } }));
    if (!ack.accepted && ack.error) {
      registrarError({ codigo: ack.error.codigo, mensaje: ack.error.mensaje, executorId: ack.executor_id, elementId: ack.error.elemento_id, etapa: 'fragment' });
    }
  } else if (partes[2] === 'snapshot') {
    const snapshot = parsear<MensajeSnapshotParcialV3>(raw);
    if (!snapshot || snapshot.executor_id !== partes[3]) return;
    if (!aceptarSnapshot(manifest, estado.snapshots[snapshot.executor_id], snapshot)) return;
    useDistributedExecutionStore.setState((actual) => ({ snapshots: { ...actual.snapshots, [snapshot.executor_id]: snapshot } }));
    pintarEnCanvas();
  } else if (partes[2] === 'error') {
    const error = parsear<MensajeErrorDistribuidoV3>(raw);
    if (!error || error.epoch !== manifest.epoch) return;
    registrarError({
      codigo: error.codigo,
      mensaje: error.mensaje,
      executorId: error.executor_id,
      elementId: error.element_id,
      connectionId: error.connection_id,
      etapa: error.stage,
    });
  }
};

const detenerWorker = (): void => {
  worker?.detener();
  liberarWorker.forEach((fn) => fn());
  liberarWorker = [];
  transporteWorker?.desconectar();
  worker = null;
  transporteWorker = null;
};

const arrancarWorker = (projectId: string, sessionId: string): void => {
  detenerWorker();
  const transporte = new TransporteMqttDistribuido();
  const nuevo = new BrowserWorker({ projectId, sessionId, transporte });
  transporteWorker = transporte;
  worker = nuevo;
  liberarWorker.push(nuevo.onEvento(() => useDistributedExecutionStore.setState({ workerStats: { ...nuevo.stats } })));
  transporte.conectar(BrowserWorker.payloadUltimaVoluntad(projectId, sessionId));
  nuevo.iniciar();
};

const publicarControl = (topic: string, payload: unknown, retain: boolean): boolean =>
  Boolean(control?.publicar(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), { qos: 1, retain }));

export const useDistributedExecutionStore = create<DistributedExecutionState>((set, get) => ({
  projectId: null,
  conectado: false,
  ejecutores: {},
  vistoEn: {},
  workerSessionId: sesionWorker(),
  workerExecutorId: null,
  workerHabilitado: false,
  workerStats: null,
  manifest: null,
  acks: {},
  snapshots: {},
  errores: [],
  ejecutando: false,
  desplegando: false,
  errorLocal: null,
  mensaje: null,

  iniciar: (projectId) => {
    control?.desconectar();
    suscribirDespliegue(projectId, null);
    const transporte = new TransporteMqttDistribuido();
    control = transporte;
    set({
      projectId,
      conectado: false,
      ejecutores: {},
      vistoEn: {},
      manifest: null,
      acks: {},
      snapshots: {},
      errores: [],
      ejecutando: false,
      errorLocal: null,
      workerExecutorId: construirExecutorIdNavegador(get().workerSessionId),
    });
    const quitarMensajes = transporte.onMensaje(alMensajeControl);
    const quitarConexion = transporte.onConexion((conectado) => {
      if (control === transporte) set({ conectado });
    });
    transporte.suscribir(topicsDistribuidosV3.executorStatusFilter(projectId));
    transporte.suscribir(topicsDistribuidosV3.manifest(projectId));
    transporte.conectar(null);
    if (get().workerHabilitado) arrancarWorker(projectId, get().workerSessionId);
    return () => {
      quitarMensajes();
      quitarConexion();
      if (control === transporte) {
        suscribirDespliegue(projectId, null);
        transporte.desconectar();
        control = null;
      }
      detenerWorker();
      set({ projectId: null, conectado: false });
    };
  },

  habilitarWorker: (habilitar) => {
    const { projectId, workerSessionId } = get();
    set({ workerHabilitado: habilitar, workerStats: null });
    if (habilitar && projectId) arrancarWorker(projectId, workerSessionId);
    else detenerWorker();
  },

  asignar: (nodoId, executorId) => {
    // Un solo cambio de propiedad: la colaboración v2 lo publica una vez y
    // los demás navegadores lo aplican por operationId sin duplicarlo.
    useEditorStore.getState().updateNodeProperties(nodoId, cambioDestino(executorId) as unknown as Partial<HilesNodeProperties>);
  },

  desplegar: async () => {
    const { projectId, manifest: anterior, ejecutores } = get();
    if (!projectId || !control?.conectado) {
      set({ errorLocal: 'No hay conexión con el broker: revisa MQTT antes de desplegar.' });
      return false;
    }
    set({ desplegando: true, errorLocal: null, mensaje: 'Compilando y particionando el modelo…' });
    try {
      const { nodes, edges } = useEditorStore.getState();
      const documento = serializeModel(nodes, edges);
      const compilado = compilarDocumentoAIrV2(documento, { modeloId: projectId, nombre: projectId });
      if (!compilado.valido || !compilado.modelo) {
        const primero = compilado.errores[0];
        registrarError({ codigo: primero?.codigo ?? 'IR_INVALIDA', mensaje: primero?.mensaje ?? 'El modelo no compila a IR v2.', elementId: primero?.elemento_id, etapa: 'manifest' });
        set({ errorLocal: `El modelo no compila: ${primero?.mensaje ?? 'error desconocido'}` });
        return false;
      }
      const plan = construirPlanDesdeNodos(nodes as NodoHiles[]);
      const resolucion = resolverAsignacionesDistribuidasV3({ documento, modelo: compilado.modelo, plan });
      const epoch = (anterior?.epoch ?? 0) + 1;
      const deploymentId = `dep-${Date.now().toString(36)}`;
      const resultado = resolucion.errores.length
        ? { ok: false as const, errors: resolucion.errores }
        : await particionarIrV2Distribuida({
          project_id: projectId,
          deployment_id: deploymentId,
          epoch,
          modelo: compilado.modelo,
          ejecutores: ejecutoresDisponibles(ejecutores),
          asignaciones: resolucion.asignaciones,
        });
      if (!resultado.ok) {
        resultado.errors.forEach((error) => registrarError({
          codigo: error.codigo,
          mensaje: error.mensaje,
          elementId: error.elemento_id,
          executorId: error.executor_id,
          connectionId: error.conexion_id,
          etapa: 'manifest',
        }));
        set({ errorLocal: `No se pudo desplegar: ${resultado.errors[0]?.mensaje ?? 'error de particionado'}` });
        return false;
      }
      // Se limpian los retenidos del despliegue anterior antes de la nueva época.
      if (anterior) {
        anterior.fragments.forEach((fragmento) => {
          publicarControl(topicsDistribuidosV3.fragment(projectId, anterior.deployment_id, fragmento.executor_id), '', true);
          publicarControl(topicsDistribuidosV3.ack(projectId, anterior.deployment_id, fragmento.executor_id), '', true);
        });
      }
      resultado.fragments.forEach((fragmento) => {
        publicarControl(topicsDistribuidosV3.fragment(projectId, deploymentId, fragmento.executor_id), serializarCanonico(fragmento), true);
      });
      publicarControl(topicsDistribuidosV3.manifest(projectId), resultado.manifest, true);
      set({ mensaje: `Despliegue ${deploymentId} (época ${epoch}) publicado; esperando ACK.` });
      return true;
    } catch (error) {
      set({ errorLocal: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      set({ desplegando: false });
    }
  },

  retirarDespliegue: () => {
    const { projectId, manifest } = get();
    if (!projectId || !manifest) return;
    publicarControl(topicsDistribuidosV3.command(projectId, manifest.deployment_id), {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION, project_id: projectId,
      deployment_id: manifest.deployment_id, epoch: manifest.epoch, command: 'stop', id_mensaje: safeRandomUUID(),
    }, false);
    manifest.fragments.forEach((fragmento) => {
      publicarControl(topicsDistribuidosV3.fragment(projectId, manifest.deployment_id, fragmento.executor_id), '', true);
      publicarControl(topicsDistribuidosV3.ack(projectId, manifest.deployment_id, fragmento.executor_id), '', true);
    });
    publicarControl(topicsDistribuidosV3.manifest(projectId), '', true);
    set({ mensaje: 'Despliegue retirado; los ejecutores liberaron sus fragmentos.' });
  },

  enviarComando: (comando) => {
    const { projectId, manifest } = get();
    if (!projectId || !manifest) return false;
    const ok = publicarControl(topicsDistribuidosV3.command(projectId, manifest.deployment_id), {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: projectId,
      deployment_id: manifest.deployment_id,
      epoch: manifest.epoch,
      command: comando,
      id_mensaje: safeRandomUUID(),
    }, false);
    if (ok && (comando === 'start' || comando === 'stop' || comando === 'reset')) set({ ejecutando: comando === 'start' });
    return ok;
  },

  enviarEntrada: (servicioId, valor) => {
    const { projectId, manifest } = get();
    if (!projectId || !manifest) return false;
    return publicarControl(topicsDistribuidosV3.input(projectId, manifest.deployment_id), {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: projectId,
      deployment_id: manifest.deployment_id,
      epoch: manifest.epoch,
      servicio_id: servicioId,
      valor,
      id_mensaje: safeRandomUUID(),
    }, false);
  },

  limpiarErrores: () => set({ errores: [], errorLocal: null }),
}));
