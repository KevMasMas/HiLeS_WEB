import { describe, expect, it } from 'vitest';
import { generarConfigLocalPico, validarConfiguracionPico, webSerialDisponible } from './picoConfig';

const datos = {
  wifiSsid: 'red de prueba',
  wifiPassword: 'secreto\ncon salto',
  mqttHost: '192.0.2.10',
  mqttPort: 1883,
  mqttUsername: 'usuario',
  mqttPassword: 'otro "secreto"',
  mqttClientId: 'pico03w',
  deviceId: 'pico03w',
  projectId: 'proyecto-hl950c',
  teamId: 'equipo1',
};

describe('generador seguro de config_local.py', () => {
  it('genera una identidad nueva sin cambiar código del runtime', () => {
    const config = generarConfigLocalPico(datos);
    expect(config).toContain('DEVICE_ID = "pico03w"');
    expect(config).toContain('HILES_PROJECT_ID = "proyecto-hl950c"');
    expect(config).toContain('ENGINE_QUEUE_SIZE = 32');
    expect(config).toContain('secreto\\ncon salto');
    expect(config).not.toContain('console');
  });

  it('rechaza identidades que romperían los tópicos MQTT', () => {
    expect(validarConfiguracionPico({ ...datos, deviceId: 'pico/03' })).toContain('DEVICE_ID no puede contener espacios, /, + ni #.');
    expect(() => generarConfigLocalPico({ ...datos, mqttPort: 70000 })).toThrow(/puerto MQTT/);
  });

  it('detecta Web Serial sin asumir que todos los navegadores lo soportan', () => {
    expect(webSerialDisponible({ serial: {} })).toBe(true);
    expect(webSerialDisponible({})).toBe(false);
  });
});
