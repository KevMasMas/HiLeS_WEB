import React from 'react';
import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react';
import { HilesElementType, type HilesNodeData, type HilesPort } from '../../types/hiles';
import { HilesGlyph } from './HilesGlyph';
import { useEditorStore } from '../../stores/useEditorStore';

const positionFor = (side: HilesPort['side']) => ({ left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom })[side];

const offsetStyle = (port: HilesPort): React.CSSProperties => port.side === 'left' || port.side === 'right'
  ? { top: `${Math.round(port.offset * 100)}%` }
  : { left: `${Math.round(port.offset * 100)}%` };

const PortHandles: React.FC<{ ports: HilesPort[] }> = ({ ports }) => (
  <>
    {ports.map((port) => (
      <React.Fragment key={port.id}>
        <Handle
          id={port.id}
          type={port.direction === 'input' ? 'target' : 'source'}
          position={positionFor(port.side)}
          className={`hiles-port hiles-port--${port.direction} hiles-port--${port.nature}`}
          style={offsetStyle(port)}
        />
        <span className={`hiles-port-label hiles-port-label--${port.side}`} style={offsetStyle(port)}>
          {port.direction === 'input' ? 'IN' : 'OUT'} · {port.name}
        </span>
      </React.Fragment>
    ))}
  </>
);

const PetriHandles = () => (
  <>
    <Handle id="petri-in" type="target" position={Position.Left} className="hiles-petri-handle hiles-petri-handle--in" />
    <Handle id="petri-out" type="source" position={Position.Right} className="hiles-petri-handle hiles-petri-handle--out" />
  </>
);

export const HilesNode: React.FC<NodeProps<Node<HilesNodeData>>> = ({ data, selected }) => {
  const { hilesType, name, ports, properties, summaryMode } = data;
  const { beginHistoryTransaction, endHistoryTransaction } = useEditorStore();
  const disabled = !properties.enabled;
  const locked = properties.locked;

  if (hilesType === HilesElementType.STRUCTURAL_BLOCK) {
    return (
      <div className={`hiles-structural ${summaryMode ? 'is-summary' : ''} ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
        <NodeResizer isVisible={selected && !locked} minWidth={200} minHeight={130} lineClassName="hiles-resizer-line" handleClassName="hiles-resizer-handle" onResizeStart={beginHistoryTransaction} onResizeEnd={endHistoryTransaction} />
        <PortHandles ports={ports} />
        {summaryMode ? (
          <div className="hiles-structural__summary">
            <strong>{name}</strong>
            <span>{properties.description || 'Structural Block'}</span>
          </div>
        ) : <>
          <div className="hiles-structural__header">
            <strong>{name}</strong>
            <span>{properties.collapsed ? '▸ Collapsed' : locked ? '🔒 Locked' : 'Structural Block'}</span>
          </div>
          {properties.description && <div className="hiles-structural__description">{properties.description}</div>}
        </>}
      </div>
    );
  }

  const isPetri = hilesType === HilesElementType.PLACE || hilesType === HilesElementType.TRANSITION;
  const isFunctional = hilesType === HilesElementType.FUNCTIONAL_BLOCK;
  return (
    <div className={`hiles-node ${isPetri ? 'hiles-node--petri' : ''} ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ${locked ? 'is-locked' : ''}`}>
      {isPetri ? <PetriHandles /> : <PortHandles ports={ports} />}
      <div className="hiles-node__symbol">
        <HilesGlyph type={hilesType} width={isFunctional ? 120 : hilesType === HilesElementType.TRANSITION ? 12 : 44} height={isFunctional ? 52 : hilesType === HilesElementType.TRANSITION ? 48 : 44} direction={properties.operatorDirection} />
        {isFunctional && properties.expression && <span className="hiles-node__expression">{properties.expression}</span>}
        {hilesType === HilesElementType.PLACE && properties.tokens > 0 && <span className="hiles-place-token" aria-label={`${properties.tokens} token`} />}
      </div>
      <div className="hiles-node__name">{name}</div>
      {hilesType === HilesElementType.TRANSITION && properties.condition && <div className="hiles-node__caption">{properties.condition}</div>}
    </div>
  );
};
