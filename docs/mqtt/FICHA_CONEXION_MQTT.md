# Ficha de conexión MQTT — plantilla

Completar esta ficha **fuera del repositorio** antes de cada sesión y compartir las credenciales por un canal privado. Este archivo versionado solo contiene marcadores.

> Hasta la entrega 7 esta ficha mostraba la IP de un hotspot usado en una demostración anterior. Esa dirección no es permanente y se retiró. La IP del broker debe confirmarse con `ipconfig` cada vez.

## Datos de la sesión

| Dato | Valor |
|---|---|
| IPv4 del PC con Mosquitto | `IPV4_DEL_PC` (obtener con `ipconfig`) |
| Red Wi-Fi | 2.4 GHz, compartida por el PC y las Picos |
| Broker | Eclipse Mosquitto 2.x, sin acceso anónimo |
| Proyecto | `PROJECT_ID`, igual en `?project=` y en `HILES_PROJECT_ID` |

## Pico (MQTT sobre TCP, puerto 1883)

```python
MQTT_HOST = "IPV4_DEL_PC"         # nunca localhost
MQTT_PORT = 1883
MQTT_USERNAME = "RECIBIR_POR_PRIVADO"
MQTT_PASSWORD = "RECIBIR_POR_PRIVADO"
MQTT_CLIENT_ID = "pico01w"        # único por placa
DEVICE_ID = "pico01w"             # único por placa
HILES_TEAM_ID = "equipo1"
HILES_PROJECT_ID = "PROJECT_ID"   # igual que ?project=
```

El archivo completo se genera desde **Ejecutores** → **Configuración de placas** (ver [`../GUIA_AGREGAR_PICO_Y_EJECUTORES.md`](../GUIA_AGREGAR_PICO_Y_EJECUTORES.md)).

## Navegador (MQTT sobre WebSocket, puerto 9001)

`frontend/.env.local`, nunca versionado:

```env
VITE_MQTT_HOST=IPV4_DEL_PC
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=RECIBIR_POR_PRIVADO
VITE_MQTT_PASSWORD=RECIBIR_POR_PRIVADO
```

También se puede ajustar durante la sesión con el botón **Conexión** (modo Local/LAN).

## Tópicos

| Prefijo | Uso |
|---|---|
| `udfjc/hiles/v1/equipo1/<DEVICE_ID>/` | Diagnóstico de cada placa (`led/comando`, `led/estado`, `estado/conexion`, `telemetria`, `error`) |
| `udfjc/hiles/v2/projects/<PROJECT_ID>/` | Colaboración |
| `udfjc/hiles/v3/projects/<PROJECT_ID>/executors/#` | Presencia de ejecutores |
| `udfjc/hiles/v3/projects/<PROJECT_ID>/deployments/#` | Manifiesto, fragmentos, ACK, canales, snapshots y comandos |

Dos placas no pueden compartir `MQTT_CLIENT_ID`: el broker desconectaría una cuando entre la otra.

## Comprobación antes de demostrar

```powershell
ipconfig
Get-Service mosquitto
netstat -ano | Select-String ':1883|:9001'
```

Si la IPv4 cambió, actualizar `frontend/.env.local` y el `config_local.py` de cada placa antes de la prueba.
