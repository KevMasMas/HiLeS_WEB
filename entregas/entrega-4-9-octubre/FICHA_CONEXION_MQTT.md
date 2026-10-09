# Ficha de conexión MQTT — HiLeS

## Red de demostración

- Host del broker: `192.168.137.106`
- Subred local: `192.168.137.0/24`
- Broker: Eclipse Mosquitto 2.1.2
- Acceso anónimo: deshabilitado

La dirección pertenece a la conexión Wi-Fi actual del PC que ejecuta Mosquitto.
Debe confirmarse con `ipconfig` antes de cada demostración porque el hotspot
puede asignar otra dirección después de una reconexión.

## Pico W y clientes de terminal

- Protocolo: MQTT sobre TCP
- Host: `192.168.137.106`
- Puerto: `1883`

Configuración MicroPython:

```python
MQTT_HOST = "192.168.137.106"
MQTT_PORT = 1883
MQTT_USERNAME = "RECIBIR_POR_PRIVADO"
MQTT_PASSWORD = "RECIBIR_POR_PRIVADO"
MQTT_CLIENT_ID = "pico01"
```

## Aplicación web

- Protocolo: MQTT sobre WebSockets
- URL: `ws://192.168.137.106:9001/mqtt`
- Puerto: `9001`
- Ruta: `/mqtt`

Configuración local del frontend:

```env
VITE_MQTT_HOST=192.168.137.106
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=RECIBIR_POR_PRIVADO
VITE_MQTT_PASSWORD=RECIBIR_POR_PRIVADO
```

El archivo real debe llamarse `frontend/.env.local` y no debe subirse a Git.

## Topics

Prefijo común:

```text
udfjc/hiles/v1/equipo1/pico01/
```

Principales topics:

- `led/comando`: web o terminal hacia la Pico.
- `led/estado`: confirmación de la Pico.
- `estado/conexion`: disponibilidad de la Pico.
- `telemetria`: datos de diagnóstico.
- `error`: errores de JSON o ejecución.

## Entrega segura de credenciales

El usuario MQTT y la contraseña deben enviarse por un canal privado y no deben
escribirse en este documento, en el registro de cambios ni en un commit. La
contraseña debe compartirse separadamente de esta ficha.

## Comprobación antes de demostrar

En el PC del broker:

```powershell
ipconfig
Get-Service mosquitto
netstat -ano | Select-String ':1883|:9001'
```

Si la IPv4 Wi-Fi ya no es `192.168.137.106`, se deben actualizar
`config_local.py`, `frontend/.env.local` y esta ficha antes de la prueba.
