export const HilesElementType = {
  STRUCTURAL_BLOCK: 'STRUCTURAL_BLOCK',
  FUNCTIONAL_BLOCK: 'FUNCTIONAL_BLOCK',
  SERVICE: 'SERVICE',
  PORT: 'PORT',
  SAMPLE: 'SAMPLE',
  HOLD: 'HOLD',
  PLACE: 'PLACE',
  TRANSITION: 'TRANSITION',
  TOKEN: 'TOKEN',
} as const;

export type HilesElementType = (typeof HilesElementType)[keyof typeof HilesElementType];

export const HilesConnectionType = {
  CONTINUOUS: 'CONTINUOUS',
  DISCRETE: 'DISCRETE',
  PETRI: 'PETRI',
  TOKEN_FLOW: 'TOKEN_FLOW',
} as const;

export type HilesConnectionType = (typeof HilesConnectionType)[keyof typeof HilesConnectionType];

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
