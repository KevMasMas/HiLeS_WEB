import type { HilesModelDocument } from '../../domain/modelDocument';

/**
 * Ejemplo mínimo sin hardware obligatorio: dos Structural Blocks que pueden
 * correr ambos en «Este navegador» o repartirse entre una Pico W y el navegador.
 *
 *   [Sensor] Entrada ──CCH──▶ [Proceso] Sumar uno ──▶ Resultado
 */
const propiedades = (extra: Record<string, unknown> = {}) => ({
  description: '', collapsed: false, locked: false, visible: true,
  expression: '', executionDelay: 0, enabled: true, tokens: 0,
  maxTokens: 1, delay: 0, condition: '', heldValue: '',
  operatorDirection: 'right', rotation: 0, ...extra,
});

const puerto = (
  id: string,
  name: string,
  direction: 'input' | 'output',
  side: 'left' | 'right',
  dataType: 'integer' | 'boolean' = 'integer',
) => ({
  id, name, direction, dataType, nature: 'continuous', side, offset: 0.5,
});

const datosArista = (dataType: 'integer' | 'boolean' = 'integer') => ({
  hilesConnectionType: 'CONTINUOUS', routing: 'orthogonal', dataType,
  delay: 0, weight: 1, propagationMode: 'push', waypoints: [],
});

export const crearEjemploMinimo = (): HilesModelDocument => ({
  schemaVersion: 2,
  metadata: { savedAt: '2026-10-28T00:00:00.000Z' },
  network: { topology: null, protocol: null, nodes: ['ejemplo-sensor', 'ejemplo-proceso'] },
  allElements: [
    {
      id: 'ejemplo-sensor', type: 'STRUCTURAL_BLOCK', name: 'Sensor',
      layout: { x: 60, y: 80, width: 300, height: 220 }, ports: [],
      properties: propiedades({ description: 'Asígnalo a «Este navegador» (sin hardware) o a una Pico W.' }),
    },
    {
      id: 'ejemplo-entrada', type: 'SERVICE', name: 'Entrada', parentId: 'ejemplo-sensor',
      layout: { x: 90, y: 90 }, ports: [puerto('ejemplo-entrada-out', 'valor', 'output', 'right')],
      properties: propiedades({ description: 'Inyecta aquí un número entero desde Entradas.', heldValue: '4' }),
    },
    {
      id: 'ejemplo-proceso', type: 'STRUCTURAL_BLOCK', name: 'Proceso',
      layout: { x: 460, y: 80, width: 420, height: 220 }, ports: [],
      properties: propiedades({ description: 'Asígnalo a «Este navegador» o a otra placa.' }),
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
      target: 'ejemplo-sumar', targetHandle: 'ejemplo-sumar-in', label: 'CCH', type: 'hilesEdge', data: datosArista(),
    },
    {
      id: 'ejemplo-cch-resultado', source: 'ejemplo-sumar', sourceHandle: 'ejemplo-sumar-out',
      target: 'ejemplo-resultado', targetHandle: 'ejemplo-resultado-in', label: 'CCH', type: 'hilesEdge', data: datosArista(),
    },
  ],
}) as unknown as HilesModelDocument;

/**
 * Ejemplo multi-Pico de referencia: tres Structural Blocks listos para repartir
 * entre dos Raspberry Pi Pico W y un navegador supervisor mediante rutas CCH.
 *
 *   [SB 1 · Placa A] ──CCH──▶ [SB 2 · Placa B] ──CCH──▶ [SB 3 · Supervisor]
 */
export const crearEjemploMultiPico = (): HilesModelDocument => ({
  schemaVersion: 2,
  metadata: { savedAt: '2026-11-04T00:00:00.000Z' },
  network: {
    topology: 'lineal',
    protocol: 'hiles-distributed-v3',
    nodes: ['sb-entrada', 'sb-proceso', 'sb-decision'],
  },
  allElements: [
    {
      id: 'sb-entrada', type: 'STRUCTURAL_BLOCK', name: 'SB 1 · Entrada (Pico 1)',
      layout: { x: 60, y: 120, width: 280, height: 240 }, ports: [],
      properties: propiedades({ description: 'Asígnalo a la primera Pico W (o a un navegador).' }),
    },
    {
      id: 'entrada-numero-sb', type: 'SERVICE', name: 'Número de entrada', parentId: 'sb-entrada',
      layout: { x: 60, y: 85 },
      ports: [puerto('entrada-numero-sb-out', 'numero', 'output', 'right', 'integer')],
      properties: propiedades({ description: 'Inyecta un entero desde el panel Entradas.', heldValue: '6' }),
    },
    {
      id: 'sb-proceso', type: 'STRUCTURAL_BLOCK', name: 'SB 2 · Proceso (Pico 2)',
      layout: { x: 400, y: 120, width: 300, height: 240 }, ports: [],
      properties: propiedades({ description: 'Asígnalo a la segunda Pico W para cruzar entre placas.' }),
    },
    {
      id: 'duplicar-numero-sb', type: 'FUNCTIONAL_BLOCK', name: 'Duplicar número', parentId: 'sb-proceso',
      layout: { x: 65, y: 85 },
      ports: [
        puerto('duplicar-numero-sb-in', 'numero', 'input', 'left', 'integer'),
        puerto('duplicar-numero-sb-out', 'doble', 'output', 'right', 'integer'),
      ],
      properties: propiedades({
        description: 'Multiplica el número recibido por dos.',
        codeLanguage: 'python',
        code: "def calcular(numero):\n    return {'doble': numero * 2}",
      }),
    },
    {
      id: 'sb-decision', type: 'STRUCTURAL_BLOCK', name: 'SB 3 · Decisión (Supervisor)',
      layout: { x: 760, y: 120, width: 410, height: 240 }, ports: [],
      properties: propiedades({ description: 'Asígnalo a «Este navegador» o a una tercera instancia.' }),
    },
    {
      id: 'decidir-mayor-diez-sb', type: 'FUNCTIONAL_BLOCK', name: '¿Supera 10?', parentId: 'sb-decision',
      layout: { x: 50, y: 85 },
      ports: [
        puerto('decidir-mayor-diez-sb-in', 'doble', 'input', 'left', 'integer'),
        puerto('decidir-mayor-diez-sb-out', 'alerta', 'output', 'right', 'boolean'),
      ],
      properties: propiedades({
        description: 'Activa alerta cuando el doble supera 10.',
        codeLanguage: 'python',
        code: "def calcular(doble):\n    return {'alerta': doble > 10}",
      }),
    },
    {
      id: 'salida-alerta-sb', type: 'SERVICE', name: 'Indicador alerta', parentId: 'sb-decision',
      layout: { x: 265, y: 85 },
      ports: [puerto('salida-alerta-sb-in', 'alerta', 'input', 'left', 'boolean')],
      properties: propiedades({ description: 'Refleja la decisión booleana recibida.' }),
    },
  ],
  relationNode: [
    { nodeId: 'sb-entrada', elementIds: ['entrada-numero-sb'] },
    { nodeId: 'sb-proceso', elementIds: ['duplicar-numero-sb'] },
    { nodeId: 'sb-decision', elementIds: ['decidir-mayor-diez-sb', 'salida-alerta-sb'] },
  ],
  connections: [
    {
      id: 'cch-sb-entrada-proceso',
      label: 'CCH1 · Número',
      source: 'entrada-numero-sb',
      sourceHandle: 'entrada-numero-sb-out',
      target: 'duplicar-numero-sb',
      targetHandle: 'duplicar-numero-sb-in',
      type: 'hilesEdge',
      data: datosArista('integer'),
    },
    {
      id: 'cch-sb-proceso-decision',
      label: 'CCH2 · Doble',
      source: 'duplicar-numero-sb',
      sourceHandle: 'duplicar-numero-sb-out',
      target: 'decidir-mayor-diez-sb',
      targetHandle: 'decidir-mayor-diez-sb-in',
      type: 'hilesEdge',
      data: datosArista('integer'),
    },
    {
      id: 'cch-sb-decision-indicador',
      label: 'CCH3 · Alerta',
      source: 'decidir-mayor-diez-sb',
      sourceHandle: 'decidir-mayor-diez-sb-out',
      target: 'salida-alerta-sb',
      targetHandle: 'salida-alerta-sb-in',
      type: 'hilesEdge',
      data: datosArista('boolean'),
    },
  ],
}) as unknown as HilesModelDocument;
