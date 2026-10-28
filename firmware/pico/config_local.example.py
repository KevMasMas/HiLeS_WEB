"""Copia este archivo como config_local.py y completa los valores localmente.

No subas config_local.py al repositorio.
"""

WIFI_SSID = "CAMBIAR_SSID"
WIFI_PASSWORD = "CAMBIAR_CONTRASENA_WIFI"

MQTT_HOST = "CAMBIAR_IP_DEL_BROKER"
MQTT_PORT = 1883
MQTT_USERNAME = "CAMBIAR_USUARIO_MQTT"
MQTT_PASSWORD = "CAMBIAR_CONTRASENA_MQTT"
MQTT_CLIENT_ID = "pico01"
MQTT_CONNECT_TIMEOUT_SECONDS = 2

# Identidad y despliegue distribuido v3 (multi-Pico).
# DEVICE_ID identifica esta placa de forma única; si es None se deriva del ID
# único de hardware o de MQTT_CLIENT_ID. El ejecutor v3 es "pico:<DEVICE_ID>".
DEVICE_ID = "pico01"
HILES_TEAM_ID = "equipo1"
HILES_PROJECT_ID = "default"
WORKER_MAX_FRAGMENT_BYTES = 30000
WORKER_MAX_ELEMENTS = 64
WORKER_STATUS_PERIOD_MS = 5000

# Ritmo cooperativo del motor. No son esperas bloqueantes.
ENGINE_PERIOD_MS = 20
ENGINE_STEP_INTERVAL_MS = 1000
ENGINE_QUEUE_SIZE = 32
WATCHDOG_PERIOD_MS = 5000

# No se configuran dominios, sensores ni ejemplos en este archivo. Cualquier
# modelo válido se carga por MQTT y sus Services se inyectan manualmente desde
# el editor. Los adaptadores físicos se diseñarán después como entradas
# genéricas, sin añadir lógica de negocio a este runtime.
