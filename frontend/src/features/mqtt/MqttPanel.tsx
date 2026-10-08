import React, { useEffect, useState } from 'react';
import { MQTT_TOPICS } from '../../services/mqtt/config';
import { mqttClient } from '../../services/mqtt/MqttClient';

type PayloadType = string | number | boolean | Record<string, unknown> | Array<unknown> | null;

type MessageEntry = {
  id: string;
  topic: string;
  payload: PayloadType;
  receivedAt: string;
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'CONNECTED':
      return '#22c55e';
    case 'CONNECTING':
      return '#f59e0b';
    case 'ERROR':
      return '#ef4444';
    default:
      return '#94a3b8';
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

  useEffect(() => {
    const unsubscribeStatus = mqttClient.onStatusChange(setStatus);
    const unsubscribeMessage = mqttClient.onMessage((topic, payload) => {
      const entry: MessageEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        topic,
        payload: payload as PayloadType,
        receivedAt: new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };

      setMessages((previous) => [entry, ...previous].slice(0, 8));
    });

    mqttClient.subscribe(MQTT_TOPICS.LED_ESTADO);
    mqttClient.subscribe(MQTT_TOPICS.ESTADO_CONEXION);
    mqttClient.subscribe(MQTT_TOPICS.TELEMETRIA);
    mqttClient.subscribe(MQTT_TOPICS.ERROR);

    return () => {
      unsubscribeStatus();
      unsubscribeMessage();
      mqttClient.unsubscribe(MQTT_TOPICS.LED_ESTADO);
      mqttClient.unsubscribe(MQTT_TOPICS.ESTADO_CONEXION);
      mqttClient.unsubscribe(MQTT_TOPICS.TELEMETRIA);
      mqttClient.unsubscribe(MQTT_TOPICS.ERROR);
    };
  }, []);

  const handleConnect = () => {
    mqttClient.connect();
  };

  const handleDisconnect = () => {
    mqttClient.disconnect();
  };

  const handleLedCommand = (accion: 'encender' | 'apagar' | 'titilar') => {
    mqttClient.sendLedCommand(accion);
  };

  return (
    <section style={styles.panel} aria-label="Panel MQTT del broker local">
      <button type="button" style={styles.header} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span style={styles.headerText}>
          <span style={{ ...styles.dot, background: getStatusColor(status) }} />
          MQTT local
        </span>
        <strong>{expanded ? '−' : '+'}</strong>
      </button>

      {expanded && (
        <div style={styles.body}>
          <div style={styles.row}>
            <span style={styles.label}>Estado</span>
            <span style={{ ...styles.badge, color: getStatusColor(status), borderColor: getStatusColor(status) }}>
              {getStatusLabel(status)}
            </span>
          </div>

          <div style={styles.actions}>
            <button type="button" style={styles.primaryButton} onClick={handleConnect} disabled={status === 'CONNECTED' || status === 'CONNECTING'}>
              Conectar
            </button>
            <button type="button" style={styles.secondaryButton} onClick={handleDisconnect} disabled={status === 'DISCONNECTED'}>
              Desconectar
            </button>
          </div>

          <div style={styles.actions}>
            <button type="button" style={styles.commandButton} onClick={() => handleLedCommand('encender')} disabled={status !== 'CONNECTED'}>Encender</button>
            <button type="button" style={styles.commandButton} onClick={() => handleLedCommand('apagar')} disabled={status !== 'CONNECTED'}>Apagar</button>
            <button type="button" style={styles.commandButton} onClick={() => handleLedCommand('titilar')} disabled={status !== 'CONNECTED'}>Titilar</button>
          </div>

          <div style={styles.messageList}>
            <strong style={styles.messageTitle}>Mensajes recientes</strong>
            {messages.length === 0 ? (
              <p style={styles.emptyText}>Sin mensajes aún.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} style={styles.messageItem}>
                  <div style={styles.messageHeader}>
                    <span style={styles.topic}>{message.topic}</span>
                    <span style={styles.timestamp}>{message.receivedAt}</span>
                  </div>
                  <pre style={styles.payload}>{JSON.stringify(message.payload, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const styles = {
  panel: {
    borderTop: '1px solid #d8e0ea',
    background: '#f8fafc',
    borderBottom: '1px solid #d8e0ea',
    width: '100%',
  },
  header: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    border: 'none',
    background: '#e2e8f0',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    color: '#0f172a',
  },
  headerText: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  body: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    maxHeight: 320,
    overflowY: 'auto' as const,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    fontWeight: 700,
  },
  badge: {
    fontSize: 11,
    fontWeight: 800,
    border: '1px solid currentColor',
    borderRadius: 999,
    padding: '3px 8px',
    background: '#fff',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  primaryButton: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #67e8f9',
    background: '#e0f2fe',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: 700,
  },
  secondaryButton: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
    fontWeight: 700,
  },
  commandButton: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid #dbeafe',
    background: '#f8fafc',
    color: '#1e3a8a',
    cursor: 'pointer',
    fontWeight: 700,
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  messageTitle: {
    fontSize: 11,
    textTransform: 'uppercase' as const,
    color: '#64748b',
    margin: 0,
  },
  emptyText: {
    fontSize: 11,
    color: '#94a3b8',
    margin: 0,
  },
  messageItem: {
    border: '1px solid #e2e8f0',
    background: '#fff',
    borderRadius: 6,
    padding: 8,
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  topic: {
    fontSize: 10,
    color: '#1d4ed8',
    fontWeight: 700,
    wordBreak: 'break-word' as const,
  },
  timestamp: {
    fontSize: 9,
    color: '#64748b',
    whiteSpace: 'nowrap' as const,
  },
  payload: {
    margin: 0,
    fontSize: 9,
    lineHeight: 1.4,
    color: '#0f172a',
    whiteSpace: 'pre-wrap' as const,
    overflowWrap: 'anywhere' as const,
  },
};
