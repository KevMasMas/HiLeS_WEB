import { create } from 'zustand';
import { serializeModel } from '../domain/modelDocument';
import { mqttClient } from '../services/mqtt/MqttClient';
import { ProjectSyncClient, type ColaboradorProyectoV2, type CursorRemotoProyectoV2 } from '../services/projects/ProjectSyncClient';
import { useEditorStore } from './useEditorStore';

interface ProjectState {
  projectId: string | null;
  ready: boolean;
  collaborators: ColaboradorProyectoV2[];
  cursors: CursorRemotoProyectoV2[];
  clientId: string | null;
  start: (projectId: string) => () => void;
}

const identity = () => {
  const key = 'hiles_collab_identity_v1';
  try {
    const prior = sessionStorage.getItem(key);
    if (prior) {
      const parsed = JSON.parse(prior) as { clientId?: unknown; name?: unknown };
      if (typeof parsed.clientId === 'string' && parsed.clientId.trim() && typeof parsed.name === 'string' && parsed.name.trim()) {
        return { clientId: parsed.clientId, name: parsed.name };
      }
    }
    const value = { clientId: `web-${crypto.randomUUID()}`, name: `Editor ${Math.floor(Math.random() * 900 + 100)}` };
    sessionStorage.setItem(key, JSON.stringify(value));
    return value;
  } catch {
    return { clientId: `web-${crypto.randomUUID()}`, name: 'Editor' };
  }
};

let active: ProjectSyncClient | null = null;
export const useProjectStore = create<ProjectState>((set) => ({
  projectId: null, ready: false, collaborators: [], cursors: [], clientId: null,
  start: (projectId) => {
    active?.desconectar();
    const user = identity();
    const current = useEditorStore.getState();
    const initial = serializeModel(current.nodes, current.edges);
    const client = new ProjectSyncClient({ projectId, mqtt: mqttClient, clientId: user.clientId, usuario: user.name, documentoInicial: initial });
    active = client;
    set({ projectId, ready: false, collaborators: [], cursors: [], clientId: user.clientId });
    let gotSnapshot = false;
    const stopDoc = client.onRemoteDocument((event) => {
      if (active !== client || event.projectId !== projectId) return;
      if (event.origenTopico === 'document/snapshot') gotSnapshot = true;
      useEditorStore.getState().applyRemoteDocument(event.documento);
    });
    const stopPresence = client.onPresenceChange((collaborators) => { if (active === client) set({ collaborators }); });
    const stopCursor = client.onRemoteCursor((cursors) => { if (active === client) set({ cursors }); });
    let unsubscribeEditor: (() => void) | undefined;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;
    const stopStatus = mqttClient.onStatusChange((status) => {
      if (status !== 'CONNECTED' || active !== client || unsubscribeEditor || readyTimer !== null) return;
      // Give retained snapshot delivery a turn before observing/publishing local edits.
      readyTimer = setTimeout(() => {
        readyTimer = null;
        if (active !== client) return;
        set({ ready: true });
        const editor = useEditorStore.getState();
        client.establecerDocumentoBase(gotSnapshot ? client.obtenerDocumentoActual() ?? initial : serializeModel(editor.nodes, editor.edges));
        if (!gotSnapshot) client.publicarSnapshotInmediato(serializeModel(editor.nodes, editor.edges), 'Initial project snapshot');
        unsubscribeEditor = useEditorStore.subscribe((state, previous) => {
          if (active !== client || client.estaAplicandoCambioRemoto() || (state.nodes === previous.nodes && state.edges === previous.edges)) return;
          client.notificarCambioLocal(serializeModel(state.nodes, state.edges), 'Local editor change');
        });
      }, 500);
    });
    client.conectar();
    return () => {
      if (active === client) active = null;
      if (readyTimer !== null) clearTimeout(readyTimer);
      unsubscribeEditor?.(); stopDoc(); stopPresence(); stopCursor(); stopStatus();
      client.desconectar();
      set({ ready: false, collaborators: [], cursors: [], clientId: null });
    };
  },
}));

export const getProjectSyncClient = () => active;
