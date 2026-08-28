export const HilesElementType = {
  STRUCTURAL_BLOCK: 'STRUCTURAL_BLOCK',
  FUNCTIONAL_BLOCK: 'FUNCTIONAL_BLOCK',
  SERVICE: 'SERVICE',
  PORT: 'PORT',
  SAMPLE: 'SAMPLE',
  HOLD: 'HOLD',
  PLACE: 'PLACE',
  TRANSITION: 'TRANSITION',
} as const;

export type HilesElementType = (typeof HilesElementType)[keyof typeof HilesElementType];

export const HilesConnectionType = {
  CONTINUOUS: 'CONTINUOUS',
  DISCRETE: 'DISCRETE',
  PETRI: 'PETRI',
} as const;

export type HilesConnectionType = (typeof HilesConnectionType)[keyof typeof HilesConnectionType];

export interface HilesElement {
  id: string;
  type: HilesElementType;
  name: string;
  positionX: number;
  positionY: number;
  properties: Record<string, any>;
}

export interface HilesConnection {
  id: string;
  sourceElementId: string;
  targetElementId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type: HilesConnectionType;
  properties?: Record<string, any>;
}

export interface HilesModel {
  id: string;
  name: string;
  elements: HilesElement[];
  connections: HilesConnection[];
}
