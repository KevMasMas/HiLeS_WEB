export type DockPanel = 'properties' | 'simulation' | 'mqtt' | null;

/** Transición pura para apertura, cambio de pestaña y cierre del dock. */
export const getNextDockPanel = (current: DockPanel, requested: Exclude<DockPanel, null>): DockPanel => (
  current === requested ? null : requested
);

export interface ExecutionAvailabilityInput {
  modo: 'local' | 'pico';
  ocupado: boolean;
  estadoLocal: string;
  sesionRemotaActiva: boolean;
}

export interface ExecutionAvailability {
  stepDisabled: boolean;
  runDisabled: boolean;
  resetDisabled: boolean;
  stopVisible: boolean;
  stopDisabled: boolean;
}

/** Estado puro usado por la TopBar y por las pruebas de regresión. */
export const getExecutionAvailability = (input: ExecutionAvailabilityInput): ExecutionAvailability => {
  const localUnavailable = input.estadoLocal === 'error' || input.estadoLocal === 'inactiva';
  const remoteUnavailable = !input.sesionRemotaActiva;
  const disabled = input.ocupado || (input.modo === 'pico' ? remoteUnavailable : localUnavailable);
  return {
    stepDisabled: disabled,
    runDisabled: disabled,
    resetDisabled: input.ocupado || (input.modo === 'pico' && remoteUnavailable),
    stopVisible: input.modo === 'pico',
    stopDisabled: remoteUnavailable,
  };
};
