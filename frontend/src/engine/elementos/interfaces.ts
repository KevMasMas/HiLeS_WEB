import type { HilesElementType, HilesPort, RuntimeValue } from '../../types/hiles';

/** Valor que puede circular durante una simulación HiLeS. */
export type ValorRuntime = RuntimeValue;

/** Información mínima de un puerto que necesita el motor de simulación. */
export type PuertoInfo = Pick<HilesPort, 'id' | 'name' | 'direction' | 'dataType' | 'nature'>;

export interface EstadoElemento {
  activo?: boolean;
  tokens?: number;
  error?: string;
  valor?: ValorRuntime;
}

/**
 * Interfaz común para la lógica de cada elemento HiLeS.
 * Cada elemento sabe recibir datos, evaluarse y producir salidas.
 */
export interface IElementoHiLeS {
  /** Tipo del elemento */
  readonly tipo: HilesElementType;

  /** Recibe un valor en un puerto de entrada específico */
  recibirEntrada(puertoId: string, valor: ValorRuntime): void;

  /** Evalúa el estado actual y retorna los valores de salida por puerto */
  evaluar(): Map<string, ValorRuntime>;

  /** Reinicia al estado inicial (tokens originales, sin valores) */
  reiniciar(): void;

  /** Retorna el estado actual para mostrar en el canvas */
  obtenerEstado(): EstadoElemento;
}
