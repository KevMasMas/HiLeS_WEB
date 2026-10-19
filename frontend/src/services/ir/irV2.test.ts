import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isModelDocument,
  migrateV1toV2,
  type HilesModelDocument,
} from '../../domain/modelDocument';
import { MotorSimulacion } from '../../engine/MotorSimulacion';
import { HilesElementType } from '../../types/hiles';
import {
  compilarDocumentoAIr,
  compilarModeloEditorAIrV2,
  ejecutarCodigoPythonPerfilV2,
  ErrorPythonPerfilIrV2,
  ErrorValorRuntimeIrV2,
  extraerElementosEstadoIrV2,
  IR_LIMITES_VALORES_V2,
  migrarIrV1AV2,
  validarCodigoPythonPerfilV2,
  validarModeloIrV2,
  validarValorRuntimeIrV2,
  type IrVectorEjecucionV2,
  type IrVectorInvalidoV2,
} from './index';

const RUTA_OUTPUT = resolve(process.cwd(), '..', 'output');
const RUTA_VECTORES_V2 = resolve(
  process.cwd(),
  '..',
  'docs',
  'mqtt',
  'vectores_ir_v2',
);

const cargarDocumento = (nombreArchivo: string): HilesModelDocument => {
  const contenido: unknown = JSON.parse(
    readFileSync(resolve(RUTA_OUTPUT, nombreArchivo), 'utf8'),
  );
  if (!isModelDocument(contenido)) {
    throw new Error(
      `El archivo ${nombreArchivo} no es un HilesModelDocument válido.`,
    );
  }
  return migrateV1toV2(contenido);
};

describe('Validación de valores runtime IR v2 (vector y custom)', () => {
  it('acepta escalares, vectores y estructuras custom dentro de los límites', () => {
    expect(validarValorRuntimeIrV2([1, 2.5, -3], 'vector')).toEqual([
      1, 2.5, -3,
    ]);
    expect(
      validarValorRuntimeIrV2(
        { modo: 'activo', pesos: [1, 2, 3], ok: true },
        'custom',
      ),
    ).toEqual({
      modo: 'activo',
      pesos: [1, 2, 3],
      ok: true,
    });
  });

  it('rechaza vectores demasiado largos, NaN y estructuras que exceden profundidad', () => {
    const vectorLargo = Array.from(
      { length: IR_LIMITES_VALORES_V2.MAX_VECTOR_LENGTH + 1 },
      (_, i) => i,
    );
    expect(() => validarValorRuntimeIrV2(vectorLargo, 'vector')).toThrowError(
      ErrorValorRuntimeIrV2,
    );
    expect(() => validarValorRuntimeIrV2([1, Number.NaN], 'vector')).toThrow(
      /NaN/,
    );
    expect(() =>
      validarValorRuntimeIrV2({ a: { b: { c: { d: { e: { f: { g: 1 } } } } } } }, 'custom'),
    ).toThrow(/Profundidad máxima/);
  });
});

describe('Perfil Python restringido de IR v2', () => {
  const entradas = [
    { puerto: 'in-1', variable: 'vehiculos', tipo_dato: 'vector' as const },
    { puerto: 'in-2', variable: 'umbral', tipo_dato: 'integer' as const },
  ];
  const salidas = [
    { puerto: 'out-1', variable: 'alerta', tipo_dato: 'boolean' as const },
  ];

  it('valida y ejecuta tanto modo expresión como modo función calcular(...)', () => {
    const exprRes = ejecutarCodigoPythonPerfilV2(
      'sum(vehiculos) >= umbral',
      { vehiculos: [3, 4, 2], umbral: 8 },
      entradas,
      salidas,
    );
    expect(exprRes).toEqual({ 'out-1': true });

    const fnRes = ejecutarCodigoPythonPerfilV2(
      [
        'def calcular(**inputs):',
        "    vehiculos = inputs.get('vehiculos', [])",
        "    umbral = inputs.get('umbral', 10)",
        '    total = sum(vehiculos)',
        '    if total >= umbral:',
        '        return True',
        '    else:',
        '        return False',
      ].join('\n'),
      { vehiculos: [1, 2, 1], umbral: 8 },
      entradas,
      salidas,
    );
    expect(fnRes).toEqual({ 'out-1': false });
  });

  it('rechaza imports, bucles, lambdas y atributos prohibidos con PYTHON_PERFIL_PROHIBIDO', () => {
    for (const codigoProhibido of [
      'def calcular(vehiculos, umbral):\n    import math\n    return True',
      'def calcular(vehiculos, umbral):\n    while True:\n        pass\n    return False',
      'def calcular(vehiculos, umbral):\n    for x in vehiculos:\n        pass\n    return True',
      'def calcular(vehiculos, umbral):\n    return vehiculos.__class__',
    ]) {
      expect(() =>
        validarCodigoPythonPerfilV2(codigoProhibido, entradas, salidas),
      ).toThrowError(ErrorPythonPerfilIrV2);
    }
  });
});

describe('Compilador HilesModelDocument → IR v2 y migración IR v1 → IR v2', () => {
  it('compila demo-parqueadero-converters.json incluyendo Sample y Hold en IR v2', () => {
    const documento = cargarDocumento('demo-parqueadero-converters.json');
    const compilado = compilarModeloEditorAIrV2(documento);
    expect(compilado.ok).toBe(true);
    expect(compilado.modelo).not.toBeNull();
    if (!compilado.modelo) return;

    expect(
      compilado.modelo.elementos.some((el) => el.tipo === 'sample'),
    ).toBe(true);
    expect(compilado.modelo.elementos.some((el) => el.tipo === 'hold')).toBe(
      true,
    );
    expect(
      compilado.modelo.conexiones.some((c) => c.tipo === 'dch'),
    ).toBe(true);
    expect(
      compilado.modelo.conexiones.some((c) => c.tipo === 'lch'),
    ).toBe(true);
  });

  it('compila bloques funcionales en Python y rechaza código JavaScript imperativo', () => {
    const documento = cargarDocumento('demo-2-humedad-token.json');
    const fb = documento.allElements.find(
      (el) => el.type === HilesElementType.FUNCTIONAL_BLOCK,
    )!;
    fb.properties.code = 'def calcular(humedad):\n    return humedad < 76';
    fb.properties.codeLanguage = 'python';

    const okPython = compilarModeloEditorAIrV2(documento);
    expect(okPython.ok).toBe(true);
    expect(
      okPython.modelo?.elementos.find((e) => e.id === fb.id),
    ).toMatchObject({
      tipo: 'functional_block',
      lenguaje: 'python',
    });

    fb.properties.code = 'return humedad < 76;';
    fb.properties.codeLanguage = 'javascript';
    const rechazoJs = compilarModeloEditorAIrV2(documento);
    expect(rechazoJs.ok).toBe(false);
    expect(rechazoJs.errores[0]?.codigo).toBe('IR_CODIGO_NO_SOPORTADO');
  });

  it('migra modelos IR v1 a IR v2 sin pérdida semántica', () => {
    const documento = cargarDocumento('demo-4-semaforos-inteligentes.json');
    const v1 = compilarDocumentoAIr(documento);
    expect(v1.ok).toBe(true);
    if (!v1.ok) return;

    const migrado = migrarIrV1AV2(v1.ir);
    const validado = validarModeloIrV2(migrado);
    expect(validado.ok).toBe(true);
    expect(validado.modelo?.ir_version).toBe(2);
    expect(validado.modelo?.elementos).toHaveLength(v1.ir.elementos.length);
    expect(validado.modelo?.conexiones).toHaveLength(v1.ir.conexiones.length);
  });
});

describe('Vectores compartidos docs/mqtt/vectores_ir_v2', () => {
  it('acepta todos los vectores en modelos/validos/', () => {
    const rutaValidos = resolve(RUTA_VECTORES_V2, 'modelos', 'validos');
    const archivos = readdirSync(rutaValidos).filter((f) =>
      f.endsWith('.json'),
    );
    expect(archivos.length).toBeGreaterThanOrEqual(3);

    for (const archivo of archivos) {
      const contenido: unknown = JSON.parse(
        readFileSync(resolve(rutaValidos, archivo), 'utf8'),
      );
      const resultado = validarModeloIrV2(contenido, { permitirVacio: false });
      expect(resultado.valido, archivo).toBe(true);
    }
  });

  it('rechaza cada vector en modelos/invalidos/ con el código esperado', () => {
    const rutaInvalidos = resolve(RUTA_VECTORES_V2, 'modelos', 'invalidos');
    const archivos = readdirSync(rutaInvalidos).filter((f) =>
      f.endsWith('.json'),
    );
    expect(archivos.length).toBeGreaterThanOrEqual(8);

    for (const archivo of archivos) {
      const caso = JSON.parse(
        readFileSync(resolve(rutaInvalidos, archivo), 'utf8'),
      ) as IrVectorInvalidoV2;
      const resultado = validarModeloIrV2(caso.modelo);
      expect(resultado.valido, `${archivo}: ${caso.descripcion}`).toBe(false);
      expect(resultado.errores[0]?.codigo, archivo).toBe(caso.codigo_esperado);
    }
  });

  it('reproduce paso a paso todos los vectores en ejecucion/ con MotorSimulacion', async () => {
    const rutaEjecucion = resolve(RUTA_VECTORES_V2, 'ejecucion');
    const archivos = readdirSync(rutaEjecucion).filter((f) =>
      f.endsWith('.json'),
    );
    expect(archivos.length).toBeGreaterThanOrEqual(3);

    for (const archivo of archivos) {
      const vector = JSON.parse(
        readFileSync(resolve(rutaEjecucion, archivo), 'utf8'),
      ) as IrVectorEjecucionV2;
      const validacion = validarModeloIrV2(vector.modelo, {
        permitirVacio: false,
      });
      expect(validacion.valido, archivo).toBe(true);

      const motor = new MotorSimulacion();
      motor.construirDesdeIrV2(vector.modelo);

      expect(
        extraerElementosEstadoIrV2(vector.modelo, motor),
        `${archivo} (estado inicial)`,
      ).toEqual(vector.estado_inicial);

      for (const [indice, paso] of vector.pasos.entries()) {
        for (const [servicioId, valor] of Object.entries(paso.entradas ?? {})) {
          const inyeccion = motor.inyectarEntrada(servicioId, valor);
          expect(
            inyeccion.exito,
            `${archivo} paso ${indice + 1}: ${servicioId}`,
          ).toBe(true);
        }
        await motor.paso(paso.avance_tiempo_ms ?? 0);
        expect(
          extraerElementosEstadoIrV2(vector.modelo, motor),
          `${archivo} paso ${indice + 1}`,
        ).toEqual(paso.elementos_esperados);
      }
    }
  });
});
