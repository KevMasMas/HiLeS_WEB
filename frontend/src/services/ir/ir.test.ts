import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { isModelDocument, migrateV1toV2, type HilesModelDocument } from '../../domain/modelDocument';
import { MotorSimulacion } from '../../engine/MotorSimulacion';
import { HilesConnectionType, HilesElementType, type HilesEdgeData, type HilesNodeData } from '../../types/hiles';
import {
  CodigoIr,
  compilarDocumentoAIr,
  compilarExpresion,
  documentoAGrafoMotor,
  esCodigoImperativo,
  evaluarExpresionIr,
  extraerElementosEstadoIr,
  IR_MAX_ELEMENTOS,
  IR_PUERTO_CONDICION,
  validarIrV1,
  type IrExpresion,
  type IrModeloV1,
  type IrVectorEjecucion,
  type IrVectorInvalido,
} from './index';

const RUTA_OUTPUT = resolve(process.cwd(), '..', 'output');
const RUTA_VECTORES = resolve(process.cwd(), '..', 'docs', 'mqtt', 'vectores_ir_v1');

const cargarDocumento = (nombreArchivo: string): HilesModelDocument => {
  const contenido: unknown = JSON.parse(readFileSync(resolve(RUTA_OUTPUT, nombreArchivo), 'utf8'));
  if (!isModelDocument(contenido)) {
    throw new Error(`El archivo ${nombreArchivo} no es un HilesModelDocument válido.`);
  }
  return migrateV1toV2(contenido);
};

/** Reconstruye una expresión simple desde el AST para alimentar `MotorSimulacion` en pruebas de conformidad. */
const astAExpresionTexto = (expresion: IrExpresion | null): string => {
  if (!expresion) return '';
  if ('lit' in expresion) return typeof expresion.lit === 'string' ? JSON.stringify(expresion.lit) : String(expresion.lit);
  if ('var' in expresion) return expresion.var;
  if (expresion.args.length === 1) return `${expresion.op}(${astAExpresionTexto(expresion.args[0])})`;
  return `${astAExpresionTexto(expresion.args[0])} ${expresion.op} ${astAExpresionTexto(expresion.args[1])}`;
};

/** Convierte un `IrModeloV1` en nodos y aristas de `MotorSimulacion` para verificar conformidad paso a paso. */
const irAGrafoMotor = (ir: IrModeloV1): { nodes: Node<HilesNodeData>[]; edges: Edge<HilesEdgeData>[] } => {
  const baseProps = {
    description: '',
    collapsed: false,
    locked: false,
    visible: true,
    expression: '',
    executionDelay: 0,
    enabled: true,
    tokens: 0,
    maxTokens: 1,
    delay: 0,
    condition: '',
    heldValue: '',
    operatorDirection: 'right' as const,
    rotation: 0,
  };

  const nodes: Node<HilesNodeData>[] = ir.elementos.map((el) => {
    switch (el.tipo) {
      case 'service':
        return {
          id: el.id,
          type: 'hilesNode',
          position: { x: 0, y: 0 },
          data: {
            hilesType: HilesElementType.SERVICE,
            name: el.nombre,
            ports: [
              ...el.salidas.map((id) => ({
                id,
                name: id,
                direction: 'output' as const,
                dataType: el.tipo_dato,
                nature: 'continuous' as const,
                side: 'right' as const,
                offset: 0.5,
              })),
              ...el.entradas.map((id) => ({
                id,
                name: id,
                direction: 'input' as const,
                dataType: el.tipo_dato,
                nature: 'continuous' as const,
                side: 'left' as const,
                offset: 0.5,
              })),
            ],
            properties: { ...baseProps },
          },
        };
      case 'functional_block':
        return {
          id: el.id,
          type: 'hilesNode',
          position: { x: 0, y: 0 },
          data: {
            hilesType: HilesElementType.FUNCTIONAL_BLOCK,
            name: el.nombre,
            ports: [
              ...el.entradas.map((ent) => ({
                id: ent.puerto,
                name: ent.variable,
                direction: 'input' as const,
                dataType: 'real' as const,
                nature: 'continuous' as const,
                side: 'left' as const,
                offset: 0.5,
              })),
              ...el.salidas.map((id) => ({
                id,
                name: id,
                direction: 'output' as const,
                dataType: 'boolean' as const,
                nature: 'continuous' as const,
                side: 'right' as const,
                offset: 0.5,
              })),
            ],
            properties: {
              ...baseProps,
              enabled: el.habilitado,
              expression: astAExpresionTexto(el.expresion),
              code: '',
            },
          },
        };
      case 'place':
        return {
          id: el.id,
          type: 'hilesNode',
          position: { x: 0, y: 0 },
          data: {
            hilesType: HilesElementType.PLACE,
            name: el.nombre,
            ports: [],
            properties: {
              ...baseProps,
              tokens: el.tokens,
              maxTokens: el.capacidad,
            },
          },
        };
      case 'transition':
        return {
          id: el.id,
          type: 'hilesNode',
          position: { x: 0, y: 0 },
          data: {
            hilesType: HilesElementType.TRANSITION,
            name: el.nombre,
            ports: [
              {
                id: 'transition-condition-in',
                name: 'Condición',
                direction: 'input' as const,
                dataType: 'boolean' as const,
                nature: 'control' as const,
                side: 'left' as const,
                offset: 0.5,
              },
              ...(el.puerto_accion
                ? [{
                    id: el.puerto_accion,
                    name: 'Acción',
                    direction: 'output' as const,
                    dataType: 'boolean' as const,
                    nature: 'control' as const,
                    side: 'right' as const,
                    offset: 0.5,
                  }]
                : []),
            ],
            properties: {
              ...baseProps,
              enabled: el.habilitada,
            },
          },
        };
    }
  });

  const edges: Edge<HilesEdgeData>[] = ir.conexiones.map((conn) => {
    if (conn.tipo === 'arco') {
      return {
        id: conn.id,
        source: conn.origen,
        target: conn.destino,
        sourceHandle: 'petri-out',
        targetHandle: 'petri-in',
        data: {
          hilesConnectionType: HilesConnectionType.PETRI,
          routing: 'straight',
          dataType: 'boolean',
          delay: 0,
          weight: conn.peso,
        },
      };
    }
    return {
      id: conn.id,
      source: conn.origen,
      target: conn.destino,
      sourceHandle: conn.puerto_origen,
      targetHandle: conn.puerto_destino === IR_PUERTO_CONDICION ? 'transition-condition-in' : conn.puerto_destino,
      data: {
        hilesConnectionType: HilesConnectionType.CONTINUOUS,
        routing: 'straight',
        dataType: 'real',
        delay: 0,
        weight: 1,
        propagationMode: 'push',
      },
    };
  });

  return { nodes, edges };
};

describe('Compilador y evaluador de expresiones IR v1', () => {
  it('compila comparaciones simples, igualdad estricta y porcentaje legacy', () => {
    expect(compilarExpresion('carros >= 6')).toEqual({
      ok: true,
      expresion: { op: '>=', args: [{ var: 'carros' }, { lit: 6 }] },
      variables: ['carros'],
    });
    expect(compilarExpresion('carros === 0')).toEqual({
      ok: true,
      expresion: { op: '==', args: [{ var: 'carros' }, { lit: 0 }] },
      variables: ['carros'],
    });
    expect(compilarExpresion('humedad < 76%')).toEqual({
      ok: true,
      expresion: { op: '<', args: [{ var: 'humedad' }, { lit: 76 }] },
      variables: ['humedad'],
    });
  });

  it('compila expresiones aritméticas y lógicas compuestas en un AST', () => {
    const logica = compilarExpresion('a && !b || c == "verde"');
    expect(logica.ok).toBe(true);
    if (logica.ok) {
      expect(logica.variables).toEqual(['a', 'b', 'c']);
      expect(evaluarExpresionIr(logica.expresion, { a: true, b: false, c: 'rojo' })).toBe(true);
      expect(evaluarExpresionIr(logica.expresion, { a: false, b: false, c: 'verde' })).toBe(true);
      expect(evaluarExpresionIr(logica.expresion, { a: true, b: true, c: 'rojo' })).toBe(false);
    }

    const aritmetica = compilarExpresion('x + 1 < 10');
    expect(aritmetica.ok).toBe(true);
    if (aritmetica.ok) {
      expect(evaluarExpresionIr(aritmetica.expresion, { x: 8 })).toBe(true);
      expect(evaluarExpresionIr(aritmetica.expresion, { x: 9 })).toBe(false);
      expect(evaluarExpresionIr(aritmetica.expresion, {})).toBe(false);
    }
  });

  it('detecta código imperativo JS/Python y rechaza sintaxis fuera de la gramática', () => {
    expect(esCodigoImperativo('if (carros > 6) return true;')).toBe(true);
    expect(esCodigoImperativo('def calcular(x): return x + 1')).toBe(true);
    expect(esCodigoImperativo('carros >= 6')).toBe(false);
    expect(compilarExpresion('a < b < c').ok).toBe(false);
    expect(compilarExpresion('calcular(carros)').ok).toBe(false);
  });
});

describe('Compilador HilesModelDocument → IR v1', () => {
  it('compila demo-4-semaforos-inteligentes.json aplanando los bloques estructurales sin errores', () => {
    const documento = cargarDocumento('demo-4-semaforos-inteligentes.json');
    const resultado = compilarDocumentoAIr(documento);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // 1 Service + 12 Places + 5 Transitions = 18 elementos ejecutables.
    expect(resultado.ir.elementos).toHaveLength(18);
    // 5 condiciones de datos + 40 arcos Petri = 45 conexiones.
    expect(resultado.ir.conexiones).toHaveLength(45);
    expect(resultado.ir.elementos.some((el) => el.id === 'norte-block')).toBe(false);
    expect(resultado.ir.conexiones.filter((c) => c.tipo === 'dato' && c.destino.startsWith('fase-'))
      .every((c) => c.tipo === 'dato' && c.puerto_destino === IR_PUERTO_CONDICION)).toBe(true);
  });

  it('compila también demo-2-humedad-token.json y circuito-presentacion-demo.json', () => {
    for (const archivo of ['demo-2-humedad-token.json', 'circuito-presentacion-demo.json']) {
      const documento = cargarDocumento(archivo);
      const resultado = compilarDocumentoAIr(documento);
      expect(resultado.ok, archivo).toBe(true);
    }
  });

  it('emite un aviso informativo cuando un Functional Block contiene código JS o Python', () => {
    const documento = cargarDocumento('demo-2-humedad-token.json');
    const fb = documento.allElements.find((el) => el.type === HilesElementType.FUNCTIONAL_BLOCK)!;
    fb.properties.code = 'return humedad < 76;';
    fb.properties.codeLanguage = 'javascript';

    const resultado = compilarDocumentoAIr(documento);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.avisos[0].codigo).toBe(CodigoIr.CODIGO_NO_SOPORTADO);
    expect(resultado.avisos[0].mensaje).toContain('Aviso:');
    expect(resultado.avisos[0].mensaje).toContain('simularlo en modo local');
  });

  it('emite un aviso cuando el documento contiene elementos Sample o Hold', () => {
    const documento = cargarDocumento('demo-parqueadero-converters.json');
    const resultado = compilarDocumentoAIr(documento);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.avisos.some((aviso) => aviso.codigo === CodigoIr.TIPO_NO_SOPORTADO)).toBe(true);
  });

  it('rechaza documentos que superan el máximo de 64 elementos en la IR v1', () => {
    const documento = cargarDocumento('circuito-presentacion-demo.json');
    for (let i = 0; i < IR_MAX_ELEMENTOS + 1; i += 1) {
      documento.allElements.push({
        ...documento.allElements[0],
        id: `extra-${i}`,
        name: `Extra ${i}`,
      });
    }
    const resultado = compilarDocumentoAIr(documento);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.avisos.some((a) => a.codigo === CodigoIr.LIMITE_EXCEDIDO)).toBe(true);
    }
  });
});

describe('Vectores compartidos docs/mqtt/vectores_ir_v1', () => {
  it('acepta todos los vectores de la carpeta validos/', () => {
    const archivos = readdirSync(resolve(RUTA_VECTORES, 'validos')).filter((f) => f.endsWith('.json'));
    expect(archivos.length).toBeGreaterThanOrEqual(3);

    for (const archivo of archivos) {
      const contenido: unknown = JSON.parse(readFileSync(resolve(RUTA_VECTORES, 'validos', archivo), 'utf8'));
      const resultado = validarIrV1(contenido);
      expect(resultado.valido, archivo).toBe(true);
    }
  });

  it('rechaza cada vector de invalidos/ con el código exacto esperado', () => {
    const archivos = readdirSync(resolve(RUTA_VECTORES, 'invalidos')).filter((f) => f.endsWith('.json'));
    expect(archivos.length).toBeGreaterThanOrEqual(8);

    for (const archivo of archivos) {
      const caso = JSON.parse(readFileSync(resolve(RUTA_VECTORES, 'invalidos', archivo), 'utf8')) as IrVectorInvalido;
      const resultado = validarIrV1(caso.modelo);
      expect(resultado.valido, `${archivo}: ${caso.descripcion}`).toBe(false);
      if (!resultado.valido) {
        expect(resultado.avisos[0].codigo, archivo).toBe(caso.codigo_esperado);
      }
    }
  });

  it('reproduce paso a paso todos los vectores de ejecucion/ con MotorSimulacion', async () => {
    const archivos = readdirSync(resolve(RUTA_VECTORES, 'ejecucion')).filter((f) => f.endsWith('.json'));
    expect(archivos.length).toBeGreaterThanOrEqual(3);

    for (const archivo of archivos) {
      const vector = JSON.parse(readFileSync(resolve(RUTA_VECTORES, 'ejecucion', archivo), 'utf8')) as IrVectorEjecucion;
      expect(validarIrV1(vector.modelo).valido, archivo).toBe(true);

      const { nodes, edges } = irAGrafoMotor(vector.modelo);
      const motor = new MotorSimulacion();
      motor.construirGrafo(nodes, edges);

      expect(extraerElementosEstadoIr(vector.modelo, motor), `${archivo} (estado inicial)`).toEqual(vector.estado_inicial);

      for (const [indice, paso] of vector.pasos.entries()) {
        Object.entries(paso.entradas ?? {}).forEach(([servicioId, valor]) => {
          expect(motor.inyectarEntrada(servicioId, valor).exito, `${archivo} paso ${indice + 1}: ${servicioId}`).toBe(true);
        });
        await motor.paso();
        expect(
          extraerElementosEstadoIr(vector.modelo, motor),
          `${archivo} paso ${indice + 1}`,
        ).toEqual(paso.elementos_esperados);
      }
    }
  });

  it('verifica que la compilación de demo-4-semaforos-inteligentes produce el mismo estado inicial que el motor web', () => {
    const documento = cargarDocumento('demo-4-semaforos-inteligentes.json');
    const compilado = compilarDocumentoAIr(documento);
    expect(compilado.ok).toBe(true);
    if (!compilado.ok) return;

    const { nodes, edges } = documentoAGrafoMotor(documento);
    const motor = new MotorSimulacion();
    motor.construirGrafo(nodes, edges);

    const instantanea = extraerElementosEstadoIr(compilado.ir, motor);
    expect(instantanea['norte-rojo']).toEqual({ tokens: 1 });
    expect(instantanea['norte-verde']).toEqual({ tokens: 0 });
    expect(instantanea['fase-ns-verde']).toEqual({ habilitada: false, disparada: false });
  });

  it('mantiene la exclusión mutua del cruce coordinado durante varios ciclos', async () => {
    const documento = cargarDocumento('demo-4-semaforos-inteligentes.json');
    const compilado = compilarDocumentoAIr(documento);
    expect(compilado.ok).toBe(true);
    if (!compilado.ok) return;

    const { nodes, edges } = documentoAGrafoMotor(documento);
    const motor = new MotorSimulacion();
    motor.construirGrafo(nodes, edges);
    expect(motor.inyectarEntrada('ciclo-habilitado', true).exito).toBe(true);

    for (let paso = 0; paso < 15; paso += 1) {
      await motor.paso();
      const estado = extraerElementosEstadoIr(compilado.ir, motor);
      const token = (direccion: string, color: string) => estado[`${direccion}-${color}`]?.tokens ?? 0;
      const norteSurVerde = token('norte', 'verde') === 1 || token('sur', 'verde') === 1;
      const esteOesteVerde = token('este', 'verde') === 1 || token('oeste', 'verde') === 1;

      expect(token('norte', 'verde'), `paso ${paso + 1}`).toBe(token('sur', 'verde'));
      expect(token('este', 'verde'), `paso ${paso + 1}`).toBe(token('oeste', 'verde'));
      expect(norteSurVerde && esteOesteVerde, `paso ${paso + 1}`).toBe(false);
      for (const direccion of ['norte', 'sur', 'este', 'oeste']) {
        expect(['rojo', 'amarillo', 'verde'].reduce((total, color) => total + token(direccion, color), 0)).toBe(1);
      }
    }
  });
});
