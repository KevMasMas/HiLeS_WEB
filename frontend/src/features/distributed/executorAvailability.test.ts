import { describe, expect, it } from 'vitest';
import type { MensajeEstadoEjecutorV3 } from '../../services/distributed/messages';
import { evaluarDisponibilidadEjecutor, UMBRAL_EJECUTOR_OBSOLETO_MS } from './executorAvailability';

const pico = (estado: MensajeEstadoEjecutorV3['estado'] = 'online'): MensajeEstadoEjecutorV3 => ({
  protocol_version: 3,
  project_id: 'proyecto-hl950c',
  executor_id: 'pico:pico01w',
  tipo: 'pico',
  estado,
  capacidades: {
    ir_versions: [2],
    lenguajes: ['python', 'expresion'],
    max_fragment_bytes: 30000,
    max_elementos: 64,
    memoria_libre_bytes: 60000,
  },
  last_seen_ms: 1234,
});

describe('disponibilidad centralizada de ejecutores', () => {
  it('habilita una Pico online del proyecto activo', () => {
    expect(evaluarDisponibilidadEjecutor(pico(), {
      projectId: 'proyecto-hl950c', recibidoEn: 99_000, ahora: 100_000,
    })).toMatchObject({ visible: true, seleccionable: true, desplegable: true, motivo: null });
  });

  it('no mezcla proyectos ni usa el reloj de uptime de la Pico como hora del navegador', () => {
    expect(evaluarDisponibilidadEjecutor(pico(), {
      projectId: 'otro-proyecto', recibidoEn: 99_000, ahora: 100_000,
    }).motivo).toBe('proyecto_distinto');
    expect(evaluarDisponibilidadEjecutor(pico(), {
      projectId: 'proyecto-hl950c', recibidoEn: 100_000 - UMBRAL_EJECUTOR_OBSOLETO_MS - 1, ahora: 100_000,
    }).motivo).toBe('obsoleto');
  });

  it('conserva visibles pero deshabilita ejecutores offline o degradados', () => {
    for (const estado of ['offline', 'degraded'] as const) {
      expect(evaluarDisponibilidadEjecutor(pico(estado), {
        projectId: 'proyecto-hl950c', recibidoEn: 99_000, ahora: 100_000,
      })).toMatchObject({ visible: true, seleccionable: false, desplegable: false, motivo: estado });
    }
  });

  it('permite seleccionar un ejecutor que está desplegando pero impide otro despliegue', () => {
    expect(evaluarDisponibilidadEjecutor(pico('deploying'), {
      projectId: 'proyecto-hl950c', recibidoEn: 99_000, ahora: 100_000,
    })).toMatchObject({ seleccionable: true, desplegable: false, motivo: 'deploying' });
  });
});
