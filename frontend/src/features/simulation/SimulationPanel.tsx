import React, { useCallback, useEffect, useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { HilesElementType } from '../../types/hiles';

import './simulation.css';

const DEMO_NODE_IDS = ['demo-input', 'demo-waiting', 'demo-activate', 'demo-active', 'demo-deactivate', 'demo-output'];

export const SimulationPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [state, setState] = useState<DemoSimulationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [localEvent, setLocalEvent] = useState<string | null>(null);
  const [testValue, setTestValue] = useState('');
  const nodes = useEditorStore((store) => store.nodes);
  const edges = useEditorStore((store) => store.edges);
  const selectedElementId = useEditorStore((store) => store.selectedElementId);
  const setSelectedElement = useEditorStore((store) => store.setSelectedElement);
  const loadDemoCircuit = useEditorStore((store) => store.loadDemoCircuit);
  const applyDemoState = useEditorStore((store) => store.applyDemoState);
  const simulateServiceInput = useEditorStore((store) => store.simulateServiceInput);
  const resetLocalSimulation = useEditorStore((store) => store.resetLocalSimulation);
  const demoLoaded = DEMO_NODE_IDS.every((id) => nodes.some((node) => node.id === id));
  const injectableServices = nodes.filter((node) => node.data.hilesType === HilesElementType.SERVICE
    && node.data.ports.some((port) => port.direction === 'output'));
  const canvasSelectedService = injectableServices.find((node) => node.id === selectedElementId);
  const selectedService = canvasSelectedService
    ?? injectableServices.find((node) => node.id === selectedServiceId)
    ?? injectableServices[0];
  const usesDemoBackend = demoLoaded && selectedService?.id === 'demo-input';
  const outputPort = selectedService?.data.ports.find((port) => port.direction === 'output');
  const acceptsBoolean = outputPort?.dataType === 'boolean';
  const displayServiceValue = (value: unknown) => typeof value === 'boolean'
    ? (value ? 'ON · 1' : 'OFF · 0')
    : value === undefined ? '–' : String(value);

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

  const sendServiceValue = (value: boolean) => {
    if (!selectedService) return;
    setLocalEvent(null);
    if (usesDemoBackend) {
      void run(() => publishDemoInput(value));
      return;
    }
    const events = simulateServiceInput(selectedService.id, value);
    setError(null);
    setLocalEvent(events.join(' '));
  };

  const sendNumericServiceValue = () => {
    if (!selectedService) return;
    const value = Number(testValue);
    if (!Number.isFinite(value)) {
      setLocalEvent('Escribe un valor numérico válido antes de enviarlo.');
      return;
    }
    const events = simulateServiceInput(selectedService.id, value);
    setError(null);
    setLocalEvent(events.join(' '));
  };

  const recentEvents = state?.events.slice(-6).reverse() ?? [];

  return (
    <section className={`simulation-panel ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="Simulación del backend">
      <button className="simulation-panel__header" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        <span><i className={`simulation-panel__status ${error ? 'is-offline' : ''}`} />Backend runtime</span>
        <strong>{expanded ? '−' : '+'}</strong>
      </button>
      {expanded && <div className="simulation-panel__body">
        <p className="simulation-panel__intro">Selecciona un Service con puerto de salida para inyectar un valor booleano de prueba.</p>
        {!demoLoaded && <button className="simulation-panel__load" type="button" onClick={loadCircuit}>Cargar circuito demo</button>}
        {injectableServices.length > 0 && <>
          <label className="simulation-panel__service">
            <span>Service de entrada</span>
            <select value={selectedService?.id ?? ''} onChange={(event) => {
              setSelectedServiceId(event.target.value);
              setSelectedElement(event.target.value);
              setTestValue('');
            }}>
              {injectableServices.map((service) => <option key={service.id} value={service.id}>{service.data.name}</option>)}
            </select>
          </label>
          {(usesDemoBackend || acceptsBoolean) ? <div className="simulation-panel__controls">
            <button type="button" disabled={busy} onClick={() => sendServiceValue(false)}>Enviar 0</button>
            <button type="button" disabled={busy} className="is-primary" onClick={() => sendServiceValue(true)}>Enviar 1</button>
          </div> : <div className="simulation-panel__numeric-control">
            <input type="number" step="any" value={testValue} placeholder="Ej.: 79" onChange={(event) => setTestValue(event.target.value)} aria-label="Valor de prueba" />
            <button type="button" disabled={busy || testValue.trim() === ''} className="is-primary" onClick={sendNumericServiceValue}>Enviar valor</button>
          </div>}
          {usesDemoBackend ? <div className={`simulation-panel__state ${error && state ? 'is-stale' : ''}`}>
            <div><span>Espera</span><strong>{state?.places.waiting ?? '–'} token</strong></div>
            <div><span>Activo</span><strong>{state?.places.active ?? '–'} token</strong></div>
            <div className={state?.output ? 'is-on' : ''}><span>Salida</span><strong>{state?.output ? 'ON · 1' : 'OFF · 0'}</strong></div>
          </div> : <div className="simulation-panel__state simulation-panel__state--service">
            <div className={selectedService?.data.runtime?.value === true ? 'is-on' : ''}><span>Valor inyectado</span><strong>{displayServiceValue(selectedService?.data.runtime?.value)}</strong></div>
          </div>}
          {usesDemoBackend && <div className="simulation-panel__meta"><span>Cola: {state?.queueDepth ?? 0}</span><button type="button" disabled={busy} onClick={() => void run(resetDemo)}>Reiniciar</button></div>}
          {!usesDemoBackend && <div className="simulation-panel__meta"><span>Simulación local</span><button type="button" onClick={() => { resetLocalSimulation(); setLocalEvent('Se restauraron los tokens iniciales.'); }}>Reiniciar</button></div>}
          {usesDemoBackend && <div className="simulation-panel__events" aria-live="polite">
            <h4>Última ejecución</h4>
            {recentEvents.length === 0 ? <p>Envía una entrada para ver los tópicos.</p> : recentEvents.map((event) => (
              <div key={event.sequence}><code>#{event.sequence} {event.topic}</code><span>{event.description}</span></div>
            ))}
          </div>}
          {!usesDemoBackend && localEvent && <p className="simulation-panel__local-event" aria-live="polite">{localEvent}</p>}
        </>}
        {injectableServices.length === 0 && <p className="simulation-panel__empty">Agrega un Service con al menos un puerto de salida para habilitar la prueba.</p>}
        {error && <p className="simulation-panel__error">{error}{state ? ' Los valores mostrados son los de la última respuesta recibida.' : ''}</p>}
      </div>}
    </section>
  );
};
