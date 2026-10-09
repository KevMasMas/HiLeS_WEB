import { HilesElementType, type HilesPort, type OperatorDirection } from '../types/hiles';

const OPERATOR_SIDES: Record<OperatorDirection, { wide: HilesPort['side']; tip: HilesPort['side'] }> = {
  right: { wide: 'left', tip: 'right' },
  left: { wide: 'right', tip: 'left' },
  up: { wide: 'bottom', tip: 'top' },
  down: { wide: 'top', tip: 'bottom' },
};

/** Posiciona los puertos sin cambiar sus identificadores ni romper sus aristas. */
export const orientOperatorPorts = (
  type: HilesElementType,
  direction: OperatorDirection,
  ports: HilesPort[],
): HilesPort[] => {
  const { wide, tip } = OPERATOR_SIDES[direction];
  return ports.map((port) => {
    if (type === HilesElementType.SAMPLE) {
      return {
        ...port,
        side: port.direction === 'input' ? wide : tip,
        offset: port.direction === 'input' ? (port.nature === 'control' ? 0.68 : 0.32) : 0.5,
      };
    }
    if (type === HilesElementType.HOLD) {
      return {
        ...port,
        side: port.direction === 'input' ? tip : wide,
        offset: port.direction === 'input' ? 0.5 : (port.nature === 'control' ? 0.68 : 0.32),
      };
    }
    return port;
  });
};
