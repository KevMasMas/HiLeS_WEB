import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  buildMqttWebSocketUrl,
  etiquetaModoConexionMqtt,
  getActiveMqttProfile,
  resetActiveMqttProfile,
  setActiveMqttProfile,
  subscribeMqttProfile,
  validarPerfilConexionMqtt,
  type MqttConnectionMode,
  type MqttConnectionProfile,
  type MqttWsProtocol,
} from '../../services/mqtt/config';
import { mqttClient } from '../../services/mqtt/MqttClient';
import { useDistributedExecutionStore } from '../../stores/useDistributedExecutionStore';
import { getMqttPanelPortalTarget, subscribeMqttPanelPortal } from '../editor/panelPortal';
import { HelpHint } from '../onboarding/HelpHint';
import './mqtt.css';

type MessageEntry = {
  id: string;
  topic: string;
  payload: unknown;
  receivedAt: string;
};

type IntegrationNotice = {
  id: string;
  level: 'info' | 'error';
  message: string;
};

type ConnectionFeedback = {
  level: 'pending' | 'success' | 'error' | 'neutral';
  message: string;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'CONNECTED':
      return '#16a34a';
    case 'CONNECTING':
      return '#d97706';
    case 'ERROR':
      return '#dc2626';
    default:
      return '#64748b';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'CONNECTED':
      return 'Conectado';
    case 'CONNECTING':
      return 'Conectando';
    case 'ERROR':
      return 'Error de conexión';
    default:
      return 'Desconectado';
  }
};

export const MqttPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState(mqttClient.getStatus());
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [notices, setNotices] = useState<IntegrationNotice[]>([]);
  const [connectionFeedback, setConnectionFeedback] = useState<ConnectionFeedback | null>(null);

  const activeProfile = useSyncExternalStore(
    subscribeMqttProfile,
    getActiveMqttProfile,
    getActiveMqttProfile,
  );
  const distribuidoConectado = useDistributedExecutionStore((state) => state.conectado);
  const [draft, setDraft] = useState<MqttConnectionProfile>(() => ({ ...activeProfile }));

  const dockTarget = useSyncExternalStore(subscribeMqttPanelPortal, getMqttPanelPortalTarget, () => null);

  useEffect(
    () => subscribeMqttProfile(() => setDraft({ ...getActiveMqttProfile() })),
    [],
  );

  useEffect(() => {
    const addNotice = (level: IntegrationNotice['level'], message: string) => {
      setNotices((previous) => [{
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        level,
        message,
      }, ...previous].slice(0, 5));
    };

    const unsubscribeStatus = mqttClient.onStatusChange((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus === 'CONNECTING') {
        setConnectionFeedback({ level: 'pending', message: 'Intentando conectar con el broker MQTT…' });
      } else if (nextStatus === 'CONNECTED') {
        setConnectionFeedback({ level: 'success', message: 'Conexión MQTT establecida correctamente.' });
      } else if (nextStatus === 'ERROR') {
        setConnectionFeedback({ level: 'error', message: 'No fue posible conectar con el broker. Verifica protocolo, host, puerto y credenciales.' });
      }
    });

    const unsubscribeMessage = mqttClient.onMessage((topic, payload) => {
      const entry: MessageEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        topic,
        payload,
        receivedAt: new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      setMessages((previous) => [entry, ...previous].slice(0, 8));
    });

    const unsubscribeValidation = mqttClient.onValidationError(({ error }) => addNotice('error', error));

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      unsubscribeValidation();
    };
  }, []);

  const validacion = useMemo(() => validarPerfilConexionMqtt(draft), [draft]);

  const urlVistaPrevia = useMemo(() => {
    if (validacion.errores.length > 0) return null;
    try {
      return buildMqttWebSocketUrl(draft.host.trim(), Number(draft.port), draft.path.trim(), draft.protocol);
    } catch {
      return null;
    }
  }, [draft, validacion.errores.length]);

  const cambiarModo = (mode: MqttConnectionMode) => {
    setDraft((actual) => {
      if (mode === actual.mode) return actual;
      if (mode === 'remote') {
        return {
          ...actual,
          mode: 'remote',
          protocol: 'wss',
          port: actual.port === 9001 ? 8884 : actual.port,
        };
      }
      const httpsActivo = typeof window !== 'undefined' && window.location.protocol === 'https:';
      return {
        ...actual,
        mode: 'lan',
        protocol: httpsActivo ? 'wss' : 'ws',
        port: actual.port === 8884 || actual.port === 443 ? 9001 : actual.port,
      };
    });
  };

  const aplicarYReconectar = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (validacion.errores.length > 0) return;
    try {
      const perfil = setActiveMqttProfile(draft);
      setConnectionFeedback({
        level: 'pending',
        message: `Reconectando en modo ${etiquetaModoConexionMqtt(perfil)}…`,
      });
      mqttClient.reconnect();
      useDistributedExecutionStore.getState().reconectarBroker();
    } catch (error) {
      setConnectionFeedback({
        level: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const restaurarEntorno = () => {
    const restaurado = resetActiveMqttProfile();
    setDraft({ ...restaurado });
    setConnectionFeedback({
      level: 'pending',
      message: 'Perfil restaurado a los valores iniciales del entorno; reconectando…',
    });
    mqttClient.reconnect();
    useDistributedExecutionStore.getState().reconectarBroker();
  };

  const desconectarTodo = () => {
    mqttClient.disconnect();
    useDistributedExecutionStore.getState().desconectarBroker();
    setConnectionFeedback({ level: 'neutral', message: 'Conexiones MQTT cerradas en esta pestaña.' });
  };

  const content = (
    <section
      className={dockTarget ? 'mqtt-panel is-embedded' : 'mqtt-panel'}
      data-tour="panel-conexion"
      aria-label="Modo de conexión del proyecto"
    >
      {!dockTarget && (
        <button type="button" className="mqtt-panel__header" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          <span>
            <i className="mqtt-panel__dot" style={{ background: getStatusColor(status) }} />
            Conexión {etiquetaModoConexionMqtt(activeProfile)}
          </span>
          <strong>{expanded ? '−' : '+'}</strong>
        </button>
      )}

      {(expanded || dockTarget) && (
        <div className="mqtt-panel__body">
          <div className="mqtt-panel__summary">
            <div className="mqtt-panel__status-row">
              <span>Colaboración</span>
              <span className="mqtt-panel__badge" style={{ color: getStatusColor(status), borderColor: getStatusColor(status) }}>
                {getStatusLabel(status)}
              </span>
            </div>
            <div className="mqtt-panel__status-row">
              <span>Plano de ejecutores</span>
              <span
                className="mqtt-panel__badge"
                style={{
                  color: distribuidoConectado ? '#16a34a' : '#64748b',
                  borderColor: distribuidoConectado ? '#16a34a' : '#cbd5e1',
                }}
              >
                {distribuidoConectado ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            <p className="mqtt-panel__lead">
              Define cómo este navegador alcanza el broker del proyecto. <strong>No decide dónde se ejecuta cada bloque</strong> (eso se elige por bloque en «Ejecutores»).
            </p>
          </div>

          <form className="mqtt-profile-form" onSubmit={aplicarYReconectar}>
            <div className="mqtt-profile-form__mode-header">
              <span>Modo de conexión</span>
              <HelpHint
                titulo="Local/LAN frente a Remoto"
                texto="Local/LAN conecta a un broker Mosquitto en el mismo equipo o red local. Remoto usa WebSockets seguros (wss://) y credenciales para conectar colaboradores y ejecutores a través de Internet."
              />
            </div>

            <div className="mqtt-mode-switch" role="group" aria-label="Modo de conexión del proyecto">
              <button
                type="button"
                className={draft.mode === 'lan' ? 'is-active' : ''}
                aria-pressed={draft.mode === 'lan'}
                onClick={() => cambiarModo('lan')}
              >
                Local / LAN
              </button>
              <button
                type="button"
                className={draft.mode === 'remote' ? 'is-active' : ''}
                aria-pressed={draft.mode === 'remote'}
                onClick={() => cambiarModo('remote')}
              >
                Remoto (Internet)
              </button>
            </div>

            <div className="mqtt-profile-form__grid">
              <label>
                <span>Protocolo</span>
                <select
                  value={draft.protocol}
                  onChange={(event) => setDraft((actual) => ({ ...actual, protocol: event.target.value as MqttWsProtocol }))}
                >
                  <option value="ws">ws:// (LAN)</option>
                  <option value="wss">wss:// (TLS seguro)</option>
                </select>
              </label>

              <label>
                <span>Puerto WS</span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={draft.port}
                  onChange={(event) => setDraft((actual) => ({ ...actual, port: Number(event.target.value) }))}
                />
              </label>

              <label className="mqtt-profile-form__full">
                <span>Host o IP del broker</span>
                <input
                  type="text"
                  value={draft.host}
                  placeholder={draft.mode === 'remote' ? 'mqtt.ejemplo.org' : '192.168.1.10'}
                  autoComplete="off"
                  onChange={(event) => setDraft((actual) => ({ ...actual, host: event.target.value }))}
                />
              </label>

              <label className="mqtt-profile-form__full">
                <span>Ruta WebSocket</span>
                <input
                  type="text"
                  value={draft.path}
                  placeholder="/mqtt"
                  autoComplete="off"
                  onChange={(event) => setDraft((actual) => ({ ...actual, path: event.target.value }))}
                />
              </label>

              <label>
                <span>Usuario MQTT</span>
                <input
                  type="text"
                  value={draft.username}
                  autoComplete="off"
                  onChange={(event) => setDraft((actual) => ({ ...actual, username: event.target.value }))}
                />
              </label>

              <label>
                <span>Contraseña MQTT</span>
                <input
                  type="password"
                  value={draft.password}
                  autoComplete="new-password"
                  onChange={(event) => setDraft((actual) => ({ ...actual, password: event.target.value }))}
                />
              </label>
            </div>

            {urlVistaPrevia && (
              <p className="mqtt-profile-form__preview">
                Destino: <code>{urlVistaPrevia}</code>
              </p>
            )}

            <p className="mqtt-profile-form__privacy">
              Las credenciales permanecen únicamente en la memoria de esta pestaña; no se guardan en el navegador, la URL ni el documento compartido.
            </p>

            {validacion.errores.length > 0 && (
              <div className="mqtt-connection-feedback is-error" role="alert">
                <span>{validacion.errores[0]}</span>
              </div>
            )}

            {validacion.errores.length === 0 && validacion.advertencias.map((advertencia) => (
              <div key={advertencia} className="mqtt-connection-feedback is-pending" role="status">
                <span>{advertencia}</span>
              </div>
            ))}

            <div className="mqtt-profile-form__actions">
              <button type="submit" className="btn btn--primary" disabled={validacion.errores.length > 0}>
                Aplicar y reconectar
              </button>
              <button type="button" className="btn" onClick={restaurarEntorno}>
                Restaurar entorno
              </button>
              <button
                type="button"
                className="btn"
                onClick={desconectarTodo}
                disabled={status === 'DISCONNECTED' && !distribuidoConectado}
              >
                Desconectar
              </button>
            </div>
          </form>

          {connectionFeedback && (
            <div
              className={`mqtt-connection-feedback is-${connectionFeedback.level}`}
              role={connectionFeedback.level === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {connectionFeedback.level === 'pending' && <span className="mqtt-connection-spinner" aria-hidden="true" />}
              <span>{connectionFeedback.message}</span>
            </div>
          )}

          {(notices.length > 0 || messages.length > 0) && (
            <details className="mqtt-diagnostics">
              <summary>Diagnóstico de mensajes MQTT ({notices.length + messages.length})</summary>
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  role={notice.level === 'error' ? 'alert' : 'status'}
                  className={`mqtt-connection-feedback ${notice.level === 'error' ? 'is-error' : 'is-neutral'}`}
                >
                  {notice.message}
                </div>
              ))}
              {messages.map((message) => (
                <div key={message.id} className="mqtt-message-item">
                  <div className="mqtt-message-item__header">
                    <span>{message.topic}</span>
                    <time>{message.receivedAt}</time>
                  </div>
                  <pre>{JSON.stringify(message.payload, null, 2)}</pre>
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </section>
  );

  return dockTarget ? createPortal(content, dockTarget) : content;
};
