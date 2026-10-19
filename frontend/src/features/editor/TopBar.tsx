import React, { useEffect, useState } from 'react';
import { mqttClient } from '../../services/mqtt/MqttClient';
import type { MqttConnectionStatus } from '../../services/mqtt/config';
import { useRemoteExecutionStore } from '../../stores/useRemoteExecutionStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { getExecutionAvailability, type DockPanel } from './panelState';

interface TopBarProps {
  projectId: string;
  projectDraft: string;
  fileName: string;
  statusMessage: string | null;
  canUndo: boolean;
  canRedo: boolean;
  paletteOpen: boolean;
  activePanel: DockPanel;
  onProjectDraftChange: (value: string) => void;
  onProjectCommit: () => void;
  onNewProject: () => void;
  onImport: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePalette: () => void;
  onTogglePanel: (panel: Exclude<DockPanel, null>) => void;
}

const connectionLabel: Record<MqttConnectionStatus, string> = {
  DISCONNECTED: 'Offline',
  CONNECTING: 'Connecting',
  CONNECTED: 'Connected',
  ERROR: 'Error',
};

const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }> = ({ icon, label, ...props }) => (
  <button {...props} className={`topbar-button ${props.className ?? ''}`.trim()} title={props.title ?? label} aria-label={props['aria-label'] ?? label}>
    <span aria-hidden="true">{icon}</span>
    <span className="topbar-button__label">{label}</span>
  </button>
);

export const TopBar: React.FC<TopBarProps> = ({
  projectId,
  projectDraft,
  fileName,
  statusMessage,
  canUndo,
  canRedo,
  paletteOpen,
  activePanel,
  onProjectDraftChange,
  onProjectCommit,
  onNewProject,
  onImport,
  onExport,
  onUndo,
  onRedo,
  onTogglePalette,
  onTogglePanel,
}) => {
  const [mqttStatus, setMqttStatus] = useState(mqttClient.getStatus());
  const simulation = useSimulationStore();
  const remote = useRemoteExecutionStore();
  const esPico = simulation.modoEjecucion === 'pico';
  const availability = getExecutionAvailability({
    modo: simulation.modoEjecucion,
    ocupado: simulation.ocupado,
    estadoLocal: simulation.estado,
    sesionRemotaActiva: remote.sesionActiva,
  });
  const executionStatus = esPico ? remote.estadoRemoto ?? 'sin modelo' : simulation.estado;

  useEffect(() => mqttClient.onStatusChange(setMqttStatus), []);

  const runStep = () => {
    if (esPico) remote.enviarComando('paso');
    else void simulation.paso();
  };
  const run = () => {
    if (esPico) remote.enviarComando('iniciar');
    else void simulation.ejecutar();
  };
  const reset = () => {
    if (esPico) remote.enviarComando('reiniciar');
    else simulation.reiniciar();
  };

  return (
    <header className="topbar" aria-label="HiLeS main toolbar">
      <div className="topbar__brand" title="HiLeS Web editor">
        <span className="topbar__mark" aria-hidden="true">H</span>
        <span>HiLeS</span>
      </div>

      <div className="topbar__project">
        <label htmlFor="hiles-project-id">Project</label>
        <input
          id="hiles-project-id"
          value={projectDraft}
          onChange={(event) => onProjectDraftChange(event.target.value)}
          onBlur={onProjectCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onProjectCommit();
              event.currentTarget.blur();
            }
          }}
          title={`Current project: ${projectId}`}
          aria-label="Current project identifier"
        />
        <span className="topbar__file" title={fileName}>{fileName}</span>
      </div>

      <nav className="topbar__groups" aria-label="Editor actions">
        <div className="topbar__group" aria-label="File actions">
          <IconButton icon="＋" label="New" onClick={onNewProject} />
          <IconButton icon="⇧" label="Import" onClick={onImport} />
          <IconButton icon="⇩" label="Export" onClick={onExport} />
        </div>
        <div className="topbar__group" aria-label="History actions">
          <IconButton icon="↶" label="Undo" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl/Cmd + Z)" />
          <IconButton icon="↷" label="Redo" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl/Cmd + Shift + Z or Ctrl + Y)" />
        </div>
        <div className="topbar__group" aria-label="Workspace panels">
          <IconButton icon="▦" label="Elements" className={paletteOpen ? 'is-active' : ''} aria-pressed={paletteOpen} onClick={onTogglePalette} />
          <IconButton icon="⚙" label="Properties" className={activePanel === 'properties' ? 'is-active' : ''} aria-pressed={activePanel === 'properties'} onClick={() => onTogglePanel('properties')} />
          <IconButton icon="◫" label="Simulation" className={activePanel === 'simulation' ? 'is-active' : ''} aria-pressed={activePanel === 'simulation'} onClick={() => onTogglePanel('simulation')} />
          <IconButton icon="⌁" label="MQTT" className={activePanel === 'mqtt' ? 'is-active' : ''} aria-pressed={activePanel === 'mqtt'} onClick={() => onTogglePanel('mqtt')} />
        </div>
        <div className="topbar__group topbar__group--execution" aria-label="Execution actions">
          <IconButton icon="▶" label="Step" onClick={runStep} disabled={availability.stepDisabled} title="Execute one simulation step" />
          <IconButton icon="⏩" label="Run" onClick={run} disabled={availability.runDisabled} title="Run the simulation" />
          {availability.stopVisible && <IconButton icon="■" label="Stop" onClick={() => remote.enviarComando('detener')} disabled={availability.stopDisabled} />}
          <IconButton icon="↺" label="Reset" onClick={reset} disabled={availability.resetDisabled} />
        </div>
      </nav>

      <div className="topbar__status" aria-label="Project and runtime status">
        <span className={`topbar-chip is-${simulation.modoEjecucion}`}>{esPico ? 'Pico' : 'Local'}</span>
        <span className="topbar-chip" title={`Execution state: ${executionStatus}`}>{String(executionStatus).replaceAll('_', ' ')}</span>
        <span className={`topbar-chip mqtt-${mqttStatus.toLowerCase()}`} title={`MQTT: ${connectionLabel[mqttStatus]}`}>
          <i aria-hidden="true" /> MQTT {connectionLabel[mqttStatus]}
        </span>
        <div id="hiles-collaboration-slot" className="topbar__collaboration-slot" data-collaboration-slot aria-label="Collaboration participants">
          <span aria-hidden="true">●</span><span className="topbar-button__label">Collaboration</span>
        </div>
      </div>

      <div className="topbar__save-status" role="status" aria-live="polite">
        {statusMessage ? `✓ ${statusMessage}` : '✓ Autosaved locally'}
      </div>
    </header>
  );
};
