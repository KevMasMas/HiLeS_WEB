import React, { useCallback, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  ReactFlowProvider,
} from '@xyflow/react';
import type { NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useEditorStore } from '../../stores/useEditorStore';
import { HilesNode } from './CustomNodes';
import { HilesElementType } from '../../types/hiles';

const nodeTypes = {
  hilesNode: HilesNode,
};

const CanvasInner: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { 
    nodes, edges, 
    onNodesChange, onEdgesChange, onConnect, 
    addNode, setSelectedElement 
  } = useEditorStore();

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as HilesElementType;

      // Check if valid drop
      if (typeof type === 'undefined' || !type) {
        return;
      }

      if (reactFlowWrapper.current) {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        
        // Very basic coordinate projection for MVP
        // xyflow hooks for screen-to-flow projection exist but require useReactFlow hook inside Provider
        const position = {
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        };

        addNode(type, position);
      }
    },
    [addNode]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedElement(node.id);
  }, [setSelectedElement]);

  const onPaneClick = useCallback(() => {
    setSelectedElement(null);
  }, [setSelectedElement]);

  return (
    <div style={{ flex: 1, position: 'relative' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export const Canvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
};
