import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..');
const envPath = path.join(repoRoot, 'frontend', '.env.local');
const requireFromFrontend = createRequire(path.join(repoRoot, 'frontend', 'package.json'));
const mqtt = requireFromFrontend('mqtt');

if (!fs.existsSync(envPath)) {
  throw new Error('Falta frontend/.env.local. Créalo a partir de frontend/.env.example.');
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const protocol = env.VITE_MQTT_WS_PROTOCOL || 'ws';
const host = env.VITE_MQTT_HOST || 'localhost';
const port = env.VITE_MQTT_WS_PORT || '9001';
const wsPath = (env.VITE_MQTT_WS_PATH || '/mqtt').replace(/^([^/])/, '/$1');
const url = `${protocol}://${host}:${port}${wsPath}`;
const runId = `e2e-${Date.now()}`;
const projectA = `${runId}-a`;
const projectB = `${runId}-b`;
const baseA = `udfjc/hiles/v2/projects/${projectA}`;
const baseB = `udfjc/hiles/v2/projects/${projectB}`;
const clients = [];

const waitUntil = (predicate, description, timeoutMs = 5000) => new Promise((resolve, reject) => {
  const deadline = Date.now() + timeoutMs;
  const check = () => {
    if (predicate()) resolve();
    else if (Date.now() >= deadline) reject(new Error(`Tiempo agotado: ${description}`));
    else setTimeout(check, 25);
  };
  check();
});

const connectClient = (name, topic) => new Promise((resolve, reject) => {
  const received = [];
  const client = mqtt.connect(url, {
    username: env.VITE_MQTT_USERNAME || undefined,
    password: env.VITE_MQTT_PASSWORD || undefined,
    clientId: `hiles-${runId}-${name}`,
    reconnectPeriod: 0,
    connectTimeout: 5000,
    clean: true,
  });
  clients.push(client);
  client.once('error', reject);
  client.on('message', (receivedTopic, bytes) => {
    try {
      received.push({ topic: receivedTopic, payload: JSON.parse(bytes.toString()) });
    } catch {
      received.push({ topic: receivedTopic, payload: null });
    }
  });
  client.once('connect', () => {
    client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) reject(error);
      else resolve({ client, received });
    });
  });
});

const publish = (client, topic, payload, options = { qos: 1, retain: false }) =>
  new Promise((resolve, reject) => {
    client.publish(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), options, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const closeClients = async () => {
  await Promise.all(clients.map((client) => new Promise((resolve) => {
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      client.stream?.destroy();
      finish();
    }, 1000);
    client.end(true, {}, finish);
  })));
};

const messageCount = (receiver, operationId) => receiver.received.filter(
  ({ payload }) => payload?.operationId === operationId,
).length;

let snapshotTopic;
let presenceTopic;
try {
  const projectAClients = await Promise.all(
    [0, 1, 2, 3].map((index) => connectClient(`a${index}`, `${baseA}/#`)),
  );
  const projectBClient = await connectClient('b0', `${baseB}/#`);

  const operationId = `${runId}-operation`;
  await publish(projectAClients[0].client, `${baseA}/document/ops`, {
    id_mensaje: operationId,
    operationId,
    proyecto_id: projectA,
    client_id: 'browser-a0',
    clock: 1,
    revision: 1,
    actualizado_en: new Date().toISOString(),
    tipo_operacion: 'document.patch',
    operacion: { kind: 'document.patch', changes: { metadata: { savedAt: new Date().toISOString() } } },
  });
  await waitUntil(
    () => projectAClients.every((receiver) => messageCount(receiver, operationId) === 1),
    'los cuatro clientes del proyecto A no recibieron exactamente una operación',
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (messageCount(projectBClient, operationId) !== 0) {
    throw new Error('Un cliente del proyecto B recibió una operación del proyecto A.');
  }

  snapshotTopic = `${baseA}/document/snapshot`;
  const snapshotId = `${runId}-snapshot`;
  await publish(projectAClients[0].client, snapshotTopic, {
    id_mensaje: snapshotId,
    operationId: snapshotId,
    proyecto_id: projectA,
    client_id: 'browser-a0',
    clock: 2,
    revision: 2,
    actualizado_en: new Date().toISOString(),
    documento: {
      schemaVersion: 2,
      metadata: { savedAt: new Date().toISOString() },
      network: { topology: null, protocol: null, nodes: [] },
      allElements: [],
      relationNode: [],
      connections: [],
    },
  }, { qos: 1, retain: true });

  const lateClient = await connectClient('late', snapshotTopic);
  await waitUntil(
    () => messageCount(lateClient, snapshotId) === 1,
    'el navegador tardío no recibió el snapshot retenido',
  );

  presenceTopic = `${baseA}/presence/browser-a0`;
  const presenceId = `${runId}-presence`;
  await publish(projectAClients[0].client, presenceTopic, {
    id_mensaje: presenceId,
    operationId: presenceId,
    proyecto_id: projectA,
    client_id: 'browser-a0',
    usuario: 'E2E A0',
    conectado: true,
    clock: 3,
    revision: 3,
    actualizado_en: new Date().toISOString(),
    ttl_ms: 30000,
    vista_activa: 'canvas',
  }, { qos: 1, retain: true });
  await waitUntil(
    () => projectAClients.every((receiver) => messageCount(receiver, presenceId) === 1),
    'los cuatro clientes no recibieron la presencia',
  );

  const cursorId = `${runId}-cursor`;
  await publish(projectAClients[0].client, `${baseA}/cursor`, {
    id_mensaje: cursorId,
    operationId: cursorId,
    proyecto_id: projectA,
    client_id: 'browser-a0',
    usuario: 'E2E A0',
    x: 120,
    y: 80,
    clock: 4,
    actualizado_en: new Date().toISOString(),
    vista_activa: 'canvas',
  }, { qos: 0, retain: false });
  await waitUntil(
    () => projectAClients.every((receiver) => messageCount(receiver, cursorId) === 1),
    'los cuatro clientes no recibieron el cursor',
  );

  console.log('PROJECT_COLLABORATION_OK: 4 clientes, snapshot retenido, presencia, cursor y aislamiento A/B aprobados.');
} finally {
  const publisher = clients[0];
  // Limpieza best-effort de los mensajes retenidos creados con el projectId
  // único de esta ejecución. No se espera el PUBACK para que una caída del
  // broker durante el teardown no deje bloqueada la terminal.
  if (publisher?.connected && snapshotTopic) publisher.publish(snapshotTopic, '', { qos: 1, retain: true });
  if (publisher?.connected && presenceTopic) publisher.publish(presenceTopic, '', { qos: 1, retain: true });
  await closeClients();
}

// mqtt.js puede conservar un temporizador interno aun después de cerrar a la
// fuerza todos los sockets. Este script es un proceso E2E aislado: al terminar
// correctamente no debe quedarse ocupando la terminal del equipo de demo.
process.exit(0);
