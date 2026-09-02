import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Node, NodeMouseHandler, XYPosition } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useEditorStore } from '../../stores/useEditorStore';
import { HilesNode } from './CustomNodes';
import { HilesElementType } from '../../types/hiles';

const nodeTypes = { hilesNode: HilesNode };
const DETAIL_ZOOM = 0.72;

const nodeSize = (node: Node) => ({
  width: Number(node.style?.width ?? node.measured?.width ?? 160),
  height: Number(node.style?.height ?? node.measured?.height ?? 80),
});

const absolutePosition = (node: Node, nodesById: Map<string, Node>): XYPosition => {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodesById.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
};

const depthOf = (node: Node, nodesById: Map<string, Node>) => {
  let depth = 0;
  let parentId = node.parentId;
  while (parentId) {
    depth += 1;
    parentId = nodesById.get(parentId)?.parentId;
  }
  return depth;
};

const CanvasInner: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const { screenToFlowPosition } = useReactFlow();
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, setSelectedElement } = useEditorStore();

  const hiddenNodeIds = useMemo(() => new Set(
    zoom < DETAIL_ZOOM ? nodes.filter((node) => Boolean(node.parentId)).map((node) => node.id) : [],
  ), [nodes, zoom]);

  const visibleNodes = useMemo(() => nodes.map((node) => ({ ...node, hidden: hiddenNodeIds.has(node.id) })), [nodes, hiddenNodeIds]);
  const visibleEdges = useMemo(() => edges.map((edge) => ({
    ...edge,
    hidden: hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target),
  })), [edges, hiddenNodeIds]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow') as HilesElementType;
    if (!Object.values(HilesElementType).includes(type)) return;

    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const parent = nodes
      .filter((node) => node.data.hilesType === HilesElementType.STRUCTURAL_BLOCK)
      .filter((node) => {
        const absolute = absolutePosition(node, nodesById);
        const size = nodeSize(node);
        return flowPosition.x >= absolute.x && flowPosition.x <= absolute.x + size.width
          && flowPosition.y >= absolute.y && flowPosition.y <= absolute.y + size.height;
      })
      .sort((a, b) => depthOf(b, nodesById) - depthOf(a, nodesById))[0];

    if (parent) {
      const parentAbsolute = absolutePosition(parent, nodesById);
      addNode(type, {
        x: Math.max(12, flowPosition.x - parentAbsolute.x),
        y: Math.max(48, flowPosition.y - parentAbsolute.y),
      }, { parentId: parent.id });
    } else {
      addNode(type, flowPosition);
    }
  }, [addNode, nodes, screenToFlowPosition]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => setSelectedElement(node.id), [setSelectedElement]);
  const onPaneClick = useCallback(() => setSelectedElement(null), [setSelectedElement]);

  return (
    <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onViewportChange={(viewport) => setZoom(viewport.zoom)}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={2.5}
        fitView
      >
        <Background color="#cbd5e1" gap={22} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      <div style={styles.zoomHint}>
        {zoom < DETAIL_ZOOM ? 'Vista resumida · Acércate para ver la lógica interna' : 'Vista detallada · Los elementos internos están visibles'}
      </div>
    </div>
  );
};

export const Canvas: React.FC = () => (
  <ReactFlowProvider>
    <CanvasInner />
  </ReactFlowProvider>
);

const styles: Record<string, React.CSSProperties> = {
  zoomHint: {
    position: 'absolute', left: 14, bottom: 14, padding: '7px 10px', borderRadius: 6,
    color: '#475569', background: 'rgba(255,255,255,.92)', border: '1px solid #cbd5e1',
    boxShadow: '0 3px 12px rgba(15,23,42,.08)', fontSize: 11, pointerEvents: 'none',
  },
};
