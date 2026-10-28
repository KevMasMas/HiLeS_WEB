import type { HilesModelDocument } from '../../domain/modelDocument';

/**
 * Ejemplo para usuarios nuevos: dos Structural Blocks que se pueden asignar a
 * ejecutores distintos y quedan unidos por una conexión CCH remota.
 *
 *   [Sensor] Entrada ──CCH──▶ [Proceso] Sumar uno ──▶ Resultado
 */
const propiedades = (extra: Record<string, unknown> = {}) => ({
  description: '', collapsed: false, locked: false, visible: true,
  expression: '', executionDelay: 0, enabled: true, tokens: 0,
  maxTokens: 1, delay: 0, condition: '', heldValue: '',
  operatorDirection: 'right', rotation: 0, ...extra,
});

const puerto = (id: string, name: string, direction: 'input' | 'output', side: 'left' | 'right') => ({
  id, name, direction, dataType: 'integer', nature: 'continuous', side, offset: 0.5,
});

const datosArista = {
  hilesConnectionType: 'CONTINUOUS', routing: 'orthogonal', dataType: 'integer',
  delay: 0, weight: 1, propagationMode: 'push', waypoints: [],
};

export const crearEjemploMinimo = (): HilesModelDocument => ({
  schemaVersion: 2,
  metadata: { savedAt: '2026-10-28T00:00:00.000Z' },
  network: { topology: null, protocol: null, nodes: ['ejemplo-sensor', 'ejemplo-proceso'] },
  allElements: [
    {
      id: 'ejemplo-sensor', type: 'STRUCTURAL_BLOCK', name: 'Sensor',
      layout: { x: 60, y: 80, width: 300, height: 220 }, ports: [],
      properties: propiedades({ description: 'Asígnalo, por ejemplo, a una Pico W.' }),
    },
    {
      id: 'ejemplo-entrada', type: 'SERVICE', name: 'Entrada', parentId: 'ejemplo-sensor',
      layout: { x: 90, y: 90 }, ports: [puerto('ejemplo-entrada-out', 'valor', 'output', 'right')],
      properties: propiedades({ description: 'Inyecta aquí un número entero.' }),
    },
    {
      id: 'ejemplo-proceso', type: 'STRUCTURAL_BLOCK', name: 'Proceso',
      layout: { x: 460, y: 80, width: 420, height: 220 }, ports: [],
      properties: propiedades({ description: 'Asígnalo, por ejemplo, a este navegador.' }),
    },
    {
      id: 'ejemplo-sumar', type: 'FUNCTIONAL_BLOCK', name: 'Sumar uno', parentId: 'ejemplo-proceso',
      layout: { x: 60, y: 90 },
      ports: [puerto('ejemplo-sumar-in', 'x', 'input', 'left'), puerto('ejemplo-sumar-out', 'resultado', 'output', 'right')],
      properties: propiedades({ codeLanguage: 'python', code: 'def calcular(x):\n    return x + 1' }),
    },
    {
      id: 'ejemplo-resultado', type: 'SERVICE', name: 'Resultado', parentId: 'ejemplo-proceso',
      layout: { x: 280, y: 90 }, ports: [puerto('ejemplo-resultado-in', 'resultado', 'input', 'left')],
      properties: propiedades({ description: 'Muestra el valor calculado.' }),
    },
  ],
  relationNode: [
    { nodeId: 'ejemplo-sensor', elementIds: ['ejemplo-entrada'] },
    { nodeId: 'ejemplo-proceso', elementIds: ['ejemplo-sumar', 'ejemplo-resultado'] },
  ],
  connections: [
    {
      id: 'ejemplo-cch-entrada', source: 'ejemplo-entrada', sourceHandle: 'ejemplo-entrada-out',
      target: 'ejemplo-sumar', targetHandle: 'ejemplo-sumar-in', label: 'CCH', type: 'hilesEdge', data: datosArista,
    },
    {
      id: 'ejemplo-cch-resultado', source: 'ejemplo-sumar', sourceHandle: 'ejemplo-sumar-out',
      target: 'ejemplo-resultado', targetHandle: 'ejemplo-resultado-in', label: 'CCH', type: 'hilesEdge', data: datosArista,
    },
  ],
}) as unknown as HilesModelDocument;
