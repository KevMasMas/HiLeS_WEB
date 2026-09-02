import React from 'react';
import { HilesConnectionType, HilesElementType } from '../../types/hiles';
import { HilesElementTranslations } from '../../types/translations';
import { useEditorStore } from '../../stores/useEditorStore';
import { HilesGlyph } from './HilesGlyph';

const groups: Array<{ title: string; elements: HilesElementType[] }> = [
  { title: 'Blocks', elements: [HilesElementType.STRUCTURAL_BLOCK, HilesElementType.FUNCTIONAL_BLOCK] },
  { title: 'Petri Net', elements: [HilesElementType.PLACE, HilesElementType.TRANSITION] },
  { title: 'Interface', elements: [HilesElementType.SERVICE] },
  { title: 'Converters', elements: [HilesElementType.SAMPLE, HilesElementType.HOLD] },
];

const connections = [
  { type: HilesConnectionType.CONTINUOUS, label: 'Continuous Channel', line: 'solid', arrow: '▶' },
  { type: HilesConnectionType.DISCRETE, label: 'Discrete Event', line: 'solid', arrow: '▷' },
  { type: HilesConnectionType.PETRI, label: 'Logical / Petri Channel', line: 'dashed', arrow: '▷' },
  { type: HilesConnectionType.TOKEN_FLOW, label: 'Token Arc', line: 'solid', arrow: '▷' },
] as const;

export const Palette: React.FC = () => {
  const { activeConnectionType, setActiveConnectionType } = useEditorStore();

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: HilesElementType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside style={styles.aside}>
      <h3 style={styles.title}>HiLeS Elements</h3>
      <div style={styles.scroll}>
        {groups.map((group) => (
          <section key={group.title} style={styles.section}>
            <h4 style={styles.groupTitle}>{group.title}</h4>
            <div style={styles.grid}>
              {group.elements.map((type) => (
                <div key={type} style={styles.item} onDragStart={(event) => onDragStart(event, type)} draggable>
                  <HilesGlyph type={type} width={58} height={38} />
                  <span>{HilesElementTranslations[type]}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section style={styles.section}>
          <h4 style={styles.groupTitle}>Connectors</h4>
          <div style={{ display: 'grid', gap: 7 }}>
            {connections.map((connection) => {
              const active = activeConnectionType === connection.type;
              return (
                <button key={connection.type} onClick={() => setActiveConnectionType(connection.type)} style={{ ...styles.connector, ...(active ? styles.connectorActive : {}) }}>
                  <span style={{ width: 55, display: 'flex', alignItems: 'center' }}>
                    <span style={{ flex: 1, borderTop: `2px ${connection.line} currentColor` }} />{connection.arrow}
                  </span>
                  <span>{connection.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <div style={styles.help}>Drag components onto the canvas. Ports are managed from a block's Properties panel. Select a connector before joining two compatible endpoints.</div>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  aside: { width: 276, background: '#f8fafc', borderRight: '1px solid #d8e0ea', padding: '14px 12px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  title: { margin: '0 0 10px', fontSize: 16, color: '#172033' },
  scroll: { overflowY: 'auto', paddingRight: 3 },
  section: { marginBottom: 16 },
  groupTitle: { margin: '0 0 7px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 },
  item: { minHeight: 76, padding: '7px 4px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', cursor: 'grab', fontSize: 10, fontWeight: 700, textAlign: 'center', color: '#273449', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  connector: { width: '100%', padding: '8px 9px', borderWidth: 1, borderStyle: 'solid', borderColor: '#cbd5e1', borderRadius: 7, background: '#fff', color: '#273449', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, fontWeight: 700, textAlign: 'left' },
  connectorActive: { color: '#1d4ed8', borderColor: '#2563eb', background: '#eff6ff', boxShadow: '0 0 0 2px rgba(37,99,235,.12)' },
  help: { marginTop: 'auto', fontSize: 10, lineHeight: 1.35, color: '#64748b', borderTop: '1px solid #d8e0ea', paddingTop: 10 },
};
