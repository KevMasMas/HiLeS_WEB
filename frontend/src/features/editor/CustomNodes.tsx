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

const svgPointStyle = (
  point: { x: number; y: number },
  width: number,
  height: number,
  viewBox: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, ...TRIANGLE_VIEWBOX },
): React.CSSProperties => {
  const scale = Math.min(width / viewBox.width, height / viewBox.height);
  const renderedWidth = viewBox.width * scale;
  const renderedHeight = viewBox.height * scale;
  return {
    left: (width - renderedWidth) / 2 + (point.x - viewBox.x) * scale,
    top: (height - renderedHeight) / 2 + (point.y - viewBox.y) * scale,
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

const absoluteNodePosition = (node: Node, nodes: Node[]) => {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
};

const sideTowardNode = (node: Node, other: Node | undefined, nodes: Node[], fallback: 'left' | 'right'): 'left' | 'right' | 'top' | 'bottom' => {
  if (!other) return fallback;
  const nodePosition = absoluteNodePosition(node, nodes);
  const otherPosition = absoluteNodePosition(other, nodes);
  const dx = otherPosition.x - nodePosition.x;
  const dy = otherPosition.y - nodePosition.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'top' : 'bottom';
};

const circlePointForSide = (side: 'left' | 'right' | 'top' | 'bottom') => ({
  left: { x: 28, y: 30 },
  right: { x: 72, y: 30 },
  top: { x: 50, y: 8 },
  bottom: { x: 50, y: 52 },
}[side]);

const CirclePetriHandles = ({ width, height, inputSide = 'left', outputSide = 'right' }: {
  width: number;
  height: number;
  inputSide?: 'left' | 'right' | 'top' | 'bottom';
  outputSide?: 'left' | 'right' | 'top' | 'bottom';
}) => {
  const viewBox = { x: 25, y: 5, width: 50, height: 50 };
  const inputPoint = svgPointStyle(circlePointForSide(inputSide), width, height, viewBox);
  const outputPoint = svgPointStyle(circlePointForSide(outputSide), width, height, viewBox);
  return (
    <>
      <Handle id="petri-in" type="target" position={positionFor(inputSide)} className="hiles-petri-handle hiles-petri-handle--in" style={inputPoint} />
      <Handle id="petri-out" type="source" position={positionFor(outputSide)} className="hiles-petri-handle hiles-petri-handle--out" style={outputPoint} />
    </>
  );
};

const TransitionPetriHandles = ({ width, height }: { width: number; height: number }) => {
  const viewBox = { x: 42, y: 2, width: 16, height: 56 };
  const leftPoint = svgPointStyle({ x: 44, y: 30 }, width, height, viewBox);
  const rightPoint = svgPointStyle({ x: 56, y: 30 }, width, height, viewBox);
  return (
    <>
      <Handle id="petri-in" type="target" position={Position.Left} className="hiles-petri-handle hiles-petri-handle--in" style={leftPoint} />
      <Handle id="petri-out" type="source" position={Position.Right} className="hiles-petri-handle hiles-petri-handle--out" style={rightPoint} />
    </>
  );
};

export const HilesNode: React.FC<NodeProps<Node<HilesNodeData>>> = ({ id, data, selected }) => {
  const { hilesType, name, ports, properties, summaryMode } = data;
  const { beginHistoryTransaction, endHistoryTransaction } = useEditorStore();
  const allNodes = useEditorStore((state) => state.nodes);
  const allEdges = useEditorStore((state) => state.edges);
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
  const currentNode = allNodes.find((node) => node.id === id);
  const inputConnection = allEdges.find((edge) => edge.target === id && edge.targetHandle === 'petri-in');
  const outputConnection = allEdges.find((edge) => edge.source === id && edge.sourceHandle === 'petri-out');
  const inputSide = currentNode
    ? sideTowardNode(currentNode, allNodes.find((node) => node.id === inputConnection?.source), allNodes, 'left')
    : 'left';
  const outputSide = currentNode
    ? sideTowardNode(currentNode, allNodes.find((node) => node.id === outputConnection?.target), allNodes, 'right')
    : 'right';
  return (
    <div className={`hiles-node ${isPetri ? 'hiles-node--petri' : ''} ${selected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''} ${locked ? 'is-locked' : ''}`}>
      {isPetri && hilesType === HilesElementType.TRANSITION ? null : isPetri && hilesType !== HilesElementType.PLACE ? <PetriHandles /> : !isPetri && !isTriangle && !isGlyphRectangle && <PortHandles ports={ports} />}
      <div className="hiles-node__symbol">
        {hilesType === HilesElementType.PLACE && <CirclePetriHandles width={44} height={44} inputSide={inputSide} outputSide={outputSide} />}
        {hilesType === HilesElementType.TRANSITION && <TransitionPetriHandles width={glyphWidth} height={glyphHeight} />}
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
