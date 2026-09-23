import type { Edge, Node } from '@xyflow/react';
import type { HilesEdgeData, HilesNodeData } from '../types/hiles';

// El motor reutiliza los tipos que ya definió la capa de elementos para que
// exista una única fuente de verdad sobre qué es un valor y qué es un estado.
export type { EstadoElemento, PuertoInfo, ValorRuntime } from './elementos/interfaces';
import type { EstadoElemento, ValorRuntime } from './elementos/interfaces';

/** Nodo del editor tal como lo entrega React Flow. */
export type NodoHiLeS = Node<HilesNodeData>;

/** Arista del editor tal como la entrega React Flow. */
export type AristaHiLeS = Edge<HilesEdgeData>;

/**
 * Categorías de evento que registra la cola de auditoría.
 *
 * Se modelan como objeto constante (igual que `HilesElementType`) para poder
 * usarlas como valor en el código y como tipo en las firmas.
 */
export const TipoEventoSimulacion = {
  /** El motor construyó el grafo de elementos a partir del canvas. */
  CONSTRUCCION: 'construccion',
  /** El usuario inyectó un valor en un Service. */
  ENTRADA: 'entrada',
  /** Comienza un nuevo paso de simulación. */
  PASO: 'paso',
  /** Un elemento publicó un valor por uno de sus puertos de salida. */
  PROPAGACION: 'propagacion',
  /** Una Transition disparó y movió tokens. */
  DISPARO: 'disparo',
  /** Más de una Transition estaba habilitada: los tokens se conservan. */
  CONFLICTO: 'conflicto',
  /** La simulación dejó de producir cambios. */
  ESTABILIZACION: 'estabilizacion',
  /** El estado volvió al inicial. */
  REINICIO: 'reinicio',
  /** Un elemento o el propio motor reportó un fallo. */
  ERROR: 'error',
} as const;

export type TipoEventoSimulacion = (typeof TipoEventoSimulacion)[keyof typeof TipoEventoSimulacion];

/**
 * Registro inmutable de algo que ocurrió durante la simulación.
 *
 * `indice` es monotónico dentro de una ejecución y garantiza que la cola pueda
 * ordenarse aunque varios eventos compartan la misma marca de tiempo.
 */
export interface EventoSimulacion {
  /** Identificador estable y determinista: `evt-<indice>`. */
  readonly id: string;
  /** Posición del evento dentro de la cola. */
  readonly indice: number;
  /** Paso de simulación en el que ocurrió (0 = antes del primer paso). */
  readonly paso: number;
  readonly tipo: TipoEventoSimulacion;
  readonly mensaje: string;
  /** Nodo involucrado, cuando el evento se refiere a un elemento concreto. */
  readonly elementoId?: string;
  /** Nombre legible del nodo, para mostrarlo sin consultar el canvas. */
  readonly elementoNombre?: string;
  /** Valor asociado al evento (dato publicado, entrada inyectada, etc.). */
  readonly valor?: ValorRuntime;
  readonly marcaTiempo: number;
}

/** Fases por las que pasa el motor; la UI las usa para pintar el indicador. */
export const EstadoSimulacion = {
  /** Todavía no hay un grafo construido. */
  INACTIVA: 'inactiva',
  /** Hay grafo construido y el motor espera una entrada. */
  LISTA: 'lista',
  /** El último paso produjo cambios: aún puede avanzar. */
  EJECUTANDO: 'ejecutando',
  /** El último paso no produjo ningún cambio. */
  ESTABILIZADA: 'estabilizada',
  /** El grafo o la ejecución tienen un problema que impide continuar. */
  ERROR: 'error',
} as const;

export type EstadoSimulacion = (typeof EstadoSimulacion)[keyof typeof EstadoSimulacion];

/** Resultado de `MotorSimulacion.paso()`. */
export interface ResultadoPaso {
  /** Número de paso ejecutado. */
  paso: number;
  /** `true` si el estado del circuito cambió respecto al paso anterior. */
  cambio: boolean;
  /** Transitions que dispararon durante el paso. */
  transicionesDisparadas: string[];
  /** `true` si hubo más de una Transition habilitada. */
  conflicto: boolean;
  /** Eventos generados exclusivamente por este paso. */
  eventos: EventoSimulacion[];
}

/** Resultado de `MotorSimulacion.ejecutar()`. */
export interface ResultadoEjecucion {
  /** Pasos ejecutados en esta llamada. */
  pasosEjecutados: number;
  /** `true` si el circuito dejó de cambiar antes de agotar el límite. */
  estabilizado: boolean;
  estado: EstadoSimulacion;
  eventos: EventoSimulacion[];
}

/** Resultado de `MotorSimulacion.inyectarEntrada()`. */
export interface ResultadoInyeccion {
  exito: boolean;
  mensaje: string;
}

/** Descripción de un Service al que la UI puede inyectarle un valor. */
export interface ServicioInyectable {
  id: string;
  nombre: string;
  /** Tipo de dato del primer puerto de salida, para elegir el control de la UI. */
  tipoDato: string;
}

/**
 * Fotografía del estado observable del circuito.
 * El motor la usa para decidir si un paso produjo cambios y la UI para pintar.
 */
export interface InstantaneaSimulacion {
  estados: Record<string, EstadoElemento>;
  valores: Record<string, ValorRuntime>;
}

/** Tope de pasos de `ejecutar()`: evita bloquear la UI con un circuito oscilante. */
export const LIMITE_PASOS_POR_DEFECTO = 50;
