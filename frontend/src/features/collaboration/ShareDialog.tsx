import React, { useEffect, useRef, useState } from 'react';
import { construirUrlCompartibleProyecto } from '../../services/projects/projectUrl';
import { copiarTexto } from './clipboard';
import './collaboration.css';

interface ShareDialogProps {
  projectId: string;
  onClose: () => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ projectId, onClose }) => {
  const enlace = construirUrlCompartibleProyecto(projectId, window.location.href);
  const [copiado, setCopiado] = useState<'enlace' | 'id' | 'error' | null>(null);
  const primerBoton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primerBoton.current?.focus();
    const alTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [onClose]);

  const copiar = async (texto: string, tipo: 'enlace' | 'id') => {
    setCopiado((await copiarTexto(texto)) ? tipo : 'error');
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(evento) => evento.target === evento.currentTarget && onClose()}>
      <section className="modal share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <header className="modal__header">
          <h2 id="share-title">Compartir proyecto</h2>
          <button type="button" className="modal__close" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <p className="modal__lead">
          Quien abra este enlace verá el mismo documento, tu cursor y lo que seleccionas. Ejecutar en su navegador es opcional y se activa en <b>Ejecutores</b>.
        </p>
        <label className="share-dialog__field">
          <span>Enlace del proyecto</span>
          <input readOnly value={enlace} onFocus={(evento) => evento.currentTarget.select()} aria-label="Enlace del proyecto" />
        </label>
        <button ref={primerBoton} type="button" className="btn btn--primary" onClick={() => void copiar(enlace, 'enlace')}>
          Copiar enlace
        </button>
        <label className="share-dialog__field">
          <span>Identificador (projectId)</span>
          <input readOnly value={projectId} onFocus={(evento) => evento.currentTarget.select()} aria-label="Identificador del proyecto" />
        </label>
        <button type="button" className="btn" onClick={() => void copiar(projectId, 'id')}>
          Copiar projectId
        </button>
        <p className="share-dialog__status" role="status" aria-live="polite">
          {copiado === 'enlace' && '✓ Enlace copiado. Pégalo en el chat del equipo.'}
          {copiado === 'id' && '✓ projectId copiado. Se escribe en el campo «Proyecto» de la barra superior.'}
          {copiado === 'error' && 'No se pudo copiar automáticamente: selecciona el texto y usa Ctrl+C.'}
        </p>
      </section>
    </div>
  );
};
