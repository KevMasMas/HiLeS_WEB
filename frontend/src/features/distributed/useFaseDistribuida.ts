import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { describirFase, type DescripcionFase } from './assignments';

/** Fase agregada visible en la barra superior y en el panel. */
export const useFaseDistribuida = (): DescripcionFase => {
  const conectado = useDistributedExecutionStore((state) => state.conectado);
  const manifest = useDistributedExecutionStore((state) => state.manifest);
  const acks = useDistributedExecutionStore((state) => state.acks);
  const ejecutores = useDistributedExecutionStore((state) => state.ejecutores);
  const errorLocal = useDistributedExecutionStore((state) => state.errorLocal);
  const ejecutando = Boolean(manifest?.fragments.length)
    && manifest!.fragments.every((fragmento) => ejecutores[fragmento.executor_id]?.estado === 'running');
  return describirFase({ conectado, manifest, acks, ejecutores, ejecutando, errorLocal });
};
