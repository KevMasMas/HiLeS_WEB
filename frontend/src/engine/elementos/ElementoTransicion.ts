import { HilesElementType } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionTransicion {
  habilitada?: boolean;
  puertoCondicionId?: string;
  puertoAccionId?: string;
}

/**
 * Representa una Transition de la red de Petri.
 *
 * Esta clase administra la guarda y la señal de acción. La disponibilidad de
 * tokens se comprueba en EvaluadorPetri para mantener el disparo atómico.
 */
export class ElementoTransicion implements IElementoHiLeS {
  readonly tipo = HilesElementType.TRANSITION;

  private readonly habilitadaPorConfiguracion: boolean;
  private readonly puertoCondicionId: string;
  private readonly puertoAccionId: string;
  private condicion = false;
  private disparoPendiente = false;
  private ultimoDisparo = false;
  private error?: string;

  constructor(configuracion: ConfiguracionTransicion = {}) {
    this.habilitadaPorConfiguracion = configuracion.habilitada ?? true;
    this.puertoCondicionId = configuracion.puertoCondicionId ?? 'transition-condition-in';
    this.puertoAccionId = configuracion.puertoAccionId ?? 'transition-action-out';
  }

  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    if (puertoId !== this.puertoCondicionId) {
      this.error = `El puerto ${puertoId} no es la entrada de condición de la Transition.`;
      return;
    }
    if (typeof valor !== 'boolean') {
      this.error = 'La condición de una Transition debe ser booleana.';
      this.condicion = false;
      return;
    }

    this.condicion = valor;
    this.ultimoDisparo = false;
    this.error = undefined;
  }

  estaHabilitada(): boolean {
    return this.habilitadaPorConfiguracion && this.condicion && !this.error;
  }

  /** Registra un disparo que se publicará una sola vez al evaluar la salida. */
  marcarDisparo(): void {
    this.disparoPendiente = true;
    this.ultimoDisparo = true;
  }

  evaluar(): Map<string, ValorRuntime> {
    if (!this.disparoPendiente) return new Map();
    this.disparoPendiente = false;
    return new Map([[this.puertoAccionId, true]]);
  }

  reiniciar(): void {
    this.condicion = false;
    this.disparoPendiente = false;
    this.ultimoDisparo = false;
    this.error = undefined;
  }

  obtenerEstado(): EstadoElemento {
    return {
      activo: this.ultimoDisparo,
      valor: this.condicion,
      ...(this.error ? { error: this.error } : {}),
    };
  }
}
