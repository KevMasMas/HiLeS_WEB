import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BrowserWorker,
  MotorFragmentoNavegador,
  PREFIJO_PROXY_REMOTO,
  construirModeloEjecutable,
  sha256Texto,
  type OpcionesPublicacionV3,
  type RelojWorker,
  type TransporteWorkerV3,
} from './BrowserWorker';
import { topicsDistribuidosV3 } from './topics';
import type { FragmentoDespliegueV3, ManifiestoDespliegueV3 } from '../ir/tiposIrDistribuida';

const RAIZ = resolve(__dirname, '../../../../docs/mqtt/vectores_v3');

interface EscenarioV3 {
  nombre: string;
  project_id: string;
  deployment_id: string;
  epoch: number;
  manifest: ManifiestoDespliegueV3;
  fragments: FragmentoDespliegueV3[];
  canonical_fragments: Record<string, string>;
}

interface CasoParidad {
  escenario: string;
  executor_id: string;
  estado_inicial: Record<string, unknown>;
  pasos: Array<{
    remotos: Record<string, number>;
    avance_tiempo_ms: number;
    elementos_esperados: Record<string, unknown>;
    salidas_remotas: Array<{ connection_id: string; value: unknown }>;
  }>;
}

const vector01 = JSON.parse(readFileSync(resolve(RAIZ, '01_fixtures_distribucion_v3.json'), 'utf8')) as { escenarios: EscenarioV3[] };
const vector02 = JSON.parse(readFileSync(resolve(RAIZ, '02_paridad_worker_navegador.json'), 'utf8')) as { casos: CasoParidad[] };

const escenario = (nombre: string): EscenarioV3 => vector01.escenarios.find((item) => item.nombre === nombre)!;
const TRES = 'tres ejecutores: Pico y dos navegadores';

/** Broker en memoria con retained, comodines `+` y entrega al propio publicador. */
class FakeBroker {
  readonly retained = new Map<string, string>();
  readonly publicados: Array<{ topic: string; payload: string; opciones: OpcionesPublicacionV3; cliente: FakeTransporte }> = [];
  readonly clientes = new Set<FakeTransporte>();

  publicar(cliente: FakeTransporte, topic: string, payload: string, opciones: OpcionesPublicacionV3): void {
    this.publicados.push({ topic, payload, opciones, cliente });
    if (opciones.retain) {
      if (payload === '') this.retained.delete(topic);
      else this.retained.set(topic, payload);
    }
    this.clientes.forEach((destino) => destino.entregarSiCoincide(topic, payload));
  }

  publicadosEn(topic: string): Array<Record<string, unknown>> {
    return this.publicados.filter((item) => item.topic === topic && item.payload !== '').map((item) => JSON.parse(item.payload) as Record<string, unknown>);
  }
}

const coincide = (filtro: string, topic: string): boolean => {
  const a = filtro.split('/');
  const b = topic.split('/');
  return a.length === b.length && a.every((segmento, indice) => segmento === '+' || segmento === b[indice]);
};

class FakeTransporte implements TransporteWorkerV3 {
  conectado = true;
  readonly filtros = new Set<string>();
  private readonly handlers = new Set<(topic: string, raw: string) => void>();
  private readonly conexion = new Set<(conectado: boolean) => void>();
  private readonly broker: FakeBroker;
  constructor(broker: FakeBroker) {
    this.broker = broker;
    broker.clientes.add(this);
  }

  publicar(topic: string, payload: string, opciones: OpcionesPublicacionV3): boolean {
    if (!this.conectado) return false;
    this.broker.publicar(this, topic, payload, opciones);
    return true;
  }

  suscribir(topic: string): void {
    this.filtros.add(topic);
    this.broker.retained.forEach((payload, retenido) => {
      if (coincide(topic, retenido)) this.handlers.forEach((handler) => handler(retenido, payload));
    });
  }

  desuscribir(topic: string): void {
    this.filtros.delete(topic);
  }

  onMensaje(handler: (topic: string, raw: string) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConexion(handler: (conectado: boolean) => void): () => void {
    this.conexion.add(handler);
    return () => this.conexion.delete(handler);
  }

  entregarSiCoincide(topic: string, payload: string): void {
    if (!this.conectado) return;
    if ([...this.filtros].some((filtro) => coincide(filtro, topic))) {
      this.handlers.forEach((handler) => handler(topic, payload));
    }
  }

  cambiarConexion(conectado: boolean): void {
    this.conectado = conectado;
    this.conexion.forEach((handler) => handler(conectado));
  }
}

class RelojManual implements RelojWorker {
  ahora = 0;
  intervalos = new Map<number, { fn: () => void; ms: number; proximo: number }>();
  private siguienteId = 1;
  ahoraMs(): number {
    return this.ahora;
  }
  programarIntervalo(fn: () => void, ms: number): unknown {
    const id = this.siguienteId++;
    this.intervalos.set(id, { fn, ms, proximo: this.ahora + ms });
    return id;
  }
  cancelarIntervalo(handle: unknown): void {
    this.intervalos.delete(handle as number);
  }
  avanzar(ms: number): void {
    const destino = this.ahora + ms;
    for (;;) {
      const vencido = [...this.intervalos.values()].filter((item) => item.proximo <= destino).sort((a, b) => a.proximo - b.proximo)[0];
      if (!vencido) break;
      this.ahora = vencido.proximo;
      vencido.proximo += vencido.ms;
      vencido.fn();
    }
    this.ahora = destino;
  }
}

interface Montaje {
  broker: FakeBroker;
  transporte: FakeTransporte;
  reloj: RelojManual;
  worker: BrowserWorker;
  esc: EscenarioV3;
}

const montar = (nombre = TRES, sessionId = 'b'): Montaje => {
  const esc = escenario(nombre);
  const broker = new FakeBroker();
  const transporte = new FakeTransporte(broker);
  const reloj = new RelojManual();
  const worker = new BrowserWorker({ projectId: esc.project_id, sessionId, transporte, reloj, intervaloPasoMs: 1000 });
  worker.iniciar();
  return { broker, transporte, reloj, worker, esc };
};

/** Simula al navegador de control: publica manifiesto y fragmento retenidos. */
const desplegar = async (m: Montaje, executorId = 'browser:b', raw?: string, manifiesto?: ManifiestoDespliegueV3): Promise<void> => {
  const controlador = new FakeTransporte(m.broker);
  const { esc } = m;
  controlador.publicar(topicsDistribuidosV3.manifest(esc.project_id), JSON.stringify(manifiesto ?? esc.manifest), { qos: 1, retain: true });
  controlador.publicar(
    topicsDistribuidosV3.fragment(esc.project_id, esc.deployment_id, executorId),
    raw ?? esc.canonical_fragments[executorId],
    { qos: 1, retain: true },
  );
  await m.worker.esperarInactividad();
};

const enviarCanal = async (m: Montaje, cambios: Record<string, unknown> = {}): Promise<void> => {
  const { esc } = m;
  const mensaje = {
    protocol_version: 3,
    project_id: esc.project_id,
    deployment_id: esc.deployment_id,
    epoch: esc.epoch,
    message_id: `pico:a:conn-b-c:${String(cambios.sequence ?? 1)}`,
    connection_id: 'conn-b-c',
    owner_executor_id: 'pico:a',
    sequence: 1,
    value: 2,
    ...cambios,
  };
  new FakeTransporte(m.broker).publicar(topicsDistribuidosV3.channel(esc.project_id, esc.deployment_id, String(mensaje.connection_id)), JSON.stringify(mensaje), { qos: 1, retain: false });
  await m.worker.esperarInactividad();
};

const comando = async (m: Montaje, command: string): Promise<void> => {
  const { esc } = m;
  new FakeTransporte(m.broker).publicar(
    topicsDistribuidosV3.command(esc.project_id, esc.deployment_id),
    JSON.stringify({ protocol_version: 3, project_id: esc.project_id, deployment_id: esc.deployment_id, epoch: esc.epoch, command }),
    { qos: 1, retain: false },
  );
  await m.worker.esperarInactividad();
};

describe('BrowserWorker — paridad con el motor MicroPython de la Pico', () => {
  it('reproduce paso a paso el vector 02 generado con firmware/pico/hiles/engine_v2.py', async () => {
    expect(vector02.casos.length).toBeGreaterThanOrEqual(2);
    for (const caso of vector02.casos) {
      const fragmento = escenario(caso.escenario).fragments.find((item) => item.executor_id === caso.executor_id)!;
      const salidas: Array<{ connection_id: string; value: unknown }> = [];
      const motor = new MotorFragmentoNavegador(fragmento, (ruta, value) => salidas.push({ connection_id: ruta.connection_id, value }));
      expect(motor.snapshot(), `${caso.escenario} inicial`).toEqual(caso.estado_inicial);
      for (const [indice, paso] of caso.pasos.entries()) {
        Object.entries(paso.remotos).forEach(([conexion, valor]) => motor.inyectarRemoto(conexion, valor));
        salidas.length = 0;
        await motor.paso(paso.avance_tiempo_ms);
        expect(motor.snapshot(), `${caso.escenario} paso ${indice + 1}`).toEqual(paso.elementos_esperados);
        expect(salidas, `${caso.escenario} salidas paso ${indice + 1}`).toEqual(paso.salidas_remotas);
      }
    }
  });

  it('agrega un proxy por ruta de entrada sin exponerlo en el snapshot', () => {
    const fragmento = escenario(TRES).fragments.find((item) => item.executor_id === 'browser:b')!;
    const modelo = construirModeloEjecutable(fragmento);
    expect(modelo.elementos.map((item) => item.id)).toContain(`${PREFIJO_PROXY_REMOTO}conn-b-c`);
    const motor = new MotorFragmentoNavegador(fragmento, () => undefined);
    expect(Object.keys(motor.snapshot())).toEqual(['hold-c']);
  });

  it('el hash SHA-256 de los bytes canónicos coincide con el manifiesto de Persona 1', async () => {
    const esc = escenario(TRES);
    const resumen = esc.manifest.fragments.find((item) => item.executor_id === 'browser:b')!;
    expect(await sha256Texto(esc.canonical_fragments['browser:b'])).toBe(resumen.hash);
  });
});

describe('BrowserWorker — contrato v3', () => {
  it('anuncia su estado retenido con identidad independiente del colaborador', () => {
    const m = montar();
    const estado = m.broker.publicadosEn(topicsDistribuidosV3.executorStatus(m.esc.project_id, 'browser:b')).at(-1)!;
    expect(estado).toMatchObject({ executor_id: 'browser:b', tipo: 'browser', estado: 'online', protocol_version: 3 });
    expect(m.broker.retained.has(topicsDistribuidosV3.executorStatus(m.esc.project_id, 'browser:b'))).toBe(true);
    const will = BrowserWorker.payloadUltimaVoluntad(m.esc.project_id, 'b');
    expect(JSON.parse(will.payload)).toMatchObject({ estado: 'offline', executor_id: 'browser:b' });
  });

  it('acepta solo su fragmento, verifica el hash y publica ACK y snapshot', async () => {
    const m = montar();
    await desplegar(m);
    const ack = m.broker.publicadosEn(topicsDistribuidosV3.ack(m.esc.project_id, m.esc.deployment_id, 'browser:b')).at(-1)!;
    expect(ack).toMatchObject({ accepted: true, executor_id: 'browser:b', fragment_id: 'deploy-3:browser:b' });
    expect(m.worker.estado).toBe('ready');
    expect(m.worker.stats.ownedElementIds).toEqual(['hold-c']);
    const snapshot = m.broker.publicadosEn(topicsDistribuidosV3.snapshot(m.esc.project_id, m.esc.deployment_id, 'browser:b')).at(-1)!;
    expect(snapshot.elements).toEqual({ 'hold-c': { evento_pendiente: false } });
    // El fragmento de otro navegador nunca llega a este worker.
    expect([...m.transporte.filtros].some((filtro) => filtro.endsWith('/fragments/browser:c'))).toBe(false);
  });

  it('rechaza un hash alterado y conserva el fragmento anterior', async () => {
    const m = montar();
    await desplegar(m);
    const activo = m.worker.activeFragment;
    const manipulado = m.esc.canonical_fragments['browser:b'].replace('"hold-c"', '"hold-x"');
    const manifiestoNuevo = { ...m.esc.manifest, epoch: 2 };
    await desplegar(m, 'browser:b', manipulado.replace('"epoch":1', '"epoch":2'), manifiestoNuevo);
    const acks = m.broker.publicadosEn(topicsDistribuidosV3.ack(m.esc.project_id, m.esc.deployment_id, 'browser:b'));
    expect(acks.at(-1)).toMatchObject({ accepted: false, error: { codigo: 'DISTRIBUCION_MODELO_INVALIDO' } });
    expect(m.worker.activeFragment).toBe(activo);
  });

  it('rechaza un fragmento dirigido a otro ejecutor', async () => {
    const m = montar(TRES, 'c');
    const raw = m.esc.canonical_fragments['browser:b'];
    const controlador = new FakeTransporte(m.broker);
    controlador.publicar(topicsDistribuidosV3.manifest(m.esc.project_id), JSON.stringify(m.esc.manifest), { qos: 1, retain: true });
    // Se publica el fragmento de b en el tópico de c para simular un error del controlador.
    controlador.publicar(topicsDistribuidosV3.fragment(m.esc.project_id, m.esc.deployment_id, 'browser:c'), raw, { qos: 1, retain: true });
    await m.worker.esperarInactividad();
    const ack = m.broker.publicadosEn(topicsDistribuidosV3.ack(m.esc.project_id, m.esc.deployment_id, 'browser:c')).at(-1)!;
    expect(ack).toMatchObject({ accepted: false, error: { codigo: 'DISTRIBUCION_ASIGNACION_INVALIDA' } });
    expect(m.worker.activeFragment).toBeNull();
  });

  it('valida canales en el orden del contrato y descarta duplicados, atrasados y ajenos', async () => {
    const m = montar();
    await desplegar(m);
    await enviarCanal(m, { sequence: 1, message_id: 'm1', value: 2 });
    await enviarCanal(m, { sequence: 1, message_id: 'm1', value: 2 }); // duplicado
    await enviarCanal(m, { sequence: 2, message_id: 'm2', epoch: 9, value: 5 }); // otra época
    await enviarCanal(m, { sequence: 3, message_id: 'm3', owner_executor_id: 'browser:x', value: 5 }); // propietario
    await enviarCanal(m, { sequence: 4, message_id: 'm4', value: 'texto' }); // tipo
    expect(m.worker.stats.channelsAccepted).toBe(1);
    expect(m.worker.stats.channelsDiscarded).toBe(4);
    const errores = m.broker.publicadosEn(topicsDistribuidosV3.error(m.esc.project_id, m.esc.deployment_id)).map((item) => item.codigo);
    expect(errores).toEqual(['CANAL_PROPIETARIO_INVALIDO', 'VALOR_TIPO_INVALIDO']);
    await comando(m, 'step');
    const snapshot = m.broker.publicadosEn(topicsDistribuidosV3.snapshot(m.esc.project_id, m.esc.deployment_id, 'browser:b')).at(-1)!;
    expect(snapshot.elements).toEqual({ 'hold-c': { valor_retenido: 2, salida: 2, evento_pendiente: true } });
  });

  it('publica salidas remotas una sola vez y nunca las consume de vuelta (sin eco)', async () => {
    const m = montar();
    await desplegar(m);
    await enviarCanal(m, { sequence: 1, message_id: 'm1', value: 7 });
    await comando(m, 'step');
    await comando(m, 'step');
    const topicSalida = topicsDistribuidosV3.channel(m.esc.project_id, m.esc.deployment_id, 'conn-c-d');
    const salidas = m.broker.publicadosEn(topicSalida);
    expect(salidas).toHaveLength(1);
    expect(salidas[0]).toMatchObject({ connection_id: 'conn-c-d', owner_executor_id: 'browser:b', sequence: 1, value: 7, message_id: 'browser:b:conn-c-d:1' });
    expect(m.transporte.filtros.has(topicSalida)).toBe(false);
    expect(m.worker.stats.channelsAccepted).toBe(1);
  });

  it('ejecuta con start/stop por intervalos y reinicia el estado con reset', async () => {
    const m = montar();
    await desplegar(m);
    await enviarCanal(m, { sequence: 1, message_id: 'm1', value: 3 });
    await comando(m, 'start');
    expect(m.worker.estado).toBe('running');
    m.reloj.avanzar(3000);
    await m.worker.esperarInactividad();
    expect(m.worker.stats.steps).toBeGreaterThanOrEqual(1);
    await comando(m, 'stop');
    expect(m.worker.estado).toBe('ready');
    const pasos = m.worker.stats.steps;
    m.reloj.avanzar(3000);
    await m.worker.esperarInactividad();
    expect(m.worker.stats.steps).toBe(pasos);
    await comando(m, 'reset');
    expect(m.worker.motor?.snapshot()).toEqual({ 'hold-c': { evento_pendiente: false } });
  });

  it('libera el fragmento con un manifiesto vacío o una época que ya no lo incluye', async () => {
    const m = montar();
    await desplegar(m);
    const sinMi = { ...m.esc.manifest, epoch: 2, fragments: m.esc.manifest.fragments.filter((item) => item.executor_id !== 'browser:b') };
    new FakeTransporte(m.broker).publicar(topicsDistribuidosV3.manifest(m.esc.project_id), JSON.stringify(sinMi), { qos: 1, retain: true });
    await m.worker.esperarInactividad();
    expect(m.worker.activeFragment).toBeNull();
    expect(m.worker.estado).toBe('online');

    const m2 = montar();
    await desplegar(m2);
    new FakeTransporte(m2.broker).publicar(topicsDistribuidosV3.manifest(m2.esc.project_id), '', { qos: 1, retain: true });
    await m2.worker.esperarInactividad();
    expect(m2.worker.activeFragment).toBeNull();
  });

  it('resincroniza tras perder el broker antes de aceptar canales', async () => {
    const m = montar();
    await desplegar(m);
    m.transporte.cambiarConexion(false);
    expect(m.worker.estado).toBe('degraded');
    m.transporte.cambiarConexion(true);
    expect(m.worker.estado).toBe('deploying');
    await enviarCanal(m, { sequence: 1, message_id: 'm1', value: 2 });
    expect(m.worker.stats.channelsAccepted).toBe(0);
    // El fragmento retenido vuelve a llegar: ACK idempotente y fin de la resincronización.
    m.transporte.suscribir(`udfjc/hiles/v3/projects/${m.esc.project_id}/deployments/+/fragments/browser:b`);
    await m.worker.esperarInactividad();
    expect(m.worker.estado).toBe('ready');
    await enviarCanal(m, { sequence: 2, message_id: 'm2', value: 2 });
    expect(m.worker.stats.channelsAccepted).toBe(1);
  });

  it('las entradas externas solo afectan Services propios', async () => {
    const m = montar('dos ejecutores: Pico y navegador');
    await desplegar(m);
    const entrada = (servicio: string) => new FakeTransporte(m.broker).publicar(
      topicsDistribuidosV3.input(m.esc.project_id, m.esc.deployment_id),
      JSON.stringify({ protocol_version: 3, project_id: m.esc.project_id, deployment_id: m.esc.deployment_id, epoch: 1, servicio_id: servicio, valor: 1 }),
      { qos: 1, retain: false },
    );
    entrada('service-a'); // pertenece a pico:a
    await m.worker.esperarInactividad();
    expect(m.broker.publicadosEn(topicsDistribuidosV3.error(m.esc.project_id, m.esc.deployment_id))).toEqual([]);
  });

  it('detener publica offline y deja de escuchar', () => {
    const m = montar();
    m.worker.detener();
    const estado = m.broker.publicadosEn(topicsDistribuidosV3.executorStatus(m.esc.project_id, 'browser:b')).at(-1)!;
    expect(estado.estado).toBe('offline');
    expect(m.transporte.filtros.size).toBe(0);
  });
});
