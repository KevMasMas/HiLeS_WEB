import { describe, expect, it } from 'vitest';
import { claseColorRuntime } from './runtimeColor';

describe('color semántico del valor runtime', () => {
  it('pinta colores de tráfico en español o inglés sin afectar otros valores', () => {
    expect(claseColorRuntime(' verde ')).toBe('is-verde');
    expect(claseColorRuntime('YELLOW')).toBe('is-amarillo');
    expect(claseColorRuntime('rojo')).toBe('is-rojo');
    expect(claseColorRuntime('sur')).toBe('');
    expect(claseColorRuntime(3)).toBe('');
  });
});
