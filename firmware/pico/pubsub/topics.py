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


# ------------------------------------------------------------------
# Identidad dinámica v1 y catálogo de tópicos distribuidos v3.
# ------------------------------------------------------------------

PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION = 3
_FORBIDDEN_SEGMENT_CHARS = ("/", "+", "#", "\x00")


def validate_segment_v3(value, name="segment"):
    """Valida que un segmento de tópico MQTT no esté vacío ni contenga /, +, # o NUL."""

    if not isinstance(value, str):
        raise ValueError("{} debe ser un segmento MQTT no vacío y no puede contener /, +, # o NUL.".format(name))
    clean = value.strip()
    if not clean or any(ch in clean for ch in _FORBIDDEN_SEGMENT_CHARS):
        raise ValueError("{} debe ser un segmento MQTT no vacío y no puede contener /, +, # o NUL.".format(name))
    return clean


def build_v1_prefix(device_id="pico01", team_id="equipo1"):
    """Construye el prefijo v1 parametrizado por dispositivo sin fijar ``pico01``."""

    clean_team = validate_segment_v3(team_id, "team_id")
    clean_device = validate_segment_v3(device_id, "device_id")
    return "udfjc/hiles/v1/{}/{}/".format(clean_team, clean_device)


def build_executor_id(device_id, kind="pico"):
    """Construye el ``executorId`` canónico ``<kind>:<deviceId>``."""

    clean_kind = validate_segment_v3(kind, "kind")
    clean_device = validate_segment_v3(device_id, "device_id")
    if clean_device.startswith(clean_kind + ":"):
        return validate_segment_v3(clean_device, "executorId")
    return validate_segment_v3("{}:{}".format(clean_kind, clean_device), "executorId")


def v3_project_base(project_id):
    return "udfjc/hiles/v3/projects/{}".format(validate_segment_v3(project_id, "projectId"))


def v3_executor_status_topic(project_id, executor_id):
    return "{}/executors/{}/status".format(
        v3_project_base(project_id),
        validate_segment_v3(executor_id, "executorId"),
    )


def v3_executor_status_filter(project_id):
    return "{}/executors/+/status".format(v3_project_base(project_id))


def v3_manifest_topic(project_id):
    return "{}/deployments/manifest".format(v3_project_base(project_id))


def v3_fragment_topic(project_id, deployment_id, executor_id):
    return "{}/deployments/{}/fragments/{}".format(
        v3_project_base(project_id),
        validate_segment_v3(deployment_id, "deploymentId"),
        validate_segment_v3(executor_id, "executorId"),
    )


def v3_fragment_filter(project_id, executor_id):
    return "{}/deployments/+/fragments/{}".format(
        v3_project_base(project_id),
        validate_segment_v3(executor_id, "executorId"),
    )


def v3_ack_topic(project_id, deployment_id, executor_id):
    return "{}/deployments/{}/ack/{}".format(
        v3_project_base(project_id),
        validate_segment_v3(deployment_id, "deploymentId"),
        validate_segment_v3(executor_id, "executorId"),
    )


def v3_channel_topic(project_id, deployment_id, connection_id):
    return "{}/deployments/{}/channels/{}".format(
        v3_project_base(project_id),
        validate_segment_v3(deployment_id, "deploymentId"),
        validate_segment_v3(connection_id, "connectionId"),
    )


def v3_snapshot_topic(project_id, deployment_id, executor_id):
    return "{}/deployments/{}/snapshot/{}".format(
        v3_project_base(project_id),
        validate_segment_v3(deployment_id, "deploymentId"),
        validate_segment_v3(executor_id, "executorId"),
    )


def v3_error_topic(project_id, deployment_id):
    return "{}/deployments/{}/error".format(
        v3_project_base(project_id),
        validate_segment_v3(deployment_id, "deploymentId"),
    )


def v3_command_topic(project_id, deployment_id):
    return "{}/deployments/{}/command".format(
        v3_project_base(project_id),
        validate_segment_v3(deployment_id, "deploymentId"),
    )


def v3_input_topic(project_id, deployment_id):
    return "{}/deployments/{}/input".format(
        v3_project_base(project_id),
        validate_segment_v3(deployment_id, "deploymentId"),
    )


def mqtt_topic_matches(pattern, topic):
    """Comprueba si ``topic`` coincide con ``pattern`` soportando ``+`` y ``#``."""

    if not isinstance(pattern, str) or not isinstance(topic, str):
        return False
    if pattern == topic:
        return True
    p_parts = pattern.split("/")
    t_parts = topic.split("/")
    for idx, p_seg in enumerate(p_parts):
        if p_seg == "#":
            return idx == len(p_parts) - 1
        if idx >= len(t_parts):
            return False
        if p_seg != "+" and p_seg != t_parts[idx]:
            return False
    return len(p_parts) == len(t_parts)


V3_POLICIES = {
    "status": {"qos": 1, "retain": True},
    "manifest": {"qos": 1, "retain": True},
    "fragment": {"qos": 1, "retain": True},
    "ack": {"qos": 1, "retain": True},
    "channel": {"qos": 1, "retain": False},
    "snapshot": {"qos": 0, "retain": False},
    "error": {"qos": 1, "retain": False},
    "command": {"qos": 1, "retain": False},
    "input": {"qos": 1, "retain": False},
}
