"""Puente MQTT cooperativo entre el broker y el bus ``Node``."""

import json

try:
    import gc
except ImportError:  # pragma: no cover
    gc = None

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
                 period_ms=10, priority=0, keepalive=30, max_payload_bytes=MAX_PAYLOAD_BYTES,
                 reconnect_interval_ms=5000, connect_timeout_seconds=2):
        if not callable(client_factory):
            raise ValueError("client_factory debe ser invocable")
        if not isinstance(reconnect_interval_ms, int) or isinstance(reconnect_interval_ms, bool) or reconnect_interval_ms <= 0:
            raise ValueError("reconnect_interval_ms debe ser un entero mayor que cero")
        if not isinstance(connect_timeout_seconds, int) or isinstance(connect_timeout_seconds, bool) or connect_timeout_seconds <= 0:
            raise ValueError("connect_timeout_seconds debe ser un entero mayor que cero")
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
        self.reconnect_interval_ms = reconnect_interval_ms
        self.connect_timeout_seconds = connect_timeout_seconds
        self.client = None
        self.connected = False
        self.last_error = None
        self._next_connect_at = None
        self._socket_poller = None
        self._next_ping_at = None
        self._handles = []
        for suffix, policy in SALIENTES.items():
            self._handles.append(node.subscribe(suffix, self._make_publisher(suffix, policy)))
        super().__init__(
            scheduler,
            period_ms=period_ms,
            priority=priority,
            name="mqtt",
            max_update_ms=connect_timeout_seconds * 1000 + 100,
        )

    def _make_publisher(self, suffix, policy):
        def publish(payload):
            if self.client is None or not self.connected:
                return False
            raw = self._encode(payload)
            if len(raw) > self.max_payload_bytes:
                if suffix != ERROR:
                    self._publish_error(
                        "PAYLOAD_DEMASIADO_GRANDE",
                        "El payload de {} supera el límite de {} bytes".format(suffix, self.max_payload_bytes),
                    )
                return False
            try:
                self.client.publish(full_topic(suffix, self.prefix).encode(), raw,
                                    qos=policy["qos"], retain=policy["retain"])
            except Exception as exc:
                self._schedule_reconnect(exc)
                return False
            return True
        return publish

    def update(self):
        if not self.wifi.poll():
            if self.connected:
                self._schedule_reconnect(RuntimeError("Wi-Fi desconectado"))
            return
        if self.client is None or not self.connected:
            if not self._reconnect_due():
                return
            try:
                self._connect()
            except Exception as exc:
                self._schedule_reconnect(exc)
            return
        used_poller = self._socket_poller is not None
        try:
            if self._ping_due():
                ping = getattr(self.client, "ping", None)
                if callable(ping):
                    ping()
                self._schedule_next_ping()
            if used_poller:
                if not self._socket_poller.poll(0):
                    return
                # ``umqtt.simple`` reserva el payload completo antes de llamar
                # al callback. Recolectar aquí evita que la fragmentación del
                # heap impida recibir modelos medianos aunque haya memoria
                # libre total suficiente.
                if gc is not None:
                    gc.collect()
                self.client.wait_msg()
            else:
                check_msg = getattr(self.client, "check_msg", None)
                if not callable(check_msg):
                    raise RuntimeError("cliente MQTT debe implementar check_msg()")
                check_msg()
        except OSError as exc:
            # En algunas versiones de MicroPython, ``umqtt.simple`` devuelve
            # ``b\"\"`` cuando el socket no bloqueante todavía no tiene datos y
            # lo convierte en ``OSError(-1)``. No es una desconexión: simplemente
            # hay que dejar que el scheduler vuelva a consultar en el siguiente
            # ciclo.
            if not used_poller and self._is_idle_check_error(exc):
                return
            self._schedule_reconnect(exc)
        except Exception as exc:
            self._schedule_reconnect(exc)

    @staticmethod
    def _is_idle_check_error(error):
        return bool(getattr(error, "args", ())) and error.args[0] == -1

    @staticmethod
    def _build_socket_poller(client):
        """Usa ``poll`` para no leer el socket de la Pico cuando está vacío."""
        sock = getattr(client, "sock", None)
        if sock is None or not callable(getattr(client, "wait_msg", None)):
            return None
        try:
            import select
            poller = select.poll()
            poller.register(sock, select.POLLIN)
            return poller
        except (ImportError, AttributeError, OSError):
            return None

    def _schedule_next_ping(self):
        if self.keepalive > 0:
            interval_ms = max(1000, self.keepalive * 500)
            self._next_ping_at = self.scheduler.clock.add_ms(
                self.scheduler.clock.now_ms(), interval_ms
            )
        else:
            self._next_ping_at = None

    def _ping_due(self):
        return self._next_ping_at is not None and self.scheduler.clock.diff_ms(
            self.scheduler.clock.now_ms(), self._next_ping_at
        ) >= 0

    def _connect(self):
        self.client = self.client_factory(self.client_id, self.host, self.port, self.username,
                                          self.password, self.keepalive)
        self.client.set_callback(self._on_message)
        # ``umqtt.simple`` es síncrono. Limitar el socket evita que un broker
        # inaccesible congele todas las tareas cooperativas durante 30 s.
        self.client.connect(timeout=self.connect_timeout_seconds)
        self._socket_poller = self._build_socket_poller(self.client)
        self._schedule_next_ping()
        for suffix in ENTRANTES:
            self.client.subscribe(full_topic(suffix, self.prefix).encode(), qos=1)
        self.connected = True
        self.last_error = None
        self._next_connect_at = None
        print("[MQTT] Conectado a {}:{}".format(self.host, self.port))
        self.node.publish(ESTADO_CONEXION, {"conectado": True, "dispositivo": self.client_id})

    def _reconnect_due(self):
        if self._next_connect_at is None:
            return True
        return self.scheduler.clock.diff_ms(
            self.scheduler.clock.now_ms(), self._next_connect_at
        ) >= 0

    def _schedule_reconnect(self, error):
        self.last_error = error
        client = self.client
        self.client = None
        self._socket_poller = None
        self._next_ping_at = None
        self.connected = False
        self._next_connect_at = self.scheduler.clock.add_ms(
            self.scheduler.clock.now_ms(), self.reconnect_interval_ms
        )
        if client is not None:
            disconnect = getattr(client, "disconnect", None)
            if callable(disconnect):
                try:
                    disconnect()
                except Exception:
                    pass
        self.node.publish(ESTADO_CONEXION, {"conectado": False, "dispositivo": self.client_id})
        self._publish_error("MQTT_DESCONECTADO", str(error))
        print("[MQTT] Conexión fallida: {}; reintento en {} ms".format(
            repr(error), self.reconnect_interval_ms
        ))

    def _on_message(self, topic, raw_payload):
        suffix = relative_topic(self._as_text(topic), self.prefix)
        if suffix not in ENTRANTES:
            self._publish_error("TOPIC_NO_SOPORTADO", "Topic entrante no soportado: {}".format(topic))
            return False
        try:
            if len(raw_payload) > self.max_payload_bytes:
                raise ValueError("el payload supera el límite de {} bytes".format(self.max_payload_bytes))
            # MicroPython y CPython aceptan ``bytes`` en ``json.loads``. No
            # decodificar antes evita mantener simultáneamente dos copias del
            # modelo (bytes + str), algo costoso en la Pico W.
            payload = json.loads(raw_payload)
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
        self._socket_poller = None
        self._next_ping_at = None
        self.connected = False
        self._next_connect_at = None

