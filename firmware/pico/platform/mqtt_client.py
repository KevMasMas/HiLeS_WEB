"""Fábrica del cliente MQTT; mantiene ``umqtt`` fuera de la lógica de dominio."""


def _as_bytes(value):
    if value is None or isinstance(value, bytes):
        return value
    return str(value).encode("utf-8")


def create_mqtt_client(client_id, host, port=1883, username=None, password=None, keepalive=30, mqtt_module=None):
    if mqtt_module is None:
        try:
            from umqtt import simple as mqtt_module
        except ImportError as exc:  # pragma: no cover - solo Pico
            raise RuntimeError("umqtt.simple no está disponible; inyecte mqtt_module") from exc

    client_class = getattr(mqtt_module, "MQTTClient", None)
    if client_class is None:
        raise ValueError("el módulo MQTT debe exponer MQTTClient")
    kwargs = {"port": port, "keepalive": keepalive}
    if username is not None:
        kwargs["user"] = _as_bytes(username)
    if password is not None:
        kwargs["password"] = _as_bytes(password)
    return client_class(_as_bytes(client_id), host, **kwargs)

