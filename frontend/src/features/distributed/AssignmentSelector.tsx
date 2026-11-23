import React from 'react';
import type { MensajeEstadoEjecutorV3 } from '../../services/distributed/messages';
import { ETIQUETA_ESTADO_EJECUTOR, etiquetaEjecutor } from './assignments';
import { evaluarDisponibilidadEjecutor } from './executorAvailability';

interface AssignmentSelectorProps {
  valor: string | null;
  ejecutores: Record<string, MensajeEstadoEjecutorV3>;
  executorLocal: string | null;
  workerLocalActivo: boolean;
  projectId: string;
  vistoEn: Record<string, number>;
  ahora: number;
  onChange: (executorId: string | null) => void;
  etiqueta: string;
  heredado?: string | null;
}

/**
 * Selector «Este navegador», «Pico <id>», otros navegadores o «Sin asignar».
 * El valor guardado siempre es un `executorId` concreto, así que en otro
 * navegador «Este navegador» se ve como «Navegador <id>».
 */
export const AssignmentSelector: React.FC<AssignmentSelectorProps> = ({
  valor,
  ejecutores,
  executorLocal,
  workerLocalActivo,
  projectId,
  vistoEn,
  ahora,
  onChange,
  etiqueta,
  heredado,
}) => {
  const picos = Object.values(ejecutores).filter((item) => item.tipo === 'pico').sort((a, b) => a.executor_id.localeCompare(b.executor_id));
  const navegadores = Object.values(ejecutores)
    .filter((item) => item.tipo === 'browser' && item.executor_id !== executorLocal)
    .sort((a, b) => a.executor_id.localeCompare(b.executor_id));
  const conocido = !valor || valor === executorLocal || Boolean(ejecutores[valor]);

  const opcion = (item: MensajeEstadoEjecutorV3) => {
    const disponibilidad = evaluarDisponibilidadEjecutor(item, {
      projectId,
      recibidoEn: vistoEn[item.executor_id],
      ahora,
    });
    const estado = item.estado !== 'online' && item.estado !== 'ready' && item.estado !== 'running'
      ? ETIQUETA_ESTADO_EJECUTOR[item.estado]
      : null;
    return (
      <option key={item.executor_id} value={item.executor_id} disabled={!disponibilidad.seleccionable}>
        {etiquetaEjecutor(item.executor_id, executorLocal)}
        {disponibilidad.detalle ? ` · ${disponibilidad.detalle}` : estado ? ` · ${estado}` : ''}
      </option>
    );
  };

  return (
    <select
      className="assignment-select"
      value={valor ?? ''}
      aria-label={etiqueta}
      onChange={(evento) => onChange(evento.target.value || null)}
    >
      <option value="">{heredado ? `Heredar (${etiquetaEjecutor(heredado, executorLocal)})` : 'Sin asignar'}</option>
      {executorLocal && (
        <option value={executorLocal} disabled={!workerLocalActivo && valor !== executorLocal}>
          Este navegador{workerLocalActivo ? '' : ' (activa «Ejecutar aquí»)'}
        </option>
      )}
      {picos.length > 0 && <optgroup label="Raspberry Pi Pico W">{picos.map(opcion)}</optgroup>}
      {navegadores.length > 0 && <optgroup label="Otros navegadores">{navegadores.map(opcion)}</optgroup>}
      {!conocido && valor && <option value={valor}>{etiquetaEjecutor(valor, executorLocal)} · no disponible</option>}
    </select>
  );
};
