const SEGMENTO_PROHIBIDO = /[/#+]/;

export function validarSegmentoTopicV3(valor: string, nombre: string): string {
  const limpio = valor.trim();
  if (!limpio || limpio.includes(String.fromCharCode(0)) || SEGMENTO_PROHIBIDO.test(limpio)) {
    throw new Error(
      `${nombre} debe ser un segmento MQTT no vacío y no puede contener /, +, # o NUL.`,
    );
  }
  return limpio;
}

export function baseProyectoV3(projectId: string): string {
  return `udfjc/hiles/v3/projects/${validarSegmentoTopicV3(projectId, 'projectId')}`;
}

export const topicsDistribuidosV3 = {
  executorStatus(projectId: string, executorId: string): string {
    return `${baseProyectoV3(projectId)}/executors/${validarSegmentoTopicV3(executorId, 'executorId')}/status`;
  },
  executorStatusFilter(projectId: string): string {
    return `${baseProyectoV3(projectId)}/executors/+/status`;
  },
  manifest(projectId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/manifest`;
  },
  fragment(projectId: string, deploymentId: string, executorId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/${validarSegmentoTopicV3(deploymentId, 'deploymentId')}/fragments/${validarSegmentoTopicV3(executorId, 'executorId')}`;
  },
  ack(projectId: string, deploymentId: string, executorId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/${validarSegmentoTopicV3(deploymentId, 'deploymentId')}/ack/${validarSegmentoTopicV3(executorId, 'executorId')}`;
  },
  channel(projectId: string, deploymentId: string, connectionId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/${validarSegmentoTopicV3(deploymentId, 'deploymentId')}/channels/${validarSegmentoTopicV3(connectionId, 'connectionId')}`;
  },
  snapshot(projectId: string, deploymentId: string, executorId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/${validarSegmentoTopicV3(deploymentId, 'deploymentId')}/snapshot/${validarSegmentoTopicV3(executorId, 'executorId')}`;
  },
  error(projectId: string, deploymentId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/${validarSegmentoTopicV3(deploymentId, 'deploymentId')}/error`;
  },
  command(projectId: string, deploymentId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/${validarSegmentoTopicV3(deploymentId, 'deploymentId')}/command`;
  },
  input(projectId: string, deploymentId: string): string {
    return `${baseProyectoV3(projectId)}/deployments/${validarSegmentoTopicV3(deploymentId, 'deploymentId')}/input`;
  },
};
