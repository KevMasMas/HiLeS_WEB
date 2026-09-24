import { afterEach, describe, expect, it, vi } from 'vitest';
import { ejecutarJS, ejecutarPython, ErrorEjecucionCodigo, TIEMPO_MAXIMO_MS } from '../EjecutorCodigo';

const WorkerOriginal = globalThis.Worker;

class WorkerRespuesta {
  onmessage: ((evento: MessageEvent<{ ok: boolean; value?: boolean; error?: string }>) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();

  postMessage(mensaje: { inputs: { humedad?: number } }): void {
    queueMicrotask(() => this.onmessage?.({
      data: { ok: true, value: (mensaje.inputs.humedad ?? 0) < 76 },
    } as MessageEvent<{ ok: boolean; value?: boolean; error?: string }>));
  }
}

class WorkerSinRespuesta extends WorkerRespuesta {
  override postMessage(): void {}
}

afterEach(() => {
  vi.useRealTimers();
  Object.assign(globalThis, { Worker: WorkerOriginal });
});

describe('EjecutorCodigo', () => {
  it('evalúa una expresión simple con variables directas', () => {
    expect(ejecutarJS('humedad < 76', { humedad: 70 })).toBe(true);
    expect(ejecutarJS('humedad < 76', { humedad: 80 })).toBe(false);
  });

  it('evalúa una función completa mediante Worker', async () => {
    Object.assign(globalThis, { Worker: WorkerRespuesta });
    await expect(ejecutarJS('function calcular({ humedad }) { return humedad < 76; }', { humedad: 70 })).resolves.toBe(true);
  });

  it('envía código Python y entradas al Worker de Pyodide', async () => {
    Object.assign(globalThis, { Worker: WorkerRespuesta });
    await expect(ejecutarPython('def calcular(humedad):\n    return humedad < 76', { humedad: 70 })).resolves.toBe(true);
  });

  it.each(['fetch("https://example.com")', 'window.alert(1)', 'Function("return 1")()'])(
    'bloquea código restringido: %s',
    (codigo) => expect(() => ejecutarJS(codigo)).toThrow(ErrorEjecucionCodigo),
  );

  it('termina un Worker que supera el segundo de ejecución', async () => {
    vi.useFakeTimers();
    Object.assign(globalThis, { Worker: WorkerSinRespuesta });
    const ejecucion = ejecutarJS('while(true){}');
    const rechazoEsperado = expect(ejecucion).rejects.toThrow(`La ejecución superó el límite de ${TIEMPO_MAXIMO_MS} ms.`);
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_MS);
    await rechazoEsperado;
  });
});
