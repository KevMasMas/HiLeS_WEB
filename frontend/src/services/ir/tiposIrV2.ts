import type {
  IrExpresion,
  IrOperador,
  IrOperadorAritmetico,
  IrOperadorBinario,
  IrOperadorComparacion,
  IrOperadorLogicoBinario,
  IrOperadorUnario,
  IrValor,
} from './tiposIr';

export type {
  IrExpresion,
  IrOperador,
  IrOperadorAritmetico,
  IrOperadorBinario,
  IrOperadorComparacion,
  IrOperadorLogicoBinario,
  IrOperadorUnario,
  IrValor,
};

export type IrNodoId = string;
export type IrPuertoId = string;
export type IrSeveridadValidacion = 'error' | 'advertencia';

export interface IrMetadata {
  documento_schema_version: number;
  compilado_en: string;
  bloque_raiz_id: string | null;
}

export const IR_VERSION_V2 = 2 as const;
export const IR_VERSIONES_SOPORTADAS = [1, 2] as const;

export const IR_LIMITES_VALORES_V2 = {
  MAX_VALUE_DEPTH: 6,
  MAX_CONTAINER_ITEMS: 64,
  MAX_VECTOR_LENGTH: 32,
  MAX_STRING_LENGTH: 256,
  MAX_SERIALIZED_BYTES: 2048,
} as const;

export const IR_LIMITES_PYTHON_V2 = {
  MAX_CODE_BYTES: 2048,
  MAX_CODE_LINES: 40,
  MAX_INPUTS: 16,
  MAX_OUTPUTS: 16,
} as const;

export const IR_LIMITES_CANALES_V2 = {
  DEFAULT_DCH_QUEUE_CAPACITY: 8,
  MAX_DCH_QUEUE_CAPACITY: 32,
  MAX_DELAY_MS: 600_000,
} as const;

export type IrTipoDatoV2 =
  | 'boolean'
  | 'integer'
  | 'real'
  | 'string'
  | 'vector'
  | 'custom';

export type IrValorEscalarV2 = boolean | number | string;
export type IrValorVectorV2 = number[];
export type IrValorCustomV2 =
  | IrValorRuntimeV2[]
  | { [key: string]: IrValorRuntimeV2 };

export type IrValorRuntimeV2 =
  | IrValorEscalarV2
  | IrValorVectorV2
  | IrValorCustomV2
  | null;

export interface IrEntradaExternaV2 {
  elemento_id: IrNodoId;
  nombre: string;
  puerto_salida: IrPuertoId;
  tipo_dato: IrTipoDatoV2;
  valor_inicial?: IrValorRuntimeV2;
}

export interface IrPuertoTipadoV2 {
  puerto: IrPuertoId;
  variable: string;
  tipo_dato: IrTipoDatoV2;
}

export interface IrServiceElementV2 {
  id: IrNodoId;
  tipo: 'service';
  nombre: string;
  tipo_dato: IrTipoDatoV2;
  salidas: IrPuertoId[];
  entradas: IrPuertoId[];
  valor_inicial?: IrValorRuntimeV2;
  retardo_ms?: number;
}

export type IrLenguajeFunctionalBlockV2 = 'python' | 'expresion';

export interface IrFunctionalBlockElementV2 {
  id: IrNodoId;
  tipo: 'functional_block';
  nombre: string;
  habilitado: boolean;
  lenguaje: IrLenguajeFunctionalBlockV2;
  codigo?: string | null;
  expresion?: IrExpresion | null;
  entradas: IrPuertoTipadoV2[];
  salidas: IrPuertoTipadoV2[];
  retardo_ms?: number;
}

export interface IrSampleElementV2 {
  id: IrNodoId;
  tipo: 'sample';
  nombre: string;
  habilitado: boolean;
  tipo_dato: IrTipoDatoV2;
  puerto_dato: IrPuertoId;
  puerto_control: IrPuertoId;
  puerto_salida: IrPuertoId;
  retardo_ms?: number;
}

export interface IrHoldElementV2 {
  id: IrNodoId;
  tipo: 'hold';
  nombre: string;
  habilitado: boolean;
  tipo_dato: IrTipoDatoV2;
  puerto_entrada: IrPuertoId;
  puerto_cch: IrPuertoId;
  puerto_lch: IrPuertoId;
  valor_inicial?: IrValorRuntimeV2;
  retardo_ms?: number;
}

export interface IrPlaceElementV2 {
  id: IrNodoId;
  tipo: 'place';
  nombre: string;
  tokens: number;
  capacidad: number | null;
}

export interface IrTransitionElementV2 {
  id: IrNodoId;
  tipo: 'transition';
  nombre: string;
  habilitada: boolean;
  puerto_condicion: IrPuertoId;
  puerto_accion: IrPuertoId | null;
  retardo_ms?: number;
}

export type IrElementoV2 =
  | IrServiceElementV2
  | IrFunctionalBlockElementV2
  | IrSampleElementV2
  | IrHoldElementV2
  | IrPlaceElementV2
  | IrTransitionElementV2;

export interface IrConexionCchV2 {
  id: string;
  tipo: 'cch';
  origen: IrNodoId;
  puerto_origen: IrPuertoId;
  destino: IrNodoId;
  puerto_destino: IrPuertoId;
  retardo_ms?: number;
}

export interface IrConexionDchV2 {
  id: string;
  tipo: 'dch';
  origen: IrNodoId;
  puerto_origen: IrPuertoId;
  destino: IrNodoId;
  puerto_destino: IrPuertoId;
  capacidad_cola?: number;
  retardo_ms?: number;
}

export interface IrConexionLchV2 {
  id: string;
  tipo: 'lch';
  origen: IrNodoId;
  puerto_origen: IrPuertoId;
  destino: IrNodoId;
  puerto_destino: IrPuertoId;
  retardo_ms?: number;
}

export interface IrConexionArcoV2 {
  id: string;
  tipo: 'arco';
  origen: IrNodoId;
  destino: IrNodoId;
  peso: number;
}

export type IrConexionCanalV2 =
  | IrConexionCchV2
  | IrConexionDchV2
  | IrConexionLchV2;

export type IrConexionV2 = IrConexionCanalV2 | IrConexionArcoV2;

export interface IrMetadataV2 extends IrMetadata {
  structural_blocks_aplanados?: string[];
  normalizaciones_legadas?: string[];
}

export interface IrModeloV2 {
  ir_version: typeof IR_VERSION_V2;
  modelo_id: string;
  version: number;
  nombre: string;
  descripcion?: string;
  metadata: IrMetadataV2;
  entradas_externas: IrEntradaExternaV2[];
  elementos: IrElementoV2[];
  conexiones: IrConexionV2[];
}

export type IrCodigoValidacionV2 =
  | 'JSON_INVALIDO'
  | 'IR_VERSION_NO_SOPORTADA'
  | 'MODELO_VACIO'
  | 'IR_ESTRUCTURA_INVALIDA'
  | 'IR_LIMITE_EXCEDIDO'
  | 'IR_ID_DUPLICADO'
  | 'IR_TIPO_NO_SOPORTADO'
  | 'IR_ELEMENTO_NO_SOPORTADO'
  | 'IR_TIPO_DATO_INVALIDO'
  | 'IR_REFERENCIA_INVALIDA'
  | 'IR_REFERENCIA_INEXISTENTE'
  | 'IR_PUERTO_INVALIDO'
  | 'IR_PUERTO_INEXISTENTE'
  | 'IR_ARCO_INVALIDO'
  | 'IR_CONEXION_INVALIDA'
  | 'IR_CONEXION_NO_SOPORTADA'
  | 'IR_CICLO_DATOS'
  | 'IR_EXPRESION_INVALIDA'
  | 'IR_EXPRESION_NO_SOPORTADA'
  | 'IR_CODIGO_NO_SOPORTADO'
  | 'IR_CAPACIDAD_INVALIDA'
  | 'IR_RETARDO_INVALIDO'
  | 'VALOR_TIPO_INVALIDO'
  | 'VALOR_LIMITE_EXCEDIDO'
  | 'VALOR_NO_SERIALIZABLE'
  | 'PYTHON_CODIGO_INVALIDO'
  | 'PYTHON_PERFIL_PROHIBIDO'
  | 'PYTHON_COMPILACION_ERROR'
  | 'PYTHON_EJECUCION_ERROR'
  | 'PYTHON_SALIDA_INVALIDA'
  | 'PYTHON_TIEMPO_EXCEDIDO'
  | 'DCH_COLA_DESBORDADA';

export interface IrDiagnosticoValidacionV2 {
  codigo: IrCodigoValidacionV2;
  severidad: IrSeveridadValidacion;
  mensaje: string;
  elemento_id?: string;
  conexion_id?: string;
  ruta?: string;
}

export interface ResultadoValidacionIrV2 {
  ok: boolean;
  valido: boolean;
  modelo: IrModeloV2 | null;
  errores: IrDiagnosticoValidacionV2[];
  advertencias: IrDiagnosticoValidacionV2[];
}

export interface IrEstadoElementoV2 {
  valor?: IrValorRuntimeV2;
  salida?: IrValorRuntimeV2;
  salidas?: Record<string, IrValorRuntimeV2>;
  valor_retenido?: IrValorRuntimeV2;
  evento_pendiente?: boolean;
  cola_dch?: number;
  cola_desbordada?: boolean;
  timer_pendiente?: boolean;
  error?: string | null;
  tokens?: number;
  habilitada?: boolean;
  disparada?: boolean;
}

export interface IrPasoEjecucionVectorV2 {
  avance_tiempo_ms?: number;
  entradas?: Record<string, IrValorRuntimeV2>;
  elementos_esperados: Record<string, IrEstadoElementoV2>;
}

export interface IrVectorEjecucionV2 {
  descripcion: string;
  modelo_id: string;
  version: number;
  ir_version: typeof IR_VERSION_V2;
  modelo: IrModeloV2;
  estado_inicial: Record<string, IrEstadoElementoV2>;
  pasos: IrPasoEjecucionVectorV2[];
}

export interface IrVectorInvalidoV2 {
  descripcion: string;
  codigo_esperado: IrCodigoValidacionV2;
  modelo: unknown;
}
