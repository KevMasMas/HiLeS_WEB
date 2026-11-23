import React, { useMemo, useState } from 'react';
import { generarConfigLocalPico, validarConfiguracionPico, webSerialDisponible, type DatosConfiguracionPico } from './picoConfig';
import './setup.css';

interface PicoSetupPanelProps {
  projectId: string;
}

const inicial = (projectId: string): DatosConfiguracionPico => ({
  wifiSsid: '', wifiPassword: '', mqttHost: '', mqttPort: 1883,
  mqttUsername: '', mqttPassword: '', mqttClientId: 'pico03w',
  deviceId: 'pico03w', projectId, teamId: 'equipo1',
});

export const PicoSetupPanel: React.FC<PicoSetupPanelProps> = ({ projectId }) => {
  const [datos, setDatos] = useState(() => inicial(projectId));
  const errores = useMemo(() => validarConfiguracionPico(datos), [datos]);
  const serial = webSerialDisponible();
  const actualizar = (campo: keyof DatosConfiguracionPico, valor: string | number) =>
    setDatos((actual) => ({ ...actual, [campo]: valor }));

  const descargar = () => {
    const contenido = generarConfigLocalPico(datos);
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/x-python;charset=utf-8' }));
    enlace.download = 'config_local.py';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  return (
    <details className="pico-setup">
      <summary>Preparar otra Raspberry Pi Pico</summary>
      <p className="dist-muted">Los valores permanecen en este formulario y se descargan localmente. HiLeS no los guarda en el proyecto, MQTT ni el navegador.</p>
      <div className="pico-setup__grid">
        <label>Red Wi-Fi<input value={datos.wifiSsid} onChange={(e) => actualizar('wifiSsid', e.target.value)} autoComplete="off" /></label>
        <label>Contraseña Wi-Fi<input type="password" value={datos.wifiPassword} onChange={(e) => actualizar('wifiPassword', e.target.value)} autoComplete="new-password" /></label>
        <label>IP o host MQTT<input value={datos.mqttHost} onChange={(e) => actualizar('mqttHost', e.target.value)} placeholder="192.168.1.10" autoComplete="off" /></label>
        <label>Puerto MQTT<input type="number" min="1" max="65535" value={datos.mqttPort} onChange={(e) => actualizar('mqttPort', Number(e.target.value))} /></label>
        <label>Usuario MQTT<input value={datos.mqttUsername} onChange={(e) => actualizar('mqttUsername', e.target.value)} autoComplete="off" /></label>
        <label>Contraseña MQTT<input type="password" value={datos.mqttPassword} onChange={(e) => actualizar('mqttPassword', e.target.value)} autoComplete="new-password" /></label>
        <label>Identidad de placa<input value={datos.deviceId} onChange={(e) => { actualizar('deviceId', e.target.value); actualizar('mqttClientId', e.target.value); }} /></label>
        <label>Proyecto<input value={datos.projectId} onChange={(e) => actualizar('projectId', e.target.value)} /></label>
      </div>
      {errores.length > 0 && <p className="pico-setup__error" role="status">{errores[0]}</p>}
      <button type="button" className="btn" disabled={errores.length > 0} onClick={descargar}>Descargar config_local.py</button>
      <p className="dist-muted">Web Serial: {serial ? 'disponible en este navegador, pero la carga directa queda deshabilitada para no interrumpir una Pico que ya ejecuta el runtime.' : 'no disponible.'} Fallback seguro: copia el archivo descargado a la raíz con Thonny, conservando <code>umqtt/</code>.</p>
    </details>
  );
};
