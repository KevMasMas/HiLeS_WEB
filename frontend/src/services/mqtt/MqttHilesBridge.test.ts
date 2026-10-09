import { describe, expect, it } from 'vitest';
import { MotorSimulacion } from '../../engine/MotorSimulacion';
import { circuitoHumedad } from '../../engine/__tests__/fixtures';
import type { ResultadoInyeccion, ServicioInyectable } from '../../engine/tipos';
import { MQTT_TOPICS, type MqttTopic } from './config';
import { MqttHilesBridge, type ClienteMqttPuente } from './MqttHilesBridge';
import { validarMensajeMqtt, type MensajeMqtt } from './messages';

class ClienteMqttDePrueba implements ClienteMqttPuente {
  public readonly suscripciones: string[] = [];
  public readonly publicaciones: Array<{ topic: string; payload: unknown }> = [];
  private listener: ((topic: MqttTopic, payload: MensajeMqtt) => void) | null = null;

  public onMessage(listener: (topic: MqttTopic, payload: MensajeMqtt) => void): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }

  public subscribe(topic: string): void {
    this.suscripciones.push(topic);
  }

  public unsubscribe(topic: string): void {
    const indice = this.suscripciones.indexOf(topic);
    if (indice >= 0) this.suscripciones.splice(indice, 1);
  }

  public publish(topic: string, payload: unknown): boolean {
    this.publicaciones.push({ topic, payload });
    return true;
  }

  public entregar(topic: string, payload: unknown): void {
    const resultado = validarMensajeMqtt(topic, payload);
    if (!resultado.valido) throw new Error(resultado.error);
    this.listener?.(resultado.topic, resultado.mensaje);
  }
}

describe('MqttHilesBridge', () => {
  it('lleva una entrada MQTT validada hasta un Service y el motor HiLeS', async () => {
    const cliente = new ClienteMqttDePrueba();
    const motor = new MotorSimulacion();
    const { nodes, edges } = circuitoHumedad();
    motor.construirGrafo(nodes, edges);
    const bridge = new MqttHilesBridge(cliente, {
      obtenerServicios: () => motor.obtenerServiciosInyectables(),
      inyectarEntrada: (servicioId, valor) => motor.inyectarEntrada(servicioId, valor),
    });

    bridge.start();
    cliente.entregar(MQTT_TOPICS.ENTRADA_ESTABLECER, {
      servicio_id: 'sensor',
      valor: 70,
      id_mensaje: 'entrada-integracion-001',
    });
    await motor.ejecutar();

    expect(cliente.suscripciones).toContain(MQTT_TOPICS.ENTRADA_ESTABLECER);
    expect(motor.obtenerEstadosElementos().get('sensor')?.valor).toBe(70);
    expect(motor.obtenerEstadosElementos().get('espera')?.tokens).toBe(0);
    expect(motor.obtenerEstadosElementos().get('activo')?.tokens).toBe(1);
  });

  it('rechaza un valor incompatible y publica un error comprensible', () => {
    const cliente = new ClienteMqttDePrueba();
    let inyecciones = 0;
    const servicios: ServicioInyectable[] = [{ id: 'interruptor', nombre: 'Interruptor', tipoDato: 'boolean' }];
    const bridge = new MqttHilesBridge(cliente, {
      obtenerServicios: () => servicios,
      inyectarEntrada: (): ResultadoInyeccion => {
        inyecciones += 1;
        return { exito: true, mensaje: 'Entrada aceptada.' };
      },
    });

    bridge.start();
    cliente.entregar(MQTT_TOPICS.ENTRADA_ESTABLECER, {
      servicio_id: 'interruptor',
      valor: 10,
      id_mensaje: 'entrada-error-001',
    });

    expect(inyecciones).toBe(0);
    expect(cliente.publicaciones).toContainEqual({
      topic: MQTT_TOPICS.ERROR,
      payload: expect.objectContaining({
        codigo: 'ENTRADA_HILES_RECHAZADA',
        id_mensaje: 'entrada-error-001',
      }),
    });
  });

  it('publica una salida del Service con el contrato común', () => {
    const cliente = new ClienteMqttDePrueba();
    const bridge = new MqttHilesBridge(cliente, {
      obtenerServicios: () => [],
      inyectarEntrada: () => ({ exito: true, mensaje: 'Entrada aceptada.' }),
    });

    expect(bridge.publicarSalida('alarma', true, 'salida-001')).toBe(true);
    expect(cliente.publicaciones).toContainEqual({
      topic: MQTT_TOPICS.SALIDA,
      payload: { servicio_id: 'alarma', valor: true, id_mensaje: 'salida-001' },
    });
  });
});
