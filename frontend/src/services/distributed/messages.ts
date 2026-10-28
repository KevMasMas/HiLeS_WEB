import type {
  EjecutorDisponibleV3,
  ErrorDistribucionV3,
  FragmentoDespliegueV3,
  ManifiestoDespliegueV3,
  MensajeCanalDistribuidoV3,
} from '../ir/tiposIrDistribuida';

export interface MensajeEstadoEjecutorV3 extends EjecutorDisponibleV3 {
  protocol_version: 3;
  project_id: string;
  last_seen_ms: number;
  active_deployment_id?: string;
  active_epoch?: number;
}

export interface MensajeAckFragmentoV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  executor_id: string;
  fragment_id: string;
  accepted: boolean;
  fragment_hash: string;
  error?: ErrorDistribucionV3;
}

export interface MensajeSnapshotParcialV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  executor_id: string;
  sequence: number;
  elements: Record<string, unknown>;
}

export type ComandoDespliegueV3 = 'start' | 'stop' | 'reset';

export interface MensajeComandoDespliegueV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  command: ComandoDespliegueV3;
}

export type MensajeEjecucionDistribuidaV3 =
  | ManifiestoDespliegueV3
  | FragmentoDespliegueV3
  | MensajeCanalDistribuidoV3
  | MensajeEstadoEjecutorV3
  | MensajeAckFragmentoV3
  | MensajeSnapshotParcialV3
  | MensajeComandoDespliegueV3;
