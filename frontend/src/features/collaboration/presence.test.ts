import { describe, expect, it } from 'vitest';
import { codificarVista, decodificarSeleccion, estadoColaborador, iniciales } from './presence';

describe('presencia con selección', () => {
  it('codifica y decodifica la selección en vista_activa', () => {
    expect(codificarVista(null)).toBe('canvas');
    expect(codificarVista('block-a')).toBe('canvas#block-a');
    expect(decodificarSeleccion('canvas#block-a')).toBe('block-a');
    expect(decodificarSeleccion('canvas')).toBeNull();
    expect(decodificarSeleccion(null)).toBeNull();
    expect(decodificarSeleccion('simulacion')).toBeNull();
  });

  it('distingue activo, inactivo y desconectado', () => {
    const base = { clientId: 'c', usuario: 'Ana', color: '#000', vistaActiva: null, ttlMs: 30000 };
    const ahora = Date.parse('2026-10-28T12:00:30.000Z');
    expect(estadoColaborador({ ...base, conectado: true, actualizadoEn: '2026-10-28T12:00:25.000Z' }, ahora)).toBe('activo');
    expect(estadoColaborador({ ...base, conectado: true, actualizadoEn: '2026-10-28T12:00:00.000Z' }, ahora)).toBe('inactivo');
    expect(estadoColaborador({ ...base, conectado: false, actualizadoEn: '2026-10-28T12:00:29.000Z' }, ahora)).toBe('desconectado');
  });

  it('genera iniciales legibles', () => {
    expect(iniciales('Editor 123')).toBe('E1');
    expect(iniciales('Juan Ramos')).toBe('JR');
    expect(iniciales('Ana')).toBe('AN');
    expect(iniciales('  ')).toBe('?');
  });
});
