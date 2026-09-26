interface SolicitudPython {
  codigo: string;
  inputs: Record<string, boolean | number | string>;
}

interface RespuestaPython {
  ok: boolean;
  value?: boolean | number | string;
  error?: string;
}

import { loadPyodide, type PyodideInterface } from 'pyodide';

let runtime: Promise<PyodideInterface> | undefined;

/** Pyodide y sus recursos WASM se sirven localmente desde public/pyodide. */
const obtenerRuntime = (): Promise<PyodideInterface> => {
  runtime ??= loadPyodide({ indexURL: `${self.location.origin}/pyodide/` });
  return runtime;
};

const serializarLiteralPython = (valor: unknown): string => JSON.stringify(JSON.stringify(valor));

self.onmessage = async (evento: MessageEvent<SolicitudPython>) => {
  try {
    const pyodide = await obtenerRuntime();
    const { codigo, inputs } = evento.data;
    const esFuncion = /^\s*def\s+calcular\s*\(/m.test(codigo);
    const preparacion = [
      'import json',
      `__hiles_inputs = json.loads(${serializarLiteralPython(inputs)})`,
      'globals().update(__hiles_inputs)',
    ].join('\n');
    const programa = esFuncion
      ? `${preparacion}\n${codigo}\n__hiles_result = calcular(**__hiles_inputs)\n__hiles_result`
      : `${preparacion}\n__hiles_result = (${codigo})\n__hiles_result`;
    const resultado = await pyodide.runPythonAsync(programa);
    if (typeof resultado !== 'boolean' && typeof resultado !== 'number' && typeof resultado !== 'string') {
      throw new Error('El código Python debe retornar boolean, número o texto.');
    }
    self.postMessage({ ok: true, value: resultado } satisfies RespuestaPython);
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'No fue posible ejecutar el código Python.',
    } satisfies RespuestaPython);
  }
};
