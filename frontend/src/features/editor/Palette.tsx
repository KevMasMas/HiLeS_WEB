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

/** Los tres tipos de canal HiLeS que puede crear el usuario; TOKEN_FLOW solo conserva compatibilidad de importación. */
const connections = [
  { type: HilesConnectionType.CONTINUOUS, label: 'Continuous Channel', stroke: '#172033', arrow: 'filled' },
  { type: HilesConnectionType.DISCRETE, label: 'Discrete Event', stroke: '#2563eb', arrow: 'outlined' },
  { type: HilesConnectionType.PETRI, label: 'Logical / Petri Channel', stroke: '#172033', arrow: 'chevron', dashed: true },
] as const;

const ConnectorPreview: React.FC<{ stroke: string; arrow: 'filled' | 'outlined' | 'chevron'; dashed?: boolean }> = ({ stroke, arrow, dashed }) => (
  <svg width="55" height="18" viewBox="0 0 55 18" aria-hidden="true" focusable="false">
    <path d="M2 9 H45" stroke={stroke} strokeWidth="2" strokeDasharray={dashed ? '6 4' : undefined} fill="none" strokeLinecap="round" />
    <path d={arrow === 'chevron' ? 'M45 4 L53 9 L45 14' : 'M45 4 L53 9 L45 14 Z'} stroke={stroke} strokeWidth="2" fill={arrow === 'filled' ? stroke : 'none'} strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

export const Palette: React.FC = () => {
  const { activeConnectionType, setActiveConnectionType, paletteOpen: open, setPaletteOpen } = useEditorStore();

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: HilesElementType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={styles.wrapper}>
      <button
        type="button"
        aria-label={open ? 'Close HiLeS elements menu' : 'Open HiLeS elements menu'}
        aria-expanded={open}
        onClick={() => setPaletteOpen(!open)}
        style={styles.menuButton}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <aside style={{ ...styles.aside, ...(open ? styles.asideOpen : styles.asideClosed) }} aria-hidden={!open}>
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
                  <span style={{ width: 55, display: 'flex', alignItems: 'center' }}><ConnectorPreview stroke={connection.stroke} arrow={connection.arrow} dashed={'dashed' in connection && connection.dashed} /></span>
                  <span>{connection.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <div style={styles.help}>Drag components onto the canvas. Ports are managed from a block's Properties panel. Select a connector before joining two compatible endpoints.</div>
      </aside>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' },
  menuButton: { position: 'absolute', zIndex: 2, top: 12, left: 12, width: 38, height: 38, display: 'grid', placeItems: 'center', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', color: '#172033', boxShadow: '0 3px 12px rgba(15,23,42,.18)', cursor: 'pointer', pointerEvents: 'auto', fontSize: 21, lineHeight: 1 },
  aside: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 276, background: '#f8fafc', borderRight: '1px solid #d8e0ea', padding: '60px 12px 14px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', pointerEvents: 'auto', boxShadow: '5px 0 18px rgba(15,23,42,.12)', transition: 'transform 180ms ease, box-shadow 180ms ease' },
  asideOpen: { transform: 'translateX(0)' },
  asideClosed: { transform: 'translateX(-100%)', pointerEvents: 'none', boxShadow: 'none' },
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
