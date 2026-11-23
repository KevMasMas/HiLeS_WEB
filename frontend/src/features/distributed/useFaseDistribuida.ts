import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import type { DescripcionFase } from './assignments';
import { crearControlEjecucionDistribuida, type ControlEjecucionDistribuida } from './executionControl';

/** Estado y permisos oficiales consumidos por todos los controles globales. */
export const useControlEjecucionDistribuida = (): ControlEjecucionDistribuida => {
  const conectado = useDistributedExecutionStore((state) => state.conectado);
  const manifest = useDistributedExecutionStore((state) => state.manifest);
  const acks = useDistributedExecutionStore((state) => state.acks);
  const ejecutores = useDistributedExecutionStore((state) => state.ejecutores);
  const desplegando = useDistributedExecutionStore((state) => state.desplegando);
  const ejecutando = useDistributedExecutionStore((state) => state.ejecutando);
  const errorLocal = useDistributedExecutionStore((state) => state.errorLocal);
  return crearControlEjecucionDistribuida({
    conectado,
    manifest,
    acks,
    ejecutores,
    desplegando,
    ejecutando,
    errorLocal,
  });
};

/** Fase agregada visible en la barra superior y en el panel. */
export const useFaseDistribuida = (): DescripcionFase => useControlEjecucionDistribuida().fase;
