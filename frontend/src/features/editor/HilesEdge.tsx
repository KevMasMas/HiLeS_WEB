import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getStraightPath, Position, type Edge, type EdgeProps } from '@xyflow/react';
import type { HilesEdgeData } from '../../types/hiles';

/**
 * Orthogonal HiLeS edge with an independent lane.  A lane separates paths that
 * leave the same port, so their labels and strokes remain distinguishable.
 */
type RoutedEdge = Edge<HilesEdgeData & { laneOffset?: number; targetLaneOffset?: number }>;

const ExternalEdgeLabel: React.FC<{ label?: string; x: number; y: number }> = ({ label, x, y }) => label ? (
  <EdgeLabelRenderer>
    <div style={{
      position: 'absolute',
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
      padding: '2px 4px',
      borderRadius: 2,
      background: '#fff',
      color: '#172033',
      fontSize: 10,
      lineHeight: 1.1,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>{label}</div>
  </EdgeLabelRenderer>
) : null;

const arrowPathFor = (sourceX: number, sourceY: number, targetX: number, targetY: number, targetPosition: Position) => {
  const horizontal = Math.abs(targetX - sourceX) >= Math.abs(targetY - sourceY);
  const directionX = targetPosition === Position.Left ? 1 : targetPosition === Position.Right ? -1 : Math.sign(targetX - sourceX) || 1;
  const directionY = targetPosition === Position.Top ? 1 : targetPosition === Position.Bottom ? -1 : Math.sign(targetY - sourceY) || 1;
  const arrowSize = 7;
  return horizontal
    ? `M ${targetX - directionX * arrowSize},${targetY - arrowSize / 1.4} L ${targetX},${targetY} L ${targetX - directionX * arrowSize},${targetY + arrowSize / 1.4}`
    : `M ${targetX - arrowSize / 1.4},${targetY - directionY * arrowSize} L ${targetX},${targetY} L ${targetX + arrowSize / 1.4},${targetY - directionY * arrowSize}`;
};

export const HilesEdge: React.FC<EdgeProps<RoutedEdge>> = (props) => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const edgeLabel = typeof props.label === 'string' ? props.label : undefined;
  const routing = data?.routing ?? 'orthogonal';
  const alignedHorizontalConnection = sourcePosition === 'right'
    && targetPosition === 'left'
    && Math.abs(sourceY - targetY) < 1;

  if (routing === 'straight' || alignedHorizontalConnection) {
    const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    const horizontal = Math.abs(targetX - sourceX) >= Math.abs(targetY - sourceY);
    const labelProgress = 0.45;
    const labelX = sourceX + (targetX - sourceX) * labelProgress;
    const labelY = sourceY + (targetY - sourceY) * labelProgress + (horizontal ? -14 : 0);
    const arrowPath = arrowPathFor(sourceX, sourceY, targetX, targetY, targetPosition);
    const externalLabelX = horizontal ? targetX - 55 : labelX;
    return (
      <>
        <BaseEdge {...props} markerEnd={undefined} label={undefined} path={path} />
        <path d={arrowPath} className="react-flow__edge-path" style={{ ...props.style, fill: 'none', pointerEvents: 'none' }} />
        <ExternalEdgeLabel label={edgeLabel} x={externalLabelX} y={labelY} />
      </>
    );
  }
  if (routing === 'curved') {
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    return <BaseEdge {...props} path={path} labelX={labelX} labelY={labelY} />;
  }

  const lane = data?.laneOffset ?? 0;
  const targetLane = data?.targetLaneOffset ?? 0;
  const routedTargetX = targetPosition === 'left' || targetPosition === 'right' ? targetX : targetX + targetLane;
  const routedTargetY = targetPosition === 'top' || targetPosition === 'bottom' ? targetY : targetY + targetLane;
  const horizontal = sourcePosition === 'left' || sourcePosition === 'right';
  const routeGap = 24 + Math.abs(lane);
  const middle = horizontal
    ? sourcePosition === targetPosition
      ? sourcePosition === 'left'
        ? Math.min(sourceX, routedTargetX) - routeGap
        : Math.max(sourceX, routedTargetX) + routeGap
      : sourcePosition === 'right' && targetPosition === 'left' && sourceY > targetY
        ? Math.max(sourceX, routedTargetX) + routeGap
        : sourcePosition === 'left' && targetPosition === 'right' && sourceY > targetY
          ? Math.min(sourceX, routedTargetX) - routeGap
          : (sourceX + routedTargetX) / 2 + lane
    : sourcePosition === targetPosition
      ? sourcePosition === 'top'
        ? Math.min(sourceY, routedTargetY) - routeGap
        : Math.max(sourceY, routedTargetY) + routeGap
      : (sourceY + routedTargetY) / 2 + lane;
  const path = horizontal
    ? `M ${sourceX},${sourceY} L ${middle},${sourceY} L ${middle},${routedTargetY} L ${routedTargetX},${routedTargetY}`
    : `M ${sourceX},${sourceY} L ${sourceX},${middle} L ${routedTargetX},${middle} L ${routedTargetX},${routedTargetY}`;
  const alignedHorizontal = Math.abs(sourceY - routedTargetY) < 1;
  const labelX = alignedHorizontal
    ? sourceX + (routedTargetX - sourceX) * 0.45
    : horizontal ? middle : (sourceX + routedTargetX) / 2;
  const labelY = alignedHorizontal ? sourceY - 14 : horizontal ? (sourceY + routedTargetY) / 2 : middle;
  const orthogonalArrowPath = alignedHorizontal ? arrowPathFor(sourceX, sourceY, routedTargetX, routedTargetY, targetPosition) : null;
  const externalLabelX = alignedHorizontal ? routedTargetX - 55 : labelX;
  return (
    <>
      <BaseEdge {...props} markerEnd={alignedHorizontal ? undefined : props.markerEnd} label={alignedHorizontal ? undefined : edgeLabel} path={path} labelX={labelX} labelY={labelY} />
      {orthogonalArrowPath && <path d={orthogonalArrowPath} className="react-flow__edge-path" style={{ ...props.style, fill: 'none', pointerEvents: 'none' }} />}
      <ExternalEdgeLabel label={alignedHorizontal ? edgeLabel : undefined} x={externalLabelX} y={labelY} />
    </>
  );
};
