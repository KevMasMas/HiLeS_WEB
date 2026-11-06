import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MotorSimulacion } from '../MotorSimulacion';
import {
  extraerElementosEstadoIrV2,
  type IrModeloV2,
  type IrValorRuntimeV2,
} from '../../services/ir';

interface PasoConformidad {
  avance_tiempo_ms?: number;
  entradas: Record<string, IrValorRuntimeV2>;
  elementos_esperados: Record<string, Record<string, unknown>>;
}

interface VectorConformidad {
  descripcion: string;
  modelo: IrModeloV2;
  estado_inicial: Record<string, Record<string, unknown>>;
  pasos: PasoConformidad[];
}

interface RespuestaWorker {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const WorkerOriginal = globalThis.Worker;
const directorioVectores = path.resolve(
  process.cwd(),
  '..',
  'docs',
  'mqtt',
  'vectores_ir_v2',
  'ejecucion',
);

const cargarVectores = (): Array<[string, VectorConformidad]> => fs
  .readdirSync(directorioVectores)
  .filter((nombre) => nombre.endsWith('.json'))
  .sort()
  .map((nombre) => [
    nombre,
    JSON.parse(
      fs.readFileSync(path.join(directorioVectores, nombre), 'utf8'),
    ) as VectorConformidad,
  ]);

/**
 * Sustituye únicamente a Pyodide durante la prueba. El motor, los canales y
 * la normalización de salidas siguen siendo los reales; el resultado reproduce
 * el bloque Python incluido en el vector compartido 01.
 */
class WorkerPythonConformidad {
  onmessage: ((evento: MessageEvent<RespuestaWorker>) => void) | null = null;
  onerror: ((evento: ErrorEvent) => void) | null = null;

  terminate(): void {}

  postMessage(mensaje: { inputs: Record<string, unknown> }): void {
    const carriles = mensaje.inputs.carriles;
    if (!Array.isArray(carriles) || !carriles.every((valor) => typeof valor === 'number')) {
      queueMicrotask(() => this.onmessage?.({
        data: { ok: false, error: 'Entrada carriles inválida.' },
      } as MessageEvent<RespuestaWorker>));
      return;
    }

    const total = carriles.reduce((acumulado, valor) => acumulado + valor, 0);
    const pico = carriles.length > 0 ? Math.max(...carriles) : 0;
    queueMicrotask(() => this.onmessage?.({
      data: {
        ok: true,
        value: {
          resumen: { total, pico },
          alerta: total >= 10,
        },
      },
    } as MessageEvent<RespuestaWorker>));
  }
}

const ejecutarVector = async (
  motor: MotorSimulacion,
  vector: VectorConformidad,
): Promise<void> => {
  expect(extraerElementosEstadoIrV2(vector.modelo, motor)).toEqual(
    vector.estado_inicial,
  );

  for (const paso of vector.pasos) {
    for (const [servicioId, valor] of Object.entries(paso.entradas)) {
      expect(motor.inyectarEntrada(servicioId, valor).exito).toBe(true);
    }
    await motor.paso(paso.avance_tiempo_ms ?? 0);
    expect(extraerElementosEstadoIrV2(vector.modelo, motor)).toEqual(
      paso.elementos_esperados,
    );
  }
};

afterEach(() => {
  Object.assign(globalThis, { Worker: WorkerOriginal });
});

describe('Conformidad IR v2 compartida entre Browser y MicroPython', () => {
  it('reproduce todos los vectores de ejecución paso a paso', async () => {
    Object.assign(globalThis, { Worker: WorkerPythonConformidad });
    const vectores = cargarVectores();
    expect(vectores.length).toBeGreaterThanOrEqual(3);

    for (const [nombre, vector] of vectores) {
      const motor = new MotorSimulacion();
      motor.construirDesdeIrV2(vector.modelo);
      await ejecutarVector(motor, vector).catch((error: unknown) => {
        throw new Error(`Falló el vector ${nombre}: ${String(error)}`);
      });
    }
  });

  it('reinicia y vuelve a reproducir cada vector sin estado residual', async () => {
    Object.assign(globalThis, { Worker: WorkerPythonConformidad });

    for (const [nombre, vector] of cargarVectores()) {
      const motor = new MotorSimulacion();
      motor.construirDesdeIrV2(vector.modelo);
      await ejecutarVector(motor, vector);
      motor.reiniciar();

      expect(extraerElementosEstadoIrV2(vector.modelo, motor), nombre).toEqual(
        vector.estado_inicial,
      );
      expect(motor.obtenerBus().tieneEntregasDiferidasPendientes(), nombre).toBe(false);
      await ejecutarVector(motor, vector).catch((error: unknown) => {
        throw new Error(`Falló ${nombre} después del reinicio: ${String(error)}`);
      });
    }
  });
});
