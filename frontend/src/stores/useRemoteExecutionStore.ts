import { create } from 'zustand';
import { serializeModel } from '../domain/modelDocument';
import { compilarDocumentoAIrV2 } from '../services/ir';
import { mqttClient } from '../services/mqtt/MqttClient';
import { RemoteExecutionClient } from '../services/mqtt/RemoteExecutionClient';
import type { AccionSimulacion, ValorMensajeMqtt } from '../services/mqtt/messages';
import type { EstadoSimulacion as EstadoSimulacionRemota } from '../services/mqtt/messages';
import type { MqttConnectionStatus } from '../services/mqtt/config';
import { useEditorStore } from './useEditorStore';
import { useSimulationStore } from './useSimulationStore';

const remoteClient = new RemoteExecutionClient(mqttClient);

const parametrosIniciales = (): { modeloId: string; version: number } => {
  if (typeof window === 'undefined') return { modeloId: 'cruce-01', version: 1 };
  const params = new URLSearchParams(window.location.search);
  const version = Number(params.get('version'));
  return {
    modeloId: params.get('modelo')?.trim() || params.get('project')?.trim() || 'cruce-01',
    version: Number.isInteger(version) && version > 0 ? version : 1,
  };
};

const actualizarUrlSesion = (modeloId: string, version: number): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('modelo', modeloId);
  url.searchParams.set('version', String(version));
  window.history.replaceState(null, '', url);
};

interface RemoteExecutionState {
  modeloId: string;
  version: number;
  sesionActiva: boolean;
  mqttEstado: MqttConnectionStatus;
  secuencia: number;
  estadoRemoto: EstadoSimulacionRemota | null;
  modeloAceptado: boolean | null;
  mensaje: string | null;
  activarSesion: (modeloId: string, version: number) => boolean;
  desactivar: () => void;
  cargarModeloActual: () => boolean;
  enviarComando: (accion: AccionSimulacion) => boolean;
  establecerEntrada: (servicioId: string, valor: ValorMensajeMqtt) => boolean;
  obtenerEnlaceSesion: () => string;
}

const inicial = parametrosIniciales();

export const useRemoteExecutionStore = create<RemoteExecutionState>((set, get) => ({
  modeloId: inicial.modeloId,
  version: inicial.version,
  sesionActiva: false,
  mqttEstado: mqttClient.getStatus(),
  secuencia: -1,
  estadoRemoto: null,
  modeloAceptado: null,
  mensaje: null,

  activarSesion: (modeloId, version) => {
    try {
      const sesion = remoteClient.activarSesion(modeloId, version);
      useSimulationStore.getState().setModoEjecucion('pico');
      actualizarUrlSesion(sesion.modeloId, sesion.version);
      set({
        modeloId: sesion.modeloId,
        version: sesion.version,
        sesionActiva: true,
        secuencia: -1,
        estadoRemoto: null,
        modeloAceptado: null,
        mensaje: `Sesión ${sesion.modeloId} v${sesion.version} activa. Esperando el estado oficial de la Pico.`,
      });
      // El modo y la sesión deben existir antes de suscribirse: Mosquitto puede
      // entregar inmediatamente la última instantánea retenida.
      remoteClient.start();
      return true;
    } catch (error) {
      set({ mensaje: error instanceof Error ? error.message : 'No fue posible activar la sesión remota.' });
      return false;
    }
  },

  desactivar: () => {
    remoteClient.stop();
    useSimulationStore.getState().setModoEjecucion('local');
    set({ sesionActiva: false, secuencia: -1, estadoRemoto: null, modeloAceptado: null, mensaje: 'Modo local activo.' });
  },

  cargarModeloActual: () => {
    if (!get().sesionActiva) {
      set({ mensaje: 'Primero debes unirte a la sesión remota.' });
      return false;
    }
    const { nodes, edges } = useEditorStore.getState();
    const compilacion = compilarDocumentoAIrV2(serializeModel(nodes, edges), {
      modeloId: get().modeloId,
      version: get().version,
    });
    if (!compilacion.ok || !compilacion.modelo) {
      set({
        modeloAceptado: false,
        mensaje: `El circuito no se puede enviar: ${compilacion.errores.map((error) => error.mensaje).join(' ')}`,
      });
      return false;
    }
    const publicado = remoteClient.cargarModeloIrV2(compilacion.modelo);
    set({
      modeloAceptado: null,
      mensaje: publicado
        ? 'Modelo IR publicado. Esperando la confirmación de la Pico.'
        : 'No fue posible publicar el modelo. Verifica la conexión MQTT.',
    });
    return publicado;
  },

  enviarComando: (accion) => {
    if (!get().sesionActiva) {
      set({ mensaje: 'Primero debes unirte a la sesión remota.' });
      return false;
    }
    const publicado = remoteClient.enviarComando(accion);
    set({ mensaje: publicado ? `Comando ${accion} enviado a la Pico.` : 'No fue posible publicar el comando.' });
    return publicado;
  },

  establecerEntrada: (servicioId, valor) => {
    if (!get().sesionActiva) {
      set({ mensaje: 'Primero debes unirte a la sesión remota.' });
      return false;
    }
    const publicado = remoteClient.establecerEntrada(servicioId, valor);
    set({ mensaje: publicado ? `Entrada enviada al Service ${servicioId}.` : 'No fue posible publicar la entrada.' });
    return publicado;
  },

  obtenerEnlaceSesion: () => {
    if (typeof window === 'undefined') return `?modelo=${encodeURIComponent(get().modeloId)}&version=${get().version}`;
    const url = new URL(window.location.href);
    url.searchParams.set('modelo', get().modeloId);
    url.searchParams.set('version', String(get().version));
    return url.toString();
  },
}));

remoteClient.onEvent((evento) => {
  if (evento.tipo === 'estado_mqtt') {
    useRemoteExecutionStore.setState({ mqttEstado: evento.estado });
    return;
  }
  if (evento.tipo === 'confirmacion') {
    useRemoteExecutionStore.setState({
      modeloAceptado: evento.confirmacion.aceptado,
      mensaje: evento.confirmacion.aceptado
        ? 'La Pico aceptó el modelo y quedó lista para recibir comandos.'
        : `La Pico rechazó el modelo: ${evento.confirmacion.error ?? evento.confirmacion.codigo ?? 'sin detalle'}.`,
    });
    return;
  }
  if (evento.tipo === 'error_remoto') {
    useRemoteExecutionStore.setState({
      mensaje: `La Pico rechazó la operación: ${evento.error.mensaje ?? evento.error.error ?? evento.error.codigo ?? 'error sin detalle'}.`,
    });
    return;
  }
  if (evento.tipo === 'instantanea') {
    useSimulationStore.getState().aplicarInstantaneaRemota(evento.instantanea);
    useRemoteExecutionStore.setState({
      secuencia: evento.instantanea.secuencia,
      estadoRemoto: evento.instantanea.estado,
      mensaje: `Instantánea ${evento.instantanea.secuencia} aplicada desde la Pico.`,
    });
  }
});
