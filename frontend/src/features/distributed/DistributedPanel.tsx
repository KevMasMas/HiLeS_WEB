import React, { useMemo, useState } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { HilesElementType } from '../../types/hiles';
import { enfocarElemento } from '../collaboration/focus';
import { HelpHint } from '../onboarding/HelpHint';
import { AssignmentSelector } from './AssignmentSelector';
import {
  ETIQUETA_ESTADO_EJECUTOR,
  agregarSnapshots,
  construirMapaAsignaciones,
  ejecutablesSinDestino,
  etiquetaEjecutor,
  recomendacionError,
  type NodoHiles,
} from './assignments';
import { useFaseDistribuida } from './useFaseDistribuida';
import './distributed.css';

interface DistributedPanelProps {
  onClose: () => void;
}

const haceCuanto = (ms: number | undefined): string => {
  if (!ms) return 'sin datos';
  const segundos = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (segundos < 5) return 'ahora';
  if (segundos < 60) return `hace ${segundos} s`;
  return `hace ${Math.round(segundos / 60)} min`;
};

const resumirEstado = (estado: Record<string, unknown> | null): string => {
  if (!estado) return 'sin datos';
  const partes: string[] = [];
  const valor = estado.valor ?? estado.salida ?? estado.valor_retenido;
  if (valor !== undefined) partes.push(`valor ${JSON.stringify(valor)}`);
  if (typeof estado.tokens === 'number') partes.push(`${estado.tokens} token(s)`);
  if (estado.disparada === true) partes.push('disparó');
  if (estado.habilitada === true) partes.push('habilitada');
  if (estado.evento_pendiente === true) partes.push('evento');
  if (typeof estado.error === 'string') partes.push(`error ${estado.error}`);
  return partes.join(' · ') || 'en reposo';
};

const parsearValor = (texto: string): unknown => {
  const limpio = texto.trim();
  if (limpio === '') return '';
  try {
    return JSON.parse(limpio);
  } catch {
    return limpio;
  }
};

export const DistributedPanel: React.FC<DistributedPanelProps> = ({ onClose }) => {
  const nodos = useEditorStore((state) => state.nodes) as NodoHiles[];
  const store = useDistributedExecutionStore();
  const [servicio, setServicio] = useState('');
  const [valorEntrada, setValorEntrada] = useState('');

  const mapa = useMemo(() => construirMapaAsignaciones(nodos), [nodos]);
  const sinDestino = useMemo(() => ejecutablesSinDestino(nodos), [nodos]);
  const ejecutores = useMemo(
    () => Object.values(store.ejecutores).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.executor_id.localeCompare(b.executor_id)),
    [store.ejecutores],
  );
  const manifest = store.manifest;
  const ejecutandoRemoto = Boolean(manifest?.fragments.length)
    && manifest!.fragments.every((fragmento) => store.ejecutores[fragmento.executor_id]?.estado === 'running');
  const fase = useFaseDistribuida();
  const vista = agregarSnapshots(manifest, store.snapshots, store.ejecutores);
  const nombres = new Map(nodos.map((nodo) => [nodo.id, nodo.data.name]));
  const servicios = vista.filter((item) => nodos.find((nodo) => nodo.id === item.elementId)?.data.hilesType === HilesElementType.SERVICE);
  const local = store.workerExecutorId;
  const listoParaDesplegar = store.conectado && !store.desplegando && nodos.length > 0;
  const acksListos = fase.fase === 'listo' || fase.fase === 'ejecutando';

  return (
    <aside className="dist-panel" aria-label="Ejecución distribuida">
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
          Este navegador
          <HelpHint titulo="Ejecutar aquí" texto="Ofrece esta pestaña como ejecutor. Es independiente de colaborar: puedes editar sin ejecutar. La identidad del ejecutor dura mientras la pestaña esté abierta." />
        </h3>
        <label className="toggle">
          <input type="checkbox" checked={store.workerHabilitado} onChange={(evento) => store.habilitarWorker(evento.target.checked)} />
          <span>Ejecutar aquí los bloques asignados a este navegador</span>
        </label>
        <p className="dist-muted">
          Identidad del ejecutor: <code>{local ?? '—'}</code>
          {store.workerHabilitado && store.workerStats && <> · {ETIQUETA_ESTADO_EJECUTOR[store.workerStats.estado]} · {store.workerStats.ownedElementIds.length} elemento(s)</>}
        </p>
      </section>

      <section className="dist-section" aria-labelledby="dist-ejecutores">
        <h3 id="dist-ejecutores">
          Ejecutores disponibles
          <HelpHint titulo="Ejecutores" texto="Cada Raspberry Pi Pico W o navegador conectado al mismo proyecto aparece aquí con su estado, memoria y despliegue activo." />
        </h3>
        {!store.conectado && <p className="empty-state">Sin conexión con el broker. Revisa que Mosquitto esté encendido y la configuración MQTT en el panel MQTT.</p>}
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
                  {ejecutor.capacidades.memoria_libre_bytes !== undefined && <>Memoria libre {Math.round(ejecutor.capacidades.memoria_libre_bytes / 1024)} KB · </>}
                  {ejecutor.active_deployment_id ? <>Época {ejecutor.active_epoch} · </> : 'Sin fragmento · '}
                  Actividad {haceCuanto(store.vistoEn[ejecutor.executor_id])}
                </small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dist-section" aria-labelledby="dist-mapa">
        <h3 id="dist-mapa">
          Mapa de asignaciones
          <HelpHint titulo="Asignaciones" texto="Asigna cada Structural Block a un ejecutor. Sus elementos heredan el destino; un Functional Block puede sobreescribirlo. El cambio se guarda en el proyecto y todos los colaboradores lo ven." />
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
          Despliegue y ejecución
          <HelpHint titulo="Desplegar" texto="Desplegar compila el modelo, lo divide en un fragmento por ejecutor y espera la confirmación (ACK) de todos. Solo entonces se habilita Iniciar." />
        </h3>
        {sinDestino.length > 0 && (
          <div className="callout callout--warn">
            <strong>{sinDestino.length} elemento(s) sin ejecutor.</strong> Asigna su bloque antes de desplegar.
            <button type="button" className="link-button" onClick={() => enfocarElemento(sinDestino[0].id, true)}>Ver el primero</button>
          </div>
        )}
        <div className="button-row">
          <button type="button" className="btn btn--primary" disabled={!listoParaDesplegar} onClick={() => void store.desplegar()}>
            {store.desplegando ? 'Desplegando…' : manifest ? 'Volver a desplegar' : 'Desplegar'}
          </button>
          <button type="button" className="btn" disabled={!manifest} onClick={store.retirarDespliegue}>Retirar</button>
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
        <div className="button-row">
          <button type="button" className="btn" disabled={!acksListos || ejecutandoRemoto} onClick={() => store.enviarComando('start')}>▶ Iniciar</button>
          <button type="button" className="btn" disabled={!acksListos} onClick={() => store.enviarComando('step')}>⏭ Paso</button>
          <button type="button" className="btn" disabled={!acksListos} onClick={() => store.enviarComando('stop')}>■ Detener</button>
          <button type="button" className="btn" disabled={!acksListos} onClick={() => store.enviarComando('reset')}>↺ Reiniciar</button>
        </div>
        {store.mensaje && <p className="dist-muted" role="status">{store.mensaje}</p>}
      </section>

      {manifest && (
        <section className="dist-section" aria-labelledby="dist-entradas">
          <h3 id="dist-entradas">Inyectar una entrada</h3>
          {servicios.length === 0 ? (
            <p className="empty-state">El despliegue no tiene Services que acepten entradas.</p>
          ) : (
            <form
              className="input-form"
              onSubmit={(evento) => {
                evento.preventDefault();
                if (servicio) store.enviarEntrada(servicio, parsearValor(valorEntrada));
              }}
            >
              <select value={servicio} onChange={(evento) => setServicio(evento.target.value)} aria-label="Service destino">
                <option value="">Elige un Service…</option>
                {servicios.map((item) => <option key={item.elementId} value={item.elementId}>{nombres.get(item.elementId) ?? item.elementId}</option>)}
              </select>
              <input value={valorEntrada} onChange={(evento) => setValorEntrada(evento.target.value)} placeholder="Valor: 5, true, &quot;texto&quot;…" aria-label="Valor de la entrada" />
              <button type="submit" className="btn" disabled={!servicio}>Enviar</button>
            </form>
          )}
        </section>
      )}

      <section className="dist-section" aria-labelledby="dist-estado">
        <h3 id="dist-estado">
          Estado agregado
          <HelpHint titulo="Estado agregado" texto="Cada ejecutor publica solo sus propios elementos. Aquí se combinan por propietario y época; un ejecutor desconectado deja sus elementos marcados como obsoletos." />
        </h3>
        {vista.length === 0 && <p className="empty-state">Sin datos todavía. Despliega el modelo para ver el estado de cada elemento.</p>}
        <ul className="aggregate-list">
          {vista.map((item) => (
            <li key={item.elementId} className={item.obsoleto ? 'is-stale' : ''}>
              <button type="button" className="link-button" onClick={() => enfocarElemento(item.elementId, true)}>{nombres.get(item.elementId) ?? item.elementId}</button>
              <span className="dist-muted">{etiquetaEjecutor(item.executorId, local)}</span>
              <span>{resumirEstado(item.estado)}</span>
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
