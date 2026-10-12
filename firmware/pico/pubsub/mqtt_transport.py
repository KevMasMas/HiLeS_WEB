"""Puente MQTT cooperativo entre el broker y el bus ``Node``."""

import json

try:
    from ..core.task import Task
except ImportError:  # pragma: no cover
    from core.task import Task

from .topics import ENTRANTES, ERROR, ESTADO_CONEXION, SALIENTES, TOPIC_PREFIX, full_topic, relative_topic


MAX_PAYLOAD_BYTES = 32768


class MqttTransport(Task):
    """Tarea que hace como máximo una lectura o conexión breve por actualización."""

    def __init__(self, scheduler, node, wifi, client_factory, client_id="pico01", host=None,
                 port=1883, username=None, password=None, prefix=TOPIC_PREFIX,
                 period_ms=10, priority=0, keepalive=30, max_payload_bytes=MAX_PAYLOAD_BYTES):
        if not callable(client_factory):
            raise ValueError("client_factory debe ser invocable")
        self.node = node
        self.wifi = wifi
        self.client_factory = client_factory
        self.client_id = client_id
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.prefix = prefix
        self.keepalive = keepalive
        self.max_payload_bytes = max_payload_bytes
        self.client = None
        self.connected = False
        self.last_error = None
        self._handles = []
        for suffix, policy in SALIENTES.items():
            self._handles.append(node.subscribe(suffix, self._make_publisher(suffix, policy)))
        super().__init__(scheduler, period_ms=period_ms, priority=priority, name="mqtt", max_update_ms=period_ms)

    def _make_publisher(self, suffix, policy):
        def publish(payload):
            if self.client is None or not self.connected:
                return False
            raw = self._encode(payload)
            self.client.publish(full_topic(suffix, self.prefix).encode(), raw,
                                qos=policy["qos"], retain=policy["retain"])
            return True
        return publish

    def update(self):
        if not self.wifi.poll():
            return
        if self.client is None or not self.connected:
            self._connect()
            return
        check_msg = getattr(self.client, "check_msg", None)
        if not callable(check_msg):
            raise RuntimeError("cliente MQTT debe implementar check_msg()")
        check_msg()

    def _connect(self):
        self.client = self.client_factory(self.client_id, self.host, self.port, self.username,
                                          self.password, self.keepalive)
        self.client.set_callback(self._on_message)
        self.client.connect()
        for suffix in ENTRANTES:
            self.client.subscribe(full_topic(suffix, self.prefix).encode(), qos=1)
        self.connected = True
        self.node.publish(ESTADO_CONEXION, {"conectado": True, "dispositivo": self.client_id})

    def _on_message(self, topic, raw_payload):
        suffix = relative_topic(self._as_text(topic), self.prefix)
        if suffix not in ENTRANTES:
            self._publish_error("TOPIC_NO_SOPORTADO", "Topic entrante no soportado: {}".format(topic))
            return False
        try:
            if len(raw_payload) > self.max_payload_bytes:
                raise ValueError("el payload supera el límite de {} bytes".format(self.max_payload_bytes))
            payload = json.loads(self._as_text(raw_payload))
            if not isinstance(payload, dict):
                raise ValueError("el payload debe ser un objeto JSON")
        except Exception as exc:
            self._publish_error("JSON_INVALIDO", "Payload inválido en {}: {}".format(suffix, exc))
            return False
        self.node.publish(suffix, payload)
        return True

    def _publish_error(self, code, message, message_id=None):
        payload = {"codigo": code, "mensaje": message}
        if message_id is not None:
            payload["id_mensaje"] = message_id
        self.node.publish(ERROR, payload)

    @staticmethod
    def _as_text(value):
        if isinstance(value, bytes):
            return value.decode("utf-8")
        return value

    @staticmethod
    def _encode(payload):
        return json.dumps(payload, separators=(",", ":")).encode("utf-8")

    def close(self):
        for handle in self._handles:
            self.node.unsubscribe(handle)
        self._handles = []
        if self.client is not None:
            disconnect = getattr(self.client, "disconnect", None)
            if callable(disconnect):
                disconnect()
        self.client = None
        self.connected = False

