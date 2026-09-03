import React from 'react';
import { BaseEdge, getBezierPath, getStraightPath, type Edge, type EdgeProps } from '@xyflow/react';
import type { HilesEdgeData } from '../../types/hiles';

/**
 * Orthogonal HiLeS edge with an independent lane.  A lane separates paths that
 * leave the same port, so their labels and strokes remain distinguishable.
 */
type RoutedEdge = Edge<HilesEdgeData & { laneOffset?: number }>;

export const HilesEdge: React.FC<EdgeProps<RoutedEdge>> = (props) => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const routing = data?.routing ?? 'orthogonal';

  if (routing === 'straight') {
    const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    return <BaseEdge {...props} path={path} labelX={labelX} labelY={labelY} />;
  }
  if (routing === 'curved') {
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    return <BaseEdge {...props} path={path} labelX={labelX} labelY={labelY} />;
  }

  const lane = data?.laneOffset ?? 0;
  const horizontal = sourcePosition === 'left' || sourcePosition === 'right';
  const middle = horizontal ? (sourceX + targetX) / 2 + lane : (sourceY + targetY) / 2 + lane;
  const path = horizontal
    ? `M ${sourceX},${sourceY} L ${middle},${sourceY} L ${middle},${targetY} L ${targetX},${targetY}`
    : `M ${sourceX},${sourceY} L ${sourceX},${middle} L ${targetX},${middle} L ${targetX},${targetY}`;
  const labelX = horizontal ? middle : (sourceX + targetX) / 2;
  const labelY = horizontal ? (sourceY + targetY) / 2 : middle;
  return <BaseEdge {...props} path={path} labelX={labelX} labelY={labelY} />;
};
