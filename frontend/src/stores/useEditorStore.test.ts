import { describe, expect, it } from 'vitest';
import { HilesElementType, type HilesPort } from '../types/hiles';
import { orientOperatorPorts } from './operatorPorts';

const port = (
  id: string,
  direction: HilesPort['direction'],
  nature: HilesPort['nature'] = 'continuous',
): HilesPort => ({
  id,
  name: id,
  direction,
  dataType: nature === 'control' ? 'boolean' : 'real',
  nature,
  side: 'top',
  offset: 0.5,
});

describe('orientación de los conversores', () => {
  it('Sample recibe datos y control por el lado ancho y transmite por la punta', () => {
    const ports = orientOperatorPorts(HilesElementType.SAMPLE, 'right', [
      port('data', 'input'),
      port('control', 'input', 'control'),
      port('sampled', 'output'),
    ]);

    expect(ports.map(({ id, side, offset }) => ({ id, side, offset }))).toEqual([
      { id: 'data', side: 'left', offset: 0.32 },
      { id: 'control', side: 'left', offset: 0.68 },
      { id: 'sampled', side: 'right', offset: 0.5 },
    ]);
  });

  it('Hold recibe por la punta y transmite por el lado ancho', () => {
    const ports = orientOperatorPorts(HilesElementType.HOLD, 'left', [
      port('dch', 'input'),
      port('cch', 'output'),
      port('lch', 'output', 'control'),
    ]);

    expect(ports.map(({ id, direction, side, offset }) => ({ id, direction, side, offset }))).toEqual([
      { id: 'dch', direction: 'input', side: 'left', offset: 0.5 },
      { id: 'cch', direction: 'output', side: 'right', offset: 0.32 },
      { id: 'lch', direction: 'output', side: 'right', offset: 0.68 },
    ]);
  });

  it('conserva los identificadores de puerto al cambiar la orientación del Hold', () => {
    const ports = orientOperatorPorts(HilesElementType.HOLD, 'right', [
      port('dch-original', 'input'),
      port('cch-original', 'output'),
      port('lch-original', 'output', 'control'),
    ]);

    expect(ports.map(({ id, side }) => ({ id, side }))).toEqual([
      { id: 'dch-original', side: 'right' },
      { id: 'cch-original', side: 'left' },
      { id: 'lch-original', side: 'left' },
    ]);
  });
});
