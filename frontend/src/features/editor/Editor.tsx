import React, { useRef } from 'react';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { useEditorStore } from '../../stores/useEditorStore';

export const Editor: React.FC = () => {
  const { saveModel, loadModel, exportModel, importModel, statusMessage } = useEditorStore();
  const importInput = useRef<HTMLInputElement>(null);

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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>HiLeS Web</h1>
        <div style={styles.actions}>
          {statusMessage && <span style={styles.status}>✓ {statusMessage}</span>}
          <input ref={importInput} type="file" accept="application/json,.json" onChange={uploadJson} style={{ display: 'none' }} />
          <button style={styles.button} onClick={() => importInput.current?.click()}>Import JSON</button>
          <button style={styles.button} onClick={downloadJson}>Export JSON</button>
          <button style={styles.button} onClick={loadModel}>Load (Local)</button>
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={saveModel}>Save (Local)</button>
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
  primaryButton: {
    background: '#007bff',
    color: 'white',
    border: 'none'
  },
  editorArea: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  }
};
