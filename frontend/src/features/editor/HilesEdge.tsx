import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useReactFlow, type Edge, type EdgeProps, type Node, type XYPosition } from '@xyflow/react';
import { useEditorStore } from '../../stores/useEditorStore';
import { HilesElementType, type ConnectionWaypoint, type HilesEdgeData } from '../../types/hiles';

type RoutedEdge = Edge<HilesEdgeData & { laneOffset?: number; targetLaneOffset?: number }>;

const ExternalEdgeLabel: React.FC<{ label?: string; x: number; y: number }> = ({ label, x, y }) => label ? (
  <EdgeLabelRenderer>
    <div className="hiles-edge-label" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}>{label}</div>
  </EdgeLabelRenderer>
) : null;

const distanceToSegmentSquared = (point: XYPosition, start: XYPosition, end: XYPosition) => {
  const dx = end.x - start.x; const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return (point.x - (start.x + ratio * dx)) ** 2 + (point.y - (start.y + ratio * dy)) ** 2;
};

const insertionIndex = (point: ConnectionWaypoint, points: XYPosition[]) => points.slice(0, -1).reduce((closest, start, index) => {
  const distance = distanceToSegmentSquared(point, start, points[index + 1]);
  return distance < closest.distance ? { index, distance } : closest;
}, { index: 0, distance: Number.POSITIVE_INFINITY }).index;

const labelPointAlongRoute = (points: XYPosition[]): XYPosition => {
  const segments = points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
  });
  const halfway = segments.reduce((total, segment) => total + segment.length, 0) / 2;
  let travelled = 0;
  for (const segment of segments) {
    if (travelled + segment.length >= halfway) {
      const ratio = segment.length ? (halfway - travelled) / segment.length : 0;
      const x = segment.start.x + (segment.end.x - segment.start.x) * ratio;
      const y = segment.start.y + (segment.end.y - segment.start.y) * ratio;
      return Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y)
        ? { x, y: y - 14 }
        : { x: x + 14, y };
    }
    travelled += segment.length;
  }
  return points[0] ?? { x: 0, y: 0 };
};

const absolutePosition = (node: Node, nodesById: Map<string, Node>): XYPosition => {
  let { x, y } = node.position; let parentId = node.parentId;
  while (parentId) { const parent = nodesById.get(parentId); if (!parent) break; x += parent.position.x; y += parent.position.y; parentId = parent.parentId; }
  return { x, y };
};

const blockAt = (point: XYPosition, nodes: Node[]) => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.filter((node) => node.data.hilesType === HilesElementType.STRUCTURAL_BLOCK).map((node) => {
    const position = absolutePosition(node, byId); const width = Number(node.measured?.width ?? node.style?.width ?? 0); const height = Number(node.measured?.height ?? node.style?.height ?? 0);
    return { node, position, area: width * height, contains: point.x >= position.x && point.x <= position.x + width && point.y >= position.y && point.y <= position.y + height };
  }).filter((candidate) => candidate.contains).sort((left, right) => left.area - right.area)[0];
};

/**
 * The custom edge has an explicit SVG hit target, so double-click works even
 * over empty canvas. Once a user adds a waypoint, a polyline is used to keep
 * every waypoint an exact, draggable vertex of the route.
 */
export const HilesEdge: React.FC<EdgeProps<RoutedEdge>> = (props) => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, id } = props;
  const { screenToFlowPosition } = useReactFlow();
  const { nodes, addConnectionWaypoint, moveConnectionWaypoint, beginHistoryTransaction, endHistoryTransaction } = useEditorStore();
  const waypoints = useMemo(() => data?.waypoints ?? [], [data?.waypoints]);
  const edgeLabel = typeof props.label === 'string' ? props.label : undefined;
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const absoluteWaypoints = useMemo(() => waypoints.map((waypoint) => {
    const parent = waypoint.parentBlockId ? nodesById.get(waypoint.parentBlockId) : undefined;
    return parent ? { x: absolutePosition(parent, nodesById).x + waypoint.x, y: absolutePosition(parent, nodesById).y + waypoint.y } : waypoint;
  }), [nodesById, waypoints]);
  const routePoints: XYPosition[] = useMemo(() => [{ x: sourceX, y: sourceY }, ...absoluteWaypoints, { x: targetX, y: targetY }], [absoluteWaypoints, sourceX, sourceY, targetX, targetY]);
  const waypointPath = routePoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x},${point.y}`).join(' ');
  const toFlowPoint = useCallback((event: { clientX: number; clientY: number }) => screenToFlowPosition({ x: event.clientX, y: event.clientY }), [screenToFlowPosition]);
  const storeWaypoint = useCallback((point: XYPosition): ConnectionWaypoint => {
    const parent = blockAt(point, nodes);
    return parent ? { x: point.x - parent.position.x, y: point.y - parent.position.y, parentBlockId: parent.node.id } : point;
  }, [nodes]);
  const addWaypoint = useCallback((event: React.MouseEvent<SVGPathElement>) => {
    event.preventDefault(); event.stopPropagation();
    const point = toFlowPoint(event.nativeEvent);
    addConnectionWaypoint(id, storeWaypoint(point), insertionIndex(point, routePoints));
  }, [addConnectionWaypoint, id, routePoints, storeWaypoint, toFlowPoint]);
  const activeDrag = useRef<{ index: number } | null>(null);
  const snapWaypoint = useCallback((point: XYPosition, index: number, disableMagnet = false): XYPosition => {
    let x = Math.round(point.x); let y = Math.round(point.y);
    if (disableMagnet) return { x, y };
    const previous = routePoints[index];
    const next = routePoints[index + 2];
    const magnetDistance = 6;
    // Prefer an exact axis shared by either neighbouring segment. This keeps
    // hand-routed cables clean while still allowing free placement with Alt.
    if (Math.abs(x - previous.x) <= magnetDistance) x = previous.x;
    else if (Math.abs(x - next.x) <= magnetDistance) x = next.x;
    if (Math.abs(y - previous.y) <= magnetDistance) y = previous.y;
    else if (Math.abs(y - next.y) <= magnetDistance) y = next.y;
    return { x, y };
  }, [routePoints]);
  const startDragging = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); event.stopPropagation(); activeDrag.current = { index: Number(event.currentTarget.dataset.index) }; beginHistoryTransaction();
  }, [beginHistoryTransaction]);
  useEffect(() => {
    const move = (event: MouseEvent) => { const drag = activeDrag.current; if (drag) moveConnectionWaypoint(id, drag.index, storeWaypoint(snapWaypoint(toFlowPoint(event), drag.index, event.altKey))); };
    const stop = () => { if (activeDrag.current) { activeDrag.current = null; endHistoryTransaction(); } };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); };
  }, [endHistoryTransaction, id, moveConnectionWaypoint, snapWaypoint, storeWaypoint, toFlowPoint]);
  const hitTarget = (path: string) => <path className="hiles-edge-hit-target" d={path} fill="none" stroke="transparent" strokeWidth={20} onDoubleClick={addWaypoint} />;
  const renderBaseEdge = (path: string, markerEnd = props.markerEnd) => (
    <BaseEdge
      id={id}
      path={path}
      markerStart={props.markerStart}
      markerEnd={markerEnd}
      style={props.style}
      interactionWidth={props.interactionWidth}
    />
  );

  if (waypoints.length) {
    const labelPoint = labelPointAlongRoute(routePoints);
    return <>
      {renderBaseEdge(waypointPath)}{hitTarget(waypointPath)}
      <EdgeLabelRenderer>{absoluteWaypoints.map((point, index) => <button key={`${id}-${index}`} type="button" data-index={index} aria-label={`Move route point ${index + 1}`} className="hiles-edge-waypoint nodrag nopan" style={{ position: 'absolute', zIndex: 10, pointerEvents: 'auto', transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)` }} onMouseDown={startDragging} />)}</EdgeLabelRenderer>
      <ExternalEdgeLabel label={edgeLabel} x={labelPoint.x} y={labelPoint.y} />
    </>;
  }

  const routing = data?.routing ?? 'orthogonal';
  if (routing === 'straight') {
    const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY }); const horizontal = Math.abs(targetX - sourceX) >= Math.abs(targetY - sourceY);
    const labelX = sourceX + (targetX - sourceX) * .5 + (horizontal ? 0 : 14); const labelY = sourceY + (targetY - sourceY) * .5 + (horizontal ? -14 : 0);
    return <>{renderBaseEdge(path)}{hitTarget(path)}<ExternalEdgeLabel label={edgeLabel} x={labelX} y={labelY} /></>;
  }
  if (routing === 'curved') {
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    return <>{renderBaseEdge(path)}{hitTarget(path)}<ExternalEdgeLabel label={edgeLabel} x={labelX} y={labelY - 14} /></>;
  }
  const lane = data?.laneOffset ?? 0; const targetLane = data?.targetLaneOffset ?? 0;
  const horizontalSource = sourcePosition === 'left' || sourcePosition === 'right';
  const routeLane = lane + targetLane;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 4,
    offset: 24 + Math.abs(routeLane),
    ...(horizontalSource
      ? { centerX: (sourceX + targetX) / 2 + routeLane }
      : { centerY: (sourceY + targetY) / 2 + routeLane }),
  });
  return <>{renderBaseEdge(path)}{hitTarget(path)}<ExternalEdgeLabel label={edgeLabel} x={labelX} y={labelY - 14} /></>;
};
