import { HilesElementType } from './hiles';

export const HilesElementTranslations: Record<HilesElementType, string> = {
  [HilesElementType.STRUCTURAL_BLOCK]: 'Bloque Estructural',
  [HilesElementType.FUNCTIONAL_BLOCK]: 'Bloque Funcional',
  [HilesElementType.SERVICE]: 'Servicio',
  [HilesElementType.PORT]: 'Puerto',
  [HilesElementType.SAMPLE]: 'Muestreador',
  [HilesElementType.HOLD]: 'Retenedor',
  [HilesElementType.PLACE]: 'Lugar',
  [HilesElementType.TRANSITION]: 'Transición',
  [HilesElementType.TOKEN]: 'Token',
};
