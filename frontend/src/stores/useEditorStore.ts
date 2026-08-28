import { create } from 'zustand';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from '@xyflow/react';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { HilesElementType } from '../types/hiles';
import { HilesElementTranslations } from '../types/translations';

interface EditorState {
  nodes: Node[];
  edges: Edge[];
  selectedElementId: string | null;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: HilesElementType, position: { x: number; y: number }) => void;
  updateNodeName: (id: string, name: string) => void;
  deleteElement: (id: string) => void;
  setSelectedElement: (id: string | null) => void;
  saveModel: () => void;
  loadModel: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedElementId: null,

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addNode: (type: HilesElementType, position: { x: number; y: number }) => {
    const id = `${type}-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'hilesNode',
      position,
      data: { name: `Nuevo ${HilesElementTranslations[type as keyof typeof HilesElementTranslations] || type}`, hilesType: type },
    };

    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeName: (id: string, name: string) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, name } };
        }
        return node;
      }),
    });
  },

  deleteElement: (id: string) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter(
        (edge) => edge.id !== id && edge.source !== id && edge.target !== id
      ),
      selectedElementId: get().selectedElementId === id ? null : get().selectedElementId,
    });
  },

  setSelectedElement: (id: string | null) => {
    set({ selectedElementId: id });
  },

  saveModel: () => {
    // Para este MVP, guardamos en localStorage. 
    // Luego se integrará con el backend NestJS (POST/PATCH /models/:id)
    const { nodes, edges } = get();
    const modelData = JSON.stringify({ nodes, edges });
    localStorage.setItem('hiles_mvp_model', modelData);
    alert('Modelo guardado correctamente en LocalStorage');
  },

  loadModel: () => {
    const saved = localStorage.getItem('hiles_mvp_model');
    if (saved) {
      const { nodes, edges } = JSON.parse(saved);
      set({ nodes, edges, selectedElementId: null });
    }
  },
}));
