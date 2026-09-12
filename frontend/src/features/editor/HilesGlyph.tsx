import React from 'react';
import { HilesElementType, type OperatorDirection } from '../../types/hiles';
import { trianglePoints } from './triangleGeometry';

interface HilesGlyphProps {
  type: HilesElementType;
  width?: number;
  height?: number;
  direction?: OperatorDirection;
  style?: React.CSSProperties;
}

export const HilesGlyph: React.FC<HilesGlyphProps> = ({ type, width = 88, height = 54, direction = 'right', style }) => {
  const common = { stroke: '#172033', strokeWidth: 3, fill: '#fff' };
  const viewBox = type === HilesElementType.PLACE ? '25 5 50 50'
    : type === HilesElementType.TRANSITION ? '42 2 16 56'
    : '0 0 100 60';

  return (
    <svg width={width} height={height} viewBox={viewBox} aria-hidden="true" style={style}>
      {type === HilesElementType.STRUCTURAL_BLOCK && <rect x="7" y="6" width="86" height="48" {...common} />}
      {type === HilesElementType.FUNCTIONAL_BLOCK && <rect x="7" y="8" width="86" height="44" rx="12" {...common} />}
      {type === HilesElementType.SERVICE && (
        <><rect x="32" y="12" width="36" height="36" {...common} /><rect x="39" y="19" width="22" height="22" fill="none" stroke="#2878d0" strokeWidth="4" /></>
      )}
      {type === HilesElementType.PORT && (
        <><line x1="14" y1="30" x2="42" y2="30" stroke="#172033" strokeWidth="3" /><rect x="42" y="20" width="20" height="20" fill="#e33a43" stroke="#e33a43" strokeWidth="3" /><rect x="48" y="26" width="8" height="8" fill="#fff" /><line x1="62" y1="30" x2="88" y2="30" stroke="#172033" strokeWidth="3" /></>
      )}
      {type === HilesElementType.SAMPLE && <polygon points={trianglePoints(direction)} {...common} />}
      {type === HilesElementType.HOLD && <polygon points={trianglePoints(direction)} {...common} />}
      {type === HilesElementType.PLACE && <><circle cx="50" cy="30" r="22" {...common} /><circle cx="50" cy="30" r="12" fill="none" stroke="#172033" strokeWidth="3" /></>}
      {type === HilesElementType.TRANSITION && <rect x="44" y="5" width="12" height="50" fill="#172033" />}
      {type === HilesElementType.TOKEN && <circle cx="50" cy="30" r="15" fill="#ef2d2d" stroke="#b91c1c" strokeWidth="2" />}
    </svg>
  );
};
