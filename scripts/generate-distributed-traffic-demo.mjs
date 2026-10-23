// Genera output/demo-4-semaforos-distribuidos.json (Persona 3, entrega del 20 de octubre).
//
// Demo manual construido únicamente con elementos generales de HiLeS. Cada
// sentido tiene dos Services inyectables (`vehiculos_esperando` y `luz`) y un
// Functional Block Python. No requiere lógica vial ni sensores en el firmware.
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

// Matriz usada únicamente por el Functional Block de seguridad del modelo.
const conflicts = {
  norte: ['este', 'oeste'],
  sur: ['este', 'oeste'],
  este: ['norte', 'sur'],
  oeste: ['norte', 'sur'],
};

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
  "        'solicitud': vehiculos_esperando > 0 and luz == 'rojo',",
  '    }',
].join('\n');

const activeExpr = (direction) =>
  `inputs.get('luz_${direction}') == 'verde' or inputs.get('luz_${direction}') == 'amarillo'`;

const safetyCode = [
  'def calcular(**inputs):',
  ...directions.map((direction) => `    ${direction.id} = ${activeExpr(direction.id)}`),
  '    conflicto = ' + Object.entries(conflicts)
    .flatMap(([from, others]) => others.filter((other) => from < other).map((other) => `(${from} and ${other})`))
    .join(' or '),
  "    eje = 'todo-rojo'",
  '    if conflicto:',
  "        eje = 'conflicto'",
  '    elif norte or sur:',
  "        eje = 'norte-sur'",
  '    elif este or oeste:',
  "        eje = 'este-oeste'",
  "    return {'seguro': not conflicto, 'eje': eje}",
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
      description: `Ejemplo manual del sentido ${direction.name} (eje ${direction.axis}), construido con elementos generales.`,
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
    id: `luz-${direction.id}`, type: 'SERVICE', name: `🚦 Luz ${direction.name}`, parentId: block,
    layout: { x: 40, y: 210 },
    ports: [port(`luz-${direction.id}-out`, 'luz', 'output', 'string', 'right')],
    properties: baseProperties({
      description: 'Entrada manual opcional: inicia en rojo y acepta rojo, amarillo o verde.',
      heldValue: 'rojo',
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
      port(`lamparas-${direction.id}-solicitud`, 'solicitud', 'output', 'boolean', 'right', 0.8),
    ],
    properties: baseProperties({
      description: 'Traduce la luz a lámparas y muestra la solicitud de paso cuando hay vehículos en rojo.',
      codeLanguage: 'python',
      code: lampCode,
    }),
  });
  connections.push({
    id: `cch-sensor-${direction.id}`, source: `sensor-${direction.id}`, sourceHandle: `sensor-${direction.id}-out`,
    target: `lamparas-${direction.id}`, targetHandle: `lamparas-${direction.id}-vehiculos`,
    label: 'CCH · vehículos esperando', type: 'hilesEdge', data: edgeData('integer'),
  });
  connections.push({
    id: `cch-luz-${direction.id}`, source: `luz-${direction.id}`, sourceHandle: `luz-${direction.id}-out`,
    target: `lamparas-${direction.id}`, targetHandle: `lamparas-${direction.id}-luz`,
    label: 'CCH · luz', type: 'hilesEdge', data: edgeData('string'),
  });
}

elements.push({
  id: 'control-block', type: 'STRUCTURAL_BLOCK', name: 'Matriz de conflictos',
  layout: { x: 400, y: 960, width: 760, height: 300 }, ports: [],
  properties: baseProperties({
    description: 'Comprueba en cada paso que Norte–Sur y Este–Oeste nunca estén activos a la vez. No decide colores.',
  }),
});
elements.push({
  id: 'seguridad-cruce', type: 'FUNCTIONAL_BLOCK', name: 'Seguridad del cruce', parentId: 'control-block',
  layout: { x: 260, y: 90 },
  ports: [
    ...directions.map((direction, index) =>
      port(`seguridad-luz-${direction.id}`, `luz_${direction.id}`, 'input', 'string', 'left', 0.2 + index * 0.2)),
    port('seguridad-seguro', 'seguro', 'output', 'boolean', 'right', 0.35),
    port('seguridad-eje', 'eje', 'output', 'string', 'right', 0.65),
  ],
  properties: baseProperties({
    description: 'seguro=false indicaría verdes o amarillos incompatibles; eje muestra el movimiento activo.',
    codeLanguage: 'python',
    code: safetyCode,
  }),
});
for (const direction of directions) {
  connections.push({
    id: `cch-seguridad-${direction.id}`, source: `luz-${direction.id}`, sourceHandle: `luz-${direction.id}-out`,
    target: 'seguridad-cruce', targetHandle: `seguridad-luz-${direction.id}`,
    label: `CCH · luz ${direction.name}`, type: 'hilesEdge', data: edgeData('string'),
  });
}

const document = {
  schemaVersion: 2,
  metadata: {
    savedAt: '2026-10-18T22:00:00-05:00',
    description: 'Demo manual construido solo con Services y Functional Blocks generales. El usuario inyecta cantidades y colores; la Pico ejecuta el Python del modelo.',
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
      elementIds: [`sensor-${direction.id}`, `luz-${direction.id}`, `lamparas-${direction.id}`],
    })),
    { nodeId: 'control-block', elementIds: ['seguridad-cruce'] },
  ],
  connections,
};

const destination = resolve('output/demo-4-semaforos-distribuidos.json');
writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Generado ${destination}: ${elements.length} elementos visuales y ${connections.length} conexiones.`);
