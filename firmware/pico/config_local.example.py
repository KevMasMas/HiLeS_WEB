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

# Ritmo cooperativo del motor. No son esperas bloqueantes.
ENGINE_PERIOD_MS = 20
ENGINE_STEP_INTERVAL_MS = 1000
ENGINE_QUEUE_SIZE = 32
WATCHDOG_PERIOD_MS = 5000

# Opcional: cuatro sensores y cuatro semáforos físicos. Si se omiten, el motor
# HiLeS sigue siendo completamente general y simplemente no crea el demo vial.
# Ajusta los GPIO a tu montaje antes de habilitarlos.
# TRAFFIC_SENSOR_PINS = {"norte": 2, "sur": 3, "este": 4, "oeste": 5}
# TRAFFIC_LIGHT_PINS = {
#     "norte": {"rojo": 6, "amarillo": 7, "verde": 8},
#     "sur": {"rojo": 9, "amarillo": 10, "verde": 11},
#     "este": {"rojo": 12, "amarillo": 13, "verde": 14},
#     "oeste": {"rojo": 15, "amarillo": 16, "verde": 17},
# }
SENSOR_PERIOD_MS = 50
TRAFFIC_PERIOD_MS = 100
