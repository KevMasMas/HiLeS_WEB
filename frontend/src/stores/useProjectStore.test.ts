import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HilesModelDocument } from '../domain/modelDocument';

const fakeMqtt = vi.hoisted(() => {
  type Status = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  type StatusListener = (status: Status) => void;
  type MessageListener = (topic: string, payload: never) => void;

  let status: Status = 'DISCONNECTED';
  const statusListeners = new Set<StatusListener>();
  const messageListeners = new Set<MessageListener>();
  const published: Array<{ topic: string; payload: unknown }> = [];

  return {
    published,
    reset() {
      status = 'DISCONNECTED';
      statusListeners.clear();
      messageListeners.clear();
      published.length = 0;
    },
    emitMessage(topic: string, payload: unknown) {
      messageListeners.forEach((listener) => listener(topic, payload as never));
    },
    getStatus: () => status,
    onStatusChange(listener: StatusListener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    onMessage(listener: MessageListener) {
      messageListeners.add(listener);
      return () => messageListeners.delete(listener);
    },
    connect() {
      status = 'CONNECTED';
      statusListeners.forEach((listener) => listener(status));
    },
    reconnect() {
      status = 'CONNECTED';
      statusListeners.forEach((listener) => listener(status));
    },
    disconnect() {
      status = 'DISCONNECTED';
      statusListeners.forEach((listener) => listener(status));
    },
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    setWillMessage: vi.fn(),
    publish(topic: string, payload: unknown) {
      published.push({ topic, payload });
      return true;
    },
  };
});

vi.mock('../services/mqtt/MqttClient', () => ({ mqttClient: fakeMqtt }));

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; },
  } satisfies Storage;
};

describe('useProjectStore: integración del editor con el proyecto compartido', () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeMqtt.reset();
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { search: '' },
    });
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(async () => {
    stop?.();
    stop = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    const { useEditorStore } = await import('./useEditorStore');
    useEditorStore.setState({ nodes: [], edges: [], past: [], future: [], canUndo: false, canRedo: false });
  });

  it('aplica primero el snapshot retenido, evita el eco y publica después los cambios locales', async () => {
    const [{ useProjectStore }, { useEditorStore }, { crearMensajeEdicionEstado }] = await Promise.all([
      import('./useProjectStore'),
      import('./useEditorStore'),
      import('../services/projects/projectMessages'),
    ]);

    useEditorStore.getState().addNode('SERVICE', { x: 10, y: 20 });
    const remoto: HilesModelDocument = {
      schemaVersion: 2,
      metadata: { savedAt: '2026-10-19T12:00:00.000Z' },
      network: { topology: null, protocol: null, nodes: [] },
      allElements: [],
      relationNode: [],
      connections: [],
    };

    stop = useProjectStore.getState().start('proyecto-integracion');
    fakeMqtt.emitMessage(
      'udfjc/hiles/v2/projects/proyecto-integracion/document/snapshot',
      crearMensajeEdicionEstado({
        operationId: 'snapshot-remoto-1',
        projectId: 'proyecto-integracion',
        clientId: 'otro-navegador',
        clock: 10,
        documento: remoto,
      }),
    );

    await vi.advanceTimersByTimeAsync(500);

    expect(useProjectStore.getState().ready).toBe(true);
    expect(useEditorStore.getState().nodes).toHaveLength(0);
    expect(fakeMqtt.published.filter(({ topic }) => topic.endsWith('/document/snapshot'))).toHaveLength(0);
    expect(fakeMqtt.published.filter(({ topic }) => topic.endsWith('/document/ops'))).toHaveLength(0);

    useEditorStore.getState().addNode('SERVICE', { x: 30, y: 40 });
    await vi.advanceTimersByTimeAsync(150);

    expect(fakeMqtt.published.some(({ topic }) => topic.endsWith('/document/ops'))).toBe(true);
  });

  it('no abre dos ciclos de inicialización ante estados CONNECTED repetidos', async () => {
    const { useProjectStore } = await import('./useProjectStore');

    stop = useProjectStore.getState().start('proyecto-reconexion');
    fakeMqtt.reconnect();
    fakeMqtt.reconnect();
    await vi.advanceTimersByTimeAsync(500);

    expect(fakeMqtt.published.filter(({ topic }) => topic.endsWith('/document/snapshot'))).toHaveLength(1);
  });
});
