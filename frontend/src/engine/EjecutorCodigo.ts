import type { RuntimeValue } from '../types/hiles';

export type EntradasRuntime = Record<string, RuntimeValue | undefined>;

export class ErrorEjecucionCodigo extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorEjecucionCodigo';
  }
}

export const TIEMPO_MAXIMO_MS = 1000;
export const TIEMPO_MAXIMO_PYTHON_MS = 15000;
const IDENTIFICADOR = /^[A-Za-z_$][\w$]*$/;
const EXPRESIONES_BLOQUEADAS = [
  /\b(?:window|document|globalThis|self|navigator|location)\b/i,
  /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\b/i,
  /\b(?:eval|import|require|process|constructor|prototype)\b/i,
  /\bFunction\b/,
];
const NOMBRES_BLOQUEADOS = [
  'window', 'document', 'globalThis', 'self', 'navigator', 'location',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'require', 'process',
];

const validarCodigo = (codigo: string): void => {
  if (!codigo.trim()) throw new ErrorEjecucionCodigo('El código del Functional Block está vacío.');
  if (EXPRESIONES_BLOQUEADAS.some((patron) => patron.test(codigo))) {
    throw new ErrorEjecucionCodigo('El código contiene una operación no permitida en el sandbox.');
  }
};

const esFuncionCompleta = (codigo: string): boolean =>
  /^\s*(?:async\s+)?function\b|^\s*(?:const|let|var)\s+calcular\b/.test(codigo);

const esCuerpoCompleto = (codigo: string): boolean =>
  esFuncionCompleta(codigo) || /^\s*(?:return|if|for|while|do|\{)/.test(codigo);

/** Solo las expresiones aritméticas/comparativas simples pueden ejecutarse localmente. */
const EXPRESION_SIMPLE = /^\s*(?:return\s+)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?(?:\s*(?:===|!==|==|!=|<=|>=|<|>|[+\-*/%])\s*(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?|-?\d+(?:\.\d+)?|true|false|'[^']*'|"[^"]*"))*\s*;?\s*$/;

/** Todo código no trivial se aísla para poder terminarlo con terminate(). */
const requiereWorker = (codigo: string): boolean => !EXPRESION_SIMPLE.test(codigo);

const normalizarEntradas = (entradas: EntradasRuntime): Record<string, RuntimeValue> =>
  Object.fromEntries(Object.entries(entradas).filter(([, valor]) => valor !== undefined)) as Record<string, RuntimeValue>;

const nombresDeEntrada = (inputs: Record<string, RuntimeValue>): string[] => Object.keys(inputs)
  .filter((nombre) => IDENTIFICADOR.test(nombre) && nombre !== 'inputs' && !NOMBRES_BLOQUEADOS.includes(nombre));

export const construirCuerpoJS = (codigo: string): string => {
  if (esFuncionCompleta(codigo)) {
    return `'use strict';\n${codigo}\nreturn typeof calcular === 'function' ? calcular(inputs) : undefined;`;
  }
  return `'use strict';\n${esCuerpoCompleto(codigo) ? codigo : `return (${codigo});`}`;
};

const validarResultado = (resultado: unknown): RuntimeValue => {
  if (typeof resultado !== 'boolean' && typeof resultado !== 'number' && typeof resultado !== 'string') {
    throw new ErrorEjecucionCodigo('El código debe retornar boolean, número o texto.');
  }
  return resultado;
};

const ejecutarJSLocal = (codigo: string, inputs: Record<string, RuntimeValue>): RuntimeValue => {
  const nombres = nombresDeEntrada(inputs);
  const parametros = [...nombres, 'inputs', ...NOMBRES_BLOQUEADOS];
  try {
    const funcion = new Function(...parametros, construirCuerpoJS(codigo)) as (...valores: unknown[]) => unknown;
    return validarResultado(funcion(...nombres.map((nombre) => inputs[nombre]), inputs, ...NOMBRES_BLOQUEADOS.map(() => undefined)));
  } catch (error) {
    if (error instanceof ErrorEjecucionCodigo) throw error;
    throw new ErrorEjecucionCodigo(error instanceof Error ? error.message : 'No fue posible ejecutar el código.');
  }
};

const ejecutarJSEnWorker = (codigo: string, inputs: Record<string, RuntimeValue>): Promise<RuntimeValue> => {
  if (typeof Worker === 'undefined') {
    return Promise.reject(new ErrorEjecucionCodigo('El código con control de flujo requiere un Web Worker disponible.'));
  }

  return new Promise<RuntimeValue>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/javascript.worker.ts', import.meta.url), { type: 'module' });
    let terminado = false;
    const reloj = setTimeout(() => {
      finalizar(() => reject(new ErrorEjecucionCodigo(`La ejecución superó el límite de ${TIEMPO_MAXIMO_MS} ms.`)));
    }, TIEMPO_MAXIMO_MS);
    const finalizar = (accion: () => void): void => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      worker.terminate();
      accion();
    };

    worker.onmessage = (evento: MessageEvent<{ ok: boolean; value?: RuntimeValue; error?: string }>) => {
      if (evento.data.ok && evento.data.value !== undefined) {
        finalizar(() => resolve(evento.data.value as RuntimeValue));
      } else {
        finalizar(() => reject(new ErrorEjecucionCodigo(evento.data.error ?? 'No fue posible ejecutar el código.')));
      }
    };
    worker.onerror = () => finalizar(() => reject(new ErrorEjecucionCodigo('El Worker no pudo ejecutar el código.')));
    worker.postMessage({ codigo, inputs });
  });
};

/**
 * Ejecuta JavaScript. Las expresiones sencillas conservan la API síncrona
 * existente; el código con control de flujo se aísla en Worker y retorna una
 * Promise para que un bucle infinito nunca bloquee la interfaz.
 */
export function ejecutarJS(codigo: string, entradas?: EntradasRuntime): RuntimeValue | Promise<RuntimeValue> {
  validarCodigo(codigo);
  const inputs = normalizarEntradas(entradas ?? {});
  return requiereWorker(codigo) ? ejecutarJSEnWorker(codigo, inputs) : ejecutarJSLocal(codigo, inputs);
}

/** Ejecuta Python dentro de Pyodide, siempre aislado en un Worker terminable. */
export const ejecutarPython = (codigo: string, entradas: EntradasRuntime = {}): Promise<RuntimeValue> => {
  if (!codigo.trim()) return Promise.reject(new ErrorEjecucionCodigo('El código Python del Functional Block está vacío.'));
  if (typeof Worker === 'undefined') {
    return Promise.reject(new ErrorEjecucionCodigo('Python requiere un Web Worker disponible.'));
  }

  return new Promise<RuntimeValue>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/pyodide.worker.ts', import.meta.url), { type: 'module' });
    let terminado = false;
    const finalizar = (accion: () => void): void => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      worker.terminate();
      accion();
    };
    const reloj = setTimeout(() => {
      finalizar(() => reject(new ErrorEjecucionCodigo(`La ejecución Python superó el límite de ${TIEMPO_MAXIMO_PYTHON_MS} ms.`)));
    }, TIEMPO_MAXIMO_PYTHON_MS);

    worker.onmessage = (evento: MessageEvent<{ ok: boolean; value?: RuntimeValue; error?: string }>) => {
      if (evento.data.ok && evento.data.value !== undefined) {
        finalizar(() => resolve(evento.data.value as RuntimeValue));
      } else {
        finalizar(() => reject(new ErrorEjecucionCodigo(evento.data.error ?? 'No fue posible ejecutar el código Python.')));
      }
    };
    worker.onerror = () => finalizar(() => reject(new ErrorEjecucionCodigo('El Worker de Python no pudo ejecutar el código.')));
    worker.postMessage({ codigo, inputs: normalizarEntradas(entradas) });
  });
};

/** Evalúa la sintaxis legacy de comparaciones simples como `humedad < 76`. */
export const evaluateGuard = (expression: string, entradas: EntradasRuntime = {}): RuntimeValue | undefined => {
  const texto = expression.replaceAll('%', '').trim();
  if (!texto) return undefined;
  const comparacion = texto.match(/^([A-Za-z_$][\w$]*)?\s*(<=|>=|===|==|!==|!=|<|>)\s*(-?\d+(?:\.\d+)?|true|false)$/i);
  if (!comparacion) return entradas[texto];
  const [, nombre, operador, literal] = comparacion;
  const izquierdo = nombre ? entradas[nombre] : undefined;
  const derecho: RuntimeValue = literal.toLowerCase() === 'true' ? true : literal.toLowerCase() === 'false' ? false : Number(literal);
  if (operador === '==' || operador === '===') return izquierdo === derecho;
  if (operador === '!=' || operador === '!==') return izquierdo !== derecho;
  if (typeof izquierdo !== 'number' || typeof derecho !== 'number') return false;
  if (operador === '<') return izquierdo < derecho;
  if (operador === '<=') return izquierdo <= derecho;
  if (operador === '>') return izquierdo > derecho;
  return izquierdo >= derecho;
};
