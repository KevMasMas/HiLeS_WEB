import type { HilesElementType, RuntimeValue } from '../../types/hiles';

export interface EstadoElemento {
  activo?: boolean;
  tokens?: number;
  error?: string;
  valor?: RuntimeValue;
}

/**
 * Interfaz común para la lógica de cada elemento HiLeS.
 * Cada elemento sabe recibir datos, evaluarse y producir salidas.
 */
export interface IElementoHiLeS {
  /** Tipo del elemento */
  readonly tipo: HilesElementType;

  /** Recibe un valor en un puerto de entrada específico */
  recibirEntrada(puertoId: string, valor: RuntimeValue): void;

  /** Evalúa el estado actual y retorna los valores de salida por puerto */
  evaluar(): Map<string, RuntimeValue>;

  /** Reinicia al estado inicial (tokens originales, sin valores) */
  reiniciar(): void;

  /** Retorna el estado actual para mostrar en el canvas */
  obtenerEstado(): EstadoElemento;
}
