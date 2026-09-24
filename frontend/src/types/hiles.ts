export const HilesElementType = {
  STRUCTURAL_BLOCK: 'STRUCTURAL_BLOCK',
  FUNCTIONAL_BLOCK: 'FUNCTIONAL_BLOCK',
  SERVICE: 'SERVICE',
  PORT: 'PORT',
  SAMPLE: 'SAMPLE',
  HOLD: 'HOLD',
  PLACE: 'PLACE',
  TRANSITION: 'TRANSITION',
  TOKEN: 'TOKEN', // Compatibilidad con importaciones antiguas; los tokens se almacenan en Place.
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
export type RuntimeValue = boolean | number | string;

export type CCHPropagationMode = 'push' | 'pull' | 'flag';
export type CodeLanguage = 'javascript' | 'python';

/** Punto de enrutamiento del usuario; sus coordenadas son locales si pertenece a un Block. */
export interface ConnectionWaypoint {
  x: number;
  y: number;
  parentBlockId?: string;
}

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
  rotation: number;
  code?: string;
  codeLanguage?: CodeLanguage;
}

export interface HilesNodeData extends Record<string, unknown> {
  hilesType: HilesElementType;
  name: string;
  ports: HilesPort[];
  properties: HilesNodeProperties;
  /** Estado transitorio de presentación del lienzo; nunca se serializa en el modelo. */
  summaryMode?: boolean;
  /** Valores transitorios informados por una simulación en ejecución. */
  runtime?: {
    value?: RuntimeValue;
    active?: boolean;
    tokens?: number;
    stale?: boolean;
    lastInput?: RuntimeValue;
    error?: string;
  };
}

export interface HilesEdgeData extends Record<string, unknown> {
  hilesConnectionType: HilesConnectionType;
  routing: ConnectionRouting;
  dataType: PortDataType;
  delay: number;
  weight: number;
  /** Puntos de ruta ordenados que se insertan haciendo doble clic en una arista. */
  waypoints?: ConnectionWaypoint[];
  propagationMode?: CCHPropagationMode;
  stale?: boolean;
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
