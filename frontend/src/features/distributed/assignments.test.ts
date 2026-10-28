import { describe, expect, it } from 'vitest';
import { HilesElementType, type HilesNodeData } from '../../types/hiles';
import type { ManifiestoDespliegueV3 } from '../../services/ir/tiposIrDistribuida';
import type { MensajeEstadoEjecutorV3, MensajeSnapshotParcialV3 } from '../../services/distributed/messages';
import {
  aceptarSnapshot,
  agregarSnapshots,
  construirMapaAsignaciones,
  construirPlanDesdeNodos,
  describirFase,
  ejecutablesSinDestino,
  etiquetaEjecutor,
  recomendacionError,
  type NodoHiles,
} from './assignments';

const nodo = (id: string, tipo: HilesElementType, extra: { parentId?: string; destino?: string } = {}): NodoHiles => ({
  id,
  position: { x: 0, y: 0 },
  ...(extra.parentId ? { parentId: extra.parentId } : {}),
  data: {
    hilesType: tipo,
    name: id,
    ports: [],
    properties: { ...(extra.destino ? { deploymentTarget: extra.destino } : {}) } as unknown as HilesNodeData['properties'],
  },
});

const documento: NodoHiles[] = [
  nodo('block-a', HilesElementType.STRUCTURAL_BLOCK, { destino: 'pico:a' }),
  nodo('service-a', HilesElementType.SERVICE, { parentId: 'block-a' }),
  nodo('fb-b', HilesElementType.FUNCTIONAL_BLOCK, { parentId: 'block-a', destino: 'browser:b' }),
  nodo('block-c', HilesElementType.STRUCTURAL_BLOCK),
  nodo('hold-c', HilesElementType.HOLD, { parentId: 'block-c' }),
  nodo('suelto', HilesElementType.PLACE, { destino: 'browser:b' }),
];

const estado = (executorId: string, estadoEjecutor: MensajeEstadoEjecutorV3['estado']): MensajeEstadoEjecutorV3 => ({
  protocol_version: 3,
  project_id: 'p',
  executor_id: executorId,
  tipo: executorId.startsWith('pico') ? 'pico' : 'browser',
  estado: estadoEjecutor,
  capacidades: { ir_versions: [2], lenguajes: ['python', 'expresion'], max_fragment_bytes: 30000, max_elementos: 64 },
  last_seen_ms: 0,
});

const manifest = {
  protocol_version: 3,
  project_id: 'p',
  deployment_id: 'd1',
  epoch: 2,
  model_id: 'm',
  model_version: 1,
  owners: { 'fb-b': 'browser:b', 'service-a': 'pico:a' },
  fragments: [
    { fragment_id: 'd1:browser:b', executor_id: 'browser:b', hash: 'x', size_bytes: 1, element_ids: ['fb-b'] },
    { fragment_id: 'd1:pico:a', executor_id: 'pico:a', hash: 'y', size_bytes: 1, element_ids: ['service-a'] },
  ],
  routes: [],
} satisfies ManifiestoDespliegueV3;

const ack = (executorId: string, accepted: boolean, epoch = 2) => ({
  protocol_version: 3 as const,
  project_id: 'p',
  deployment_id: 'd1',
  epoch,
  executor_id: executorId,
  fragment_id: `d1:${executorId}`,
  accepted,
  fragment_hash: 'h',
});

describe('asignaciones guardadas en el documento', () => {
  it('construye el plan v3 con herencia, override de FB y asignación directa', () => {
    expect(construirPlanDesdeNodos(documento)).toEqual({
      structural_blocks: { 'block-a': 'pico:a' },
      functional_blocks: { 'fb-b': 'browser:b' },
      elementos: { suelto: 'browser:b' },
    });
  });

  it('el mapa muestra herencia y ejecutables sin destino', () => {
    const filas = construirMapaAsignaciones(documento);
    const bloqueA = filas.find((fila) => fila.nodoId === 'block-a')!;
    expect(bloqueA).toMatchObject({ destinoPropio: 'pico:a', ejecutablesInternos: 2, sinAsignarInternos: 0 });
    expect(filas.find((fila) => fila.nodoId === 'fb-b')!.efectivo).toEqual({ executorId: 'browser:b', origen: 'propio' });
    expect(filas.find((fila) => fila.nodoId === 'block-c')).toMatchObject({ sinAsignarInternos: 1 });
    expect(ejecutablesSinDestino(documento).map((item) => item.id)).toEqual(['hold-c']);
  });

  it('las etiquetas distinguen este navegador, Pico, otro navegador y sin asignar', () => {
    expect(etiquetaEjecutor('browser:abc123', 'browser:abc123')).toBe('Este navegador');
    expect(etiquetaEjecutor('pico:lab-1', 'browser:abc123')).toBe('Pico lab-1');
    expect(etiquetaEjecutor('browser:zzzzzzzzz', 'browser:abc123')).toBe('Navegador zzzzzz');
    expect(etiquetaEjecutor(null, null)).toBe('Sin asignar');
  });
});

describe('estado agregado de la ejecución distribuida', () => {
  const ejecutores = { 'browser:b': estado('browser:b', 'ready'), 'pico:a': estado('pico:a', 'ready') };

  it('distingue desconectado, sin despliegue, desplegando, listo, ejecutando y error', () => {
    const base = { conectado: true, manifest, acks: {}, ejecutores, ejecutando: false, errorLocal: null };
    expect(describirFase({ ...base, conectado: false }).fase).toBe('desconectado');
    expect(describirFase({ ...base, manifest: null }).fase).toBe('sin_despliegue');
    expect(describirFase({ ...base, acks: { 'pico:a': ack('pico:a', true) } }).fase).toBe('desplegando');
    const todos = { 'pico:a': ack('pico:a', true), 'browser:b': ack('browser:b', true) };
    expect(describirFase({ ...base, acks: todos }).fase).toBe('listo');
    expect(describirFase({ ...base, acks: todos, ejecutando: true }).fase).toBe('ejecutando');
    expect(describirFase({ ...base, acks: { ...todos, 'browser:b': ack('browser:b', false) } }).fase).toBe('error');
    expect(describirFase({ ...base, acks: todos, ejecutores: { ...ejecutores, 'pico:a': estado('pico:a', 'offline') } }).fase).toBe('error');
    // Un ACK de otra época no cuenta como confirmación.
    expect(describirFase({ ...base, acks: { 'pico:a': ack('pico:a', true, 1), 'browser:b': ack('browser:b', true) } }).fase).toBe('desplegando');
  });

  const snapshot = (executorId: string, sequence: number, epoch = 2, elements: Record<string, unknown> = {}): MensajeSnapshotParcialV3 => ({
    protocol_version: 3,
    project_id: 'p',
    deployment_id: 'd1',
    epoch,
    executor_id: executorId,
    sequence,
    elements,
  });

  it('acepta solo snapshots del propietario y época activos, sin repetir secuencias', () => {
    expect(aceptarSnapshot(manifest, undefined, snapshot('pico:a', 1))).toBe(true);
    expect(aceptarSnapshot(manifest, snapshot('pico:a', 2), snapshot('pico:a', 2))).toBe(false);
    expect(aceptarSnapshot(manifest, undefined, snapshot('pico:a', 1, 1))).toBe(false);
    expect(aceptarSnapshot(manifest, undefined, snapshot('pico:zz', 1))).toBe(false);
  });

  it('compone la vista por elemento sin mezclar datos de ejecutores ajenos', () => {
    const vista = agregarSnapshots(
      manifest,
      {
        'pico:a': snapshot('pico:a', 3, 2, { 'service-a': { valor: 4 }, 'fb-b': { salida: 999 } }),
        'browser:b': snapshot('browser:b', 1, 2, { 'fb-b': { salida: 5 } }),
      },
      { ...ejecutores, 'browser:b': estado('browser:b', 'offline') },
    );
    expect(vista).toEqual([
      { elementId: 'fb-b', executorId: 'browser:b', estado: { salida: 5 }, obsoleto: true },
      { elementId: 'service-a', executorId: 'pico:a', estado: { valor: 4 }, obsoleto: false },
    ]);
  });

  it('cada código de error tiene una recomendación accionable', () => {
    expect(recomendacionError('DISTRIBUCION_DESTINO_FALTANTE')).toMatch(/Asigna/);
    expect(recomendacionError('DESCONOCIDO')).toMatch(/vuelve a desplegar/);
  });
});
