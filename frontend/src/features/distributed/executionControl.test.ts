import { describe, expect, it } from 'vitest';
import type { ComandoDespliegueV3, MensajeEstadoEjecutorV3 } from '../../services/distributed/messages';
import type { ManifiestoDespliegueV3 } from '../../services/ir/tiposIrDistribuida';
import { comandoPermitido, crearControlEjecucionDistribuida } from './executionControl';

const manifest: ManifiestoDespliegueV3 = {
  protocol_version: 3,
  project_id: 'proyecto-hl950c',
  deployment_id: 'dep-1',
  epoch: 1,
  model_id: 'modelo',
  model_version: 1,
  owners: { a: 'pico:pico01w', b: 'pico:pico02w' },
  fragments: [
    { fragment_id: 'dep-1:pico:pico01w', executor_id: 'pico:pico01w', hash: 'a', size_bytes: 10, element_ids: ['a'] },
    { fragment_id: 'dep-1:pico:pico02w', executor_id: 'pico:pico02w', hash: 'b', size_bytes: 10, element_ids: ['b'] },
  ],
  routes: [],
};

const estado = (executorId: string, valor: MensajeEstadoEjecutorV3['estado']): MensajeEstadoEjecutorV3 => ({
  protocol_version: 3,
  project_id: 'proyecto-hl950c',
  executor_id: executorId,
  tipo: 'pico',
  estado: valor,
  capacidades: { ir_versions: [2], lenguajes: ['python', 'expresion'], max_fragment_bytes: 30000, max_elementos: 64 },
  last_seen_ms: 1,
});

const ack = (executorId: string) => ({
  protocol_version: 3 as const,
  project_id: 'proyecto-hl950c',
  deployment_id: 'dep-1',
  epoch: 1,
  executor_id: executorId,
  fragment_id: `dep-1:${executorId}`,
  accepted: true,
  fragment_hash: executorId,
});

const base = {
  conectado: true,
  manifest,
  acks: {
    'pico:pico01w': ack('pico:pico01w'),
    'pico:pico02w': ack('pico:pico02w'),
  },
  ejecutores: {
    'pico:pico01w': estado('pico:pico01w', 'ready'),
    'pico:pico02w': estado('pico:pico02w', 'ready'),
  },
  desplegando: false,
  ejecutando: false,
  errorLocal: null,
};

describe('fachada única de ejecución distribuida', () => {
  it('bloquea todos los comandos antes de completar el despliegue', () => {
    const control = crearControlEjecucionDistribuida({ ...base, manifest: null, acks: {} });
    const comandos: ComandoDespliegueV3[] = ['start', 'step', 'stop', 'reset'];
    expect(control.fase.fase).toBe('sin_despliegue');
    expect(comandos.every((comando) => !comandoPermitido(control, comando))).toBe(true);
  });

  it('habilita iniciar y paso cuando todos los fragmentos tienen ACK', () => {
    const control = crearControlEjecucionDistribuida(base);
    expect(control.fase.fase).toBe('listo');
    expect(control).toMatchObject({ puedeIniciar: true, puedeAvanzar: true, puedeDetener: true, puedeReiniciar: true });
  });

  it('deriva ejecución desde los estados reales y evita iniciar dos veces', () => {
    const control = crearControlEjecucionDistribuida({
      ...base,
      ejecutores: {
        'pico:pico01w': estado('pico:pico01w', 'running'),
        'pico:pico02w': estado('pico:pico02w', 'running'),
      },
    });
    expect(control.fase.fase).toBe('ejecutando');
    expect(control).toMatchObject({ puedeIniciar: false, puedeAvanzar: false, puedeDetener: true, puedeReiniciar: true });
  });

  it('bloquea la operación si un destino está desconectado', () => {
    const control = crearControlEjecucionDistribuida({
      ...base,
      ejecutores: { ...base.ejecutores, 'pico:pico02w': estado('pico:pico02w', 'offline') },
    });
    expect(control.fase.fase).toBe('error');
    expect(control.puedeIniciar).toBe(false);
    expect(control.motivoBloqueo).toMatch(/desconectado/);
  });
});
