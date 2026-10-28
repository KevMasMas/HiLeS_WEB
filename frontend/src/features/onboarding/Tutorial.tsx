import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../stores/useEditorStore';
import { cargarEjemploMinimo, marcarCompletado } from './tutorialState';
import { pasosTutorial } from './tutorialSteps';
import './onboarding.css';

interface TutorialProps {
  abierto: boolean;
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Recorrido guiado con resaltado del control de cada paso. */
export const Tutorial: React.FC<TutorialProps> = ({ abierto, onClose }) => {
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const tarjeta = useRef<HTMLElement>(null);
  const lienzoVacio = useEditorStore((state) => state.nodes.length === 0);
  const paso = pasosTutorial[indice];
  const ultimo = indice === pasosTutorial.length - 1;

  const cerrar = useCallback((completado: boolean) => {
    if (completado) marcarCompletado();
    setIndice(0);
    onClose();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!abierto) return undefined;
    const medir = () => {
      const objetivo = paso.objetivo ? document.querySelector(paso.objetivo) : null;
      const caja = objetivo?.getBoundingClientRect();
      setRect(caja && caja.width > 0 ? { top: caja.top, left: caja.left, width: caja.width, height: caja.height } : null);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [abierto, paso]);

  useEffect(() => {
    if (!abierto) return undefined;
    tarjeta.current?.focus();
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar(false);
      if (evento.key === 'ArrowRight' && !ultimo) setIndice((valor) => valor + 1);
      if (evento.key === 'ArrowLeft') setIndice((valor) => Math.max(0, valor - 1));
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [abierto, cerrar, ultimo, indice]);

  if (!abierto) return null;

  const estiloTarjeta: React.CSSProperties = rect
    ? {
      top: Math.min(window.innerHeight - 260, rect.top + rect.height + 12),
      left: Math.max(12, Math.min(window.innerWidth - 392, rect.left)),
    }
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return createPortal(
    <div className="tour" role="presentation">
      {rect && (
        <div
          className="tour__spotlight"
          aria-hidden="true"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <section
        ref={tarjeta}
        tabIndex={-1}
        className="tour__card"
        style={estiloTarjeta}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <p className="tour__progress">Paso {indice + 1} de {pasosTutorial.length}</p>
        <h2 id="tour-title">{paso.titulo}</h2>
        <p id="tour-body">{paso.explicacion}</p>
        <p className="tour__action"><strong>Haz esto:</strong> {paso.accion}</p>
        {paso.tema === 'bienvenida' && lienzoVacio && (
          <button type="button" className="btn btn--primary" onClick={cargarEjemploMinimo}>Cargar ejemplo mínimo</button>
        )}
        <div className="tour__dots" aria-hidden="true">
          {pasosTutorial.map((item, posicion) => <span key={item.tema} className={posicion === indice ? 'is-active' : ''} />)}
        </div>
        <footer className="tour__footer">
          <button type="button" className="link-button" onClick={() => cerrar(false)}>Saltar tutorial</button>
          <span>
            <button type="button" className="btn" disabled={indice === 0} onClick={() => setIndice((valor) => valor - 1)}>Atrás</button>
            {ultimo ? (
              <button type="button" className="btn btn--primary" onClick={() => cerrar(true)}>Terminar</button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => setIndice((valor) => valor + 1)}>Siguiente</button>
            )}
          </span>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
