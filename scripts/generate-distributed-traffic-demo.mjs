// Genera output/demo-4-semaforos-distribuidos.json.
//
// Cuatro semáforos autónomos comparten un único token lógico en el orden
// Norte → Este → Sur → Oeste. Cada nodo decide con un Functional Block si usa
// el turno según su fila local. Un turno siempre recorre verde → amarillo →
// rojo antes de enviar el token; un acceso sin carros lo cede desde rojo.
//
// Uso desde la raíz del repositorio:
//   node scripts/generate-distributed-traffic-demo.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GREEN_MS = 3000;
const YELLOW_MS = 1000;
const directions = [
  { id: 'norte', name: 'Norte', next: 'este', x: 60, y: 60 },
  { id: 'este', name: 'Este', next: 'sur', x: 900, y: 60 },
  { id: 'sur', name: 'Sur', next: 'oeste', x: 900, y: 660 },
  { id: 'oeste', name: 'Oeste', next: 'norte', x: 60, y: 660 },
];

const baseProperties = (overrides = {}) => ({
  description: '', collapsed: false, locked: false, visible: true,
  expression: '', executionDelay: 0, enabled: true, tokens: 0,
  maxTokens: 1, delay: 0, condition: '', heldValue: '',
  operatorDirection: 'right', rotation: 0, ...overrides,
});

const port = (id, name, direction, dataType, side, offset = 0.5, nature = 'continuous') => ({
  id, name, direction, dataType, nature, side, offset,
});

const transitionPorts = (id) => [
  port(`${id}-cond`, 'condicion', 'input', 'boolean', 'top', 0.5, 'control'),
  port(`${id}-action`, 'accion', 'output', 'boolean', 'bottom', 0.5, 'control'),
];

const dataEdge = (type = 'CONTINUOUS', dataType = 'boolean', delay = 0) => ({
  hilesConnectionType: type, routing: 'orthogonal', dataType,
  delay, weight: 1, propagationMode: 'push', waypoints: [],
});

const petriEdge = () => ({
  hilesConnectionType: 'PETRI', routing: 'orthogonal', dataType: 'boolean',
  delay: 0, weight: 1, propagationMode: 'push', waypoints: [],
});

const decisionCode = [
  'def calcular(vehiculos_locales):',
  '    return {',
  "        'hay_demanda': vehiculos_locales > 0,",
  "        'sin_demanda': vehiculos_locales <= 0,",
  "        'ciclo_activo': True,",
  '    }',
].join('\n');

const elements = [];
const connections = [];

const addData = (id, source, sourceHandle, target, targetHandle, label, type = 'CONTINUOUS', dataType = 'boolean', delay = 0) => {
  connections.push({ id, source, sourceHandle, target, targetHandle, label, type: 'hilesEdge', data: dataEdge(type, dataType, delay) });
};

const addArc = (id, source, target) => {
  connections.push({
    id, source, sourceHandle: 'petri-out', target, targetHandle: 'petri-in',
    type: 'hilesEdge', data: petriEdge(),
  });
};

for (const direction of directions) {
  const d = direction.id;
  const block = `${d}-block`;
  const fb = `decision-${d}`;
  const serviceCars = `sensor-${d}`;
  const red = `${d}-rojo`;
  const green = `${d}-verde`;
  const yellow = `${d}-amarillo`;
  const token = `${d}-token`;
  const ready = `${d}-listo`;
  const start = `${d}-iniciar-verde`;
  const skip = `${d}-ceder-sin-demanda`;
  const toYellow = `${d}-verde-a-amarillo`;
  const release = `${d}-amarillo-a-rojo`;
  const receive = `${d}-recibir-token`;

  elements.push({
    id: block, type: 'STRUCTURAL_BLOCK', name: `Semáforo ${direction.name}`,
    layout: { x: direction.x, y: direction.y, width: 780, height: 520 }, ports: [],
    properties: baseProperties({
      description: `Nodo autónomo ${direction.name}: usa o cede el token y lo entrega a ${direction.next}.`,
    }),
  });
  elements.push({
    id: serviceCars, type: 'SERVICE', name: `Carros esperando · ${direction.name}`, parentId: block,
    layout: { x: 35, y: 65 },
    ports: [port(`${serviceCars}-out`, 'vehiculos_locales', 'output', 'integer', 'right')],
    properties: baseProperties({ description: 'Entrada manual de demanda local.', heldValue: '0' }),
  });
  elements.push({
    id: fb, type: 'FUNCTIONAL_BLOCK', name: `Decisión local · ${direction.name}`, parentId: block,
    layout: { x: 225, y: 65 },
    ports: [
      port(`${fb}-cars`, 'vehiculos_locales', 'input', 'integer', 'left'),
      port(`${fb}-demand`, 'hay_demanda', 'output', 'boolean', 'right', 0.35, 'control'),
      port(`${fb}-skip`, 'sin_demanda', 'output', 'boolean', 'right', 0.7, 'control'),
      port(`${fb}-cycle`, 'ciclo_activo', 'output', 'boolean', 'bottom', 0.5, 'control'),
    ],
    properties: baseProperties({
      description: 'Toma el token si hay carros; de lo contrario lo cede conservando rojo.',
      codeLanguage: 'python', code: decisionCode,
    }),
  });

  for (const [id, name, x, tokens] of [
    [red, '🔴 Rojo', 90, 1],
    [green, '🟢 Verde', 330, 0],
    [yellow, '🟡 Amarillo', 570, 0],
    [token, '● Token local', 210, direction.id === 'norte' ? 1 : 0],
    [ready, 'Listo para recibir', 570, 1],
  ]) {
    elements.push({
      id, type: 'PLACE', name, parentId: block, layout: { x, y: id === token || id === ready ? 410 : 270 }, ports: [],
      properties: baseProperties({ tokens, maxTokens: 1, description: id === token ? 'Permiso exclusivo para iniciar un turno.' : '' }),
    });
  }

  for (const [id, name, x, y, delay] of [
    [start, 'Token + demanda → verde', 210, 265, 0],
    [toYellow, `Verde ${GREEN_MS / 1000}s → amarillo`, 450, 265, GREEN_MS],
    [release, `Amarillo ${YELLOW_MS / 1000}s → rojo y ceder`, 690, 265, YELLOW_MS],
    [skip, 'Sin carros → ceder token', 380, 405, 0],
    [receive, 'Recibir token del anterior', 690, 405, 0],
  ]) {
    elements.push({
      id, type: 'TRANSITION', name, parentId: block, layout: { x, y }, ports: transitionPorts(id),
      properties: baseProperties({ enabled: true, executionDelay: delay, description: name }),
    });
  }

  addData(`cch-${d}-cars`, serviceCars, `${serviceCars}-out`, fb, `${fb}-cars`, 'CCH · carros locales', 'CONTINUOUS', 'integer');
  addData(`lch-${d}-demand`, fb, `${fb}-demand`, start, `${start}-cond`, 'LCH · hay demanda', 'PETRI');
  addData(`lch-${d}-skip`, fb, `${fb}-skip`, skip, `${skip}-cond`, 'LCH · sin demanda', 'PETRI');
  addData(`lch-${d}-green-clock`, fb, `${fb}-cycle`, toYellow, `${toYellow}-cond`, 'LCH · temporizar verde', 'PETRI');
  addData(`lch-${d}-yellow-clock`, fb, `${fb}-cycle`, release, `${release}-cond`, 'LCH · temporizar amarillo', 'PETRI');

  addArc(`arc-${d}-red-start`, red, start);
  addArc(`arc-${d}-token-start`, token, start);
  addArc(`arc-${d}-start-green`, start, green);
  addArc(`arc-${d}-green-yellow`, green, toYellow);
  addArc(`arc-${d}-to-yellow`, toYellow, yellow);
  addArc(`arc-${d}-yellow-release`, yellow, release);
  addArc(`arc-${d}-release-red`, release, red);
  addArc(`arc-${d}-red-skip`, red, skip);
  addArc(`arc-${d}-token-skip`, token, skip);
  addArc(`arc-${d}-skip-red`, skip, red);
  addArc(`arc-${d}-ready-receive`, ready, receive);
  addArc(`arc-${d}-receive-ready`, receive, ready);
  addArc(`arc-${d}-receive-token`, receive, token);
}

// Dos posibles cesiones por nodo llegan a la misma transición del siguiente:
// fin normal amarillo→rojo o salto inmediato por ausencia de carros.
for (const direction of directions) {
  for (const source of [`${direction.id}-amarillo-a-rojo`, `${direction.id}-ceder-sin-demanda`]) {
    addData(
      `lch-token-${source}-a-${direction.next}`,
      source,
      `${source}-action`,
      `${direction.next}-recibir-token`,
      `${direction.next}-recibir-token-cond`,
      `TOKEN · ${direction.name} → ${direction.next}`,
      'PETRI',
    );
  }
}

const document = {
  schemaVersion: 2,
  metadata: {
    savedAt: '2026-10-30T10:00:00-05:00',
    description: 'Cuatro semáforos autónomos comparten un token; cada turno pasa verde, amarillo y rojo antes de cederlo.',
  },
  network: {
    topology: 'token-ring', protocol: 'hiles-distributed-v3',
    nodes: directions.map((direction) => `${direction.id}-block`),
  },
  allElements: elements,
  relationNode: directions.map((direction) => ({
    nodeId: `${direction.id}-block`,
    elementIds: elements.filter((element) => element.parentId === `${direction.id}-block`).map((element) => element.id),
  })),
  connections,
};

const destination = resolve('output/demo-4-semaforos-distribuidos.json');
writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`Generado ${destination}: 4 pares, 1 token, ${GREEN_MS} ms verde, ${YELLOW_MS} ms amarillo y 8 rutas remotas.`);
