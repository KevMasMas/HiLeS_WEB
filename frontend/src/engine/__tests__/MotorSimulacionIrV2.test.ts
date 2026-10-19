import { describe, expect, it } from 'vitest';
import { MotorSimulacion } from '../MotorSimulacion';
import { extraerElementosEstadoIrV2, type IrModeloV2 } from '../../services/ir';

describe('MotorSimulacion con IR v2: canales diferenciados, desbordamiento DCH y retardos', () => {
  it('consume exactamente 1 evento DCH por paso y reporta DCH_COLA_DESBORDADA al superar capacidad_cola', async () => {
    const modelo: IrModeloV2 = {
      ir_version: 2,
      modelo_id: 'dch-fifo-overflow',
      version: 1,
      nombre: 'Cola DCH FIFO y overflow',
      metadata: {
        documento_schema_version: 2,
        compilado_en: '2026-10-18T12:00:00.000Z',
        bloque_raiz_id: null,
      },
      entradas_externas: [
        {
          elemento_id: 'srv-eventos',
          nombre: 'Eventos',
          puerto_salida: 'out',
          tipo_dato: 'integer',
        },
      ],
      elementos: [
        {
          id: 'srv-eventos',
          tipo: 'service',
          nombre: 'Eventos',
          tipo_dato: 'integer',
          salidas: ['out'],
          entradas: [],
        },
        {
          id: 'hold-1',
          tipo: 'hold',
          nombre: 'Hold consumidor',
          habilitado: true,
          tipo_dato: 'integer',
          puerto_entrada: 'in',
          puerto_cch: 'cch-out',
          puerto_lch: 'lch-out',
        },
      ],
      conexiones: [
        {
          id: 'dch-1',
          tipo: 'dch',
          origen: 'srv-eventos',
          puerto_origen: 'out',
          destino: 'hold-1',
          puerto_destino: 'in',
          capacidad_cola: 2,
        },
      ],
    };

    const motor = new MotorSimulacion();
    motor.construirDesdeIrV2(modelo);

    // Encolamos directamente 3 eventos en la conexión DCH de capacidad 2 antes de consumir
    const bus = motor.obtenerBus();
    bus.encolarEventoDch('hold-1', 'in', 10, 2);
    bus.encolarEventoDch('hold-1', 'in', 20, 2);
    bus.encolarEventoDch('hold-1', 'in', 30, 2);

    expect(bus.obtenerEstadoColaDch('hold-1', 'in')?.desbordada).toBe(true);

    // Paso 1: consume el primer evento FIFO (10), queda 1 en cola (20)
    await motor.paso();
    expect(
      motor
        .obtenerEventos()
        .some((e) => e.mensaje.includes('DCH_COLA_DESBORDADA')),
    ).toBe(true);
    const estado1 = extraerElementosEstadoIrV2(modelo, motor);
    expect(estado1['hold-1']).toMatchObject({
      valor_retenido: 10,
      salida: 10,
      evento_pendiente: true,
      cola_dch: 1,
      cola_desbordada: true,
    });

    // Paso 2: consume el segundo evento FIFO (20), cola queda en 0
    await motor.paso();
    const estado2 = extraerElementosEstadoIrV2(modelo, motor);
    expect(estado2['hold-1']).toMatchObject({
      valor_retenido: 20,
      salida: 20,
      evento_pendiente: true,
      cola_desbordada: true,
    });
    expect(estado2['hold-1']?.cola_dch).toBeUndefined();

    // Paso 3: sin nuevos eventos, el pulso LCH baja a false pero CCH retiene 20
    await motor.paso();
    const estado3 = extraerElementosEstadoIrV2(modelo, motor);
    expect(estado3['hold-1']).toMatchObject({
      valor_retenido: 20,
      salida: 20,
      evento_pendiente: false,
    });
  });

  it('cancela el temporizador de una transición con retardo_ms si pierde habilitación antes de vencer y limpia en reset', async () => {
    const modelo: IrModeloV2 = {
      ir_version: 2,
      modelo_id: 'cancelacion-retardo',
      version: 1,
      nombre: 'Cancelación de retardo en transición',
      metadata: {
        documento_schema_version: 2,
        compilado_en: '2026-10-18T12:00:00.000Z',
        bloque_raiz_id: null,
      },
      entradas_externas: [
        {
          elemento_id: 'srv-cond',
          nombre: 'Condición',
          puerto_salida: 'out',
          tipo_dato: 'boolean',
        },
      ],
      elementos: [
        {
          id: 'srv-cond',
          tipo: 'service',
          nombre: 'Condición',
          tipo_dato: 'boolean',
          salidas: ['out'],
          entradas: [],
        },
        {
          id: 'p-inicio',
          tipo: 'place',
          nombre: 'Inicio',
          tokens: 1,
          capacidad: 1,
        },
        {
          id: 't-lenta',
          tipo: 'transition',
          nombre: 'Transición 200ms',
          habilitada: true,
          puerto_condicion: 'condicion',
          puerto_accion: 'accion',
          retardo_ms: 200,
        },
        {
          id: 'p-fin',
          tipo: 'place',
          nombre: 'Fin',
          tokens: 0,
          capacidad: 1,
        },
      ],
      conexiones: [
        {
          id: 'cch-cond',
          tipo: 'cch',
          origen: 'srv-cond',
          puerto_origen: 'out',
          destino: 't-lenta',
          puerto_destino: 'condicion',
        },
        {
          id: 'arco-1',
          tipo: 'arco',
          origen: 'p-inicio',
          destino: 't-lenta',
          peso: 1,
        },
        {
          id: 'arco-2',
          tipo: 'arco',
          origen: 't-lenta',
          destino: 'p-fin',
          peso: 1,
        },
      ],
    };

    const motor = new MotorSimulacion();
    motor.construirDesdeIrV2(modelo);

    // t = 0: habilita condición -> arma timer para t = 200
    motor.inyectarEntrada('srv-cond', true);
    await motor.paso(0);
    expect(extraerElementosEstadoIrV2(modelo, motor)['t-lenta']).toEqual({
      habilitada: true,
      disparada: false,
      timer_pendiente: true,
    });

    // t = 100: condición cae a false -> cancela timer
    motor.inyectarEntrada('srv-cond', false);
    await motor.paso(100);
    expect(extraerElementosEstadoIrV2(modelo, motor)['t-lenta']).toEqual({
      habilitada: false,
      disparada: false,
    });

    // t = 250: vuelve a habilitarse -> el timer anterior fue cancelado, inicia uno nuevo para t = 450
    motor.inyectarEntrada('srv-cond', true);
    await motor.paso(150);
    expect(extraerElementosEstadoIrV2(modelo, motor)['t-lenta']).toEqual({
      habilitada: true,
      disparada: false,
      timer_pendiente: true,
    });
    expect(extraerElementosEstadoIrV2(modelo, motor)['p-fin']).toEqual({
      tokens: 0,
    });

    // Reiniciar limpia reloj y temporizadores pendientes
    motor.reiniciar();
    expect(motor.obtenerRelojMs()).toBe(0);
    expect(extraerElementosEstadoIrV2(modelo, motor)['t-lenta']).toEqual({
      habilitada: false,
      disparada: false,
    });
  });
});
