import { HilesElementType } from '../../types/hiles';
import { topicsDistribuidosV3, validarSegmentoTopicV3 } from '../distributed/topics';
import {
  PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
  type AsignacionElementoV3,
  type EntradaParticionadorV3,
  type EntradaResolverAsignacionesV3,
  type ErrorDistribucionV3,
  type FragmentoDespliegueV3,
  type ManifiestoDespliegueV3,
  type ResultadoParticionadoV3,
  type RutaRemotaV3,
} from './tiposIrDistribuida';
import type {
  IrConexionCanalV2,
  IrElementoV2,
  IrModeloV2,
  IrTipoDatoV2,
} from './tiposIrV2';
import { validarModeloIrV2 } from './validadorIrV2';

const encoder = new TextEncoder();

function porId<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id);
}

export function serializarCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) return `[${valor.map(serializarCanonico).join(',')}]`;
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto)
    .filter((clave) => objeto[clave] !== undefined)
    .sort()
    .map((clave) => `${JSON.stringify(clave)}:${serializarCanonico(objeto[clave])}`)
    .join(',')}}`;
}

export async function sha256(valor: unknown): Promise<string> {
  const bytes = encoder.encode(serializarCanonico(valor));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function error(
  codigo: ErrorDistribucionV3['codigo'],
  mensaje: string,
  detalle: Partial<Omit<ErrorDistribucionV3, 'codigo' | 'mensaje'>> = {},
): ErrorDistribucionV3 {
  return { codigo, mensaje, ...detalle };
}

function resolverTipoPuerto(
  elemento: IrElementoV2,
  puerto: string,
  sentido: 'entrada' | 'salida',
): IrTipoDatoV2 | null {
  switch (elemento.tipo) {
    case 'service':
      return elemento.tipo_dato;
    case 'functional_block': {
      const firma = sentido === 'entrada' ? elemento.entradas : elemento.salidas;
      return firma.find((item) => item.puerto === puerto)?.tipo_dato ?? null;
    }
    case 'sample':
      if (puerto === elemento.puerto_control) return 'boolean';
      if (puerto === elemento.puerto_dato || puerto === elemento.puerto_salida) {
        return elemento.tipo_dato;
      }
      return null;
    case 'hold':
      if (puerto === elemento.puerto_lch) return 'boolean';
      if (puerto === elemento.puerto_entrada || puerto === elemento.puerto_cch) {
        return elemento.tipo_dato;
      }
      return null;
    case 'transition':
      if (puerto === elemento.puerto_condicion || puerto === elemento.puerto_accion) {
        return 'boolean';
      }
      return null;
    case 'place':
      return null;
  }
}

function fragmentId(deploymentId: string, executorId: string): string {
  return `${deploymentId}:${executorId}`;
}

/**
 * Resuelve la herencia antes de aplanar los Structural Blocks. La sobreescritura
 * de un Functional Block tiene precedencia sobre la asignación directa y la del
 * Structural Block ancestro más cercano.
 */
export function resolverAsignacionesDistribuidasV3({
  documento,
  modelo,
  plan,
}: EntradaResolverAsignacionesV3): {
  asignaciones: AsignacionElementoV3[];
  errores: ErrorDistribucionV3[];
} {
  const errores: ErrorDistribucionV3[] = [];
  const elementosDocumento = new Map(documento.allElements.map((item) => [item.id, item]));
  const ejecutables = new Set(modelo.elementos.map((item) => item.id));
  const asignaciones: AsignacionElementoV3[] = [];

  const buscarBloqueAncestroAsignado = (elementoId: string): string | null => {
    const visitados = new Set<string>();
    let actual = elementosDocumento.get(elementoId);
    while (actual?.parentId) {
      if (visitados.has(actual.parentId)) return null;
      visitados.add(actual.parentId);
      const padre = elementosDocumento.get(actual.parentId);
      if (!padre) return null;
      if (
        padre.type === HilesElementType.STRUCTURAL_BLOCK &&
        plan.structural_blocks[padre.id]
      ) {
        return padre.id;
      }
      actual = padre;
    }
    return null;
  };

  for (const elemento of [...modelo.elementos].sort(porId)) {
    const original = elementosDocumento.get(elemento.id);
    if (!original) {
      errores.push(
        error(
          'DISTRIBUCION_ASIGNACION_INVALIDA',
          `El elemento ejecutable ${elemento.id} no existe en el documento fuente.`,
          { elemento_id: elemento.id },
        ),
      );
      continue;
    }

    const overrideFb =
      original.type === HilesElementType.FUNCTIONAL_BLOCK
        ? plan.functional_blocks?.[elemento.id]
        : undefined;
    const directo = plan.elementos?.[elemento.id];
    const bloque = buscarBloqueAncestroAsignado(elemento.id);
    const heredado = bloque ? plan.structural_blocks[bloque] : undefined;
    const executorId = overrideFb ?? directo ?? heredado;

    if (!executorId) {
      errores.push(
        error(
          'DISTRIBUCION_DESTINO_FALTANTE',
          `El elemento ${elemento.id} no tiene un ejecutor asignado.`,
          { elemento_id: elemento.id },
        ),
      );
      continue;
    }

    asignaciones.push({
      elemento_id: elemento.id,
      executor_id: executorId,
      origen: overrideFb
        ? 'functional_block'
        : directo
          ? 'directo'
          : 'structural_block',
      ...(overrideFb || directo || !bloque ? {} : { heredado_de: bloque }),
    });
  }

  for (const id of Object.keys(plan.functional_blocks ?? {})) {
    const elemento = elementosDocumento.get(id);
    if (!elemento || elemento.type !== HilesElementType.FUNCTIONAL_BLOCK || !ejecutables.has(id)) {
      errores.push(
        error(
          'DISTRIBUCION_ASIGNACION_INVALIDA',
          `La sobreescritura ${id} no corresponde a un Functional Block ejecutable.`,
          { elemento_id: id },
        ),
      );
    }
  }

  for (const id of Object.keys(plan.structural_blocks)) {
    const elemento = elementosDocumento.get(id);
    if (!elemento || elemento.type !== HilesElementType.STRUCTURAL_BLOCK) {
      errores.push(
        error(
          'DISTRIBUCION_ASIGNACION_INVALIDA',
          `La asignación ${id} no corresponde a un Structural Block del documento.`,
          { elemento_id: id },
        ),
      );
    }
  }

  for (const id of Object.keys(plan.elementos ?? {})) {
    if (!ejecutables.has(id)) {
      errores.push(
        error(
          'DISTRIBUCION_ASIGNACION_INVALIDA',
          `La asignación directa ${id} no corresponde a un elemento ejecutable.`,
          { elemento_id: id },
        ),
      );
    }
  }

  return { asignaciones, errores };
}

function crearModeloFragmento(
  modelo: IrModeloV2,
  executorId: string,
  elementos: IrElementoV2[],
  conexionesLocales: IrModeloV2['conexiones'],
): IrModeloV2 {
  const ids = new Set(elementos.map((item) => item.id));
  return {
    ...modelo,
    nombre: `${modelo.nombre} — ${executorId}`,
    entradas_externas: modelo.entradas_externas
      .filter((entrada) => ids.has(entrada.elemento_id))
      .sort((a, b) => a.elemento_id.localeCompare(b.elemento_id)),
    elementos: [...elementos].sort(porId),
    conexiones: [...conexionesLocales].sort(porId),
  };
}

/**
 * Particionador puro salvo por el cálculo SHA-256 asíncrono. No consulta stores,
 * red, reloj ni broker: la misma entrada produce el mismo manifiesto.
 */
export async function particionarIrV2Distribuida(
  entrada: EntradaParticionadorV3,
): Promise<ResultadoParticionadoV3> {
  const errores: ErrorDistribucionV3[] = [];
  const { project_id: projectId, deployment_id: deploymentId, epoch, modelo } = entrada;

  try {
    validarSegmentoTopicV3(projectId, 'projectId');
    validarSegmentoTopicV3(deploymentId, 'deploymentId');
  } catch (cause) {
    errores.push(
      error(
        'DISTRIBUCION_IDENTIFICADOR_INVALIDO',
        cause instanceof Error ? cause.message : 'Identificador MQTT inválido.',
      ),
    );
  }
  if (!Number.isSafeInteger(epoch) || epoch < 1) {
    errores.push(
      error('DISTRIBUCION_IDENTIFICADOR_INVALIDO', 'epoch debe ser un entero mayor o igual a 1.'),
    );
  }

  const validacion = validarModeloIrV2(modelo);
  if (!validacion.ok) {
    errores.push(
      error(
        'DISTRIBUCION_MODELO_INVALIDO',
        `La IR v2 no es válida: ${validacion.errores[0]?.mensaje ?? 'error desconocido'}`,
      ),
    );
  }

  const ejecutores = new Map<string, (typeof entrada.ejecutores)[number]>();
  for (const executor of entrada.ejecutores) {
    try {
      validarSegmentoTopicV3(executor.executor_id, 'executorId');
    } catch (cause) {
      errores.push(
        error(
          'DISTRIBUCION_IDENTIFICADOR_INVALIDO',
          cause instanceof Error ? cause.message : 'executorId inválido.',
          { executor_id: executor.executor_id },
        ),
      );
      continue;
    }
    if (ejecutores.has(executor.executor_id)) {
      errores.push(
        error(
          'DISTRIBUCION_ASIGNACION_INVALIDA',
          `El ejecutor ${executor.executor_id} está registrado más de una vez.`,
          { executor_id: executor.executor_id },
        ),
      );
    }
    ejecutores.set(executor.executor_id, executor);
  }

  const owners = new Map<string, string>();
  for (const asignacion of entrada.asignaciones) {
    const anterior = owners.get(asignacion.elemento_id);
    if (anterior && anterior !== asignacion.executor_id) {
      errores.push(
        error(
          'DISTRIBUCION_ASIGNACION_INVALIDA',
          `El elemento ${asignacion.elemento_id} tiene más de un propietario.`,
          { elemento_id: asignacion.elemento_id },
        ),
      );
      continue;
    }
    owners.set(asignacion.elemento_id, asignacion.executor_id);
  }

  for (const elemento of modelo.elementos) {
    const executorId = owners.get(elemento.id);
    if (!executorId) {
      errores.push(
        error(
          'DISTRIBUCION_DESTINO_FALTANTE',
          `El elemento ${elemento.id} no tiene un ejecutor asignado.`,
          { elemento_id: elemento.id },
        ),
      );
    } else if (!ejecutores.has(executorId) || ejecutores.get(executorId)?.estado === 'offline') {
      errores.push(
        error(
          'DISTRIBUCION_DESTINO_INEXISTENTE',
          `El destino ${executorId} del elemento ${elemento.id} no está disponible.`,
          { elemento_id: elemento.id, executor_id: executorId },
        ),
      );
    }
  }

  const mapaElementos = new Map(modelo.elementos.map((item) => [item.id, item]));
  const rutas: RutaRemotaV3[] = [];
  const conexionesLocalesPorEjecutor = new Map<string, IrModeloV2['conexiones']>();

  for (const conexion of [...modelo.conexiones].sort(porId)) {
    const sourceExecutor = owners.get(conexion.origen);
    const targetExecutor = owners.get(conexion.destino);
    if (!sourceExecutor || !targetExecutor) continue;
    if (sourceExecutor === targetExecutor) {
      const locales = conexionesLocalesPorEjecutor.get(sourceExecutor) ?? [];
      locales.push(conexion);
      conexionesLocalesPorEjecutor.set(sourceExecutor, locales);
      continue;
    }
    if (conexion.tipo === 'arco') {
      errores.push(
        error(
          'DISTRIBUCION_ARCO_REMOTO',
          `La conexión Petri ${conexion.id} cruza ejecutores; Places y Transitions conectados deben permanecer juntos en P0.`,
          { conexion_id: conexion.id },
        ),
      );
      continue;
    }
    const origen = mapaElementos.get(conexion.origen);
    const destino = mapaElementos.get(conexion.destino);
    const tipoOrigen = origen
      ? resolverTipoPuerto(origen, conexion.puerto_origen, 'salida')
      : null;
    const tipoDestino = destino
      ? resolverTipoPuerto(destino, conexion.puerto_destino, 'entrada')
      : null;
    if (!tipoOrigen || !tipoDestino || tipoOrigen !== tipoDestino) {
      errores.push(
        error(
          'DISTRIBUCION_TIPO_NO_RESUELTO',
          `No se pudo verificar un tipo compatible para la conexión remota ${conexion.id}.`,
          { conexion_id: conexion.id },
        ),
      );
      continue;
    }
    const canal = conexion as IrConexionCanalV2;
    const ruta: RutaRemotaV3 = {
      connection_id: canal.id,
      tipo: canal.tipo,
      tipo_dato: tipoOrigen,
      source_element_id: canal.origen,
      source_port_id: canal.puerto_origen,
      source_executor_id: sourceExecutor,
      target_element_id: canal.destino,
      target_port_id: canal.puerto_destino,
      target_executor_id: targetExecutor,
      topic: topicsDistribuidosV3.channel(projectId, deploymentId, canal.id),
      qos: 1,
      retain: false,
    };
    if (typeof canal.retardo_ms === 'number' && canal.retardo_ms > 0) {
      ruta.retardo_ms = canal.retardo_ms;
    }
    if (canal.tipo === 'dch' && typeof canal.capacidad_cola === 'number') {
      ruta.capacidad_cola = canal.capacidad_cola;
    }
    rutas.push(ruta);
  }

  if (errores.length > 0) {
    return { ok: false, manifest: null, fragments: [], errors: errores };
  }

  const elementosPorEjecutor = new Map<string, IrElementoV2[]>();
  for (const elemento of modelo.elementos) {
    const executorId = owners.get(elemento.id)!;
    const elementos = elementosPorEjecutor.get(executorId) ?? [];
    elementos.push(elemento);
    elementosPorEjecutor.set(executorId, elementos);
  }

  const fragments: FragmentoDespliegueV3[] = [];
  for (const executorId of [...elementosPorEjecutor.keys()].sort()) {
    const executor = ejecutores.get(executorId)!;
    const elementos = elementosPorEjecutor.get(executorId)!;
    const fragmento: FragmentoDespliegueV3 = {
      protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
      project_id: projectId,
      deployment_id: deploymentId,
      epoch,
      fragment_id: fragmentId(deploymentId, executorId),
      executor_id: executorId,
      owner_executor_id: executorId,
      modelo: crearModeloFragmento(
        modelo,
        executorId,
        elementos,
        conexionesLocalesPorEjecutor.get(executorId) ?? [],
      ),
      inbound_routes: rutas.filter((ruta) => ruta.target_executor_id === executorId),
      outbound_routes: rutas.filter((ruta) => ruta.source_executor_id === executorId),
    };
    const size = encoder.encode(serializarCanonico(fragmento)).byteLength;
    const validacionFragmento = validarModeloIrV2(fragmento.modelo);
    if (!validacionFragmento.ok) {
      errores.push(
        error(
          'DISTRIBUCION_MODELO_INVALIDO',
          `El fragmento de ${executorId} no es una IR v2 válida: ${validacionFragmento.errores[0]?.mensaje ?? 'error desconocido'}`,
          { executor_id: executorId },
        ),
      );
    }
    if (elementos.length > executor.capacidades.max_elementos || size > executor.capacidades.max_fragment_bytes) {
      errores.push(
        error(
          'DISTRIBUCION_CAPACIDAD_EXCEDIDA',
          `El fragmento de ${executorId} requiere ${elementos.length} elementos y ${size} bytes; excede sus capacidades publicadas.`,
          { executor_id: executorId },
        ),
      );
    }
    if (!executor.capacidades.ir_versions.includes(2)) {
      errores.push(
        error(
          'DISTRIBUCION_CAPACIDAD_EXCEDIDA',
          `El ejecutor ${executorId} no declara soporte para IR v2.`,
          { executor_id: executorId },
        ),
      );
    }
    const lenguajeNoSoportado = elementos.find(
      (elemento) =>
        elemento.tipo === 'functional_block' &&
        !executor.capacidades.lenguajes.includes(elemento.lenguaje),
    );
    if (lenguajeNoSoportado?.tipo === 'functional_block') {
      errores.push(
        error(
          'DISTRIBUCION_CAPACIDAD_EXCEDIDA',
          `El ejecutor ${executorId} no soporta el lenguaje ${lenguajeNoSoportado.lenguaje} requerido por ${lenguajeNoSoportado.id}.`,
          { executor_id: executorId, elemento_id: lenguajeNoSoportado.id },
        ),
      );
    }
    fragments.push(fragmento);
  }

  if (errores.length > 0) {
    return { ok: false, manifest: null, fragments: [], errors: errores };
  }

  const resumenes = await Promise.all(
    fragments.map(async (fragmento) => ({
      fragment_id: fragmento.fragment_id,
      executor_id: fragmento.executor_id,
      hash: await sha256(fragmento),
      size_bytes: encoder.encode(serializarCanonico(fragmento)).byteLength,
      element_ids: fragmento.modelo.elementos.map((item) => item.id),
    })),
  );

  const manifest: ManifiestoDespliegueV3 = {
    protocol_version: PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
    project_id: projectId,
    deployment_id: deploymentId,
    epoch,
    model_id: modelo.modelo_id,
    model_version: modelo.version,
    owners: Object.fromEntries([...owners.entries()].sort(([a], [b]) => a.localeCompare(b))),
    fragments: resumenes,
    routes: rutas,
  };
  return { ok: true, manifest, fragments, errors: [] };
}
