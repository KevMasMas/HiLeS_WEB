import { describe, expect, it } from 'vitest';
import { HilesConnectionType, HilesElementType } from '../../types/hiles';
import { construirOrdenTopologico, detectarCiclos, propagarValores } from '../GrafoDatos';
import { ElementoService } from '../elementos/ElementoService';
import type { IElementoHiLeS } from '../elementos/interfaces';
import { arista, nodo, puerto } from './fixtures';

describe('GrafoDatos', () => {
  it('construye un orden topológico determinista', () => {
    const nodes = [nodo('a', HilesElementType.SERVICE), nodo('b', HilesElementType.SERVICE), nodo('c', HilesElementType.SERVICE)];
    const edges = [arista('ab', 'a', 'b', HilesConnectionType.CONTINUOUS), arista('bc', 'b', 'c', HilesConnectionType.CONTINUOUS)];
    expect(construirOrdenTopologico(nodes, edges)).toEqual({ orden: ['a', 'b', 'c'], hayCiclo: false, nodosEnCiclo: [] });
  });

  it('detecta ciclos de varios nodos y autociclos', () => {
    const nodes = [nodo('a', HilesElementType.SERVICE), nodo('b', HilesElementType.SERVICE)];
    const edges = [
      arista('ab', 'a', 'b', HilesConnectionType.CONTINUOUS),
      arista('ba', 'b', 'a', HilesConnectionType.CONTINUOUS),
      arista('aa', 'a', 'a', HilesConnectionType.CONTINUOUS),
    ];
    expect(construirOrdenTopologico(nodes, edges).hayCiclo).toBe(true);
    expect(detectarCiclos(nodes, edges)).toEqual(expect.arrayContaining([['a', 'b'], ['a']]));
  });

  it('propaga valores por el puerto de destino', () => {
    const origen = new ElementoService({ ports: [puerto('out', 'Out', 'output')] });
    const destino = new ElementoService({ ports: [puerto('in', 'In', 'input'), puerto('dest-out', 'Out', 'output')] });
    origen.establecerValor(25);
    const elementos = new Map<string, IElementoHiLeS>([['origen', origen], ['destino', destino]]);
    const edges = [arista('edge', 'origen', 'destino', HilesConnectionType.CONTINUOUS, 'out', 'in')];
    const resultado = propagarValores(['origen', 'destino'], { elementos, aristas: edges, valores: new Map() });
    expect(resultado.valores.get('destino')).toBe(25);
    expect(resultado.entregas).toHaveLength(1);
  });
});
