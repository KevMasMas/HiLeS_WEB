"""Topics relativos y políticas de entrega del bus interno y del puente MQTT.

Los componentes internos (``LedTask``, ``EngineTask``, etc.) publican y se
suscriben usando únicamente sufijos relativos como ``"modelo/cargar"`` o
``"simulacion/estado"``. Solo el transporte MQTT agrega o recorta el prefijo
común del contrato.
"""

TOPIC_PREFIX = "udfjc/hiles/v1/equipo1/pico01/"

LED_COMANDO = "led/comando"
LED_ESTADO = "led/estado"
ESTADO_CONEXION = "estado/conexion"
TELEMETRIA = "telemetria"
SALIDA = "salida"
ERROR = "error"
SIMULACION_COMANDO = "simulacion/comando"
ENTRADA_ESTABLECER = "entrada/establecer"
MODELO_CARGAR = "modelo/cargar"
MODELO_CONFIRMACION = "modelo/confirmacion"
SIMULACION_ESTADO = "simulacion/estado"

# Topics que llegan desde el broker MQTT hacia Node (Web -> Pico).
ENTRANTES = (
    LED_COMANDO,
    SIMULACION_COMANDO,
    ENTRADA_ESTABLECER,
    MODELO_CARGAR,
)

# Topics que salen desde Node hacia el broker MQTT (Pico -> Web), con su política.
SALIENTES = {
    LED_ESTADO: {"qos": 1, "retain": True},
    ESTADO_CONEXION: {"qos": 1, "retain": True},
    TELEMETRIA: {"qos": 0, "retain": False},
    SALIDA: {"qos": 1, "retain": False},
    ERROR: {"qos": 1, "retain": False},
    MODELO_CONFIRMACION: {"qos": 1, "retain": False},
    SIMULACION_ESTADO: {"qos": 1, "retain": True},
}

TODOS_LOS_TOPICS = ENTRANTES + tuple(SALIENTES.keys())


def _normalize_prefix(prefix):
    if not isinstance(prefix, str) or not prefix.strip():
        raise ValueError("prefix debe ser un texto no vacío")
    clean = prefix.strip()
    return clean if clean.endswith("/") else clean + "/"


def full_topic(suffix, prefix=TOPIC_PREFIX):
    """Construye el topic MQTT completo a partir de un sufijo relativo."""

    if not isinstance(suffix, str) or not suffix.strip():
        raise ValueError("suffix debe ser un texto no vacío")
    clean_suffix = suffix.strip().lstrip("/")
    return _normalize_prefix(prefix) + clean_suffix


def relative_topic(topic, prefix=TOPIC_PREFIX):
    """Extrae el sufijo relativo de un topic MQTT completo o retorna ``None``."""

    if not isinstance(topic, str):
        return None
    normalized_prefix = _normalize_prefix(prefix)
    if not topic.startswith(normalized_prefix):
        return None
    suffix = topic[len(normalized_prefix):]
    return suffix if suffix else None
