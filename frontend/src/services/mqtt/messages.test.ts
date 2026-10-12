import { describe, expect, it } from 'vitest';
import { MQTT_MAX_PAYLOAD_BYTES, MQTT_TOPICS } from './config';
import {
  ControlSecuenciaRemota,
  DeduplicadorMensajes,
  EJEMPLOS_MENSAJES_MQTT,
  MQTT_VENTANA_DEDUPLICACION,
  validarMensajeMqtt,
} from './messages';

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

  it('valida versión, límites y estructura del modelo ejecutable', () => {
    expect(validarMensajeMqtt(MQTT_TOPICS.MODELO_CARGAR, {
      modelo_id: 'modelo-1',
      version: 1,
      ir_version: 99,
      modelo: { elementos: [], conexiones: [] },
      id_mensaje: 'modelo-error',
    })).toMatchObject({ valido: false });

    expect(validarMensajeMqtt(MQTT_TOPICS.MODELO_CARGAR, {
      modelo_id: 'modelo-1',
      version: 1,
      ir_version: 1,
      modelo: { elementos: 'no-es-lista', conexiones: [] },
      id_mensaje: 'modelo-error',
    })).toMatchObject({ valido: false });

    expect(validarMensajeMqtt(MQTT_TOPICS.MODELO_CARGAR, {
      modelo_id: 'modelo-1',
      version: 1,
      ir_version: 1,
      modelo: {
        elementos: [{ id: 'x', tipo: 'sample', nombre: 'No soportado' }],
        conexiones: [],
      },
      id_mensaje: 'modelo-ir-invalida',
    })).toMatchObject({ valido: false });
  });

  it('rechaza cargas que superan el límite de 32768 bytes del contrato', () => {
    const resultado = validarMensajeMqtt(MQTT_TOPICS.ERROR, {
      mensaje: 'x'.repeat(MQTT_MAX_PAYLOAD_BYTES),
    });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.error).toContain(`${MQTT_MAX_PAYLOAD_BYTES} bytes`);
  });

  it('rechaza estados remotos con secuencias o tokens inválidos', () => {
    expect(validarMensajeMqtt(MQTT_TOPICS.SIMULACION_ESTADO, {
      modelo_id: 'modelo-1',
      version: 1,
      secuencia: -1,
      estado: 'pausada',
      elementos: {},
    })).toMatchObject({ valido: false });

    expect(validarMensajeMqtt(MQTT_TOPICS.SIMULACION_ESTADO, {
      modelo_id: 'modelo-1',
      version: 1,
      secuencia: 1,
      estado: 'pausada',
      elementos: { lugar: { tokens: -1 } },
    })).toMatchObject({ valido: false });
  });

  it('descarta instantáneas fuera de orden, repetidas o de otro modelo/versión', () => {
    const control = new ControlSecuenciaRemota();
    const base = {
      modelo_id: 'cruce-01',
      version: 2,
      secuencia: 0,
      estado: 'lista' as const,
      elementos: {},
    };

    expect(control.evaluar(base)).toEqual({ aplicar: false, motivo: 'sin_sesion' });

    control.activarModelo('cruce-01', 2);
    expect(control.evaluar(base)).toEqual({ aplicar: true, secuencia: 0 });
    expect(control.evaluar(base)).toEqual({ aplicar: false, motivo: 'secuencia_antigua' });
    expect(control.evaluar({ ...base, secuencia: 3 })).toEqual({ aplicar: true, secuencia: 3 });
    expect(control.evaluar({ ...base, secuencia: 2 })).toEqual({ aplicar: false, motivo: 'secuencia_antigua' });
    expect(control.evaluar({ ...base, modelo_id: 'otro-modelo', secuencia: 4 })).toEqual({
      aplicar: false,
      motivo: 'modelo_distinto',
    });
    expect(control.evaluar({ ...base, version: 1, secuencia: 4 })).toEqual({
      aplicar: false,
      motivo: 'version_distinta',
    });

    control.activarModelo('cruce-01', 3);
    expect(control.evaluar({ ...base, version: 3, secuencia: 0 })).toEqual({ aplicar: true, secuencia: 0 });
  });

  it('conserva al menos los últimos 32 id_mensaje para deduplicar comandos repetidos', () => {
    const deduplicador = new DeduplicadorMensajes<string>();
    for (let i = 1; i <= MQTT_VENTANA_DEDUPLICACION; i += 1) {
      deduplicador.registrar(`cmd-${i}`, `resp-${i}`);
    }
    expect(deduplicador.esDuplicado('cmd-1')).toBe(true);
    expect(deduplicador.obtenerRespuesta('cmd-32')).toBe('resp-32');

    deduplicador.registrar('cmd-33', 'resp-33');
    expect(deduplicador.esDuplicado('cmd-1')).toBe(false);
    expect(deduplicador.esDuplicado('cmd-2')).toBe(true);
    expect(deduplicador.esDuplicado('cmd-33')).toBe(true);
  });
});
