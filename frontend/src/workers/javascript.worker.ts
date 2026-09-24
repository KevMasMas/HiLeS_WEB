import { construirCuerpoJS, ErrorEjecucionCodigo } from '../engine/EjecutorCodigo';
import type { EntradasRuntime } from '../engine/EjecutorCodigo';

interface SolicitudWorker { codigo: string; inputs: EntradasRuntime; }
interface RespuestaWorker { ok: boolean; value?: boolean | number | string; error?: string; }

const nombresBloqueados = [
  'window', 'document', 'globalThis', 'self', 'navigator', 'location',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'require', 'process',
];
const identificador = /^[A-Za-z_$][\w$]*$/;
const patronesBloqueados = [
  /\b(?:window|document|globalThis|self|navigator|location)\b/i,
  /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/i,
  /\b(?:eval|import|require|process|constructor|prototype)\b/i,
  /\bFunction\b/,
];

const ejecutar = ({ codigo, inputs }: SolicitudWorker): boolean | number | string => {
  if (patronesBloqueados.some((patron) => patron.test(codigo))) {
    throw new ErrorEjecucionCodigo('El código contiene una operación no permitida en el sandbox.');
  }
  const valores = Object.fromEntries(Object.entries(inputs).filter(([, valor]) => valor !== undefined)) as Record<string, boolean | number | string>;
  const nombres = Object.keys(valores).filter((nombre) => identificador.test(nombre) && nombre !== 'inputs' && !nombresBloqueados.includes(nombre));
  const parametros = [...nombres, 'inputs', ...nombresBloqueados];
  const funcion = new Function(...parametros, construirCuerpoJS(codigo)) as (...argumentos: unknown[]) => unknown;
  const resultado = funcion(...nombres.map((nombre) => valores[nombre]), valores, ...nombresBloqueados.map(() => undefined));
  if (typeof resultado !== 'boolean' && typeof resultado !== 'number' && typeof resultado !== 'string') {
    throw new ErrorEjecucionCodigo('El código debe retornar boolean, número o texto.');
  }
  return resultado;
};

self.onmessage = (evento: MessageEvent<SolicitudWorker>) => {
  try {
    const value = ejecutar(evento.data);
    self.postMessage({ ok: true, value } satisfies RespuestaWorker);
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'No fue posible ejecutar el código.',
    } satisfies RespuestaWorker);
  }
};
