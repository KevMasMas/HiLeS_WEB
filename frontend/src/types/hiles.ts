export const HilesElementType = {
  STRUCTURAL_BLOCK: 'STRUCTURAL_BLOCK',
  FUNCTIONAL_BLOCK: 'FUNCTIONAL_BLOCK',
  SERVICE: 'SERVICE',
  PORT: 'PORT',
  SAMPLE: 'SAMPLE',
  HOLD: 'HOLD',
  PLACE: 'PLACE',
  TRANSITION: 'TRANSITION',
  TOKEN: 'TOKEN', // Legacy import compatibility. Tokens are stored on Place nodes.
} as const;

export type HilesElementType = (typeof HilesElementType)[keyof typeof HilesElementType];

export const HilesConnectionType = {
  CONTINUOUS: 'CONTINUOUS',
  DISCRETE: 'DISCRETE',
  PETRI: 'PETRI',
  TOKEN_FLOW: 'TOKEN_FLOW',
} as const;

export type HilesConnectionType = (typeof HilesConnectionType)[keyof typeof HilesConnectionType];
export type PortDirection = 'input' | 'output';
export type PortDataType = 'boolean' | 'integer' | 'real' | 'string' | 'vector' | 'custom';
export type PortNature = 'continuous' | 'control';
export type PortSide = 'left' | 'right' | 'top' | 'bottom';
export type ConnectionRouting = 'straight' | 'curved' | 'orthogonal';
export type OperatorDirection = 'left' | 'right' | 'up' | 'down';

export interface HilesPort {
  id: string;
  name: string;
  direction: PortDirection;
  dataType: PortDataType;
  nature: PortNature;
  side: PortSide;
  offset: number;
}

export interface HilesNodeProperties {
  description: string;
  collapsed: boolean;
  locked: boolean;
  visible: boolean;
  expression: string;
  executionDelay: number;
  enabled: boolean;
  tokens: number;
  maxTokens: number;
  delay: number;
  condition: string;
  heldValue: string;
  operatorDirection: OperatorDirection;
}

export interface HilesNodeData extends Record<string, unknown> {
  hilesType: HilesElementType;
  name: string;
  ports: HilesPort[];
  properties: HilesNodeProperties;
}

export interface HilesEdgeData extends Record<string, unknown> {
  hilesConnectionType: HilesConnectionType;
  routing: ConnectionRouting;
  dataType: PortDataType;
  delay: number;
  weight: number;
}

export interface HilesElement {
  id: string;
  type: HilesElementType;
  name: string;
  positionX: number;
  positionY: number;
  properties: Record<string, unknown>;
}

export interface HilesConnection {
  id: string;
  sourceElementId: string;
  targetElementId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type: HilesConnectionType;
  properties?: Record<string, unknown>;
}

export interface HilesModel {
  id: string;
  name: string;
  elements: HilesElement[];
  connections: HilesConnection[];
}
