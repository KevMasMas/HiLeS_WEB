import type {
  IrExpresion,
  IrOperadorBinario,
  IrOperadorComparacion,
  IrOperadorUnario,
  IrValor,
} from './tiposIr';

/**
 * Compilador y evaluador de expresiones de la IR v1.
 *
 * Soporta el subconjunto seguro de expresiones sin `eval`:
 *   - Literales: booleanos (`true`, `false`), numéricos (`6`, `3.5`) y textos (`'ok'`, `"ok"`).
 *   - Variables: identificadores conectados a los puertos de entrada (`carros`, `humedad`).
 *   - Operadores aritméticos: `+`, `-`, `*`, `/`, `%` (y `-` unario).
 *   - Operadores de comparación: `==`, `!=`, `<`, `<=`, `>`, `>=` (`===` y `!==` se normalizan a `==` y `!=`).
 *   - Operadores lógicos: `and` (`&&`), `or` (`||`), `not` (`!`).
 *   - Agrupación con paréntesis `( ... )` y porcentaje legacy (`humedad < 76%`).
 */

export type ResultadoExpresion =
  | { ok: true; expresion: IrExpresion | null; variables: string[] }
  | { ok: false; mensaje: string };

const PATRON_CODIGO_COMPLEJO = /\b(?:function|def|class|if|else|elif|for|while|do|switch|try|catch|const|let|var|import|from|async|await|yield|lambda)\b|=>|[{};]|\r|\n/;

/**
 * Detecta si un texto corresponde a un bloque de código imperativo JS/Python
 * en lugar de una expresión declarativa simple.
 */
export const esCodigoImperativo = (texto: string): boolean => {
  const limpio = texto.trim();
  if (!limpio) return false;
  if (/^\s*return\b/i.test(limpio)) return true;
  if (PATRON_CODIGO_COMPLEJO.test(limpio)) return true;
  // Asignación simple `a = 1` (distinta de ==, ===, !=, !==, <=, >=)
  return /(?<![=!<>])=(?!=)/.test(limpio);
};

interface Token {
  tipo: 'numero' | 'booleano' | 'texto' | 'identificador' | 'operador' | 'paren_izq' | 'paren_der';
  valor: string;
}

const OPERADORES_COMPARACION = new Set<string>(['==', '!=', '<', '<=', '>', '>=']);

const tokenizar = (entrada: string): Token[] | null => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < entrada.length) {
    const ch = entrada[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ tipo: 'paren_izq', valor: ch });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ tipo: 'paren_der', valor: ch });
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const comilla = ch;
      let fin = i + 1;
      let contenido = '';
      while (fin < entrada.length && entrada[fin] !== comilla) {
        if (entrada[fin] === '\\' && fin + 1 < entrada.length) {
          contenido += entrada[fin + 1];
          fin += 2;
        } else {
          contenido += entrada[fin];
          fin += 1;
        }
      }
      if (fin >= entrada.length) return null;
      tokens.push({ tipo: 'texto', valor: contenido });
      i = fin + 1;
      continue;
    }

    const resto = entrada.slice(i);

    const opTriple = resto.match(/^(===|!==)/);
    if (opTriple) {
      tokens.push({ tipo: 'operador', valor: opTriple[1] === '===' ? '==' : '!=' });
      i += 3;
      continue;
    }

    const opDoble = resto.match(/^(==|!=|<=|>=|&&|\|\|)/);
    if (opDoble) {
      const op = opDoble[1] === '&&' ? 'and' : opDoble[1] === '||' ? 'or' : opDoble[1];
      tokens.push({ tipo: 'operador', valor: op });
      i += 2;
      continue;
    }

    const numeroMatch = resto.match(/^\d+(?:\.\d+)?/);
    if (numeroMatch) {
      tokens.push({ tipo: 'numero', valor: numeroMatch[0] });
      i += numeroMatch[0].length;
      // Compatibilidad con `humedad < 76%`: si `%` va pegado al número al final o antes de `)` / op lógico, se ignora.
      if (entrada[i] === '%') {
        const despues = entrada.slice(i + 1).trim();
        if (!despues || despues.startsWith(')') || /^(?:&&|\|\||and\b|or\b)/i.test(despues)) {
          i += 1;
        }
      }
      continue;
    }

    const opSimple = resto.match(/^([<>+\-*/%!])/);
    if (opSimple) {
      tokens.push({ tipo: 'operador', valor: opSimple[1] === '!' ? 'not' : opSimple[1] });
      i += 1;
      continue;
    }

    const identMatch = resto.match(/^[A-Za-z_$][\w$]*/);
    if (identMatch) {
      const palabra = identMatch[0];
      const lower = palabra.toLowerCase();
      if (lower === 'true' || lower === 'false') {
        tokens.push({ tipo: 'booleano', valor: lower });
      } else if (lower === 'and' || lower === 'or' || lower === 'not') {
        tokens.push({ tipo: 'operador', valor: lower });
      } else {
        tokens.push({ tipo: 'identificador', valor: palabra });
      }
      i += palabra.length;
      continue;
    }

    return null;
  }

  return tokens;
};

/** Convierte el texto de una expresión en un árbol AST de la IR v1. */
export const compilarExpresion = (texto: string): ResultadoExpresion => {
  const limpio = texto.trim();
  if (!limpio) return { ok: true, expresion: null, variables: [] };

  const tokens = tokenizar(limpio);
  if (!tokens || tokens.length === 0) {
    return {
      ok: false,
      mensaje: `Aviso: la expresión «${texto}» contiene símbolos no admitidos en la IR v1.`,
    };
  }

  let cursor = 0;
  const variables = new Set<string>();

  const ver = (): Token | undefined => tokens[cursor];
  const consumir = (): Token => tokens[cursor++];

  const parsearOr = (): IrExpresion | null => {
    let izq = parsearAnd();
    if (!izq) return null;
    while (ver()?.tipo === 'operador' && ver()?.valor === 'or') {
      consumir();
      const der = parsearAnd();
      if (!der) return null;
      izq = { op: 'or', args: [izq, der] };
    }
    return izq;
  };

  const parsearAnd = (): IrExpresion | null => {
    let izq = parsearComparacion();
    if (!izq) return null;
    while (ver()?.tipo === 'operador' && ver()?.valor === 'and') {
      consumir();
      const der = parsearComparacion();
      if (!der) return null;
      izq = { op: 'and', args: [izq, der] };
    }
    return izq;
  };

  const parsearComparacion = (): IrExpresion | null => {
    const izq = parsearAditivo();
    if (!izq) return null;
    const actual = ver();
    if (actual?.tipo === 'operador' && OPERADORES_COMPARACION.has(actual.valor)) {
      const op = consumir().valor as IrOperadorComparacion;
      const der = parsearAditivo();
      if (!der) return null;
      // No se encadenan comparaciones como `a < b < c`
      const siguiente = ver();
      if (siguiente?.tipo === 'operador' && OPERADORES_COMPARACION.has(siguiente.valor)) {
        return null;
      }
      return { op, args: [izq, der] };
    }
    return izq;
  };

  const parsearAditivo = (): IrExpresion | null => {
    let izq = parsearMultiplicativo();
    if (!izq) return null;
    while (ver()?.tipo === 'operador' && (ver()?.valor === '+' || ver()?.valor === '-')) {
      const op = consumir().valor as '+' | '-';
      const der = parsearMultiplicativo();
      if (!der) return null;
      izq = { op, args: [izq, der] };
    }
    return izq;
  };

  const parsearMultiplicativo = (): IrExpresion | null => {
    let izq = parsearUnario();
    if (!izq) return null;
    while (ver()?.tipo === 'operador' && (ver()?.valor === '*' || ver()?.valor === '/' || ver()?.valor === '%')) {
      const op = consumir().valor as '*' | '/' | '%';
      const der = parsearUnario();
      if (!der) return null;
      izq = { op, args: [izq, der] };
    }
    return izq;
  };

  const parsearUnario = (): IrExpresion | null => {
    const actual = ver();
    if (actual?.tipo === 'operador' && (actual.valor === 'not' || actual.valor === '-')) {
      const op = consumir().valor as IrOperadorUnario;
      const operando = parsearUnario();
      if (!operando) return null;
      if (op === '-' && 'lit' in operando && typeof operando.lit === 'number') {
        return { lit: -operando.lit };
      }
      return { op, args: [operando] };
    }
    return parsearPrimario();
  };

  const parsearPrimario = (): IrExpresion | null => {
    const actual = ver();
    if (!actual) return null;

    if (actual.tipo === 'paren_izq') {
      consumir();
      const interno = parsearOr();
      if (!interno || ver()?.tipo !== 'paren_der') return null;
      consumir();
      return interno;
    }

    if (actual.tipo === 'numero') {
      consumir();
      return { lit: Number(actual.valor) };
    }

    if (actual.tipo === 'booleano') {
      consumir();
      return { lit: actual.valor === 'true' };
    }

    if (actual.tipo === 'texto') {
      consumir();
      return { lit: actual.valor };
    }

    if (actual.tipo === 'identificador') {
      consumir();
      variables.add(actual.valor);
      return { var: actual.valor };
    }

    return null;
  };

  const arbol = parsearOr();
  if (!arbol || cursor !== tokens.length) {
    return {
      ok: false,
      mensaje: `Aviso: la expresión «${texto}» no pertenece al subconjunto declarativo de la IR v1.`,
    };
  }

  return { ok: true, expresion: arbol, variables: [...variables] };
};

/** Reemplaza nombres de variable según un mapa; útil para normalizarlos. */
export const renombrarVariables = (
  expresion: IrExpresion,
  nombres: ReadonlyMap<string, string>,
): IrExpresion => {
  if ('var' in expresion) return { var: nombres.get(expresion.var) ?? expresion.var };
  if ('lit' in expresion) return expresion;
  if (expresion.args.length === 1) {
    return {
      op: expresion.op as IrOperadorUnario,
      args: [renombrarVariables(expresion.args[0], nombres)],
    };
  }
  return {
    op: expresion.op as IrOperadorBinario,
    args: [
      renombrarVariables(expresion.args[0], nombres),
      renombrarVariables(expresion.args[1], nombres),
    ],
  };
};

export const profundidadExpresion = (expresion: IrExpresion): number =>
  'op' in expresion ? 1 + Math.max(...expresion.args.map(profundidadExpresion)) : 1;

const tipoDe = (valor: IrValor): 'boolean' | 'number' | 'string' =>
  typeof valor as 'boolean' | 'number' | 'string';

/**
 * Evaluador de referencia de la IR v1. Es la semántica exacta que debe replicar
 * el motor MicroPython de la Pico:
 *   - `undefined` representa una entrada que aún no ha llegado (`None` en Python).
 *   - Un resultado `undefined` significa que el bloque no publica salida en este paso.
 */
export const evaluarExpresionIr = (
  expresion: IrExpresion | null,
  variables: Readonly<Record<string, IrValor | undefined>>,
): IrValor | undefined => {
  if (expresion === null) return undefined;
  if ('lit' in expresion) return expresion.lit;
  if ('var' in expresion) return variables[expresion.var];

  if (expresion.args.length === 1) {
    const val = evaluarExpresionIr(expresion.args[0], variables);
    if (expresion.op === 'not') {
      return typeof val === 'boolean' ? !val : false;
    }
    return typeof val === 'number' ? -val : undefined;
  }

  const izquierdo = evaluarExpresionIr(expresion.args[0], variables);
  const derecho = evaluarExpresionIr(expresion.args[1], variables);

  switch (expresion.op) {
    case 'and':
      return (typeof izquierdo === 'boolean' && typeof derecho === 'boolean')
        ? (izquierdo && derecho)
        : false;
    case 'or':
      return (typeof izquierdo === 'boolean' ? izquierdo : false)
        || (typeof derecho === 'boolean' ? derecho : false);
    case '==':
      return izquierdo !== undefined && derecho !== undefined
        && tipoDe(izquierdo) === tipoDe(derecho)
        && izquierdo === derecho;
    case '!=':
      return !(
        izquierdo !== undefined && derecho !== undefined
        && tipoDe(izquierdo) === tipoDe(derecho)
        && izquierdo === derecho
      );
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (typeof izquierdo !== 'number' || typeof derecho !== 'number') return false;
      if (expresion.op === '<') return izquierdo < derecho;
      if (expresion.op === '<=') return izquierdo <= derecho;
      if (expresion.op === '>') return izquierdo > derecho;
      return izquierdo >= derecho;
    }
    case '+':
    case '-':
    case '*':
    case '/':
    case '%': {
      if (typeof izquierdo !== 'number' || typeof derecho !== 'number') return undefined;
      if (expresion.op === '+') return izquierdo + derecho;
      if (expresion.op === '-') return izquierdo - derecho;
      if (expresion.op === '*') return izquierdo * derecho;
      if (derecho === 0) return undefined;
      return expresion.op === '/' ? izquierdo / derecho : izquierdo % derecho;
    }
  }
};
