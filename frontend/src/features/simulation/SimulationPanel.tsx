import React, { useCallback, useEffect, useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { getDemoState, publishDemoInput, resetDemo, type DemoSimulationState } from './simulationApi';
import './simulation.css';

const DEMO_NODE_IDS = ['demo-input', 'demo-waiting', 'demo-activate', 'demo-active', 'demo-deactivate', 'demo-output'];

export const SimulationPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [state, setState] = useState<DemoSimulationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nodes = useEditorStore((store) => store.nodes);
  const edges = useEditorStore((store) => store.edges);
  const loadDemoCircuit = useEditorStore((store) => store.loadDemoCircuit);
  const applyDemoState = useEditorStore((store) => store.applyDemoState);
  const demoLoaded = DEMO_NODE_IDS.every((id) => nodes.some((node) => node.id === id));

  const acceptState = useCallback((nextState: DemoSimulationState) => {
    setState(nextState);
    applyDemoState(nextState);
    setError(null);
  }, [applyDemoState]);

  // Every failure surfaces the message thrown by the API layer, so a disconnected
  // backend always reads the same way whether it failed on load or on a button.
  const fail = useCallback((requestError: unknown) => {
    setError(requestError instanceof Error ? requestError.message : 'No fue posible ejecutar el circuito.');
  }, []);

  useEffect(() => {
    getDemoState().then(acceptState).catch(fail);
  }, [acceptState, fail]);

  const run = async (operation: () => Promise<DemoSimulationState>) => {
    setBusy(true);
    try {
      acceptState(await operation());
    } catch (requestError) {
      fail(requestError);
    } finally {
      setBusy(false);
    }
  };

  const loadCircuit = () => {
    if (!demoLoaded && (nodes.length > 0 || edges.length > 0) && !window.confirm('¿Reemplazar el circuito actual por la demostración conectada al backend?')) return;
    loadDemoCircuit();
    void run(resetDemo);
  };

  const recentEvents = state?.events.slice(-6).reverse() ?? [];

  return (
    <section className={`simulation-panel ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="Simulación del backend">
      <button className="simulation-panel__header" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        <span><i className={`simulation-panel__status ${error ? 'is-offline' : ''}`} />Backend runtime</span>
        <strong>{expanded ? '−' : '+'}</strong>
      </button>
      {expanded && <div className="simulation-panel__body">
        <p className="simulation-panel__intro">Una entrada publica en la cola, dispara una transición, mueve el token y actualiza la salida.</p>
        {!demoLoaded && <button className="simulation-panel__load" type="button" onClick={loadCircuit}>Cargar circuito demo</button>}
        {demoLoaded && <>
          <div className="simulation-panel__controls">
            <button type="button" disabled={busy} onClick={() => void run(() => publishDemoInput(false))}>Enviar 0</button>
            <button type="button" disabled={busy} className="is-primary" onClick={() => void run(() => publishDemoInput(true))}>Enviar 1</button>
          </div>
          <div className={`simulation-panel__state ${error && state ? 'is-stale' : ''}`}>
            <div><span>Espera</span><strong>{state?.places.waiting ?? '–'} token</strong></div>
            <div><span>Activo</span><strong>{state?.places.active ?? '–'} token</strong></div>
            <div className={state?.output ? 'is-on' : ''}><span>Salida</span><strong>{state?.output ? 'ON · 1' : 'OFF · 0'}</strong></div>
          </div>
          <div className="simulation-panel__meta"><span>Cola: {state?.queueDepth ?? 0}</span><button type="button" disabled={busy} onClick={() => void run(resetDemo)}>Reiniciar</button></div>
          <div className="simulation-panel__events" aria-live="polite">
            <h4>Última ejecución</h4>
            {recentEvents.length === 0 ? <p>Envía una entrada para ver los tópicos.</p> : recentEvents.map((event) => (
              <div key={event.sequence}><code>#{event.sequence} {event.topic}</code><span>{event.description}</span></div>
            ))}
          </div>
        </>}
        {error && <p className="simulation-panel__error">{error}{state ? ' Los valores mostrados son los de la última respuesta recibida.' : ''}</p>}
      </div>}
    </section>
  );
};
