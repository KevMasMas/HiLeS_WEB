import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  applyWorkspacePanelAction,
  getNextDockPanel,
  sameWorkspacePanelsState,
  type DockPanel,
  type WorkspacePanelsState,
} from './panelState';

const storage = new Map<string, string>();

beforeAll(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setInterval: () => 0,
      clearInterval: () => undefined,
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

describe('PanelDock interactions', () => {
  it('opens a panel, switches tabs and closes the active panel', () => {
    let active: DockPanel = null;
    active = getNextDockPanel(active, 'properties');
    expect(active).toBe('properties');

    active = getNextDockPanel(active, 'simulation');
    expect(active).toBe('simulation');

    active = getNextDockPanel(active, 'simulation');
    expect(active).toBeNull();
  });

  it('keeps a single workspace panel active at a time', () => {
    const sequence = ['properties', 'mqtt', 'simulation'] as const;
    const finalPanel = sequence.reduce<DockPanel>(
      (active, requested) => getNextDockPanel(active, requested),
      null,
    );
    expect(finalPanel).toBe('simulation');
  });
});

describe('Workspace panel mutual exclusion', () => {
  it('recognizes a no-op panel transition without forcing another render', () => {
    const current: WorkspacePanelsState = {
      activePanel: null,
      distributedOpen: false,
      paletteOpen: false,
    };

    expect(sameWorkspacePanelsState(
      current,
      applyWorkspacePanelAction(current, { type: 'set-dock', panel: null }, false),
    )).toBe(true);
  });

  it('prevents PanelDock and DistributedPanel from colliding on desktop', () => {
    let estado: WorkspacePanelsState = {
      activePanel: 'simulation',
      distributedOpen: false,
      paletteOpen: true,
    };

    estado = applyWorkspacePanelAction(estado, { type: 'open-distributed' }, false);
    expect(estado).toEqual({
      activePanel: null,
      distributedOpen: true,
      paletteOpen: true,
    });

    estado = applyWorkspacePanelAction(estado, { type: 'toggle-dock', panel: 'mqtt' }, false);
    expect(estado).toEqual({
      activePanel: 'mqtt',
      distributedOpen: false,
      paletteOpen: true,
    });
  });

  it('prevents bottom-sheet collisions between Palette, PanelDock and DistributedPanel on mobile', () => {
    let estado: WorkspacePanelsState = {
      activePanel: null,
      distributedOpen: false,
      paletteOpen: true,
    };

    estado = applyWorkspacePanelAction(estado, { type: 'open-distributed' }, true);
    expect(estado).toEqual({
      activePanel: null,
      distributedOpen: true,
      paletteOpen: false,
    });

    estado = applyWorkspacePanelAction(estado, { type: 'toggle-palette' }, true);
    expect(estado).toEqual({
      activePanel: null,
      distributedOpen: false,
      paletteOpen: true,
    });

    estado = applyWorkspacePanelAction(estado, { type: 'set-dock', panel: 'simulation' }, true);
    expect(estado).toEqual({
      activePanel: 'simulation',
      distributedOpen: false,
      paletteOpen: false,
    });
  });
});

describe('Unified execution controls and connection mode UI', () => {
  it('keeps the automatic tutorial closed until the display name is confirmed', async () => {
    const { isTutorialVisible } = await import('../onboarding/tutorialVisibility');

    expect(isTutorialVisible(false, true)).toBe(false);
    expect(isTutorialVisible(true, true)).toBe(true);
    expect(isTutorialVisible(true, false)).toBe(false);
  });

  it('renders a single global set of Iniciar/Paso/Detener/Reiniciar controls and zero legacy Local/Pico toggles', async () => {
    const { TopBar } = await import('./TopBar');
    const { PanelDock } = await import('./PanelDock');
    const noop = () => undefined;

    const html = renderToStaticMarkup(
      <div>
        <TopBar
          projectId="proyecto-demo"
          projectDraft="proyecto-demo"
          fileName="proyecto-demo.json"
          statusMessage={null}
          canUndo={false}
          canRedo={false}
          paletteOpen={false}
          activePanel="simulation"
          distributedOpen
          onProjectDraftChange={noop}
          onProjectCommit={noop}
          onNewProject={noop}
          onImport={noop}
          onExport={noop}
          onUndo={noop}
          onRedo={noop}
          onTogglePalette={noop}
          onTogglePanel={noop}
          onSelectPanel={noop}
          onToggleDistributed={noop}
          onOpenDistributed={noop}
          onCloseDistributed={noop}
        />
        <PanelDock activePanel="simulation" onPanelChange={noop} onOpenDistributed={noop} />
      </div>,
    );

    const contarAriaLabel = (etiqueta: string) =>
      (html.match(new RegExp(`aria-label="${etiqueta}"`, 'g')) ?? []).length;

    expect(contarAriaLabel('Iniciar')).toBe(1);
    expect(contarAriaLabel('Paso')).toBe(1);
    expect(contarAriaLabel('Detener')).toBe(1);
    expect(contarAriaLabel('Reiniciar')).toBe(1);

    expect(html).toContain('data-tour="controles-ejecucion"');
    expect(html).toContain('data-tour="modo-conexion"');
    expect(html).toContain('data-tour="estado-distribuido"');
    expect(html).toContain('data-tour="proyecto"');

    expect(html).not.toContain('Modo Local');
    expect(html).not.toContain('Modo Pico');
    expect(html).not.toContain('Sesión remota');
    expect(html).not.toContain('aria-label="Ejecutar"');
  });
});
