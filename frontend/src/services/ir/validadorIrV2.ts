import { profundidadExpresion } from './expresiones';
import {
  IR_MAX_CONEXIONES,
  IR_MAX_ELEMENTOS,
  IR_MAX_PROFUNDIDAD_EXPRESION,
  IR_PUERTO_CONDICION,
  type IrModeloV1,
} from './tiposIr';
import {
  IR_LIMITES_CANALES_V2,
  IR_LIMITES_PYTHON_V2,
  IR_LIMITES_VALORES_V2,
  IR_VERSION_V2,
  type IrConexionV2,
  type IrDiagnosticoValidacionV2,
  type IrElementoV2,
  type IrEntradaExternaV2,
  type IrExpresion,
  type IrFunctionalBlockElementV2,
  type IrHoldElementV2,
  type IrModeloV2,
  type IrPlaceElementV2,
  type IrPuertoTipadoV2,
  type IrSampleElementV2,
  type IrServiceElementV2,
  type IrTipoDatoV2,
  type IrTransitionElementV2,
  type IrValorRuntimeV2,
  type ResultadoValidacionIrV2,
} from './tiposIrV2';

const TIPOS_DATO_VALIDOS = new Set<IrTipoDatoV2>([
  'boolean',
  'integer',
  'real',
  'string',
  'vector',
  'custom',
]);

const OPERADORES_UNARIOS_AST = new Set(['-', '+', '!', 'not']);
const OPERADORES_BINARIOS_AST = new Set([
  '==',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  '+',
  '-',
  '*',
  '/',
  '%',
  'and',
  'or',
  '&&',
  '||',
]);

export const PYTHON_SAFE_BUILTINS = new Set([
  'abs',
  'bool',
  'float',
  'int',
  'len',
  'max',
  'min',
  'round',
  'str',
  'sum',
]);

export const PYTHON_FORBIDDEN_WORDS = new Set([
  'import',
  'from',
  'while',
  'for',
  'class',
  'lambda',
  'try',
  'except',
  'finally',
  'with',
  'async',
  'await',
  'yield',
  'global',
  'nonlocal',
  'del',
  'raise',
  'eval',
  'exec',
  'open',
  'compile',
  'globals',
  'locals',
  'vars',
  'dir',
  'getattr',
  'setattr',
  'delattr',
  'input',
  'help',
  'breakpoint',
  'memoryview',
  'super',
  'type',
  'object',
  '__import__',
]);

const PYTHON_KEYWORDS = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return false;
  }
  const proto = Object.getPrototypeOf(valor);
  return proto === Object.prototype || proto === null;
}

function esEnteroNoNegativo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0;
}

function contarBytesUtf8(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

export class ErrorValorRuntimeIrV2 extends Error {
  readonly codigo:
    | 'VALOR_TIPO_INVALIDO'
    | 'VALOR_LIMITE_EXCEDIDO'
    | 'VALOR_NO_SERIALIZABLE';

  constructor(
    codigo:
      | 'VALOR_TIPO_INVALIDO'
      | 'VALOR_LIMITE_EXCEDIDO'
      | 'VALOR_NO_SERIALIZABLE',
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorValorRuntimeIrV2';
    this.codigo = codigo;
  }
}

export class ErrorPythonPerfilIrV2 extends Error {
  readonly codigo:
    | 'PYTHON_CODIGO_INVALIDO'
    | 'PYTHON_PERFIL_PROHIBIDO'
    | 'PYTHON_COMPILACION_ERROR'
    | 'PYTHON_EJECUCION_ERROR'
    | 'PYTHON_SALIDA_INVALIDA'
    | 'PYTHON_TIEMPO_EXCEDIDO'
    | 'VALOR_TIPO_INVALIDO'
    | 'VALOR_LIMITE_EXCEDIDO'
    | 'VALOR_NO_SERIALIZABLE';

  constructor(
    codigo: ErrorPythonPerfilIrV2['codigo'],
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorPythonPerfilIrV2';
    this.codigo = codigo;
  }
}

function asegurarBytesSerializados(valor: IrValorRuntimeV2): void {
  let serializado: string;
  try {
    serializado = JSON.stringify(valor);
  } catch (err) {
    throw new ErrorValorRuntimeIrV2(
      'VALOR_NO_SERIALIZABLE',
      `El valor no se puede serializar a JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (typeof serializado !== 'string') {
    throw new ErrorValorRuntimeIrV2(
      'VALOR_NO_SERIALIZABLE',
      'El valor no produjo una representación JSON válida.',
    );
  }
  const bytes = contarBytesUtf8(serializado);
  if (bytes > IR_LIMITES_VALORES_V2.MAX_SERIALIZED_BYTES) {
    throw new ErrorValorRuntimeIrV2(
      'VALOR_LIMITE_EXCEDIDO',
      `Valor serializado excede ${IR_LIMITES_VALORES_V2.MAX_SERIALIZED_BYTES} bytes (${bytes}).`,
    );
  }
}

function validarNodoCustom(
  valor: unknown,
  profundidad: number,
  estado: { items: number },
): IrValorRuntimeV2 {
  if (valor === null || typeof valor === 'boolean') {
    return valor;
  }
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_NO_SERIALIZABLE',
        'No se permiten NaN ni infinitos en valores custom.',
      );
    }
    return valor;
  }
  if (typeof valor === 'string') {
    if (valor.length > IR_LIMITES_VALORES_V2.MAX_STRING_LENGTH) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_LIMITE_EXCEDIDO',
        `Cadena excede longitud máxima de ${IR_LIMITES_VALORES_V2.MAX_STRING_LENGTH}.`,
      );
    }
    return valor;
  }
  if (Array.isArray(valor)) {
    if (profundidad > IR_LIMITES_VALORES_V2.MAX_VALUE_DEPTH) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_LIMITE_EXCEDIDO',
        `Profundidad máxima excedida (${IR_LIMITES_VALORES_V2.MAX_VALUE_DEPTH}).`,
      );
    }
    estado.items += valor.length;
    if (estado.items > IR_LIMITES_VALORES_V2.MAX_CONTAINER_ITEMS) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_LIMITE_EXCEDIDO',
        `Cantidad máxima de elementos excedida (${IR_LIMITES_VALORES_V2.MAX_CONTAINER_ITEMS}).`,
      );
    }
    return valor.map((item) => validarNodoCustom(item, profundidad + 1, estado));
  }
  if (esObjetoPlano(valor)) {
    if (profundidad > IR_LIMITES_VALORES_V2.MAX_VALUE_DEPTH) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_LIMITE_EXCEDIDO',
        `Profundidad máxima excedida (${IR_LIMITES_VALORES_V2.MAX_VALUE_DEPTH}).`,
      );
    }
    const entradas = Object.entries(valor);
    estado.items += entradas.length;
    if (estado.items > IR_LIMITES_VALORES_V2.MAX_CONTAINER_ITEMS) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_LIMITE_EXCEDIDO',
        `Cantidad máxima de elementos excedida (${IR_LIMITES_VALORES_V2.MAX_CONTAINER_ITEMS}).`,
      );
    }
    const resultado: Record<string, IrValorRuntimeV2> = {};
    for (const [clave, subvalor] of entradas) {
      if (clave.length === 0) {
        throw new ErrorValorRuntimeIrV2(
          'VALOR_TIPO_INVALIDO',
          'Las claves de un objeto custom no pueden ser vacías.',
        );
      }
      if (clave.length > IR_LIMITES_VALORES_V2.MAX_STRING_LENGTH) {
        throw new ErrorValorRuntimeIrV2(
          'VALOR_LIMITE_EXCEDIDO',
          `Clave de objeto excede ${IR_LIMITES_VALORES_V2.MAX_STRING_LENGTH} caracteres.`,
        );
      }
      resultado[clave] = validarNodoCustom(subvalor, profundidad + 1, estado);
    }
    return resultado;
  }

  throw new ErrorValorRuntimeIrV2(
    'VALOR_TIPO_INVALIDO',
    `Tipo no permitido dentro de custom: ${typeof valor}.`,
  );
}

export function validarValorRuntimeIrV2(
  valor: unknown,
  tipoDato: IrTipoDatoV2,
  opciones: { coerce?: boolean } = {},
): IrValorRuntimeV2 {
  const coerce = opciones.coerce ?? false;
  if (!TIPOS_DATO_VALIDOS.has(tipoDato)) {
    throw new ErrorValorRuntimeIrV2(
      'VALOR_TIPO_INVALIDO',
      `tipo_dato '${String(tipoDato)}' no es válido en IR v2.`,
    );
  }

  if (tipoDato === 'boolean') {
    if (typeof valor === 'boolean') {
      return valor;
    }
    if (coerce && typeof valor === 'number' && (valor === 0 || valor === 1)) {
      return Boolean(valor);
    }
    throw new ErrorValorRuntimeIrV2(
      'VALOR_TIPO_INVALIDO',
      'Se esperaba un valor boolean.',
    );
  }

  if (tipoDato === 'integer') {
    if (typeof valor === 'number' && Number.isInteger(valor)) {
      return valor;
    }
    if (
      coerce &&
      typeof valor === 'number' &&
      Number.isFinite(valor) &&
      Math.trunc(valor) === valor
    ) {
      return Math.trunc(valor);
    }
    if (typeof valor === 'number' && !Number.isFinite(valor)) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_NO_SERIALIZABLE',
        'No se permiten NaN ni infinitos en valores integer.',
      );
    }
    throw new ErrorValorRuntimeIrV2(
      'VALOR_TIPO_INVALIDO',
      'Se esperaba un valor integer.',
    );
  }

  if (tipoDato === 'real') {
    if (typeof valor === 'number') {
      if (!Number.isFinite(valor)) {
        throw new ErrorValorRuntimeIrV2(
          'VALOR_NO_SERIALIZABLE',
          'No se permiten NaN ni infinitos en valores real.',
        );
      }
      return valor;
    }
    throw new ErrorValorRuntimeIrV2(
      'VALOR_TIPO_INVALIDO',
      'Se esperaba un valor numérico real.',
    );
  }

  if (tipoDato === 'string') {
    if (typeof valor !== 'string') {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_TIPO_INVALIDO',
        'Se esperaba una cadena de texto (string).',
      );
    }
    if (valor.length > IR_LIMITES_VALORES_V2.MAX_STRING_LENGTH) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_LIMITE_EXCEDIDO',
        `Cadena excede longitud máxima de ${IR_LIMITES_VALORES_V2.MAX_STRING_LENGTH}.`,
      );
    }
    asegurarBytesSerializados(valor);
    return valor;
  }

  if (tipoDato === 'vector') {
    if (!Array.isArray(valor)) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_TIPO_INVALIDO',
        'Se esperaba una lista numérica para vector.',
      );
    }
    if (valor.length > IR_LIMITES_VALORES_V2.MAX_VECTOR_LENGTH) {
      throw new ErrorValorRuntimeIrV2(
        'VALOR_LIMITE_EXCEDIDO',
        `Vector excede longitud máxima de ${IR_LIMITES_VALORES_V2.MAX_VECTOR_LENGTH}.`,
      );
    }
    const resultado: number[] = [];
    for (const item of valor) {
      if (typeof item !== 'number') {
        throw new ErrorValorRuntimeIrV2(
          'VALOR_TIPO_INVALIDO',
          'Todos los elementos de vector deben ser numéricos.',
        );
      }
      if (!Number.isFinite(item)) {
        throw new ErrorValorRuntimeIrV2(
          'VALOR_NO_SERIALIZABLE',
          'Vector contiene NaN o infinito.',
        );
      }
      resultado.push(Number(item));
    }
    asegurarBytesSerializados(resultado);
    return resultado;
  }

  const normalizado = validarNodoCustom(valor, 1, { items: 0 });
  asegurarBytesSerializados(normalizado);
  return normalizado;
}

export function valorPorDefectoParaTipoIrV2(
  tipoDato: IrTipoDatoV2,
): IrValorRuntimeV2 {
  switch (tipoDato) {
    case 'boolean':
      return false;
    case 'integer':
    case 'real':
      return 0;
    case 'string':
      return '';
    case 'vector':
      return [];
    case 'custom':
      return {};
  }
}

export function esIdentificadorPythonValido(nombre: string): boolean {
  if (typeof nombre !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre)) {
    return false;
  }
  return !PYTHON_KEYWORDS.has(nombre);
}

function limpiarComentariosYCadenasPython(codigo: string): string {
  const chars: string[] = [];
  let i = 0;
  const n = codigo.length;

  while (i < n) {
    const ch = codigo[i];
    if (ch === '#') {
      while (i < n && codigo[i] !== '\n') {
        chars.push(' ');
        i += 1;
      }
      continue;
    }

    if (
      (ch === 'f' || ch === 'F' || ch === 'r' || ch === 'R' || ch === 'b' || ch === 'B') &&
      i + 1 < n &&
      (codigo[i + 1] === '"' || codigo[i + 1] === "'")
    ) {
      if (ch === 'f' || ch === 'F') {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_PERFIL_PROHIBIDO',
          'No se permiten f-strings en el perfil Python de IR v2.',
        );
      }
      chars.push(' ');
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const esTriple =
        i + 2 < n && codigo[i + 1] === quote && codigo[i + 2] === quote;
      const delimLen = esTriple ? 3 : 1;
      chars.push(' '.repeat(delimLen));
      i += delimLen;
      let cerrado = false;
      while (i < n) {
        if (codigo[i] === '\\' && i + 1 < n) {
          chars.push(' ', ' ');
          i += 2;
          continue;
        }
        if (esTriple) {
          if (
            i + 2 < n &&
            codigo[i] === quote &&
            codigo[i + 1] === quote &&
            codigo[i + 2] === quote
          ) {
            chars.push('   ');
            i += 3;
            cerrado = true;
            break;
          }
        } else if (codigo[i] === quote) {
          chars.push(' ');
          i += 1;
          cerrado = true;
          break;
        } else if (codigo[i] === '\n') {
          break;
        }
        chars.push(codigo[i] === '\n' ? '\n' : ' ');
        i += 1;
      }
      if (!cerrado) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_COMPILACION_ERROR',
          'Literal de cadena sin cerrar en el código Python.',
        );
      }
      continue;
    }

    chars.push(ch);
    i += 1;
  }

  return chars.join('');
}

export interface AnalisisCodigoPythonV2 {
  modo: 'expression' | 'function';
  codigoLimpio: string;
  parametrosFuncion: string[];
  aceptaKwargs: boolean;
  nombreKwargs: string | null;
}

export function validarFirmasPuertosFunctionalBlockV2(
  entradas: IrPuertoTipadoV2[],
  salidas: IrPuertoTipadoV2[],
): void {
  if (!Array.isArray(entradas) || !Array.isArray(salidas)) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_CODIGO_INVALIDO',
      'entradas y salidas deben ser listas de descriptores.',
    );
  }
  if (entradas.length > IR_LIMITES_PYTHON_V2.MAX_INPUTS) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_CODIGO_INVALIDO',
      `Se permiten máximo ${IR_LIMITES_PYTHON_V2.MAX_INPUTS} entradas.`,
    );
  }
  if (
    salidas.length === 0 ||
    salidas.length > IR_LIMITES_PYTHON_V2.MAX_OUTPUTS
  ) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_CODIGO_INVALIDO',
      `Se requiere entre 1 y ${IR_LIMITES_PYTHON_V2.MAX_OUTPUTS} salidas.`,
    );
  }

  const validarLista = (lista: IrPuertoTipadoV2[], etiqueta: string) => {
    const puertosVistos = new Set<string>();
    const variablesVistas = new Set<string>();

    for (const item of lista) {
      if (!esObjetoPlano(item)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_CODIGO_INVALIDO',
          `Descriptor de ${etiqueta} inválido.`,
        );
      }
      const { puerto, variable, tipo_dato: tipoDato } = item;
      if (typeof puerto !== 'string' || puerto.trim() === '') {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_CODIGO_INVALIDO',
          `Puerto de ${etiqueta} inválido.`,
        );
      }
      if (
        typeof variable !== 'string' ||
        !esIdentificadorPythonValido(variable) ||
        PYTHON_FORBIDDEN_WORDS.has(variable) ||
        variable.startsWith('__')
      ) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_CODIGO_INVALIDO',
          `Variable '${String(variable)}' de ${etiqueta} no es un identificador Python permitido.`,
        );
      }
      if (!TIPOS_DATO_VALIDOS.has(tipoDato)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_CODIGO_INVALIDO',
          `tipo_dato '${String(tipoDato)}' no es válido en ${etiqueta}.`,
        );
      }
      if (puertosVistos.has(puerto)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_CODIGO_INVALIDO',
          `Puerto duplicado '${puerto}' en ${etiqueta}.`,
        );
      }
      if (variablesVistas.has(variable)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_CODIGO_INVALIDO',
          `Variable duplicada '${variable}' en ${etiqueta}.`,
        );
      }
      puertosVistos.add(puerto);
      variablesVistas.add(variable);
    }
  };

  validarLista(entradas, 'entrada');
  validarLista(salidas, 'salida');
}

function verificarParentesisBalanceados(codigoLimpio: string): void {
  const pila: string[] = [];
  const pares: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  for (const ch of codigoLimpio) {
    if (ch === '(' || ch === '[' || ch === '{') {
      pila.push(ch);
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (pila.pop() !== pares[ch]) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_COMPILACION_ERROR',
          'Paréntesis, corchetes o llaves desbalanceados en código Python.',
        );
      }
    }
  }
  if (pila.length > 0) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_COMPILACION_ERROR',
      'Paréntesis, corchetes o llaves sin cerrar en código Python.',
    );
  }
}

export function validarCodigoPythonPerfilV2(
  codigo: unknown,
  entradas: IrPuertoTipadoV2[],
  salidas: IrPuertoTipadoV2[],
): AnalisisCodigoPythonV2 {
  validarFirmasPuertosFunctionalBlockV2(entradas, salidas);

  if (typeof codigo !== 'string' || codigo.trim() === '') {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_CODIGO_INVALIDO',
      'El código Python no puede ser vacío.',
    );
  }

  const bytesCodigo = contarBytesUtf8(codigo);
  if (bytesCodigo > IR_LIMITES_PYTHON_V2.MAX_CODE_BYTES) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_CODIGO_INVALIDO',
      `El código excede ${IR_LIMITES_PYTHON_V2.MAX_CODE_BYTES} bytes (${bytesCodigo}).`,
    );
  }

  const lineas = codigo.split(/\r?\n/);
  if (lineas.length > IR_LIMITES_PYTHON_V2.MAX_CODE_LINES) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_CODIGO_INVALIDO',
      `El código excede ${IR_LIMITES_PYTHON_V2.MAX_CODE_LINES} líneas (${lineas.length}).`,
    );
  }

  const codigoLimpio = limpiarComentariosYCadenasPython(codigo);
  verificarParentesisBalanceados(codigoLimpio);

  const regexIdentificador = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  let matchIdent: RegExpExecArray | null;
  while ((matchIdent = regexIdentificador.exec(codigoLimpio)) !== null) {
    const token = matchIdent[0];
    if (token.startsWith('__') || token.endsWith('__')) {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_PERFIL_PROHIBIDO',
        `Identificador reservado no permitido: '${token}'.`,
      );
    }
    if (PYTHON_FORBIDDEN_WORDS.has(token)) {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_PERFIL_PROHIBIDO',
        `Construcción o palabra reservada no permitida: '${token}'.`,
      );
    }
  }

  const regexAtributo = /([A-Za-z0-9_\]})])\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g;
  let matchAttr: RegExpExecArray | null;
  while ((matchAttr = regexAtributo.exec(codigoLimpio)) !== null) {
    const previo = matchAttr[1];
    const attr = matchAttr[2];
    if (/^\d$/.test(previo)) {
      continue;
    }
    const inicioMatch = matchAttr.index;
    const prefijo = codigoLimpio.slice(0, inicioMatch + 1);
    const idPrevioMatch = prefijo.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
    const objetoNombre = idPrevioMatch ? idPrevioMatch[1] : '';
    if (objetoNombre === 'inputs' && attr === 'get') {
      continue;
    }
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_PERFIL_PROHIBIDO',
      `Acceso a atributo '.${attr}' no permitido en el perfil Python.`,
    );
  }

  const regexLlamada = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let matchCall: RegExpExecArray | null;
  while ((matchCall = regexLlamada.exec(codigoLimpio)) !== null) {
    const fnName = matchCall[1];
    const antes = codigoLimpio.slice(0, matchCall.index);
    if (/\bdef\s+$/.test(antes)) {
      if (fnName !== 'calcular') {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_PERFIL_PROHIBIDO',
          `Solo se permite definir la función 'calcular', se encontró '${fnName}'.`,
        );
      }
      continue;
    }
    if (/\binputs\s*\.\s*$/.test(antes) && fnName === 'get') {
      continue;
    }
    if (fnName === 'calcular') {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_PERFIL_PROHIBIDO',
        'No se permite recursión sobre calcular().',
      );
    }
    if (
      PYTHON_KEYWORDS.has(fnName) &&
      (fnName === 'if' ||
        fnName === 'elif' ||
        fnName === 'return' ||
        fnName === 'not' ||
        fnName === 'and' ||
        fnName === 'or')
    ) {
      continue;
    }
    if (!PYTHON_SAFE_BUILTINS.has(fnName)) {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_PERFIL_PROHIBIDO',
        `Llamada a función no permitida: '${fnName}'.`,
      );
    }
  }

  const lineasNoVacias = codigoLimpio
    .split(/\r?\n/)
    .map((l, idx) => ({ texto: l, original: lineas[idx], numero: idx + 1 }))
    .filter((l) => l.texto.trim().length > 0);

  const tieneDef = lineasNoVacias.some((l) => /^\s*def\b/.test(l.texto));

  if (tieneDef) {
    const primera = lineasNoVacias[0];
    const matchHeader = primera.texto.match(
      /^def\s+calcular\s*\(([^)]*)\)\s*:\s*$/,
    );
    if (!matchHeader) {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_PERFIL_PROHIBIDO',
        "En modo función el bloque debe iniciar con 'def calcular(...):' en el nivel superior.",
      );
    }

    if (lineasNoVacias.length < 2) {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_COMPILACION_ERROR',
        'La función calcular() no tiene cuerpo.',
      );
    }

    for (let idx = 1; idx < lineasNoVacias.length; idx += 1) {
      const linea = lineasNoVacias[idx];
      if (!/^\s+/.test(linea.texto)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_PERFIL_PROHIBIDO',
          'No se permiten sentencias en el nivel superior fuera de calcular().',
        );
      }
      if (/^\s*def\b/.test(linea.texto)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_PERFIL_PROHIBIDO',
          'No se permiten funciones anidadas dentro de calcular().',
        );
      }
    }

    const rawParams = matchHeader[1].trim();
    const parametrosFuncion: string[] = [];
    let aceptaKwargs = false;
    let nombreKwargs: string | null = null;

    if (rawParams.length > 0) {
      const partes = rawParams.split(',').map((p) => p.trim());
      for (const parte of partes) {
        if (parte === '') {
          throw new ErrorPythonPerfilIrV2(
            'PYTHON_COMPILACION_ERROR',
            'Parámetro vacío en firma de calcular().',
          );
        }
        if (parte.startsWith('**')) {
          const kwName = parte.slice(2).trim();
          if (!esIdentificadorPythonValido(kwName) || aceptaKwargs) {
            throw new ErrorPythonPerfilIrV2(
              'PYTHON_PERFIL_PROHIBIDO',
              'Firma **kwargs inválida en calcular().',
            );
          }
          aceptaKwargs = true;
          nombreKwargs = kwName;
        } else if (parte.startsWith('*') || parte.includes('=')) {
          throw new ErrorPythonPerfilIrV2(
            'PYTHON_PERFIL_PROHIBIDO',
            'No se permiten *args ni valores por defecto en calcular().',
          );
        } else if (esIdentificadorPythonValido(parte)) {
          parametrosFuncion.push(parte);
        } else {
          throw new ErrorPythonPerfilIrV2(
            'PYTHON_PERFIL_PROHIBIDO',
            `Parámetro '${parte}' inválido en calcular().`,
          );
        }
      }
    }

    const nombresEntrada = new Set(entradas.map((e) => e.variable));
    for (const param of parametrosFuncion) {
      if (!nombresEntrada.has(param)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_CODIGO_INVALIDO',
          `El parámetro '${param}' no coincide con ninguna entrada declarada del bloque.`,
        );
      }
    }

    return {
      modo: 'function',
      codigoLimpio,
      parametrosFuncion,
      aceptaKwargs,
      nombreKwargs,
    };
  }

  if (lineasNoVacias.length !== 1) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_PERFIL_PROHIBIDO',
      'En modo expresión solo se permite una expresión pura de una línea.',
    );
  }

  const exprLine = lineasNoVacias[0].texto.trim();
  if (/^(return|if|elif|else|pass)\b/.test(exprLine) || exprLine.includes(';')) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_PERFIL_PROHIBIDO',
      'En modo expresión no se permiten sentencias imperativas.',
    );
  }

  if (/(?<![=!<>])=(?!=)/.test(exprLine)) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_PERFIL_PROHIBIDO',
      'No se permiten asignaciones en modo expresión.',
    );
  }

  return {
    modo: 'expression',
    codigoLimpio,
    parametrosFuncion: [],
    aceptaKwargs: true,
    nombreKwargs: 'inputs',
  };
}

function traducirExpresionPythonAJs(expr: string): string {
  const segmentos: Array<{ esCadena: boolean; texto: string }> = [];
  let i = 0;
  const n = expr.length;
  let buffer = '';

  while (i < n) {
    const ch = expr[i];
    if (ch === '"' || ch === "'") {
      if (buffer) {
        segmentos.push({ esCadena: false, texto: buffer });
        buffer = '';
      }
      const quote = ch;
      let strToken = ch;
      i += 1;
      while (i < n) {
        if (expr[i] === '\\' && i + 1 < n) {
          strToken += expr[i] + expr[i + 1];
          i += 2;
          continue;
        }
        strToken += expr[i];
        if (expr[i] === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      segmentos.push({ esCadena: true, texto: strToken });
      continue;
    }
    buffer += ch;
    i += 1;
  }
  if (buffer) {
    segmentos.push({ esCadena: false, texto: buffer });
  }

  const transformado = segmentos
    .map((seg) => {
      if (seg.esCadena) {
        return seg.texto;
      }
      return seg.texto
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/\bis\s+not\b/g, '!==')
        .replace(/\bis\b/g, '===')
        .replace(/\band\b/g, '&&')
        .replace(/\bor\b/g, '||')
        .replace(/\bnot\b/g, '!')
        .replace(/\bif\b/g, '/**PY_IF**/')
        .replace(/\belse\b/g, '/**PY_ELSE**/')
        .replace(/\/\//g, '/**INTDIV**/');
    })
    .join('');

  let conTernario = transformado;
  const regexTernario =
    /^(.+?)\s*\/\*\*PY_IF\*\*\/\s*(.+?)\s*\/\*\*PY_ELSE\*\*\/\s*(.+)$/;
  let iter = 0;
  while (regexTernario.test(conTernario) && iter < 8) {
    conTernario = conTernario.replace(regexTernario, '(($2) ? ($1) : ($3))');
    iter += 1;
  }

  return conTernario.replace(
    /([A-Za-z0-9_\]})]+)\s*\/\*\*INTDIV\*\*\/\s*([A-Za-z0-9_[({+-]+)/g,
    'Math.floor(($1) / ($2))',
  );
}

function compilarCuerpoFuncionPythonAJs(
  lineas: string[],
  parametrosPredeclarados: Iterable<string> = [],
): string {
  interface LineaIndentada {
    indent: number;
    texto: string;
  }

  const cuerpo: LineaIndentada[] = [];
  for (let i = 1; i < lineas.length; i += 1) {
    const raw = lineas[i];
    const sinComentario = raw.replace(/#.*$/, '');
    if (sinComentario.trim().length === 0) {
      continue;
    }
    const matchIndent = sinComentario.match(/^(\s*)(.*)$/);
    const espacios = matchIndent ? matchIndent[1].replace(/\t/g, '    ').length : 0;
    const texto = matchIndent ? matchIndent[2].trim() : sinComentario.trim();
    cuerpo.push({ indent: espacios, texto });
  }

  if (cuerpo.length === 0) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_COMPILACION_ERROR',
      'La función calcular() no contiene sentencias ejecutables.',
    );
  }

  const pilaIndent: number[] = [cuerpo[0].indent];
  const jsLines: string[] = [];
  const variablesDeclaradas = new Set<string>(parametrosPredeclarados);

  for (let idx = 0; idx < cuerpo.length; idx += 1) {
    const { indent, texto } = cuerpo[idx];

    while (pilaIndent.length > 1 && indent < pilaIndent[pilaIndent.length - 1]) {
      pilaIndent.pop();
      jsLines.push('}');
    }

    if (
      indent < pilaIndent[pilaIndent.length - 1] ||
      (indent > pilaIndent[pilaIndent.length - 1] &&
        !jsLines[jsLines.length - 1]?.endsWith('{'))
    ) {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_COMPILACION_ERROR',
        `Indentación inválida cerca de '${texto}'.`,
      );
    }

    if (/^if\s+(.+):$/.test(texto)) {
      const m = texto.match(/^if\s+(.+):$/)!;
      jsLines.push(`if (${traducirExpresionPythonAJs(m[1])}) {`);
      const sig = cuerpo[idx + 1];
      if (!sig || sig.indent <= indent) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_COMPILACION_ERROR',
          'Bloque if sin cuerpo indentado.',
        );
      }
      pilaIndent.push(sig.indent);
      continue;
    }

    if (/^elif\s+(.+):$/.test(texto)) {
      const m = texto.match(/^elif\s+(.+):$/)!;
      if (jsLines[jsLines.length - 1] === '}') {
        jsLines.pop();
      } else {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_COMPILACION_ERROR',
          'elif sin bloque if previo.',
        );
      }
      jsLines.push(`} else if (${traducirExpresionPythonAJs(m[1])}) {`);
      const sig = cuerpo[idx + 1];
      if (!sig || sig.indent <= indent) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_COMPILACION_ERROR',
          'Bloque elif sin cuerpo indentado.',
        );
      }
      pilaIndent.push(sig.indent);
      continue;
    }

    if (/^else\s*:$/.test(texto)) {
      if (jsLines[jsLines.length - 1] === '}') {
        jsLines.pop();
      } else {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_COMPILACION_ERROR',
          'else sin bloque if/elif previo.',
        );
      }
      jsLines.push('} else {');
      const sig = cuerpo[idx + 1];
      if (!sig || sig.indent <= indent) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_COMPILACION_ERROR',
          'Bloque else sin cuerpo indentado.',
        );
      }
      pilaIndent.push(sig.indent);
      continue;
    }

    if (/^pass$/.test(texto)) {
      jsLines.push('/* pass */');
      continue;
    }

    if (/^return(?:\s+(.*))?$/.test(texto)) {
      const m = texto.match(/^return(?:\s+(.*))?$/)!;
      const exprRet = m[1] ? traducirExpresionPythonAJs(m[1].trim()) : 'null';
      jsLines.push(`return (${exprRet});`);
      continue;
    }

    const matchAug = texto.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|%=)\s*(.+)$/);
    if (matchAug) {
      const varName = matchAug[1];
      const op = matchAug[2];
      const rhs = traducirExpresionPythonAJs(matchAug[3]);
      if (!variablesDeclaradas.has(varName)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_EJECUCION_ERROR',
          `Variable '${varName}' usada antes de asignarse.`,
        );
      }
      jsLines.push(`${varName} ${op} (${rhs});`);
      continue;
    }

    const matchAssign = texto.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?!=)(.+)$/);
    if (matchAssign) {
      const varName = matchAssign[1];
      if (!esIdentificadorPythonValido(varName) || PYTHON_FORBIDDEN_WORDS.has(varName)) {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_PERFIL_PROHIBIDO',
          `Nombre de variable '${varName}' no permitido.`,
        );
      }
      const rhs = traducirExpresionPythonAJs(matchAssign[2]);
      if (variablesDeclaradas.has(varName)) {
        jsLines.push(`${varName} = (${rhs});`);
      } else {
        variablesDeclaradas.add(varName);
        jsLines.push(`let ${varName} = (${rhs});`);
      }
      continue;
    }

    throw new ErrorPythonPerfilIrV2(
      'PYTHON_PERFIL_PROHIBIDO',
      `Sentencia no soportada en perfil Python: '${texto}'.`,
    );
  }

  while (pilaIndent.length > 1) {
    pilaIndent.pop();
    jsLines.push('}');
  }

  return jsLines.join('\n');
}

function normalizarSalidasPython(
  resultadoBruto: unknown,
  salidas: IrPuertoTipadoV2[],
): Record<string, IrValorRuntimeV2> {
  if (salidas.length === 1) {
    const descriptor = salidas[0];
    let candidato: unknown = resultadoBruto;
    if (esObjetoPlano(resultadoBruto)) {
      if (descriptor.variable in resultadoBruto) {
        candidato = resultadoBruto[descriptor.variable];
      } else if (descriptor.puerto in resultadoBruto) {
        candidato = resultadoBruto[descriptor.puerto];
      } else if (descriptor.tipo_dato !== 'custom') {
        throw new ErrorPythonPerfilIrV2(
          'PYTHON_SALIDA_INVALIDA',
          `El diccionario retornado no contiene la salida '${descriptor.variable}'.`,
        );
      }
    }
    try {
      const validado = validarValorRuntimeIrV2(candidato, descriptor.tipo_dato, {
        coerce: true,
      });
      return { [descriptor.puerto]: validado };
    } catch (err) {
      if (err instanceof ErrorValorRuntimeIrV2) {
        throw new ErrorPythonPerfilIrV2(err.codigo, err.message);
      }
      throw err;
    }
  }

  if (!esObjetoPlano(resultadoBruto)) {
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_SALIDA_INVALIDA',
      'Un bloque con múltiples salidas debe retornar un dict.',
    );
  }

  const resultadoPorPuerto: Record<string, IrValorRuntimeV2> = {};
  for (const descriptor of salidas) {
    let valorBruto: unknown;
    if (descriptor.variable in resultadoBruto) {
      valorBruto = resultadoBruto[descriptor.variable];
    } else if (descriptor.puerto in resultadoBruto) {
      valorBruto = resultadoBruto[descriptor.puerto];
    } else {
      throw new ErrorPythonPerfilIrV2(
        'PYTHON_SALIDA_INVALIDA',
        `Falta la salida '${descriptor.variable}' en el dict retornado.`,
      );
    }

    try {
      resultadoPorPuerto[descriptor.puerto] = validarValorRuntimeIrV2(
        valorBruto,
        descriptor.tipo_dato,
        { coerce: true },
      );
    } catch (err) {
      if (err instanceof ErrorValorRuntimeIrV2) {
        throw new ErrorPythonPerfilIrV2(err.codigo, err.message);
      }
      throw err;
    }
  }

  return resultadoPorPuerto;
}

export function ejecutarCodigoPythonPerfilV2(
  codigo: string,
  valoresEntrada: Record<string, unknown>,
  definicionEntradas: IrPuertoTipadoV2[],
  definicionSalidas: IrPuertoTipadoV2[],
): Record<string, IrValorRuntimeV2> {
  const analisis = validarCodigoPythonPerfilV2(
    codigo,
    definicionEntradas,
    definicionSalidas,
  );

  const entradasNormalizadas: Record<string, IrValorRuntimeV2> = {};
  const entradasPresentes: Record<string, IrValorRuntimeV2> = {};
  for (const descriptor of definicionEntradas) {
    let bruto: unknown;
    let estabaPresente = false;
    if (
      descriptor.variable in valoresEntrada &&
      valoresEntrada[descriptor.variable] !== undefined &&
      valoresEntrada[descriptor.variable] !== null
    ) {
      bruto = valoresEntrada[descriptor.variable];
      estabaPresente = true;
    } else if (
      descriptor.puerto in valoresEntrada &&
      valoresEntrada[descriptor.puerto] !== undefined &&
      valoresEntrada[descriptor.puerto] !== null
    ) {
      bruto = valoresEntrada[descriptor.puerto];
      estabaPresente = true;
    } else {
      bruto = valorPorDefectoParaTipoIrV2(descriptor.tipo_dato);
    }

    if (!estabaPresente) {
      entradasNormalizadas[descriptor.variable] = valorPorDefectoParaTipoIrV2(
        descriptor.tipo_dato,
      );
    } else {
      try {
        const valorValidado = validarValorRuntimeIrV2(
          bruto,
          descriptor.tipo_dato,
          { coerce: true },
        );
        entradasNormalizadas[descriptor.variable] = valorValidado;
        entradasPresentes[descriptor.variable] = valorValidado;
        entradasPresentes[descriptor.puerto] = valorValidado;
      } catch (err) {
        if (err instanceof ErrorValorRuntimeIrV2) {
          throw new ErrorPythonPerfilIrV2(err.codigo, err.message);
        }
        throw err;
      }
    }
  }

  const builtinsSeguros = {
    abs: (x: number) => Math.abs(Number(x)),
    bool: (x: unknown) => {
      if (Array.isArray(x)) return x.length > 0;
      if (esObjetoPlano(x)) return Object.keys(x).length > 0;
      return Boolean(x);
    },
    float: (x: unknown) => {
      const n = Number(x);
      if (Number.isNaN(n)) {
        throw new Error('float() inválido');
      }
      return n;
    },
    int: (x: unknown) => {
      const n = typeof x === 'string' ? Number.parseInt(x, 10) : Math.trunc(Number(x));
      if (Number.isNaN(n)) {
        throw new Error('int() inválido');
      }
      return n;
    },
    len: (x: unknown) => {
      if (typeof x === 'string' || Array.isArray(x)) return x.length;
      if (esObjetoPlano(x)) return Object.keys(x).length;
      throw new Error('len() requiere lista, cadena o dict');
    },
    max: (...args: unknown[]) => {
      const lista = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      if (lista.length === 0) throw new Error('max() sobre secuencia vacía');
      return Math.max(...lista.map((v) => Number(v)));
    },
    min: (...args: unknown[]) => {
      const lista = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      if (lista.length === 0) throw new Error('min() sobre secuencia vacía');
      return Math.min(...lista.map((v) => Number(v)));
    },
    round: (x: number, ndigits?: number) => {
      const num = Number(x);
      if (ndigits === undefined) return Math.round(num);
      const factor = 10 ** Number(ndigits);
      return Math.round(num * factor) / factor;
    },
    str: (x: unknown) => (x === null ? 'None' : String(x)),
    sum: (iterable: unknown, start = 0) => {
      if (!Array.isArray(iterable)) throw new Error('sum() requiere una lista');
      return iterable.reduce((acc: number, item) => acc + Number(item), Number(start));
    },
  };

  const inputsWrapper = {
    ...entradasNormalizadas,
    get: (clave: string, defecto: unknown = null) =>
      Object.prototype.hasOwnProperty.call(entradasPresentes, clave)
        ? entradasPresentes[clave]
        : defecto,
  };

  const nombresParam = Object.keys(entradasNormalizadas);
  const nombresBuiltin = Object.keys(builtinsSeguros);

  let cuerpoJs: string;
  if (analisis.modo === 'expression') {
    const lineaExpr = codigo
      .split(/\r?\n/)
      .map((l) => l.replace(/#.*$/, '').trim())
      .find((l) => l.length > 0)!;
    cuerpoJs = `return (${traducirExpresionPythonAJs(lineaExpr)});`;
  } else {
    const lineas = codigo.split(/\r?\n/);
    cuerpoJs = compilarCuerpoFuncionPythonAJs(lineas, nombresParam);
  }

  let resultadoBruto: unknown;
  try {
    const fn = new Function(
      ...nombresBuiltin,
      'inputs',
      ...nombresParam,
      `"use strict";\n${cuerpoJs}`,
    );
    resultadoBruto = fn(
      ...nombresBuiltin.map((k) => builtinsSeguros[k as keyof typeof builtinsSeguros]),
      inputsWrapper,
      ...nombresParam.map((k) => entradasNormalizadas[k]),
    );
  } catch (err) {
    if (err instanceof ErrorPythonPerfilIrV2) {
      throw err;
    }
    throw new ErrorPythonPerfilIrV2(
      'PYTHON_EJECUCION_ERROR',
      `Error ejecutando bloque Python: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return normalizarSalidasPython(resultadoBruto, definicionSalidas);
}

/**
 * Convierte un modelo IR v1 en un modelo IR v2 equivalente sin pérdida semántica.
 */
export function migrarIrV1AV2(
  modeloV1Input: IrModeloV1,
): IrModeloV2 {
  const modeloV1 = modeloV1Input as IrModeloV1 & Record<string, unknown>;
  const entradasExternasRaw = Array.isArray(modeloV1.entradas_externas)
    ? (modeloV1.entradas_externas as IrEntradaExternaV2[])
    : [];
  const entradasExternas: IrEntradaExternaV2[] = entradasExternasRaw.map(
    (e) => ({
      elemento_id: e.elemento_id,
      nombre: e.nombre,
      puerto_salida: e.puerto_salida,
      tipo_dato: e.tipo_dato,
      ...(e.valor_inicial !== undefined ? { valor_inicial: e.valor_inicial } : {}),
    }),
  );

  const elementos: IrElementoV2[] = modeloV1.elementos.map(
    (el): IrElementoV2 => {
      if (el.tipo === 'service') {
        if (entradasExternasRaw.length === 0 && el.salidas.length > 0 && el.entradas.length === 0) {
          entradasExternas.push({
            elemento_id: el.id,
            nombre: el.nombre,
            puerto_salida: el.salidas[0],
            tipo_dato: el.tipo_dato,
            ...(el.valor_inicial !== undefined ? { valor_inicial: el.valor_inicial } : {}),
          });
        }
        return {
          id: el.id,
          tipo: 'service',
          nombre: el.nombre,
          tipo_dato: el.tipo_dato,
          salidas: [...el.salidas],
          entradas: [...el.entradas],
          ...(el.valor_inicial !== undefined ? { valor_inicial: el.valor_inicial } : {}),
        };
      }
      if (el.tipo === 'functional_block') {
        const salidasAny = el.salidas as unknown[];
        return {
          id: el.id,
          tipo: 'functional_block',
          nombre: el.nombre,
          habilitado: el.habilitado,
          lenguaje: 'expresion',
          expresion: el.expresion,
          entradas: el.entradas.map((en) => ({
            puerto: en.puerto,
            variable: en.variable,
            tipo_dato: 'real',
          })),
          salidas: salidasAny.map((item, idx) => {
            if (typeof item === 'string') {
              return {
                puerto: item,
                variable: idx === 0 ? 'out' : `out_${idx + 1}`,
                tipo_dato: 'boolean',
              };
            }
            const objItem = item as Record<string, unknown>;
            return {
              puerto: String(objItem.puerto ?? `out-${idx + 1}`),
              variable: String(
                objItem.variable ?? objItem.clave ?? (idx === 0 ? 'out' : `out_${idx + 1}`),
              ),
              tipo_dato: (objItem.tipo_dato as IrTipoDatoV2) ?? 'boolean',
            };
          }),
        };
      }
      if (el.tipo === 'place') {
        return {
          id: el.id,
          tipo: 'place',
          nombre: el.nombre,
          tokens: el.tokens,
          capacidad:
            typeof el.capacidad === 'number' && el.capacidad >= 1
              ? el.capacidad
              : null,
        };
      }
      const transAny = el as unknown as Record<string, unknown>;
      return {
        id: el.id,
        tipo: 'transition',
        nombre: el.nombre,
        habilitada: el.habilitada,
        puerto_condicion:
          typeof transAny.puerto_condicion === 'string' && transAny.puerto_condicion.trim() !== ''
            ? transAny.puerto_condicion
            : IR_PUERTO_CONDICION,
        puerto_accion: el.puerto_accion,
      };
    },
  );

  const mapaElementos = new Map<string, IrElementoV2>(
    elementos.map((e) => [e.id, e]),
  );

  const conexiones: IrConexionV2[] = modeloV1.conexiones.map(
    (c): IrConexionV2 => {
      if (c.tipo === 'arco') {
        return {
          id: c.id,
          tipo: 'arco',
          origen: c.origen,
          destino: c.destino,
          peso: c.peso,
        };
      }
      const origenEl = mapaElementos.get(c.origen);
      if (
        origenEl?.tipo === 'transition' &&
        c.puerto_origen === origenEl.puerto_accion
      ) {
        return {
          id: c.id,
          tipo: 'lch',
          origen: c.origen,
          puerto_origen: c.puerto_origen,
          destino: c.destino,
          puerto_destino: c.puerto_destino,
        };
      }
      return {
        id: c.id,
        tipo: 'cch',
        origen: c.origen,
        puerto_origen: c.puerto_origen,
        destino: c.destino,
        puerto_destino: c.puerto_destino,
      };
    },
  );

  const metadataRaw = esObjetoPlano(modeloV1.metadata) ? modeloV1.metadata : {};

  return {
    ir_version: IR_VERSION_V2,
    modelo_id:
      typeof modeloV1.modelo_id === 'string' && modeloV1.modelo_id.trim() !== ''
        ? modeloV1.modelo_id
        : 'modelo-migrado-v1',
    version:
      typeof modeloV1.version === 'number' && Number.isInteger(modeloV1.version) && modeloV1.version >= 1
        ? modeloV1.version
        : 1,
    nombre:
      typeof modeloV1.nombre === 'string' && modeloV1.nombre.trim() !== ''
        ? modeloV1.nombre
        : 'Modelo migrado desde IR v1',
    ...(typeof modeloV1.descripcion === 'string'
      ? { descripcion: modeloV1.descripcion }
      : {}),
    metadata: {
      documento_schema_version:
        typeof metadataRaw.documento_schema_version === 'number'
          ? metadataRaw.documento_schema_version
          : 1,
      compilado_en:
        typeof metadataRaw.compilado_en === 'string'
          ? metadataRaw.compilado_en
          : new Date(0).toISOString(),
      bloque_raiz_id:
        typeof metadataRaw.bloque_raiz_id === 'string'
          ? metadataRaw.bloque_raiz_id
          : null,
      normalizaciones_legadas: ['ir_v1_migrado_a_v2'],
    },
    entradas_externas: entradasExternas,
    elementos,
    conexiones,
  };
}

function validarExpresionAst(
  expr: unknown,
  variablesUsadas: Set<string>,
): expr is IrExpresion {
  if (!esObjetoPlano(expr)) return false;

  // Formato canónico de tiposIr.ts: { lit } | { var } | { op, args }
  const claves = Object.keys(expr);
  if (claves.length === 1 && 'lit' in expr) {
    return (
      typeof expr.lit === 'boolean' ||
      typeof expr.lit === 'string' ||
      (typeof expr.lit === 'number' && Number.isFinite(expr.lit))
    );
  }
  if (claves.length === 1 && 'var' in expr) {
    if (typeof expr.var !== 'string' || expr.var.trim() === '') return false;
    variablesUsadas.add(expr.var);
    return true;
  }
  if (
    'op' in expr &&
    'args' in expr &&
    claves.length === 2 &&
    typeof expr.op === 'string' &&
    Array.isArray(expr.args)
  ) {
    if (expr.args.length === 1 && OPERADORES_UNARIOS_AST.has(expr.op)) {
      return validarExpresionAst(expr.args[0], variablesUsadas);
    }
    if (expr.args.length === 2 && OPERADORES_BINARIOS_AST.has(expr.op)) {
      return expr.args.every((arg) => validarExpresionAst(arg, variablesUsadas));
    }
    return false;
  }

  // Formato extendido alternativo { tipo: 'literal' | 'variable' | ... }
  if (typeof expr.tipo === 'string') {
    switch (expr.tipo) {
      case 'literal':
        return (
          typeof expr.valor === 'boolean' ||
          typeof expr.valor === 'string' ||
          (typeof expr.valor === 'number' && Number.isFinite(expr.valor))
        );
      case 'variable':
        if (typeof expr.nombre !== 'string' || expr.nombre.trim() === '') return false;
        variablesUsadas.add(expr.nombre);
        return true;
      case 'unario':
        return (
          typeof expr.operador === 'string' &&
          OPERADORES_UNARIOS_AST.has(expr.operador) &&
          validarExpresionAst(expr.argumento, variablesUsadas)
        );
      case 'binario':
      case 'comparacion':
      case 'logico':
        return (
          typeof expr.operador === 'string' &&
          OPERADORES_BINARIOS_AST.has(expr.operador) &&
          validarExpresionAst(expr.izquierda, variablesUsadas) &&
          validarExpresionAst(expr.derecha, variablesUsadas)
        );
      case 'ternario':
        return (
          validarExpresionAst(expr.condicion, variablesUsadas) &&
          validarExpresionAst(expr.verdadero, variablesUsadas) &&
          validarExpresionAst(expr.falso, variablesUsadas)
        );
      default:
        return false;
    }
  }

  return false;
}

function validarExpresionIr(
  expr: unknown,
  variablesPermitidas: Set<string>,
  elementoId: string,
  ruta: string,
  errores: IrDiagnosticoValidacionV2[],
): boolean {
  if (expr === null) {
    return true;
  }
  const usadas = new Set<string>();
  if (!validarExpresionAst(expr, usadas)) {
    errores.push({
      codigo: 'IR_EXPRESION_INVALIDA',
      severidad: 'error',
      mensaje: `La expresión de '${elementoId}' no respeta la gramática de la IR v2.`,
      elemento_id: elementoId,
      ruta,
    });
    return false;
  }

  if (
    esObjetoPlano(expr) &&
    ('lit' in expr || 'var' in expr || 'op' in expr) &&
    profundidadExpresion(expr as IrExpresion) > IR_MAX_PROFUNDIDAD_EXPRESION
  ) {
    errores.push({
      codigo: 'IR_LIMITE_EXCEDIDO',
      severidad: 'error',
      mensaje: `La expresión de '${elementoId}' supera la profundidad máxima ${IR_MAX_PROFUNDIDAD_EXPRESION}.`,
      elemento_id: elementoId,
      ruta,
    });
    return false;
  }

  for (const variable of usadas) {
    if (!variablesPermitidas.has(variable)) {
      errores.push({
        codigo: 'IR_REFERENCIA_INVALIDA',
        severidad: 'error',
        mensaje: `La variable '${variable}' no corresponde a ninguna entrada declarada del bloque funcional '${elementoId}'.`,
        elemento_id: elementoId,
        ruta,
      });
      return false;
    }
  }

  return true;
}

interface DescriptorElementoValidado {
  id: string;
  tipo: IrElementoV2['tipo'];
  puertosEntrada: Set<string>;
  puertosSalida: Set<string>;
}

function validarRetardoMsOpcional(
  retardo: unknown,
  contexto: { elemento_id?: string; conexion_id?: string; ruta: string },
  errores: IrDiagnosticoValidacionV2[],
): boolean {
  if (retardo === undefined) {
    return true;
  }
  if (
    typeof retardo !== 'number' ||
    !Number.isInteger(retardo) ||
    retardo < 0 ||
    retardo > IR_LIMITES_CANALES_V2.MAX_DELAY_MS
  ) {
    errores.push({
      codigo: 'IR_RETARDO_INVALIDO',
      severidad: 'error',
      mensaje: `retardo_ms debe ser un entero entre 0 y ${IR_LIMITES_CANALES_V2.MAX_DELAY_MS}.`,
      ...contexto,
    });
    return false;
  }
  return true;
}

function normalizarDescriptorPuertosV2(
  lista: unknown,
  prefijoVar: string,
): IrPuertoTipadoV2[] | null {
  if (!Array.isArray(lista)) return null;
  const resultado: IrPuertoTipadoV2[] = [];
  for (let i = 0; i < lista.length; i += 1) {
    const item = lista[i];
    if (typeof item === 'string' && item.trim() !== '') {
      resultado.push({
        puerto: item,
        variable: i === 0 ? prefijoVar : `${prefijoVar}_${i + 1}`,
        tipo_dato: 'real',
      });
    } else if (
      esObjetoPlano(item) &&
      typeof item.puerto === 'string' &&
      item.puerto.trim() !== '' &&
      typeof item.variable === 'string' &&
      item.variable.trim() !== ''
    ) {
      const tipoDato =
        typeof item.tipo_dato === 'string'
          ? (item.tipo_dato as IrTipoDatoV2)
          : 'real';
      resultado.push({
        puerto: item.puerto,
        variable: item.variable,
        tipo_dato: tipoDato,
      });
    } else {
      return null;
    }
  }
  return resultado;
}

/**
 * Valida un modelo IR v2 (o un modelo IR v1 migrado automáticamente a IR v2).
 */
export function validarModeloIrV2(
  entrada: unknown,
  opciones: { permitirVacio?: boolean } = {},
): ResultadoValidacionIrV2 {
  const permitirVacio = opciones.permitirVacio ?? true;
  const errores: IrDiagnosticoValidacionV2[] = [];
  const advertencias: IrDiagnosticoValidacionV2[] = [];

  const responder = (modelo: IrModeloV2 | null): ResultadoValidacionIrV2 => ({
    ok: errores.length === 0 && modelo !== null,
    valido: errores.length === 0 && modelo !== null,
    modelo: errores.length === 0 ? modelo : null,
    errores,
    advertencias,
  });

  let objeto: unknown = entrada;
  if (typeof entrada === 'string') {
    try {
      objeto = JSON.parse(entrada);
    } catch (error) {
      errores.push({
        codigo: 'JSON_INVALIDO',
        severidad: 'error',
        mensaje: `JSON inválido: ${error instanceof Error ? error.message : 'Error de sintaxis'}`,
      });
      return responder(null);
    }
  }

  if (!esObjetoPlano(objeto)) {
    errores.push({
      codigo: 'IR_ESTRUCTURA_INVALIDA',
      severidad: 'error',
      mensaje: 'El modelo IR debe ser un objeto JSON en la raíz.',
    });
    return responder(null);
  }

  if (objeto.ir_version === 1) {
    if (Array.isArray(objeto.elementos) && Array.isArray(objeto.conexiones)) {
      try {
        objeto = migrarIrV1AV2(
          objeto as unknown as IrModeloV1 & Partial<Record<string, unknown>>,
        ) as unknown as Record<string, unknown>;
      } catch {
        // continúa validación detallada abajo
      }
    }
  }

  const obj = objeto as Record<string, unknown>;

  if (
    obj.ir_version !== undefined &&
    obj.ir_version !== IR_VERSION_V2 &&
    obj.ir_version !== 1
  ) {
    errores.push({
      codigo: 'IR_VERSION_NO_SOPORTADA',
      severidad: 'error',
      mensaje: `ir_version '${String(obj.ir_version)}' no soportada. Se esperaba ${IR_VERSION_V2} (o 1 para compatibilidad).`,
      ruta: 'ir_version',
    });
  }

  const modeloId =
    obj.modelo_id === undefined
      ? 'modelo-ir-v2'
      : typeof obj.modelo_id === 'string' && obj.modelo_id.trim() !== ''
        ? obj.modelo_id
        : '';
  if (!modeloId) {
    errores.push({
      codigo: 'IR_ESTRUCTURA_INVALIDA',
      severidad: 'error',
      mensaje: 'modelo_id debe ser un string no vacío.',
      ruta: 'modelo_id',
    });
  }

  const version =
    obj.version === undefined
      ? 1
      : esEnteroNoNegativo(obj.version) && obj.version >= 1
        ? obj.version
        : -1;
  if (version < 1) {
    errores.push({
      codigo: 'IR_ESTRUCTURA_INVALIDA',
      severidad: 'error',
      mensaje: 'version debe ser un entero mayor o igual a 1.',
      ruta: 'version',
    });
  }

  const nombreModelo =
    obj.nombre === undefined
      ? modeloId || 'Modelo IR v2'
      : typeof obj.nombre === 'string' && obj.nombre.trim() !== ''
        ? obj.nombre
        : '';
  if (!nombreModelo) {
    errores.push({
      codigo: 'IR_ESTRUCTURA_INVALIDA',
      severidad: 'error',
      mensaje: 'nombre debe ser un string no vacío.',
      ruta: 'nombre',
    });
  }

  if (!Array.isArray(obj.elementos)) {
    errores.push({
      codigo: 'IR_ESTRUCTURA_INVALIDA',
      severidad: 'error',
      mensaje: 'elementos debe ser un arreglo.',
      ruta: 'elementos',
    });
  }

  if (!Array.isArray(obj.conexiones)) {
    errores.push({
      codigo: 'IR_ESTRUCTURA_INVALIDA',
      severidad: 'error',
      mensaje: 'conexiones debe ser un arreglo.',
      ruta: 'conexiones',
    });
  }

  if (obj.entradas_externas !== undefined && !Array.isArray(obj.entradas_externas)) {
    errores.push({
      codigo: 'IR_ESTRUCTURA_INVALIDA',
      severidad: 'error',
      mensaje: 'entradas_externas debe ser un arreglo.',
      ruta: 'entradas_externas',
    });
  }

  if (errores.length > 0) {
    return responder(null);
  }

  const elementosRaw = obj.elementos as unknown[];
  const conexionesRaw = obj.conexiones as unknown[];
  const entradasExternasRaw = Array.isArray(obj.entradas_externas)
    ? (obj.entradas_externas as unknown[])
    : [];

  if (!permitirVacio && elementosRaw.length === 0) {
    errores.push({
      codigo: 'MODELO_VACIO',
      severidad: 'error',
      mensaje: 'El modelo IR no contiene elementos.',
      ruta: 'elementos',
    });
    return responder(null);
  }

  if (
    elementosRaw.length > IR_MAX_ELEMENTOS ||
    conexionesRaw.length > IR_MAX_CONEXIONES
  ) {
    errores.push({
      codigo: 'IR_LIMITE_EXCEDIDO',
      severidad: 'error',
      mensaje: `La IR v2 admite hasta ${IR_MAX_ELEMENTOS} elementos y ${IR_MAX_CONEXIONES} conexiones.`,
      ruta: 'elementos',
    });
    return responder(null);
  }

  const mapaElementos = new Map<string, DescriptorElementoValidado>();
  const elementosValidados: IrElementoV2[] = [];

  elementosRaw.forEach((el, idx) => {
    const rutaBase = `elementos[${idx}]`;
    if (
      !esObjetoPlano(el) ||
      typeof el.id !== 'string' ||
      el.id.trim() === ''
    ) {
      errores.push({
        codigo: 'IR_ESTRUCTURA_INVALIDA',
        severidad: 'error',
        mensaje: 'Cada elemento debe ser un objeto con id no vacío.',
        ruta: rutaBase,
      });
      return;
    }

    const id = el.id;
    if (mapaElementos.has(id)) {
      errores.push({
        codigo: 'IR_ID_DUPLICADO',
        severidad: 'error',
        mensaje: `El elemento '${id}' está duplicado en el modelo IR.`,
        elemento_id: id,
        ruta: `${rutaBase}.id`,
      });
      return;
    }

    if (el.nombre !== undefined && typeof el.nombre !== 'string') {
      errores.push({
        codigo: 'IR_ESTRUCTURA_INVALIDA',
        severidad: 'error',
        mensaje: `nombre en '${id}' debe ser texto.`,
        elemento_id: id,
        ruta: `${rutaBase}.nombre`,
      });
      return;
    }
    const nombre =
      typeof el.nombre === 'string' && el.nombre.trim() !== ''
        ? el.nombre
        : id;

    switch (el.tipo) {
      case 'service': {
        const tipoDato = el.tipo_dato as IrTipoDatoV2;
        if (!TIPOS_DATO_VALIDOS.has(tipoDato)) {
          errores.push({
            codigo: 'IR_TIPO_DATO_INVALIDO',
            severidad: 'error',
            mensaje: `tipo_dato '${String(el.tipo_dato)}' inválido en service '${id}'.`,
            elemento_id: id,
            ruta: `${rutaBase}.tipo_dato`,
          });
        }
        if (
          !Array.isArray(el.salidas) ||
          !el.salidas.every((s) => typeof s === 'string' && s.trim() !== '') ||
          !Array.isArray(el.entradas) ||
          !el.entradas.every((s) => typeof s === 'string' && s.trim() !== '')
        ) {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `El service '${id}' debe declarar listas válidas de entradas y salidas.`,
            elemento_id: id,
            ruta: rutaBase,
          });
          return;
        }
        const salidas = el.salidas as string[];
        const entradas = el.entradas as string[];

        let valorInicialValidado: IrValorRuntimeV2 | undefined;
        if (
          el.valor_inicial !== undefined &&
          TIPOS_DATO_VALIDOS.has(tipoDato)
        ) {
          try {
            valorInicialValidado = validarValorRuntimeIrV2(
              el.valor_inicial,
              tipoDato,
              { coerce: false },
            );
          } catch (err) {
            if (err instanceof ErrorValorRuntimeIrV2) {
              errores.push({
                codigo:
                  err.codigo === 'VALOR_TIPO_INVALIDO'
                    ? 'IR_TIPO_DATO_INVALIDO'
                    : err.codigo,
                severidad: 'error',
                mensaje: `valor_inicial inválido en service '${id}': ${err.message}`,
                elemento_id: id,
                ruta: `${rutaBase}.valor_inicial`,
              });
            }
          }
        }

        validarRetardoMsOpcional(
          el.retardo_ms,
          { elemento_id: id, ruta: `${rutaBase}.retardo_ms` },
          errores,
        );

        mapaElementos.set(id, {
          id,
          tipo: 'service',
          puertosEntrada: new Set(entradas),
          puertosSalida: new Set(salidas),
        });
        const serviceEl: IrServiceElementV2 = {
          id,
          tipo: 'service',
          nombre,
          tipo_dato: tipoDato,
          salidas,
          entradas,
          ...(valorInicialValidado !== undefined
            ? { valor_inicial: valorInicialValidado }
            : {}),
          ...(typeof el.retardo_ms === 'number'
            ? { retardo_ms: el.retardo_ms }
            : {}),
        };
        elementosValidados.push(serviceEl);
        break;
      }

      case 'functional_block': {
        if (el.habilitado !== undefined && typeof el.habilitado !== 'boolean') {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `habilitado en '${id}' debe ser booleano.`,
            elemento_id: id,
            ruta: `${rutaBase}.habilitado`,
          });
          return;
        }
        const entradasNorm = normalizarDescriptorPuertosV2(el.entradas, 'in');
        const salidasNorm = normalizarDescriptorPuertosV2(el.salidas, 'out');
        if (!entradasNorm || !salidasNorm || salidasNorm.length === 0) {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `El bloque funcional '${id}' debe definir arreglos válidos de entradas y al menos una salida.`,
            elemento_id: id,
            ruta: rutaBase,
          });
          return;
        }

        if (
          el.lenguaje !== undefined &&
          el.lenguaje !== 'python' &&
          el.lenguaje !== 'expresion'
        ) {
          errores.push({
            codigo: 'IR_CODIGO_NO_SOPORTADO',
            severidad: 'error',
            mensaje: `El lenguaje '${String(el.lenguaje)}' en '${id}' no está soportado en IR v2.`,
            elemento_id: id,
            ruta: `${rutaBase}.lenguaje`,
          });
          return;
        }

        const lenguaje: 'python' | 'expresion' =
          el.lenguaje === 'python' || typeof el.codigo === 'string'
            ? 'python'
            : 'expresion';

        if (lenguaje === 'python') {
          try {
            validarCodigoPythonPerfilV2(el.codigo, entradasNorm, salidasNorm);
          } catch (err) {
            if (err instanceof ErrorPythonPerfilIrV2) {
              errores.push({
                codigo: err.codigo,
                severidad: 'error',
                mensaje: `Bloque funcional '${id}': ${err.message}`,
                elemento_id: id,
                ruta: `${rutaBase}.codigo`,
              });
            }
          }
        } else {
          const variablesPermitidas = new Set<string>();
          for (const item of entradasNorm) {
            if (!TIPOS_DATO_VALIDOS.has(item.tipo_dato)) {
              errores.push({
                codigo: 'IR_TIPO_DATO_INVALIDO',
                severidad: 'error',
                mensaje: `tipo_dato '${String(item.tipo_dato)}' inválido en entrada de '${id}'.`,
                elemento_id: id,
                ruta: `${rutaBase}.entradas`,
              });
            }
            variablesPermitidas.add(item.variable);
          }
          for (const item of salidasNorm) {
            if (!TIPOS_DATO_VALIDOS.has(item.tipo_dato)) {
              errores.push({
                codigo: 'IR_TIPO_DATO_INVALIDO',
                severidad: 'error',
                mensaje: `tipo_dato '${String(item.tipo_dato)}' inválido en salida de '${id}'.`,
                elemento_id: id,
                ruta: `${rutaBase}.salidas`,
              });
            }
          }
          validarExpresionIr(
            el.expresion ?? null,
            variablesPermitidas,
            id,
            `${rutaBase}.expresion`,
            errores,
          );
        }

        validarRetardoMsOpcional(
          el.retardo_ms,
          { elemento_id: id, ruta: `${rutaBase}.retardo_ms` },
          errores,
        );

        mapaElementos.set(id, {
          id,
          tipo: 'functional_block',
          puertosEntrada: new Set(entradasNorm.map((e) => e.puerto)),
          puertosSalida: new Set(salidasNorm.map((s) => s.puerto)),
        });

        const fbEl: IrFunctionalBlockElementV2 = {
          id,
          tipo: 'functional_block',
          nombre,
          habilitado: typeof el.habilitado === 'boolean' ? el.habilitado : true,
          lenguaje,
          ...(lenguaje === 'python'
            ? { codigo: typeof el.codigo === 'string' ? el.codigo : '' }
            : { expresion: (el.expresion ?? null) as IrExpresion | null }),
          entradas: entradasNorm,
          salidas: salidasNorm,
          ...(typeof el.retardo_ms === 'number'
            ? { retardo_ms: el.retardo_ms }
            : {}),
        };
        elementosValidados.push(fbEl);
        break;
      }

      case 'sample': {
        const tipoDato = (el.tipo_dato ?? 'real') as IrTipoDatoV2;
        if (!TIPOS_DATO_VALIDOS.has(tipoDato)) {
          errores.push({
            codigo: 'IR_TIPO_DATO_INVALIDO',
            severidad: 'error',
            mensaje: `tipo_dato '${String(el.tipo_dato)}' inválido en sample '${id}'.`,
            elemento_id: id,
            ruta: `${rutaBase}.tipo_dato`,
          });
        }
        const puertoDato =
          typeof el.puerto_dato === 'string' && el.puerto_dato.trim() !== ''
            ? el.puerto_dato
            : '';
        const puertoControl =
          typeof el.puerto_control === 'string' &&
          el.puerto_control.trim() !== ''
            ? el.puerto_control
            : '';
        const puertoSalida =
          typeof el.puerto_salida === 'string' && el.puerto_salida.trim() !== ''
            ? el.puerto_salida
            : '';

        if (!puertoDato || !puertoControl || !puertoSalida) {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `Sample '${id}' debe definir puerto_dato, puerto_control y puerto_salida.`,
            elemento_id: id,
            ruta: rutaBase,
          });
        }

        validarRetardoMsOpcional(
          el.retardo_ms,
          { elemento_id: id, ruta: `${rutaBase}.retardo_ms` },
          errores,
        );

        mapaElementos.set(id, {
          id,
          tipo: 'sample',
          puertosEntrada: new Set([puertoDato, puertoControl].filter(Boolean)),
          puertosSalida: new Set([puertoSalida].filter(Boolean)),
        });

        const sampleEl: IrSampleElementV2 = {
          id,
          tipo: 'sample',
          nombre,
          habilitado: typeof el.habilitado === 'boolean' ? el.habilitado : true,
          tipo_dato: tipoDato,
          puerto_dato: puertoDato,
          puerto_control: puertoControl,
          puerto_salida: puertoSalida,
          ...(typeof el.retardo_ms === 'number'
            ? { retardo_ms: el.retardo_ms }
            : {}),
        };
        elementosValidados.push(sampleEl);
        break;
      }

      case 'hold': {
        const tipoDato = (el.tipo_dato ?? 'real') as IrTipoDatoV2;
        if (!TIPOS_DATO_VALIDOS.has(tipoDato)) {
          errores.push({
            codigo: 'IR_TIPO_DATO_INVALIDO',
            severidad: 'error',
            mensaje: `tipo_dato '${String(el.tipo_dato)}' inválido en hold '${id}'.`,
            elemento_id: id,
            ruta: `${rutaBase}.tipo_dato`,
          });
        }
        const puertoEntrada =
          typeof el.puerto_entrada === 'string' &&
          el.puerto_entrada.trim() !== ''
            ? el.puerto_entrada
            : '';
        const puertoCch =
          typeof el.puerto_cch === 'string' && el.puerto_cch.trim() !== ''
            ? el.puerto_cch
            : '';
        const puertoLch =
          typeof el.puerto_lch === 'string' && el.puerto_lch.trim() !== ''
            ? el.puerto_lch
            : '';

        if (!puertoEntrada || !puertoCch || !puertoLch) {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `Hold '${id}' debe definir puerto_entrada, puerto_cch y puerto_lch.`,
            elemento_id: id,
            ruta: rutaBase,
          });
        }

        let valorInicialValidado: IrValorRuntimeV2 | undefined;
        if (
          el.valor_inicial !== undefined &&
          TIPOS_DATO_VALIDOS.has(tipoDato)
        ) {
          try {
            valorInicialValidado = validarValorRuntimeIrV2(
              el.valor_inicial,
              tipoDato,
              { coerce: false },
            );
          } catch (err) {
            if (err instanceof ErrorValorRuntimeIrV2) {
              errores.push({
                codigo:
                  err.codigo === 'VALOR_TIPO_INVALIDO'
                    ? 'IR_TIPO_DATO_INVALIDO'
                    : err.codigo,
                severidad: 'error',
                mensaje: `valor_inicial inválido en hold '${id}': ${err.message}`,
                elemento_id: id,
                ruta: `${rutaBase}.valor_inicial`,
              });
            }
          }
        }

        validarRetardoMsOpcional(
          el.retardo_ms,
          { elemento_id: id, ruta: `${rutaBase}.retardo_ms` },
          errores,
        );

        mapaElementos.set(id, {
          id,
          tipo: 'hold',
          puertosEntrada: new Set([puertoEntrada].filter(Boolean)),
          puertosSalida: new Set([puertoCch, puertoLch].filter(Boolean)),
        });

        const holdEl: IrHoldElementV2 = {
          id,
          tipo: 'hold',
          nombre,
          habilitado: typeof el.habilitado === 'boolean' ? el.habilitado : true,
          tipo_dato: tipoDato,
          puerto_entrada: puertoEntrada,
          puerto_cch: puertoCch,
          puerto_lch: puertoLch,
          ...(valorInicialValidado !== undefined
            ? { valor_inicial: valorInicialValidado }
            : {}),
          ...(typeof el.retardo_ms === 'number'
            ? { retardo_ms: el.retardo_ms }
            : {}),
        };
        elementosValidados.push(holdEl);
        break;
      }

      case 'place': {
        if (!esEnteroNoNegativo(el.tokens)) {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `tokens en place '${id}' debe ser un entero >= 0.`,
            elemento_id: id,
            ruta: `${rutaBase}.tokens`,
          });
        }
        const capacidadValida =
          el.capacidad === null ||
          (typeof el.capacidad === 'number' &&
            Number.isInteger(el.capacidad) &&
            el.capacidad >= 0);
        if (!capacidadValida) {
          errores.push({
            codigo: 'IR_CAPACIDAD_INVALIDA',
            severidad: 'error',
            mensaje: `capacidad en place '${id}' debe ser null o un entero >= 0.`,
            elemento_id: id,
            ruta: `${rutaBase}.capacidad`,
          });
        } else if (
          typeof el.capacidad === 'number' &&
          esEnteroNoNegativo(el.tokens) &&
          el.tokens > el.capacidad
        ) {
          errores.push({
            codigo: 'IR_CAPACIDAD_INVALIDA',
            severidad: 'error',
            mensaje: `tokens iniciales (${el.tokens}) exceden la capacidad (${el.capacidad}) en place '${id}'.`,
            elemento_id: id,
            ruta: `${rutaBase}.tokens`,
          });
        }

        mapaElementos.set(id, {
          id,
          tipo: 'place',
          puertosEntrada: new Set(),
          puertosSalida: new Set(),
        });

        const placeEl: IrPlaceElementV2 = {
          id,
          tipo: 'place',
          nombre,
          tokens: esEnteroNoNegativo(el.tokens) ? el.tokens : 0,
          capacidad: typeof el.capacidad === 'number' ? el.capacidad : null,
        };
        elementosValidados.push(placeEl);
        break;
      }

      case 'transition': {
        if (el.habilitada !== undefined && typeof el.habilitada !== 'boolean') {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `habilitada en transition '${id}' debe ser booleano.`,
            elemento_id: id,
            ruta: `${rutaBase}.habilitada`,
          });
          return;
        }
        const puertoCondicion =
          el.puerto_condicion === undefined
            ? IR_PUERTO_CONDICION
            : typeof el.puerto_condicion === 'string' &&
                el.puerto_condicion.trim() !== ''
              ? el.puerto_condicion
              : '';
        const puertoAccionValido =
          el.puerto_accion === null ||
          el.puerto_accion === undefined ||
          (typeof el.puerto_accion === 'string' &&
            el.puerto_accion.trim() !== '');
        if (!puertoCondicion || !puertoAccionValido) {
          errores.push({
            codigo: 'IR_ESTRUCTURA_INVALIDA',
            severidad: 'error',
            mensaje: `Transition '${id}' debe definir puerto_condicion y puerto_accion válido.`,
            elemento_id: id,
            ruta: rutaBase,
          });
        }
        const puertoAccion =
          typeof el.puerto_accion === 'string' ? el.puerto_accion : null;

        validarRetardoMsOpcional(
          el.retardo_ms,
          { elemento_id: id, ruta: `${rutaBase}.retardo_ms` },
          errores,
        );

        mapaElementos.set(id, {
          id,
          tipo: 'transition',
          puertosEntrada: new Set(
            puertoCondicion
              ? [puertoCondicion, IR_PUERTO_CONDICION]
              : [IR_PUERTO_CONDICION],
          ),
          puertosSalida: new Set(puertoAccion ? [puertoAccion] : []),
        });

        const transEl: IrTransitionElementV2 = {
          id,
          tipo: 'transition',
          nombre,
          habilitada:
            typeof el.habilitada === 'boolean' ? el.habilitada : true,
          puerto_condicion: puertoCondicion || IR_PUERTO_CONDICION,
          puerto_accion: puertoAccion,
          ...(typeof el.retardo_ms === 'number'
            ? { retardo_ms: el.retardo_ms }
            : {}),
        };
        elementosValidados.push(transEl);
        break;
      }

      default:
        errores.push({
          codigo: 'IR_TIPO_NO_SOPORTADO',
          severidad: 'error',
          mensaje: `El tipo de elemento '${String(el.tipo)}' en '${id}' no está soportado en IR v2.`,
          elemento_id: id,
          ruta: `${rutaBase}.tipo`,
        });
    }
  });

  const entradasExternasValidadas: IrEntradaExternaV2[] = [];
  entradasExternasRaw.forEach((ext, idx) => {
    const rutaBase = `entradas_externas[${idx}]`;
    if (!esObjetoPlano(ext) || typeof ext.elemento_id !== 'string') {
      errores.push({
        codigo: 'IR_ESTRUCTURA_INVALIDA',
        severidad: 'error',
        mensaje: 'Cada entrada externa debe indicar elemento_id.',
        ruta: rutaBase,
      });
      return;
    }

    const descriptor = mapaElementos.get(ext.elemento_id);
    if (!descriptor || descriptor.tipo !== 'service') {
      errores.push({
        codigo: 'IR_REFERENCIA_INVALIDA',
        severidad: 'error',
        mensaje: `La entrada externa referencia un service inexistente '${ext.elemento_id}'.`,
        elemento_id: ext.elemento_id,
        ruta: `${rutaBase}.elemento_id`,
      });
      return;
    }

    if (
      typeof ext.puerto_salida !== 'string' ||
      !descriptor.puertosSalida.has(ext.puerto_salida)
    ) {
      errores.push({
        codigo: 'IR_PUERTO_INVALIDO',
        severidad: 'error',
        mensaje: `El puerto '${String(ext.puerto_salida)}' no existe en el service '${ext.elemento_id}'.`,
        elemento_id: ext.elemento_id,
        ruta: `${rutaBase}.puerto_salida`,
      });
      return;
    }

    const tipoDato = ext.tipo_dato as IrTipoDatoV2;
    if (!TIPOS_DATO_VALIDOS.has(tipoDato)) {
      errores.push({
        codigo: 'IR_TIPO_DATO_INVALIDO',
        severidad: 'error',
        mensaje: `tipo_dato '${String(ext.tipo_dato)}' inválido en entrada externa '${ext.elemento_id}'.`,
        elemento_id: ext.elemento_id,
        ruta: `${rutaBase}.tipo_dato`,
      });
      return;
    }

    let valorInicialValidado: IrValorRuntimeV2 | undefined;
    if (ext.valor_inicial !== undefined) {
      try {
        valorInicialValidado = validarValorRuntimeIrV2(
          ext.valor_inicial,
          tipoDato,
          { coerce: false },
        );
      } catch (err) {
        if (err instanceof ErrorValorRuntimeIrV2) {
          errores.push({
            codigo:
              err.codigo === 'VALOR_TIPO_INVALIDO'
                ? 'IR_TIPO_DATO_INVALIDO'
                : err.codigo,
            severidad: 'error',
            mensaje: `valor_inicial inválido en entrada externa '${ext.elemento_id}': ${err.message}`,
            elemento_id: ext.elemento_id,
            ruta: `${rutaBase}.valor_inicial`,
          });
        }
      }
    }

    entradasExternasValidadas.push({
      elemento_id: ext.elemento_id,
      nombre:
        typeof ext.nombre === 'string' && ext.nombre.trim() !== ''
          ? ext.nombre
          : ext.elemento_id,
      puerto_salida: ext.puerto_salida,
      tipo_dato: tipoDato,
      ...(valorInicialValidado !== undefined
        ? { valor_inicial: valorInicialValidado }
        : {}),
    });
  });

  const idsConexiones = new Set<string>();
  const conexionesValidadas: IrConexionV2[] = [];
  const adyacenciaDatos = new Map<string, Set<string>>();

  for (const id of mapaElementos.keys()) {
    adyacenciaDatos.set(id, new Set());
  }

  conexionesRaw.forEach((conn, idx) => {
    const rutaBase = `conexiones[${idx}]`;
    if (
      !esObjetoPlano(conn) ||
      typeof conn.id !== 'string' ||
      conn.id.trim() === ''
    ) {
      errores.push({
        codigo: 'IR_ESTRUCTURA_INVALIDA',
        severidad: 'error',
        mensaje: 'Cada conexión debe tener un id string no vacío.',
        ruta: rutaBase,
      });
      return;
    }

    const id = conn.id;
    if (idsConexiones.has(id) || mapaElementos.has(id)) {
      errores.push({
        codigo: 'IR_ID_DUPLICADO',
        severidad: 'error',
        mensaje: `El identificador '${id}' está duplicado.`,
        conexion_id: id,
        ruta: `${rutaBase}.id`,
      });
      return;
    }
    idsConexiones.add(id);

    const origenId = typeof conn.origen === 'string' ? conn.origen : '';
    const destinoId = typeof conn.destino === 'string' ? conn.destino : '';
    const origen = mapaElementos.get(origenId);
    const destino = mapaElementos.get(destinoId);

    if (!origen) {
      errores.push({
        codigo: 'IR_REFERENCIA_INVALIDA',
        severidad: 'error',
        mensaje: `La conexión '${id}' referencia un elemento origen inexistente '${origenId}'.`,
        conexion_id: id,
        ruta: `${rutaBase}.origen`,
      });
      return;
    }
    if (!destino) {
      errores.push({
        codigo: 'IR_REFERENCIA_INVALIDA',
        severidad: 'error',
        mensaje: `La conexión '${id}' referencia un elemento destino inexistente '${destinoId}'.`,
        conexion_id: id,
        ruta: `${rutaBase}.destino`,
      });
      return;
    }

    const tipoConn = conn.tipo === 'dato' ? 'cch' : conn.tipo;

    if (tipoConn === 'cch' || tipoConn === 'dch' || tipoConn === 'lch') {
      const puertoOrigen =
        typeof conn.puerto_origen === 'string' ? conn.puerto_origen : '';
      const puertoDestino =
        typeof conn.puerto_destino === 'string' ? conn.puerto_destino : '';

      if (!origen.puertosSalida.has(puertoOrigen)) {
        errores.push({
          codigo: 'IR_PUERTO_INVALIDO',
          severidad: 'error',
          mensaje: `El puerto de salida '${puertoOrigen}' no existe en el elemento '${origenId}'.`,
          conexion_id: id,
          elemento_id: origenId,
          ruta: `${rutaBase}.puerto_origen`,
        });
      }

      if (!destino.puertosEntrada.has(puertoDestino)) {
        errores.push({
          codigo: 'IR_PUERTO_INVALIDO',
          severidad: 'error',
          mensaje: `El puerto de entrada '${puertoDestino}' no existe en el elemento '${destinoId}'.`,
          conexion_id: id,
          elemento_id: destinoId,
          ruta: `${rutaBase}.puerto_destino`,
        });
      }

      validarRetardoMsOpcional(
        conn.retardo_ms,
        { conexion_id: id, ruta: `${rutaBase}.retardo_ms` },
        errores,
      );

      if (tipoConn === 'dch' && conn.capacidad_cola !== undefined) {
        if (
          typeof conn.capacidad_cola !== 'number' ||
          !Number.isInteger(conn.capacidad_cola) ||
          conn.capacidad_cola < 1 ||
          conn.capacidad_cola > IR_LIMITES_CANALES_V2.MAX_DCH_QUEUE_CAPACITY
        ) {
          errores.push({
            codigo: 'IR_CAPACIDAD_INVALIDA',
            severidad: 'error',
            mensaje: `capacidad_cola en conexión DCH '${id}' debe ser un entero entre 1 y ${IR_LIMITES_CANALES_V2.MAX_DCH_QUEUE_CAPACITY}.`,
            conexion_id: id,
            ruta: `${rutaBase}.capacidad_cola`,
          });
        }
      }

      const retardoConn =
        typeof conn.retardo_ms === 'number' ? conn.retardo_ms : 0;
      if (
        (tipoConn === 'cch' || tipoConn === 'dch') &&
        retardoConn === 0 &&
        origen.tipo !== 'place' &&
        destino.tipo !== 'place'
      ) {
        adyacenciaDatos.get(origenId)?.add(destinoId);
      }

      if (tipoConn === 'cch') {
        conexionesValidadas.push({
          id,
          tipo: 'cch',
          origen: origenId,
          puerto_origen: puertoOrigen,
          destino: destinoId,
          puerto_destino: puertoDestino,
          ...(typeof conn.retardo_ms === 'number'
            ? { retardo_ms: conn.retardo_ms }
            : {}),
        });
      } else if (tipoConn === 'dch') {
        conexionesValidadas.push({
          id,
          tipo: 'dch',
          origen: origenId,
          puerto_origen: puertoOrigen,
          destino: destinoId,
          puerto_destino: puertoDestino,
          ...(typeof conn.capacidad_cola === 'number'
            ? { capacidad_cola: conn.capacidad_cola }
            : {}),
          ...(typeof conn.retardo_ms === 'number'
            ? { retardo_ms: conn.retardo_ms }
            : {}),
        });
      } else {
        conexionesValidadas.push({
          id,
          tipo: 'lch',
          origen: origenId,
          puerto_origen: puertoOrigen,
          destino: destinoId,
          puerto_destino: puertoDestino,
          ...(typeof conn.retardo_ms === 'number'
            ? { retardo_ms: conn.retardo_ms }
            : {}),
        });
      }
    } else if (tipoConn === 'arco') {
      const esPlaceATransition =
        origen.tipo === 'place' && destino.tipo === 'transition';
      const esTransitionAPlace =
        origen.tipo === 'transition' && destino.tipo === 'place';

      if (!esPlaceATransition && !esTransitionAPlace) {
        errores.push({
          codigo: 'IR_ARCO_INVALIDO',
          severidad: 'error',
          mensaje: `El arco '${id}' debe conectar Place -> Transition o Transition -> Place (actual: ${origen.tipo} -> ${destino.tipo}).`,
          conexion_id: id,
          ruta: rutaBase,
        });
      }

      if (
        typeof conn.peso !== 'number' ||
        !Number.isInteger(conn.peso) ||
        conn.peso < 1
      ) {
        errores.push({
          codigo: 'IR_ARCO_INVALIDO',
          severidad: 'error',
          mensaje: `El peso del arco '${id}' debe ser un entero >= 1.`,
          conexion_id: id,
          ruta: `${rutaBase}.peso`,
        });
      }

      conexionesValidadas.push({
        id,
        tipo: 'arco',
        origen: origenId,
        destino: destinoId,
        peso: typeof conn.peso === 'number' ? conn.peso : 1,
      });
    } else {
      errores.push({
        codigo: 'IR_CONEXION_NO_SOPORTADA',
        severidad: 'error',
        mensaje: `El tipo de conexión '${String(conn.tipo)}' en '${id}' no está soportado en IR v2.`,
        conexion_id: id,
        ruta: `${rutaBase}.tipo`,
      });
    }
  });

  const estadoVisita = new Map<string, 'visitando' | 'visitado'>();
  const tieneCiclo = (nodoId: string): boolean => {
    estadoVisita.set(nodoId, 'visitando');
    const vecinos = adyacenciaDatos.get(nodoId) ?? new Set<string>();
    for (const vecino of vecinos) {
      const estado = estadoVisita.get(vecino);
      if (estado === 'visitando') {
        return true;
      }
      if (!estado && tieneCiclo(vecino)) {
        return true;
      }
    }
    estadoVisita.set(nodoId, 'visitado');
    return false;
  };

  for (const nodoId of adyacenciaDatos.keys()) {
    if (!estadoVisita.has(nodoId) && tieneCiclo(nodoId)) {
      errores.push({
        codigo: 'IR_CICLO_DATOS',
        severidad: 'error',
        mensaje:
          'Se detectó un ciclo algebraico en el flujo de datos.',
        elemento_id: nodoId,
        ruta: 'conexiones',
      });
      break;
    }
  }

  if (errores.length > 0) {
    return responder(null);
  }

  const metadataRaw = esObjetoPlano(obj.metadata) ? obj.metadata : {};
  const modeloValidado: IrModeloV2 = {
    ir_version: IR_VERSION_V2,
    modelo_id: modeloId,
    version,
    nombre: nombreModelo,
    ...(typeof obj.descripcion === 'string'
      ? { descripcion: obj.descripcion }
      : {}),
    metadata: {
      documento_schema_version:
        typeof metadataRaw.documento_schema_version === 'number'
          ? metadataRaw.documento_schema_version
          : 1,
      compilado_en:
        typeof metadataRaw.compilado_en === 'string'
          ? metadataRaw.compilado_en
          : new Date(0).toISOString(),
      bloque_raiz_id:
        typeof metadataRaw.bloque_raiz_id === 'string'
          ? metadataRaw.bloque_raiz_id
          : null,
      ...(Array.isArray(metadataRaw.structural_blocks_aplanados)
        ? {
            structural_blocks_aplanados: (
              metadataRaw.structural_blocks_aplanados as unknown[]
            ).filter((x): x is string => typeof x === 'string'),
          }
        : {}),
      ...(Array.isArray(metadataRaw.normalizaciones_legadas)
        ? {
            normalizaciones_legadas: (
              metadataRaw.normalizaciones_legadas as unknown[]
            ).filter((x): x is string => typeof x === 'string'),
          }
        : {}),
    },
    entradas_externas: entradasExternasValidadas,
    elementos: elementosValidados,
    conexiones: conexionesValidadas,
  };

  return responder(modeloValidado);
}

export const validarIrV2 = validarModeloIrV2;
