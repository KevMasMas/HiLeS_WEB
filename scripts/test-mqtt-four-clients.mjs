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
const topic = 'udfjc/hiles/v1/equipo1/pico01/simulacion/estado';
const testId = `prueba-cuatro-clientes-${Date.now()}`;
const clients = [];
const received = new Set();

const connectClient = (index) => new Promise((resolve, reject) => {
  const client = mqtt.connect(url, {
    username: env.VITE_MQTT_USERNAME || undefined,
    password: env.VITE_MQTT_PASSWORD || undefined,
    clientId: `hiles-prueba-${index}-${Date.now()}`,
    reconnectPeriod: 0,
    connectTimeout: 5000,
    clean: true,
  });
  clients.push(client);
  client.once('error', reject);
  client.once('connect', () => {
    client.subscribe(topic, { qos: 1 }, (error) => error ? reject(error) : resolve(client));
  });
  client.on('message', (_topic, payload) => {
    try {
      const message = JSON.parse(payload.toString());
      if (message.id_mensaje === testId) received.add(index);
    } catch {
      // Esta prueba ignora mensajes retenidos antiguos; solo cuenta su payload.
    }
  });
});

const closeClients = () => Promise.all(clients.map((client) => new Promise((resolve) => {
  client.end(true, {}, resolve);
})));

try {
  const connected = await Promise.all([0, 1, 2, 3].map(connectClient));
  const payload = JSON.stringify({
    modelo_id: 'prueba-cuatro-clientes',
    version: 1,
    secuencia: 0,
    estado: 'lista',
    elementos: {},
    id_mensaje: testId,
  });
  await new Promise((resolve, reject) => {
    connected[0].publish(topic, payload, { qos: 1, retain: false }, (error) => error ? reject(error) : resolve());
  });
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const check = () => {
      if (received.size === 4) resolve();
      else if (Date.now() >= deadline) reject(new Error(`solo recibieron ${received.size} de 4 clientes`));
      else setTimeout(check, 25);
    };
    check();
  });
  console.log('MQTT_CUATRO_CLIENTES_OK: 4 de 4 recibieron el mismo estado JSON.');
} finally {
  await closeClients();
}
