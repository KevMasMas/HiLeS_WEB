import React from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { HilesElementTranslations } from '../../types/translations';
import { HilesElementType, type ConnectionRouting, type HilesPort, type PortDataType, type PortNature } from '../../types/hiles';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label style={styles.field}><span style={styles.label}>{label}</span>{children}</label>
);

const TextInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} style={styles.input} />;
const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} style={{ ...styles.input, minHeight: 62, resize: 'vertical' }} />;

const PortEditor: React.FC<{ nodeId: string; ports: HilesPort[] }> = ({ nodeId, ports }) => {
  const { addPort, updatePort, removePort } = useEditorStore();
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}><strong>Ports</strong><span>{ports.length}</span></div>
      {ports.map((port) => (
        <div key={port.id} style={styles.portCard}>
          <div style={styles.portTitle}>
            <span style={port.direction === 'input' ? styles.inputBadge : styles.outputBadge}>{port.direction === 'input' ? 'IN' : 'OUT'}</span>
            <input aria-label={`${port.direction} port name`} value={port.name} onChange={(event) => updatePort(nodeId, port.id, { name: event.target.value })} style={styles.compactInput} />
            <button title="Remove port" onClick={() => removePort(nodeId, port.id)} style={styles.iconButton}>×</button>
          </div>
          <div style={styles.portGrid}>
            <select aria-label="Port direction" value={port.direction} onChange={(event) => updatePort(nodeId, port.id, { direction: event.target.value as HilesPort['direction'], side: event.target.value === 'input' ? 'left' : 'right' })} style={styles.compactInput}>
              <option value="input">Input</option><option value="output">Output</option>
            </select>
            <select aria-label="Port data type" value={port.dataType} onChange={(event) => updatePort(nodeId, port.id, { dataType: event.target.value as PortDataType })} style={styles.compactInput}>
              {['boolean', 'integer', 'real', 'string', 'vector', 'custom'].map((value) => <option key={value}>{value}</option>)}
            </select>
            <select aria-label="Port nature" value={port.nature} onChange={(event) => updatePort(nodeId, port.id, { nature: event.target.value as PortNature })} style={styles.compactInput}>
              <option value="continuous">Data</option><option value="control">Control</option>
            </select>
          </div>
        </div>
      ))}
      <div style={styles.addButtons}>
        <button style={styles.secondaryButton} onClick={() => addPort(nodeId, 'input')}>+ Input</button>
        <button style={styles.secondaryButton} onClick={() => addPort(nodeId, 'output')}>+ Output</button>
      </div>
    </section>
  );
};

export const PropertiesPanel: React.FC = () => {
  const store = useEditorStore();
  const selectedNode = store.nodes.find((node) => node.id === store.selectedElementId);
  const selectedEdge = store.edges.find((edge) => edge.id === store.selectedConnectionId);

  if (selectedEdge) {
    const data = selectedEdge.data!;
    return (
      <aside style={styles.aside}>
        <h3 style={styles.title}>Connection Properties</h3>
        <div style={styles.typePill}>{data.hilesConnectionType.replaceAll('_', ' ')}</div>
        <Field label="Label"><TextInput value={String(selectedEdge.label ?? '')} onChange={(event) => store.updateConnection(selectedEdge.id, { label: event.target.value })} /></Field>
        <Field label="Routing">
          <select style={styles.input} value={data.routing} onChange={(event) => store.updateConnection(selectedEdge.id, { data: { routing: event.target.value as ConnectionRouting } })}>
            <option value="orthogonal">Orthogonal</option><option value="straight">Straight</option><option value="curved">Curved</option>
          </select>
        </Field>
        {data.hilesConnectionType === 'TOKEN_FLOW'
          ? <Field label="Weight"><TextInput type="number" min={1} value={data.weight} onChange={(event) => store.updateConnection(selectedEdge.id, { data: { weight: Number(event.target.value) } })} /></Field>
          : <Field label="Delay"><TextInput type="number" min={0} step="0.1" value={data.delay} onChange={(event) => store.updateConnection(selectedEdge.id, { data: { delay: Number(event.target.value) } })} /></Field>}
        <button style={styles.deleteButton} onClick={() => store.deleteConnection(selectedEdge.id)}>Delete Connection</button>
      </aside>
    );
  }

  if (!selectedNode) return <aside style={styles.aside}><h3 style={styles.title}>Properties</h3><p style={styles.empty}>Select a component or connection to edit its model properties.</p></aside>;

  const { hilesType, name, properties, ports } = selectedNode.data;
  const update = store.updateNodeProperties;
  const portCapableTypes: HilesElementType[] = [HilesElementType.STRUCTURAL_BLOCK, HilesElementType.FUNCTIONAL_BLOCK, HilesElementType.SERVICE];
  const supportsPorts = portCapableTypes.includes(hilesType);

  return (
    <aside style={styles.aside}>
      <h3 style={styles.title}>Properties</h3>
      <div style={styles.typePill}>{HilesElementTranslations[hilesType]}</div>
      <Field label="Name"><TextInput value={name} onChange={(event) => store.updateNodeName(selectedNode.id, event.target.value)} /></Field>

      {hilesType === HilesElementType.STRUCTURAL_BLOCK && <>
        <Field label="Description"><TextArea value={properties.description} onChange={(event) => update(selectedNode.id, { description: event.target.value })} /></Field>
        <label style={styles.check}><input type="checkbox" checked={properties.collapsed} onChange={(event) => update(selectedNode.id, { collapsed: event.target.checked })} /> Collapsed</label>
        <label style={styles.check}><input type="checkbox" checked={properties.locked} onChange={(event) => update(selectedNode.id, { locked: event.target.checked })} /> Locked</label>
      </>}

      {hilesType === HilesElementType.FUNCTIONAL_BLOCK && <>
        <Field label="Expression"><TextInput placeholder="A * B" value={properties.expression} onChange={(event) => update(selectedNode.id, { expression: event.target.value })} /></Field>
        <Field label="Execution Delay"><TextInput type="number" min={0} step="0.1" value={properties.executionDelay} onChange={(event) => update(selectedNode.id, { executionDelay: Number(event.target.value) })} /></Field>
        <Field label="Description"><TextArea value={properties.description} onChange={(event) => update(selectedNode.id, { description: event.target.value })} /></Field>
        <label style={styles.check}><input type="checkbox" checked={properties.enabled} onChange={(event) => update(selectedNode.id, { enabled: event.target.checked })} /> Enabled</label>
      </>}

      {hilesType === HilesElementType.PLACE && <>
        <Field label="Tokens"><TextInput type="number" min={0} max={properties.maxTokens} value={properties.tokens} onChange={(event) => update(selectedNode.id, { tokens: Math.max(0, Math.min(properties.maxTokens, Number(event.target.value))) })} /></Field>
        <Field label="Max Tokens"><TextInput type="number" min={1} value={properties.maxTokens} onChange={(event) => update(selectedNode.id, { maxTokens: Math.max(1, Number(event.target.value)), tokens: Math.min(properties.tokens, Math.max(1, Number(event.target.value))) })} /></Field>
      </>}

      {hilesType === HilesElementType.TRANSITION && <>
        <Field label="Delay"><TextInput type="number" min={0} step="0.1" value={properties.delay} onChange={(event) => update(selectedNode.id, { delay: Number(event.target.value) })} /></Field>
        <Field label="Condition"><TextArea placeholder="sensorActive == true" value={properties.condition} onChange={(event) => update(selectedNode.id, { condition: event.target.value })} /></Field>
        <label style={styles.check}><input type="checkbox" checked={properties.enabled} onChange={(event) => update(selectedNode.id, { enabled: event.target.checked })} /> Enabled</label>
      </>}

      {(hilesType === HilesElementType.SAMPLE || hilesType === HilesElementType.HOLD) && <>
        <Field label="Orientation">
          <select style={styles.input} value={properties.operatorDirection} onChange={(event) => update(selectedNode.id, { operatorDirection: event.target.value as 'left' | 'right' | 'up' | 'down' })}>
            <option value="right">Pointing right</option><option value="left">Pointing left</option><option value="up">Pointing up</option><option value="down">Pointing down</option>
          </select>
        </Field>
        <p style={styles.help}>{hilesType === HilesElementType.SAMPLE ? 'Data and control inputs stay on the wide side; the sampled output stays on the tip.' : 'The input stays on the wide side; the held output stays on the tip.'}</p>
      </>}
      {hilesType === HilesElementType.SAMPLE && <Field label="Description"><TextArea value={properties.description} onChange={(event) => update(selectedNode.id, { description: event.target.value })} /></Field>}
      {hilesType === HilesElementType.HOLD && <Field label="Held Value"><TextInput value={properties.heldValue} onChange={(event) => update(selectedNode.id, { heldValue: event.target.value })} /></Field>}
      {supportsPorts && <PortEditor nodeId={selectedNode.id} ports={ports} />}

      <div style={styles.id}>ID · {selectedNode.id}</div>
      <button style={styles.deleteButton} onClick={() => store.deleteElement(selectedNode.id)}>Delete Element</button>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  aside: { width: 310, background: '#f8fafc', borderLeft: '1px solid #d8e0ea', padding: 15, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' },
  title: { margin: '0 0 8px', fontSize: 16, color: '#172033' },
  empty: { fontSize: 12, color: '#64748b', fontStyle: 'italic', lineHeight: 1.5 },
  help: { margin: '-3px 0 12px', color: '#64748b', fontSize: 10, lineHeight: 1.4 },
  typePill: { alignSelf: 'flex-start', marginBottom: 15, padding: '3px 7px', borderRadius: 999, background: '#e2e8f0', color: '#475569', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' },
  field: { display: 'block', marginBottom: 12 },
  label: { display: 'block', marginBottom: 5, color: '#475569', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' },
  input: { width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: 5, background: '#fff', color: '#172033', boxSizing: 'border-box', fontSize: 12 },
  check: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, color: '#334155', fontSize: 12, fontWeight: 650 },
  section: { marginTop: 10, paddingTop: 12, borderTop: '1px solid #d8e0ea' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#334155', fontSize: 11, textTransform: 'uppercase' },
  portCard: { marginBottom: 8, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' },
  portTitle: { display: 'grid', gridTemplateColumns: '32px 1fr 25px', gap: 5, alignItems: 'center', marginBottom: 6 },
  inputBadge: { padding: '3px 4px', borderRadius: 3, background: '#dbeafe', color: '#1d4ed8', fontSize: 8, fontWeight: 900, textAlign: 'center' },
  outputBadge: { padding: '3px 4px', borderRadius: 3, background: '#dcfce7', color: '#166534', fontSize: 8, fontWeight: 900, textAlign: 'center' },
  compactInput: { width: '100%', minWidth: 0, padding: '5px', border: '1px solid #d8e0ea', borderRadius: 4, boxSizing: 'border-box', fontSize: 10 },
  iconButton: { border: 0, borderRadius: 4, background: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 900 },
  portGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 },
  addButtons: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  secondaryButton: { padding: '7px', border: '1px solid #94a3b8', borderRadius: 5, background: '#fff', color: '#334155', cursor: 'pointer', fontSize: 10, fontWeight: 750 },
  id: { marginTop: 15, overflow: 'hidden', textOverflow: 'ellipsis', color: '#94a3b8', fontSize: 8, whiteSpace: 'nowrap' },
  deleteButton: { marginTop: 12, padding: 9, border: '1px solid #fecaca', borderRadius: 5, background: '#fff1f2', color: '#be123c', cursor: 'pointer', fontWeight: 800 },
};
