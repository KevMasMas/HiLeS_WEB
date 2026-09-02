import React from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { HilesElementType } from '../../types/hiles';
import { HilesGlyph } from './HilesGlyph';

const handleStyle: React.CSSProperties = { width: 8, height: 8, background: '#172033', border: '2px solid white' };

const NodeHandles = () => (
  <>
    <Handle type="target" position={Position.Top} id="top-target" style={handleStyle} />
    <Handle type="target" position={Position.Left} id="left-target" style={handleStyle} />
    <Handle type="source" position={Position.Right} id="right-source" style={handleStyle} />
    <Handle type="source" position={Position.Bottom} id="bottom-source" style={handleStyle} />
  </>
);

export const HilesNode: React.FC<NodeProps> = ({ data, selected }) => {
  const hilesType = data.hilesType as HilesElementType;
  const name = data.name as string;

  if (hilesType === HilesElementType.STRUCTURAL_BLOCK) {
    return (
      <div style={{
        width: '100%', height: '100%', boxSizing: 'border-box', background: 'rgba(248,250,252,.93)',
        border: `3px solid ${selected ? '#2563eb' : '#172033'}`, borderRadius: 2,
        boxShadow: selected ? '0 0 0 4px rgba(37,99,235,.16)' : '0 8px 24px rgba(15,23,42,.08)',
      }}>
        <NodeHandles />
        <div style={{ padding: '9px 12px', borderBottom: '1px solid #cbd5e1', fontSize: 12, fontWeight: 800, color: '#172033' }}>{name}</div>
        <div style={{ position: 'absolute', right: 10, top: 10, fontSize: 10, color: '#64748b' }}>Bloque estructural</div>
      </div>
    );
  }

  const isFunctional = hilesType === HilesElementType.FUNCTIONAL_BLOCK;
  return (
    <div style={{
      position: 'relative', minWidth: isFunctional ? 150 : 82, minHeight: isFunctional ? 72 : 74,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      filter: selected ? 'drop-shadow(0 0 5px rgba(37,99,235,.65))' : 'none',
    }}>
      <NodeHandles />
      <HilesGlyph type={hilesType} width={isFunctional ? 150 : 82} height={isFunctional ? 64 : 54} />
      <div style={{ maxWidth: 150, paddingTop: 2, fontSize: 11, lineHeight: 1.1, fontWeight: 700, color: '#172033', textAlign: 'center' }}>{name}</div>
    </div>
  );
};
