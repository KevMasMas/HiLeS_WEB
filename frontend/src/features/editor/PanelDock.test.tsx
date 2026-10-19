import { describe, expect, it } from 'vitest';
import { getExecutionAvailability, getNextDockPanel, type DockPanel } from './panelState';

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

describe('TopBar action regression', () => {
  it('enables local execution only when the motor is ready', () => {
    expect(getExecutionAvailability({
      modo: 'local',
      ocupado: false,
      estadoLocal: 'lista',
      sesionRemotaActiva: false,
    })).toMatchObject({ stepDisabled: false, runDisabled: false, resetDisabled: false, stopVisible: false });

    expect(getExecutionAvailability({
      modo: 'local',
      ocupado: true,
      estadoLocal: 'ejecutando',
      sesionRemotaActiva: false,
    })).toMatchObject({ stepDisabled: true, runDisabled: true, resetDisabled: true });
  });

  it('requires an active Pico session and exposes the stop action', () => {
    expect(getExecutionAvailability({
      modo: 'pico',
      ocupado: false,
      estadoLocal: 'inactiva',
      sesionRemotaActiva: false,
    })).toMatchObject({ stepDisabled: true, runDisabled: true, resetDisabled: true, stopVisible: true, stopDisabled: true });

    expect(getExecutionAvailability({
      modo: 'pico',
      ocupado: false,
      estadoLocal: 'inactiva',
      sesionRemotaActiva: true,
    })).toMatchObject({ stepDisabled: false, runDisabled: false, resetDisabled: false, stopVisible: true, stopDisabled: false });
  });
});
