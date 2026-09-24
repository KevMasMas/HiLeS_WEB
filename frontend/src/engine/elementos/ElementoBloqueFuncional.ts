import { HilesElementType, type HilesNodeProperties, type HilesPort, type RuntimeValue } from '../../types/hiles';
import { ejecutarJS, ejecutarPython, evaluateGuard, type EntradasRuntime } from '../EjecutorCodigo';
import type { EstadoElemento, IElementoHiLeS, ValorRuntime } from './interfaces';

export interface ConfiguracionBloqueFuncional { properties?: Partial<HilesNodeProperties>; ports?: readonly HilesPort[]; }

/** Convierte la etiqueta visual del puerto en un identificador usable en código. */
const nombreVariable = (nombre: string): string => {
  const normalizado = nombre.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_$]+/g, '_')
    .replace(/^([^A-Za-z_$])/, '_$1')
    .replace(/_+$/g, '');
  return normalizado.toLowerCase();
};

/** Bloque que transforma entradas mediante código del usuario o expresión legacy. */
export class ElementoBloqueFuncional implements IElementoHiLeS {
  readonly tipo = HilesElementType.FUNCTIONAL_BLOCK;
  private readonly properties: Partial<HilesNodeProperties>;
  private readonly puertos: readonly HilesPort[];
  private readonly entradas: EntradasRuntime = {};
  private resultado: RuntimeValue | undefined;
  private error?: string;

  constructor(configuracion: ConfiguracionBloqueFuncional = {}) { this.properties = configuracion.properties ?? {}; this.puertos = configuracion.ports ?? []; }
  recibirEntrada(puertoId: string, valor: ValorRuntime): void {
    const puerto = this.puertos.find((item) => item.id === puertoId);
    if (!puerto || puerto.direction !== 'input') { this.error = `El puerto ${puertoId} no es una entrada válida.`; return; }
    this.entradas[puerto.name] = valor;
    this.entradas[nombreVariable(puerto.name)] = valor;
    this.error = undefined;
  }
  evaluar(): Map<string, ValorRuntime> {
    if (this.properties.enabled === false) return new Map();
    try {
      const codigo = this.properties.code?.trim();
      if (codigo && this.properties.codeLanguage === 'python') throw new Error('El código Python requiere evaluación asíncrona.');
      const resultado = codigo ? ejecutarJS(codigo, this.entradas) : evaluateGuard(this.properties.expression ?? '', this.entradas);
      if (resultado instanceof Promise) {
        this.error = 'Este código requiere evaluación asíncrona.';
        return new Map();
      }
      this.resultado = resultado;
      this.error = undefined;
    } catch (error) {
      this.resultado = undefined;
      this.error = error instanceof Error ? error.message : 'Error desconocido al ejecutar el bloque.';
    }
    const salidas = this.puertos.filter((puerto) => puerto.direction === 'output');
    return this.resultado === undefined ? new Map() : new Map(salidas.map((puerto) => [puerto.id, this.resultado as ValorRuntime]));
  }

  /** Evalúa también código aislado en Worker y espera su resultado. */
  async evaluarAsync(): Promise<Map<string, ValorRuntime>> {
    if (this.properties.enabled === false) return new Map();
    try {
      const codigo = this.properties.code?.trim();
      const resultado = codigo
        ? await Promise.resolve(this.properties.codeLanguage === 'python'
          ? ejecutarPython(codigo, this.entradas)
          : ejecutarJS(codigo, this.entradas))
        : evaluateGuard(this.properties.expression ?? '', this.entradas);
      this.resultado = resultado;
      this.error = undefined;
    } catch (error) {
      this.resultado = undefined;
      this.error = error instanceof Error ? error.message : 'Error desconocido al ejecutar el bloque.';
    }
    return this.obtenerSalidas();
  }

  private obtenerSalidas(): Map<string, ValorRuntime> {
    const salidas = this.puertos.filter((puerto) => puerto.direction === 'output');
    return this.resultado === undefined ? new Map() : new Map(salidas.map((puerto) => [puerto.id, this.resultado as ValorRuntime]));
  }
  reiniciar(): void { Object.keys(this.entradas).forEach((nombre) => delete this.entradas[nombre]); this.resultado = undefined; this.error = undefined; }
  obtenerEstado(): EstadoElemento { return { valor: this.resultado, ...(this.error ? { error: this.error } : {}) }; }
}
