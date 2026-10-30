import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..');
const fixturePath = path.join(repoRoot, 'docs', 'mqtt', 'vectores_v3', '01_fixtures_distribucion_v3.json');
const requireFromFrontend = createRequire(path.join(repoRoot, 'frontend', 'package.json'));

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.length ? value.join('=') : true];
}));
const mode = String(args.mode ?? 'memory');
const timeoutMs = Number(args.timeout ?? 8000);
const runId = `persona5-${Date.now()}-${randomUUID().slice(0, 8)}`;

if (!['memory', 'mqtt'].includes(mode)) {
  throw new Error('El argumento --mode debe ser memory o mqtt.');
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
  throw new Error('--timeout debe ser un número mayor o igual a 1000.');
}

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const baseScenario = fixture.escenarios.find((item) => item.nombre.startsWith('cuatro ejecutores'));
if (!baseScenario) throw new Error('No existe el fixture distribuido de cuatro ejecutores.');

const projectId = `${baseScenario.project_id}-${runId}`;
const deploymentId = `${baseScenario.deployment_id}-${runId}`;
const replaceIds = (raw) => raw
  .replaceAll(baseScenario.project_id, projectId)
  .replaceAll(baseScenario.deployment_id, deploymentId);
const fragments = Object.fromEntries(
  Object.entries(baseScenario.canonical_fragments).map(([executorId, raw]) => [executorId, replaceIds(raw)]),
);
const fragmentObjects = Object.fromEntries(Object.entries(fragments).map(([id, raw]) => [id, JSON.parse(raw)]));
const manifest = {
  ...baseScenario.manifest,
  project_id: projectId,
  deployment_id: deploymentId,
  fragments: baseScenario.manifest.fragments.map((summary) => {
    const raw = fragments[summary.executor_id];
    return {
      ...summary,
      fragment_id: `${deploymentId}:${summary.executor_id}`,
      hash: createHash('sha256').update(raw).digest('hex'),
      size_bytes: Buffer.byteLength(raw),
    };
  }),
  routes: baseScenario.manifest.routes.map((route) => ({ ...route, topic: replaceIds(route.topic) })),
};

const topicBase = `udfjc/hiles/v3/projects/${projectId}`;
const topics = {
  manifest: `${topicBase}/deployments/manifest`,
  fragment: (executorId) => `${topicBase}/deployments/${deploymentId}/fragments/${executorId}`,
  ack: (executorId) => `${topicBase}/deployments/${deploymentId}/ack/${executorId}`,
  channel: (connectionId) => `${topicBase}/deployments/${deploymentId}/channels/${connectionId}`,
  snapshot: (executorId) => `${topicBase}/deployments/${deploymentId}/snapshot/${executorId}`,
  status: (executorId) => `${topicBase}/executors/${executorId}/status`,
  command: `${topicBase}/deployments/${deploymentId}/command`,
  input: `${topicBase}/deployments/${deploymentId}/input`,
  error: `${topicBase}/deployments/${deploymentId}/error`,
};

const matches = (filter, topic) => {
  const filterParts = filter.split('/');
  const topicParts = topic.split('/');
  for (let index = 0; index < filterParts.length; index += 1) {
    if (filterParts[index] === '#') return true;
    if (topicParts[index] === undefined) return false;
    if (filterParts[index] !== '+' && filterParts[index] !== topicParts[index]) return false;
  }
  return filterParts.length === topicParts.length;
};

class MemoryBroker {
  retained = new Map();
  clients = new Set();

  async createClient(name, will) {
    const client = new MemoryClient(this, name, will);
    this.clients.add(client);
    return client;
  }

  deliver(topic, payload, options) {
    if (options.retain) {
      if (payload === '') this.retained.delete(topic);
      else this.retained.set(topic, payload);
    }
    for (const client of this.clients) client.deliver(topic, payload);
  }

  async close() {
    for (const client of this.clients) await client.end(true);
  }
}

class MemoryClient {
  filters = new Set();
  handlers = new Set();
  connected = true;

  constructor(broker, name, will) {
    this.broker = broker;
    this.name = name;
    this.will = will;
  }

  onMessage(handler) { this.handlers.add(handler); }
  async subscribe(filter) {
    this.filters.add(filter);
    for (const [topic, payload] of this.broker.retained) {
      if (matches(filter, topic)) queueMicrotask(() => this.deliver(topic, payload));
    }
  }
  async publish(topic, payload, options = {}) {
    if (!this.connected) throw new Error(`Cliente desconectado: ${this.name}`);
    this.broker.deliver(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), options);
  }
  deliver(topic, payload) {
    if (!this.connected || ![...this.filters].some((filter) => matches(filter, topic))) return;
    for (const handler of this.handlers) queueMicrotask(() => handler(topic, payload));
  }
  async end(abrupt = false) {
    if (!this.connected) return;
    this.connected = false;
    if (abrupt && this.will) this.broker.deliver(this.will.topic, this.will.payload, this.will);
  }
  async reconnect() { this.connected = true; }
}

const loadEnv = () => {
  const envPath = path.join(repoRoot, 'frontend', '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
};

class MqttBroker {
  constructor() {
    this.clients = [];
    const env = loadEnv();
    const protocol = env.VITE_MQTT_WS_PROTOCOL || 'ws';
    const host = env.VITE_MQTT_HOST || '127.0.0.1';
    const port = env.VITE_MQTT_WS_PORT || '9001';
    const wsPath = (env.VITE_MQTT_WS_PATH || '/mqtt').replace(/^([^/])/, '/$1');
    this.url = String(args.url ?? `${protocol}://${host}:${port}${wsPath}`);
    this.username = env.VITE_MQTT_USERNAME || undefined;
    this.password = env.VITE_MQTT_PASSWORD || undefined;
  }

  async createClient(name, will) {
    const mqtt = requireFromFrontend('mqtt');
    const raw = mqtt.connect(this.url, {
      clientId: `hiles-${runId}-${name.replaceAll(':', '-')}`,
      username: this.username,
      password: this.password,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: timeoutMs,
      will: will ? { topic: will.topic, payload: will.payload, qos: 1, retain: true } : undefined,
    });
    try {
      await new Promise((resolve, reject) => {
        raw.once('connect', resolve);
        raw.once('error', reject);
      });
    } catch (error) {
      raw.end(true);
      throw error;
    }
    const client = {
      raw,
      filters: new Set(),
      handlers: new Set(),
      connected: true,
      onMessage(handler) { this.handlers.add(handler); },
      async subscribe(filter) {
        await new Promise((resolve, reject) => raw.subscribe(filter, { qos: 1 }, (error) => error ? reject(error) : resolve()));
        this.filters.add(filter);
      },
      async publish(topic, payload, options = {}) {
        await new Promise((resolve, reject) => raw.publish(
          topic,
          typeof payload === 'string' ? payload : JSON.stringify(payload),
          { qos: options.qos ?? 1, retain: Boolean(options.retain) },
          (error) => error ? reject(error) : resolve(),
        ));
      },
      async end(abrupt = false) {
        if (!this.connected) return;
        await new Promise((resolve) => raw.end(Boolean(abrupt), {}, resolve));
        this.connected = false;
      },
      async reconnect() { throw new Error('La reconexión se prueba creando de nuevo el cliente MQTT.'); },
    };
    raw.on('message', (topic, bytes) => {
      for (const handler of client.handlers) handler(topic, bytes.toString());
    });
    this.clients.push(client);
    return client;
  }

  async close() { await Promise.all(this.clients.map((client) => client.end(false))); }
}

class VirtualExecutor {
  constructor(executorId, client) {
    this.executorId = executorId;
    this.client = client;
    this.fragment = null;
    this.manifest = null;
    this.pendingInput = undefined;
    this.currentValue = undefined;
    this.sequence = new Map();
    this.seen = new Set();
    this.stats = { accepted: 0, discarded: 0, snapshots: 0, reconnects: 0 };
  }

  async start() {
    this.client.onMessage((topic, payload) => void this.handle(topic, payload));
    await this.client.subscribe(topics.manifest);
    await this.client.subscribe(topics.fragment(this.executorId));
    await this.client.subscribe(topics.command);
    await this.client.subscribe(topics.input);
    await this.publishStatus('online');
  }

  async publishStatus(state) {
    await this.client.publish(topics.status(this.executorId), {
      protocol_version: 3,
      project_id: projectId,
      executor_id: this.executorId,
      tipo: this.executorId.startsWith('browser:') ? 'browser' : 'pico',
      estado: state,
      last_seen_ms: Date.now(),
      capacidades: { ir_versions: [2], lenguajes: ['python', 'expresion'], max_fragment_bytes: 31744, max_elementos: 64 },
    }, { qos: 1, retain: true });
  }

  async handle(topic, raw) {
    if (!raw) return;
    const message = JSON.parse(raw);
    if (topic === topics.manifest) {
      if (message.project_id !== projectId || message.epoch < (this.manifest?.epoch ?? 0)) return;
      this.manifest = message;
      if (!message.fragments.some((item) => item.executor_id === this.executorId)) this.fragment = null;
      return;
    }
    if (topic === topics.fragment(this.executorId)) {
      await this.acceptFragment(raw, message);
      return;
    }
    if (!this.fragment || message.project_id !== projectId || message.deployment_id !== deploymentId) return;
    if (topic === topics.input && this.fragment.modelo.elementos.some((item) => item.id === message.servicio_id && item.tipo === 'service')) {
      this.pendingInput = message.valor;
      return;
    }
    if (topic === topics.command && message.epoch === manifest.epoch) {
      if (message.command === 'step' || message.command === 'start') await this.step();
      if (message.command === 'reset') this.currentValue = undefined;
      if (message.command === 'stop') await this.publishStatus('ready');
      return;
    }
    const route = this.fragment.inbound_routes.find((item) => item.topic === topic);
    if (route) await this.acceptChannel(route, message);
  }

  async acceptFragment(raw, fragment) {
    const summary = this.manifest?.fragments.find((item) => item.executor_id === this.executorId);
    const hash = createHash('sha256').update(raw).digest('hex');
    const accepted = Boolean(summary)
      && fragment.executor_id === this.executorId
      && fragment.project_id === projectId
      && fragment.deployment_id === deploymentId
      && fragment.epoch === this.manifest.epoch
      && hash === summary.hash;
    if (accepted) {
      this.fragment = fragment;
      for (const route of fragment.inbound_routes) await this.client.subscribe(route.topic);
    }
    await this.client.publish(topics.ack(this.executorId), {
      protocol_version: 3, project_id: projectId, deployment_id: deploymentId,
      epoch: fragment.epoch, executor_id: this.executorId, fragment_id: fragment.fragment_id,
      accepted, fragment_hash: hash,
      ...(accepted ? {} : { error: { codigo: 'DISTRIBUCION_MODELO_INVALIDO', mensaje: 'Fragmento o hash inválido.' } }),
    }, { qos: 1, retain: false });
    if (accepted) await this.publishSnapshot();
  }

  async acceptChannel(route, message) {
    const duplicate = this.seen.has(message.message_id);
    const stale = message.epoch !== manifest.epoch || message.sequence <= (this.sequence.get(route.connection_id) ?? 0);
    const wrongOwner = message.owner_executor_id !== route.source_executor_id;
    if (duplicate || stale || wrongOwner) {
      this.stats.discarded += 1;
      return;
    }
    this.seen.add(message.message_id);
    this.sequence.set(route.connection_id, message.sequence);
    this.currentValue = message.value;
    this.stats.accepted += 1;
  }

  async step() {
    if (this.pendingInput !== undefined) {
      this.currentValue = this.pendingInput;
      this.pendingInput = undefined;
    }
    if (this.currentValue !== undefined && this.fragment.modelo.elementos.some((item) => item.tipo === 'functional_block')) {
      this.currentValue = typeof this.currentValue === 'number' ? this.currentValue + 1 : this.currentValue;
    }
    for (const route of this.fragment.outbound_routes) {
      const sequence = (this.sequence.get(route.connection_id) ?? 0) + 1;
      this.sequence.set(route.connection_id, sequence);
      await this.client.publish(route.topic, {
        protocol_version: 3, project_id: projectId, deployment_id: deploymentId, epoch: manifest.epoch,
        message_id: `${this.executorId}:${route.connection_id}:${sequence}`,
        connection_id: route.connection_id, owner_executor_id: this.executorId, sequence, value: this.currentValue,
      }, { qos: route.qos, retain: false });
    }
    await this.publishSnapshot();
  }

  async publishSnapshot() {
    this.stats.snapshots += 1;
    const elements = Object.fromEntries(this.fragment.modelo.elementos.map((item) => [item.id, { salida: this.currentValue ?? null }]));
    await this.client.publish(topics.snapshot(this.executorId), {
      protocol_version: 3, project_id: projectId, deployment_id: deploymentId, epoch: manifest.epoch,
      executor_id: this.executorId, sequence: this.stats.snapshots, elements,
    }, { qos: 1, retain: false });
  }
}

const waitUntil = (predicate, description) => new Promise((resolve, reject) => {
  const deadline = Date.now() + timeoutMs;
  const check = () => {
    if (predicate()) resolve();
    else if (Date.now() >= deadline) reject(new Error(`Tiempo agotado en ${description}`));
    else setTimeout(check, 20);
  };
  check();
});

const report = {
  run_id: runId,
  mode,
  project_id: projectId,
  deployment_id: deploymentId,
  started_at: new Date().toISOString(),
  stages: [],
  metrics: { heap_before_bytes: process.memoryUsage().heapUsed },
  limitations: mode === 'memory'
    ? ['Ejecución de integración sin broker de red ni placas físicas.']
    : ['Ejecución con broker real y ejecutores de protocolo simulados; no sustituye la prueba con Pico W.'],
};
const stage = (name, started, details = {}) => report.stages.push({ stage: name, ok: true, duration_ms: Date.now() - started, ...details });
const broker = mode === 'mqtt' ? new MqttBroker() : new MemoryBroker();
let monitor = null;
const received = [];
const workers = [];
let currentStage = 'conexion-broker';

try {
  monitor = await broker.createClient('monitor');
  monitor.onMessage((topic, payload) => received.push({ topic, payload: payload ? JSON.parse(payload) : null }));
  await monitor.subscribe(`${topicBase}/#`);
  currentStage = 'registro';
  let started = Date.now();
  for (const executorId of Object.keys(fragments)) {
    const will = {
      topic: topics.status(executorId),
      payload: JSON.stringify({ protocol_version: 3, project_id: projectId, executor_id: executorId, estado: 'offline', last_seen_ms: Date.now() }),
      qos: 1,
      retain: true,
    };
    const worker = new VirtualExecutor(executorId, await broker.createClient(executorId, will));
    workers.push(worker);
    await worker.start();
  }
  await waitUntil(() => received.filter((item) => item.topic.endsWith('/status')).length >= workers.length, 'registro de ejecutores');
  stage('registro', started, { executors: workers.map((item) => item.executorId) });

  currentStage = 'carga';
  started = Date.now();
  await monitor.publish(topics.manifest, manifest, { qos: 1, retain: true });
  for (const [executorId, raw] of Object.entries(fragments)) await monitor.publish(topics.fragment(executorId), raw, { qos: 1, retain: true });
  await waitUntil(() => received.filter((item) => item.topic.includes('/ack/')).length >= workers.length, 'ACK de fragmentos');
  const acks = received.filter((item) => item.topic.includes('/ack/')).map((item) => item.payload);
  if (!acks.every((ack) => ack.accepted)) throw new Error('Uno o más fragmentos fueron rechazados.');
  stage('carga', started, { accepted_acks: acks.length });

  currentStage = 'entrada-pasos-snapshots';
  started = Date.now();
  await monitor.publish(topics.input, {
    protocol_version: 3, project_id: projectId, deployment_id: deploymentId, epoch: manifest.epoch,
    servicio_id: 'service-a', valor: 5, id_mensaje: `${runId}:input:1`,
  }, { qos: 1, retain: false });
  for (let stepNumber = 1; stepNumber <= 4; stepNumber += 1) {
    await monitor.publish(topics.command, {
      protocol_version: 3, project_id: projectId, deployment_id: deploymentId, epoch: manifest.epoch,
      command: 'step', id_mensaje: `${runId}:step:${stepNumber}`,
    }, { qos: 1, retain: false });
    await new Promise((resolve) => setTimeout(resolve, mode === 'mqtt' ? 100 : 10));
  }
  const lastWorker = workers.find((item) => item.executorId === 'pico:d');
  await waitUntil(() => lastWorker?.currentValue === 6, 'propagación pico-browser-browser-pico');
  stage('entrada-pasos-snapshots', started, {
    input: 5,
    final_value: lastWorker.currentValue,
    snapshots: workers.reduce((sum, item) => sum + item.stats.snapshots, 0),
  });

  currentStage = 'epoca-y-deduplicacion';
  started = Date.now();
  const target = workers.find((item) => item.executorId === 'browser:c');
  const route = target.fragment.inbound_routes[0];
  const acceptedBefore = target.stats.accepted;
  const stale = {
    protocol_version: 3, project_id: projectId, deployment_id: deploymentId, epoch: 0,
    message_id: `${runId}:stale`, connection_id: route.connection_id,
    owner_executor_id: route.source_executor_id, sequence: 999, value: 999,
  };
  await monitor.publish(route.topic, stale, { qos: 1, retain: false });
  await monitor.publish(route.topic, stale, { qos: 1, retain: false });
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (target.stats.accepted !== acceptedBefore || target.currentValue === 999) throw new Error('Se aceptó un mensaje de época anterior.');
  stage('epoca-y-deduplicacion', started, { discarded: target.stats.discarded });

  currentStage = 'desconexion-recuperacion';
  started = Date.now();
  const disconnected = workers.find((item) => item.executorId === 'browser:c');
  await disconnected.client.end(true);
  await waitUntil(() => received.some((item) => item.topic === topics.status(disconnected.executorId) && item.payload?.estado === 'offline'), 'estado offline');
  if (mode === 'memory') {
    await disconnected.client.reconnect();
    disconnected.stats.reconnects += 1;
    await disconnected.publishStatus('online');
  }
  stage('desconexion-recuperacion', started, {
    executor_id: disconnected.executorId,
    recovery: mode === 'memory' ? 'reconnected' : 'offline-observed; live reconnect requires a new process',
  });

  currentStage = 'liberacion';
  started = Date.now();
  const released = { ...manifest, epoch: manifest.epoch + 1, fragments: [], owners: {}, routes: [] };
  await monitor.publish(topics.manifest, released, { qos: 1, retain: true });
  await waitUntil(() => workers.every((item) => item.fragment === null), 'liberación de fragmentos');
  stage('liberacion', started, { released_workers: workers.length });

  report.ok = true;
} catch (error) {
  report.ok = false;
  report.failure = {
    stage: currentStage,
    device: 'integration-runner',
    fragment: deploymentId,
    connection: manifest.routes.map((item) => item.connection_id).join(','),
    message: error instanceof Error ? error.message : String(error),
  };
} finally {
  report.finished_at = new Date().toISOString();
  report.metrics.heap_after_bytes = process.memoryUsage().heapUsed;
  report.metrics.total_duration_ms = Date.parse(report.finished_at) - Date.parse(report.started_at);
  report.workers = workers.map((item) => ({ executor_id: item.executorId, ...item.stats }));
  if (args.report) {
    const reportPath = path.resolve(repoRoot, String(args.report));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  if (mode === 'mqtt' && monitor) {
    for (const topic of [topics.manifest, ...Object.keys(fragments).map(topics.fragment), ...Object.keys(fragments).map(topics.status)]) {
      try { await monitor.publish(topic, '', { qos: 1, retain: true }); } catch { /* limpieza best-effort */ }
    }
  }
  await broker.close();
  console.log(JSON.stringify(report, null, 2));
}

if (!report.ok) process.exitCode = 1;
