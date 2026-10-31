import React, { useEffect, useRef, useState } from 'react';
import { normalizeDisplayName } from '../../stores/useProjectStore';
import './collaboration.css';

interface DisplayNameDialogProps {
  onConfirm: (name: string) => void;
}

export const DisplayNameDialog: React.FC<DisplayNameDialogProps> = ({ onConfirm }) => {
  const [value, setValue] = useState('');
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const name = normalizeDisplayName(value);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (name) onConfirm(name);
  };

  return (
    <div className="modal-backdrop identity-backdrop">
      <form className="modal identity-dialog" role="dialog" aria-modal="true" aria-labelledby="identity-title" onSubmit={submit}>
        <div className="identity-dialog__mark" aria-hidden="true">HiLeS</div>
        <div>
          <h2 id="identity-title">¿Cómo quieres aparecer?</h2>
          <p className="modal__lead">Este nombre identificará tu cursor y tus cambios para las demás personas del proyecto.</p>
        </div>
        <label className="identity-dialog__field">
          <span>Nombre para mostrar</span>
          <input
            ref={inputRef}
            value={value}
            maxLength={40}
            autoComplete="name"
            inputMode="text"
            placeholder="Ej. Persona 1"
            aria-describedby="identity-help"
            aria-invalid={attempted && !name}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <p id="identity-help" className={attempted && !name ? 'identity-dialog__error' : 'identity-dialog__help'}>
          {attempted && !name ? 'Escribe un nombre para continuar.' : 'Se conservará mientras esta pestaña permanezca abierta.'}
        </p>
        <button type="submit" className="btn btn--primary" disabled={!name}>Entrar al proyecto</button>
      </form>
    </div>
  );
};
