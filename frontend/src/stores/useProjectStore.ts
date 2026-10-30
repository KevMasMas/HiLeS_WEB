import { create } from 'zustand';
import { serializeModel } from '../domain/modelDocument';
import { mqttClient } from '../services/mqtt/MqttClient';
import { ProjectSyncClient, type ColaboradorProyectoV2, type CursorRemotoProyectoV2 } from '../services/projects/ProjectSyncClient';
import { safeRandomUUID } from '../utils/uuid';
import { useEditorStore } from './useEditorStore';

interface ProjectState {
  projectId: string | null;
  ready: boolean;
  collaborators: ColaboradorProyectoV2[];
  cursors: CursorRemotoProyectoV2[];
  clientId: string | null;
  displayName: string | null;
  start: (projectId: string, displayName?: string) => () => void;
}

const IDENTITY_KEY = 'hiles_collab_identity_v1';
const DISPLAY_NAME_KEY = 'hiles_collab_display_name_v1';

export const normalizeDisplayName = (value: string): string => value.trim().replace(/\s+/g, ' ').slice(0, 40);

export const getStoredDisplayName = (): string | null => {
  try {
    const name = normalizeDisplayName(sessionStorage.getItem(DISPLAY_NAME_KEY) ?? '');
    return name || null;
  } catch {
    return null;
  }
};

export const saveDisplayName = (value: string): string => {
  const name = normalizeDisplayName(value);
  if (!name) return '';
  try { sessionStorage.setItem(DISPLAY_NAME_KEY, name); } catch { /* El modo privado puede impedir persistir. */ }
  return name;
};

const identity = (preferredName?: string) => {
  const requestedName = normalizeDisplayName(preferredName ?? '') || getStoredDisplayName();
  try {
    const prior = sessionStorage.getItem(IDENTITY_KEY);
    if (prior) {
      const parsed = JSON.parse(prior) as { clientId?: unknown; name?: unknown };
      if (typeof parsed.clientId === 'string' && parsed.clientId.trim()) {
        const name = requestedName || (typeof parsed.name === 'string' ? normalizeDisplayName(parsed.name) : '') || 'Editor';
        const value = { clientId: parsed.clientId, name };
        sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(value));
        return value;
      }
    }
    const value = { clientId: `web-${safeRandomUUID()}`, name: requestedName || `Editor ${Math.floor(Math.random() * 900 + 100)}` };
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(value));
    return value;
  } catch {
    return { clientId: `web-${safeRandomUUID()}`, name: requestedName || 'Editor' };
  }
};

let active: ProjectSyncClient | null = null;
export const useProjectStore = create<ProjectState>((set) => ({
  projectId: null, ready: false, collaborators: [], cursors: [], clientId: null, displayName: null,
  start: (projectId, preferredName) => {
    active?.desconectar();
    const user = identity(preferredName);
    const current = useEditorStore.getState();
    const initial = serializeModel(current.nodes, current.edges);
    const client = new ProjectSyncClient({ projectId, mqtt: mqttClient, clientId: user.clientId, usuario: user.name, documentoInicial: initial });
    active = client;
    set({ projectId, ready: false, collaborators: [], cursors: [], clientId: user.clientId, displayName: user.name });
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
      set({ ready: false, collaborators: [], cursors: [], clientId: null, displayName: null });
    };
  },
}));

export const getProjectSyncClient = () => active;
