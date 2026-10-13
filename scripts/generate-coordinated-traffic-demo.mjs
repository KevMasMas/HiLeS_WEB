import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const directions = [
  { id: 'norte', name: 'Norte', x: 80, y: 80 },
  { id: 'sur', name: 'Sur', x: 900, y: 80 },
  { id: 'este', name: 'Este', x: 80, y: 560 },
  { id: 'oeste', name: 'Oeste', x: 900, y: 560 },
];

const baseProperties = (overrides = {}) => ({
  description: '', collapsed: false, locked: false, visible: true,
  expression: '', executionDelay: 0, enabled: true, tokens: 0,
  maxTokens: 1, delay: 0, condition: '', heldValue: '',
  operatorDirection: 'right', rotation: 0, ...overrides,
});

const transitionPorts = () => [
  { id: 'transition-condition-in', name: 'Condición', direction: 'input', dataType: 'boolean', nature: 'continuous', side: 'top', offset: 0.5 },
  { id: 'transition-action-out', name: 'Acción', direction: 'output', dataType: 'boolean', nature: 'continuous', side: 'bottom', offset: 0.5 },
];

const elements = [];
for (const direction of directions) {
  elements.push({
    id: `${direction.id}-block`, type: 'STRUCTURAL_BLOCK', name: `Semáforo ${direction.name}`,
    layout: { x: direction.x, y: direction.y, width: 720, height: 360 }, ports: [],
    properties: baseProperties({ description: `Semáforo del sentido ${direction.name}, coordinado por una única red de Petri.` }),
  });
  for (const [index, color] of ['rojo', 'amarillo', 'verde'].entries()) {
    elements.push({
      id: `${direction.id}-${color}`, type: 'PLACE', name: `${color === 'rojo' ? '🔴' : color === 'amarillo' ? '🟡' : '🟢'} ${color[0].toUpperCase()}${color.slice(1)}`,
      parentId: `${direction.id}-block`, layout: { x: 80 + index * 210, y: 105 }, ports: [],
      properties: baseProperties({
        description: `Estado ${color} del sentido ${direction.name}.`,
        tokens: color === 'rojo' ? 1 : 0,
      }),
    });
  }
}

elements.push({
  id: 'control-block', type: 'STRUCTURAL_BLOCK', name: 'Controlador coordinado',
  layout: { x: 400, y: 1020, width: 1120, height: 430 }, ports: [],
  properties: baseProperties({ description: 'Control común: nunca habilita verde Norte–Sur y Este–Oeste al mismo tiempo.' }),
});
elements.push({
  id: 'ciclo-habilitado', type: 'SERVICE', name: 'Habilitar ciclo', parentId: 'control-block',
  layout: { x: 45, y: 155 },
  ports: [{ id: 'ciclo-out', name: 'habilitado', direction: 'output', dataType: 'boolean', nature: 'continuous', side: 'right', offset: 0.5 }],
  properties: baseProperties({ description: 'Entrada controlada: true permite avanzar una fase por cada paso.' }),
});

const transitions = [
  ['fase-ns-verde', 'NS verde / EO rojo'],
  ['fase-ns-amarillo', 'NS amarillo / EO rojo'],
  ['fase-eo-verde', 'NS rojo / EO verde'],
  ['fase-eo-amarillo', 'NS rojo / EO amarillo'],
  ['fase-todo-rojo', 'Retorno seguro: todo rojo'],
];
for (const [index, [id, name]] of transitions.entries()) {
  elements.push({
    id, type: 'TRANSITION', name, parentId: 'control-block',
    layout: { x: 245 + index * 165, y: 145 }, ports: transitionPorts(),
    properties: baseProperties({ description: `Cambio atómico a la fase ${name}.` }),
  });
}

const connections = [];
const edgeData = (type) => ({ hilesConnectionType: type, routing: 'orthogonal', dataType: 'boolean', delay: 0, weight: 1, waypoints: [] });
for (const [id] of transitions) {
  connections.push({
    id: `dato-${id}`, source: 'ciclo-habilitado', sourceHandle: 'ciclo-out', target: id,
    targetHandle: 'transition-condition-in', type: 'hilesEdge', data: edgeData('CONTINUOUS'),
  });
}

const markings = [
  { transition: 'fase-ns-verde', from: { norte: 'rojo', sur: 'rojo', este: 'rojo', oeste: 'rojo' }, to: { norte: 'verde', sur: 'verde', este: 'rojo', oeste: 'rojo' } },
  { transition: 'fase-ns-amarillo', from: { norte: 'verde', sur: 'verde', este: 'rojo', oeste: 'rojo' }, to: { norte: 'amarillo', sur: 'amarillo', este: 'rojo', oeste: 'rojo' } },
  { transition: 'fase-eo-verde', from: { norte: 'amarillo', sur: 'amarillo', este: 'rojo', oeste: 'rojo' }, to: { norte: 'rojo', sur: 'rojo', este: 'verde', oeste: 'verde' } },
  { transition: 'fase-eo-amarillo', from: { norte: 'rojo', sur: 'rojo', este: 'verde', oeste: 'verde' }, to: { norte: 'rojo', sur: 'rojo', este: 'amarillo', oeste: 'amarillo' } },
  { transition: 'fase-todo-rojo', from: { norte: 'rojo', sur: 'rojo', este: 'amarillo', oeste: 'amarillo' }, to: { norte: 'rojo', sur: 'rojo', este: 'rojo', oeste: 'rojo' } },
];

for (const marking of markings) {
  for (const direction of directions) {
    const inputPlace = `${direction.id}-${marking.from[direction.id]}`;
    const outputPlace = `${direction.id}-${marking.to[direction.id]}`;
    connections.push({
      id: `arco-${marking.transition}-${direction.id}-in`, source: inputPlace, sourceHandle: 'petri-out',
      target: marking.transition, targetHandle: 'petri-in', type: 'hilesEdge', data: edgeData('PETRI'),
    });
    connections.push({
      id: `arco-${marking.transition}-${direction.id}-out`, source: marking.transition, sourceHandle: 'petri-out',
      target: outputPlace, targetHandle: 'petri-in', type: 'hilesEdge', data: edgeData('PETRI'),
    });
  }
}

const document = {
  schemaVersion: 2,
  metadata: {
    savedAt: '2026-10-12T18:45:00-05:00',
    description: 'Cruce coordinado Norte–Sur / Este–Oeste con transiciones atómicas y estado inicial todo rojo.',
  },
  network: { topology: null, protocol: null, nodes: [...directions.map((direction) => `${direction.id}-block`), 'control-block'] },
  allElements: elements,
  relationNode: [
    ...directions.map((direction) => ({
      nodeId: `${direction.id}-block`,
      elementIds: ['rojo', 'amarillo', 'verde'].map((color) => `${direction.id}-${color}`),
    })),
    { nodeId: 'control-block', elementIds: ['ciclo-habilitado', ...transitions.map(([id]) => id)] },
  ],
  connections,
};

const destination = resolve('output/demo-4-semaforos-inteligentes.json');
writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Generado ${destination}: ${elements.length} elementos visuales y ${connections.length} conexiones.`);
