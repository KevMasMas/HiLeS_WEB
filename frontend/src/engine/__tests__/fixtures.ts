import type { Edge, Node } from '@xyflow/react';
import {
  HilesConnectionType,
  HilesElementType,
  type HilesEdgeData,
  type HilesNodeData,
  type HilesNodeProperties,
  type HilesPort,
  type PortDataType,
  type PortNature,
} from '../../types/hiles';

export const propiedades = (cambios: Partial<HilesNodeProperties> = {}): HilesNodeProperties => ({
  description: '',
  collapsed: false,
  locked: false,
  visible: true,
  expression: '',
  executionDelay: 0,
  enabled: true,
  tokens: 0,
  maxTokens: 1,
  delay: 0,
  condition: '',
  heldValue: '',
  operatorDirection: 'right',
  rotation: 0,
  ...cambios,
});

export const puerto = (
  id: string,
  name: string,
  direction: HilesPort['direction'],
  dataType: PortDataType = 'real',
  nature: PortNature = 'continuous',
): HilesPort => ({
  id,
  name,
  direction,
  dataType,
  nature,
  side: direction === 'input' ? 'left' : 'right',
  offset: 0.5,
});

export const nodo = (
  id: string,
  hilesType: HilesNodeData['hilesType'],
  ports: HilesPort[] = [],
  properties: Partial<HilesNodeProperties> = {},
): Node<HilesNodeData> => ({
  id,
  type: 'hilesNode',
  position: { x: 0, y: 0 },
  data: { hilesType, name: id, ports, properties: propiedades(properties) },
});

export const arista = (
  id: string,
  source: string,
  target: string,
  hilesConnectionType: HilesConnectionType,
  sourceHandle?: string,
  targetHandle?: string,
  weight = 1,
): Edge<HilesEdgeData> => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  data: {
    hilesConnectionType,
    routing: 'straight',
    dataType: 'real',
    delay: 0,
    weight,
    propagationMode: 'push',
  },
});

export const circuitoHumedad = () => {
  const nodes = [
    nodo('sensor', HilesElementType.SERVICE, [puerto('sensor-out', 'humedad', 'output')]),
    nodo('condicion', HilesElementType.FUNCTIONAL_BLOCK, [
      puerto('humedad-in', 'humedad', 'input'),
      puerto('condicion-out', 'resultado', 'output', 'boolean', 'control'),
    ], { code: 'humedad < 76', codeLanguage: 'javascript' }),
    nodo('espera', HilesElementType.PLACE, [], { tokens: 1, maxTokens: 1 }),
    nodo('transicion', HilesElementType.TRANSITION, [
      puerto('transition-condition-in', 'Condición', 'input', 'boolean', 'control'),
      puerto('transition-action-out', 'Acción', 'output', 'boolean', 'control'),
    ]),
    nodo('activo', HilesElementType.PLACE, [], { tokens: 0, maxTokens: 1 }),
  ];
  const edges = [
    arista('sensor-condicion', 'sensor', 'condicion', HilesConnectionType.CONTINUOUS, 'sensor-out', 'humedad-in'),
    arista('condicion-transicion', 'condicion', 'transicion', HilesConnectionType.CONTINUOUS, 'condicion-out', 'transition-condition-in'),
    arista('espera-transicion', 'espera', 'transicion', HilesConnectionType.PETRI, 'petri-out', 'petri-in'),
    arista('transicion-activo', 'transicion', 'activo', HilesConnectionType.PETRI, 'petri-out', 'petri-in'),
  ];
  return { nodes, edges };
};
