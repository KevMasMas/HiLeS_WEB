import { describe, expect, it, vi } from 'vitest';
import type { MqttConnectionStatus, MqttTopicPolicy } from '../mqtt/config';
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
  obtenerPoliticaTopicoProyectoV2,
  parsearTopicoProyectoV2,
} from './projectTopics';
import {
  ControlConvergenciaProyectoV2,
  crearMensajeEdicionEstado,
  crearMensajeEdicionOperacion,
  crearMensajePresenciaProyecto,
  validarMensajeProyectoPorSufijo,
  type HilesModelDocument,
} from './projectMessages';
import {
  ProjectSyncClient,
  type TransporteMqttProyectoV2,
} from './ProjectSyncClient';

class TransporteMqttFalso implements TransporteMqttProyectoV2 {
  public status: MqttConnectionStatus = 'CONNECTED';
  public suscripciones = new Set<string>();
  public publicaciones: Array<{
    topic: string;
    payload: unknown;
    policy?: MqttTopicPolicy;
  }> = [];
  private rawListeners = new Set<(topic: string, rawPayload: string) => void>();
  private statusListeners = new Set<(status: MqttConnectionStatus) => void>();

  getStatus = () => this.status;
  connect = () => {
    this.status = 'CONNECTED';
  };
  subscribe = (topic: string) => {
    this.suscripciones.add(topic);
  };
  unsubscribe = (topic: string) => {
    this.suscripciones.delete(topic);
  };
  publish = (topic: string, payload: unknown, policy?: MqttTopicPolicy) => {
    this.publicaciones.push({ topic, payload, policy });
    return true;
  };
  onRawMessage = (listener: (topic: string, rawPayload: string) => void) => {
    this.rawListeners.add(listener);
    return () => this.rawListeners.delete(listener);
  };
  onStatusChange = (listener: (status: MqttConnectionStatus) => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  emitirRaw(topic: string, payload: unknown): void {
    const raw =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.rawListeners.forEach((l) => l(topic, raw));
  }
}

const crearDocumentoPrueba = (nombre: string): HilesModelDocument => ({
  schemaVersion: 2,
  meta: {
    name: nombre,
    description: 'Proyecto compartido',
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
  },
  elements: [],
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

describe('projectTopics y projectMessages: tópicos dinámicos y convergencia sin bucles', () => {
  it('construye y parsea tópicos bajo hiles/v2/proyectos/<project_id>/...', () => {
    const topicos = construirTopicosProyectoV2('cruce-01');
    expect(topicos.edicionEstado).toBe(
      'hiles/v2/proyectos/cruce-01/edicion/estado',
    );
    expect(topicos.simulacionModeloCargar).toBe(
      'hiles/v2/proyectos/cruce-01/simulacion/modelo/cargar',
    );

    const parseado = parsearTopicoProyectoV2(topicos.edicionEstado);
    expect(parseado).toEqual({
      projectId: 'cruce-01',
      sufijo: 'edicion/estado',
      topicoCompleto: 'hiles/v2/proyectos/cruce-01/edicion/estado',
    });
    expect(obtenerPoliticaTopicoProyectoV2('edicion/estado')).toEqual({
      qos: 1,
      retain: true,
    });
  });

  it('valida mensajes de edición y presencia y descarta ecos propios o revisiones antiguas', () => {
    const doc1 = crearDocumentoPrueba('Versión 1');
    const msgEstado = crearMensajeEdicionEstado({
      projectId: 'cruce-01',
      clientId: 'cliente-remoto',
      revision: 2,
      documento: doc1,
      idMensaje: 'msg-100',
      actualizadoEn: '2026-10-18T12:00:00.000Z',
    });

    const val = validarMensajeProyectoPorSufijo('edicion/estado', msgEstado);
    expect(val.ok).toBe(true);

    const control = new ControlConvergenciaProyectoV2('cliente-local', 1);
    expect(control.evaluarMensajeEntrante(msgEstado)).toEqual({
      aceptar: true,
      revisionAdoptada: 2,
    });

    // Duplicado por id_mensaje
    expect(control.evaluarMensajeEntrante(msgEstado)).toEqual({
      aceptar: false,
      motivo: 'duplicate_message',
    });

    // Eco propio
    const ecoPropio = crearMensajeEdicionOperacion({
      projectId: 'cruce-01',
      clientId: 'cliente-local',
      revision: 3,
      baseRevision: 2,
      documento: doc1,
    });
    expect(control.evaluarMensajeEntrante(ecoPropio)).toEqual({
      aceptar: false,
      motivo: 'own_echo',
    });

    // Revisión antigua
    const antiguo = crearMensajeEdicionOperacion({
      projectId: 'cruce-01',
      clientId: 'cliente-remoto',
      revision: 1,
      baseRevision: 0,
      documento: doc1,
    });
    expect(control.evaluarMensajeEntrante(antiguo)).toEqual({
      aceptar: false,
      motivo: 'stale_revision',
    });
  });
});

describe('ProjectSyncClient: sincronización en tiempo real entre navegadores', () => {
  it('suscribe a los tópicos del proyecto, publica cambios con debounce y aplica actualizaciones remotas sin re-publicarlas', () => {
    vi.useFakeTimers();
    try {
      const transporte = new TransporteMqttFalso();
      const cliente = new ProjectSyncClient(transporte, {
        projectId: 'cruce-compartido',
        clientId: 'nav-a',
        alias: 'Navegador A',
        debounceMs: 200,
      });

      const recibidos: Array<{ revision: number; nombre: string }> = [];
      cliente.onRemoteDocument((evento) => {
        const meta = (evento.documento as { meta?: { name?: string } }).meta;
        recibidos.push({
          revision: evento.revision,
          nombre: meta?.name ?? '',
        });
      });

      cliente.conectar();
      expect(transporte.suscripciones.has('hiles/v2/proyectos/cruce-compartido/edicion/estado')).toBe(true);
      expect(transporte.suscripciones.has('hiles/v2/proyectos/cruce-compartido/edicion/operacion')).toBe(true);

      // Cambio local con debounce
      cliente.notificarCambioLocal(
        crearDocumentoPrueba('Editado en A'),
        'Cambio de nombre',
      );
      vi.advanceTimersByTime(250);

      const topicsPublicados = transporte.publicaciones.map((p) => p.topic);
      expect(topicsPublicados).toContain(
        'hiles/v2/proyectos/cruce-compartido/edicion/operacion',
      );
      expect(topicsPublicados).toContain(
        'hiles/v2/proyectos/cruce-compartido/edicion/estado',
      );

      const conteoAntesDeRemoto = transporte.publicaciones.length;

      // Llega cambio remoto desde Navegador B con revisión superior
      const remotoB = crearMensajeEdicionOperacion({
        projectId: 'cruce-compartido',
        clientId: 'nav-b',
        revision: 5,
        baseRevision: 1,
        documento: crearDocumentoPrueba('Editado en B'),
        idMensaje: 'op-remota-b-5',
      });
      transporte.emitirRaw(
        'hiles/v2/proyectos/cruce-compartido/edicion/operacion',
        remotoB,
      );

      expect(recibidos).toEqual([{ revision: 5, nombre: 'Editado en B' }]);
      // No debe provocar un eco de publicación hacia MQTT
      expect(transporte.publicaciones.length).toBe(conteoAntesDeRemoto);

      // Presencia remota
      const presenciaB = crearMensajePresenciaProyecto({
        projectId: 'cruce-compartido',
        clientId: 'nav-b',
        alias: 'Navegador B',
        conectado: true,
        rol: 'editor',
      });
      transporte.emitirRaw(
        'hiles/v2/proyectos/cruce-compartido/edicion/presencia',
        presenciaB,
      );
      expect(cliente.obtenerColaboradores()).toHaveLength(1);
      expect(cliente.obtenerColaboradores()[0]?.clientId).toBe('nav-b');

      cliente.desconectar();
    } finally {
      vi.useRealTimers();
    }
  });
});
