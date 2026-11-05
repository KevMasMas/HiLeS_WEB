import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '../../stores/useEditorStore';
import type { DockPanel } from '../editor/panelState';
import { cargarEjemploMinimo, cargarEjemploMultiPico, marcarCompletado } from './tutorialState';
import { pasosTutorial } from './tutorialSteps';
import './onboarding.css';

interface TutorialProps {
  abierto: boolean;
  onClose: () => void;
  onAbrirEjecutores?: () => void;
  onAbrirPanel?: (panel: DockPanel) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Recorrido guiado con resaltado del control de cada paso. */
export const Tutorial: React.FC<TutorialProps> = ({
  abierto,
  onClose,
  onAbrirEjecutores,
  onAbrirPanel,
}) => {
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [altoTarjeta, setAltoTarjeta] = useState(280);
  const tarjeta = useRef<HTMLElement>(null);
  const lienzoVacio = useEditorStore((state) => state.nodes.length === 0);
  const paso = pasosTutorial[indice] ?? pasosTutorial[0];
  const ultimo = indice === pasosTutorial.length - 1;

  const cerrar = useCallback((completado: boolean) => {
    if (completado) marcarCompletado();
    setIndice(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!abierto || !paso.panel) return;
    if (paso.panel === 'distributed') {
      onAbrirEjecutores?.();
    } else if (paso.panel === 'none') {
      onAbrirPanel?.(null);
    } else {
      onAbrirPanel?.(paso.panel);
    }
  }, [abierto, paso.panel, onAbrirEjecutores, onAbrirPanel]);

  useLayoutEffect(() => {
    if (!abierto || typeof document === 'undefined') return undefined;
    const medir = () => {
      const elemento = paso.objetivo ? document.querySelector<HTMLElement>(paso.objetivo) : null;
      elemento?.scrollIntoView?.({ block: 'nearest' });
      const caja = elemento?.getBoundingClientRect();
      setRect(
        caja && caja.width > 0 && caja.height > 0
          ? { top: caja.top, left: caja.left, width: caja.width, height: caja.height }
          : null,
      );
      if (tarjeta.current) {
        setAltoTarjeta(tarjeta.current.offsetHeight || 280);
      }
    };
    medir();
    const timer1 = window.setTimeout(medir, 60);
    const timer2 = window.setTimeout(medir, 180);
    window.addEventListener('resize', medir);
    return () => {
      window.clearTimeout(timer1);
      window.clearTimeout(timer2);
      window.removeEventListener('resize', medir);
    };
  }, [abierto, paso]);

  useEffect(() => {
    if (!abierto || typeof window === 'undefined') return undefined;
    tarjeta.current?.focus();
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar(false);
      if (evento.key === 'ArrowRight' && !ultimo) setIndice((valor) => valor + 1);
      if (evento.key === 'ArrowLeft') setIndice((valor) => Math.max(0, valor - 1));
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [abierto, cerrar, ultimo, indice]);

  if (!abierto || typeof document === 'undefined') return null;

  const anchoTarjeta = Math.min(380, window.innerWidth - 24);
  const calcularEstiloTarjeta = (): React.CSSProperties => {
    if (!rect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const alto = altoTarjeta || 280;
    const maxTop = Math.max(12, window.innerHeight - alto - 12);
    const maxLeft = Math.max(12, window.innerWidth - anchoTarjeta - 12);
    const centroVertical = Math.max(64, Math.min(maxTop, rect.top + (rect.height - alto) / 2));

    // 1. Si el objetivo está en un panel lateral derecho (DistributedPanel o PanelDock) y hay espacio a la izquierda:
    const espacioIzquierda = rect.left - 16;
    const espacioDerecha = window.innerWidth - (rect.left + rect.width) - 16;
    const enPanelDerecho = rect.left > window.innerWidth * 0.45;

    if (enPanelDerecho && espacioIzquierda >= anchoTarjeta + 12) {
      const left = Math.max(12, Math.min(maxLeft, rect.left - anchoTarjeta - 16));
      return { top: centroVertical, left };
    }

    // 2. Si el objetivo está en el borde izquierdo y hay espacio a la derecha:
    if (!enPanelDerecho && rect.left < 200 && espacioDerecha >= anchoTarjeta + 12 && rect.top > 80) {
      const left = Math.max(12, Math.min(maxLeft, rect.left + rect.width + 16));
      return { top: centroVertical, left };
    }

    // 3. Ubicación vertical: si está en la parte superior (ej. barra TopBar), colocarlo DEBAJO del objetivo
    const horizontalCentrado = Math.max(12, Math.min(maxLeft, rect.left));
    const candidatoDebajo = rect.top + rect.height + 16;
    const candidatoEncima = rect.top - alto - 16;

    if (candidatoDebajo + alto <= window.innerHeight - 12) {
      return { top: Math.max(12, Math.min(maxTop, candidatoDebajo)), left: horizontalCentrado };
    }

    // 4. Si cabe ENCIMA del objetivo sin tocar la barra superior
    if (candidatoEncima >= 64) {
      return { top: Math.max(64, Math.min(maxTop, candidatoEncima)), left: horizontalCentrado };
    }

    // 5. En pantallas estrechas/móviles donde no cabe ni a los lados ni arriba/abajo pegado:
    // Evitar cubrir el objetivo posicionando la tarjeta en la mitad opuesta de la pantalla
    if ((rect.top + rect.height) > window.innerHeight * 0.55 || rect.top > window.innerHeight * 0.35) {
      return { top: 64, left: horizontalCentrado };
    }
    return { top: maxTop, left: horizontalCentrado };
  };

  return createPortal(
    <div className={`tour ${rect ? 'has-spotlight' : ''}`} role="presentation">
      {rect && (() => {
        const top = Math.max(4, rect.top - 6);
        const left = Math.max(4, rect.left - 6);
        const width = Math.max(20, Math.min(window.innerWidth - left - 8, rect.width + 12));
        const height = Math.max(20, Math.min(window.innerHeight - top - 8, rect.height + 12));
        return (
          <div
            className="tour__spotlight"
            aria-hidden="true"
            style={{ top, left, width, height }}
          />
        );
      })()}
      <section
        ref={tarjeta}
        tabIndex={-1}
        className="tour__card"
        style={calcularEstiloTarjeta()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <p className="tour__progress">Paso {indice + 1} de {pasosTutorial.length}</p>
        <h2 id="tour-title">{paso.titulo}</h2>
        <p id="tour-body">{paso.explicacion}</p>
        <p className="tour__action"><strong>Haz esto:</strong> {paso.accion}</p>
        {paso.tema === 'bienvenida' && (
          <div className="empty-canvas__actions">
            <button type="button" className="btn btn--primary" onClick={cargarEjemploMinimo}>
              {lienzoVacio ? 'Cargar ejemplo sin hardware' : 'Reemplazar con ejemplo sin hardware'}
            </button>
            <button type="button" className="btn" onClick={cargarEjemploMultiPico}>
              Cargar ejemplo multi-Pico
            </button>
          </div>
        )}
        <div className="tour__dots" aria-hidden="true">
          {pasosTutorial.map((item, posicion) => (
            <span key={`${item.tema}-${posicion}`} className={posicion === indice ? 'is-active' : ''} />
          ))}
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
