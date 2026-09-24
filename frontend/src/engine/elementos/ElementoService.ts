import { HilesElementType, type HilesPort, type RuntimeValue } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionService { ports?: readonly HilesPort[]; }

/** Interfaz entre el circuito y el exterior: conserva y publica el último valor. */
export class ElementoService implements IElementoHiLeS {
  readonly tipo = HilesElementType.SERVICE;
  private readonly puertos: readonly HilesPort[];
  private valor: RuntimeValue | undefined;
  private ultimoError?: string;

  constructor(configuracion: ConfiguracionService = {}) { this.puertos = configuracion.ports ?? []; }
  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    const puerto = this.puertos.find((item) => item.id === puertoId);
    if (!puerto || puerto.direction !== 'input') {
      this.ultimoError = `El puerto ${puertoId} no es una entrada válida del Service.`;
      return;
    }
    this.valor = valor;
    this.ultimoError = undefined;
  }
  /** Permite inyectar una entrada externa sin exigir un puerto de entrada visual. */
  establecerValor(valor: RuntimeValue): void { this.valor = valor; this.ultimoError = undefined; }
  evaluar(): Map<string, ValorRuntime> {
    const salidas = new Map<string, ValorRuntime>();
    if (this.valor === undefined) return salidas;
    this.puertos.filter((puerto) => puerto.direction === 'output').forEach((puerto) => salidas.set(puerto.id, this.valor as ValorRuntime));
    return salidas;
  }
  reiniciar(): void { this.valor = undefined; this.ultimoError = undefined; }
  obtenerEstado(): EstadoElemento { return { valor: this.valor, ...(this.ultimoError ? { error: this.ultimoError } : {}) }; }
}
