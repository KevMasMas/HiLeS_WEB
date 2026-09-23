import { HilesElementType, type HilesPort } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionBloqueEstructural { ports?: readonly HilesPort[]; hijos?: readonly string[]; }

/** Contenedor jerárquico: administra hijos, pero no transforma datos. */
export class ElementoBloqueEstructural implements IElementoHiLeS {
  readonly tipo = HilesElementType.STRUCTURAL_BLOCK;
  private readonly hijos: string[];
  constructor(configuracion: ConfiguracionBloqueEstructural = {}) { this.hijos = [...(configuracion.hijos ?? [])]; }
  agregarHijo(id: string): void { if (!this.hijos.includes(id)) this.hijos.push(id); }
  quitarHijo(id: string): void { const indice = this.hijos.indexOf(id); if (indice >= 0) this.hijos.splice(indice, 1); }
  obtenerHijos(): readonly string[] { return [...this.hijos]; }
  recibirEntrada(puertoId: string, valor: ValorRuntime): void { void puertoId; void valor; }
  evaluar(): Map<string, ValorRuntime> { return new Map(); }
  reiniciar(): void { /* El contenedor no tiene estado de ejecución propio. */ }
  obtenerEstado(): EstadoElemento { return {}; }
}
