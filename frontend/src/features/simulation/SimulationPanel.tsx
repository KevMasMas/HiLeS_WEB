import React, { useState } from 'react';
import { useRemoteExecutionStore } from '../../stores/useRemoteExecutionStore';
import { useSimulationStore } from '../../stores/useSimulationStore';
import './simulation.css';

export const SimulationPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [numericValue, setNumericValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const remote = useRemoteExecutionStore();
  const [modeloId, setModeloId] = useState(remote.modeloId);
  const [version, setVersion] = useState(String(remote.version));
  const {
    modoEjecucion,
    estado,
    eventos,
    servicios,
    mensaje: mensajeMotor,
    ocupado,
    operacion,
    inyectarEntrada,
    paso,
    ejecutar,
    reiniciar,
  } = useSimulationStore();

  const esPico = modoEjecucion === 'pico';
  const selectedService = servicios.find((service) => service.id === selectedServiceId) ?? servicios[0];
  const recentEvents = eventos.slice().reverse().slice(0, 10);

  const getStatusColor = () => {
    if (esPico && remote.mqttEstado !== 'CONNECTED') return remote.mqttEstado === 'CONNECTING' ? '#f59e0b' : '#ef4444';
    switch (estado) {
      case 'lista': return '#3b82f6';
      case 'ejecutando': return '#eab308';
      case 'estabilizada': return '#22c55e';
      case 'error': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const enviarEntrada = (valor: boolean | number | string) => {
    if (!selectedService) return;
    if (esPico) remote.establecerEntrada(selectedService.id, valor);
    else inyectarEntrada(selectedService.id, valor);
  };

  const activarPico = () => remote.activarSesion(modeloId, Number(version));
  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(remote.obtenerEnlaceSesion());
      useRemoteExecutionStore.setState({ mensaje: 'Enlace de la sesión copiado. Ábrelo en los otros navegadores.' });
    } catch {
      useRemoteExecutionStore.setState({ mensaje: `Comparte este enlace: ${remote.obtenerEnlaceSesion()}` });
    }
  };

  return (
    <section className={`simulation-panel ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="Control de simulación" aria-busy={ocupado}>
      <button className="simulation-panel__header" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>
          <i className="simulation-panel__status" style={{ backgroundColor: getStatusColor(), opacity: 1, borderColor: getStatusColor() }} />
          Motor {esPico ? 'Pico' : 'local'}
        </span>
        <strong>{expanded ? '−' : '+'}</strong>
      </button>

      {expanded && (
        <div className="simulation-panel__body">
          <div className="simulation-panel__mode" role="group" aria-label="Motor de ejecución">
            <button type="button" className={!esPico ? 'is-active' : ''} onClick={remote.desactivar}>Local</button>
            <button type="button" className={esPico ? 'is-active' : ''} onClick={activarPico}>Pico / MQTT</button>
          </div>

          {esPico && (
            <div className="simulation-panel__remote">
              <p className="simulation-panel__intro">
                Todos los navegadores que usen el mismo modelo y versión aplicarán el estado oficial publicado por la Pico.
                El enlace comparte la sesión, no el diagrama: importa el mismo archivo JSON en cada navegador.
              </p>
              <div className="simulation-panel__session">
                <label>
                  <span>Modelo</span>
                  <input value={modeloId} onChange={(event) => setModeloId(event.target.value)} />
                </label>
                <label>
                  <span>Versión</span>
                  <input type="number" min="1" step="1" value={version} onChange={(event) => setVersion(event.target.value)} />
                </label>
              </div>
              <div className="simulation-panel__controls">
                <button type="button" onClick={activarPico}>{remote.sesionActiva ? 'Reintentar conexión' : 'Unirse'}</button>
                <button type="button" onClick={copiarEnlace} disabled={!remote.sesionActiva}>Copiar enlace</button>
              </div>
              <button className="simulation-panel__load" type="button" onClick={remote.cargarModeloActual} disabled={!remote.sesionActiva || remote.mqttEstado !== 'CONNECTED'}>
                Compilar y cargar circuito en la Pico
              </button>
              <div className="simulation-panel__state">
                <div><span>Sesión</span><strong>{remote.sesionActiva ? 'ACTIVA' : 'INACTIVA'}</strong></div>
                <div><span>MQTT</span><strong>{remote.mqttEstado}</strong></div>
                <div><span>Modelo</span><strong>{remote.modeloAceptado === null ? 'Sin confirmar' : remote.modeloAceptado ? 'Aceptado' : 'Rechazado'}</strong></div>
                <div><span>Secuencia</span><strong>{remote.secuencia < 0 ? '—' : remote.secuencia}</strong></div>
              </div>
              {remote.mensaje && (
                <p className="simulation-panel__feedback" role="status" aria-live="polite">{remote.mensaje}</p>
              )}
            </div>
          )}

          <div className="simulation-panel__status-row">
            <span>Estado</span>
            <strong style={{ color: getStatusColor() }}>{(esPico ? remote.estadoRemoto ?? 'sin_modelo' : estado).toUpperCase()}</strong>
          </div>

          {ocupado && !esPico && (
            <div className="simulation-panel__loading" role="status" aria-live="polite">
              <span className="simulation-panel__spinner" aria-hidden="true" />
              <span>{operacion === 'paso' ? 'Procesando el siguiente paso…' : 'Ejecutando el circuito…'}</span>
            </div>
          )}

          {servicios.length > 0 ? (
            <>
              <label className="simulation-panel__service">
                <span>Service</span>
                <select value={selectedService?.id ?? ''} onChange={(event) => setSelectedServiceId(event.target.value)}>
                  {servicios.map((service) => <option key={service.id} value={service.id}>{service.nombre}</option>)}
                </select>
              </label>

              {selectedService?.tipoDato === 'boolean' ? (
                <div className="simulation-panel__controls">
                  <button type="button" disabled={ocupado || (esPico && !remote.sesionActiva)} onClick={() => enviarEntrada(false)}>Enviar 0</button>
                  <button type="button" className="is-primary" disabled={ocupado || (esPico && !remote.sesionActiva)} onClick={() => enviarEntrada(true)}>Enviar 1</button>
                </div>
              ) : selectedService?.tipoDato === 'integer' || selectedService?.tipoDato === 'real' ? (
                <div className="simulation-panel__numeric-control">
                  <input type="number" step="any" value={numericValue} placeholder="Ej.: 42" onChange={(event) => setNumericValue(event.target.value)} />
                  <button type="button" className="is-primary" disabled={ocupado || numericValue.trim() === '' || (esPico && !remote.sesionActiva)} onClick={() => enviarEntrada(selectedService.tipoDato === 'integer' ? Math.trunc(Number(numericValue)) : Number(numericValue))}>Enviar</button>
                </div>
              ) : (
                <div className="simulation-panel__numeric-control">
                  <input type="text" value={textValue} placeholder="Valor de texto" onChange={(event) => setTextValue(event.target.value)} />
                  <button type="button" className="is-primary" disabled={ocupado || textValue.length === 0 || (esPico && !remote.sesionActiva)} onClick={() => enviarEntrada(textValue)}>Enviar</button>
                </div>
              )}
            </>
          ) : (
            <p className="simulation-panel__empty">Agrega un Service con salida para inyectar datos.</p>
          )}

          <div className="simulation-panel__actions">
            <button type="button" onClick={() => esPico ? remote.enviarComando('paso') : void paso()} disabled={ocupado || estado === 'error' || (esPico ? !remote.sesionActiva : estado === 'inactiva')}>
              {ocupado && operacion === 'paso' ? 'Procesando…' : '▶ Paso'}
            </button>
            <button type="button" className="is-primary" onClick={() => esPico ? remote.enviarComando('iniciar') : void ejecutar()} disabled={ocupado || estado === 'error' || (esPico ? !remote.sesionActiva : estado === 'inactiva')}>
              {ocupado && operacion === 'ejecucion' ? 'Ejecutando…' : '⏩ Ejecutar'}
            </button>
            {esPico && (
              <button type="button" onClick={() => remote.enviarComando('detener')} disabled={!remote.sesionActiva}>
                ■ Detener
              </button>
            )}
          </div>
          <button className="simulation-panel__reset" type="button" onClick={() => esPico ? remote.enviarComando('reiniciar') : reiniciar()} disabled={ocupado || (esPico && !remote.sesionActiva)}>
            ↺ Reiniciar
          </button>

          {!esPico && (
            <div className="simulation-panel__events">
              <h4>Eventos recientes</h4>
              {recentEvents.length === 0 ? <p>No hay eventos.</p> : recentEvents.map((event) => (
                <div key={event.id}>
                  <code>#{event.indice} {event.tipo} · paso {event.paso}</code>
                  <span>{event.mensaje}</span>
                </div>
              ))}
            </div>
          )}

          {!esPico && mensajeMotor && (
            <p className="simulation-panel__feedback" aria-live="polite">{mensajeMotor}</p>
          )}
        </div>
      )}
    </section>
  );
};
