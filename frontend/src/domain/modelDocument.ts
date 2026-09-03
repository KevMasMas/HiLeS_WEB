import type { Edge, Node } from '@xyflow/react';
import type { HilesEdgeData, HilesNodeData } from '../types/hiles';

export const HILES_DOCUMENT_VERSION = 1;

export interface HilesModelDocument {
  schemaVersion: number;
  metadata: { savedAt: string };
  network: { topology: null; protocol: null; nodes: string[] };
  allElements: Array<{
    id: string;
    type: HilesNodeData['hilesType'];
    name: string;
    parentId?: string;
    layout: { x: number; y: number; width?: number; height?: number };
    ports: HilesNodeData['ports'];
    properties: HilesNodeData['properties'];
  }>;
  relationNode: Array<{ nodeId: string; elementIds: string[] }>;
  connections: Edge<HilesEdgeData>[];
}

type HilesNode = Node<HilesNodeData>;

export const serializeModel = (nodes: HilesNode[], connections: Edge<HilesEdgeData>[]): HilesModelDocument => ({
  schemaVersion: HILES_DOCUMENT_VERSION,
  metadata: { savedAt: new Date().toISOString() },
  network: { topology: null, protocol: null, nodes: nodes.filter((node) => node.data.hilesType === 'STRUCTURAL_BLOCK').map((node) => node.id) },
  allElements: nodes.map((node) => ({
    id: node.id, type: node.data.hilesType, name: node.data.name,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    layout: { x: node.position.x, y: node.position.y, width: Number(node.style?.width) || undefined, height: Number(node.style?.height) || undefined },
    ports: node.data.ports, properties: node.data.properties,
  })),
  relationNode: nodes.filter((node) => node.data.hilesType === 'STRUCTURAL_BLOCK').map((node) => ({ nodeId: node.id, elementIds: nodes.filter((child) => child.parentId === node.id).map((child) => child.id) })),
  connections,
});

export const isModelDocument = (value: unknown): value is HilesModelDocument => {
  if (!value || typeof value !== 'object') return false;
  const document = value as Partial<HilesModelDocument>;
  return document.schemaVersion === HILES_DOCUMENT_VERSION && Array.isArray(document.allElements) && Array.isArray(document.connections);
};

export const validateModelDocument = (document: HilesModelDocument): string[] => {
  const errors: string[] = [];
  const ids = new Set<string>();
  const elementsById = new Map(document.allElements.map((element) => [element.id, element]));

  document.allElements.forEach((element) => {
    if (!element.id) errors.push('Every element requires an id.');
    if (ids.has(element.id)) errors.push(`Duplicate element id: ${element.id}.`);
    ids.add(element.id);
    if (!element.name?.trim()) errors.push(`Element ${element.id || '(without id)'} requires a name.`);
    if (element.parentId && !elementsById.has(element.parentId)) errors.push(`Element ${element.id} references an unknown parent.`);
  });

  document.connections.forEach((connection) => {
    if (!connection.id) errors.push('Every connection requires an id.');
    if (!elementsById.has(connection.source)) errors.push(`Connection ${connection.id} has an unknown source.`);
    if (!elementsById.has(connection.target)) errors.push(`Connection ${connection.id} has an unknown target.`);
  });

  return errors;
};
