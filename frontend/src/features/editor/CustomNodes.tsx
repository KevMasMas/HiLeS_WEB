import React from 'react';
import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react';
import { HilesElementType, type HilesNodeData, type HilesPort } from '../../types/hiles';
import { HilesGlyph } from './HilesGlyph';
import { TRIANGLE_VIEWBOX, triangleVertices } from './triangleGeometry';
import { useEditorStore } from '../../stores/useEditorStore';

const positionFor = (side: HilesPort['side']) => ({ left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom })[side];

const offsetStyle = (port: HilesPort): React.CSSProperties => port.side === 'left' || port.side === 'right'
  ? { top: `${Math.round(port.offset * 100)}%` }
  : { left: `${Math.round(port.offset * 100)}%` };

const trianglePointForPort = (port: HilesPort, direction: NonNullable<HilesNodeData['properties']>['operatorDirection']) => {
  const [first, second, tip] = triangleVertices(direction);
  const wideSide = direction === 'right' ? 'left' : direction === 'left' ? 'right' : direction === 'up' ? 'bottom' : 'top';
  if (port.side === wideSide) return port.offset <= 0.5 ? first : second;
  if (port.side === ({ left: 'left', right: 'right', up: 'top', down: 'bottom' } as const)[direction]) return tip;
  return null;
};

const rectanglePointForPort = (port: HilesPort, bounds: { x: number; y: number; width: number; height: number }) => {
  const offset = Math.max(0, Math.min(1, port.offset));
  if (port.side === 'top') return { x: bounds.x + bounds.width * offset, y: bounds.y };
  if (port.side === 'bottom') return { x: bounds.x + bounds.width * offset, y: bounds.y + bounds.height };
  if (port.side === 'left') return { x: bounds.x, y: bounds.y + bounds.height * offset };
  return { x: bounds.x + bounds.width, y: bounds.y + bounds.height * offset };
};

const svgPointStyle = (point: { x: number; y: number }, width: number, height: number): React.CSSProperties => {
  const scale = Math.min(width / TRIANGLE_VIEWBOX.width, height / TRIANGLE_VIEWBOX.height);
  const renderedWidth = TRIANGLE_VIEWBOX.width * scale;
  const renderedHeight = TRIANGLE_VIEWBOX.height * scale;
  return {
    left: (width - renderedWidth) / 2 + point.x * scale,
    top: (height - renderedHeight) / 2 + point.y * scale,
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)',
  };
};

const PortHandles: React.FC<{
  ports: HilesPort[];
  triangle?: { direction: HilesNodeData['properties']['operatorDirection']; width: number; height: number };
  rectangle?: { bounds: { x: number; y: number; width: number; height: number }; width: number; height: number };
}> = ({ ports, triangle, rectangle }) => (
  <>
    {ports.map((port) => (
      <React.Fragment key={port.id}>
        <Handle
          id={port.id}
          type={port.direction === 'input' ? 'target' : 'source'}
          position={positionFor(port.side)}
          className={`hiles-port hiles-port--${port.direction} hiles-port--${port.nature}`}
          style={triangle
            ? (() => { const point = trianglePointForPort(port, triangle.direction); return point ? svgPointStyle(point, triangle.width, triangle.height) : offsetStyle(port); })()
            : rectangle
              ? svgPointStyle(rectanglePointForPort(port, rectangle.bounds), rectangle.width, rectangle.height)
              : offsetStyle(port)}
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
  const isTriangle = hilesType === HilesElementType.SAMPLE || hilesType === HilesElementType.HOLD;
  const isGlyphRectangle = hilesType === HilesElementType.FUNCTIONAL_BLOCK || hilesType === HilesElementType.SERVICE;
  const glyphWidth = isFunctional ? 120 : hilesType === HilesElementType.TRANSITION ? 12 : 44;
  const glyphHeight = isFunctional ? 52 : hilesType === HilesElementType.TRANSITION ? 48 : 44;
  const rectangleBounds = hilesType === HilesElementType.FUNCTIONAL_BLOCK
    ? { x: 7, y: 8, width: 86, height: 44 }
    : { x: 32, y: 12, width: 36, height: 36 };
  return (
    <div className={`hiles-node ${isPetri ? 'hiles-node--petri' : ''} ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ${locked ? 'is-locked' : ''}`}>
      {isPetri ? <PetriHandles /> : !isTriangle && !isGlyphRectangle && <PortHandles ports={ports} />}
      <div className="hiles-node__symbol">
        {isTriangle && <PortHandles ports={ports} triangle={{ direction: properties.operatorDirection, width: glyphWidth, height: glyphHeight }} />}
        {isGlyphRectangle && <PortHandles ports={ports} rectangle={{ bounds: rectangleBounds, width: glyphWidth, height: glyphHeight }} />}
        <HilesGlyph type={hilesType} width={glyphWidth} height={glyphHeight} direction={properties.operatorDirection} />
        {isFunctional && properties.expression && <span className="hiles-node__expression">{properties.expression}</span>}
        {hilesType === HilesElementType.PLACE && properties.tokens > 0 && <span className="hiles-place-token" aria-label={`${properties.tokens} token`} />}
      </div>
      <div className="hiles-node__name">{name}</div>
      {hilesType === HilesElementType.TRANSITION && properties.condition && <div className="hiles-node__caption">{properties.condition}</div>}
    </div>
  );
};
