import type { HilesNodeData } from '../../types/hiles';

export interface PuntoToken {
  /** Porcentaje horizontal dentro del contenedor de símbolo (0..100). */
  x: number;
  /** Porcentaje vertical dentro del contenedor de símbolo (0..100). */
  y: number;
}

export interface DescripcionMarcajePlace {
  cantidad: number;
  visible: boolean;
  modo: 'vacio' | 'unico' | 'multiple_puntos' | 'contador';
  puntos: PuntoToken[];
  etiquetaContador: string | null;
  ariaLabel: string;
}

const DISPOSICION_PUNTOS: Record<number, PuntoToken[]> = {
  1: [{ x: 50, y: 50 }],
  2: [
    { x: 40, y: 50 },
    { x: 60, y: 50 },
  ],
  3: [
    { x: 50, y: 39 },
    { x: 40, y: 58 },
    { x: 60, y: 58 },
  ],
  4: [
    { x: 41, y: 41 },
    { x: 59, y: 41 },
    { x: 41, y: 59 },
    { x: 59, y: 59 },
  ],
};

/**
 * Calcula la representación visual de tokens para un `Place` a zoom normal:
 * - `0`: vacío
 * - `1`: un punto central
 * - `2..4`: puntos distribuidos + insignia `×N`
 * - `>=5`: punto central compacto + insignia `×N`
 */
export const describirMarcajePlace = (tokensRaw: number | undefined): DescripcionMarcajePlace => {
  const cantidad = Math.max(0, Math.floor(Number.isFinite(tokensRaw) ? Number(tokensRaw) : 0));
  if (cantidad === 0) {
    return {
      cantidad: 0,
      visible: false,
      modo: 'vacio',
      puntos: [],
      etiquetaContador: null,
      ariaLabel: '0 tokens',
    };
  }

  if (cantidad === 1) {
    return {
      cantidad: 1,
      visible: true,
      modo: 'unico',
      puntos: DISPOSICION_PUNTOS[1],
      etiquetaContador: null,
      ariaLabel: '1 token',
    };
  }

  if (cantidad <= 4) {
    return {
      cantidad,
      visible: true,
      modo: 'multiple_puntos',
      puntos: DISPOSICION_PUNTOS[cantidad],
      etiquetaContador: `×${cantidad}`,
      ariaLabel: `${cantidad} tokens`,
    };
  }

  return {
    cantidad,
    visible: true,
    modo: 'contador',
    puntos: DISPOSICION_PUNTOS[1],
    etiquetaContador: `×${cantidad}`,
    ariaLabel: `${cantidad} tokens`,
  };
};

export const esRuntimeObsoleto = (runtime: HilesNodeData['runtime'] | undefined): boolean =>
  runtime?.stale === true;
