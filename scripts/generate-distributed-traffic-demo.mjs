// Genera output/demo-4-semaforos-distribuidos.json (Persona 3, entrega del 20 de octubre).
//
// Demo automático construido únicamente con elementos generales de HiLeS.
// El usuario inyecta solo los cuatro conteos de vehículos; un Functional Block
// central decide qué eje recibe verde y mantiene el otro en rojo.
//
// Uso desde la raíz del repositorio:
//   node scripts/generate-distributed-traffic-demo.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directions = [
  { id: 'norte', name: 'Norte', axis: 'norte-sur', x: 80, y: 80 },
  { id: 'sur', name: 'Sur', axis: 'norte-sur', x: 820, y: 80 },
  { id: 'este', name: 'Este', axis: 'este-oeste', x: 80, y: 520 },
  { id: 'oeste', name: 'Oeste', axis: 'este-oeste', x: 820, y: 520 },
];

const baseProperties = (overrides = {}) => ({
  description: '', collapsed: false, locked: false, visible: true,
  expression: '', executionDelay: 0, enabled: true, tokens: 0,
  maxTokens: 1, delay: 0, condition: '', heldValue: '',
  operatorDirection: 'right', rotation: 0, ...overrides,
});

const port = (id, name, direction, dataType, side, offset = 0.5) => ({
  id, name, direction, dataType, nature: 'continuous', side, offset,
});

const lampCode = [
  'def calcular(**inputs):',
  "    luz = inputs.get('luz')",
  "    vehiculos_esperando = inputs.get('vehiculos_esperando')",
  '    if vehiculos_esperando is None:',
  '        vehiculos_esperando = 0',
  "    if luz != 'verde' and luz != 'amarillo':",
  "        luz = 'rojo'",
  '    return {',
  "        'rojo': luz == 'rojo',",
  "        'amarillo': luz == 'amarillo',",
  "        'verde': luz == 'verde',",
  "        'vehiculos': vehiculos_esperando,",
  '    }',
].join('\n');

const trafficControlCode = [
  'def calcular(**inputs):',
  ...directions.flatMap((direction) => [
    `    ${direction.id} = inputs.get('vehiculos_${direction.id}')`,
    `    if ${direction.id} is None:`,
    `        ${direction.id} = 0`,
  ]),
  '    total_norte_sur = norte + sur',
  '    total_este_oeste = este + oeste',
  "    luz_norte = 'rojo'",
  "    luz_sur = 'rojo'",
  "    luz_este = 'rojo'",
  "    luz_oeste = 'rojo'",
  "    eje = 'todo-rojo'",
  '    if total_norte_sur > total_este_oeste:',
  "        luz_norte = 'verde'",
  "        luz_sur = 'verde'",
  "        eje = 'norte-sur'",
  '    elif total_este_oeste > total_norte_sur:',
  "        luz_este = 'verde'",
  "        luz_oeste = 'verde'",
  "        eje = 'este-oeste'",
  '    return {',
  "        'luz_norte': luz_norte,",
  "        'luz_sur': luz_sur,",
  "        'luz_este': luz_este,",
  "        'luz_oeste': luz_oeste,",
  "        'eje': eje,",
  '    }',
].join('\n');

const elements = [];
const connections = [];
const edgeData = (dataType) => ({
  hilesConnectionType: 'CONTINUOUS', routing: 'orthogonal', dataType,
  delay: 0, weight: 1, propagationMode: 'push', waypoints: [],
});

for (const direction of directions) {
  const block = `${direction.id}-block`;
  elements.push({
    id: block, type: 'STRUCTURAL_BLOCK', name: `Semáforo ${direction.name}`,
    layout: { x: direction.x, y: direction.y, width: 640, height: 340 }, ports: [],
    properties: baseProperties({
      description: `Recibe el número de vehículos del sentido ${direction.name} y muestra el color decidido automáticamente.`,
    }),
  });
  elements.push({
    id: `sensor-${direction.id}`, type: 'SERVICE', name: `🚗 Sensor ${direction.name}`, parentId: block,
    layout: { x: 40, y: 60 },
    ports: [port(`sensor-${direction.id}-out`, 'vehiculos_esperando', 'output', 'integer', 'right')],
    properties: baseProperties({
      description: `Cantidad de vehículos detenidos esperando paso en el sentido ${direction.name}.`,
      heldValue: '0',
    }),
  });
  elements.push({
    id: `lamparas-${direction.id}`, type: 'FUNCTIONAL_BLOCK', name: `Lámparas ${direction.name}`, parentId: block,
    layout: { x: 330, y: 110 },
    ports: [
      port(`lamparas-${direction.id}-luz`, 'luz', 'input', 'string', 'left', 0.3),
      port(`lamparas-${direction.id}-vehiculos`, 'vehiculos_esperando', 'input', 'integer', 'left', 0.7),
      port(`lamparas-${direction.id}-rojo`, 'rojo', 'output', 'boolean', 'right', 0.2),
      port(`lamparas-${direction.id}-amarillo`, 'amarillo', 'output', 'boolean', 'right', 0.4),
      port(`lamparas-${direction.id}-verde`, 'verde', 'output', 'boolean', 'right', 0.6),
      port(`lamparas-${direction.id}-vehiculos-out`, 'vehiculos', 'output', 'integer', 'right', 0.8),
    ],
    properties: baseProperties({
      description: 'Convierte la decisión automática en las señales rojo, amarillo y verde.',
      codeLanguage: 'python',
      code: lampCode,
    }),
  });
  connections.push({
    id: `cch-sensor-${direction.id}`, source: `sensor-${direction.id}`, sourceHandle: `sensor-${direction.id}-out`,
    target: `lamparas-${direction.id}`, targetHandle: `lamparas-${direction.id}-vehiculos`,
    label: 'CCH · vehículos esperando', type: 'hilesEdge', data: edgeData('integer'),
  });
}

elements.push({
  id: 'control-block', type: 'STRUCTURAL_BLOCK', name: 'Control automático de tráfico',
  layout: { x: 400, y: 960, width: 760, height: 300 }, ports: [],
  properties: baseProperties({
    description: 'Suma los carros de cada eje y concede verde al eje con mayor congestión. En empate deja todo rojo.',
  }),
});
elements.push({
  id: 'control-trafico', type: 'FUNCTIONAL_BLOCK', name: 'Decidir eje con prioridad', parentId: 'control-block',
  layout: { x: 260, y: 90 },
  ports: [
    ...directions.map((direction, index) =>
      port(`control-vehiculos-${direction.id}`, `vehiculos_${direction.id}`, 'input', 'integer', 'left', 0.15 + index * 0.2)),
    ...directions.map((direction, index) =>
      port(`control-luz-${direction.id}`, `luz_${direction.id}`, 'output', 'string', 'right', 0.15 + index * 0.17)),
    port('control-eje', 'eje', 'output', 'string', 'bottom', 0.5),
  ],
  properties: baseProperties({
    description: 'Compara Norte+Sur contra Este+Oeste y produce automáticamente los cuatro colores.',
    codeLanguage: 'python',
    code: trafficControlCode,
  }),
});
for (const direction of directions) {
  connections.push({
    id: `cch-control-sensor-${direction.id}`, source: `sensor-${direction.id}`, sourceHandle: `sensor-${direction.id}-out`,
    target: 'control-trafico', targetHandle: `control-vehiculos-${direction.id}`,
    label: `CCH · carros ${direction.name}`, type: 'hilesEdge', data: edgeData('integer'),
  });
  connections.push({
    id: `cch-control-luz-${direction.id}`, source: 'control-trafico', sourceHandle: `control-luz-${direction.id}`,
    target: `lamparas-${direction.id}`, targetHandle: `lamparas-${direction.id}-luz`,
    label: `CCH · decisión ${direction.name}`, type: 'hilesEdge', data: edgeData('string'),
  });
}

const document = {
  schemaVersion: 2,
  metadata: {
    savedAt: '2026-10-18T22:00:00-05:00',
    description: 'Semáforo inteligente: el usuario inyecta solo cantidades y el controlador asigna verde al eje con más vehículos.',
  },
  network: {
    topology: null,
    protocol: null,
    nodes: [...directions.map((direction) => `${direction.id}-block`), 'control-block'],
  },
  allElements: elements,
  relationNode: [
    ...directions.map((direction) => ({
      nodeId: `${direction.id}-block`,
      elementIds: [`sensor-${direction.id}`, `lamparas-${direction.id}`],
    })),
    { nodeId: 'control-block', elementIds: ['control-trafico'] },
  ],
  connections,
};

const destination = resolve('output/demo-4-semaforos-distribuidos.json');
writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Generado ${destination}: ${elements.length} elementos visuales y ${connections.length} conexiones.`);
