import { describe, expect, it, vi } from 'vitest';
import type { HilesModelDocument } from '../../domain/modelDocument';
import { HilesElementType, type HilesNodeProperties } from '../../types/hiles';
import type { MqttConnectionStatus, MqttTopic, MqttTopicPolicy } from '../mqtt/config';
import { validarMensajeMqtt, type MensajeMqtt } from '../mqtt/messages';
import {
  RemoteExecutionClient,
  type ClienteMqttRemoto,
  type EventoEjecucionRemota,
} from '../mqtt/RemoteExecutionClient';
import {
  asegurarProjectIdEnUrl,
  construirUrlCompartibleProyecto,
  esProjectIdValido,
  generarProjectId,
  normalizarProjectId,
  obtenerProjectIdDeSearch,
} from './projectUrl';
import {
  construirTopicosProyectoV2,
  parsearTopicoProyectoV2,
  resolverPoliticaTopicoProyectoV2,
} from './projectTopics';
import {
  aplicarOperacionIncrementalADocumento,
  calcularOperacionesEntreDocumentos,
  ControlConvergenciaProyectoV2,
  crearMensajeCursorProyecto,
  crearMensajeEdicionEstado,
  crearMensajeEdicionOperacion,
  crearMensajePresenciaProyecto,
  validarMensajeProyectoPorSufijo,
  type ElementoDocumentoHiles,
} from './projectMessages';
import {
  ProjectSyncClient,
  type TransporteMqttProyectoV2,
} from './ProjectSyncClient';

/**
 * Transporte que emula fielmente el ciclo de validación de `MqttClient.ts`:
 * cada mensaje publicado o recibido pasa por `validarMensajeMqtt(topic, payload)`
 * antes de entregarse a los suscriptores (`onMessage`).
 */
class TransporteMqttValidado implements TransporteMqttProyectoV2, ClienteMqttRemoto {
  public status: MqttConnectionStatus = 'CONNECTED';
  public suscripciones = new Set<string>();
  public willConfigurado: {
    topic: string;
    payload: unknown;
    qos?: 0 | 1;
    retain?: boolean;
  } | null = null;
  public publicaciones: Array<{
    topic: string;
    payload: unknown;
    policy?: Partial<MqttTopicPolicy>;
  }> = [];
  public erroresValidacion: Array<{ topic: string; error: string }> = [];

  private messageListeners = new Set<(topic: MqttTopic, payload: MensajeMqtt) => void>();
  private statusListeners = new Set<(status: MqttConnectionStatus) => void>();

  getStatus = (): MqttConnectionStatus => this.status;

  connect = (): void => {
    this.status = 'CONNECTED';
    this.statusListeners.forEach((l) => l('CONNECTED'));
  };

  setWillMessage = (
    will: {
      topic: string;
      payload: unknown;
      qos?: 0 | 1;
      retain?: boolean;
    } | null
  ): void => {
    this.willConfigurado = will;
  };

  subscribe = (topic: string): void => {
    this.suscripciones.add(topic);
  };

  unsubscribe = (topic: string): void => {
    this.suscripciones.delete(topic);
  };

  publish = (
    topic: string,
    payload: unknown,
    policy?: Partial<MqttTopicPolicy>
  ): boolean => {
    const validacion = validarMensajeMqtt(topic, payload);
    if (!validacion.valido) {
      this.erroresValidacion.push({ topic, error: validacion.error });
      return false;
    }
    this.publicaciones.push({ topic, payload, policy });
    return true;
  };

  onMessage = (listener: (topic: MqttTopic, payload: MensajeMqtt) => void): (() => void) => {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  };

  onStatusChange = (listener: (status: MqttConnectionStatus) => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  recibirDesdeBroker(topic: string, rawPayload: unknown): boolean {
    const parsed: unknown =
      typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    const validacion = validarMensajeMqtt(topic, parsed);
    if (!validacion.valido) {
      this.erroresValidacion.push({ topic, error: validacion.error });
      return false;
    }
    this.messageListeners.forEach((listener) =>
      listener(validacion.topic, validacion.mensaje)
    );
    return true;
  }
}

const propiedadesNodoPorDefecto = (): HilesNodeProperties => ({
  description: '',
  collapsed: false,
  locked: false,
  visible: true,
  expression: '',
  executionDelay: 0,
  enabled: true,
  tokens: 1,
  maxTokens: 1,
  delay: 0,
  condition: '',
  heldValue: '',
  operatorDirection: 'right',
  rotation: 0,
});

const crearNodoPrueba = (
  id: string,
  nombre: string,
  x = 100,
  y = 100
): ElementoDocumentoHiles => ({
  id,
  name: nombre,
  type: HilesElementType.PLACE,
  layout: { x, y, width: 60, height: 60 },
  ports: [
    {
      id: `${id}-in`,
      name: 'in',
      direction: 'input',
      dataType: 'boolean',
      nature: 'control',
      side: 'left',
      offset: 0.5,
    },
  ],
  properties: propiedadesNodoPorDefecto(),
});

const crearDocumentoPrueba = (
  allElements: ElementoDocumentoHiles[] = []
): HilesModelDocument => ({
  schemaVersion: 2,
  metadata: { savedAt: '2026-10-18T12:00:00.000Z' },
  network: { topology: null, protocol: null, nodes: [] },
  allElements,
  relationNode: [],
  connections: [],
});

describe('projectUrl: validación, normalización y enlaces compartibles ?project=<id>', () => {
  it('valida y normaliza identificadores de proyecto según el contrato v2', () => {
    expect(esProjectIdValido('semaforo-cruce-01')).toBe(true);
    expect(esProjectIdValido('ab')).toBe(false);
    expect(esProjectIdValido('MAYUSCULAS')).toBe(false);
    expect(normalizarProjectId('  Mi Proyecto #1!! ')).toBe('mi-proyecto-1');
    expect(esProjectIdValido(generarProjectId('demo'))).toBe(true);
  });

  it('extrae y construye enlaces compartibles con ?project=<project_id>', () => {
    expect(obtenerProjectIdDeSearch('?project=cruce-norte-01')).toBe(
      'cruce-norte-01',
    );
    expect(obtenerProjectIdDeSearch('?project=INVALIDO!!')).toBeNull();

    const url = construirUrlCompartibleProyecto(
      'cruce-norte-01',
      'https://hiles.local/editor?tab=1',
    );
    expect(url).toBe('https://hiles.local/editor?tab=1&project=cruce-norte-01');

    const reemplazos: string[] = [];
    const fakeLocation = {
      search: '',
      href: 'https://hiles.local/',
    } as Location;
    const fakeHistory = {
      state: null,
      replaceState: (_state: unknown, _title: string, nextUrl: string) => {
        reemplazos.push(nextUrl);
      },
    } as unknown as History;

    const asignado = asegurarProjectIdEnUrl('cruce-sur-02', {
      location: fakeLocation,
      history: fakeHistory,
    });
    expect(asignado).toBe('cruce-sur-02');
    expect(reemplazos[0]).toContain('project=cruce-sur-02');
  });
});

describe('projectTopics y projectMessages: contrato congelado udfjc/hiles/v2/projects/<projectId>/... y reloj Lamport', () => {
  it('construye y parsea tópicos bajo udfjc/hiles/v2/projects/<projectId>/...', () => {
    const topicos = construirTopicosProyectoV2('cruce-01');
    expect(topicos.documentSnapshot).toBe(
      'udfjc/hiles/v2/projects/cruce-01/document/snapshot',
    );
    expect(topicos.documentOps).toBe(
      'udfjc/hiles/v2/projects/cruce-01/document/ops',
    );
    expect(topicos.presence).toBe(
      'udfjc/hiles/v2/projects/cruce-01/presence',
    );
    expect(topicos.cursor).toBe(
      'udfjc/hiles/v2/projects/cruce-01/cursor',
    );
    expect(topicos.simulacionModeloCargar).toBe(
      'udfjc/hiles/v2/projects/cruce-01/simulacion/modelo/cargar',
    );

    const parseado = parsearTopicoProyectoV2(topicos.documentSnapshot);
    expect(parseado).toEqual({
      projectId: 'cruce-01',
      sufijo: 'document/snapshot',
      topicoCompleto: 'udfjc/hiles/v2/projects/cruce-01/document/snapshot',
    });

    expect(resolverPoliticaTopicoProyectoV2(topicos.documentSnapshot)).toEqual({
      qos: 1,
      retain: true,
    });
    expect(resolverPoliticaTopicoProyectoV2(topicos.documentOps)).toEqual({
      qos: 1,
      retain: false,
    });
    expect(resolverPoliticaTopicoProyectoV2(topicos.presence)).toEqual({
      qos: 1,
      retain: true,
    });
    expect(resolverPoliticaTopicoProyectoV2(topicos.cursor)).toEqual({
      qos: 0,
      retain: false,
    });
  });

  it('implementa reloj lógico Lamport, deduplicación por operationId y resolución LWW (clock, client_id) por entidad', () => {
    const doc1 = crearDocumentoPrueba([crearNodoPrueba('n1', 'Nodo 1')]);
    const msgSnapshot = crearMensajeEdicionEstado({
      projectId: 'cruce-01',
      clientId: 'cliente-b',
      clock: 5,
      documento: doc1,
      operationId: 'op-100',
      actualizadoEn: '2026-10-18T12:00:00.000Z',
    });

    const val = validarMensajeProyectoPorSufijo('document/snapshot', msgSnapshot);
    expect(val.ok).toBe(true);

    const control = new ControlConvergenciaProyectoV2('cruce-01', 'cliente-a');
    expect(control.obtenerReloj()).toBe(0);

    // Al recibir clock=5, el reloj Lamport local avanza a max(0, 5) + 1 = 6
    const decision1 = control.evaluarMensajeRemoto(msgSnapshot);
    expect(decision1).toMatchObject({
      aplicar: true,
      clock: 6,
      client_id: 'cliente-b',
    });
    expect(control.obtenerReloj()).toBe(6);

    // Deduplicación por operationId
    expect(control.evaluarMensajeRemoto(msgSnapshot)).toEqual({
      aplicar: false,
      motivo: 'mensaje_duplicado',
    });

    // Eco propio se descarta
    const ecoPropio = crearMensajeEdicionOperacion({
      projectId: 'cruce-01',
      clientId: 'cliente-a',
      clock: 7,
      operacion: { kind: 'node.move', elementId: 'n1', x: 20, y: 30 },
      operationId: 'op-eco',
    });
    expect(control.evaluarMensajeRemoto(ecoPropio)).toEqual({
      aplicar: false,
      motivo: 'eco_propio',
    });

    // Desempate LWW por (clock, client_id) sobre el mismo nodo:
    // Primero llega clock=8 de cliente-b sobre n1
    const opB = crearMensajeEdicionOperacion({
      projectId: 'cruce-01',
      clientId: 'cliente-b',
      clock: 8,
      operacion: { kind: 'node.move', elementId: 'n1', x: 100, y: 100 },
      operationId: 'op-b-8',
    });
    expect(control.evaluarMensajeRemoto(opB).aplicar).toBe(true);

    // Empate de clock=8 con client_id lexicográficamente menor ('cliente-0' < 'cliente-b') pierde
    const opPerdedora = crearMensajeEdicionOperacion({
      projectId: 'cruce-01',
      clientId: 'cliente-0',
      clock: 8,
      operacion: { kind: 'node.move', elementId: 'n1', x: 50, y: 50 },
      operationId: 'op-0-8',
    });
    expect(control.evaluarMensajeRemoto(opPerdedora)).toEqual({
      aplicar: false,
      motivo: 'version_antigua',
    });

    // Empate de clock=8 con client_id lexicográficamente mayor ('cliente-z' > 'cliente-b') gana
    const opGanadora = crearMensajeEdicionOperacion({
      projectId: 'cruce-01',
      clientId: 'cliente-z',
      clock: 8,
      operacion: { kind: 'node.move', elementId: 'n1', x: 300, y: 300 },
      operationId: 'op-z-8',
    });
    expect(control.evaluarMensajeRemoto(opGanadora).aplicar).toBe(true);
  });

  it('calcula y aplica operaciones incrementales reales sin sobrescribir nodos distintos', () => {
    const nodoA = crearNodoPrueba('nodo-a', 'Lugar A', 10, 20);
    const nodoB = crearNodoPrueba('nodo-b', 'Lugar B', 40, 50);
    const docBase = crearDocumentoPrueba([nodoA, nodoB]);

    // Usuario 1 mueve nodo-a
    const docUsuario1 = crearDocumentoPrueba([
      { ...nodoA, layout: { ...nodoA.layout, x: 150, y: 250 } },
      nodoB,
    ]);
    const opsUsuario1 = calcularOperacionesEntreDocumentos(docBase, docUsuario1);
    expect(opsUsuario1).toEqual([
      { kind: 'node.move', elementId: 'nodo-a', x: 150, y: 250 },
    ]);

    // Usuario 2 renombra nodo-b concurrentemente
    const docUsuario2 = crearDocumentoPrueba([
      nodoA,
      { ...nodoB, name: 'Lugar B Editado' },
    ]);
    const opsUsuario2 = calcularOperacionesEntreDocumentos(docBase, docUsuario2);
    expect(opsUsuario2).toHaveLength(1);
    expect(opsUsuario2[0]?.kind).toBe('node.update');

    // Al aplicar ambas operaciones incrementales sobre docBase, ambos cambios se conservan
    const trasOp1 = aplicarOperacionIncrementalADocumento(docBase, opsUsuario1[0]!);
    const convergente = aplicarOperacionIncrementalADocumento(trasOp1, opsUsuario2[0]!);
    expect(convergente.allElements.find((e) => e.id === 'nodo-a')?.layout).toMatchObject({
      x: 150,
      y: 250,
    });
    expect(convergente.allElements.find((e) => e.id === 'nodo-b')?.name).toBe(
      'Lugar B Editado'
    );
  });
});

describe('ProjectSyncClient: operaciones incrementales, cursores, presencia retenida con Last Will y TTL', () => {
  it('publica operaciones incrementales en document/ops sin duplicar snapshot y fusiona cambios concurrentes', () => {
    vi.useFakeTimers();
    try {
      const transporte = new TransporteMqttValidado();
      const docInicial = crearDocumentoPrueba([
        crearNodoPrueba('n-a', 'Semáforo Norte', 10, 10),
        crearNodoPrueba('n-b', 'Semáforo Sur', 20, 20),
      ]);

      const cliente = new ProjectSyncClient({
        projectId: 'cruce-compartido',
        mqtt: transporte,
        clientId: 'nav-a',
        usuario: 'Navegador A',
        debounceMs: 100,
        documentoInicial: docInicial,
      });

      const recibidos: HilesModelDocument[] = [];
      cliente.onRemoteDocument((evento) => {
        recibidos.push(evento.documento);
      });

      cliente.conectar();

      // Verifica suscripción a los 4 tópicos del plan congelado y configuración de Last Will
      expect(
        transporte.suscripciones.has(
          'udfjc/hiles/v2/projects/cruce-compartido/document/snapshot'
        )
      ).toBe(true);
      expect(
        transporte.suscripciones.has(
          'udfjc/hiles/v2/projects/cruce-compartido/document/ops'
        )
      ).toBe(true);
      expect(
        transporte.suscripciones.has(
          'udfjc/hiles/v2/projects/cruce-compartido/presence'
        )
      ).toBe(true);
      expect(
        transporte.suscripciones.has(
          'udfjc/hiles/v2/projects/cruce-compartido/cursor'
        )
      ).toBe(true);
      expect(transporte.willConfigurado).toMatchObject({
        topic: 'udfjc/hiles/v2/projects/cruce-compartido/presence',
        qos: 1,
        retain: true,
      });

      transporte.publicaciones.length = 0;

      // Edición local de n-a con debounce -> debe publicar SOLO en document/ops (no doble publicación)
      const docEditadoLocal = crearDocumentoPrueba([
        crearNodoPrueba('n-a', 'Semáforo Norte', 120, 140),
        crearNodoPrueba('n-b', 'Semáforo Sur', 20, 20),
      ]);
      cliente.notificarCambioLocal(docEditadoLocal, 'Mover n-a');
      vi.advanceTimersByTime(120);

      expect(transporte.erroresValidacion).toEqual([]);
      expect(transporte.publicaciones.map((p) => p.topic)).toEqual([
        'udfjc/hiles/v2/projects/cruce-compartido/document/ops',
      ]);

      // Llega operación incremental concurrente desde nav-b moviendo n-b
      const opRemotaB = crearMensajeEdicionOperacion({
        projectId: 'cruce-compartido',
        clientId: 'nav-b',
        clock: 5,
        operacion: { kind: 'node.move', elementId: 'n-b', x: 300, y: 400 },
        operationId: 'op-b-move-nb',
      });
      expect(
        transporte.recibirDesdeBroker(
          'udfjc/hiles/v2/projects/cruce-compartido/document/ops',
          opRemotaB
        )
      ).toBe(true);

      expect(recibidos).toHaveLength(1);
      expect(recibidos[0]?.allElements.find((e) => e.id === 'n-a')?.layout).toMatchObject({
        x: 120,
        y: 140,
      });
      expect(recibidos[0]?.allElements.find((e) => e.id === 'n-b')?.layout).toMatchObject({
        x: 300,
        y: 400,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('sincroniza cursores remotos y expira colaboradores inactivos según su TTL', () => {
    const transporte = new TransporteMqttValidado();
    const cliente = new ProjectSyncClient({
      projectId: 'cruce-compartido',
      mqtt: transporte,
      clientId: 'nav-a',
      usuario: 'Navegador A',
      presenciaTtlMs: 5000,
    });

    cliente.conectar();
    expect(cliente.publicarCursor(240, 180, 'root')).toBe(true);

    // Recibe presencia y cursor de nav-b
    const presenciaB = crearMensajePresenciaProyecto({
      projectId: 'cruce-compartido',
      clientId: 'nav-b',
      usuario: 'Colaborador B',
      conectado: true,
      ttlMs: 5000,
      actualizadoEn: '2026-10-18T12:00:00.000Z',
    });
    const cursorB = crearMensajeCursorProyecto({
      projectId: 'cruce-compartido',
      clientId: 'nav-b',
      usuario: 'Colaborador B',
      x: 512,
      y: 320,
      clock: 2,
      actualizadoEn: '2026-10-18T12:00:01.000Z',
    });

    transporte.recibirDesdeBroker(
      'udfjc/hiles/v2/projects/cruce-compartido/presence',
      presenciaB
    );
    transporte.recibirDesdeBroker(
      'udfjc/hiles/v2/projects/cruce-compartido/cursor',
      cursorB
    );

    expect(cliente.obtenerColaboradores()).toMatchObject([
      { clientId: 'nav-b', usuario: 'Colaborador B', conectado: true },
    ]);
    expect(cliente.obtenerCursoresRemotos()).toMatchObject([
      { clientId: 'nav-b', x: 512, y: 320 },
    ]);

    // Expiración por TTL (6 segundos después) marca a nav-b desconectado y limpia su cursor
    const tExpirado = Date.parse('2026-10-18T12:00:06.500Z');
    cliente.expirarColaboradoresInactivos(tExpirado);

    expect(cliente.obtenerColaboradores()).toMatchObject([
      { clientId: 'nav-b', conectado: false },
    ]);
    expect(cliente.obtenerCursoresRemotos()).toEqual([]);
  });
});

describe('Ruta real MqttClient → validarMensajeMqtt → RemoteExecutionClient para simulación por proyecto v2', () => {
  it('valida y entrega modelo/confirmacion, simulacion/estado y error sobre tópicos de proyecto v2', () => {
    const transporte = new TransporteMqttValidado();
    const ids = ['carga-1', 'cmd-1', 'in-1'];
    const clienteRemoto = new RemoteExecutionClient(
      transporte,
      () => ids.shift() ?? 'id-extra',
      { projectId: 'cruce-semaforos' }
    );

    const eventos: EventoEjecucionRemota[] = [];
    clienteRemoto.onEvent((ev) => eventos.push(ev));
    clienteRemoto.activarSesion('cruce-semaforos', 1);
    clienteRemoto.start();

    // 1. Publicaciones desde RemoteExecutionClient pasan por validarMensajeMqtt sin errores
    expect(
      clienteRemoto.cargarModeloIrV2({
        ir_version: 2,
        modelo_id: 'cruce-semaforos',
        version: 1,
        nombre: 'Cruce',
        metadata: {
          documento_schema_version: 2,
          compilado_en: '2026-10-18T12:00:00.000Z',
          bloque_raiz_id: null,
        },
        entradas_externas: [],
        elementos: [],
        conexiones: [],
      })
    ).toBe(true);
    expect(clienteRemoto.enviarComando('iniciar')).toBe(true);
    expect(clienteRemoto.establecerEntrada('sensor-norte', [1, 0, 1])).toBe(true);
    expect(transporte.erroresValidacion).toEqual([]);

    // 2. Mensajes entrantes desde la Pico por tópicos del proyecto pasan por validarMensajeMqtt y llegan a RemoteExecutionClient
    const topicos = clienteRemoto.obtenerTopicosProyecto()!;
    expect(
      transporte.recibirDesdeBroker(topicos.simulacionModeloConfirmacion, {
        id_mensaje: 'carga-1',
        modelo_id: 'cruce-semaforos',
        version: 1,
        ir_version: 2,
        aceptado: true,
      })
    ).toBe(true);

    expect(
      transporte.recibirDesdeBroker(topicos.simulacionEstado, {
        modelo_id: 'cruce-semaforos',
        version: 1,
        secuencia: 1,
        estado: 'ejecutando',
        elementos: {
          'fb-control': {
            salida: { fase: 'verde' },
            salidas: { 'out-1': { fase: 'verde' } },
          },
          'hold-sensor': {
            valor_retenido: 1,
            evento_pendiente: true,
            cola_dch: 0,
            cola_desbordada: false,
          },
        },
      })
    ).toBe(true);

    expect(
      transporte.recibirDesdeBroker(topicos.error, {
        id_mensaje: 'err-1',
        codigo: 'DCH_COLA_DESBORDADA',
        mensaje: 'La cola DCH superó su capacidad máxima.',
      })
    ).toBe(true);

    expect(transporte.erroresValidacion).toEqual([]);
    expect(
      eventos.filter((e) => e.tipo !== 'estado_mqtt').map((e) => e.tipo)
    ).toEqual([
      'confirmacion',
      'instantanea',
      'error_remoto',
    ]);
  });
});
