import React from 'react';
import { describirMarcajePlace } from './nodeRuntimeView';

interface PlaceTokenViewProps {
  tokens: number;
  stale?: boolean;
}

export const PlaceTokenView: React.FC<PlaceTokenViewProps> = ({ tokens, stale = false }) => {
  const marcaje = describirMarcajePlace(tokens);
  if (!marcaje.visible) return null;

  const etiquetaAccesible = stale
    ? `${marcaje.ariaLabel} (estado obsoleto: ejecutor desconectado)`
    : marcaje.ariaLabel;

  return (
    <span
      className={`hiles-place-tokens hiles-place-tokens--${marcaje.modo} ${stale ? 'is-stale' : ''}`.trim()}
      role="img"
      aria-label={etiquetaAccesible}
    >
      {marcaje.puntos.map((punto, indice) => (
        <span
          key={indice}
          aria-hidden="true"
          className={`hiles-place-token ${marcaje.modo === 'multiple_puntos' ? 'is-compact' : ''}`.trim()}
          style={{ left: `${punto.x}%`, top: `${punto.y}%` }}
        />
      ))}
      {marcaje.etiquetaContador && (
        <span aria-hidden="true" className="hiles-place-token-count">
          {marcaje.etiquetaContador}
        </span>
      )}
    </span>
  );
};

export const StaleRuntimeBadge: React.FC = () => (
  <span
    className="hiles-node__stale-badge"
    title="Ejecutor desconectado: se conserva el último estado recibido (obsoleto)"
  >
    Obsoleto
  </span>
);
