import React from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { cargarEjemploMinimo } from './tutorialState';
import './onboarding.css';

interface EmptyCanvasProps {
  onAbrirTutorial: () => void;
}

/** Estado vacío del lienzo con los tres caminos para empezar. */
export const EmptyCanvas: React.FC<EmptyCanvasProps> = ({ onAbrirTutorial }) => {
  const vacio = useEditorStore((state) => state.nodes.length === 0);
  const paletaAbierta = useEditorStore((state) => state.paletteOpen);
  const setPaletteOpen = useEditorStore((state) => state.setPaletteOpen);
  const listo = useProjectStore((state) => state.ready);
  const destino = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.editor-workspace');
  if (!vacio || !listo || !destino) return null;

  return createPortal(
    <section className="empty-canvas" aria-labelledby="empty-canvas-title">
      <h2 id="empty-canvas-title">Tu lienzo está vacío</h2>
      <p>Empieza con un ejemplo listo o agrega tus propios bloques. Lo que hagas se comparte con quien tenga el enlace del proyecto.</p>
      <div className="empty-canvas__actions">
        <button type="button" className="btn btn--primary" onClick={cargarEjemploMinimo}>Cargar ejemplo mínimo</button>
        <button type="button" className="btn" onClick={() => setPaletteOpen(!paletaAbierta)}>Abrir elementos</button>
        <button type="button" className="btn" onClick={onAbrirTutorial}>Ver tutorial</button>
      </div>
    </section>,
    destino,
  );
};
