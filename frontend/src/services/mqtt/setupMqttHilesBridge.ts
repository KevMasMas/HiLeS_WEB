import { useSimulationStore } from '../../stores/useSimulationStore';
import { mqttClient } from './MqttClient';
import { MqttHilesBridge } from './MqttHilesBridge';

/** Adaptador único de la aplicación: mantiene el puente fuera del motor. */
export const mqttHilesBridge = new MqttHilesBridge(mqttClient, {
  obtenerServicios: () => useSimulationStore.getState().servicios,
  inyectarEntrada: (servicioId, valor) => useSimulationStore.getState().inyectarEntrada(servicioId, valor),
});
