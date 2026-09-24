import React, { useState } from 'react';
import { useSimulationStore } from '../../stores/useSimulationStore';
import './simulation.css';

export const SimulationPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [numericValue, setNumericValue] = useState('');
  const [textValue, setTextValue] = useState('');

  const { estado, eventos, servicios, mensaje, inyectarEntrada, paso, ejecutar, reiniciar } = useSimulationStore();

  const selectedService = servicios.find(s => s.id === selectedServiceId) ?? servicios[0];

  // Mostrar los últimos 10 eventos, el más reciente arriba
  const recentEvents = eventos.slice().reverse().slice(0, 10);

  const getStatusColor = () => {
    switch (estado) {
      case 'lista': return '#3b82f6';
      case 'ejecutando': return '#eab308';
      case 'estabilizada': return '#22c55e';
      case 'error': return '#ef4444';
      default: return '#94a3b8'; // inactiva
    }
  };

  return (
    <section className={`simulation-panel ${expanded ? 'is-expanded' : 'is-collapsed'}`} aria-label="Simulación del motor local">
      <button className="simulation-panel__header" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>
          <i className="simulation-panel__status" style={{ backgroundColor: getStatusColor(), opacity: 1, borderColor: getStatusColor() }} />
          Motor local
        </span>
        <strong>{expanded ? '−' : '+'}</strong>
      </button>
      
      {expanded && (
        <div className="simulation-panel__body">
          {/* Indicador de Estado */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Estado</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: getStatusColor() }}>{estado.toUpperCase()}</span>
          </div>

          {/* Selector de Entrada */}
          {servicios.length > 0 ? (
            <>
              <label className="simulation-panel__service">
                <span>Service</span>
                <select value={selectedService?.id ?? ''} onChange={(e) => setSelectedServiceId(e.target.value)}>
                  {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>

              {selectedService?.tipoDato === 'boolean' ? (
                <div className="simulation-panel__controls">
                  <button type="button" onClick={() => inyectarEntrada(selectedService.id, false)}>Enviar 0</button>
                  <button type="button" className="is-primary" onClick={() => inyectarEntrada(selectedService.id, true)}>Enviar 1</button>
                </div>
              ) : selectedService?.tipoDato === 'integer' || selectedService?.tipoDato === 'real' ? (
                <div className="simulation-panel__numeric-control">
                  <input type="number" step="any" value={numericValue} placeholder="Ej.: 42" onChange={(e) => setNumericValue(e.target.value)} />
                  <button type="button" className="is-primary" disabled={numericValue.trim() === ''} onClick={() => inyectarEntrada(selectedService.id, selectedService.tipoDato === 'integer' ? Math.trunc(Number(numericValue)) : Number(numericValue))}>Enviar</button>
                </div>
              ) : (
                <div className="simulation-panel__numeric-control">
                  <input type="text" value={textValue} placeholder="Valor de texto" onChange={(e) => setTextValue(e.target.value)} />
                  <button type="button" className="is-primary" disabled={textValue.length === 0} onClick={() => inyectarEntrada(selectedService.id, textValue)}>Enviar</button>
                </div>
              )}
            </>
          ) : (
            <p className="simulation-panel__empty">Agrega un Service con salida para inyectar datos.</p>
          )}

          {/* Botones de Control de Simulación */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '16px 0' }}>
            <button 
              style={{ padding: '6px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }} 
              onClick={paso} 
              disabled={estado === 'inactiva' || estado === 'error'}
            >
              ▶ Paso
            </button>
            <button 
              style={{ padding: '6px', fontSize: 11, borderRadius: 4, border: '1px solid #bae6fd', background: '#e0f2fe', color: '#0284c7', cursor: 'pointer', fontWeight: 700 }} 
              onClick={ejecutar} 
              disabled={estado === 'inactiva' || estado === 'error'}
            >
              ⏩ Ejecutar
            </button>
          </div>
          <button 
            style={{ width: '100%', padding: '6px', fontSize: 11, borderRadius: 4, border: '1px solid #fecaca', background: '#fff1f2', color: '#be123c', cursor: 'pointer' }} 
            onClick={reiniciar}
          >
            ↺ Reiniciar
          </button>

          {/* Visor de Eventos */}
          <div className="simulation-panel__events">
            <h4 style={{ margin: '16px 0 8px', fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>Eventos recientes</h4>
            {recentEvents.length === 0 ? <p style={{ fontSize: 11, color: '#94a3b8' }}>No hay eventos.</p> : (
              <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                {recentEvents.map((evt) => (
                  <div key={evt.id} style={{ fontSize: 10, lineHeight: 1.4, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a' }}>
                      <strong>#{evt.indice} {evt.tipo}</strong>
                      <span style={{ color: '#94a3b8', fontSize: 9 }}>paso {evt.paso}</span>
                    </div>
                    <div style={{ color: '#475569', marginTop: 2 }}>{evt.mensaje}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mensaje de Feedback */}
          {mensaje && (
            <p style={{ marginTop: 12, padding: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 11, color: '#0f172a' }}>
              {mensaje}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
