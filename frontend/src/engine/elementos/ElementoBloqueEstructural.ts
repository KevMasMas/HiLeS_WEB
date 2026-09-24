import { HilesElementType, type HilesPort } from '../../types/hiles';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionBloqueEstructural { ports?: readonly HilesPort[]; hijos?: readonly string[]; }

/** Contenedor jerárquico: administra hijos, pero no transforma datos. */
export class ElementoBloqueEstructural implements IElementoHiLeS {
  readonly tipo = HilesElementType.STRUCTURAL_BLOCK;
  private readonly hijos: string[];
  private readonly puertos: readonly HilesPort[];
  private readonly entradas = new Map<string, ValorRuntime>();
  private error?: string;
  constructor(configuracion: ConfiguracionBloqueEstructural = {}) {
    this.hijos = [...(configuracion.hijos ?? [])];
    this.puertos = configuracion.ports ?? [];
  }
  agregarHijo(id: string): void { if (!this.hijos.includes(id)) this.hijos.push(id); }
  quitarHijo(id: string): void { const indice = this.hijos.indexOf(id); if (indice >= 0) this.hijos.splice(indice, 1); }
  obtenerHijos(): readonly string[] { return [...this.hijos]; }
  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    const puerto = this.puertos.find((item) => item.id === puertoId && item.direction === 'input');
    if (!puerto) {
      this.error = `El puerto ${puertoId} no es una entrada válida del Structural Block.`;
      return;
    }
    this.entradas.set(puerto.name, valor);
    this.error = undefined;
  }
  evaluar(): Map<string, ValorRuntime> {
    const salidas = new Map<string, ValorRuntime>();
    const unicoValor = this.entradas.size === 1 ? [...this.entradas.values()][0] : undefined;
    this.puertos.filter((puerto) => puerto.direction === 'output').forEach((puerto) => {
      const valor = this.entradas.get(puerto.name) ?? unicoValor;
      if (valor !== undefined) salidas.set(puerto.id, valor);
    });
    return salidas;
  }
  reiniciar(): void { this.entradas.clear(); this.error = undefined; }
  obtenerEstado(): EstadoElemento { return this.error ? { error: this.error } : {}; }
}
