/**
 * Representación intermedia ejecutable (IR) versión 1.
 *
 * Es el único formato que la web publica en `modelo/cargar` y que el motor
 * MicroPython de la Pico acepta. La especificación normativa está en
 * `docs/mqtt/IR_V1.md`; estos tipos son su espejo en TypeScript.
 */

export const IR_VERSION = 1 as const;
export const IR_MAX_ELEMENTOS = 64;
export const IR_MAX_CONEXIONES = 128;
export const IR_MAX_PROFUNDIDAD_EXPRESION = 16;
/** Nombre normalizado del único puerto de entrada de datos de una Transition. */
export const IR_PUERTO_CONDICION = 'condicion';

export type IrTipoDato = 'boolean' | 'integer' | 'real' | 'string';
export type IrValor = boolean | number | string;

export type IrOperadorComparacion = '==' | '!=' | '<' | '<=' | '>' | '>=';
export type IrOperadorAritmetico = '+' | '-' | '*' | '/' | '%';
export type IrOperadorLogicoBinario = 'and' | 'or';
export type IrOperadorBinario = IrOperadorComparacion | IrOperadorAritmetico | IrOperadorLogicoBinario;
export type IrOperadorUnario = 'not' | '-';
export type IrOperador = IrOperadorBinario | IrOperadorUnario;

/** Nodo del árbol de expresión. La Pico lo interpreta de forma recursiva sin `eval`. */
export type IrExpresion =
  | { lit: IrValor }
  | { var: string }
  | { op: IrOperadorUnario; args: [IrExpresion] }
  | { op: IrOperadorBinario; args: [IrExpresion, IrExpresion] };

export interface IrPuertoEntradaBloque {
  puerto: string;
  /** Nombre normalizado con el que la expresión referencia el valor recibido por el puerto. */
  variable: string;
}

export interface IrService {
  id: string;
  tipo: 'service';
  nombre: string;
  tipo_dato: IrTipoDato;
  /** Puertos por los que publica su valor (todos reciben el mismo valor). */
  salidas: string[];
  /** Puertos de datos por los que también puede recibir un valor del circuito. */
  entradas: string[];
  /** Valor opcional al cargar o reiniciar el modelo. */
  valor_inicial?: IrValor;
}

export interface IrFunctionalBlock {
  id: string;
  tipo: 'functional_block';
  nombre: string;
  habilitado: boolean;
  entradas: IrPuertoEntradaBloque[];
  salidas: string[];
  /** `null` significa que el bloque nunca publica (expresión vacía). */
  expresion: IrExpresion | null;
}

export interface IrPlace {
  id: string;
  tipo: 'place';
  nombre: string;
  tokens: number;
  capacidad: number;
}

export interface IrTransition {
  id: string;
  tipo: 'transition';
  nombre: string;
  habilitada: boolean;
  /** Puerto por el que publica `true` en el paso siguiente a un disparo, o `null`. */
  puerto_accion: string | null;
}

export type IrElemento = IrService | IrFunctionalBlock | IrPlace | IrTransition;
export type IrTipoElemento = IrElemento['tipo'];

export interface IrConexionDato {
  id: string;
  tipo: 'dato';
  origen: string;
  puerto_origen: string;
  destino: string;
  puerto_destino: string;
}

export interface IrArco {
  id: string;
  tipo: 'arco';
  origen: string;
  destino: string;
  peso: number;
}

export type IrConexion = IrConexionDato | IrArco;

export interface IrModeloV1 {
  elementos: IrElemento[];
  conexiones: IrConexion[];
}

/** Estado observable de un elemento en `simulacion/estado`. */
export interface IrEstadoElemento {
  valor?: IrValor;
  salida?: IrValor;
  tokens?: number;
  habilitada?: boolean;
  disparada?: boolean;
}

/** Caso de prueba negativo compartido entre TypeScript y MicroPython. */
export interface IrVectorInvalido {
  descripcion: string;
  codigo_esperado: CodigoIr;
  modelo: unknown;
}

/** Paso dentro de un vector de ejecución compartida. */
export interface IrPasoEjecucionVector {
  /** Entradas que se inyectan en Services antes de ejecutar el paso. */
  entradas?: Record<string, IrValor>;
  /** Estado esperado por elemento tras ejecutar un único `paso()`. */
  elementos_esperados: Record<string, IrEstadoElemento>;
}

/** Vector de conformidad funcional entre el motor web y el motor MicroPython. */
export interface IrVectorEjecucion {
  descripcion: string;
  modelo_id: string;
  version: number;
  ir_version: typeof IR_VERSION;
  modelo: IrModeloV1;
  estado_inicial: Record<string, IrEstadoElemento>;
  pasos: IrPasoEjecucionVector[];
}

/** Códigos compartidos por el compilador web y el cargador de la Pico. */
export const CodigoIr = {
  VERSION_NO_SOPORTADA: 'IR_VERSION_NO_SOPORTADA',
  LIMITE_EXCEDIDO: 'IR_LIMITE_EXCEDIDO',
  TIPO_NO_SOPORTADO: 'IR_TIPO_NO_SOPORTADO',
  CODIGO_NO_SOPORTADO: 'IR_CODIGO_NO_SOPORTADO',
  ID_DUPLICADO: 'IR_ID_DUPLICADO',
  REFERENCIA_INVALIDA: 'IR_REFERENCIA_INVALIDA',
  PUERTO_INVALIDO: 'IR_PUERTO_INVALIDO',
  ARCO_INVALIDO: 'IR_ARCO_INVALIDO',
  CONEXION_NO_SOPORTADA: 'IR_CONEXION_NO_SOPORTADA',
  CICLO_DATOS: 'IR_CICLO_DATOS',
  EXPRESION_INVALIDA: 'IR_EXPRESION_INVALIDA',
  TIPO_DATO_INVALIDO: 'IR_TIPO_DATO_INVALIDO',
  ESTRUCTURA_INVALIDA: 'IR_ESTRUCTURA_INVALIDA',
} as const;

export type CodigoIr = (typeof CodigoIr)[keyof typeof CodigoIr];

/**
 * Observación del compilador o validador. Se redacta como aviso informativo:
 * explica qué elemento no es compatible con la ejecución remota en la Pico sin
 * impedir que el circuito continúe usándose en la simulación local.
 */
export interface AvisoIr {
  codigo: CodigoIr;
  mensaje: string;
  elementoId?: string;
  conexionId?: string;
}
