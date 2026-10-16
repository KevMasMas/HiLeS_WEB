"""Bus de publicación y suscripción interno para la Raspberry Pi Pico W.

``Node`` desacopla a los componentes internos (``LedTask``, ``EngineTask`` y
transporte MQTT). Los mensajes que circulan por ``Node`` son estructuras Python
(normalmente ``dict`` ya validados), nunca bytes crudos del socket.
"""


class Node:
    """Administrador cooperativo de topics y callbacks locales."""

    def __init__(self, error_handler=None, max_depth=4):
        if error_handler is not None and not callable(error_handler):
            raise ValueError("error_handler debe ser invocable o None")
        if not isinstance(max_depth, int) or isinstance(max_depth, bool) or max_depth <= 0:
            raise ValueError("max_depth debe ser un entero mayor que cero")

        self.error_handler = error_handler
        self.max_depth = max_depth
        self.error_count = 0
        self.last_error = None
        self.error_handler_error_count = 0
        self.last_error_handler_error = None

        self._next_handle = 1
        self._subscriptions_by_topic = {}
        self._topic_by_handle = {}
        self._current_depth = 0

    @staticmethod
    def _validate_topic(topic):
        if not isinstance(topic, str) or not topic.strip():
            raise ValueError("topic debe ser un texto no vacío")
        return topic.strip()

    def subscribe(self, topic, callback):
        """Registra ``callback(payload)`` en ``topic`` y retorna su identificador."""

        clean_topic = self._validate_topic(topic)
        if not callable(callback):
            raise ValueError("callback debe ser invocable")

        handle = self._next_handle
        self._next_handle += 1

        entries = self._subscriptions_by_topic.get(clean_topic)
        if entries is None:
            entries = []
            self._subscriptions_by_topic[clean_topic] = entries
        entries.append((handle, callback))
        self._topic_by_handle[handle] = clean_topic
        return handle

    def unsubscribe(self, handle):
        """Elimina una suscripción activa por su ``handle``."""

        topic = self._topic_by_handle.pop(handle, None)
        if topic is None:
            return False

        entries = self._subscriptions_by_topic.get(topic)
        if not entries:
            return False

        for index, (entry_handle, _) in enumerate(entries):
            if entry_handle == handle:
                entries.pop(index)
                break

        if not entries:
            self._subscriptions_by_topic.pop(topic, None)
        return True

    def subscriber_count(self, topic=None):
        """Cantidad de suscriptores registrados en ``topic`` o en todo el nodo."""

        if topic is None:
            return len(self._topic_by_handle)
        clean_topic = self._validate_topic(topic)
        return len(self._subscriptions_by_topic.get(clean_topic, ()))

    def publish(self, topic, payload=None):
        """Entrega ``payload`` a los suscriptores de ``topic``.

        Si un callback falla, se registra el error y se notifica a
        ``error_handler``, pero la suscripción permanece activa y los demás
        callbacks del topic continúan ejecutándose.
        """

        clean_topic = self._validate_topic(topic)
        if self._current_depth >= self.max_depth:
            exc = RuntimeError(
                "Profundidad máxima de publicación excedida en topic {}".format(clean_topic)
            )
            self._record_error(clean_topic, None, exc)
            return 0

        entries = list(self._subscriptions_by_topic.get(clean_topic, ()))
        if not entries:
            return 0

        delivered = 0
        self._current_depth += 1
        try:
            for handle, callback in entries:
                if handle not in self._topic_by_handle:
                    continue
                try:
                    callback(payload)
                    delivered += 1
                except Exception as exc:  # pragma: no cover - ejercitado en pruebas
                    self._record_error(clean_topic, callback, exc)
        finally:
            self._current_depth -= 1

        return delivered

    def _record_error(self, topic, callback, exc):
        self.error_count += 1
        self.last_error = exc
        if self.error_handler is not None:
            try:
                self.error_handler(topic, callback, exc)
            except Exception as handler_error:
                # El mecanismo de diagnóstico nunca debe interrumpir la
                # entrega a los demás suscriptores.
                self.error_handler_error_count += 1
                self.last_error_handler_error = handler_error
