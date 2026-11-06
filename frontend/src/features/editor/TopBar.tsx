import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { MARCA } from '../../assets/brand/brand';
import { mqttClient } from '../../services/mqtt/MqttClient';
import {
  etiquetaModoConexionMqtt,
  getActiveMqttProfile,
  subscribeMqttProfile,
  type MqttConnectionStatus,
} from '../../services/mqtt/config';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { ShareDialog } from '../collaboration/ShareDialog';
import { DistributedPanel } from '../distributed/DistributedPanel';
import { useControlEjecucionDistribuida } from '../distributed/useFaseDistribuida';
import { EmptyCanvas } from '../onboarding/EmptyCanvas';
import { Tutorial } from '../onboarding/Tutorial';
import { tutorialCompletado } from '../onboarding/tutorialState';
import { isTutorialVisible } from '../onboarding/tutorialVisibility';
import type { DockPanel } from './panelState';

export interface TopBarProps {
  projectId: string;
  projectDraft: string;
  fileName: string;
  statusMessage: string | null;
  canUndo: boolean;
  canRedo: boolean;
  paletteOpen: boolean;
  activePanel: DockPanel;
  distributedOpen: boolean;
  tutorialEnabled?: boolean;
  onProjectDraftChange: (value: string) => void;
  onProjectCommit: () => void;
  onNewProject: () => void;
  onImport: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onTogglePalette: () => void;
  onTogglePanel: (panel: Exclude<DockPanel, null>) => void;
  onSelectPanel: (panel: DockPanel) => void;
  onToggleDistributed: () => void;
  onOpenDistributed: () => void;
  onCloseDistributed: () => void;
}

const etiquetaConexion: Record<MqttConnectionStatus, string> = {
  DISCONNECTED: 'Desconectado',
  CONNECTING: 'Conectando',
  CONNECTED: 'Conectado',
  ERROR: 'Error',
};

const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: string;
    label: string;
    labelPriority?: 'always-desktop' | 'wide-only' | 'icon-first';
  }
> = ({ icon, label, labelPriority = 'wide-only', ...props }) => (
  <button
    type="button"
    {...props}
    className={`topbar-button topbar-button--${labelPriority} ${props.className ?? ''}`.trim()}
    title={props.title ?? label}
    aria-label={props['aria-label'] ?? label}
  >
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
  distributedOpen,
  tutorialEnabled = true,
  onProjectDraftChange,
  onProjectCommit,
  onNewProject,
  onImport,
  onExport,
  onUndo,
  onRedo,
  onTogglePalette,
  onTogglePanel,
  onSelectPanel,
  onToggleDistributed,
  onOpenDistributed,
  onCloseDistributed,
}) => {
  const [mqttStatus, setMqttStatus] = useState(mqttClient.getStatus());
  const [compartir, setCompartir] = useState(false);
  const [tutorial, setTutorial] = useState(() => typeof document !== 'undefined' && !tutorialCompletado());
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cerrarTutorial = useCallback(() => setTutorial(false), []);

  const perfilMqtt = useSyncExternalStore(
    subscribeMqttProfile,
    getActiveMqttProfile,
    getActiveMqttProfile,
  );
  const controlEjecucion = useControlEjecucionDistribuida();
  const fase = controlEjecucion.fase;
  const enviarComando = useDistributedExecutionStore((state) => state.enviarComando);
  const conectadoDistribuido = useDistributedExecutionStore((state) => state.conectado);

  useEffect(() => mqttClient.onStatusChange(setMqttStatus), []);
  useEffect(() => useDistributedExecutionStore.getState().iniciar(projectId), [projectId]);

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alPulsarFuera = (evento: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(evento.target as Node)) {
        setMenuAbierto(false);
      }
    };
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('mousedown', alPulsarFuera);
    window.addEventListener('keydown', alTeclado);
    return () => {
      window.removeEventListener('mousedown', alPulsarFuera);
      window.removeEventListener('keydown', alTeclado);
    };
  }, [menuAbierto]);

  const ejecutarDesdeMenu = (accion: () => void) => {
    setMenuAbierto(false);
    accion();
  };

  const etiquetaModoCorta = perfilMqtt.mode === 'remote' ? 'Remoto' : 'Local/LAN';
  const estadoBrokerCombinado: MqttConnectionStatus =
    mqttStatus === 'CONNECTED' && conectadoDistribuido
      ? 'CONNECTED'
      : mqttStatus === 'ERROR'
        ? 'ERROR'
        : mqttStatus === 'CONNECTING'
          ? 'CONNECTING'
          : conectadoDistribuido
            ? 'CONNECTED'
            : mqttStatus;

  const tituloIniciar = controlEjecucion.puedeIniciar
    ? 'Iniciar la ejecución en todos los ejecutores desplegados'
    : `Iniciar no disponible: ${controlEjecucion.motivoBloqueo ?? fase.detalle}`;
  const tituloPaso = controlEjecucion.puedeAvanzar
    ? 'Ejecutar un paso en todos los fragmentos desplegados'
    : `Paso no disponible: ${controlEjecucion.motivoBloqueo ?? fase.detalle}`;
  const tituloDetener = controlEjecucion.puedeDetener
    ? 'Detener la ejecución activa en los ejecutores conectados'
    : `Detener no disponible: ${controlEjecucion.motivoBloqueo ?? fase.detalle}`;
  const tituloReiniciar = controlEjecucion.puedeReiniciar
    ? 'Reiniciar marcaje, memorias y contadores del despliegue'
    : `Reiniciar no disponible: ${controlEjecucion.motivoBloqueo ?? fase.detalle}`;

  const nodoPanelDistribuido = distributedOpen ? (
    <DistributedPanel
      onClose={onCloseDistributed}
      onOpenInputs={() => onSelectPanel('simulation')}
      onOpenConnection={() => onSelectPanel('mqtt')}
    />
  ) : null;

  return (
    <header className="topbar" aria-label="Barra principal de HiLeS">
      <div className="topbar__brand" title={`${MARCA.nombre} · ${MARCA.subtitulo}`}>
        <img className="topbar__logo" src={MARCA.logo} alt="" width={28} height={28} />
        <span>{MARCA.nombre}</span>
      </div>

      <div className="topbar__project" data-tour="proyecto">
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
        <div className="topbar__group topbar__group--core" aria-label="Modelado y despliegue">
          <IconButton
            icon="▦"
            label="Elementos"
            labelPriority="wide-only"
            data-tour="elementos"
            className={paletteOpen ? 'is-active' : ''}
            aria-pressed={paletteOpen}
            onClick={onTogglePalette}
          />
          <IconButton
            icon="⛁"
            label="Ejecutores"
            labelPriority="always-desktop"
            data-tour="ejecutores"
            title="Asignar bloques a Picos o navegadores, desplegar y diagnosticar"
            className={distributedOpen ? 'is-active' : ''}
            aria-pressed={distributedOpen}
            onClick={onToggleDistributed}
          />
        </div>

        <div className="topbar__group topbar__group--secondary" aria-label="Paneles auxiliares">
          <IconButton
            icon="◫"
            label="Entradas"
            labelPriority="wide-only"
            data-tour="entradas"
            title="Inyectar entradas en Services y consultar el estado agregado"
            className={activePanel === 'simulation' ? 'is-active' : ''}
            aria-pressed={activePanel === 'simulation'}
            onClick={() => onTogglePanel('simulation')}
          />
          <IconButton
            icon="⚙"
            label="Propiedades"
            labelPriority="icon-first"
            title="Editar propiedades, puertos y código del elemento seleccionado"
            className={activePanel === 'properties' ? 'is-active' : ''}
            aria-pressed={activePanel === 'properties'}
            onClick={() => onTogglePanel('properties')}
          />
          <IconButton
            icon="⇄"
            label="Conexión"
            labelPriority="icon-first"
            title="Configurar modo de conexión Local/LAN o Remoto (wss://)"
            className={activePanel === 'mqtt' ? 'is-active' : ''}
            aria-pressed={activePanel === 'mqtt'}
            onClick={() => onTogglePanel('mqtt')}
          />
        </div>

        <div
          className="topbar__group topbar__group--execution"
          data-tour="controles-ejecucion"
          aria-label="Ejecución distribuida"
        >
          <IconButton
            icon="▶"
            label="Iniciar"
            labelPriority="always-desktop"
            onClick={() => enviarComando('start')}
            disabled={!controlEjecucion.puedeIniciar}
            title={tituloIniciar}
          />
          <IconButton
            icon="⏭"
            label="Paso"
            labelPriority="always-desktop"
            onClick={() => enviarComando('step')}
            disabled={!controlEjecucion.puedeAvanzar}
            title={tituloPaso}
          />
          <IconButton
            icon="■"
            label="Detener"
            labelPriority="always-desktop"
            onClick={() => enviarComando('stop')}
            disabled={!controlEjecucion.puedeDetener}
            title={tituloDetener}
          />
          <IconButton
            icon="↺"
            label="Reiniciar"
            labelPriority="always-desktop"
            onClick={() => enviarComando('reset')}
            disabled={!controlEjecucion.puedeReiniciar}
            title={tituloReiniciar}
          />
        </div>

        <div className="topbar__group topbar__group--secondary" aria-label="Equipo y ayuda">
          <IconButton
            icon="⤴"
            label="Compartir"
            labelPriority="icon-first"
            data-tour="compartir"
            title="Copiar el enlace colaborativo o el projectId"
            onClick={() => setCompartir(true)}
          />
          <IconButton
            icon="?"
            label="Ayuda"
            labelPriority="icon-first"
            title="Abrir el recorrido guiado"
            onClick={() => setTutorial(true)}
          />
        </div>

        <div className="topbar__more" ref={menuRef}>
          <IconButton
            icon="⋯"
            label="Más"
            labelPriority="icon-first"
            aria-label="Archivo y más acciones"
            title="Archivo, historial y accesos adicionales"
            aria-haspopup="menu"
            aria-expanded={menuAbierto}
            className={menuAbierto ? 'is-active' : ''}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          />
          {menuAbierto && (
            <div className="topbar-menu" role="menu" aria-label="Archivo y más acciones">
              <div className="topbar-menu__mobile-only">
                <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(() => onTogglePanel('simulation'))}>
                  ◫ Entradas y estado
                </button>
                <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(() => onTogglePanel('properties'))}>
                  ⚙ Propiedades
                </button>
                <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(() => onTogglePanel('mqtt'))}>
                  ⇄ Conexión ({etiquetaModoCorta})
                </button>
                <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(() => setCompartir(true))}>
                  ⤴ Compartir proyecto
                </button>
                <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(() => setTutorial(true))}>
                  ? Ver tutorial
                </button>
                <hr />
              </div>
              <button type="button" role="menuitem" disabled={!canUndo} onClick={() => ejecutarDesdeMenu(onUndo)}>
                ↶ Deshacer
              </button>
              <button type="button" role="menuitem" disabled={!canRedo} onClick={() => ejecutarDesdeMenu(onRedo)}>
                ↷ Rehacer
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(onNewProject)}>
                ＋ Nuevo proyecto
              </button>
              <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(onImport)}>
                ⇧ Importar JSON
              </button>
              <button type="button" role="menuitem" onClick={() => ejecutarDesdeMenu(onExport)}>
                ⇩ Exportar JSON
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="topbar__status" aria-label="Estado del proyecto, conexión y ejecución">
        <button
          type="button"
          data-tour="estado-distribuido"
          className={`topbar-chip topbar-chip--button phase-${fase.fase}`}
          title={`Ejecución distribuida: ${fase.detalle}`}
          aria-label={`Ejecución distribuida: ${fase.etiqueta}. ${fase.detalle}`}
          onClick={onOpenDistributed}
        >
          <i aria-hidden="true" />
          <span className="topbar-chip__text">{fase.etiqueta}</span>
        </button>

        <button
          type="button"
          data-tour="modo-conexion"
          className={`topbar-chip topbar-chip--button mqtt-${estadoBrokerCombinado.toLowerCase()} mode-${perfilMqtt.mode}`}
          title={`Modo de conexión: ${etiquetaModoConexionMqtt(perfilMqtt)} (${perfilMqtt.protocol}://${perfilMqtt.host}:${perfilMqtt.port}${perfilMqtt.path}) · Colaboración: ${etiquetaConexion[mqttStatus]} · Ejecutores: ${conectadoDistribuido ? 'Conectado' : 'Desconectado'}`}
          aria-label={`Modo de conexión ${etiquetaModoConexionMqtt(perfilMqtt)}: ${etiquetaConexion[estadoBrokerCombinado]}. Abrir panel de conexión`}
          onClick={() => onSelectPanel('mqtt')}
        >
          <i aria-hidden="true" />
          <span className="topbar-chip__text">
            {etiquetaModoCorta}
            <span className="topbar-chip__sub"> · {etiquetaConexion[estadoBrokerCombinado]}</span>
          </span>
        </button>

        <div
          id="hiles-collaboration-slot"
          className="topbar__collaboration-slot"
          data-collaboration-slot
          aria-label="Colaboradores"
        />
      </div>

      <div className="topbar__save-status" role="status" aria-live="polite">
        {statusMessage ? `✓ ${statusMessage}` : '✓ Guardado localmente'}
      </div>

      {nodoPanelDistribuido && (
        typeof document !== 'undefined' ? createPortal(nodoPanelDistribuido, document.body) : nodoPanelDistribuido
      )}
      {compartir && <ShareDialog projectId={projectId} onClose={() => setCompartir(false)} />}
      <Tutorial
        abierto={isTutorialVisible(tutorialEnabled, tutorial)}
        onClose={cerrarTutorial}
        onAbrirEjecutores={onOpenDistributed}
        onAbrirPanel={onSelectPanel}
      />
      <EmptyCanvas onAbrirTutorial={() => setTutorial(true)} />
    </header>
  );
};
