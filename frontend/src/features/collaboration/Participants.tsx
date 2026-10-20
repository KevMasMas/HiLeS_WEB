import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useProjectStore } from '../../stores/useProjectStore';

export const Participants: React.FC = () => {
  const allCollaborators = useProjectStore((state) => state.collaborators);
  const collaborators = useMemo(
    () => allCollaborators.filter((person) => person.conectado),
    [allCollaborators],
  );
  const slot = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-collaboration-slot]');
  if (!slot) return null;
  return createPortal(<div className="collab-participants" title={collaborators.map((person) => person.usuario).join(', ') || 'Only you'} aria-label={`${collaborators.length + 1} collaborators online`}>
    <span className="collab-avatar" style={{ background: '#2563eb' }}>Y</span>
    {collaborators.slice(0, 4).map((person) => <span key={person.clientId} className="collab-avatar" style={{ background: person.color }} title={person.usuario}>{person.usuario.slice(0, 1).toUpperCase()}</span>)}
    <small>{collaborators.length + 1}</small>
  </div>, slot);
};
