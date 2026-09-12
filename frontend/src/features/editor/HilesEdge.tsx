import React, { useCallback, useEffect, useRef } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getStraightPath, Position, useReactFlow, type Edge, type EdgeProps, type Node, type XYPosition } from '@xyflow/react';
import { useEditorStore } from '../../stores/useEditorStore';
import { HilesElementType, type ConnectionWaypoint, type HilesEdgeData } from '../../types/hiles';

type RoutedEdge = Edge<HilesEdgeData & { laneOffset?: number; targetLaneOffset?: number }>;

const ExternalEdgeLabel: React.FC<{ label?: string; x: number; y: number }> = ({ label, x, y }) => label ? <EdgeLabelRenderer><div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, padding: '2px 4px', borderRadius: 2, background: '#fff', color: '#172033', fontSize: 10, lineHeight: 1.1, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{label}</div></EdgeLabelRenderer> : null;

const arrowPathFor = (sourceX: number, sourceY: number, targetX: number, targetY: number, targetPosition: Position) => {
  const horizontal = Math.abs(targetX - sourceX) >= Math.abs(targetY - sourceY);
  const directionX = targetPosition === Position.Left ? 1 : targetPosition === Position.Right ? -1 : Math.sign(targetX - sourceX) || 1;
  const directionY = targetPosition === Position.Top ? 1 : targetPosition === Position.Bottom ? -1 : Math.sign(targetY - sourceY) || 1;
  const size = 7;
  return horizontal ? `M ${targetX - directionX * size},${targetY - size / 1.4} L ${targetX},${targetY} L ${targetX - directionX * size},${targetY + size / 1.4}` : `M ${targetX - size / 1.4},${targetY - directionY * size} L ${targetX},${targetY} L ${targetX + size / 1.4},${targetY - directionY * size}`;
};

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
  const waypoints = data?.waypoints ?? [];
  const isPetri = data?.hilesConnectionType === 'PETRI';
  const edgeLabel = typeof props.label === 'string' ? props.label : undefined;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const absoluteWaypoints = waypoints.map((waypoint) => {
    const parent = waypoint.parentBlockId ? nodesById.get(waypoint.parentBlockId) : undefined;
    return parent ? { x: absolutePosition(parent, nodesById).x + waypoint.x, y: absolutePosition(parent, nodesById).y + waypoint.y } : waypoint;
  });
  const routePoints: XYPosition[] = [{ x: sourceX, y: sourceY }, ...absoluteWaypoints, { x: targetX, y: targetY }];
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
  const hitTarget = (path: string) => <path d={path} fill="none" stroke="transparent" strokeWidth={20} onDoubleClick={addWaypoint} />;
  const openPetriArrow = (from: XYPosition) => isPetri ? <path d={arrowPathFor(from.x, from.y, targetX, targetY, targetPosition)} className="react-flow__edge-path" style={{ ...props.style, strokeDasharray: undefined, fill: 'none', pointerEvents: 'none' }} /> : null;

  if (waypoints.length) return <>
    <BaseEdge {...props} markerEnd={isPetri ? undefined : props.markerEnd} path={waypointPath} label={undefined} />{hitTarget(waypointPath)}{openPetriArrow(routePoints.at(-2)!)}
    <EdgeLabelRenderer>{absoluteWaypoints.map((point, index) => <button key={`${id}-${index}`} type="button" data-index={index} aria-label={`Move route point ${index + 1}`} className="hiles-edge-waypoint nodrag nopan" style={{ position: 'absolute', zIndex: 10, pointerEvents: 'auto', transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)` }} onMouseDown={startDragging} />)}</EdgeLabelRenderer>
    <ExternalEdgeLabel label={edgeLabel} x={routePoints[Math.floor((routePoints.length - 1) / 2)].x} y={routePoints[Math.floor((routePoints.length - 1) / 2)].y - 14} />
  </>;

  const routing = data?.routing ?? 'orthogonal';
  const aligned = sourcePosition === 'right' && targetPosition === 'left' && Math.abs(sourceY - targetY) < 1;
  if (routing === 'straight' || aligned) {
    const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY }); const horizontal = Math.abs(targetX - sourceX) >= Math.abs(targetY - sourceY);
    const labelX = sourceX + (targetX - sourceX) * .45; const labelY = sourceY + (targetY - sourceY) * .45 + (horizontal ? -14 : 0);
    return <><BaseEdge {...props} markerEnd={undefined} label={undefined} path={path} />{hitTarget(path)}<path d={arrowPathFor(sourceX, sourceY, targetX, targetY, targetPosition)} className="react-flow__edge-path" style={{ ...props.style, strokeDasharray: undefined, fill: 'none', pointerEvents: 'none' }} /><ExternalEdgeLabel label={edgeLabel} x={horizontal ? targetX - 55 : labelX} y={labelY} /></>;
  }
  if (routing === 'curved') {
    const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    return <><BaseEdge {...props} markerEnd={isPetri ? undefined : props.markerEnd} path={path} labelX={labelX} labelY={labelY} />{hitTarget(path)}{openPetriArrow({ x: sourceX, y: sourceY })}</>;
  }
  const lane = data?.laneOffset ?? 0; const targetLane = data?.targetLaneOffset ?? 0;
  const routedTargetX = targetPosition === 'left' || targetPosition === 'right' ? targetX : targetX + targetLane;
  const routedTargetY = targetPosition === 'top' || targetPosition === 'bottom' ? targetY : targetY + targetLane;
  const horizontal = sourcePosition === 'left' || sourcePosition === 'right'; const gap = 24 + Math.abs(lane);
  const middle = horizontal ? sourcePosition === targetPosition ? sourcePosition === 'left' ? Math.min(sourceX, routedTargetX) - gap : Math.max(sourceX, routedTargetX) + gap : sourcePosition === 'right' && targetPosition === 'left' && sourceY > targetY ? Math.max(sourceX, routedTargetX) + gap : sourcePosition === 'left' && targetPosition === 'right' && sourceY > targetY ? Math.min(sourceX, routedTargetX) - gap : (sourceX + routedTargetX) / 2 + lane : sourcePosition === targetPosition ? sourcePosition === 'top' ? Math.min(sourceY, routedTargetY) - gap : Math.max(sourceY, routedTargetY) + gap : (sourceY + routedTargetY) / 2 + lane;
  const path = horizontal ? `M ${sourceX},${sourceY} L ${middle},${sourceY} L ${middle},${routedTargetY} L ${routedTargetX},${routedTargetY}` : `M ${sourceX},${sourceY} L ${sourceX},${middle} L ${routedTargetX},${middle} L ${routedTargetX},${routedTargetY}`;
  const horizontalAligned = Math.abs(sourceY - routedTargetY) < 1; const labelX = horizontalAligned ? sourceX + (routedTargetX - sourceX) * .45 : horizontal ? middle : (sourceX + routedTargetX) / 2; const labelY = horizontalAligned ? sourceY - 14 : horizontal ? (sourceY + routedTargetY) / 2 : middle;
  const arrowSource = horizontal ? { x: middle, y: routedTargetY } : { x: routedTargetX, y: middle };
  return <><BaseEdge {...props} markerEnd={horizontalAligned || isPetri ? undefined : props.markerEnd} label={horizontalAligned ? undefined : edgeLabel} path={path} labelX={labelX} labelY={labelY} />{hitTarget(path)}{(horizontalAligned || isPetri) && <><path d={arrowPathFor(arrowSource.x, arrowSource.y, routedTargetX, routedTargetY, targetPosition)} className="react-flow__edge-path" style={{ ...props.style, strokeDasharray: undefined, fill: 'none', pointerEvents: 'none' }} />{horizontalAligned && <ExternalEdgeLabel label={edgeLabel} x={routedTargetX - 55} y={labelY} />}</>}</>;
};
