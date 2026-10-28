import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MARCA } from '../../assets/brand/brand';
import { mqttClient } from '../../services/mqtt/MqttClient';
import type { MqttConnectionStatus } from '../../services/mqtt/config';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { useRemoteExecutionStore } from '../../stores/useRemoteExecutionStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import { ShareDialog } from '../collaboration/ShareDialog';
import { DistributedPanel } from '../distributed/DistributedPanel';
import { useFaseDistribuida } from '../distributed/useFaseDistribuida';
import { EmptyCanvas } from '../onboarding/EmptyCanvas';
import { Tutorial } from '../onboarding/Tutorial';
import { tutorialCompletado } from '../onboarding/tutorialState';
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

const etiquetaConexion: Record<MqttConnectionStatus, string> = {
  DISCONNECTED: 'Desconectado',
  CONNECTING: 'Conectando',
  CONNECTED: 'Conectado',
  ERROR: 'Error',
};

const etiquetaEstadoSimulacion = (estado: string): string => ({
  inactiva: 'Sin modelo',
  lista: 'Lista',
  ejecutando: 'Ejecutando',
  estabilizada: 'Estable',
  pausada: 'Pausada',
  detenida: 'Detenida',
  error: 'Error',
  sin_modelo: 'Sin modelo',
  'sin modelo': 'Sin modelo',
}[estado] ?? estado.replaceAll('_', ' '));

const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string }> = ({ icon, label, ...props }) => (
  <button type="button" {...props} className={`topbar-button ${props.className ?? ''}`.trim()} title={props.title ?? label} aria-label={props['aria-label'] ?? label}>
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
  const [panelDistribuido, setPanelDistribuido] = useState(false);
  const [compartir, setCompartir] = useState(false);
  const [tutorial, setTutorial] = useState(() => !tutorialCompletado());
  const simulation = useSimulationStore();
  const remote = useRemoteExecutionStore();
  const fase = useFaseDistribuida();
  const esPico = simulation.modoEjecucion === 'pico';
  const availability = getExecutionAvailability({
    modo: simulation.modoEjecucion,
    ocupado: simulation.ocupado,
    estadoLocal: simulation.estado,
    sesionRemotaActiva: remote.sesionActiva,
  });
  const executionStatus = esPico ? remote.estadoRemoto ?? 'sin_modelo' : simulation.estado;

  useEffect(() => mqttClient.onStatusChange(setMqttStatus), []);
  useEffect(() => useDistributedExecutionStore.getState().iniciar(projectId), [projectId]);

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
    <header className="topbar" aria-label="Barra principal de HiLeS">
      <div className="topbar__brand" title={`${MARCA.nombre} · ${MARCA.subtitulo}`}>
        <img className="topbar__logo" src={MARCA.logo} alt="" width={28} height={28} />
        <span>{MARCA.nombre}</span>
      </div>

      <div className="topbar__project">
        <label htmlFor="hiles-project-id">Proyecto</label>
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
          title={`Proyecto actual: ${projectId}. Escribe otro identificador y pulsa Enter para cambiar.`}
          aria-label="Identificador del proyecto actual"
        />
        <span className="topbar__file" title={fileName}>{fileName}</span>
      </div>

      <nav className="topbar__groups" aria-label="Acciones del editor">
        <div className="topbar__group" aria-label="Archivo">
          <IconButton icon="＋" label="Nuevo" title="Vaciar el proyecto actual" onClick={onNewProject} />
          <IconButton icon="⇧" label="Importar" title="Importar un modelo JSON" onClick={onImport} />
          <IconButton icon="⇩" label="Exportar" title="Descargar el modelo como JSON" onClick={onExport} />
        </div>
        <div className="topbar__group" aria-label="Historial">
          <IconButton icon="↶" label="Deshacer" onClick={onUndo} disabled={!canUndo} title="Deshacer (Ctrl/Cmd + Z)" />
          <IconButton icon="↷" label="Rehacer" onClick={onRedo} disabled={!canRedo} title="Rehacer (Ctrl/Cmd + Shift + Z o Ctrl + Y)" />
        </div>
        <div className="topbar__group" aria-label="Paneles">
          <IconButton icon="▦" label="Elementos" data-tour="elementos" className={paletteOpen ? 'is-active' : ''} aria-pressed={paletteOpen} onClick={onTogglePalette} />
          <IconButton icon="⚙" label="Propiedades" className={activePanel === 'properties' ? 'is-active' : ''} aria-pressed={activePanel === 'properties'} onClick={() => onTogglePanel('properties')} />
          <IconButton icon="◫" label="Simulación" className={activePanel === 'simulation' ? 'is-active' : ''} aria-pressed={activePanel === 'simulation'} onClick={() => onTogglePanel('simulation')} />
          <IconButton icon="⌁" label="MQTT" className={activePanel === 'mqtt' ? 'is-active' : ''} aria-pressed={activePanel === 'mqtt'} onClick={() => onTogglePanel('mqtt')} />
          <IconButton icon="⛁" label="Ejecutores" data-tour="ejecutores" title="Asignar bloques, desplegar y ver el estado distribuido" className={panelDistribuido ? 'is-active' : ''} aria-pressed={panelDistribuido} onClick={() => setPanelDistribuido((valor) => !valor)} />
        </div>
        <div className="topbar__group topbar__group--execution" aria-label="Simulación local o Pico">
          <IconButton icon="▶" label="Paso" onClick={runStep} disabled={availability.stepDisabled} title="Ejecutar un paso de simulación" />
          <IconButton icon="⏩" label="Ejecutar" onClick={run} disabled={availability.runDisabled} title="Ejecutar la simulación" />
          {availability.stopVisible && <IconButton icon="■" label="Detener" onClick={() => remote.enviarComando('detener')} disabled={availability.stopDisabled} />}
          <IconButton icon="↺" label="Reiniciar" onClick={reset} disabled={availability.resetDisabled} />
        </div>
        <div className="topbar__group" aria-label="Equipo y ayuda">
          <IconButton icon="⤴" label="Compartir" data-tour="compartir" title="Copiar el enlace o el projectId" onClick={() => setCompartir(true)} />
          <IconButton icon="?" label="Ayuda" title="Abrir el tutorial" onClick={() => setTutorial(true)} />
        </div>
      </nav>

      <div className="topbar__status" aria-label="Estado del proyecto y la ejecución">
        <span className={`topbar-chip is-${simulation.modoEjecucion}`}>{esPico ? 'Pico' : 'Local'}</span>
        <span className="topbar-chip" title={`Estado de la simulación: ${etiquetaEstadoSimulacion(String(executionStatus))}`}>{etiquetaEstadoSimulacion(String(executionStatus))}</span>
        <button
          type="button"
          data-tour="estado-distribuido"
          className={`topbar-chip topbar-chip--button phase-${fase.fase}`}
          title={`Ejecución distribuida: ${fase.detalle}`}
          aria-label={`Ejecución distribuida: ${fase.etiqueta}. ${fase.detalle}`}
          onClick={() => setPanelDistribuido(true)}
        >
          <i aria-hidden="true" /> {fase.etiqueta}
        </button>
        <span className={`topbar-chip mqtt-${mqttStatus.toLowerCase()}`} title={`MQTT de colaboración: ${etiquetaConexion[mqttStatus]}`}>
          <i aria-hidden="true" /> MQTT {etiquetaConexion[mqttStatus]}
        </span>
        <div id="hiles-collaboration-slot" className="topbar__collaboration-slot" data-collaboration-slot aria-label="Colaboradores" />
      </div>

      <div className="topbar__save-status" role="status" aria-live="polite">
        {statusMessage ? `✓ ${statusMessage}` : '✓ Guardado localmente'}
      </div>

      {panelDistribuido && createPortal(<DistributedPanel onClose={() => setPanelDistribuido(false)} />, document.body)}
      {compartir && <ShareDialog projectId={projectId} onClose={() => setCompartir(false)} />}
      <Tutorial abierto={tutorial} onClose={() => setTutorial(false)} />
      <EmptyCanvas onAbrirTutorial={() => setTutorial(true)} />
    </header>
  );
};
