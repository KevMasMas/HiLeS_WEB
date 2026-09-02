import { create } from 'zustand';
import type { Connection, Edge, EdgeChange, Node, NodeChange, XYPosition } from '@xyflow/react';
import { MarkerType, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import {
  HilesConnectionType,
  HilesElementType,
  type HilesEdgeData,
  type HilesNodeData,
  type HilesNodeProperties,
  type HilesPort,
  type PortDirection,
} from '../types/hiles';
import { HilesElementTranslations } from '../types/translations';

type HilesNode = Node<HilesNodeData>;
type HilesEdge = Edge<HilesEdgeData>;

interface AddNodeOptions { parentId?: string }

interface EditorState {
  nodes: HilesNode[];
  edges: HilesEdge[];
  selectedElementId: string | null;
  selectedConnectionId: string | null;
  activeConnectionType: HilesConnectionType;
  connectionError: string | null;
  statusMessage: string | null;
  onNodesChange: (changes: NodeChange<HilesNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<HilesEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: HilesElementType, position: XYPosition, options?: AddNodeOptions) => void;
  updateNodeName: (id: string, name: string) => void;
  updateNodeProperties: (id: string, properties: Partial<HilesNodeProperties>) => void;
  addPort: (nodeId: string, direction: PortDirection) => void;
  updatePort: (nodeId: string, portId: string, patch: Partial<HilesPort>) => void;
  removePort: (nodeId: string, portId: string) => void;
  updateConnection: (id: string, patch: { label?: string; data?: Partial<HilesEdgeData> }) => void;
  deleteElement: (id: string) => void;
  deleteConnection: (id: string) => void;
  setSelectedElement: (id: string | null) => void;
  setSelectedConnection: (id: string | null) => void;
  setActiveConnectionType: (type: HilesConnectionType) => void;
  clearConnectionError: () => void;
  saveModel: () => void;
  loadModel: () => void;
}

const defaultProperties = (): HilesNodeProperties => ({
  description: '', collapsed: false, locked: false, visible: true,
  expression: '', executionDelay: 0, enabled: true,
  tokens: 0, maxTokens: 1, delay: 0, condition: '', heldValue: '',
});

const createPort = (direction: PortDirection, name?: string, nature: HilesPort['nature'] = 'continuous'): HilesPort => ({
  id: `${direction === 'input' ? 'IN' : 'OUT'}_${crypto.randomUUID()}`,
  name: name ?? (direction === 'input' ? 'Input' : 'Output'),
  direction,
  dataType: nature === 'control' ? 'boolean' : 'real',
  nature,
  side: direction === 'input' ? 'left' : 'right',
  offset: 0.5,
});

const defaultPorts = (type: HilesElementType): HilesPort[] => {
  if (type === HilesElementType.FUNCTIONAL_BLOCK) return [createPort('input'), createPort('output')];
  if (type === HilesElementType.SAMPLE) return [createPort('input', 'Data'), createPort('input', 'Control', 'control'), createPort('output')];
  if (type === HilesElementType.HOLD) return [createPort('input'), createPort('output')];
  return [];
};

const edgeAppearance = (type: HilesConnectionType) => {
  if (type === HilesConnectionType.CONTINUOUS) return { prefix: 'CCH', stroke: '#172033', dash: undefined, marker: MarkerType.ArrowClosed };
  if (type === HilesConnectionType.DISCRETE) return { prefix: 'DCH', stroke: '#2563eb', dash: undefined, marker: MarkerType.Arrow };
  if (type === HilesConnectionType.PETRI) return { prefix: 'LCH', stroke: '#dc2626', dash: '7 5', marker: MarkerType.Arrow };
  return { prefix: 'ARC', stroke: '#172033', dash: '3 5', marker: MarkerType.Arrow };
};

const asData = (node: HilesNode) => node.data;

interface ConnectionCandidate {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export const getConnectionValidation = (nodes: HilesNode[], connection: ConnectionCandidate, type: HilesConnectionType) => {
  if (!connection.source || !connection.target || connection.source === connection.target) return { valid: false, reason: 'Connections require two different elements.' };
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target) return { valid: false, reason: 'A connection endpoint no longer exists.' };
  const sourceType = asData(source).hilesType;
  const targetType = asData(target).hilesType;

  if (type === HilesConnectionType.TOKEN_FLOW) {
    const validPair = (sourceType === HilesElementType.PLACE && targetType === HilesElementType.TRANSITION)
      || (sourceType === HilesElementType.TRANSITION && targetType === HilesElementType.PLACE);
    return validPair
      ? { valid: true, reason: '' }
      : { valid: false, reason: 'Token Arcs must alternate Place and Transition.' };
  }

  const sourcePort = asData(source).ports.find((port) => port.id === connection.sourceHandle);
  const targetPort = asData(target).ports.find((port) => port.id === connection.targetHandle);
  if (!sourcePort || !targetPort) return { valid: false, reason: 'Data and control connections must start and end at ports.' };
  if (sourcePort.direction !== 'output' || targetPort.direction !== 'input') return { valid: false, reason: 'Only Output Port → Input Port is allowed.' };
  if (type === HilesConnectionType.PETRI && (sourcePort.nature !== 'control' || targetPort.nature !== 'control')) {
    return { valid: false, reason: 'Logical channels require control ports at both ends.' };
  }
  if (type !== HilesConnectionType.PETRI && (sourcePort.nature === 'control' || targetPort.nature === 'control')) {
    return { valid: false, reason: 'Data channels cannot connect control ports.' };
  }
  const typesMatch = sourcePort.dataType === targetPort.dataType || sourcePort.dataType === 'custom' || targetPort.dataType === 'custom';
  return typesMatch ? { valid: true, reason: '' } : { valid: false, reason: 'Port data types are incompatible.' };
};

const normalizeNode = (node: HilesNode): HilesNode => ({
  ...node,
  data: {
    hilesType: node.data.hilesType,
    name: node.data.name,
    ports: Array.isArray(node.data.ports) ? node.data.ports : defaultPorts(node.data.hilesType),
    properties: { ...defaultProperties(), ...(node.data.properties ?? {}) },
  },
});

const normalizeEdge = (edge: HilesEdge): HilesEdge => ({
  ...edge,
  data: {
    hilesConnectionType: edge.data?.hilesConnectionType ?? HilesConnectionType.CONTINUOUS,
    routing: edge.data?.routing ?? 'orthogonal',
    dataType: edge.data?.dataType ?? 'real',
    delay: edge.data?.delay ?? 0,
    weight: edge.data?.weight ?? 1,
  },
});

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [], edges: [], selectedElementId: null, selectedConnectionId: null,
  activeConnectionType: HilesConnectionType.CONTINUOUS, connectionError: null, statusMessage: null,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) => {
    const type = get().activeConnectionType;
    const validation = getConnectionValidation(get().nodes, connection, type);
    if (!validation.valid) return set({ connectionError: validation.reason });
    const duplicate = get().edges.some((edge) => edge.source === connection.source && edge.target === connection.target
      && edge.sourceHandle === connection.sourceHandle && edge.targetHandle === connection.targetHandle
      && edge.data?.hilesConnectionType === type);
    if (duplicate) return set({ connectionError: 'This connection already exists.' });

    const appearance = edgeAppearance(type);
    const count = get().edges.filter((edge) => edge.data?.hilesConnectionType === type).length + 1;
    const edge: HilesEdge = {
      ...connection,
      id: `${type}-${crypto.randomUUID()}`,
      type: 'smoothstep', label: `${appearance.prefix}${count}`,
      data: { hilesConnectionType: type, routing: 'orthogonal', dataType: 'real', delay: 0, weight: 1 },
      style: { stroke: appearance.stroke, strokeWidth: 2.2, strokeDasharray: appearance.dash },
      markerEnd: { type: appearance.marker, color: appearance.stroke },
      labelStyle: { fill: appearance.stroke, fontWeight: 700, fontSize: 11 },
      labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
    };
    set({ edges: addEdge(edge, get().edges), connectionError: null });
  },

  addNode: (type, position, options = {}) => {
    if (type === HilesElementType.TOKEN) return;
    const id = `${type}-${crypto.randomUUID()}`;
    const isStructural = type === HilesElementType.STRUCTURAL_BLOCK;
    const newNode: HilesNode = {
      id, type: 'hilesNode', position,
      data: { hilesType: type, name: `New ${HilesElementTranslations[type]}`, ports: defaultPorts(type), properties: defaultProperties() },
      ...(isStructural ? { style: options.parentId ? { width: 300, height: 190 } : { width: 420, height: 280 } } : {}),
      ...(options.parentId ? { parentId: options.parentId, extent: 'parent' as const, expandParent: true } : {}),
      zIndex: isStructural ? 0 : 1,
    };
    set({ nodes: [...get().nodes, newNode], selectedElementId: id, selectedConnectionId: null });
  },

  updateNodeName: (id, name) => set({ nodes: get().nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, name } } : node) }),
  updateNodeProperties: (id, properties) => set({ nodes: get().nodes.map((node) => node.id === id
    ? { ...node, data: { ...node.data, properties: { ...node.data.properties, ...properties } } } : node) }),
  addPort: (nodeId, direction) => set({ nodes: get().nodes.map((node) => node.id === nodeId
    ? { ...node, data: { ...node.data, ports: [...node.data.ports, createPort(direction)] } } : node) }),
  updatePort: (nodeId, portId, patch) => set({ nodes: get().nodes.map((node) => node.id === nodeId
    ? { ...node, data: { ...node.data, ports: node.data.ports.map((port) => port.id === portId ? { ...port, ...patch } : port) } } : node) }),
  removePort: (nodeId, portId) => set({
    nodes: get().nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ports: node.data.ports.filter((port) => port.id !== portId) } } : node),
    edges: get().edges.filter((edge) => edge.sourceHandle !== portId && edge.targetHandle !== portId),
  }),
  updateConnection: (id, patch) => set({ edges: get().edges.map((edge) => {
    if (edge.id !== id) return edge;
    const routing = patch.data?.routing ?? edge.data?.routing ?? 'orthogonal';
    const edgeType = routing === 'straight' ? 'straight' : routing === 'curved' ? 'bezier' : 'smoothstep';
    return { ...edge, type: edgeType, ...(patch.label !== undefined ? { label: patch.label } : {}), data: { ...edge.data!, ...patch.data } };
  }) }),

  deleteElement: (id) => {
    const nodes = get().nodes;
    const removed = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      nodes.forEach((node) => {
        if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) { removed.add(node.id); changed = true; }
      });
    }
    set({
      nodes: nodes.filter((node) => !removed.has(node.id)),
      edges: get().edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
      selectedElementId: removed.has(get().selectedElementId ?? '') ? null : get().selectedElementId,
    });
  },
  deleteConnection: (id) => set({ edges: get().edges.filter((edge) => edge.id !== id), selectedConnectionId: null }),
  setSelectedElement: (id) => set({ selectedElementId: id, selectedConnectionId: null }),
  setSelectedConnection: (id) => set({ selectedConnectionId: id, selectedElementId: null }),
  setActiveConnectionType: (type) => set({ activeConnectionType: type, connectionError: null }),
  clearConnectionError: () => set({ connectionError: null }),

  saveModel: () => {
    const { nodes, edges } = get();
    localStorage.setItem('hiles_mvp_model', JSON.stringify({ version: 2, metadata: { savedAt: new Date().toISOString() }, nodes, connections: edges }));
    set({ statusMessage: 'Model saved locally' });
  },
  loadModel: () => {
    const saved = localStorage.getItem('hiles_mvp_model');
    if (!saved) return;
    try {
      const model = JSON.parse(saved);
      const rawNodes = (model.nodes ?? []) as HilesNode[];
      const rawEdges = (model.connections ?? model.edges ?? []) as HilesEdge[];
      set({ nodes: rawNodes.map(normalizeNode), edges: rawEdges.map(normalizeEdge), selectedElementId: null, selectedConnectionId: null, connectionError: null, statusMessage: 'Local model loaded' });
    } catch {
      set({ connectionError: 'The saved model is not valid JSON.' });
    }
  },
}));
