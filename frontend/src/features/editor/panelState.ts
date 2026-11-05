export type DockPanel = 'properties' | 'simulation' | 'mqtt' | null;

/** Transición pura para apertura, cambio de pestaña y cierre del dock. */
export const getNextDockPanel = (current: DockPanel, requested: Exclude<DockPanel, null>): DockPanel => (
  current === requested ? null : requested
);

export interface WorkspacePanelsState {
  activePanel: DockPanel;
  distributedOpen: boolean;
  paletteOpen: boolean;
}

export type WorkspacePanelAction =
  | { type: 'toggle-dock'; panel: Exclude<DockPanel, null> }
  | { type: 'set-dock'; panel: DockPanel }
  | { type: 'toggle-distributed' }
  | { type: 'open-distributed' }
  | { type: 'close-distributed' }
  | { type: 'toggle-palette' };

/**
 * Coordina los paneles laterales para que el dock y el panel de ejecutores no
 * se superpongan, y en móvil tampoco se apilen sobre la paleta.
 */
export const applyWorkspacePanelAction = (
  current: WorkspacePanelsState,
  action: WorkspacePanelAction,
  esMovil = false,
): WorkspacePanelsState => {
  switch (action.type) {
    case 'toggle-dock': {
      const next = getNextDockPanel(current.activePanel, action.panel);
      return {
        activePanel: next,
        distributedOpen: next ? false : current.distributedOpen,
        paletteOpen: next && esMovil ? false : current.paletteOpen,
      };
    }
    case 'set-dock':
      return {
        activePanel: action.panel,
        distributedOpen: action.panel ? false : current.distributedOpen,
        paletteOpen: action.panel && esMovil ? false : current.paletteOpen,
      };
    case 'toggle-distributed': {
      const next = !current.distributedOpen;
      return {
        activePanel: next ? null : current.activePanel,
        distributedOpen: next,
        paletteOpen: next && esMovil ? false : current.paletteOpen,
      };
    }
    case 'open-distributed':
      return {
        activePanel: null,
        distributedOpen: true,
        paletteOpen: esMovil ? false : current.paletteOpen,
      };
    case 'close-distributed':
      return {
        ...current,
        distributedOpen: false,
      };
    case 'toggle-palette': {
      const next = !current.paletteOpen;
      return {
        activePanel: next && esMovil ? null : current.activePanel,
        distributedOpen: next && esMovil ? false : current.distributedOpen,
        paletteOpen: next,
      };
    }
  }
};
