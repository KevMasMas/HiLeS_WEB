import type {
  ComandoDespliegueV3,
  MensajeAckFragmentoV3,
  MensajeEstadoEjecutorV3,
} from '../../services/distributed/messages';
import type { ManifiestoDespliegueV3 } from '../../services/ir/tiposIrDistribuida';
import { describirFase, type DescripcionFase } from './assignments';

export interface EntradaControlEjecucionDistribuida {
  conectado: boolean;
  manifest: ManifiestoDespliegueV3 | null;
  acks: Record<string, MensajeAckFragmentoV3>;
  ejecutores: Record<string, MensajeEstadoEjecutorV3>;
  desplegando: boolean;
  ejecutando: boolean;
  errorLocal: string | null;
}

export interface ControlEjecucionDistribuida {
  fase: DescripcionFase;
  puedeIniciar: boolean;
  puedeAvanzar: boolean;
  puedeDetener: boolean;
  puedeReiniciar: boolean;
  motivoBloqueo: string | null;
}

/**
 * Fachada pura para todos los controles de ejecución. La barra superior y el
 * panel distribuido no deben volver a decidir por separado cuándo habilitar
 * Iniciar, Paso, Detener o Reiniciar.
 */
export const crearControlEjecucionDistribuida = (
  entrada: EntradaControlEjecucionDistribuida,
): ControlEjecucionDistribuida => {
  const ejecutandoPorEstado = Boolean(entrada.manifest?.fragments.length)
    && entrada.manifest!.fragments.every(
      (fragmento) => entrada.ejecutores[fragmento.executor_id]?.estado === 'running',
    );
  const fase = describirFase({
    conectado: entrada.conectado,
    manifest: entrada.manifest,
    acks: entrada.acks,
    ejecutores: entrada.ejecutores,
    ejecutando: entrada.ejecutando || ejecutandoPorEstado,
    errorLocal: entrada.errorLocal,
  });
  const listo = fase.fase === 'listo';
  const ejecutando = fase.fase === 'ejecutando';
  const ocupado = entrada.desplegando || fase.fase === 'desplegando';
  const puedeOperar = entrada.conectado && !ocupado && (listo || ejecutando);
  return {
    fase,
    puedeIniciar: puedeOperar && listo,
    puedeAvanzar: puedeOperar && listo,
    puedeDetener: puedeOperar,
    puedeReiniciar: puedeOperar,
    motivoBloqueo: puedeOperar ? null : fase.detalle,
  };
};

export const comandoPermitido = (
  control: ControlEjecucionDistribuida,
  comando: ComandoDespliegueV3,
): boolean => ({
  start: control.puedeIniciar,
  step: control.puedeAvanzar,
  stop: control.puedeDetener,
  reset: control.puedeReiniciar,
}[comando]);
