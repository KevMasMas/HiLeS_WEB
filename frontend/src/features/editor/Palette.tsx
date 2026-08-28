import React from 'react';
import { HilesElementType } from '../../types/hiles';
import { HilesElementTranslations } from '../../types/translations';

export const Palette: React.FC = () => {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: HilesElementType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const elements = Object.values(HilesElementType);

  return (
    <aside style={styles.aside}>
      <h3 style={styles.title}>Elementos HiLeS</h3>
      <div style={styles.list}>
        {elements.map((type) => (
          <div
            key={type}
            style={styles.item}
            onDragStart={(event) => onDragStart(event, type)}
            draggable
          >
            {HilesElementTranslations[type as keyof typeof HilesElementTranslations] || type}
          </div>
        ))}
      </div>
      
      <div style={styles.help}>
        <p>Arrastra un elemento hacia el área central para agregarlo al modelo.</p>
      </div>
    </aside>
  );
};

const styles = {
  aside: {
    width: '250px',
    background: '#f4f4f4',
    borderRight: '1px solid #ddd',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  title: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    color: '#333'
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px'
  },
  item: {
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'grab',
    fontSize: '12px',
    fontWeight: 'bold',
    textAlign: 'center' as const,
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  help: {
    marginTop: 'auto',
    fontSize: '11px',
    color: '#666',
    borderTop: '1px solid #ccc',
    paddingTop: '15px'
  }
};
