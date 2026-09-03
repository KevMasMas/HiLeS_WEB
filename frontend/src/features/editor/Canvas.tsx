import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { Connection, Edge, EdgeMouseHandler, Node, NodeMouseHandler, OnNodeDrag, XYPosition } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './editor.css';

import { getConnectionValidation, useEditorStore } from '../../stores/useEditorStore';
import { HilesNode } from './CustomNodes';
import { HilesEdge } from './HilesEdge';
import { HilesElementType, type HilesNodeData } from '../../types/hiles';

const nodeTypes = { hilesNode: HilesNode };
const edgeTypes = { hilesEdge: HilesEdge };
const DETAIL_ZOOM = 0.9;

const nodeSize = (node: Node) => ({ width: Number(node.style?.width ?? node.measured?.width ?? 160), height: Number(node.style?.height ?? node.measured?.height ?? 80) });

const absolutePosition = (node: Node, nodesById: Map<string, Node>): XYPosition => {
  let x = node.position.x; let y = node.position.y; let parentId = node.parentId;
  while (parentId) {
    const parent = nodesById.get(parentId); if (!parent) break;
    x += parent.position.x; y += parent.position.y; parentId = parent.parentId;
  }
  return { x, y };
};

const depthOf = (node: Node, nodesById: Map<string, Node>) => {
  let depth = 0; let parentId = node.parentId;
  while (parentId) { depth += 1; parentId = nodesById.get(parentId)?.parentId; }
  return depth;
};

const CanvasInner: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const { screenToFlowPosition } = useReactFlow();
  const store = useEditorStore();
  const { nodes, edges, activeConnectionType } = store;

  const nodesById = useMemo(() => new Map<string, Node>(nodes.map((node) => [node.id, node])), [nodes]);
  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set<string>();
    nodes.forEach((node) => {
      if (!node.data.properties.visible) hidden.add(node.id);
      let parentId = node.parentId;
      while (parentId) {
        const parent = nodesById.get(parentId) as Node<HilesNodeData> | undefined;
        if (!parent || parent.data.properties.collapsed || !parent.data.properties.visible || zoom < DETAIL_ZOOM) {
          hidden.add(node.id); break;
        }
        parentId = parent.parentId;
      }
    });
    return hidden;
  }, [nodes, nodesById, zoom]);

  const visibleNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    data: { ...node.data, summaryMode: node.data.hilesType === HilesElementType.STRUCTURAL_BLOCK && zoom < DETAIL_ZOOM },
    hidden: hiddenNodeIds.has(node.id),
    draggable: !node.data.properties.locked,
    selectable: true,
  })), [nodes, hiddenNodeIds, zoom]);
  const visibleEdges = useMemo(() => {
    const groups = new Map<string, typeof edges>();
    edges.forEach((edge) => {
      const key = `${edge.source}:${edge.sourceHandle ?? ''}`;
      groups.set(key, [...(groups.get(key) ?? []), edge]);
    });
    const lanes = new Map<string, number>();
    groups.forEach((group) => group
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((edge, index) => lanes.set(edge.id, (index - (group.length - 1) / 2) * 34)));
    return edges.map((edge) => ({
      ...edge,
      type: 'hilesEdge',
      zIndex: 2,
      data: { ...edge.data!, laneOffset: lanes.get(edge.id) ?? 0 },
      hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
    }));
  }, [edges, hiddenNodeIds]);

  const isValidConnection = useCallback((connection: Edge | Connection) => getConnectionValidation(nodes, connection, activeConnectionType).valid, [nodes, activeConnectionType]);
  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow') as HilesElementType;
    if (!Object.values(HilesElementType).includes(type) || type === HilesElementType.TOKEN || type === HilesElementType.PORT) return;
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const parent = nodes
      .filter((node) => node.data.hilesType === HilesElementType.STRUCTURAL_BLOCK && !node.data.properties.collapsed)
      .filter((node) => {
        const absolute = absolutePosition(node, nodesById); const size = nodeSize(node);
        return flowPosition.x >= absolute.x && flowPosition.x <= absolute.x + size.width && flowPosition.y >= absolute.y && flowPosition.y <= absolute.y + size.height;
      })
      .sort((a, b) => depthOf(b, nodesById) - depthOf(a, nodesById))[0];
    if (parent) {
      const parentAbsolute = absolutePosition(parent, nodesById);
      store.addNode(type, { x: Math.max(12, flowPosition.x - parentAbsolute.x), y: Math.max(48, flowPosition.y - parentAbsolute.y) }, { parentId: parent.id });
    } else store.addNode(type, flowPosition);
  }, [nodes, nodesById, screenToFlowPosition, store]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => store.setSelectedElement(node.id), [store]);
  const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => store.setSelectedConnection(edge.id), [store]);
  const onPaneClick = useCallback(() => { store.setSelectedElement(null); store.clearConnectionError(); }, [store]);
  const onNodeDragStart: OnNodeDrag = useCallback(() => store.beginHistoryTransaction(), [store]);
  const onNodeDragStop: OnNodeDrag = useCallback(() => store.endHistoryTransaction(), [store]);

  return (
    <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={visibleNodes} edges={visibleEdges}
        onNodesChange={store.onNodesChange} onEdgesChange={store.onEdgesChange} onConnect={store.onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
        onDrop={onDrop} onDragOver={onDragOver} onViewportChange={(viewport) => setZoom(viewport.zoom)}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes} minZoom={0.2} maxZoom={2.5} defaultViewport={{ x: 0, y: 0, zoom: 1 }} snapToGrid snapGrid={[10, 10]}
        deleteKeyCode={null}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
        <MiniMap pannable zoomable nodeColor={(node) => node.data.hilesType === HilesElementType.STRUCTURAL_BLOCK ? '#94a3b8' : '#2563eb'} />
      </ReactFlow>
      <div style={styles.zoomHint}>{zoom < DETAIL_ZOOM ? 'Summary view · Zoom in to reveal internal logic' : 'Detailed view · Internal elements are visible'}</div>
      {store.connectionError && <button style={styles.error} onClick={store.clearConnectionError}>⚠ {store.connectionError} <strong>×</strong></button>}
    </div>
  );
};

export const Canvas: React.FC = () => <ReactFlowProvider><CanvasInner /></ReactFlowProvider>;

const styles: Record<string, React.CSSProperties> = {
  zoomHint: { position: 'absolute', left: 14, bottom: 14, padding: '7px 10px', borderRadius: 6, color: '#475569', background: 'rgba(255,255,255,.92)', border: '1px solid #cbd5e1', boxShadow: '0 3px 12px rgba(15,23,42,.08)', fontSize: 11, pointerEvents: 'none' },
  error: { position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', padding: '9px 12px', border: '1px solid #fca5a5', borderRadius: 7, background: '#fff1f2', color: '#991b1b', fontSize: 11, cursor: 'pointer', boxShadow: '0 5px 18px rgba(127,29,29,.15)' },
};
