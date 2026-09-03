import React, { useEffect, useRef } from 'react';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { useEditorStore } from '../../stores/useEditorStore';

export const Editor: React.FC = () => {
  const { exportModel, importModel, statusMessage, loadAutosave, undo, redo, canUndo, canRedo, clearModel, nodes, edges } = useEditorStore();
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAutosave(); }, [loadAutosave]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z' && event.key.toLowerCase() !== 'y') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'y' || event.shiftKey) {
        event.preventDefault(); redo();
      } else {
        event.preventDefault(); undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const downloadJson = () => {
    const blob = new Blob([exportModel()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'hiles-model.json'; link.click();
    URL.revokeObjectURL(url);
  };

  const uploadJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importModel(await file.text());
    event.target.value = '';
  };

  const newProject = () => {
    if ((nodes.length || edges.length) && !window.confirm('Clear this project? This cannot be undone.')) return;
    clearModel();
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>HiLeS Web</h1>
        <div style={styles.actions}>
          {statusMessage && <span style={styles.status}>✓ {statusMessage}</span>}
          <input ref={importInput} type="file" accept="application/json,.json" onChange={uploadJson} style={{ display: 'none' }} />
          <button style={styles.button} onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd + Z)">↶ Undo</button>
          <button style={styles.button} onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd + Shift + Z or Ctrl + Y)">↷ Redo</button>
          <button style={styles.button} onClick={newProject} title="Clear the current project">New Project</button>
          <button style={styles.button} onClick={() => importInput.current?.click()}>Import JSON</button>
          <button style={styles.button} onClick={downloadJson}>Export JSON</button>
          <span style={styles.autosave}>Autosaved locally</span>
        </div>
      </header>
      
      <div style={styles.editorArea}>
        <Palette />
        <Canvas />
        <PropertiesPanel />
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    fontFamily: 'sans-serif'
  },
  header: {
    height: '60px',
    background: '#282c34',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px'
  },
  logo: {
    margin: 0,
    fontSize: '20px'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  status: {
    fontSize: '11px',
    color: '#bfdbfe'
  },
  button: {
    padding: '8px 16px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    background: '#fff',
    borderRadius: '4px',
    fontWeight: 'bold'
  },
  autosave: {
    color: '#bfdbfe',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  editorArea: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  }
};
