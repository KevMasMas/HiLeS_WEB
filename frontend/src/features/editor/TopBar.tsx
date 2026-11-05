import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MARCA } from '../../assets/brand/brand';
import { mqttClient } from '../../services/mqtt/MqttClient';
import type { MqttConnectionStatus } from '../../services/mqtt/config';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { ShareDialog } from '../collaboration/ShareDialog';
import { DistributedPanel } from '../distributed/DistributedPanel';
import { useControlEjecucionDistribuida } from '../distributed/useFaseDistribuida';
import { EmptyCanvas } from '../onboarding/EmptyCanvas';
import { Tutorial } from '../onboarding/Tutorial';
import { tutorialCompletado } from '../onboarding/tutorialState';
import type { DockPanel } from './panelState';

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
  const controlEjecucion = useControlEjecucionDistribuida();
  const fase = controlEjecucion.fase;
  const enviarComando = useDistributedExecutionStore((state) => state.enviarComando);

  useEffect(() => mqttClient.onStatusChange(setMqttStatus), []);
  useEffect(() => useDistributedExecutionStore.getState().iniciar(projectId), [projectId]);

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
        <div className="topbar__group topbar__group--execution" aria-label="Ejecución distribuida">
          <IconButton icon="▶" label="Paso" onClick={() => enviarComando('step')} disabled={!controlEjecucion.puedeAvanzar} title="Ejecutar un paso en todos los fragmentos" />
          <IconButton icon="⏩" label="Ejecutar" onClick={() => enviarComando('start')} disabled={!controlEjecucion.puedeIniciar} title="Iniciar el despliegue distribuido" />
          <IconButton icon="■" label="Detener" onClick={() => enviarComando('stop')} disabled={!controlEjecucion.puedeDetener} />
          <IconButton icon="↺" label="Reiniciar" onClick={() => enviarComando('reset')} disabled={!controlEjecucion.puedeReiniciar} />
        </div>
        <div className="topbar__group" aria-label="Equipo y ayuda">
          <IconButton icon="⤴" label="Compartir" data-tour="compartir" title="Copiar el enlace o el projectId" onClick={() => setCompartir(true)} />
          <IconButton icon="?" label="Ayuda" title="Abrir el tutorial" onClick={() => setTutorial(true)} />
        </div>
      </nav>

      <div className="topbar__status" aria-label="Estado del proyecto y la ejecución">
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
