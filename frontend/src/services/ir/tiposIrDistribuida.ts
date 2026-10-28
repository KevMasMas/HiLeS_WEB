import type { HilesModelDocument } from '../../domain/modelDocument';
import type {
  IrConexionCanalV2,
  IrModeloV2,
  IrTipoDatoV2,
  IrValorRuntimeV2,
} from './tiposIrV2';

export const PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION = 3 as const;

export type TipoEjecutorV3 = 'pico' | 'browser';
export type EstadoEjecutorV3 =
  | 'online'
  | 'deploying'
  | 'ready'
  | 'running'
  | 'degraded'
  | 'offline';

export interface CapacidadesEjecutorV3 {
  ir_versions: number[];
  lenguajes: Array<'python' | 'expresion'>;
  max_fragment_bytes: number;
  max_elementos: number;
  memoria_libre_bytes?: number;
}

export interface EjecutorDisponibleV3 {
  executor_id: string;
  tipo: TipoEjecutorV3;
  estado: EstadoEjecutorV3;
  capacidades: CapacidadesEjecutorV3;
}

/**
 * Structural Blocks heredan su destino a todos sus descendientes. Un Functional
 * Block puede sobreescribirlo y los elementos de nivel raíz requieren una
 * asignación directa explícita.
 */
export interface PlanAsignacionDespliegueV3 {
  structural_blocks: Record<string, string>;
  functional_blocks?: Record<string, string>;
  elementos?: Record<string, string>;
}

export interface AsignacionElementoV3 {
  elemento_id: string;
  executor_id: string;
  heredado_de?: string;
  origen: 'structural_block' | 'functional_block' | 'directo';
}

export interface RutaRemotaV3 {
  connection_id: string;
  tipo: IrConexionCanalV2['tipo'];
  tipo_dato: IrTipoDatoV2;
  source_element_id: string;
  source_port_id: string;
  source_executor_id: string;
  target_element_id: string;
  target_port_id: string;
  target_executor_id: string;
  topic: string;
  qos: 1;
  retain: false;
}

export interface FragmentoDespliegueV3 {
  protocol_version: typeof PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION;
  project_id: string;
  deployment_id: string;
  epoch: number;
  fragment_id: string;
  executor_id: string;
  owner_executor_id: string;
  modelo: IrModeloV2;
  inbound_routes: RutaRemotaV3[];
  outbound_routes: RutaRemotaV3[];
}

export interface ResumenFragmentoV3 {
  fragment_id: string;
  executor_id: string;
  hash: string;
  size_bytes: number;
  element_ids: string[];
}

export interface ManifiestoDespliegueV3 {
  protocol_version: typeof PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION;
  project_id: string;
  deployment_id: string;
  epoch: number;
  model_id: string;
  model_version: number;
  owners: Record<string, string>;
  fragments: ResumenFragmentoV3[];
  routes: RutaRemotaV3[];
}

export type CodigoErrorDistribucionV3 =
  | 'DISTRIBUCION_IDENTIFICADOR_INVALIDO'
  | 'DISTRIBUCION_MODELO_INVALIDO'
  | 'DISTRIBUCION_DESTINO_FALTANTE'
  | 'DISTRIBUCION_DESTINO_INEXISTENTE'
  | 'DISTRIBUCION_CAPACIDAD_EXCEDIDA'
  | 'DISTRIBUCION_ARCO_REMOTO'
  | 'DISTRIBUCION_TIPO_NO_RESUELTO'
  | 'DISTRIBUCION_ASIGNACION_INVALIDA';

export interface ErrorDistribucionV3 {
  codigo: CodigoErrorDistribucionV3;
  mensaje: string;
  elemento_id?: string;
  conexion_id?: string;
  executor_id?: string;
}

export interface EntradaParticionadorV3 {
  project_id: string;
  deployment_id: string;
  epoch: number;
  modelo: IrModeloV2;
  ejecutores: EjecutorDisponibleV3[];
  asignaciones: AsignacionElementoV3[];
}

export type ResultadoParticionadoV3 =
  | {
      ok: true;
      manifest: ManifiestoDespliegueV3;
      fragments: FragmentoDespliegueV3[];
      errors: [];
    }
  | {
      ok: false;
      manifest: null;
      fragments: [];
      errors: ErrorDistribucionV3[];
    };

export interface EntradaResolverAsignacionesV3 {
  documento: HilesModelDocument;
  modelo: IrModeloV2;
  plan: PlanAsignacionDespliegueV3;
}

export interface MensajeCanalDistribuidoV3 {
  protocol_version: typeof PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION;
  project_id: string;
  deployment_id: string;
  epoch: number;
  message_id: string;
  connection_id: string;
  owner_executor_id: string;
  sequence: number;
  value: IrValorRuntimeV2;
}
