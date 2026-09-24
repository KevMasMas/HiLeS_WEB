import { describe, expect, it } from 'vitest';
import { HilesConnectionType } from '../../types/hiles';
import { evaluarRedPetri, dispararTransicion, obtenerTransicionesHabilitadas } from '../EvaluadorPetri';
import { ElementoLugar } from '../elementos/ElementoLugar';
import { ElementoTransicion } from '../elementos/ElementoTransicion';
import type { IElementoHiLeS } from '../elementos/interfaces';
import { arista } from './fixtures';

const red = (tokensEntrada = 1, tokensSalida = 0) => {
  const entrada = new ElementoLugar({ tokensIniciales: tokensEntrada, maxTokens: 1 });
  const salida = new ElementoLugar({ tokensIniciales: tokensSalida, maxTokens: 1 });
  const transicion = new ElementoTransicion();
  transicion.recibirEntrada('transition-condition-in', true);
  const elementos = new Map<string, IElementoHiLeS>([
    ['entrada', entrada], ['transicion', transicion], ['salida', salida],
  ]);
  const aristas = [
    arista('a1', 'entrada', 'transicion', HilesConnectionType.PETRI),
    arista('a2', 'transicion', 'salida', HilesConnectionType.PETRI),
  ];
  return { entrada, salida, transicion, elementos, aristas };
};

describe('EvaluadorPetri', () => {
  it('dispara atómicamente cuando hay guarda, token y capacidad', () => {
    const escenario = red();
    expect(dispararTransicion('transicion', escenario.elementos, escenario.aristas).exito).toBe(true);
    expect(escenario.entrada.obtenerCantidadTokens()).toBe(0);
    expect(escenario.salida.obtenerCantidadTokens()).toBe(1);
  });

  it('no habilita la transición sin token de entrada', () => {
    const escenario = red(0, 0);
    expect(obtenerTransicionesHabilitadas(escenario.elementos, escenario.aristas)).toEqual([]);
  });

  it('no habilita la transición cuando la salida está llena', () => {
    const escenario = red(1, 1);
    expect(obtenerTransicionesHabilitadas(escenario.elementos, escenario.aristas)).toEqual([]);
  });

  it('conserva tokens cuando hay dos transiciones habilitadas', () => {
    const entrada = new ElementoLugar({ tokensIniciales: 1, maxTokens: 1 });
    const salida1 = new ElementoLugar({ maxTokens: 1 });
    const salida2 = new ElementoLugar({ maxTokens: 1 });
    const t1 = new ElementoTransicion();
    const t2 = new ElementoTransicion();
    t1.recibirEntrada('transition-condition-in', true);
    t2.recibirEntrada('transition-condition-in', true);
    const elementos = new Map<string, IElementoHiLeS>([
      ['entrada', entrada], ['t1', t1], ['t2', t2], ['s1', salida1], ['s2', salida2],
    ]);
    const aristas = [
      arista('e1', 'entrada', 't1', HilesConnectionType.PETRI),
      arista('s1', 't1', 's1', HilesConnectionType.PETRI),
      arista('e2', 'entrada', 't2', HilesConnectionType.PETRI),
      arista('s2', 't2', 's2', HilesConnectionType.PETRI),
    ];
    expect(evaluarRedPetri(elementos, aristas).conflicto).toBe(true);
    expect(entrada.obtenerCantidadTokens()).toBe(1);
    expect(salida1.obtenerCantidadTokens()).toBe(0);
    expect(salida2.obtenerCantidadTokens()).toBe(0);
  });

  it('respeta pesos de arcos', () => {
    const entrada = new ElementoLugar({ tokensIniciales: 2, maxTokens: 2 });
    const salida = new ElementoLugar({ maxTokens: 2 });
    const transicion = new ElementoTransicion();
    transicion.recibirEntrada('transition-condition-in', true);
    const elementos = new Map<string, IElementoHiLeS>([['e', entrada], ['t', transicion], ['s', salida]]);
    const aristas = [
      arista('e-t', 'e', 't', HilesConnectionType.PETRI, undefined, undefined, 2),
      arista('t-s', 't', 's', HilesConnectionType.PETRI, undefined, undefined, 2),
    ];
    expect(dispararTransicion('t', elementos, aristas).exito).toBe(true);
    expect(entrada.obtenerCantidadTokens()).toBe(0);
    expect(salida.obtenerCantidadTokens()).toBe(2);
  });
});
