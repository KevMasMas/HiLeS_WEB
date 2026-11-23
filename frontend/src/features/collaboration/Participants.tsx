import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getProjectSyncClient, useProjectStore } from '../../stores/useProjectStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { enfocarElemento } from './focus';
import {
  ETIQUETA_ESTADO_COLABORADOR,
  codificarVista,
  decodificarSeleccion,
  estadoColaborador,
  iniciales,
} from './presence';
import { useFollowStore } from './useFollowStore';
import './collaboration.css';

/** Anuncia la selección local en la presencia del proyecto. */
const usePublicarSeleccion = (): void => {
  const seleccion = useEditorStore((state) => state.selectedElementId);
  const listo = useProjectStore((state) => state.ready);
  useEffect(() => {
    if (!listo) return;
    getProjectSyncClient()?.publicarPresencia(true, codificarVista(seleccion));
  }, [seleccion, listo]);
};

/** Centra la vista cada vez que la persona seguida cambia su selección. */
const useSeguirColaborador = (): void => {
  const siguiendo = useFollowStore((state) => state.siguiendo);
  const seguir = useFollowStore((state) => state.seguir);
  const colaborador = useProjectStore((state) => state.collaborators.find((item) => item.clientId === siguiendo));
  const seleccion = decodificarSeleccion(colaborador?.vistaActiva);
  useEffect(() => {
    if (!siguiendo) return;
    if (!colaborador?.conectado) {
      seguir(null);
      return;
    }
    if (seleccion) enfocarElemento(seleccion, false);
  }, [siguiendo, colaborador?.conectado, seleccion, seguir]);
};

export const Participants: React.FC = () => {
  usePublicarSeleccion();
  useSeguirColaborador();
  const [abierto, setAbierto] = useState(false);
  const [, setReloj] = useState(0);
  const todos = useProjectStore((state) => state.collaborators);
  const propioId = useProjectStore((state) => state.clientId);
  const nombrePropio = useProjectStore((state) => state.displayName) ?? 'Tú';
  const nodos = useEditorStore((state) => state.nodes);
  const siguiendo = useFollowStore((state) => state.siguiendo);
  const seguir = useFollowStore((state) => state.seguir);
  const nombres = useMemo(() => new Map(nodos.map((nodo) => [nodo.id, nodo.data.name])), [nodos]);
  const remotos = useMemo(
    () => todos.filter((persona) => persona.conectado && persona.clientId !== propioId),
    [todos, propioId],
  );

  // Refresca «activo/inactivo» aunque no lleguen mensajes nuevos.
  useEffect(() => {
    const id = window.setInterval(() => setReloj((valor) => valor + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const slot = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-collaboration-slot]');
  if (!slot) return null;

  const seguido = remotos.find((persona) => persona.clientId === siguiendo);

  return createPortal(
    <div className="collab">
      <button
        type="button"
        className="collab__summary"
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={`${remotos.length + 1} personas en el proyecto. Ver colaboradores`}
        onClick={() => setAbierto((valor) => !valor)}
      >
        <span className="collab-avatar collab-avatar--self" title={`${nombrePropio} (tú)`} aria-hidden="true">{iniciales(nombrePropio)}</span>
        {remotos.slice(0, 4).map((persona) => (
          <span
            key={persona.clientId}
            className={`collab-avatar is-${estadoColaborador(persona)}`}
            style={{ background: persona.color }}
            aria-hidden="true"
          >
            {iniciales(persona.usuario)}
          </span>
        ))}
        {remotos.length > 4 && <small aria-hidden="true">+{remotos.length - 4}</small>}
        {seguido && <span className="collab__following" aria-hidden="true">Siguiendo a {seguido.usuario}</span>}
      </button>
      {abierto && (
        <div className="collab__popover" role="dialog" aria-label="Colaboradores del proyecto">
          <header>
            <strong>Colaboradores</strong>
            <button type="button" className="collab__close" aria-label="Cerrar lista de colaboradores" onClick={() => setAbierto(false)}>×</button>
          </header>
          <div className="collab__self">
            <span className="collab-avatar collab-avatar--self" aria-hidden="true">{iniciales(nombrePropio)}</span>
            <span><strong>{nombrePropio}</strong><small>Tú · conectado</small></span>
          </div>
          {remotos.length === 0 && (
            <p className="collab__empty">Solo estás tú. Usa <b>Compartir</b> para invitar a alguien con el enlace del proyecto.</p>
          )}
          <ul>
            {remotos.map((persona) => {
              const estado = estadoColaborador(persona);
              const seleccion = decodificarSeleccion(persona.vistaActiva);
              const esSeguido = siguiendo === persona.clientId;
              return (
                <li key={persona.clientId} className="collab__person">
                  <span className={`collab-avatar is-${estado}`} style={{ background: persona.color }} aria-hidden="true">
                    {iniciales(persona.usuario)}
                  </span>
                  <span className="collab__info">
                    <strong>{persona.usuario}</strong>
                    <span className={`collab__state is-${estado}`}>{ETIQUETA_ESTADO_COLABORADOR[estado]}</span>
                    <span className="collab__selection">
                      {seleccion ? <>Seleccionó: <b>{nombres.get(seleccion) ?? seleccion}</b></> : 'Sin selección'}
                    </span>
                  </span>
                  <span className="collab__actions">
                    <button type="button" disabled={!seleccion} onClick={() => seleccion && enfocarElemento(seleccion, false)} title="Centrar la vista en lo que seleccionó">
                      Ir
                    </button>
                    <button
                      type="button"
                      className={esSeguido ? 'is-active' : ''}
                      aria-pressed={esSeguido}
                      onClick={() => seguir(esSeguido ? null : persona.clientId)}
                      title={esSeguido ? 'Dejar de seguir' : 'Tu vista seguirá cada selección de esta persona'}
                    >
                      {esSeguido ? 'Dejar de seguir' : 'Seguir'}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>,
    slot,
  );
};
