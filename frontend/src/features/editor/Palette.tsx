import React, { useRef } from 'react';
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
  { type: HilesConnectionType.DISCRETE, label: 'Discrete Event', stroke: '#172033', arrow: 'outlined' },
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
  const dragging = useRef(false);

  const onDragStart = (event: React.DragEvent<HTMLButtonElement>, nodeType: HilesElementType) => {
    dragging.current = true;
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const addWithTap = (nodeType: HilesElementType) => {
    if (dragging.current) return;
    window.dispatchEvent(new CustomEvent('hiles:add-element', { detail: { type: nodeType } }));
    if (window.matchMedia('(max-width: 760px)').matches) setPaletteOpen(false);
  };

  return (
    <div className="hiles-palette-wrapper" style={styles.wrapper}>
      <aside className="hiles-palette" style={{ ...styles.aside, ...(open ? styles.asideOpen : styles.asideClosed) }} aria-hidden={!open}>
      <div style={styles.titleRow}>
        <h3 style={styles.title}>HiLeS Elements</h3>
        <button type="button" aria-label="Close HiLeS elements" title="Close elements panel" onClick={() => setPaletteOpen(false)} style={styles.closeButton}>×</button>
      </div>
      <div style={styles.scroll}>
        {groups.map((group) => (
          <section key={group.title} style={styles.section}>
            <h4 style={styles.groupTitle}>{group.title}</h4>
            <div style={styles.grid}>
              {group.elements.map((type) => (
                <button
                  key={type}
                  type="button"
                  style={styles.item}
                  onClick={() => addWithTap(type)}
                  onDragStart={(event) => onDragStart(event, type)}
                  onDragEnd={() => { window.setTimeout(() => { dragging.current = false; }, 0); }}
                  title={`${HilesElementTranslations[type]}: arrastra o toca para añadir`}
                  draggable
                >
                  <HilesGlyph type={type} width={58} height={38} direction={type === HilesElementType.HOLD ? 'left' : 'right'} />
                  <span>{HilesElementTranslations[type]}</span>
                </button>
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
      <div style={styles.help}>Drag components onto the canvas or tap one to add it at the center. Ports are managed from a block's Properties panel. Select a connector before joining two compatible endpoints.</div>
      </aside>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' },
  aside: { position: 'absolute', top: 12, bottom: 12, left: 12, width: 276, background: '#f8fafc', border: '1px solid #d8e0ea', borderRadius: 10, padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', pointerEvents: 'auto', boxShadow: '0 12px 32px rgba(15,23,42,.18)', transition: 'transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease' },
  asideOpen: { transform: 'translateX(0)' },
  asideClosed: { transform: 'translateX(calc(-100% - 20px))', opacity: 0, pointerEvents: 'none', boxShadow: 'none' },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { margin: 0, fontSize: 16, color: '#172033' },
  closeButton: { width: 28, height: 28, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  scroll: { overflowY: 'auto', paddingRight: 3 },
  section: { marginBottom: 16 },
  groupTitle: { margin: '0 0 7px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 },
  item: { minHeight: 76, padding: '7px 4px', border: '1px solid #cbd5e1', borderRadius: 7, background: '#fff', cursor: 'grab', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, textAlign: 'center', color: '#273449', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' },
  connector: { width: '100%', padding: '8px 9px', borderWidth: 1, borderStyle: 'solid', borderColor: '#cbd5e1', borderRadius: 7, background: '#fff', color: '#273449', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, fontWeight: 700, textAlign: 'left' },
  connectorActive: { color: '#1d4ed8', borderColor: '#2563eb', background: '#eff6ff', boxShadow: '0 0 0 2px rgba(37,99,235,.12)' },
  help: { marginTop: 'auto', fontSize: 10, lineHeight: 1.35, color: '#64748b', borderTop: '1px solid #d8e0ea', paddingTop: 10 },
};
