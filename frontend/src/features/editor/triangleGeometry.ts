import type { OperatorDirection } from '../../types/hiles';

export const TRIANGLE_VIEWBOX = { width: 100, height: 60 } as const;

export type TrianglePoint = { x: number; y: number };

/** Vértices del polígono compartidos por el símbolo y sus puertos de conexión. */
export const triangleVertices = (direction: OperatorDirection): TrianglePoint[] => ({
  right: [{ x: 16, y: 8 }, { x: 16, y: 52 }, { x: 88, y: 30 }],
  left: [{ x: 84, y: 8 }, { x: 84, y: 52 }, { x: 12, y: 30 }],
  up: [{ x: 8, y: 52 }, { x: 92, y: 52 }, { x: 50, y: 8 }],
  down: [{ x: 8, y: 8 }, { x: 92, y: 8 }, { x: 50, y: 52 }],
}[direction]);

export const trianglePoints = (direction: OperatorDirection) => triangleVertices(direction)
  .map(({ x, y }) => `${x},${y}`).join(' ');
