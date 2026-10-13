import { describe, expect, it } from 'vitest';
import { MQTT_TOPICS, type MqttConnectionStatus, type MqttTopic } from './config';
import { RemoteExecutionClient, type ClienteMqttRemoto, type EventoEjecucionRemota } from './RemoteExecutionClient';
import type { MensajeMqtt, MensajeSimulacionEstado } from './messages';

class ClienteMqttFalso implements ClienteMqttRemoto {
  public estado: MqttConnectionStatus = 'DISCONNECTED';
  public conexiones = 0;
  public suscripciones = new Set<string>();
  public publicaciones: Array<{ topic: string; payload: unknown }> = [];
  private mensajes = new Set<(topic: MqttTopic, payload: MensajeMqtt) => void>();
  private estados = new Set<(status: MqttConnectionStatus) => void>();

  getStatus = () => this.estado;
  connect = () => { this.conexiones += 1; };
  subscribe = (topic: string) => { this.suscripciones.add(topic); };
  unsubscribe = (topic: string) => { this.suscripciones.delete(topic); };
  publish = (topic: string, payload: unknown) => { this.publicaciones.push({ topic, payload }); return true; };
  onMessage = (listener: (topic: MqttTopic, payload: MensajeMqtt) => void) => {
    this.mensajes.add(listener);
    return () => this.mensajes.delete(listener);
  };
  onStatusChange = (listener: (status: MqttConnectionStatus) => void) => {
    this.estados.add(listener);
    return () => this.estados.delete(listener);
  };
  emitir(topic: MqttTopic, payload: MensajeMqtt): void {
    this.mensajes.forEach((listener) => listener(topic, payload));
  }
}

const instantanea = (secuencia: number, modeloId = 'cruce-01', version = 1): MensajeSimulacionEstado => ({
  modelo_id: modeloId,
  version,
  secuencia,
  estado: 'pausada',
  elementos: { semaforo: { salida: true } },
});

describe('RemoteExecutionClient', () => {
  it('no duplica suscripciones y permite reintentar la conexión', () => {
    const mqtt = new ClienteMqttFalso();
    const cliente = new RemoteExecutionClient(mqtt);
    cliente.start();
    cliente.start();
    expect(mqtt.conexiones).toBe(2);
    expect([...mqtt.suscripciones]).toEqual([
      MQTT_TOPICS.MODELO_CONFIRMACION,
      MQTT_TOPICS.SIMULACION_ESTADO,
      MQTT_TOPICS.ERROR,
    ]);
  });

  it('publica modelo, comandos y entradas con la misma sesión', () => {
    const mqtt = new ClienteMqttFalso();
    const ids = ['modelo-1', 'comando-1', 'entrada-1'];
    const cliente = new RemoteExecutionClient(mqtt, () => ids.shift()!);
    cliente.activarSesion('cruce-01', 3);
    cliente.cargarModelo({ elementos: [], conexiones: [] });
    cliente.enviarComando('paso');
    cliente.establecerEntrada('sensor', true);

    expect(mqtt.publicaciones).toMatchObject([
      { topic: MQTT_TOPICS.MODELO_CARGAR, payload: { modelo_id: 'cruce-01', version: 3, id_mensaje: 'modelo-1' } },
      { topic: MQTT_TOPICS.SIMULACION_COMANDO, payload: { accion: 'paso', modelo_id: 'cruce-01', version: 3, id_mensaje: 'comando-1' } },
      { topic: MQTT_TOPICS.ENTRADA_ESTABLECER, payload: { servicio_id: 'sensor', valor: true, modelo_id: 'cruce-01', version: 3, id_mensaje: 'entrada-1' } },
    ]);
  });

  it('solo entrega estados nuevos de la sesión activa', () => {
    const mqtt = new ClienteMqttFalso();
    const cliente = new RemoteExecutionClient(mqtt);
    const eventos: EventoEjecucionRemota[] = [];
    cliente.onEvent((evento) => eventos.push(evento));
    cliente.activarSesion('cruce-01', 1);
    cliente.start();

    mqtt.emitir(MQTT_TOPICS.SIMULACION_ESTADO, instantanea(2));
    mqtt.emitir(MQTT_TOPICS.SIMULACION_ESTADO, instantanea(1));
    mqtt.emitir(MQTT_TOPICS.SIMULACION_ESTADO, instantanea(3, 'otro'));

    expect(eventos.filter((evento) => evento.tipo === 'instantanea')).toHaveLength(1);
    expect(eventos.filter((evento) => evento.tipo === 'descartada')).toMatchObject([
      { motivo: 'secuencia_antigua' },
      { motivo: 'modelo_distinto' },
    ]);
  });

  it('rechaza acciones sin sesión y valida sus identificadores', () => {
    const cliente = new RemoteExecutionClient(new ClienteMqttFalso());
    expect(() => cliente.enviarComando('paso')).toThrow('Primero debes unirte');
    expect(() => cliente.activarSesion(' ', 1)).toThrow('no puede estar vacío');
    expect(() => cliente.activarSesion('modelo', 0)).toThrow('entero positivo');
  });

  it('reinicia el filtro al aceptar una recarga y entrega errores de la Pico', () => {
    const mqtt = new ClienteMqttFalso();
    const cliente = new RemoteExecutionClient(mqtt);
    const eventos: EventoEjecucionRemota[] = [];
    cliente.onEvent((evento) => eventos.push(evento));
    cliente.activarSesion('cruce-01', 1);
    cliente.start();

    mqtt.emitir(MQTT_TOPICS.SIMULACION_ESTADO, instantanea(8));
    mqtt.emitir(MQTT_TOPICS.MODELO_CONFIRMACION, {
      modelo_id: 'cruce-01', version: 1, ir_version: 1, aceptado: true, id_mensaje: 'recarga-1',
    });
    mqtt.emitir(MQTT_TOPICS.SIMULACION_ESTADO, instantanea(0));
    mqtt.emitir(MQTT_TOPICS.ERROR, { codigo: 'COMANDO_RECHAZADO', mensaje: 'Comando inválido', id_mensaje: 'cmd-1' });

    expect(eventos.filter((evento) => evento.tipo === 'instantanea')).toHaveLength(2);
    expect(eventos.at(-1)).toMatchObject({ tipo: 'error_remoto', error: { codigo: 'COMANDO_RECHAZADO' } });
  });
});
