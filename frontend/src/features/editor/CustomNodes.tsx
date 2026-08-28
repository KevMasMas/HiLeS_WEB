import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { HilesElementType } from '../../types/hiles';

const nodeStyles: Record<string, React.CSSProperties> = {
  [HilesElementType.STRUCTURAL_BLOCK]: { border: '2px solid #333', background: '#f8f9fa', borderRadius: '4px' },
  [HilesElementType.FUNCTIONAL_BLOCK]: { border: '2px dashed #0056b3', background: '#e9ecef', borderRadius: '4px' },
  [HilesElementType.SERVICE]: { border: '2px solid #28a745', background: '#d4edda', borderRadius: '8px' },
  [HilesElementType.PORT]: { border: '2px solid #fd7e14', background: '#ffe8cc', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '10px' },
  [HilesElementType.SAMPLE]: { border: '2px solid #17a2b8', background: '#d1ecf1' },
  [HilesElementType.HOLD]: { border: '2px solid #6c757d', background: '#e2e3e5' },
  [HilesElementType.PLACE]: { border: '2px solid #6610f2', background: '#e0cffc', borderRadius: '50%', width: '50px', height: '50px' },
  [HilesElementType.TRANSITION]: { border: '2px solid #dc3545', background: '#f8d7da', width: '20px', height: '60px' },
};

export const HilesNode: React.FC<NodeProps> = ({ data, selected }) => {
  const hilesType = data.hilesType as HilesElementType;
  const name = data.name as string;

  const style = {
    padding: hilesType === HilesElementType.PORT || hilesType === HilesElementType.PLACE || hilesType === HilesElementType.TRANSITION ? '0' : '10px 20px',
    minWidth: hilesType === HilesElementType.PORT || hilesType === HilesElementType.PLACE || hilesType === HilesElementType.TRANSITION ? 'auto' : '120px',
    textAlign: 'center' as const,
    boxShadow: selected ? '0 0 0 3px rgba(0, 123, 255, 0.5)' : 'none',
    ...nodeStyles[hilesType]
  };

  return (
    <div style={style}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <Handle type="target" position={Position.Left} id="left-target" style={{ background: '#555' }} />
      
      {hilesType !== HilesElementType.PORT && hilesType !== HilesElementType.PLACE && hilesType !== HilesElementType.TRANSITION && (
        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{name}</div>
      )}
      {(hilesType === HilesElementType.PORT || hilesType === HilesElementType.PLACE) && (
        <div style={{ fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name.substring(0,4)}</div>
      )}

      <Handle type="source" position={Position.Right} id="right-source" style={{ background: '#555' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};
