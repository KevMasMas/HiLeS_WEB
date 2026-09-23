import { HilesElementType, type HilesPort, type RuntimeValue } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionRetencion { ports?: readonly HilesPort[]; valorInicial?: RuntimeValue; }

/** Mantiene el último dato recibido y lo publica como señal continua. */
export class ElementoRetencion implements IElementoHiLeS {
  readonly tipo = HilesElementType.HOLD;
  private readonly puertos: readonly HilesPort[];
  private readonly valorInicial: RuntimeValue | undefined;
  private valor: RuntimeValue | undefined;
  constructor(configuracion: ConfiguracionRetencion = {}) { this.puertos = configuracion.ports ?? []; this.valorInicial = configuracion.valorInicial; this.valor = this.valorInicial; }
  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    const puerto = this.puertos.find((item) => item.id === puertoId);
    if (!puerto || puerto.direction === 'input') this.valor = valor;
  }
  evaluar(): Map<string, ValorRuntime> {
    const salida = this.puertos.find((puerto) => puerto.direction === 'output');
    return salida && this.valor !== undefined ? new Map([[salida.id, this.valor]]) : new Map();
  }
  reiniciar(): void { this.valor = this.valorInicial; }
  obtenerEstado(): EstadoElemento { return { valor: this.valor }; }
}
