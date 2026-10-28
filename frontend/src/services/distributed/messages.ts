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

export type ComandoDespliegueV3 = 'start' | 'stop' | 'reset' | 'step';

export interface MensajeComandoDespliegueV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  command: ComandoDespliegueV3;
  id_mensaje?: string;
}

export interface MensajeEntradaDistribuidaV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  servicio_id: string;
  valor: MensajeCanalDistribuidoV3['value'];
  id_mensaje?: string;
}

export interface MensajeErrorDistribuidoV3 {
  protocol_version: 3;
  project_id: string;
  deployment_id: string;
  epoch: number;
  executor_id: string;
  codigo: string;
  mensaje: string;
  fragment_id?: string;
  connection_id?: string;
  element_id?: string;
  stage?: 'manifest' | 'fragment' | 'channel' | 'command' | 'input' | 'runtime' | 'transport';
  id_mensaje?: string;
}

export type MensajeEjecucionDistribuidaV3 =
  | ManifiestoDespliegueV3
  | FragmentoDespliegueV3
  | MensajeCanalDistribuidoV3
  | MensajeEstadoEjecutorV3
  | MensajeAckFragmentoV3
  | MensajeSnapshotParcialV3
  | MensajeComandoDespliegueV3
  | MensajeEntradaDistribuidaV3
  | MensajeErrorDistribuidoV3;
