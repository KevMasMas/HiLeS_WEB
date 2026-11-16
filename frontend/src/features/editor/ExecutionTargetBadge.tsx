import { useEditorStore } from '../../stores/useEditorStore';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { destinoEfectivo, etiquetaEjecutor } from '../distributed/assignments';
import { HilesElementType } from '../../types/hiles';

/** La asignación elegida no implica que el fragmento ya esté ejecutándose. */
export function ExecutionTargetBadge({ nodeId }: { nodeId: string }) {
  const nodes = useEditorStore((state) => state.nodes);
  const manifest = useDistributedExecutionStore((state) => state.manifest);
  const acks = useDistributedExecutionStore((state) => state.acks);
  const ejecutores = useDistributedExecutionStore((state) => state.ejecutores);
  const conectado = useDistributedExecutionStore((state) => state.conectado);
  const ejecutando = useDistributedExecutionStore((state) => state.ejecutando);
  const executorLocal = useDistributedExecutionStore((state) => state.workerExecutorId);
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return null;
  const executorId = node.data.properties.deploymentTarget
    || destinoEfectivo(node, new Map(nodes.map((item) => [item.id, item]))).executorId;
  const target = etiquetaEjecutor(executorId ?? null, executorLocal);
  let status = 'Pendiente de despliegue';
  if (!executorId) status = 'Elige un ejecutor';
  else if (!conectado || !ejecutores[executorId] || ejecutores[executorId].estado === 'offline') status = 'Sin conexión';
  else if (ejecutores[executorId].estado === 'degraded') status = 'Degradado';
  else {
    const fragment = manifest?.fragments.find((item) => item.executor_id === executorId);
    const ack = acks[executorId];
    const belongsToBlock = (id: string): boolean => {
      const visited = new Set<string>();
      let current = nodes.find((item) => item.id === id);
      while (current && !visited.has(current.id)) {
        if (current.id === nodeId) return true;
        visited.add(current.id);
        current = nodes.find((item) => item.id === current?.parentId);
      }
      return false;
    };
    const deployedHere = node.data.hilesType === HilesElementType.STRUCTURAL_BLOCK
      ? Object.entries(manifest?.owners ?? {}).some(([id, owner]) => owner === executorId && belongsToBlock(id))
      : manifest?.owners[nodeId] === executorId;
    // Un ACK de otra época no confirma el despliegue actual.
    if (deployedHere && fragment && ack?.epoch === manifest?.epoch) {
      status = ack.accepted ? (ejecutando ? 'Ejecutando' : 'Listo') : 'Despliegue rechazado';
    }
  }
  return (
    <span className={`hiles-execution-target${node.parentId && node.data.hilesType !== HilesElementType.STRUCTURAL_BLOCK ? ' hiles-execution-target--internal' : ''}`} title={`Destino: ${target}. ${status}`} aria-label={`Destino: ${target}. ${status}`}>
      <span>{target}</span><small>{status}</small>
    </span>
  );
}
