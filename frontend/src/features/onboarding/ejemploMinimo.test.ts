import { describe, expect, it } from 'vitest';
import { validateModelDocument } from '../../domain/modelDocument';
import { compilarDocumentoAIrV2 } from '../../services/ir/compiladorIrV2';
import { particionarIrV2Distribuida, resolverAsignacionesDistribuidasV3 } from '../../services/ir/particionarIr';
import type { EjecutorDisponibleV3 } from '../../services/ir/tiposIrDistribuida';
import { crearEjemploMinimo, crearEjemploMultiPico } from './ejemploMinimo';
import { CLAVE_TUTORIAL_COMPLETADO, pasosTutorial } from './tutorialSteps';

const ejecutor = (executor_id: string, tipo: 'pico' | 'browser'): EjecutorDisponibleV3 => ({
  executor_id,
  tipo,
  estado: 'online',
  capacidades: { ir_versions: [2], lenguajes: ['python', 'expresion'], max_fragment_bytes: 30000, max_elementos: 64 },
});

describe('ejemplos guiados y tutorial distribuido v2', () => {
  it('el ejemplo sin hardware es válido y compila a IR v2', () => {
    const documento = crearEjemploMinimo();
    expect(validateModelDocument(documento)).toEqual([]);
    const compilado = compilarDocumentoAIrV2(documento, { modeloId: 'tutorial' });
    expect(compilado.errores).toEqual([]);
    expect(compilado.modelo?.elementos.map((elemento) => elemento.id).sort()).toEqual(['ejemplo-entrada', 'ejemplo-resultado', 'ejemplo-sumar']);
  });

  it('el ejemplo mínimo se reparte entre una Pico y este navegador con una ruta remota', async () => {
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

  it('el ejemplo multi-Pico compila y genera 3 fragmentos entre dos Picos y un navegador', async () => {
    const documento = crearEjemploMultiPico();
    expect(validateModelDocument(documento)).toEqual([]);
    const compilado = compilarDocumentoAIrV2(documento, { modeloId: 'multipico' });
    expect(compilado.errores).toEqual([]);

    const modelo = compilado.modelo!;
    const plan = {
      structural_blocks: {
        'sb-entrada': 'pico:pico01w',
        'sb-proceso': 'pico:pico02w',
        'sb-decision': 'browser:supervisor',
      },
    };
    const { asignaciones, errores } = resolverAsignacionesDistribuidasV3({ documento, modelo, plan });
    expect(errores).toEqual([]);

    const resultado = await particionarIrV2Distribuida({
      project_id: 'multipico',
      deployment_id: 'dep-mp-1',
      epoch: 1,
      modelo,
      ejecutores: [
        ejecutor('pico:pico01w', 'pico'),
        ejecutor('pico:pico02w', 'pico'),
        ejecutor('browser:supervisor', 'browser'),
      ],
      asignaciones,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.fragments).toHaveLength(3);
    expect(resultado.manifest.routes.map((ruta) => ruta.connection_id)).toEqual([
      'cch-sb-entrada-proceso',
      'cch-sb-proceso-decision',
    ]);
  });

  it('el tutorial v2 cubre conexión Local/Remoto, colaborador vs ejecutor, multi-Pico, ACK, Services y estados obsoletos', () => {
    expect(CLAVE_TUTORIAL_COMPLETADO).toBe('hiles_tutorial_completado_v2');

    const temas = pasosTutorial.map((paso) => paso.tema);
    for (const tema of ['canvas', 'elementos', 'conexiones', 'colaboracion', 'despliegue', 'ejecucion']) {
      expect(temas).toContain(tema);
    }

    const textoCompleto = pasosTutorial
      .map((paso) => `${paso.titulo} ${paso.explicacion} ${paso.accion}`)
      .join(' ');

    expect(textoCompleto).toContain('colaborador');
    expect(textoCompleto).toContain('ejecutor');
    expect(textoCompleto).toContain('Local / LAN');
    expect(textoCompleto).toContain('wss://');
    expect(textoCompleto).toContain('projectId');
    expect(textoCompleto).toContain('Functional Block');
    expect(textoCompleto).toContain('ACK');
    expect(textoCompleto).toContain('Services');
    expect(textoCompleto).toContain('config_local.py');
    expect(textoCompleto).toContain('Obsoleto');
    expect(textoCompleto).toContain('multi-Pico');

    pasosTutorial.forEach((paso) => {
      expect(paso.titulo.length).toBeGreaterThan(3);
      expect(paso.accion.length).toBeGreaterThan(10);
    });
  });
});
