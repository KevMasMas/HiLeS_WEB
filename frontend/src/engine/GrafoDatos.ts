import { HilesConnectionType } from '../types/hiles';
import type { IElementoHiLeS } from './elementos/interfaces';
import type { AristaHiLeS, NodoHiLeS, ValorRuntime } from './tipos';
import type { BusObserver } from './BusObserver';

/**
 * Una arista transporta datos (CCH/DCH) si no es un arco de la red de Petri.
 * Los arcos Petri los administra `EvaluadorPetri`, nunca este módulo.
 */
export const esAristaDatos = (arista: AristaHiLeS): boolean =>
  arista.data?.hilesConnectionType !== HilesConnectionType.PETRI
  && arista.data?.hilesConnectionType !== HilesConnectionType.TOKEN_FLOW;

export interface ResultadoOrdenTopologico {
  /**
   * Nodos ordenados para evaluación secuencial. Si el grafo tiene ciclos, los
   * nodos involucrados se añaden al final conservando el orden del canvas para
   * que la simulación siga siendo posible aunque se reporte el error.
   */
  orden: string[];
  hayCiclo: boolean;
  /** Nodos que el ordenamiento no pudo resolver por pertenecer a un ciclo. */
  nodosEnCiclo: string[];
}

/** Índice de aristas de datos válidas: ambas puntas deben existir en el canvas. */
const aristasDatosValidas = (
  nodos: readonly NodoHiLeS[],
  aristas: readonly AristaHiLeS[],
): AristaHiLeS[] => {
  const existentes = new Set(nodos.map((nodo) => nodo.id));
  return aristas.filter((arista) =>
    esAristaDatos(arista) && existentes.has(arista.source) && existentes.has(arista.target));
};

/**
 * Ordena los nodos de datos con el algoritmo de Kahn.
 *
 * El recorrido conserva el orden en que llegan los nodos, de modo que dos
 * ejecuciones del mismo circuito siempre producen la misma secuencia.
 */
export const construirOrdenTopologico = (
  nodos: readonly NodoHiLeS[],
  aristas: readonly AristaHiLeS[],
): ResultadoOrdenTopologico => {
  const identificadores = nodos.map((nodo) => nodo.id);
  const sucesores = new Map<string, string[]>(identificadores.map((id) => [id, []]));
  const gradoEntrada = new Map<string, number>(identificadores.map((id) => [id, 0]));

  aristasDatosValidas(nodos, aristas).forEach((arista) => {
    sucesores.get(arista.source)?.push(arista.target);
    gradoEntrada.set(arista.target, (gradoEntrada.get(arista.target) ?? 0) + 1);
  });

  const pendientes = identificadores.filter((id) => gradoEntrada.get(id) === 0);
  const orden: string[] = [];

  while (pendientes.length > 0) {
    const actual = pendientes.shift() as string;
    orden.push(actual);
    (sucesores.get(actual) ?? []).forEach((sucesor) => {
      const grado = (gradoEntrada.get(sucesor) ?? 0) - 1;
      gradoEntrada.set(sucesor, grado);
      if (grado === 0) pendientes.push(sucesor);
    });
  }

  const resueltos = new Set(orden);
  const nodosEnCiclo = identificadores.filter((id) => !resueltos.has(id));

  return {
    orden: [...orden, ...nodosEnCiclo],
    hayCiclo: nodosEnCiclo.length > 0,
    nodosEnCiclo,
  };
};

/**
 * Detecta los ciclos del flujo de datos con un recorrido en profundidad.
 *
 * Retorna cada ciclo como la lista de nodos que lo componen. Los ciclos
 * repetidos (encontrados desde distintos puntos de partida) se reportan una
 * sola vez gracias a la normalización por el nodo de menor identificador.
 */
export const detectarCiclos = (
  nodos: readonly NodoHiLeS[],
  aristas: readonly AristaHiLeS[],
): string[][] => {
  const sucesores = new Map<string, string[]>(nodos.map((nodo) => [nodo.id, []]));
  aristasDatosValidas(nodos, aristas).forEach((arista) => {
    sucesores.get(arista.source)?.push(arista.target);
  });

  const visitados = new Set<string>();
  const enPila = new Set<string>();
  const pila: string[] = [];
  const ciclos: string[][] = [];
  const clavesVistas = new Set<string>();

  /** Rota el ciclo hasta su nodo menor para poder compararlo y deduplicarlo. */
  const registrarCiclo = (ciclo: string[]): void => {
    const menor = ciclo.indexOf([...ciclo].sort()[0]);
    const normalizado = [...ciclo.slice(menor), ...ciclo.slice(0, menor)];
    const clave = normalizado.join(' -> ');
    if (clavesVistas.has(clave)) return;
    clavesVistas.add(clave);
    ciclos.push(normalizado);
  };

  const recorrer = (nodoId: string): void => {
    visitados.add(nodoId);
    enPila.add(nodoId);
    pila.push(nodoId);

    (sucesores.get(nodoId) ?? []).forEach((sucesor) => {
      if (enPila.has(sucesor)) {
        registrarCiclo(pila.slice(pila.indexOf(sucesor)));
        return;
      }
      if (!visitados.has(sucesor)) recorrer(sucesor);
    });

    pila.pop();
    enPila.delete(nodoId);
  };

  nodos.forEach((nodo) => {
    if (!visitados.has(nodo.id)) recorrer(nodo.id);
  });

  return ciclos;
};

/**
 * Estado compartido durante una propagación.
 *
 * El grafo no conoce el canvas: recibe las instancias lógicas y una función
 * para resolver el puerto de destino cuando la arista no lo especifica.
 */
export interface EstadoRuntimeGrafo {
  /** Instancia lógica de cada nodo, indexada por el id del nodo del editor. */
  elementos: ReadonlyMap<string, IElementoHiLeS>;
  /** Aristas del modelo; aquí solo se usan las de datos. */
  aristas: readonly AristaHiLeS[];
  /** Último valor publicado por cada nodo. La propagación lo actualiza. */
  valores: Map<string, ValorRuntime>;
  /**
   * Puerto de entrada que se usa cuando la arista no guarda `targetHandle`
   * (por ejemplo, en modelos importados de versiones antiguas).
   */
  puertoEntradaPorDefecto?: (nodoId: string) => string | undefined;
}

/** Evalúa un elemento y retorna sus salidas por puerto. */
export type EjecutorElemento = (
  elementoId: string,
  elemento: IElementoHiLeS,
) => Map<string, ValorRuntime>;

/** Variante que permite esperar código ejecutado dentro de un Web Worker. */
export type EjecutorElementoAsync = (
  elementoId: string,
  elemento: IElementoHiLeS,
) => Map<string, ValorRuntime> | Promise<Map<string, ValorRuntime>>;

/** Ejecutor estándar: delega en la lógica propia de cada elemento. */
export const ejecutorPorDefecto: EjecutorElemento = (_elementoId, elemento) => elemento.evaluar();

export const ejecutorAsyncPorDefecto: EjecutorElementoAsync = (_elementoId, elemento) =>
  elemento.evaluarAsync ? elemento.evaluarAsync() : elemento.evaluar();

/** Un valor que viajó de un puerto de salida a un puerto de entrada. */
export interface EntregaValor {
  aristaId: string;
  origenId: string;
  puertoOrigenId: string;
  destinoId: string;
  puertoDestinoId: string;
  valor: ValorRuntime;
}

export interface ErrorPropagacion {
  elementoId: string;
  mensaje: string;
}

export interface ResultadoPropagacion {
  /** Último valor publicado por cada nodo tras esta propagación. */
  valores: Map<string, ValorRuntime>;
  /** Nodos cuyo valor publicado cambió respecto a la propagación anterior. */
  nodosActualizados: string[];
  entregas: EntregaValor[];
  errores: ErrorPropagacion[];
}

/**
 * Recorre los nodos en orden topológico, evalúa cada uno y entrega sus salidas
 * a los elementos conectados por CCH/DCH (modo push).
 *
 * Como el orden garantiza que un nodo se evalúa después de sus predecesores,
 * un solo recorrido basta para que el dato atraviese toda la cadena de bloques.
 */
export const propagarValores = (
  orden: readonly string[],
  estadoRuntime: EstadoRuntimeGrafo,
  ejecutor: EjecutorElemento = ejecutorPorDefecto,
  bus?: BusObserver
): ResultadoPropagacion => {
  const { elementos, valores } = estadoRuntime;
  const aristasDatos = estadoRuntime.aristas.filter(esAristaDatos);
  const nodosActualizados: string[] = [];
  const entregas: EntregaValor[] = [];
  const errores: ErrorPropagacion[] = [];

  orden.forEach((elementoId) => {
    const elemento = elementos.get(elementoId);
    if (!elemento) return;

    let salidas: Map<string, ValorRuntime>;
    try {
      salidas = ejecutor(elementoId, elemento);
    } catch (error) {
      errores.push({
        elementoId,
        mensaje: error instanceof Error ? error.message : 'Fallo desconocido al evaluar el elemento.',
      });
      return;
    }

    const errorInterno = elemento.obtenerEstado().error;
    if (errorInterno) errores.push({ elementoId, mensaje: errorInterno });

    salidas.forEach((valor, puertoOrigenId) => {
      if (valores.get(elementoId) !== valor) {
        valores.set(elementoId, valor);
        if (!nodosActualizados.includes(elementoId)) nodosActualizados.push(elementoId);
      }

      if (bus) {
        // Uso del patrón Observer: el bus notifica a todos los suscriptores conectados.
        bus.notificar(elementoId, puertoOrigenId, valor);
      } else {
        // Lógica antigua: acoplamiento directo mediante recorrido de aristas.
        aristasDatos
          .filter((arista) => arista.source === elementoId
            && (!arista.sourceHandle || arista.sourceHandle === puertoOrigenId))
          .forEach((arista) => {
            const destino = elementos.get(arista.target);
            if (!destino) return;

            const puertoDestinoId = arista.targetHandle
              ?? estadoRuntime.puertoEntradaPorDefecto?.(arista.target);
            if (!puertoDestinoId) {
              errores.push({
                elementoId: arista.target,
                mensaje: 'La conexión de datos no indica a qué puerto de entrada llega el valor.',
              });
              return;
            }

            destino.recibirEntrada(puertoDestinoId, valor);
            entregas.push({
              aristaId: arista.id,
              origenId: elementoId,
              puertoOrigenId,
              destinoId: arista.target,
              puertoDestinoId,
              valor,
            });
          });
      }
    });
  });

  return { valores, nodosActualizados, entregas, errores };
};

/**
 * Propagación push equivalente a `propagarValores`, esperando en orden las
 * evaluaciones aisladas. Una función completa termina antes de evaluar el
 * siguiente nodo del grafo.
 */
export const propagarValoresAsync = async (
  orden: readonly string[],
  estadoRuntime: EstadoRuntimeGrafo,
  ejecutor: EjecutorElementoAsync = ejecutorAsyncPorDefecto,
  bus?: BusObserver,
): Promise<ResultadoPropagacion> => {
  const { elementos, valores } = estadoRuntime;
  const aristasDatos = estadoRuntime.aristas.filter(esAristaDatos);
  const nodosActualizados: string[] = [];
  const entregas: EntregaValor[] = [];
  const errores: ErrorPropagacion[] = [];

  for (const elementoId of orden) {
    const elemento = elementos.get(elementoId);
    if (!elemento) continue;

    let salidas: Map<string, ValorRuntime>;
    try {
      salidas = await ejecutor(elementoId, elemento);
    } catch (error) {
      errores.push({
        elementoId,
        mensaje: error instanceof Error ? error.message : 'Fallo desconocido al evaluar el elemento.',
      });
      continue;
    }

    const errorInterno = elemento.obtenerEstado().error;
    if (errorInterno) errores.push({ elementoId, mensaje: errorInterno });

    salidas.forEach((valor, puertoOrigenId) => {
      if (valores.get(elementoId) !== valor) {
        valores.set(elementoId, valor);
        nodosActualizados.push(elementoId);
      }

      if (bus) {
        bus.notificar(elementoId, puertoOrigenId, valor);
        return;
      }

      aristasDatos
        .filter((arista) => arista.source === elementoId
          && (!arista.sourceHandle || arista.sourceHandle === puertoOrigenId))
        .forEach((arista) => {
          const destino = elementos.get(arista.target);
          const puertoDestinoId = arista.targetHandle
            ?? estadoRuntime.puertoEntradaPorDefecto?.(arista.target);
          if (!destino || !puertoDestinoId) {
            errores.push({
              elementoId: arista.target,
              mensaje: 'La conexión de datos no indica a qué puerto de entrada llega el valor.',
            });
            return;
          }
          destino.recibirEntrada(puertoDestinoId, valor);
          entregas.push({
            aristaId: arista.id,
            origenId: elementoId,
            puertoOrigenId,
            destinoId: arista.target,
            puertoDestinoId,
            valor,
          });
        });
    });
  }

  return { valores, nodosActualizados, entregas, errores };
};

