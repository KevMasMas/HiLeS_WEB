import React, { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { HilesElementType } from '../../types/hiles';
import { enfocarElemento } from '../collaboration/focus';
import { HelpHint } from '../onboarding/HelpHint';
import { PicoSetupPanel } from '../setup/PicoSetupPanel';
import { resumirEstadoElemento } from '../simulation/elementStateSummary';
import { AssignmentSelector } from './AssignmentSelector';
import {
  ETIQUETA_ESTADO_EJECUTOR,
  agregarSnapshots,
  construirMapaAsignaciones,
  ejecutablesSinDestino,
  etiquetaEjecutor,
  recomendacionError,
  validarDestinosDespliegue,
  type NodoHiles,
} from './assignments';
import { useControlEjecucionDistribuida } from './useFaseDistribuida';
import './distributed.css';

interface DistributedPanelProps {
  onClose: () => void;
  onOpenInputs?: () => void;
  onOpenConnection?: () => void;
}

const haceCuanto = (ms: number | undefined): string => {
  if (!ms) return 'sin datos';
  const segundos = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (segundos < 5) return 'ahora';
  if (segundos < 60) return `hace ${segundos} s`;
  return `hace ${Math.round(segundos / 60)} min`;
};

export const DistributedPanel: React.FC<DistributedPanelProps> = ({
  onClose,
  onOpenInputs,
  onOpenConnection,
}) => {
  const nodos = useEditorStore((state) => state.nodes) as NodoHiles[];
  const store = useDistributedExecutionStore();
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const intervalo = window.setInterval(() => setAhora(Date.now()), 5_000);
    return () => window.clearInterval(intervalo);
  }, []);

  const mapa = useMemo(() => construirMapaAsignaciones(nodos), [nodos]);
  const sinDestino = useMemo(() => ejecutablesSinDestino(nodos), [nodos]);
  const ejecutores = useMemo(
    () => Object.values(store.ejecutores).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.executor_id.localeCompare(b.executor_id)),
    [store.ejecutores],
  );
  const manifest = store.manifest;
  const controlEjecucion = useControlEjecucionDistribuida();
  const fase = controlEjecucion.fase;
  const vista = agregarSnapshots(manifest, store.snapshots, store.ejecutores);
  const nombres = new Map(nodos.map((nodo) => [nodo.id, nodo.data.name]));
  const cantidadServiciosEntrada = useMemo(
    () => nodos.filter(
      (nodo) =>
        nodo.data.hilesType === HilesElementType.SERVICE
        && nodo.data.ports.some((puerto) => puerto.direction === 'output'),
    ).length,
    [nodos],
  );
  const local = store.workerExecutorId;
  const erroresDestino = useMemo(() => validarDestinosDespliegue(nodos, store.ejecutores, {
    projectId: store.projectId ?? '',
    vistoEn: store.vistoEn,
    ahora,
  }), [ahora, nodos, store.ejecutores, store.projectId, store.vistoEn]);
  const listoParaDesplegar = store.conectado && !store.desplegando && nodos.length > 0 && erroresDestino.length === 0;

  return (
    <aside className="dist-panel" aria-label="Ejecutores y despliegue">
      <header className="dist-panel__header">
        <div>
          <h2>Ejecutores y despliegue</h2>
          <span className={`phase-badge is-${fase.fase}`} role="status" aria-live="polite" title={fase.detalle}>
            <i aria-hidden="true" />{fase.etiqueta}
          </span>
        </div>
        <button type="button" className="dist-panel__close" aria-label="Cerrar panel de ejecutores" onClick={onClose}>×</button>
      </header>
      <p className="dist-panel__phase-detail">{fase.detalle}</p>

      <section className="dist-section" aria-labelledby="dist-local">
        <h3 id="dist-local">
          Worker de este navegador
          <HelpHint titulo="Ejecutar en este navegador" texto="Ofrece esta pestaña como ejecutor de bloques. Es independiente de colaborar y del modo de conexión (Local/LAN o Remoto): puedes editar sin ejecutar." />
        </h3>
        <label className="toggle" data-tour="ejecutar-aqui">
          <input type="checkbox" checked={store.workerHabilitado} onChange={(evento) => store.habilitarWorker(evento.target.checked)} />
          <span>Ejecutar aquí los bloques asignados a «Este navegador»</span>
        </label>
        <p className="dist-muted">
          Identidad del ejecutor: <code>{local ?? '—'}</code>
          {store.workerHabilitado && store.workerStats && <> · {ETIQUETA_ESTADO_EJECUTOR[store.workerStats.estado]} · {store.workerStats.ownedElementIds.length} elemento(s)</>}
        </p>
      </section>

      <section className="dist-section" aria-labelledby="dist-ejecutores">
        <h3 id="dist-ejecutores">
          Ejecutores disponibles
          <HelpHint titulo="Ejecutores" texto="Cada Raspberry Pi Pico W o navegador conectado al mismo proyecto aparece aquí con su identidad, estado, memoria libre y despliegue activo." />
        </h3>
        <p className="dist-muted">Proyecto de ejecución: <code>{store.projectId ?? '—'}</code>. Las Pico deben usar exactamente este <code>HILES_PROJECT_ID</code>.</p>
        {!store.conectado && (
          <div className="empty-state">
            <p style={{ margin: '0 0 6px' }}>Sin conexión con el broker MQTT. Revisa el perfil Local/LAN o Remoto en Conexión.</p>
            {onOpenConnection && (
              <button type="button" className="link-button" onClick={onOpenConnection}>
                Configurar conexión MQTT
              </button>
            )}
          </div>
        )}
        {store.conectado && ejecutores.length === 0 && (
          <p className="empty-state">Todavía no hay ejecutores. Activa «Ejecutar aquí» o enciende una Pico W configurada con este proyecto.</p>
        )}
        <ul className="executor-list">
          {ejecutores.map((ejecutor) => (
            <li key={ejecutor.executor_id} className={`executor-card is-${ejecutor.estado}`}>
              <span className="executor-card__icon" aria-hidden="true">{ejecutor.tipo === 'pico' ? '▣' : '◧'}</span>
              <span className="executor-card__body">
                <strong>{etiquetaEjecutor(ejecutor.executor_id, local)}</strong>
                <span className={`state-pill is-${ejecutor.estado}`}>{ETIQUETA_ESTADO_EJECUTOR[ejecutor.estado]}</span>
                <small>
                  {ejecutor.board_model && <>{ejecutor.board_model} · </>}
                  {(ejecutor.firmware_version ?? ejecutor.version) && <>Firmware {ejecutor.firmware_version ?? ejecutor.version} · </>}
                  {ejecutor.capacidades.memoria_libre_bytes !== undefined && <>Memoria libre {Math.round(ejecutor.capacidades.memoria_libre_bytes / 1024)} KB · </>}
                  {ejecutor.active_deployment_id ? <>Época {ejecutor.active_epoch} · </> : 'Sin fragmento · '}
                  Actividad {haceCuanto(store.vistoEn[ejecutor.executor_id])}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dist-section" data-tour="preparar-pico" aria-labelledby="dist-pico-setup">
        <h3 id="dist-pico-setup">Configuración de placas</h3>
        <PicoSetupPanel projectId={store.projectId ?? ''} />
      </section>

      <section className="dist-section" data-tour="mapa-asignaciones" aria-labelledby="dist-mapa">
        <h3 id="dist-mapa">
          Destino por bloque
          <HelpHint titulo="Destino de ejecución" texto="Elige en qué Pico o navegador corre cada Structural Block. Sus elementos heredan el destino; un Functional Block puede sobreescribirlo cuando sea necesario." />
        </h3>
        {mapa.length === 0 && <p className="empty-state">El modelo no tiene bloques que asignar. Agrega un Structural Block desde «Elementos».</p>}
        <ul className="assignment-map">
          {mapa.map((fila) => (
            <li key={fila.nodoId} className="assignment-row" style={{ paddingLeft: 8 + fila.nivel * 16 }}>
              <button type="button" className="assignment-row__name" onClick={() => enfocarElemento(fila.nodoId, true)} title="Mostrar en el lienzo">
                <span aria-hidden="true">{fila.tipo === HilesElementType.STRUCTURAL_BLOCK ? '▢' : '◇'}</span> {fila.nombre}
              </button>
              {fila.asignable ? (
                <AssignmentSelector
                  valor={fila.destinoPropio}
                  ejecutores={store.ejecutores}
                  executorLocal={local}
                  workerLocalActivo={store.workerHabilitado}
                  projectId={store.projectId ?? ''}
                  vistoEn={store.vistoEn}
                  ahora={ahora}
                  etiqueta={`Destino de ${fila.nombre}`}
                  heredado={fila.efectivo.origen === 'heredado' ? fila.efectivo.executorId : null}
                  onChange={(executorId) => store.asignar(fila.nodoId, executorId)}
                />
              ) : (
                <span className="dist-muted">{etiquetaEjecutor(fila.efectivo.executorId, local)}</span>
              )}
              {fila.sinAsignarInternos > 0 && <small className="assignment-row__warn">{fila.sinAsignarInternos} elemento(s) sin destino</small>}
            </li>
          ))}
        </ul>
      </section>

      <section className="dist-section" aria-labelledby="dist-despliegue">
        <h3 id="dist-despliegue">
          Despliegue
          <HelpHint titulo="Desplegar" texto="Desplegar compila el modelo, lo divide en un fragmento por ejecutor y espera la confirmación (ACK) de todos. Después se opera desde la barra superior." />
        </h3>
        {sinDestino.length > 0 && (
          <div className="callout callout--warn">
            <strong>{sinDestino.length} elemento(s) sin ejecutor.</strong> Asigna su bloque antes de desplegar.
            <button type="button" className="link-button" onClick={() => enfocarElemento(sinDestino[0].id, true)}>Ver el primero</button>
          </div>
        )}
        {sinDestino.length === 0 && erroresDestino.length > 0 && (
          <div className="callout callout--warn" role="status">
            <strong>No se puede desplegar todavía.</strong> {erroresDestino[0].mensaje}
          </div>
        )}
        <div className="button-row">
          <button
            type="button"
            data-tour="desplegar"
            className="btn btn--primary"
            disabled={!listoParaDesplegar}
            onClick={() => void store.desplegar()}
          >
            {store.desplegando ? 'Desplegando…' : manifest ? 'Volver a desplegar' : 'Desplegar'}
          </button>
          <button type="button" className="btn" disabled={!manifest} onClick={store.retirarDespliegue}>Retirar</button>
          {manifest && cantidadServiciosEntrada > 0 && onOpenInputs && (
            <button type="button" className="btn" onClick={onOpenInputs}>
              Abrir Entradas ({cantidadServiciosEntrada})
            </button>
          )}
        </div>
        {manifest && (
          <ul className="fragment-list" aria-label="Fragmentos del despliegue">
            {manifest.fragments.map((fragmento) => {
              const ack = store.acks[fragmento.executor_id];
              const estado = !ack || ack.epoch !== manifest.epoch ? 'pendiente' : ack.accepted ? 'aceptado' : 'rechazado';
              return (
                <li key={fragmento.fragment_id} className={`fragment-item is-${estado}`}>
                  <strong>{etiquetaEjecutor(fragmento.executor_id, local)}</strong>
                  <span>{fragmento.element_ids.length} elemento(s) · {fragmento.size_bytes} B</span>
                  <span className="state-pill">{estado === 'pendiente' ? 'Esperando ACK' : estado === 'aceptado' ? 'ACK recibido' : 'Rechazado'}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="dist-muted">
          Controles únicos de ejecución en la barra superior: <strong>Iniciar</strong>, <strong>Paso</strong>, <strong>Detener</strong> y <strong>Reiniciar</strong>.
        </p>
        {store.mensaje && <p className="dist-muted" role="status">{store.mensaje}</p>}
      </section>

      <section className="dist-section" aria-labelledby="dist-estado">
        <h3 id="dist-estado">
          Resumen por propietario
          <HelpHint titulo="Estado agregado" texto="Cada ejecutor publica solo sus propios elementos. Un ejecutor desconectado deja sus elementos marcados como obsoletos." />
        </h3>
        {vista.length === 0 && <p className="empty-state">Sin datos todavía. Despliega el modelo para ver el estado de cada elemento.</p>}
        <ul className="aggregate-list">
          {vista.map((item) => (
            <li key={item.elementId} className={item.obsoleto ? 'is-stale' : ''}>
              <button type="button" className="link-button" onClick={() => enfocarElemento(item.elementId, true)}>{nombres.get(item.elementId) ?? item.elementId}</button>
              <span className="dist-muted">{etiquetaEjecutor(item.executorId, local)}</span>
              <span>{resumirEstadoElemento(item.estado)}</span>
              {item.obsoleto && <span className="state-pill is-offline">Obsoleto</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="dist-section" aria-labelledby="dist-errores">
        <h3 id="dist-errores">
          Diagnóstico
          {store.errores.length > 0 && <button type="button" className="link-button" onClick={store.limpiarErrores}>Limpiar</button>}
        </h3>
        {store.errorLocal && <div className="callout callout--error" role="alert">{store.errorLocal}</div>}
        {store.errores.length === 0 && !store.errorLocal && <p className="empty-state">Sin errores. Los rechazos y fallos de canales aparecerán aquí con una recomendación.</p>}
        <ul className="error-list">
          {store.errores.map((error) => (
            <li key={error.id} className="error-item">
              <strong>{error.codigo}</strong>
              <span>{error.mensaje}</span>
              <em>Qué hacer: {recomendacionError(error.codigo)}</em>
              <small>
                {error.executorId && <>Ejecutor {etiquetaEjecutor(error.executorId, local)} · </>}
                {error.etapa && <>Etapa {error.etapa}</>}
              </small>
              {error.elementId && nombres.has(error.elementId) && (
                <button type="button" className="link-button" onClick={() => enfocarElemento(error.elementId!, true)}>Ir a {nombres.get(error.elementId)}</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
};
