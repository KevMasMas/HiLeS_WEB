import React, { useEffect, useRef, useState } from 'react';
import { asegurarProjectIdEnUrl, normalizarProjectId } from '../../services/projects/projectUrl';
import { useEditorStore } from '../../stores/useEditorStore';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { PanelDock } from './PanelDock';
import { TopBar } from './TopBar';
import {
  applyWorkspacePanelAction,
  sameWorkspacePanelsState,
  type DockPanel,
  type WorkspacePanelAction,
} from './panelState';
import { Participants } from '../collaboration/Participants';
import { DisplayNameDialog } from '../collaboration/DisplayNameDialog';
import { getStoredDisplayName, saveDisplayName, useProjectStore } from '../../stores/useProjectStore';
import './editor.css';

const esVistaMovil = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(max-width: 760px)').matches
);

export const Editor: React.FC = () => {
  const {
    exportModel,
    importModel,
    statusMessage,
    loadAutosave,
    undo,
    redo,
    canUndo,
    canRedo,
    clearModel,
    nodes,
    paletteOpen,
    setPaletteOpen,
  } = useEditorStore();
  const importInput = useRef<HTMLInputElement>(null);
  const [paneles, setPaneles] = useState<{ activePanel: DockPanel; distributedOpen: boolean }>({
    activePanel: null,
    distributedOpen: false,
  });
  const [projectId, setProjectId] = useState(() => asegurarProjectIdEnUrl());
  const [projectDraft, setProjectDraft] = useState(projectId);
  const [fileName, setFileName] = useState('Modelo sin título');
  const [displayName, setDisplayName] = useState<string | null>(() => getStoredDisplayName());
  const projectReady = useProjectStore((state) => state.ready);

  useEffect(() => {
    loadAutosave();
    setPaletteOpen(false);
  }, [loadAutosave, setPaletteOpen]);

  useEffect(() => {
    if (!displayName) return;
    return useProjectStore.getState().start(projectId, displayName);
  }, [projectId, displayName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z' && event.key.toLowerCase() !== 'y') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'y' || event.shiftKey) {
        event.preventDefault();
        redo();
      } else {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const commitProjectId = () => {
    const normalized = normalizarProjectId(projectDraft, projectId);
    const nextProjectId = asegurarProjectIdEnUrl(normalized);
    setProjectId(nextProjectId);
    setProjectDraft(nextProjectId);
  };

  const downloadJson = () => {
    const data = exportModel();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.endsWith('.json') ? fileName : `${fileName}.json`}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) importModel(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const newProject = () => {
    if (nodes.length > 0 && !window.confirm('¿Desea crear un nuevo modelo? Se perderán los cambios no guardados.')) return;
    clearModel();
    setFileName('Modelo sin título');
  };

  const aplicarAccionPanel = (accion: WorkspacePanelAction) => {
    const actual = {
      activePanel: paneles.activePanel,
      distributedOpen: paneles.distributedOpen,
      paletteOpen: useEditorStore.getState().paletteOpen,
    };
    const siguiente = applyWorkspacePanelAction(actual, accion, esVistaMovil());
    if (sameWorkspacePanelsState(actual, siguiente)) return;
    if (
      siguiente.activePanel !== actual.activePanel
      || siguiente.distributedOpen !== actual.distributedOpen
    ) {
      setPaneles({
        activePanel: siguiente.activePanel,
        distributedOpen: siguiente.distributedOpen,
      });
    }
    if (siguiente.paletteOpen !== actual.paletteOpen) {
      setPaletteOpen(siguiente.paletteOpen);
    }
  };

  return (
    <div className="editor-shell">
      <TopBar
        projectId={projectId}
        projectDraft={projectDraft}
        fileName={fileName}
        statusMessage={statusMessage}
        canUndo={canUndo}
        canRedo={canRedo}
        paletteOpen={paletteOpen}
        activePanel={paneles.activePanel}
        distributedOpen={paneles.distributedOpen}
        tutorialEnabled={Boolean(displayName)}
        onProjectDraftChange={setProjectDraft}
        onProjectCommit={commitProjectId}
        onNewProject={newProject}
        onImport={() => importInput.current?.click()}
        onExport={downloadJson}
        onUndo={undo}
        onRedo={redo}
        onTogglePalette={() => aplicarAccionPanel({ type: 'toggle-palette' })}
        onTogglePanel={(panel) => aplicarAccionPanel({ type: 'toggle-dock', panel })}
        onSelectPanel={(panel) => aplicarAccionPanel({ type: 'set-dock', panel })}
        onToggleDistributed={() => aplicarAccionPanel({ type: 'toggle-distributed' })}
        onOpenDistributed={() => aplicarAccionPanel({ type: 'open-distributed' })}
        onCloseDistributed={() => aplicarAccionPanel({ type: 'close-distributed' })}
      />
      <Participants />
      {!displayName && <DisplayNameDialog onConfirm={(name) => setDisplayName(saveDisplayName(name))} />}
      <input ref={importInput} type="file" accept="application/json,.json" onChange={uploadJson} hidden />

      <main className="editor-workspace">
        <Canvas />
        <Palette />
        <PanelDock
          activePanel={paneles.activePanel}
          onPanelChange={(panel) => aplicarAccionPanel({ type: 'set-dock', panel })}
          onOpenDistributed={() => aplicarAccionPanel({ type: 'open-distributed' })}
        />
        {!projectReady && (
          <div className="project-sync-loading" role="status" aria-live="polite">
            <div className="project-sync-loading__card">
              <span className="project-sync-loading__spinner" aria-hidden="true" />
              <p className="project-sync-loading__text">
                Conectando al proyecto y sincronizando estado…
              </p>
              <button
                type="button"
                className="btn btn--secondary project-sync-loading__btn"
                onClick={() => useProjectStore.setState({ ready: true })}
              >
                Continuar sin conexión
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
