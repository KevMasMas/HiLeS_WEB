import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { isModelDocument, migrateV1toV2, validateModelDocument } from '../../domain/modelDocument';
import { HilesConnectionType, type HilesEdgeData, type HilesNodeData } from '../../types/hiles';
import { EstadoSimulacion, TipoEventoSimulacion } from '../tipos';
import { MotorSimulacion } from '../MotorSimulacion';
import { circuitoHumedad } from './fixtures';

describe('MotorSimulacion', () => {
  it('ejecuta el circuito integral de humedad y mueve el token', async () => {
    const { nodes, edges } = circuitoHumedad();
    const motor = new MotorSimulacion();
    motor.construirGrafo(nodes, edges);
    expect(motor.inyectarEntrada('sensor', 70).exito).toBe(true);

    const resultado = await motor.ejecutar();
    const estados = motor.obtenerEstadosElementos();
    expect(resultado.estabilizado).toBe(true);
    expect(estados.get('espera')?.tokens).toBe(0);
    expect(estados.get('activo')?.tokens).toBe(1);
    expect(motor.obtenerValores().get('condicion')).toBe(true);
    expect(motor.obtenerEventos().some((evento) => evento.tipo === TipoEventoSimulacion.DISPARO)).toBe(true);
  });

  it('conserva tokens cuando la guarda es falsa', async () => {
    const { nodes, edges } = circuitoHumedad();
    const motor = new MotorSimulacion();
    motor.construirGrafo(nodes, edges);
    motor.inyectarEntrada('sensor', 80);
    await motor.ejecutar();
    expect(motor.obtenerEstadosElementos().get('espera')?.tokens).toBe(1);
    expect(motor.obtenerEstadosElementos().get('activo')?.tokens).toBe(0);
  });

  it('reinicia exactamente y continúa propagando después del reinicio', async () => {
    const { nodes, edges } = circuitoHumedad();
    const motor = new MotorSimulacion();
    motor.construirGrafo(nodes, edges);
    motor.inyectarEntrada('sensor', 70);
    await motor.ejecutar();
    motor.reiniciar();
    expect(motor.obtenerContadorPasos()).toBe(0);
    expect(motor.obtenerEstadosElementos().get('espera')?.tokens).toBe(1);
    expect(motor.obtenerEventos()).toHaveLength(1);

    motor.inyectarEntrada('sensor', 80);
    await motor.paso();
    expect(motor.obtenerValores().get('condicion')).toBe(false);
  });

  it('rechaza grafos de datos con ciclos', () => {
    const { nodes, edges } = circuitoHumedad();
    edges.push({ ...edges[0], id: 'autociclo', source: 'condicion', target: 'condicion', sourceHandle: 'condicion-out', targetHandle: 'humedad-in' });
    const motor = new MotorSimulacion();
    motor.construirGrafo(nodes, edges);
    expect(motor.obtenerEstado()).toBe(EstadoSimulacion.ERROR);
    expect(motor.obtenerEventos().some((evento) => evento.tipo === TipoEventoSimulacion.ERROR)).toBe(true);
  });

  it('modela el parqueadero como CCH + LCH → Sample → DCH → Hold → CCH + LCH', () => {
    const contenido: unknown = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'output', 'demo-parqueadero-converters.json'), 'utf8'));
    expect(isModelDocument(contenido)).toBe(true);
    if (!isModelDocument(contenido)) return;
    const documento = migrateV1toV2(contenido);
    const hold = documento.allElements.find((elemento) => elemento.id === 'hold-ocupacion');
    expect(hold?.ports.map(({ name, direction, nature }) => ({ name, direction, nature }))).toEqual([
      { name: 'DCH', direction: 'input', nature: 'continuous' },
      { name: 'CCH', direction: 'output', nature: 'continuous' },
      { name: 'LCH', direction: 'output', nature: 'control' },
    ]);

    const conexiones = new Map(documento.connections.map((conexion) => [conexion.id, conexion]));
    expect(conexiones.get('lch-control-sample')?.data?.hilesConnectionType).toBe(HilesConnectionType.PETRI);
    expect(conexiones.get('dch-sample-hold')?.data?.hilesConnectionType).toBe(HilesConnectionType.DISCRETE);
    expect(conexiones.get('cch-hold-abrir')?.sourceHandle).toBe('hold-cch');
    expect(conexiones.get('cch-hold-cerrar')?.sourceHandle).toBe('hold-cch');
    expect(conexiones.get('lch-hold-evento')?.sourceHandle).toBe('hold-lch');
  });

  it('importa, construye y ejecuta todos los demos JSON existentes', async () => {
    const WorkerOriginal = globalThis.Worker;
    class WorkerPythonDemo {
      onmessage: ((evento: MessageEvent<{ ok: boolean; value?: boolean }>) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = vi.fn();

      postMessage(mensaje: { inputs: { vehiculos?: number } }): void {
        queueMicrotask(() => this.onmessage?.({
          data: { ok: true, value: (mensaje.inputs.vehiculos ?? 0) < 10 },
        } as MessageEvent<{ ok: boolean; value?: boolean }>));
      }
    }
    Object.assign(globalThis, { Worker: WorkerPythonDemo });
    const archivos = [
      'figure-29-hiles-wsn.json',
      'demo-2-humedad-token.json',
      'circuito-presentacion-demo.json',
      'demo-parqueadero-converters.json',
    ];
    try {
      for (const archivo of archivos) {
      const contenido: unknown = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'output', archivo), 'utf8'));
      expect(isModelDocument(contenido)).toBe(true);
      if (!isModelDocument(contenido)) continue;
      const documento = migrateV1toV2(contenido);
      expect(validateModelDocument(documento)).toEqual([]);
      const nodes = documento.allElements.map((elemento) => ({
        id: elemento.id,
        type: 'hilesNode',
        position: { x: elemento.layout.x, y: elemento.layout.y },
        ...(elemento.parentId ? { parentId: elemento.parentId } : {}),
        data: {
          hilesType: elemento.type,
          name: elemento.name,
          ports: elemento.ports,
          properties: elemento.properties,
        },
      })) as Node<HilesNodeData>[];
      const motor = new MotorSimulacion();
      motor.construirGrafo(nodes, documento.connections as Edge<HilesEdgeData>[]);
      expect(motor.obtenerEstado(), archivo).not.toBe(EstadoSimulacion.ERROR);

      nodes
        .filter((nodo) => nodo.data.hilesType === 'SERVICE')
        .forEach((servicio) => {
          const tipo = servicio.data.ports.find((puerto) => puerto.direction === 'output')?.dataType;
          if (!tipo) return;
          const valor = tipo === 'boolean' ? true : tipo === 'string' ? 'prueba' : 1;
          expect(motor.inyectarEntrada(servicio.id, valor).exito, `${archivo}: ${servicio.id}`).toBe(true);
        });

      await motor.paso();
      const errores = motor.obtenerEventos()
        .filter((evento) => evento.tipo === TipoEventoSimulacion.ERROR)
        .map((evento) => evento.mensaje)
        .join(' | ');
        expect(motor.obtenerEstado(), `${archivo}: ${errores}`).not.toBe(EstadoSimulacion.ERROR);
      }
    } finally {
      Object.assign(globalThis, { Worker: WorkerOriginal });
    }
  });

  it('ejecuta el demo JSON de humedad en ambos sentidos', async () => {
    const contenido: unknown = JSON.parse(readFileSync(resolve(process.cwd(), '..', 'output', 'demo-2-humedad-token.json'), 'utf8'));
    if (!isModelDocument(contenido)) throw new Error('El demo de humedad no es un documento válido.');
    const documento = migrateV1toV2(contenido);
    const nodes = documento.allElements.map((elemento) => ({
      id: elemento.id,
      type: 'hilesNode',
      position: { x: elemento.layout.x, y: elemento.layout.y },
      ...(elemento.parentId ? { parentId: elemento.parentId } : {}),
      data: { hilesType: elemento.type, name: elemento.name, ports: elemento.ports, properties: elemento.properties },
    })) as Node<HilesNodeData>[];
    const motor = new MotorSimulacion();
    motor.construirGrafo(nodes, documento.connections as Edge<HilesEdgeData>[]);

    motor.inyectarEntrada('demo2-humidity', 90);
    await motor.ejecutar();
    expect(motor.obtenerEstadosElementos().get('demo2-p1')?.tokens).toBe(1);
    expect(motor.obtenerEstadosElementos().get('demo2-p2')?.tokens).toBe(0);

    motor.inyectarEntrada('demo2-humidity', 70);
    await motor.ejecutar();
    expect(motor.obtenerEstadosElementos().get('demo2-p1')?.tokens).toBe(0);
    expect(motor.obtenerEstadosElementos().get('demo2-p2')?.tokens).toBe(1);
  });
});
