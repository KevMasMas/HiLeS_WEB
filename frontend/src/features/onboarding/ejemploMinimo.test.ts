import { describe, expect, it } from 'vitest';
import { validateModelDocument } from '../../domain/modelDocument';
import { compilarDocumentoAIrV2 } from '../../services/ir/compiladorIrV2';
import { particionarIrV2Distribuida, resolverAsignacionesDistribuidasV3 } from '../../services/ir/particionarIr';
import type { EjecutorDisponibleV3 } from '../../services/ir/tiposIrDistribuida';
import { crearEjemploMinimo } from './ejemploMinimo';
import { pasosTutorial } from './tutorialSteps';

const ejecutor = (executor_id: string, tipo: 'pico' | 'browser'): EjecutorDisponibleV3 => ({
  executor_id,
  tipo,
  estado: 'online',
  capacidades: { ir_versions: [2], lenguajes: ['python', 'expresion'], max_fragment_bytes: 30000, max_elementos: 64 },
});

describe('ejemplo mínimo del tutorial', () => {
  it('es un documento válido que compila a IR v2', () => {
    const documento = crearEjemploMinimo();
    expect(validateModelDocument(documento)).toEqual([]);
    const compilado = compilarDocumentoAIrV2(documento, { modeloId: 'tutorial' });
    expect(compilado.errores).toEqual([]);
    expect(compilado.modelo?.elementos.map((elemento) => elemento.id).sort()).toEqual(['ejemplo-entrada', 'ejemplo-resultado', 'ejemplo-sumar']);
  });

  it('se reparte entre una Pico y este navegador con una ruta remota', async () => {
    const documento = crearEjemploMinimo();
    const modelo = compilarDocumentoAIrV2(documento, { modeloId: 'tutorial' }).modelo!;
    const plan = { structural_blocks: { 'ejemplo-sensor': 'pico:demo', 'ejemplo-proceso': 'browser:local' } };
    const { asignaciones, errores } = resolverAsignacionesDistribuidasV3({ documento, modelo, plan });
    expect(errores).toEqual([]);
    const resultado = await particionarIrV2Distribuida({
      project_id: 'tutorial',
      deployment_id: 'dep-1',
      epoch: 1,
      modelo,
      ejecutores: [ejecutor('pico:demo', 'pico'), ejecutor('browser:local', 'browser')],
      asignaciones,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.fragments).toHaveLength(2);
    expect(resultado.manifest.routes.map((ruta) => ruta.connection_id)).toEqual(['ejemplo-cch-entrada']);
  });

  it('el tutorial cubre canvas, elementos, conexiones, colaboración, despliegue y ejecución', () => {
    const temas = pasosTutorial.map((paso) => paso.tema);
    for (const tema of ['canvas', 'elementos', 'conexiones', 'colaboracion', 'despliegue', 'ejecucion']) {
      expect(temas).toContain(tema);
    }
    pasosTutorial.forEach((paso) => {
      expect(paso.titulo.length).toBeGreaterThan(3);
      expect(paso.accion.length).toBeGreaterThan(10);
    });
  });
});
