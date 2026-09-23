import { HilesElementType } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionLugar {
  /** Cantidad de tokens con la que inicia y a la que vuelve al reiniciar. */
  tokensIniciales?: number;
  /** Capacidad total del Place. */
  maxTokens?: number;
}

/**
 * Implementa un Place de la red de Petri.
 *
 * El objeto conserva sus invariantes internamente: los tokens siempre son
 * enteros, nunca son negativos y nunca superan la capacidad configurada.
 */
export class ElementoLugar implements IElementoHiLeS {
  readonly tipo = HilesElementType.PLACE;

  private readonly tokensIniciales: number;
  private readonly maxTokens: number;
  private tokens: number;

  constructor(configuracion: ConfiguracionLugar = {}) {
    const tokensIniciales = configuracion.tokensIniciales ?? 0;
    const maxTokens = configuracion.maxTokens ?? 1;

    this.validarEnteroNoNegativo('tokensIniciales', tokensIniciales);
    this.validarEnteroNoNegativo('maxTokens', maxTokens);
    if (tokensIniciales > maxTokens) {
      throw new RangeError('Los tokens iniciales no pueden superar la capacidad del Place.');
    }

    this.tokensIniciales = tokensIniciales;
    this.maxTokens = maxTokens;
    this.tokens = tokensIniciales;
  }

  /** Los Places no reciben datos por canales CCH/DCH. */
  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    // Método intencionalmente vacío: los tokens solo cambian por arcos Petri.
    void puertoId;
    void valor;
  }

  /** Un Place no publica valores de datos; su estado se consulta aparte. */
  evaluar(): Map<string, ValorRuntime> {
    return new Map();
  }

  tieneTokens(cantidad = 1): boolean {
    this.validarCantidad(cantidad);
    return this.tokens >= cantidad;
  }

  tieneEspacio(cantidad = 1): boolean {
    this.validarCantidad(cantidad);
    return this.tokens + cantidad <= this.maxTokens;
  }

  /** Consume la cantidad completa o no modifica el Place. */
  consumirToken(cantidad = 1): boolean {
    if (!this.tieneTokens(cantidad)) return false;
    this.tokens -= cantidad;
    return true;
  }

  /** Produce la cantidad completa o no modifica el Place. */
  producirToken(cantidad = 1): boolean {
    if (!this.tieneEspacio(cantidad)) return false;
    this.tokens += cantidad;
    return true;
  }

  obtenerCantidadTokens(): number {
    return this.tokens;
  }

  obtenerCapacidad(): number {
    return this.maxTokens;
  }

  reiniciar(): void {
    this.tokens = this.tokensIniciales;
  }

  obtenerEstado(): EstadoElemento {
    return { tokens: this.tokens, activo: this.tokens > 0 };
  }

  private validarCantidad(cantidad: number): void {
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new RangeError('La cantidad de tokens debe ser un entero mayor que cero.');
    }
  }

  private validarEnteroNoNegativo(nombre: string, valor: number): void {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new RangeError(`${nombre} debe ser un entero mayor o igual que cero.`);
    }
  }
}
