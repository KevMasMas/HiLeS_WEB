import React from 'react';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { useEditorStore } from '../../stores/useEditorStore';

export const Editor: React.FC = () => {
  const { saveModel, loadModel } = useEditorStore();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>HiLeS Web</h1>
        <div style={styles.actions}>
          <button style={styles.button} onClick={loadModel}>Cargar (Local)</button>
          <button style={{ ...styles.button, ...styles.primaryButton }} onClick={saveModel}>Guardar (Local)</button>
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
    gap: '10px'
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
