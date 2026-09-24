import { describe, expect, it } from 'vitest';
import { ElementoBloqueEstructural } from '../elementos/ElementoBloqueEstructural';
import { ElementoLugar } from '../elementos/ElementoLugar';
import { ElementoMuestreo } from '../elementos/ElementoMuestreo';
import { ElementoRetencion } from '../elementos/ElementoRetencion';
import { ElementoService } from '../elementos/ElementoService';
import { ElementoTransicion } from '../elementos/ElementoTransicion';
import { puerto } from './fixtures';

describe('elementos HiLeS', () => {
  it('Place conserva capacidad, no baja de cero y reinicia sus tokens', () => {
    const lugar = new ElementoLugar({ tokensIniciales: 1, maxTokens: 2 });
    expect(lugar.consumirToken()).toBe(true);
    expect(lugar.consumirToken()).toBe(false);
    expect(lugar.producirToken(2)).toBe(true);
    expect(lugar.producirToken()).toBe(false);
    lugar.reiniciar();
    expect(lugar.obtenerCantidadTokens()).toBe(1);
  });

  it('Place rechaza configuraciones y cantidades inválidas', () => {
    expect(() => new ElementoLugar({ tokensIniciales: 2, maxTokens: 1 })).toThrow(RangeError);
    expect(() => new ElementoLugar().consumirToken(0)).toThrow(RangeError);
  });

  it('Transition solo se habilita con booleano verdadero y emite una acción por disparo', () => {
    const transicion = new ElementoTransicion();
    transicion.recibirEntrada('transition-condition-in', false);
    expect(transicion.estaHabilitada()).toBe(false);
    transicion.recibirEntrada('transition-condition-in', true);
    expect(transicion.estaHabilitada()).toBe(true);
    transicion.marcarDisparo();
    expect(transicion.evaluar().get('transition-action-out')).toBe(true);
    expect(transicion.evaluar().size).toBe(0);
  });

  it('Service rechaza puertos inexistentes y publica el valor externo', () => {
    const service = new ElementoService({ ports: [puerto('in', 'In', 'input'), puerto('out', 'Out', 'output')] });
    service.recibirEntrada('desconocido', 2);
    expect(service.obtenerEstado().error).toBeTruthy();
    service.establecerValor(8);
    expect(service.evaluar().get('out')).toBe(8);
  });

  it('Sample captura únicamente al recibir Control=true', () => {
    const sample = new ElementoMuestreo({ ports: [
      puerto('data', 'Data', 'input'),
      puerto('control', 'Control', 'input', 'boolean', 'control'),
      puerto('sampled', 'Sampled', 'output'),
    ] });
    sample.recibirEntrada('data', 12);
    expect(sample.evaluar().size).toBe(0);
    sample.recibirEntrada('control', true);
    expect(sample.evaluar().get('sampled')).toBe(12);
  });

  it('Hold mantiene el último valor válido', () => {
    const hold = new ElementoRetencion({ ports: [puerto('data', 'Data', 'input'), puerto('held', 'Held', 'output')] });
    hold.recibirEntrada('data', 4);
    expect(hold.evaluar().get('held')).toBe(4);
    hold.recibirEntrada('desconocido', 9);
    expect(hold.evaluar().get('held')).toBe(4);
  });

  it('Structural Block pasa valores por sus túneles y conserva sus hijos', () => {
    const bloque = new ElementoBloqueEstructural({
      hijos: ['hijo-1'],
      ports: [
        puerto('temperatura-in', 'temperatura', 'input'),
        puerto('humedad-in', 'humedad', 'input'),
        puerto('temperatura-out', 'temperatura', 'output'),
        puerto('humedad-out', 'humedad', 'output'),
      ],
    });
    bloque.recibirEntrada('temperatura-in', 24);
    bloque.recibirEntrada('humedad-in', 70);
    expect(bloque.evaluar()).toEqual(new Map([
      ['temperatura-out', 24],
      ['humedad-out', 70],
    ]));
    expect(bloque.obtenerHijos()).toEqual(['hijo-1']);
  });
});
