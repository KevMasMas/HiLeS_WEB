"""Fábrica del cliente MQTT; mantiene ``umqtt`` fuera de la lógica de dominio."""


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
        kwargs["user"] = username
    if password is not None:
        kwargs["password"] = password
    return client_class(client_id, host, **kwargs)

