import { describe, expect, it } from 'vitest';
import { validarMensajeEstadoEjecutorV3 } from './messages';

const estadoPico = {
  protocol_version: 3,
  project_id: 'proyecto-hl950c',
  executor_id: 'pico:pico01w',
  tipo: 'pico',
  estado: 'online',
  capacidades: { ir_versions: [2], lenguajes: ['python', 'expresion'], max_fragment_bytes: 30000, max_elementos: 64 },
  last_seen_ms: 1000,
};

describe('validación del estado MQTT de ejecutores', () => {
  it('acepta el payload real de una Pico v3', () => {
    expect(validarMensajeEstadoEjecutorV3(estadoPico, {
      projectId: 'proyecto-hl950c', executorId: 'pico:pico01w',
    }).ok).toBe(true);
  });

  it('rechaza proyecto, tópico, protocolo y capacidades inconsistentes', () => {
    expect(validarMensajeEstadoEjecutorV3({ ...estadoPico, project_id: 'otro' }, {
      projectId: 'proyecto-hl950c', executorId: 'pico:pico01w',
    }).ok).toBe(false);
    expect(validarMensajeEstadoEjecutorV3(estadoPico, {
      projectId: 'proyecto-hl950c', executorId: 'pico:otra',
    }).ok).toBe(false);
    expect(validarMensajeEstadoEjecutorV3({ ...estadoPico, protocol_version: 2 }, {
      projectId: 'proyecto-hl950c', executorId: 'pico:pico01w',
    }).ok).toBe(false);
    expect(validarMensajeEstadoEjecutorV3({ ...estadoPico, capacidades: {} }, {
      projectId: 'proyecto-hl950c', executorId: 'pico:pico01w',
    }).ok).toBe(false);
  });
});
