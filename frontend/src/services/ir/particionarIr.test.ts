import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { HilesModelDocument } from '../../domain/modelDocument';
import { fixturesDistribucionV3, topicsDistribuidosV3 } from '../distributed';
import {
  particionarIrV2Distribuida,
  resolverAsignacionesDistribuidasV3,
  serializarCanonico,
} from './particionarIr';
import type {
  EjecutorDisponibleV3,
  PlanAsignacionDespliegueV3,
} from './tiposIrDistribuida';
import type { IrModeloV2 } from './tiposIrV2';

const propiedades = {
  description: '',
  collapsed: false,
  locked: false,
  visible: true,
  expression: '',
  executionDelay: 0,
  enabled: true,
  tokens: 0,
  maxTokens: 1,
  delay: 0,
  condition: '',
  heldValue: '',
  operatorDirection: 'right' as const,
  rotation: 0,
};

const modelo: IrModeloV2 = {
  ir_version: 2,
  modelo_id: 'fixture-distribuido',
  version: 7,
  nombre: 'Fixture distribuido determinista',
  metadata: {
    documento_schema_version: 2,
    compilado_en: '2026-10-28T12:00:00.000Z',
    bloque_raiz_id: null,
  },
  entradas_externas: [
    {
      elemento_id: 'service-a',
      nombre: 'Entrada',
      puerto_salida: 'out',
      tipo_dato: 'integer',
    },
  ],
  elementos: [
    {
      id: 'service-a',
      tipo: 'service',
      nombre: 'Entrada',
      tipo_dato: 'integer',
      entradas: [],
      salidas: ['out'],
    },
    {
      id: 'fb-b',
      tipo: 'functional_block',
      nombre: 'Sumar uno',
      habilitado: true,
      lenguaje: 'python',
      codigo: 'x + 1',
      entradas: [{ puerto: 'in', variable: 'x', tipo_dato: 'integer' }],
      salidas: [{ puerto: 'out', variable: 'resultado', tipo_dato: 'integer' }],
    },
    {
      id: 'hold-c',
      tipo: 'hold',
      nombre: 'Retención C',
      habilitado: true,
      tipo_dato: 'integer',
      puerto_entrada: 'in',
      puerto_cch: 'out',
      puerto_lch: 'pulse',
    },
    {
      id: 'hold-d',
      tipo: 'hold',
      nombre: 'Retención D',
      habilitado: true,
      tipo_dato: 'integer',
      puerto_entrada: 'in',
      puerto_cch: 'out',
      puerto_lch: 'pulse',
    },
  ],
  conexiones: [
    {
      id: 'conn-a-b',
      tipo: 'dch',
      origen: 'service-a',
      puerto_origen: 'out',
      destino: 'fb-b',
      puerto_destino: 'in',
      capacidad_cola: 8,
    },
    {
      id: 'conn-b-c',
      tipo: 'cch',
      origen: 'fb-b',
      puerto_origen: 'out',
      destino: 'hold-c',
      puerto_destino: 'in',
    },
    {
      id: 'conn-c-d',
      tipo: 'cch',
      origen: 'hold-c',
      puerto_origen: 'out',
      destino: 'hold-d',
      puerto_destino: 'in',
    },
  ],
};

const documento: HilesModelDocument = {
  schemaVersion: 2,
  metadata: { savedAt: '2026-10-28T12:00:00.000Z' },
  network: { topology: null, protocol: null, nodes: ['block-a', 'block-c', 'block-d'] },
  relationNode: [
    { nodeId: 'block-a', elementIds: ['service-a', 'fb-b'] },
    { nodeId: 'block-c', elementIds: ['hold-c'] },
    { nodeId: 'block-d', elementIds: ['hold-d'] },
  ],
  allElements: [
    { id: 'block-a', type: 'STRUCTURAL_BLOCK', name: 'A', layout: { x: 0, y: 0 }, ports: [], properties: propiedades },
    { id: 'service-a', type: 'SERVICE', name: 'Entrada', parentId: 'block-a', layout: { x: 0, y: 0 }, ports: [], properties: propiedades },
    { id: 'fb-b', type: 'FUNCTIONAL_BLOCK', name: 'B', parentId: 'block-a', layout: { x: 0, y: 0 }, ports: [], properties: { ...propiedades, code: 'x + 1', codeLanguage: 'python' } },
    { id: 'block-c', type: 'STRUCTURAL_BLOCK', name: 'C', layout: { x: 0, y: 0 }, ports: [], properties: propiedades },
    { id: 'hold-c', type: 'HOLD', name: 'C', parentId: 'block-c', layout: { x: 0, y: 0 }, ports: [], properties: propiedades },
    { id: 'block-d', type: 'STRUCTURAL_BLOCK', name: 'D', layout: { x: 0, y: 0 }, ports: [], properties: propiedades },
    { id: 'hold-d', type: 'HOLD', name: 'D', parentId: 'block-d', layout: { x: 0, y: 0 }, ports: [], properties: propiedades },
  ],
  connections: [],
};

function executor(executor_id: string, tipo: 'pico' | 'browser' = 'browser'): EjecutorDisponibleV3 {
  return {
    executor_id,
    tipo,
    estado: 'online',
    capacidades: {
      ir_versions: [2],
      lenguajes: ['python', 'expresion'],
      max_fragment_bytes: 31_744,
      max_elementos: 64,
    },
  };
}

function resolver(plan: PlanAsignacionDespliegueV3) {
  return resolverAsignacionesDistribuidasV3({ documento, modelo, plan });
}

describe('protocolo de ejecución distribuida v3', () => {
  it('construye tópicos sin confundir colaboración v2 con ejecución v3', () => {
    expect(topicsDistribuidosV3.executorStatus('demo', 'pico:01')).toBe(
      'udfjc/hiles/v3/projects/demo/executors/pico:01/status',
    );
    expect(topicsDistribuidosV3.channel('demo', 'deploy-1', 'conn-a-b')).toBe(
      'udfjc/hiles/v3/projects/demo/deployments/deploy-1/channels/conn-a-b',
    );
    expect(() => topicsDistribuidosV3.manifest('proyecto/#')).toThrow(/segmento MQTT/);
    expect(topicsDistribuidosV3.input('demo', 'deploy-1')).toBe(
      'udfjc/hiles/v3/projects/demo/deployments/deploy-1/input',
    );
  });

  it('hereda destino del Structural Block y permite override del Functional Block', () => {
    const resultado = resolver({
      structural_blocks: {
        'block-a': 'pico:a',
        'block-c': 'browser:c',
        'block-d': 'browser:d',
      },
      functional_blocks: { 'fb-b': 'browser:b' },
    });
    expect(resultado.errores).toEqual([]);
    expect(resultado.asignaciones).toEqual([
      { elemento_id: 'fb-b', executor_id: 'browser:b', origen: 'functional_block' },
      { elemento_id: 'hold-c', executor_id: 'browser:c', origen: 'structural_block', heredado_de: 'block-c' },
      { elemento_id: 'hold-d', executor_id: 'browser:d', origen: 'structural_block', heredado_de: 'block-d' },
      { elemento_id: 'service-a', executor_id: 'pico:a', origen: 'structural_block', heredado_de: 'block-a' },
    ]);
  });

  it.each(fixturesDistribucionV3)(
    'particiona de forma determinista el fixture $nombre',
    async (fixture) => {
    const resuelto = resolver(fixture.plan);
    const ids = fixture.ejecutores.map((item) => item.executor_id);
    const entrada = {
      project_id: fixture.project_id,
      deployment_id: fixture.deployment_id,
      epoch: fixture.epoch,
      modelo,
      ejecutores: fixture.ejecutores.map((item) => executor(item.executor_id, item.tipo)),
      asignaciones: resuelto.asignaciones,
    };
    const primero = await particionarIrV2Distribuida(entrada);
    const segundo = await particionarIrV2Distribuida(entrada);

    expect(primero).toEqual(segundo);
    expect(primero.ok).toBe(true);
    if (!primero.ok) return;
    expect(primero.fragments.map((item) => item.executor_id).sort()).toEqual([...ids].sort());
    expect(primero.fragments).toHaveLength(fixture.expected_fragment_count);
    expect(primero.manifest.routes).toHaveLength(fixture.expected_remote_route_count);
    expect(Object.keys(primero.manifest.owners)).toHaveLength(modelo.elementos.length);
    expect(primero.manifest.fragments.every((item) => /^[a-f0-9]{64}$/.test(item.hash))).toBe(true);
    for (const fragmento of primero.fragments) {
      expect(fragmento.modelo.conexiones.every((conexion) =>
        fragmento.modelo.elementos.some((elemento) => elemento.id === conexion.origen) &&
        fragmento.modelo.elementos.some((elemento) => elemento.id === conexion.destino),
      )).toBe(true);
    }
    },
  );

  it('rechaza un destino ausente con un error legible y no produce despliegue parcial', async () => {
    const resuelto = resolver({
      structural_blocks: {
        'block-a': 'pico:a',
        'block-c': 'browser:ausente',
        'block-d': 'browser:b',
      },
    });
    const resultado = await particionarIrV2Distribuida({
      project_id: 'fixture-v3',
      deployment_id: 'deploy-error',
      epoch: 1,
      modelo,
      ejecutores: [executor('pico:a', 'pico'), executor('browser:b')],
      asignaciones: resuelto.asignaciones,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.fragments).toEqual([]);
    expect(resultado.errors).toContainEqual(expect.objectContaining({
      codigo: 'DISTRIBUCION_DESTINO_INEXISTENTE',
      elemento_id: 'hold-c',
      executor_id: 'browser:ausente',
    }));
  });

  it('rechaza un fragmento si el worker no soporta el lenguaje requerido', async () => {
    const resuelto = resolver({
      structural_blocks: {
        'block-a': 'browser:a',
        'block-c': 'browser:c',
        'block-d': 'browser:c',
      },
    });
    const limitado = executor('browser:a');
    limitado.capacidades.lenguajes = ['expresion'];
    const resultado = await particionarIrV2Distribuida({
      project_id: 'fixture-v3',
      deployment_id: 'deploy-capacidad',
      epoch: 1,
      modelo,
      ejecutores: [limitado, executor('browser:c')],
      asignaciones: resuelto.asignaciones,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.errors).toContainEqual(expect.objectContaining({
      codigo: 'DISTRIBUCION_CAPACIDAD_EXCEDIDA',
      elemento_id: 'fb-b',
      executor_id: 'browser:a',
    }));
  });

  it('mantiene juntos Place y Transition cuando existe un arco Petri', async () => {
    const petri: IrModeloV2 = {
      ...modelo,
      entradas_externas: [],
      elementos: [
        { id: 'place', tipo: 'place', nombre: 'P', tokens: 1, capacidad: 1 },
        { id: 'transition', tipo: 'transition', nombre: 'T', habilitada: true, puerto_condicion: 'condition', puerto_accion: null },
      ],
      conexiones: [{ id: 'arc', tipo: 'arco', origen: 'place', destino: 'transition', peso: 1 }],
    };
    const resultado = await particionarIrV2Distribuida({
      project_id: 'fixture-v3',
      deployment_id: 'deploy-petri',
      epoch: 1,
      modelo: petri,
      ejecutores: [executor('pico:a', 'pico'), executor('browser:b')],
      asignaciones: [
        { elemento_id: 'place', executor_id: 'pico:a', origen: 'directo' },
        { elemento_id: 'transition', executor_id: 'browser:b', origen: 'directo' },
      ],
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.errors[0]).toEqual(expect.objectContaining({
      codigo: 'DISTRIBUCION_ARCO_REMOTO',
      conexion_id: 'arc',
    }));
  });

  it('preserva retardo_ms y capacidad_cola en las rutas remotas cuando una conexión DCH/CCH cruza ejecutores', async () => {
    const modeloConRetardo: IrModeloV2 = {
      ...modelo,
      conexiones: [
        {
          id: 'conn-a-b',
          tipo: 'dch',
          origen: 'service-a',
          puerto_origen: 'out',
          destino: 'fb-b',
          puerto_destino: 'in',
          capacidad_cola: 12,
          retardo_ms: 250,
        },
        {
          id: 'conn-b-c',
          tipo: 'cch',
          origen: 'fb-b',
          puerto_origen: 'out',
          destino: 'hold-c',
          puerto_destino: 'in',
          retardo_ms: 100,
        },
        {
          id: 'conn-c-d',
          tipo: 'cch',
          origen: 'hold-c',
          puerto_origen: 'out',
          destino: 'hold-d',
          puerto_destino: 'in',
        },
      ],
    };
    const resuelto = resolver({
      structural_blocks: {
        'block-a': 'pico:a',
        'block-c': 'browser:c',
        'block-d': 'pico:d',
      },
      functional_blocks: { 'fb-b': 'browser:b' },
    });
    const resultado = await particionarIrV2Distribuida({
      project_id: 'fixture-v3-4',
      deployment_id: 'deploy-4',
      epoch: 1,
      modelo: modeloConRetardo,
      ejecutores: [
        executor('pico:a', 'pico'),
        executor('browser:b', 'browser'),
        executor('browser:c', 'browser'),
        executor('pico:d', 'pico'),
      ],
      asignaciones: resuelto.asignaciones,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const rutaDch = resultado.manifest.routes.find((r) => r.connection_id === 'conn-a-b');
    const rutaCch = resultado.manifest.routes.find((r) => r.connection_id === 'conn-b-c');
    const rutaSinRetardo = resultado.manifest.routes.find((r) => r.connection_id === 'conn-c-d');
    expect(rutaDch).toEqual(
      expect.objectContaining({ capacidad_cola: 12, retardo_ms: 250 }),
    );
    expect(rutaCch).toEqual(expect.objectContaining({ retardo_ms: 100 }));
    expect(rutaSinRetardo?.retardo_ms).toBeUndefined();
    expect(rutaSinRetardo?.capacidad_cola).toBeUndefined();
  });

  it('mantiene sincronizados los vectores de conformidad v3 compartidos con MicroPython', async () => {
    const dirActual = dirname(fileURLToPath(import.meta.url));
    const dirVectores = resolve(dirActual, '../../../../docs/mqtt/vectores_v3');
    mkdirSync(dirVectores, { recursive: true });

    const escenarios = await Promise.all(
      fixturesDistribucionV3.map(async (fixture) => {
        const resuelto = resolver(fixture.plan);
        const ejecutores = fixture.ejecutores.map((item) =>
          executor(item.executor_id, item.tipo),
        );
        const resultado = await particionarIrV2Distribuida({
          project_id: fixture.project_id,
          deployment_id: fixture.deployment_id,
          epoch: fixture.epoch,
          modelo,
          ejecutores,
          asignaciones: resuelto.asignaciones,
        });
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) {
          throw new Error(`Fallo inesperado en fixture ${fixture.nombre}`);
        }
        return {
          nombre: fixture.nombre,
          project_id: fixture.project_id,
          deployment_id: fixture.deployment_id,
          epoch: fixture.epoch,
          ejecutores,
          plan: fixture.plan,
          asignaciones: resuelto.asignaciones,
          manifest: resultado.manifest,
          fragments: resultado.fragments,
          canonical_fragments: Object.fromEntries(
            resultado.fragments.map((fragmento) => [
              fragmento.executor_id,
              serializarCanonico(fragmento),
            ]),
          ),
        };
      }),
    );

    const archivo = resolve(dirVectores, '01_fixtures_distribucion_v3.json');
    const contenidoEsperado = `${JSON.stringify({ version_contrato: 3, modelo, escenarios }, null, 2)}\n`;
    if (!existsSync(archivo)) {
      writeFileSync(archivo, contenidoEsperado, 'utf8');
    }
    const contenidoEnDisco = readFileSync(archivo, 'utf8').replace(/\r\n/g, '\n');
    expect(contenidoEnDisco).toBe(contenidoEsperado);
  });
});
