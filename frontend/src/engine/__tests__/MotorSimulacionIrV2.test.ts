import { afterEach, describe, expect, it } from 'vitest';
import { MotorSimulacion } from '../MotorSimulacion';
import { extraerElementosEstadoIrV2, type IrModeloV2 } from '../../services/ir';
import type { RuntimeValue } from '../../types/hiles';

const WorkerOriginal = globalThis.Worker;

class MockPyodideWorker {
  onmessage: ((evento: MessageEvent<{ ok: boolean; value?: RuntimeValue; error?: string }>) => void) | null = null;
  onerror: ((evento: ErrorEvent) => void) | null = null;

  terminate(): void {}

  postMessage(mensaje: { codigo: string; inputs: Record<string, RuntimeValue> }): void {
    queueMicrotask(() => {
      const entrada = Number(mensaje.inputs.x ?? 0);
      this.onmessage?.({
        data: {
          ok: true,
          value: entrada * 2,
        },
      } as MessageEvent<{ ok: boolean; value?: RuntimeValue; error?: string }>);
    });
  }
}

class MockPyodideWorkerFirmaEstricta extends MockPyodideWorker {
  static ultimasClaves: string[] = [];

  override postMessage(mensaje: { codigo: string; inputs: Record<string, RuntimeValue> }): void {
    MockPyodideWorkerFirmaEstricta.ultimasClaves = Object.keys(mensaje.inputs).sort();
    super.postMessage(mensaje);
  }
}

afterEach(() => {
  Object.assign(globalThis, { Worker: WorkerOriginal });
});

describe('MotorSimulacion con IR v2: canales diferenciados, desbordamiento DCH y retardos', () => {
  it('envía a Python solo las variables declaradas y no identificadores internos de puerto', async () => {
    Object.assign(globalThis, { Worker: MockPyodideWorkerFirmaEstricta });
    MockPyodideWorkerFirmaEstricta.ultimasClaves = [];
    const modelo: IrModeloV2 = {
      ir_version: 2,
      modelo_id: 'firma-python-estricta',
      version: 1,
      nombre: 'Firma Python estricta',
      metadata: {
        documento_schema_version: 2,
        compilado_en: '2026-10-28T12:00:00.000Z',
        bloque_raiz_id: null,
      },
      entradas_externas: [{
        elemento_id: 'srv', nombre: 'Entrada', puerto_salida: 'out', tipo_dato: 'integer',
      }],
      elementos: [
        {
          id: 'srv', tipo: 'service', nombre: 'Entrada', tipo_dato: 'integer',
          salidas: ['out'], entradas: [],
        },
        {
          id: 'fb', tipo: 'functional_block', nombre: 'Duplicador', habilitado: true,
          lenguaje: 'python', codigo: 'def calcular(x):\n    return x * 2',
          entradas: [{ puerto: 'puerto-interno-in', variable: 'x', tipo_dato: 'integer' }],
          salidas: [{ puerto: 'out', variable: 'y', tipo_dato: 'integer' }],
        },
      ],
      conexiones: [{
        id: 'cch', tipo: 'cch', origen: 'srv', puerto_origen: 'out',
        destino: 'fb', puerto_destino: 'puerto-interno-in',
      }],
    };

    const motor = new MotorSimulacion();
    motor.construirDesdeIrV2(modelo);
    motor.inyectarEntrada('srv', 7);
    await motor.paso(0);

    expect(MockPyodideWorkerFirmaEstricta.ultimasClaves).toEqual(['x']);
  });

  it('recorre la ruta real Service → conexión DCH → BusObserver → Hold sin repetir muestras no inyectadas y reporta DCH_COLA_DESBORDADA', async () => {
    const modelo: IrModeloV2 = {
      ir_version: 2,
      modelo_id: 'dch-fifo-overflow',
      version: 1,
      nombre: 'Cola DCH FIFO y overflow por ruta real Service -> Hold',
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

    // Inyectamos 3 muestras reales en el Service antes del paso 1 (capacidad_cola = 2)
    expect(motor.inyectarEntrada('srv-eventos', 10).exito).toBe(true);
    expect(motor.inyectarEntrada('srv-eventos', 20).exito).toBe(true);
    expect(motor.inyectarEntrada('srv-eventos', 30).exito).toBe(true);

    // Paso 1: Service publica las 3 muestras por DCH -> entran 10 y 20, 30 desborda, Hold consume 10
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

    // Paso 2 (sin nueva inyección): Service NO vuelve a emitir 30 por DCH; Hold consume el segundo evento FIFO (20)
    await motor.paso();
    const estado2 = extraerElementosEstadoIrV2(modelo, motor);
    expect(estado2['hold-1']).toMatchObject({
      valor_retenido: 20,
      salida: 20,
      evento_pendiente: true,
      cola_desbordada: true,
    });
    expect(estado2['hold-1']?.cola_dch).toBeUndefined();

    // Paso 3 (sin nueva inyección): el Service mantiene su valor pero NO genera eventos DCH repetidos
    await motor.paso();
    const estado3 = extraerElementosEstadoIrV2(modelo, motor);
    expect(estado3['hold-1']).toMatchObject({
      valor_retenido: 20,
      salida: 20,
      evento_pendiente: false,
    });

    // Paso 4 (sin nueva inyección): sigue sin generar eventos espurios
    await motor.paso();
    const estado4 = extraerElementosEstadoIrV2(modelo, motor);
    expect(estado4['hold-1']).toMatchObject({
      valor_retenido: 20,
      salida: 20,
      evento_pendiente: false,
    });
  });

  it('estabiliza Service constante → CCH con retardo → Functional Block sin reprogramar el mismo valor indefinidamente', async () => {
    Object.assign(globalThis, { Worker: MockPyodideWorker });
    const modelo: IrModeloV2 = {
      ir_version: 2,
      modelo_id: 'cch-retardo-estable',
      version: 1,
      nombre: 'Service constante por CCH con retardo hacia Functional Block',
      metadata: {
        documento_schema_version: 2,
        compilado_en: '2026-10-18T12:00:00.000Z',
        bloque_raiz_id: null,
      },
      entradas_externas: [
        {
          elemento_id: 'srv-const',
          nombre: 'Entrada constante',
          puerto_salida: 'out',
          tipo_dato: 'integer',
        },
      ],
      elementos: [
        {
          id: 'srv-const',
          tipo: 'service',
          nombre: 'Entrada constante',
          tipo_dato: 'integer',
          salidas: ['out'],
          entradas: [],
        },
        {
          id: 'fb-doble',
          tipo: 'functional_block',
          nombre: 'Duplicador',
          habilitado: true,
          lenguaje: 'python',
          codigo: 'def calcular(x):\n    return x * 2',
          entradas: [{ puerto: 'in', variable: 'x', tipo_dato: 'integer' }],
          salidas: [{ puerto: 'out', variable: 'y', tipo_dato: 'integer' }],
        },
      ],
      conexiones: [
        {
          id: 'cch-delay',
          tipo: 'cch',
          origen: 'srv-const',
          puerto_origen: 'out',
          destino: 'fb-doble',
          puerto_destino: 'in',
          retardo_ms: 100,
        },
      ],
    };

    const motor = new MotorSimulacion();
    motor.construirDesdeIrV2(modelo);
    motor.inyectarEntrada('srv-const', 7);

    // t = 0: programa entrega CCH para t = 100
    await motor.paso(0);
    expect(motor.obtenerBus().tieneEntregasDiferidasPendientes()).toBe(true);

    // t = 50: el valor del Service sigue siendo 7 -> NO debe reprogramar para t = 150
    await motor.paso(50);
    expect(motor.obtenerBus().tieneEntregasDiferidasPendientes()).toBe(true);

    // t = 100: vence la entrega original de t = 100 y ya no quedan entregas pendientes
    await motor.paso(50);
    expect(motor.obtenerBus().tieneEntregasDiferidasPendientes()).toBe(false);
    expect(extraerElementosEstadoIrV2(modelo, motor)['fb-doble']).toMatchObject({
      salida: 14,
    });

    // Ejecutar hasta estabilizar converge sin agotar maxPasos
    const resultadoEjecucion = await motor.ejecutar(10);
    expect(resultadoEjecucion.estabilizado).toBe(true);
    expect(resultadoEjecucion.pasosEjecutados).toBeLessThan(10);
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
