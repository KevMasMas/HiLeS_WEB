import { HilesElementType } from '../types/hiles';
import { BusObserver } from './BusObserver';
import { crearElemento } from './elementos';
import { ElementoService } from './elementos/ElementoService';
import type { IElementoHiLeS } from './elementos/interfaces';
import { evaluarRedPetri } from './EvaluadorPetri';
import { construirOrdenTopologico, detectarCiclos, propagarValoresAsync } from './GrafoDatos';
import type { EjecutorElementoAsync } from './GrafoDatos';
import {
  EstadoSimulacion,
  LIMITE_PASOS_POR_DEFECTO,
  TipoEventoSimulacion,
} from './tipos';
import type {
  AristaHiLeS,
  EstadoElemento,
  EventoSimulacion,
  InstantaneaSimulacion,
  NodoHiLeS,
  ResultadoEjecucion,
  ResultadoInyeccion,
  ResultadoPaso,
  ServicioInyectable,
  ValorRuntime,
} from './tipos';

export interface OpcionesMotor {
  /** Tope de pasos de `ejecutar()` antes de declarar que el circuito oscila. */
  limitePasos?: number;
  /** Permite instrumentar o sustituir la evaluación de cada elemento (tests). */
  ejecutor?: EjecutorElementoAsync;
}

/** Tipos que existen en el editor pero no tienen lógica de ejecución propia. */
const TIPOS_SIN_LOGICA: readonly HilesElementType[] = [
  HilesElementType.PORT,
  HilesElementType.TOKEN,
];

/**
 * Orquestador de la simulación HiLeS.
 *
 * Toma los nodos y aristas del editor, construye una instancia lógica por
 * elemento y ejecuta ciclos completos: primero propaga los datos por los
 * canales CCH/DCH y después evalúa la red de Petri. Cada acción relevante
 * queda registrada en una cola de eventos para poder auditar la ejecución.
 *
 * El motor no conoce ningún identificador concreto: todo se resuelve a partir
 * del modelo que recibe, de modo que funciona con cualquier circuito que el
 * usuario dibuje.
 */
export class MotorSimulacion {
  private readonly limitePasos: number;
  private readonly ejecutor?: EjecutorElementoAsync;
  private readonly bus = new BusObserver();

  private nodos: NodoHiLeS[] = [];
  private aristas: AristaHiLeS[] = [];
  /** Instancia lógica de cada nodo ejecutable, indexada por id del editor. */
  private elementos = new Map<string, IElementoHiLeS>();
  /** Nombre legible de cada nodo, para que los eventos no dependan del canvas. */
  private nombres = new Map<string, string>();
  /** Orden topológico del flujo de datos calculado al construir el grafo. */
  private orden: string[] = [];
  /** Último valor publicado por cada nodo. */
  private valores = new Map<string, ValorRuntime>();
  /** Errores ya reportados, para no repetir el mismo mensaje en cada paso. */
  private erroresReportados = new Map<string, string>();

  private eventos: EventoSimulacion[] = [];
  private contadorEventos = 0;
  private contadorPasos = 0;
  private estado: EstadoSimulacion = EstadoSimulacion.INACTIVA;

  constructor(opciones: OpcionesMotor = {}) {
    this.limitePasos = opciones.limitePasos ?? LIMITE_PASOS_POR_DEFECTO;
    this.ejecutor = opciones.ejecutor;
  }

  // ---------------------------------------------------------------------
  // Construcción del grafo
  // ---------------------------------------------------------------------

  /**
   * Construye una instancia `IElementoHiLeS` por cada nodo ejecutable del
   * canvas y calcula el orden en que deben evaluarse.
   *
   * Reemplaza por completo el grafo anterior: la cola de eventos, los valores
   * y el contador de pasos vuelven a cero.
   */
  construirGrafo(nodos: readonly NodoHiLeS[], aristas: readonly AristaHiLeS[]): void {
    this.nodos = [...nodos];
    this.aristas = [...aristas];
    this.elementos = new Map();
    this.nombres = new Map();
    this.valores = new Map();
    this.erroresReportados = new Map();
    this.eventos = [];
    this.contadorEventos = 0;
    this.contadorPasos = 0;
    this.estado = EstadoSimulacion.INACTIVA;

    const fallidos: string[] = [];

    this.nodos.forEach((nodo) => {
      const tipo = nodo.data.hilesType;
      this.nombres.set(nodo.id, nodo.data.name);
      if (TIPOS_SIN_LOGICA.includes(tipo)) return;

      try {
        this.elementos.set(nodo.id, crearElemento(tipo, {
          properties: nodo.data.properties,
          ports: nodo.data.ports,
          hijos: this.nodos.filter((hijo) => hijo.parentId === nodo.id).map((hijo) => hijo.id),
        }));
      } catch (error) {
        fallidos.push(nodo.id);
        this.registrar({
          tipo: TipoEventoSimulacion.ERROR,
          elementoId: nodo.id,
          mensaje: error instanceof Error
            ? `No se pudo crear ${nodo.data.name}: ${error.message}`
            : `No se pudo crear ${nodo.data.name}.`,
        });
      }
    });

    const resultadoOrden = construirOrdenTopologico(this.nodos, this.aristas);
    this.orden = resultadoOrden.orden.filter((id) => this.elementos.has(id));

    this.registrar({
      tipo: TipoEventoSimulacion.CONSTRUCCION,
      mensaje: `Grafo construido con ${this.elementos.size} elemento(s) y ${this.aristas.length} conexión(es).`,
    });

    if (resultadoOrden.hayCiclo) {
      detectarCiclos(this.nodos, this.aristas).forEach((ciclo) => {
        this.registrar({
          tipo: TipoEventoSimulacion.ERROR,
          mensaje: `Ciclo en el flujo de datos: ${ciclo.map((id) => this.nombreDe(id)).join(' → ')} → ${this.nombreDe(ciclo[0])}.`,
        });
      });
    }

    if (fallidos.length > 0 || resultadoOrden.hayCiclo) {
      this.estado = EstadoSimulacion.ERROR;
      return;
    }

    // El bus vincula a los observadores ahora que todos los elementos existen.
    this.bus.construirDesdeAristas(this.aristas, this.elementos, (nodoId) => this.primerPuertoEntrada(nodoId));

    this.estado = this.elementos.size > 0 ? EstadoSimulacion.LISTA : EstadoSimulacion.INACTIVA;
  }

  // ---------------------------------------------------------------------
  // Entrada del usuario
  // ---------------------------------------------------------------------

  /**
   * Punto de entrada del usuario: coloca un valor en un Service para que el
   * siguiente paso lo publique hacia el circuito.
   */
  inyectarEntrada(servicioId: string, valor: ValorRuntime): ResultadoInyeccion {
    const elemento = this.elementos.get(servicioId);
    if (!(elemento instanceof ElementoService)) {
      const mensaje = 'Solo se puede inyectar un valor en un Service.';
      this.registrar({ tipo: TipoEventoSimulacion.ERROR, elementoId: servicioId, mensaje });
      return { exito: false, mensaje };
    }

    const nodo = this.nodos.find((item) => item.id === servicioId);
    if (!nodo?.data.ports.some((puerto) => puerto.direction === 'output')) {
      const mensaje = `${this.nombreDe(servicioId)} necesita al menos un puerto de salida para inyectar valores.`;
      this.registrar({ tipo: TipoEventoSimulacion.ERROR, elementoId: servicioId, mensaje });
      return { exito: false, mensaje };
    }

    elemento.establecerValor(valor);
    const mensaje = `${this.nombreDe(servicioId)} recibió ${String(valor)}.`;
    this.registrar({ tipo: TipoEventoSimulacion.ENTRADA, elementoId: servicioId, mensaje, valor });
    // Queda trabajo pendiente: el valor todavía no ha recorrido el circuito.
    this.estado = EstadoSimulacion.EJECUTANDO;
    return { exito: true, mensaje };
  }

  // ---------------------------------------------------------------------
  // Ejecución
  // ---------------------------------------------------------------------

  /**
   * Ejecuta un ciclo completo: propaga los datos en orden topológico y después
   * evalúa la red de Petri con el marcado resultante.
   *
   * La acción que publica una Transition al disparar viaja en el paso
   * siguiente, igual que cualquier otro dato del circuito.
   */
  async paso(): Promise<ResultadoPaso> {
    const indiceInicial = this.eventos.length;

    if (this.elementos.size === 0) {
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        mensaje: 'No hay ningún elemento que simular: construye primero el grafo.',
      });
      return {
        paso: this.contadorPasos,
        cambio: false,
        transicionesDisparadas: [],
        conflicto: false,
        eventos: this.eventos.slice(indiceInicial),
      };
    }

    this.contadorPasos += 1;
    const instantaneaAntes = this.serializarInstantanea();
    this.registrar({ tipo: TipoEventoSimulacion.PASO, mensaje: `Inicio del paso ${this.contadorPasos}.` });

    // 1. Flujo de datos (CCH/DCH) en modo push.
    const propagacion = await propagarValoresAsync(
      this.orden,
      {
        elementos: this.elementos,
        aristas: this.aristas,
        valores: this.valores,
        puertoEntradaPorDefecto: (nodoId) => this.primerPuertoEntrada(nodoId),
      },
      this.ejecutor,
      this.bus
    );

    propagacion.nodosActualizados.forEach((nodoId) => {
      this.registrar({
        tipo: TipoEventoSimulacion.PROPAGACION,
        elementoId: nodoId,
        valor: this.valores.get(nodoId),
        mensaje: `${this.nombreDe(nodoId)} publicó ${String(this.valores.get(nodoId))}.`,
      });
    });

    propagacion.errores.forEach((error) => {
      // Solo se reporta un error nuevo: un fallo persistente no debe llenar la cola.
      if (this.erroresReportados.get(error.elementoId) === error.mensaje) return;
      this.erroresReportados.set(error.elementoId, error.mensaje);
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        elementoId: error.elementoId,
        mensaje: `${this.nombreDe(error.elementoId)}: ${error.mensaje}`,
      });
    });
    // Un elemento que dejó de fallar puede volver a reportar en el futuro.
    const conError = new Set(propagacion.errores.map((error) => error.elementoId));
    [...this.erroresReportados.keys()]
      .filter((elementoId) => !conError.has(elementoId))
      .forEach((elementoId) => this.erroresReportados.delete(elementoId));

    // 2. Red de Petri: guardas + marcado.
    const resultadoPetri = evaluarRedPetri(this.elementos, this.aristas);
    const transicionesDisparadas = resultadoPetri.transicionDisparada ? [resultadoPetri.transicionDisparada] : [];

    if (resultadoPetri.conflicto) {
      this.registrar({
        tipo: TipoEventoSimulacion.CONFLICTO,
        mensaje: `Conflicto entre ${resultadoPetri.transicionesHabilitadas.map((id) => this.nombreDe(id)).join(', ')}: los tokens se conservan.`,
      });
    } else if (resultadoPetri.transicionDisparada) {
      this.registrar({
        tipo: TipoEventoSimulacion.DISPARO,
        elementoId: resultadoPetri.transicionDisparada,
        mensaje: `${this.nombreDe(resultadoPetri.transicionDisparada)} disparó y movió los tokens.`,
      });
    }

    const cambio = this.serializarInstantanea() !== instantaneaAntes;
    if (propagacion.errores.length > 0) {
      this.estado = EstadoSimulacion.ERROR;
    } else if (cambio) {
      this.estado = EstadoSimulacion.EJECUTANDO;
    } else {
      this.estado = EstadoSimulacion.ESTABILIZADA;
      this.registrar({
        tipo: TipoEventoSimulacion.ESTABILIZACION,
        mensaje: `El circuito se estabilizó en el paso ${this.contadorPasos}.`,
      });
    }

    return {
      paso: this.contadorPasos,
      cambio,
      transicionesDisparadas,
      conflicto: resultadoPetri.conflicto,
      eventos: this.eventos.slice(indiceInicial),
    };
  }

  /**
   * Ejecuta pasos hasta que el circuito deje de cambiar, aparezca un error o se
   * alcance el límite configurado (un circuito oscilante nunca se estabiliza).
   */
  async ejecutar(limitePasos: number = this.limitePasos): Promise<ResultadoEjecucion> {
    const indiceInicial = this.eventos.length;
    let pasosEjecutados = 0;
    let estabilizado = false;

    while (pasosEjecutados < limitePasos) {
      const resultado = await this.paso();
      pasosEjecutados += 1;
      if (this.estado === EstadoSimulacion.ERROR) break;
      if (!resultado.cambio) {
        estabilizado = true;
        break;
      }
    }

    if (!estabilizado && this.estado !== EstadoSimulacion.ERROR) {
      this.estado = EstadoSimulacion.ERROR;
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        mensaje: `El circuito no se estabilizó tras ${limitePasos} paso(s); puede estar oscilando.`,
      });
    }

    return {
      pasosEjecutados,
      estabilizado,
      estado: this.estado,
      eventos: this.eventos.slice(indiceInicial),
    };
  }

  /**
   * Restaura el estado exacto del inicio: tokens iniciales de cada Place, sin
   * valores propagados, sin entradas inyectadas y con la cola de eventos vacía.
   */
  reiniciar(): void {
    this.elementos.forEach((elemento) => elemento.reiniciar());
    this.valores = new Map();
    this.erroresReportados = new Map();
    this.eventos = [];
    this.contadorEventos = 0;
    this.contadorPasos = 0;
    this.estado = this.elementos.size > 0 ? EstadoSimulacion.LISTA : EstadoSimulacion.INACTIVA;
    this.registrar({ tipo: TipoEventoSimulacion.REINICIO, mensaje: 'Simulación reiniciada al estado inicial.' });
  }

  // ---------------------------------------------------------------------
  // Consulta del estado
  // ---------------------------------------------------------------------

  /** Cola de eventos en orden cronológico (copia defensiva). */
  obtenerEventos(): EventoSimulacion[] {
    return [...this.eventos];
  }

  obtenerEstado(): EstadoSimulacion {
    return this.estado;
  }

  obtenerContadorPasos(): number {
    return this.contadorPasos;
  }

  /** Último valor publicado por cada nodo. */
  obtenerValores(): Map<string, ValorRuntime> {
    return new Map(this.valores);
  }

  /** Estado que cada elemento quiere mostrar en el canvas. */
  obtenerEstadosElementos(): Map<string, EstadoElemento> {
    return new Map([...this.elementos.entries()].map(([id, elemento]) => [id, elemento.obtenerEstado()]));
  }

  /** Fotografía completa lista para volcar sobre el canvas. */
  obtenerInstantanea(): InstantaneaSimulacion {
    return {
      estados: Object.fromEntries(this.obtenerEstadosElementos()),
      valores: Object.fromEntries(this.valores),
    };
  }

  /** Services con puerto de salida: son los que aceptan una entrada del usuario. */
  obtenerServiciosInyectables(): ServicioInyectable[] {
    return this.nodos
      .filter((nodo) => nodo.data.hilesType === HilesElementType.SERVICE
        && nodo.data.ports.some((puerto) => puerto.direction === 'output'))
      .map((nodo) => ({
        id: nodo.id,
        nombre: nodo.data.name,
        tipoDato: nodo.data.ports.find((puerto) => puerto.direction === 'output')?.dataType ?? 'real',
      }));
  }

  // ---------------------------------------------------------------------
  // Utilidades internas
  // ---------------------------------------------------------------------

  private nombreDe(nodoId: string): string {
    return this.nombres.get(nodoId) ?? nodoId;
  }

  /** Primer puerto de entrada de un nodo; respaldo para aristas sin handle. */
  private primerPuertoEntrada(nodoId: string): string | undefined {
    return this.nodos
      .find((nodo) => nodo.id === nodoId)?.data.ports
      .find((puerto) => puerto.direction === 'input')?.id;
  }

  /**
   * Serializa el estado observable para detectar si un paso produjo cambios.
   * Compara tokens, valores y errores, que es exactamente lo que ve el usuario.
   */
  private serializarInstantanea(): string {
    return JSON.stringify(this.obtenerInstantanea());
  }

  /** Añade un evento a la cola con índice, paso y marca de tiempo. */
  private registrar(evento: {
    tipo: EventoSimulacion['tipo'];
    mensaje: string;
    elementoId?: string;
    valor?: ValorRuntime;
  }): void {
    const indice = this.contadorEventos;
    this.contadorEventos += 1;
    this.eventos.push({
      id: `evt-${indice}`,
      indice,
      paso: this.contadorPasos,
      tipo: evento.tipo,
      mensaje: evento.mensaje,
      marcaTiempo: Date.now(),
      ...(evento.elementoId ? { elementoId: evento.elementoId, elementoNombre: this.nombreDe(evento.elementoId) } : {}),
      ...(evento.valor !== undefined ? { valor: evento.valor } : {}),
    });
  }
}
