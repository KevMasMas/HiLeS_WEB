import type { Edge } from '@xyflow/react';
import { HilesConnectionType } from '../types/hiles';
import type { HilesEdgeData } from '../types/hiles';
import { ElementoLugar } from './elementos/ElementoLugar';
import { ElementoTransicion } from './elementos/ElementoTransicion';
import type { IElementoHiLeS } from './elementos/interfaces';

export type MapaElementos = ReadonlyMap<string, IElementoHiLeS>;
export type AristaHiLeS = Edge<HilesEdgeData>;

export interface ResultadoDisparoPetri {
  exito: boolean;
  transicionId: string;
  mensaje: string;
  lugaresEntrada: string[];
  lugaresSalida: string[];
}

export interface ResultadoEvaluacionPetri {
  transicionesHabilitadas: string[];
  transicionDisparada?: string;
  conflicto: boolean;
  mensaje: string;
}

interface ArcosTransicion {
  entradas: Map<string, number>;
  salidas: Map<string, number>;
}

const esArcoPetri = (arista: AristaHiLeS): boolean =>
  arista.data?.hilesConnectionType === HilesConnectionType.PETRI
  || arista.data?.hilesConnectionType === HilesConnectionType.TOKEN_FLOW;

/** Los pesos inválidos se normalizan a uno para conservar compatibilidad. */
const pesoArista = (arista: AristaHiLeS): number => {
  const peso = arista.data?.weight ?? 1;
  return Number.isInteger(peso) && peso > 0 ? peso : 1;
};

const sumarPeso = (pesos: Map<string, number>, lugarId: string, peso: number): void => {
  pesos.set(lugarId, (pesos.get(lugarId) ?? 0) + peso);
};

const obtenerArcos = (
  transicionId: string,
  elementos: MapaElementos,
  aristas: readonly AristaHiLeS[],
): ArcosTransicion => {
  const entradas = new Map<string, number>();
  const salidas = new Map<string, number>();

  aristas.filter(esArcoPetri).forEach((arista) => {
    if (arista.target === transicionId && elementos.get(arista.source) instanceof ElementoLugar) {
      sumarPeso(entradas, arista.source, pesoArista(arista));
    }
    if (arista.source === transicionId && elementos.get(arista.target) instanceof ElementoLugar) {
      sumarPeso(salidas, arista.target, pesoArista(arista));
    }
  });

  return { entradas, salidas };
};

/**
 * Comprueba el marcado completo antes de mover tokens.
 * También contempla un Place conectado como entrada y salida de la misma
 * Transition, evaluando el resultado neto de forma atómica.
 */
const puedeMoverTokens = (arcos: ArcosTransicion, elementos: MapaElementos): boolean => {
  if (arcos.entradas.size === 0 || arcos.salidas.size === 0) return false;

  const lugares = new Set([...arcos.entradas.keys(), ...arcos.salidas.keys()]);
  return [...lugares].every((lugarId) => {
    const lugar = elementos.get(lugarId);
    if (!(lugar instanceof ElementoLugar)) return false;

    const consumo = arcos.entradas.get(lugarId) ?? 0;
    const produccion = arcos.salidas.get(lugarId) ?? 0;
    const tokensActuales = lugar.obtenerCantidadTokens();
    const tokensFinales = tokensActuales - consumo + produccion;
    return tokensActuales >= consumo
      && tokensFinales >= 0
      && tokensFinales <= lugar.obtenerCapacidad();
  });
};

/** Retorna las Transitions que tienen guarda verdadera y pueden mover tokens. */
export const obtenerTransicionesHabilitadas = (
  elementos: MapaElementos,
  aristas: readonly AristaHiLeS[],
): string[] => [...elementos.entries()]
  .filter(([transicionId, elemento]) => {
    if (!(elemento instanceof ElementoTransicion) || !elemento.estaHabilitada()) return false;
    return puedeMoverTokens(obtenerArcos(transicionId, elementos, aristas), elementos);
  })
  .map(([transicionId]) => transicionId);

/**
 * Dispara una Transition de manera atómica: primero valida todos los Places y
 * solo después consume y produce la totalidad de los tokens.
 */
export const dispararTransicion = (
  transicionId: string,
  elementos: MapaElementos,
  aristas: readonly AristaHiLeS[],
): ResultadoDisparoPetri => {
  const transicion = elementos.get(transicionId);
  const resultadoBase = { transicionId, lugaresEntrada: [] as string[], lugaresSalida: [] as string[] };

  if (!(transicion instanceof ElementoTransicion)) {
    return { ...resultadoBase, exito: false, mensaje: `No existe la Transition ${transicionId}.` };
  }
  if (!transicion.estaHabilitada()) {
    return { ...resultadoBase, exito: false, mensaje: `La Transition ${transicionId} no tiene una condición verdadera.` };
  }

  const arcos = obtenerArcos(transicionId, elementos, aristas);
  const lugaresEntrada = [...arcos.entradas.keys()];
  const lugaresSalida = [...arcos.salidas.keys()];
  const resultadoConLugares = { transicionId, lugaresEntrada, lugaresSalida };

  if (lugaresEntrada.length === 0 || lugaresSalida.length === 0) {
    return { ...resultadoConLugares, exito: false, mensaje: 'La Transition requiere al menos un arco Petri de entrada y uno de salida.' };
  }
  if (!puedeMoverTokens(arcos, elementos)) {
    return { ...resultadoConLugares, exito: false, mensaje: 'No hay tokens suficientes o los Places de salida alcanzaron su capacidad.' };
  }

  arcos.entradas.forEach((cantidad, lugarId) => {
    (elementos.get(lugarId) as ElementoLugar).consumirToken(cantidad);
  });
  arcos.salidas.forEach((cantidad, lugarId) => {
    (elementos.get(lugarId) as ElementoLugar).producirToken(cantidad);
  });
  transicion.marcarDisparo();

  return {
    ...resultadoConLugares,
    exito: true,
    mensaje: `La Transition ${transicionId} disparó correctamente.`,
  };
};

/**
 * Evalúa un ciclo Petri aplicando la política acordada para conflictos: si más
 * de una Transition está habilitada, no se mueve ningún token.
 */
export const evaluarRedPetri = (
  elementos: MapaElementos,
  aristas: readonly AristaHiLeS[],
): ResultadoEvaluacionPetri => {
  const transicionesHabilitadas = obtenerTransicionesHabilitadas(elementos, aristas);
  if (transicionesHabilitadas.length === 0) {
    return { transicionesHabilitadas, conflicto: false, mensaje: 'No hay Transitions habilitadas.' };
  }
  if (transicionesHabilitadas.length > 1) {
    return {
      transicionesHabilitadas,
      conflicto: true,
      mensaje: 'Hay más de una Transition habilitada; los tokens se conservan.',
    };
  }

  const transicionId = transicionesHabilitadas[0];
  const resultado = dispararTransicion(transicionId, elementos, aristas);
  return {
    transicionesHabilitadas,
    ...(resultado.exito ? { transicionDisparada: transicionId } : {}),
    conflicto: false,
    mensaje: resultado.mensaje,
  };
};

/** API orientada a objetos para que MotorSimulacion pueda reutilizar el evaluador. */
export class EvaluadorPetri {
  obtenerTransicionesHabilitadas(elementos: MapaElementos, aristas: readonly AristaHiLeS[]): string[] {
    return obtenerTransicionesHabilitadas(elementos, aristas);
  }

  dispararTransicion(
    transicionId: string,
    elementos: MapaElementos,
    aristas: readonly AristaHiLeS[],
  ): ResultadoDisparoPetri {
    return dispararTransicion(transicionId, elementos, aristas);
  }

  evaluar(elementos: MapaElementos, aristas: readonly AristaHiLeS[]): ResultadoEvaluacionPetri {
    return evaluarRedPetri(elementos, aristas);
  }
}
