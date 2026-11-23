import React, { useMemo, useState } from 'react';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { HilesElementType, type PortDataType } from '../../types/hiles';
import { enfocarElemento } from '../collaboration/focus';
import { agregarSnapshots, etiquetaEjecutor, type NodoHiles } from '../distributed/assignments';
import { useControlEjecucionDistribuida } from '../distributed/useFaseDistribuida';
import { HelpHint } from '../onboarding/HelpHint';
import { resumirEstadoElemento } from './elementStateSummary';
import './simulation.css';

interface ServicioDisponible {
  id: string;
  nombre: string;
  tipoDato: PortDataType;
}

const parsearValorLibre = (texto: string): unknown => {
  const limpio = texto.trim();
  if (limpio === '') return '';
  try {
    return JSON.parse(limpio);
  } catch {
    return limpio;
  }
};

export interface SimulationPanelProps {
  embedded?: boolean;
  onOpenDistributed?: () => void;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  embedded = false,
  onOpenDistributed,
}) => {
  const nodos = useEditorStore((state) => state.nodes) as NodoHiles[];
  const manifest = useDistributedExecutionStore((state) => state.manifest);
  const snapshots = useDistributedExecutionStore((state) => state.snapshots);
  const ejecutores = useDistributedExecutionStore((state) => state.ejecutores);
  const local = useDistributedExecutionStore((state) => state.workerExecutorId);
  const enviarEntradaStore = useDistributedExecutionStore((state) => state.enviarEntrada);
  const controlEjecucion = useControlEjecucionDistribuida();
  const { fase } = controlEjecucion;

  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [numericValue, setNumericValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [feedbackEntrada, setFeedbackEntrada] = useState<string | null>(null);

  const servicios = useMemo<ServicioDisponible[]>(() => (
    nodos
      .filter(
        (nodo) =>
          nodo.data.hilesType === HilesElementType.SERVICE
          && nodo.data.ports.some((puerto) => puerto.direction === 'output'),
      )
      .map((nodo) => ({
        id: nodo.id,
        nombre: nodo.data.name,
        tipoDato: nodo.data.ports.find((puerto) => puerto.direction === 'output')?.dataType ?? 'real',
      }))
  ), [nodos]);

  const nombres = useMemo(() => new Map(nodos.map((nodo) => [nodo.id, nodo.data.name])), [nodos]);
  const vistaAgregada = useMemo(
    () => agregarSnapshots(manifest, snapshots, ejecutores),
    [manifest, snapshots, ejecutores],
  );

  const selectedService = servicios.find((service) => service.id === selectedServiceId) ?? servicios[0];
  const propietarioService = selectedService && manifest ? manifest.owners[selectedService.id] ?? null : null;
  const puedeInyectar = Boolean(
    selectedService
    && propietarioService
    && (fase.fase === 'listo' || fase.fase === 'ejecutando'),
  );

  const enviarEntrada = (valor: unknown) => {
    if (!selectedService) return;
    const ok = enviarEntradaStore(selectedService.id, valor);
    if (ok) {
      setFeedbackEntrada(
        `Entrada ${JSON.stringify(valor)} enviada a «${selectedService.nombre}» (${etiquetaEjecutor(propietarioService, local)}).`,
      );
    } else {
      setFeedbackEntrada('No se pudo publicar la entrada: verifica la conexión MQTT y el despliegue activo.');
    }
  };

  return (
    <section
      className={`simulation-panel ${embedded ? 'is-embedded' : ''}`}
      data-tour="panel-entradas"
      aria-label="Entradas y estado de ejecución"
    >
      <div className="simulation-panel__body">
        <div className="simulation-panel__phase">
          <div className="simulation-panel__status-row">
            <span>Ejecución</span>
            <span className={`phase-badge is-${fase.fase}`} role="status" aria-live="polite">
              <i aria-hidden="true" />
              {fase.etiqueta}
            </span>
          </div>
          <p className="simulation-panel__intro">{fase.detalle}</p>
          <p className="simulation-panel__hint">
            Opera el circuito desde los controles globales únicos de la barra superior (<strong>Iniciar</strong>, <strong>Paso</strong>, <strong>Detener</strong> y <strong>Reiniciar</strong>).
          </p>
          {!manifest && onOpenDistributed && (
            <button type="button" className="btn btn--primary simulation-panel__open-executors" onClick={onOpenDistributed}>
              Abrir Ejecutores para desplegar
            </button>
          )}
        </div>

        <section className="simulation-panel__section" aria-labelledby="sim-entradas-heading">
          <h4 id="sim-entradas-heading">
            Inyección por Services
            <HelpHint
              titulo="Entradas por Services"
              texto="Selecciona un Service con puerto de salida para enviar un valor al ejecutor propietario (Pico o navegador) sin abrir herramientas técnicas."
            />
          </h4>

          {servicios.length > 0 && selectedService ? (
            <>
              <label className="simulation-panel__service">
                <span>Service</span>
                <select value={selectedService.id} onChange={(event) => setSelectedServiceId(event.target.value)}>
                  {servicios.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.nombre} ({service.tipoDato})
                    </option>
                  ))}
                </select>
              </label>

              <p className="simulation-panel__owner">
                Destino actual:{' '}
                <strong>
                  {propietarioService
                    ? etiquetaEjecutor(propietarioService, local)
                    : 'Sin desplegar en la época activa'}
                </strong>
              </p>

              {selectedService.tipoDato === 'boolean' ? (
                <div className="simulation-panel__controls">
                  <button type="button" disabled={!puedeInyectar} onClick={() => enviarEntrada(false)}>
                    Enviar 0 (false)
                  </button>
                  <button type="button" className="is-primary" disabled={!puedeInyectar} onClick={() => enviarEntrada(true)}>
                    Enviar 1 (true)
                  </button>
                </div>
              ) : selectedService.tipoDato === 'integer' || selectedService.tipoDato === 'real' ? (
                <div className="simulation-panel__numeric-control">
                  <input
                    type="number"
                    step={selectedService.tipoDato === 'integer' ? '1' : 'any'}
                    value={numericValue}
                    placeholder={selectedService.tipoDato === 'integer' ? 'Ej.: 42' : 'Ej.: 3.5'}
                    aria-label={`Valor numérico para ${selectedService.nombre}`}
                    onChange={(event) => setNumericValue(event.target.value)}
                  />
                  <button
                    type="button"
                    className="is-primary"
                    disabled={!puedeInyectar || numericValue.trim() === ''}
                    onClick={() => enviarEntrada(
                      selectedService.tipoDato === 'integer'
                        ? Math.trunc(Number(numericValue))
                        : Number(numericValue),
                    )}
                  >
                    Enviar
                  </button>
                </div>
              ) : selectedService.tipoDato === 'string' ? (
                <div className="simulation-panel__numeric-control">
                  <input
                    type="text"
                    value={textValue}
                    placeholder="Valor de texto"
                    aria-label={`Valor de texto para ${selectedService.nombre}`}
                    onChange={(event) => setTextValue(event.target.value)}
                  />
                  <button
                    type="button"
                    className="is-primary"
                    disabled={!puedeInyectar || textValue.length === 0}
                    onClick={() => enviarEntrada(textValue)}
                  >
                    Enviar
                  </button>
                </div>
              ) : (
                <div className="simulation-panel__numeric-control">
                  <input
                    type="text"
                    value={textValue}
                    placeholder='Valor JSON, ej. [1, 2]'
                    aria-label={`Valor para ${selectedService.nombre}`}
                    onChange={(event) => setTextValue(event.target.value)}
                  />
                  <button
                    type="button"
                    className="is-primary"
                    disabled={!puedeInyectar || textValue.trim() === ''}
                    onClick={() => enviarEntrada(parsearValorLibre(textValue))}
                  >
                    Enviar
                  </button>
                </div>
              )}

              {!puedeInyectar && (
                <p className="simulation-panel__empty">
                  Despliega el modelo y espera los ACK en «Ejecutores» para habilitar el envío de entradas.
                </p>
              )}

              {feedbackEntrada && (
                <p className="simulation-panel__feedback" role="status" aria-live="polite">
                  {feedbackEntrada}
                </p>
              )}
            </>
          ) : (
            <p className="simulation-panel__empty">
              Agrega un elemento <strong>Service</strong> con puerto de salida para inyectar datos al circuito.
            </p>
          )}
        </section>

        <section className="simulation-panel__section" aria-labelledby="sim-estado-heading">
          <h4 id="sim-estado-heading">
            Estado agregado
            <HelpHint
              titulo="Estado agregado"
              texto="Combina los snapshots publicados por cada Pico y navegador en la época activa. Si un ejecutor cae, sus elementos quedan marcados como obsoletos."
            />
          </h4>
          {vistaAgregada.length === 0 ? (
            <p className="simulation-panel__empty">
              Sin snapshots todavía. Despliega el modelo para inspeccionar valores y tokens en tiempo real.
            </p>
          ) : (
            <ul className="simulation-panel__aggregate">
              {vistaAgregada.map((item) => (
                <li key={item.elementId} className={item.obsoleto ? 'is-stale' : ''}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => enfocarElemento(item.elementId, true)}
                  >
                    {nombres.get(item.elementId) ?? item.elementId}
                  </button>
                  <span className="simulation-panel__executor-tag">
                    {etiquetaEjecutor(item.executorId, local)}
                  </span>
                  <code className="simulation-panel__element-value">
                    {resumirEstadoElemento(item.estado)}
                  </code>
                  {item.obsoleto && <span className="state-pill is-offline">Obsoleto</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
};
