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
  type OperatorDirection,
  type PortDirection,
} from '../types/hiles';
import { HilesElementTranslations } from '../types/translations';
import { isModelDocument, serializeModel, validateModelDocument } from '../domain/modelDocument';

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
  past: ModelSnapshot[];
  future: ModelSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
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
  beginHistoryTransaction: () => void;
  endHistoryTransaction: () => void;
  undo: () => void;
  redo: () => void;
  clearModel: () => void;
  loadAutosave: () => void;
  exportModel: () => string;
  importModel: (json: string) => void;
}

interface ModelSnapshot { nodes: HilesNode[]; edges: HilesEdge[] }

const HISTORY_LIMIT = 100;
const AUTOSAVE_KEY = 'hiles_mvp_autosave';
const AUTOSAVE_VERSION = 1;
const cloneSnapshot = (snapshot: ModelSnapshot): ModelSnapshot => structuredClone(snapshot);
const snapshotOf = (state: Pick<EditorState, 'nodes' | 'edges'>): ModelSnapshot => cloneSnapshot({ nodes: state.nodes, edges: state.edges });
const sameSnapshot = (left: ModelSnapshot, right: ModelSnapshot) => JSON.stringify(left) === JSON.stringify(right);

let transactionSnapshot: ModelSnapshot | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveLoaded = false;

const historyFor = (state: EditorState, before: ModelSnapshot) => ({
  past: [...state.past, before].slice(-HISTORY_LIMIT), future: [], canUndo: true, canRedo: false,
});

const persistAutosave = () => {
  const { nodes, edges } = useEditorStore.getState();
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: AUTOSAVE_VERSION, savedAt: new Date().toISOString(), data: serializeModel(nodes, edges) }));
  } catch {
    useEditorStore.setState({ connectionError: 'The model could not be autosaved locally.' });
  }
};

const defaultProperties = (): HilesNodeProperties => ({
  description: '', collapsed: false, locked: false, visible: true,
  expression: '', executionDelay: 0, enabled: true,
  tokens: 0, maxTokens: 1, delay: 0, condition: '', heldValue: '', operatorDirection: 'right',
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
  if (type === HilesElementType.SAMPLE || type === HilesElementType.HOLD) return operatorPorts(type, 'right');
  return [];
};

const operatorPorts = (type: HilesElementType, direction: OperatorDirection): HilesPort[] => {
  const sides: Record<OperatorDirection, { input: HilesPort['side']; output: HilesPort['side'] }> = {
    right: { input: 'left', output: 'right' }, left: { input: 'right', output: 'left' }, up: { input: 'bottom', output: 'top' }, down: { input: 'top', output: 'bottom' },
  };
  const { input, output } = sides[direction];
  if (type === HilesElementType.SAMPLE) return [
    { ...createPort('input', 'Data'), side: input, offset: 0.32 },
    { ...createPort('input', 'Control', 'control'), side: input, offset: 0.68 },
    { ...createPort('output', 'Sampled'), side: output, offset: 0.5 },
  ];
  return [{ ...createPort('input', 'Data'), side: input, offset: 0.5 }, { ...createPort('output', 'Held'), side: output, offset: 0.5 }];
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

const normalizeEdge = (edge: HilesEdge): HilesEdge => {
  const hilesConnectionType = edge.data?.hilesConnectionType ?? HilesConnectionType.CONTINUOUS;
  const appearance = edgeAppearance(hilesConnectionType);
  return {
    ...edge,
    type: 'hilesEdge',
    data: {
      hilesConnectionType,
      routing: edge.data?.routing ?? 'orthogonal',
      dataType: edge.data?.dataType ?? 'real',
      delay: edge.data?.delay ?? 0,
      weight: edge.data?.weight ?? 1,
    },
    style: { stroke: appearance.stroke, strokeWidth: 2.2, ...(appearance.dash ? { strokeDasharray: appearance.dash } : {}), ...edge.style },
    markerEnd: edge.markerEnd ?? { type: appearance.marker, color: appearance.stroke },
    labelStyle: { fill: appearance.stroke, fontWeight: 700, fontSize: 11, ...edge.labelStyle },
    labelBgStyle: { fill: '#fff', fillOpacity: 0.94, ...edge.labelBgStyle },
  };
};

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [], edges: [], selectedElementId: null, selectedConnectionId: null,
  activeConnectionType: HilesConnectionType.CONTINUOUS, connectionError: null, statusMessage: null,
  past: [], future: [], canUndo: false, canRedo: false,

  onNodesChange: (changes) => {
    const state = get();
    const nextNodes = applyNodeChanges(changes, state.nodes);
    const modifiesModel = changes.some((change) => change.type !== 'select' && change.type !== 'position');
    set({ nodes: nextNodes, ...(modifiesModel && !transactionSnapshot ? historyFor(state, snapshotOf(state)) : {}) });
  },
  onEdgesChange: (changes) => {
    const state = get();
    const nextEdges = applyEdgeChanges(changes, state.edges);
    const modifiesModel = changes.some((change) => change.type !== 'select');
    set({ edges: nextEdges, ...(modifiesModel && !transactionSnapshot ? historyFor(state, snapshotOf(state)) : {}) });
  },

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
    const state = get();
    set({ edges: addEdge(edge, state.edges), connectionError: null, ...historyFor(state, snapshotOf(state)) });
  },

  addNode: (type, position, options = {}) => {
    if (type === HilesElementType.TOKEN) return;
    const id = `${type}-${crypto.randomUUID()}`;
    const isStructural = type === HilesElementType.STRUCTURAL_BLOCK;
    const newNode: HilesNode = {
      id, type: 'hilesNode', position,
      data: { hilesType: type, name: `New ${HilesElementTranslations[type]}`, ports: defaultPorts(type), properties: defaultProperties() },
      ...(isStructural ? { style: options.parentId ? { width: 240, height: 150 } : { width: 340, height: 220 } } : {}),
      ...(options.parentId ? { parentId: options.parentId, extent: 'parent' as const, expandParent: true } : {}),
      zIndex: isStructural ? 0 : 1,
    };
    const state = get();
    set({ nodes: [...state.nodes, newNode], selectedElementId: id, selectedConnectionId: null, ...historyFor(state, snapshotOf(state)) });
  },

  updateNodeName: (id, name) => {
    const state = get();
    set({ nodes: state.nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, name } } : node), ...historyFor(state, snapshotOf(state)) });
  },
  updateNodeProperties: (id, properties) => {
    const state = get();
    set({ nodes: state.nodes.map((node) => {
    if (node.id !== id) return node;
    const mergedProperties = { ...node.data.properties, ...properties };
    const isOperator = node.data.hilesType === HilesElementType.SAMPLE || node.data.hilesType === HilesElementType.HOLD;
    return { ...node, data: { ...node.data, properties: mergedProperties, ...(isOperator && properties.operatorDirection ? { ports: operatorPorts(node.data.hilesType, properties.operatorDirection) } : {}) } };
    }), ...historyFor(state, snapshotOf(state)) });
  },
  addPort: (nodeId, direction) => {
    const state = get();
    set({ nodes: state.nodes.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, ports: [...node.data.ports, createPort(direction)] } } : node), ...historyFor(state, snapshotOf(state)) });
  },
  updatePort: (nodeId, portId, patch) => {
    const state = get();
    set({ nodes: state.nodes.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, ports: node.data.ports.map((port) => port.id === portId ? { ...port, ...patch } : port) } } : node), ...historyFor(state, snapshotOf(state)) });
  },
  removePort: (nodeId, portId) => {
    const state = get();
    set({
      nodes: state.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ports: node.data.ports.filter((port) => port.id !== portId) } } : node),
      edges: state.edges.filter((edge) => edge.sourceHandle !== portId && edge.targetHandle !== portId),
      ...historyFor(state, snapshotOf(state)),
    });
  },
  updateConnection: (id, patch) => {
    const state = get();
    set({ edges: state.edges.map((edge) => {
    if (edge.id !== id) return edge;
    const routing = patch.data?.routing ?? edge.data?.routing ?? 'orthogonal';
    const edgeType = routing === 'straight' ? 'straight' : routing === 'curved' ? 'bezier' : 'smoothstep';
    return { ...edge, type: edgeType, ...(patch.label !== undefined ? { label: patch.label } : {}), data: { ...edge.data!, ...patch.data } };
    }), ...historyFor(state, snapshotOf(state)) });
  },

  deleteElement: (id) => {
    const state = get();
    const nodes = state.nodes;
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
      edges: state.edges.filter((edge) => !removed.has(edge.source) && !removed.has(edge.target)),
      selectedElementId: removed.has(state.selectedElementId ?? '') ? null : state.selectedElementId,
      ...historyFor(state, snapshotOf(state)),
    });
  },
  deleteConnection: (id) => {
    const state = get();
    set({ edges: state.edges.filter((edge) => edge.id !== id), selectedConnectionId: null, ...historyFor(state, snapshotOf(state)) });
  },
  setSelectedElement: (id) => set({ selectedElementId: id, selectedConnectionId: null }),
  setSelectedConnection: (id) => set({ selectedConnectionId: id, selectedElementId: null }),
  setActiveConnectionType: (type) => set({ activeConnectionType: type, connectionError: null }),
  clearConnectionError: () => set({ connectionError: null }),
  beginHistoryTransaction: () => {
    if (!transactionSnapshot) transactionSnapshot = snapshotOf(get());
  },
  endHistoryTransaction: () => {
    const before = transactionSnapshot;
    transactionSnapshot = null;
    if (!before) return;
    const state = get();
    const after = snapshotOf(state);
    if (!sameSnapshot(before, after)) set(historyFor(state, before));
  },
  undo: () => {
    const state = get();
    const previous = state.past.at(-1);
    if (!previous) return;
    const current = snapshotOf(state);
    set({ ...cloneSnapshot(previous), past: state.past.slice(0, -1), future: [current, ...state.future].slice(0, HISTORY_LIMIT), canUndo: state.past.length > 1, canRedo: true, selectedElementId: null, selectedConnectionId: null });
  },
  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    const current = snapshotOf(state);
    set({ ...cloneSnapshot(next), past: [...state.past, current].slice(-HISTORY_LIMIT), future: state.future.slice(1), canUndo: true, canRedo: state.future.length > 1, selectedElementId: null, selectedConnectionId: null });
  },
  clearModel: () => {
    const state = get();
    if (!state.nodes.length && !state.edges.length) return;
    set({ nodes: [], edges: [], selectedElementId: null, selectedConnectionId: null, past: [], future: [], canUndo: false, canRedo: false, statusMessage: 'New empty project' });
  },

  exportModel: () => JSON.stringify(serializeModel(get().nodes, get().edges), null, 2),
  importModel: (json) => {
    try {
      const model = JSON.parse(json);
      if (!isModelDocument(model)) throw new Error('Unsupported document version.');
      const errors = validateModelDocument(model);
      if (errors.length) throw new Error(errors[0]);
      const nodes = model.allElements.map((element) => ({
        id: element.id, type: 'hilesNode', position: { x: element.layout.x, y: element.layout.y },
        ...(element.parentId ? { parentId: element.parentId, extent: 'parent' as const, expandParent: true } : {}),
        ...(element.layout.width || element.layout.height ? { style: { width: element.layout.width, height: element.layout.height } } : {}),
        data: { hilesType: element.type, name: element.name, ports: element.ports, properties: element.properties },
      })) as HilesNode[];
      set({ nodes: nodes.map(normalizeNode), edges: model.connections.map(normalizeEdge), selectedElementId: null, selectedConnectionId: null, connectionError: null, past: [], future: [], canUndo: false, canRedo: false });
      persistAutosave();
      set({ statusMessage: 'JSON model imported' });
    } catch (error) {
      set({ connectionError: error instanceof Error ? error.message : 'The selected file is not a valid HiLeS JSON model.' });
    }
  },
  loadAutosave: () => {
    if (autosaveLoaded) return;
    autosaveLoaded = true;
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return;
    try {
      const payload = JSON.parse(saved) as { version?: number; data?: unknown };
      if (payload.version !== AUTOSAVE_VERSION || !isModelDocument(payload.data)) throw new Error('Invalid autosave');
      const errors = validateModelDocument(payload.data);
      if (errors.length) throw new Error(errors[0]);
      const model = payload.data;
      const nodes = model.allElements.map((element) => ({
        id: element.id, type: 'hilesNode', position: { x: element.layout.x, y: element.layout.y },
        ...(element.parentId ? { parentId: element.parentId, extent: 'parent' as const, expandParent: true } : {}),
        ...(element.layout.width || element.layout.height ? { style: { width: element.layout.width, height: element.layout.height } } : {}),
        data: { hilesType: element.type, name: element.name, ports: element.ports, properties: element.properties },
      })) as HilesNode[];
      set({ nodes: nodes.map(normalizeNode), edges: model.connections.map(normalizeEdge), selectedElementId: null, selectedConnectionId: null, connectionError: null, statusMessage: 'Autosaved model restored', past: [], future: [], canUndo: false, canRedo: false });
    } catch {
      set({ connectionError: 'The autosaved model could not be restored.' });
    }
  },
}));

useEditorStore.subscribe((state, previous) => {
  if (state.nodes === previous.nodes && state.edges === previous.edges) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    persistAutosave();
  }, 600);
});

window.addEventListener('beforeunload', persistAutosave);
