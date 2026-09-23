import { HilesElementType, type HilesPort, type RuntimeValue } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionMuestreo { ports?: readonly HilesPort[]; }

/** Captura Data únicamente cuando recibe true por Control. */
export class ElementoMuestreo implements IElementoHiLeS {
  readonly tipo = HilesElementType.SAMPLE;
  private readonly puertos: readonly HilesPort[];
  private dato: RuntimeValue | undefined;
  private capturado: RuntimeValue | undefined;
  private tieneCaptura = false;
  private control = false;
  constructor(configuracion: ConfiguracionMuestreo = {}) { this.puertos = configuracion.ports ?? []; }
  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    const puerto = this.puertos.find((item) => item.id === puertoId);
    if (!puerto) return;
    if (puerto.name.toLowerCase() === 'control' || puerto.nature === 'control') this.control = valor === true;
    else this.dato = valor;
    if (this.control && this.dato !== undefined) { this.capturado = this.dato; this.tieneCaptura = true; this.control = false; }
  }
  evaluar(): Map<string, ValorRuntime> {
    if (!this.tieneCaptura) return new Map();
    const salida = this.puertos.find((puerto) => puerto.direction === 'output');
    return salida ? new Map([[salida.id, this.capturado as ValorRuntime]]) : new Map();
  }
  reiniciar(): void { this.dato = undefined; this.capturado = undefined; this.tieneCaptura = false; this.control = false; }
  obtenerEstado(): EstadoElemento { return { valor: this.capturado }; }
}
