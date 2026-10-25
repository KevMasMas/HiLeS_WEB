interface SolicitudPython {
  codigo: string;
  inputs: Record<string, boolean | number | string>;
}

interface RespuestaPython {
  ok: boolean;
  value?: unknown;
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
      ? `${preparacion}\n${codigo}\n__hiles_result = calcular(**__hiles_inputs)\njson.dumps(__hiles_result)`
      : `${preparacion}\n__hiles_result = (${codigo})\njson.dumps(__hiles_result)`;
    const resultadoSerializado = await pyodide.runPythonAsync(programa);
    if (typeof resultadoSerializado !== 'string') {
      throw new Error('El código Python debe retornar un valor compatible con JSON.');
    }
    const resultado: unknown = JSON.parse(resultadoSerializado);
    self.postMessage({ ok: true, value: resultado } satisfies RespuestaPython);
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'No fue posible ejecutar el código Python.',
    } satisfies RespuestaPython);
  }
};
