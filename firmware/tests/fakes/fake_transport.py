"""Doble determinista del transporte MQTT conectado a ``Node`` para pruebas en PC."""

import json

from firmware.pico.pubsub.topics import (
    ENTRANTES,
    ERROR,
    SALIENTES,
    TOPIC_PREFIX,
    full_topic,
    relative_topic,
)


class FakeTransport:
    """Simula el puente entre un broker MQTT y el bus interno ``Node``."""

    def __init__(self, node, prefix=TOPIC_PREFIX, outgoing_policies=None):
        self.node = node
        self.prefix = prefix
        self.outgoing_policies = dict(outgoing_policies or SALIENTES)
        self.published = []
        self._handles = []

        for suffix, policy in self.outgoing_policies.items():
            handle = self.node.subscribe(
                suffix,
                self._make_outgoing_listener(suffix, policy),
            )
            self._handles.append(handle)

    def _make_outgoing_listener(self, suffix, policy):
        def _listener(payload):
            self.published.append(
                {
                    "topic": suffix,
                    "full_topic": full_topic(suffix, self.prefix),
                    "payload": payload,
                    "qos": policy["qos"],
                    "retain": policy["retain"],
                }
            )

        return _listener

    def published_for(self, suffix):
        """Retorna la lista de mensajes capturados para un topic relativo."""

        return [item for item in self.published if item["topic"] == suffix]

    def clear(self):
        """Limpia el historial de mensajes salientes capturados."""

        self.published.clear()

    def close(self):
        """Cancela las suscripciones del transporte sobre ``Node``."""

        while self._handles:
            handle = self._handles.pop()
            self.node.unsubscribe(handle)

    def inject(self, topic, raw_payload):
        """Inyecta un mensaje entrante (como ``dict``, ``str`` o ``bytes``) hacia ``Node``."""

        suffix = relative_topic(topic, self.prefix)
        if suffix is None and isinstance(topic, str) and topic in ENTRANTES:
            suffix = topic

        if suffix is None or suffix not in ENTRANTES:
            self.node.publish(
                ERROR,
                {
                    "codigo": "TOPIC_NO_SOPORTADO",
                    "mensaje": "Topic entrante no soportado: {}".format(topic),
                },
            )
            return False

        try:
            if isinstance(raw_payload, bytes):
                parsed = json.loads(raw_payload.decode("utf-8"))
            elif isinstance(raw_payload, str):
                parsed = json.loads(raw_payload)
            elif isinstance(raw_payload, dict):
                parsed = dict(raw_payload)
            else:
                raise ValueError("Formato de payload no soportado")
        except Exception as exc:
            self.node.publish(
                ERROR,
                {
                    "codigo": "JSON_INVALIDO",
                    "mensaje": "Payload JSON inválido en {}: {}".format(suffix, exc),
                },
            )
            return False

        if not isinstance(parsed, dict):
            self.node.publish(
                ERROR,
                {
                    "codigo": "JSON_INVALIDO",
                    "mensaje": "El payload de {} debe ser un objeto JSON".format(suffix),
                },
            )
            return False

        self.node.publish(suffix, parsed)
        return True
