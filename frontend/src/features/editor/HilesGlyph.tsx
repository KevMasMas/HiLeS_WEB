import React from 'react';
import { HilesElementType } from '../../types/hiles';

interface HilesGlyphProps {
  type: HilesElementType;
  width?: number;
  height?: number;
}

export const HilesGlyph: React.FC<HilesGlyphProps> = ({ type, width = 88, height = 54 }) => {
  const common = { stroke: '#172033', strokeWidth: 3, fill: '#fff' };

  return (
    <svg width={width} height={height} viewBox="0 0 100 60" aria-hidden="true">
      {type === HilesElementType.STRUCTURAL_BLOCK && <rect x="7" y="6" width="86" height="48" {...common} />}
      {type === HilesElementType.FUNCTIONAL_BLOCK && <rect x="7" y="8" width="86" height="44" rx="12" {...common} />}
      {type === HilesElementType.SERVICE && (
        <><rect x="32" y="12" width="36" height="36" {...common} /><rect x="39" y="19" width="22" height="22" fill="none" stroke="#2878d0" strokeWidth="4" /></>
      )}
      {type === HilesElementType.PORT && (
        <><line x1="14" y1="30" x2="42" y2="30" stroke="#172033" strokeWidth="3" /><rect x="42" y="20" width="20" height="20" fill="#e33a43" stroke="#e33a43" strokeWidth="3" /><rect x="48" y="26" width="8" height="8" fill="#fff" /><line x1="62" y1="30" x2="88" y2="30" stroke="#172033" strokeWidth="3" /></>
      )}
      {type === HilesElementType.SAMPLE && <polygon points="22,10 78,10 50,52" {...common} />}
      {type === HilesElementType.HOLD && <polygon points="50,8 78,50 22,50" {...common} />}
      {type === HilesElementType.PLACE && <><circle cx="50" cy="30" r="22" {...common} /><circle cx="50" cy="30" r="12" fill="none" stroke="#172033" strokeWidth="3" /></>}
      {type === HilesElementType.TRANSITION && <rect x="44" y="5" width="12" height="50" fill="#172033" />}
      {type === HilesElementType.TOKEN && <circle cx="50" cy="30" r="15" fill="#ef2d2d" stroke="#b91c1c" strokeWidth="2" />}
    </svg>
  );
};
