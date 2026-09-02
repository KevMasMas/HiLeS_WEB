import { create } from 'zustand';
import type { Connection, Edge, EdgeChange, Node, NodeChange, XYPosition } from '@xyflow/react';
import { MarkerType, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { HilesConnectionType, HilesElementType } from '../types/hiles';
import { HilesElementTranslations } from '../types/translations';

interface AddNodeOptions {
  parentId?: string;
}

interface EditorState {
  nodes: Node[];
  edges: Edge[];
  selectedElementId: string | null;
  activeConnectionType: HilesConnectionType;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: HilesElementType, position: XYPosition, options?: AddNodeOptions) => void;
  updateNodeName: (id: string, name: string) => void;
  deleteElement: (id: string) => void;
  setSelectedElement: (id: string | null) => void;
  setActiveConnectionType: (type: HilesConnectionType) => void;
  saveModel: () => void;
  loadModel: () => void;
}

const edgeAppearance = (type: HilesConnectionType) => {
  if (type === HilesConnectionType.CONTINUOUS) {
    return { prefix: 'CCH', style: { stroke: '#172033', strokeWidth: 2.2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#172033' } };
  }
  if (type === HilesConnectionType.DISCRETE) {
    return { prefix: 'DCH', style: { stroke: '#2563eb', strokeWidth: 2 }, markerEnd: { type: MarkerType.Arrow, color: '#2563eb' } };
  }
  if (type === HilesConnectionType.PETRI) {
    return { prefix: 'LCH', style: { stroke: '#dc2626', strokeWidth: 2, strokeDasharray: '7 5' }, markerEnd: { type: MarkerType.Arrow, color: '#dc2626' } };
  }
  return { prefix: 'ARC', style: { stroke: '#172033', strokeWidth: 2 }, markerEnd: { type: MarkerType.Arrow, color: '#172033' } };
};

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedElementId: null,
  activeConnectionType: HilesConnectionType.CONTINUOUS,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) => {
    const type = get().activeConnectionType;
    const appearance = edgeAppearance(type);
    const count = get().edges.filter((edge) => edge.data?.hilesConnectionType === type).length + 1;
    const edge: Edge = {
      ...connection,
      id: `${type}-${crypto.randomUUID()}`,
      type: 'smoothstep',
      label: `${appearance.prefix}${count}`,
      data: { hilesConnectionType: type },
      style: appearance.style,
      markerEnd: appearance.markerEnd,
      labelStyle: { fill: appearance.style.stroke, fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.88 },
    };
    set({ edges: addEdge(edge, get().edges) });
  },

  addNode: (type, position, options = {}) => {
    const id = `${type}-${crypto.randomUUID()}`;
    const isStructural = type === HilesElementType.STRUCTURAL_BLOCK;
    const newNode: Node = {
      id,
      type: 'hilesNode',
      position,
      data: { name: `Nuevo ${HilesElementTranslations[type]}`, hilesType: type },
      ...(isStructural ? { style: options.parentId ? { width: 300, height: 190 } : { width: 420, height: 280 } } : {}),
      ...(options.parentId ? { parentId: options.parentId, extent: 'parent' as const, expandParent: true } : {}),
      zIndex: isStructural ? 0 : 1,
    };
    set({ nodes: [...get().nodes, newNode] });
  },

  updateNodeName: (id, name) => set({
    nodes: get().nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, name } } : node),
  }),

  deleteElement: (id) => {
    const nodes = get().nodes;
    const removed = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      nodes.forEach((node) => {
        if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) {
          removed.add(node.id);
          changed = true;
        }
      });
    }
    set({
      nodes: nodes.filter((node) => !removed.has(node.id)),
      edges: get().edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
      selectedElementId: removed.has(get().selectedElementId ?? '') ? null : get().selectedElementId,
    });
  },

  setSelectedElement: (id) => set({ selectedElementId: id }),
  setActiveConnectionType: (type) => set({ activeConnectionType: type }),

  saveModel: () => {
    const { nodes, edges } = get();
    localStorage.setItem('hiles_mvp_model', JSON.stringify({ nodes, edges }));
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
