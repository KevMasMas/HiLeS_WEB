import { describe, expect, it } from 'vitest';
import { MQTT_TOPICS } from './config';
import { EJEMPLOS_MENSAJES_MQTT, validarMensajeMqtt } from './messages';

describe('contrato de mensajes MQTT', () => {
  it('acepta el ejemplo documentado de cada topic', () => {
    Object.entries(EJEMPLOS_MENSAJES_MQTT).forEach(([topic, payload]) => {
      expect(validarMensajeMqtt(topic, payload), topic).toMatchObject({ valido: true, topic });
    });
  });

  it('rechaza contenidos que no son objetos JSON', () => {
    expect(validarMensajeMqtt(MQTT_TOPICS.LED_COMANDO, 'encender')).toEqual({
      valido: false,
      error: `Mensaje inválido en ${MQTT_TOPICS.LED_COMANDO}: el contenido debe ser un objeto JSON.`,
    });
  });

  it('explica en español qué campo del comando es inválido', () => {
    const resultado = validarMensajeMqtt(MQTT_TOPICS.LED_COMANDO, {
      accion: 'desconocida',
      id_mensaje: 'cmd-error',
    });
    expect(resultado).toEqual({
      valido: false,
      error: `Mensaje inválido en ${MQTT_TOPICS.LED_COMANDO}: accion debe ser encender, apagar o titilar.`,
    });
  });

  it('acepta los mensajes espontáneos que publica la Pico al iniciar o fallar', () => {
    expect(validarMensajeMqtt(MQTT_TOPICS.LED_ESTADO, {
      encendido: false,
      accion_aplicada: 'inicio',
    })).toMatchObject({ valido: true });
    expect(validarMensajeMqtt(MQTT_TOPICS.ERROR, {
      error: 'Acción no soportada',
    })).toMatchObject({ valido: true });
  });

  it('rechaza topics que no pertenecen al contrato', () => {
    const resultado = validarMensajeMqtt('otro/topic', {});
    expect(resultado).toMatchObject({ valido: false });
    if (!resultado.valido) expect(resultado.error).toContain('no pertenece al contrato MQTT de HiLeS');
  });
});
