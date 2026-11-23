import React, { useEffect, useId, useRef, useState } from 'react';

interface HelpHintProps {
  /** Texto breve que responde «¿qué hace esto?». */
  texto: string;
  titulo?: string;
}

/** Ayuda contextual accesible: se abre con clic, teclado o foco y se cierra con Escape. */
export const HelpHint: React.FC<HelpHintProps> = ({ texto, titulo = 'Ayuda' }) => {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const raiz = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrar = (evento: MouseEvent | KeyboardEvent) => {
      if (evento instanceof KeyboardEvent ? evento.key === 'Escape' : !raiz.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };
    window.addEventListener('mousedown', cerrar);
    window.addEventListener('keydown', cerrar);
    return () => {
      window.removeEventListener('mousedown', cerrar);
      window.removeEventListener('keydown', cerrar);
    };
  }, [abierto]);

  return (
    <span className="help-hint" ref={raiz}>
      <button
        type="button"
        className="help-hint__button"
        aria-label={`${titulo}: mostrar ayuda`}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        onClick={() => setAbierto((valor) => !valor)}
      >
        ?
      </button>
      {abierto && (
        <span role="tooltip" id={id} className="help-hint__bubble">
          <strong>{titulo}</strong>
          {texto}
        </span>
      )}
    </span>
  );
};
