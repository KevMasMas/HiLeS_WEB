import React from 'react';
import { SimulationPanel } from '../simulation/SimulationPanel';
import { PropertiesPanel } from './PropertiesPanel';
import type { DockPanel } from './panelState';
import { setMqttPanelPortalTarget } from './panelPortal';

interface PanelDockProps {
  activePanel: DockPanel;
  onPanelChange: (panel: DockPanel) => void;
  onOpenDistributed?: () => void;
}

const tabs: Array<{ id: Exclude<DockPanel, null>; label: string }> = [
  { id: 'properties', label: 'Propiedades' },
  { id: 'simulation', label: 'Entradas' },
  { id: 'mqtt', label: 'Conexión' },
];

export const PanelDock: React.FC<PanelDockProps> = ({
  activePanel,
  onPanelChange,
  onOpenDistributed,
}) => (
  <aside className={`panel-dock ${activePanel ? 'is-open' : 'is-closed'}`} aria-label="Paneles del área de trabajo" aria-hidden={!activePanel}>
    <div className="panel-dock__header">
      <div className="panel-dock__tabs" role="tablist" aria-label="Pestañas del panel lateral">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activePanel === tab.id}
            className={activePanel === tab.id ? 'is-active' : ''}
            onClick={() => onPanelChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button type="button" className="panel-dock__close" onClick={() => onPanelChange(null)} title="Cerrar panel" aria-label="Cerrar panel lateral">×</button>
    </div>

    <div className="panel-dock__content">
      <div role="tabpanel" hidden={activePanel !== 'properties'} className="panel-dock__pane">
        <PropertiesPanel />
      </div>
      <div role="tabpanel" hidden={activePanel !== 'simulation'} className="panel-dock__pane">
        <SimulationPanel embedded onOpenDistributed={onOpenDistributed} />
      </div>
      <div role="tabpanel" hidden={activePanel !== 'mqtt'} className="panel-dock__pane">
        <div id="hiles-mqtt-panel-slot" ref={setMqttPanelPortalTarget} className="panel-dock__mqtt-slot" />
      </div>
    </div>
  </aside>
);
