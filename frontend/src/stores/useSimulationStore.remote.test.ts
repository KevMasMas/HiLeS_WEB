import { beforeAll, describe, expect, it } from 'vitest';

const storage = new Map<string, string>();

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      location: { protocol: 'http:', href: 'http://localhost/' },
      history: { replaceState: () => undefined },
    },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});

describe('modo remoto del store de simulación', () => {
  it('bloquea el motor local y aplica tokens y valores oficiales al canvas', async () => {
    const { useEditorStore } = await import('./useEditorStore');
    const { useSimulationStore } = await import('./useSimulationStore');
    useEditorStore.setState({
      nodes: [{
        id: 'lugar-remoto',
        type: 'hilesNode',
        position: { x: 0, y: 0 },
        data: {
          hilesType: 'PLACE',
          name: 'Lugar remoto',
          ports: [],
          properties: {
            description: '', collapsed: false, locked: false, visible: true,
            expression: '', executionDelay: 0, enabled: true, tokens: 0,
            maxTokens: 1, delay: 0, condition: '', heldValue: '',
            operatorDirection: 'right', rotation: 0,
          },
          runtime: { tokens: 99 },
        },
      }],
      edges: [],
    });

    useSimulationStore.getState().setModoEjecucion('pico');
    expect(useEditorStore.getState().nodes[0].data.runtime).toBeUndefined();
    expect(useSimulationStore.getState().inyectarEntrada('cualquiera', true)).toMatchObject({ exito: false });

    useSimulationStore.getState().aplicarInstantaneaRemota({
      modelo_id: 'cruce-01',
      version: 1,
      secuencia: 4,
      estado: 'pausada',
      elementos: { 'lugar-remoto': { tokens: 1, valor: true, disparada: true } },
    });

    expect(useSimulationStore.getState()).toMatchObject({
      modoEjecucion: 'pico',
      contadorPasos: 4,
      estadosElementos: { 'lugar-remoto': { tokens: 1, valor: true, activo: true } },
    });
    expect(useEditorStore.getState().nodes[0].data.runtime).toEqual({ tokens: 1, value: true, active: true });
  });
});
