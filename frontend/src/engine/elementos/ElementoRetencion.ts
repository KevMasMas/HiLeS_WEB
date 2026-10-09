import { HilesElementType, type HilesPort, type RuntimeValue } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionRetencion { ports?: readonly HilesPort[]; valorInicial?: RuntimeValue; }

/** Mantiene el último dato recibido y lo publica como señal continua. */
export class ElementoRetencion implements IElementoHiLeS {
  readonly tipo = HilesElementType.HOLD;
  private readonly puertos: readonly HilesPort[];
  private readonly valorInicial: RuntimeValue | undefined;
  private valor: RuntimeValue | undefined;
  private eventoPendiente = false;
  constructor(configuracion: ConfiguracionRetencion = {}) { this.puertos = configuracion.ports ?? []; this.valorInicial = configuracion.valorInicial; this.valor = this.valorInicial; }
  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    const puerto = this.puertos.find((item) => item.id === puertoId);
    if (puerto?.direction === 'input') {
      this.valor = valor;
      this.eventoPendiente = true;
    }
  }
  evaluar(): Map<string, ValorRuntime> {
    if (this.valor === undefined) return new Map();
    const salidas = new Map<string, ValorRuntime>();
    this.puertos
      .filter((puerto) => puerto.direction === 'output' && puerto.nature !== 'control')
      .forEach((puerto) => salidas.set(puerto.id, this.valor as ValorRuntime));
    if (this.eventoPendiente) {
      this.puertos
        .filter((puerto) => puerto.direction === 'output' && puerto.nature === 'control')
        .forEach((puerto) => salidas.set(puerto.id, true));
      this.eventoPendiente = false;
    }
    return salidas;
  }
  reiniciar(): void { this.valor = this.valorInicial; this.eventoPendiente = false; }
  obtenerEstado(): EstadoElemento { return { valor: this.valor }; }
}
