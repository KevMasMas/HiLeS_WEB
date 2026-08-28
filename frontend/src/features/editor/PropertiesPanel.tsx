import React from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { HilesElementTranslations } from '../../types/translations';

export const PropertiesPanel: React.FC = () => {
  const { nodes, selectedElementId, updateNodeName, deleteElement } = useEditorStore();

  const selectedNode = nodes.find((n) => n.id === selectedElementId);

  if (!selectedNode) {
    return (
      <aside style={styles.aside}>
        <h3 style={styles.title}>Propiedades</h3>
        <p style={styles.empty}>Selecciona un elemento para editar sus propiedades.</p>
      </aside>
    );
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeName(selectedNode.id, e.target.value);
  };

  const handleDelete = () => {
    deleteElement(selectedNode.id);
  };

  return (
    <aside style={styles.aside}>
      <h3 style={styles.title}>Propiedades</h3>
      
      <div style={styles.formGroup}>
        <label style={styles.label}>ID Interno</label>
        <input style={styles.input} type="text" value={selectedNode.id} disabled />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Tipo</label>
        <input style={styles.input} type="text" value={HilesElementTranslations[selectedNode.data.hilesType as keyof typeof HilesElementTranslations] || selectedNode.data.hilesType as string} disabled />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Nombre</label>
        <input 
          style={styles.input} 
          type="text" 
          value={selectedNode.data.name as string} 
          onChange={handleNameChange} 
        />
      </div>

      <button style={styles.deleteButton} onClick={handleDelete}>
        Eliminar Elemento
      </button>
    </aside>
  );
};

const styles = {
  aside: {
    width: '280px',
    background: '#f4f4f4',
    borderLeft: '1px solid #ddd',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  title: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    color: '#333'
  },
  empty: {
    fontSize: '13px',
    color: '#666',
    fontStyle: 'italic'
  },
  formGroup: {
    marginBottom: '15px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '5px',
    color: '#444'
  },
  input: {
    width: '100%',
    padding: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box' as const
  },
  deleteButton: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};
