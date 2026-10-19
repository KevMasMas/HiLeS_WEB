import React, { useEffect, useRef, useState } from 'react';
import { asegurarProjectIdEnUrl, normalizarProjectId } from '../../services/projects/projectUrl';
import { useEditorStore } from '../../stores/useEditorStore';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { PanelDock } from './PanelDock';
import { TopBar } from './TopBar';
import { getNextDockPanel, type DockPanel } from './panelState';
import { Participants } from '../collaboration/Participants';
import { useProjectStore } from '../../stores/useProjectStore';
import './editor.css';

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
    edges,
    paletteOpen,
    setPaletteOpen,
  } = useEditorStore();
  const importInput = useRef<HTMLInputElement>(null);
  const [activePanel, setActivePanel] = useState<DockPanel>(null);
  const [projectId, setProjectId] = useState(() => asegurarProjectIdEnUrl());
  const [projectDraft, setProjectDraft] = useState(projectId);
  const [fileName, setFileName] = useState('Untitled model');
  const projectReady = useProjectStore((state) => state.ready);

  useEffect(() => {
    loadAutosave();
    setPaletteOpen(false);
  }, [loadAutosave, setPaletteOpen]);

  useEffect(() => useProjectStore.getState().start(projectId), [projectId]);

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
    const blob = new Blob([exportModel()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectId}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setFileName(`${projectId}.json`);
  };

  const uploadJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importModel(await file.text());
      setFileName(file.name);
    }
    event.target.value = '';
  };

  const newProject = () => {
    if ((nodes.length || edges.length) && !window.confirm('Clear this project? This cannot be undone.')) return;
    clearModel();
    setFileName('Untitled model');
  };

  const togglePanel = (requested: Exclude<DockPanel, null>) => {
    setActivePanel((current) => getNextDockPanel(current, requested));
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
        activePanel={activePanel}
        onProjectDraftChange={setProjectDraft}
        onProjectCommit={commitProjectId}
        onNewProject={newProject}
        onImport={() => importInput.current?.click()}
        onExport={downloadJson}
        onUndo={undo}
        onRedo={redo}
        onTogglePalette={() => setPaletteOpen(!paletteOpen)}
        onTogglePanel={togglePanel}
      />
      <Participants />
      <input ref={importInput} type="file" accept="application/json,.json" onChange={uploadJson} hidden />

      <main className="editor-workspace">
        <Canvas />
        <Palette />
        <PanelDock activePanel={activePanel} onPanelChange={setActivePanel} />
        {!projectReady && <div className="project-sync-loading" role="status">Connecting to project and loading its retained snapshot…</div>}
      </main>
    </div>
  );
};
