import unittest

from firmware.pico.pubsub import (
    ENTRANTES,
    ENTRADA_ESTABLECER,
    ERROR,
    ESTADO_CONEXION,
    LED_COMANDO,
    LED_ESTADO,
    MODELO_CARGAR,
    MODELO_CONFIRMACION,
    Node,
    SALIDA,
    SALIENTES,
    SIMULACION_COMANDO,
    SIMULACION_ESTADO,
    TELEMETRIA,
    TOPIC_PREFIX,
    full_topic,
    relative_topic,
)
from firmware.tests.fakes import FakeTransport


class NodeTests(unittest.TestCase):
    def test_subscribe_publish_and_unsubscribe(self):
        node = Node()
        received = []

        handle = node.subscribe(LED_COMANDO, lambda payload: received.append(payload))
        self.assertEqual(node.subscriber_count(), 1)
        self.assertEqual(node.subscriber_count(LED_COMANDO), 1)

        delivered = node.publish(LED_COMANDO, {"accion": "encender"})
        self.assertEqual(delivered, 1)
        self.assertEqual(received, [{"accion": "encender"}])

        self.assertTrue(node.unsubscribe(handle))
        self.assertFalse(node.unsubscribe(handle))
        self.assertEqual(node.subscriber_count(), 0)
        self.assertEqual(node.publish(LED_COMANDO, {"accion": "apagar"}), 0)
        self.assertEqual(len(received), 1)

    def test_topic_isolation_and_multiple_subscribers(self):
        node = Node()
        led_events = []
        sim_events = []

        node.subscribe(LED_COMANDO, lambda p: led_events.append(("a", p)))
        node.subscribe(LED_COMANDO, lambda p: led_events.append(("b", p)))
        node.subscribe(SIMULACION_COMANDO, lambda p: sim_events.append(p))

        self.assertEqual(node.publish(LED_COMANDO, {"accion": "alternar"}), 2)
        self.assertEqual(len(led_events), 2)
        self.assertEqual(sim_events, [])

    def test_faulty_subscriber_does_not_unsubscribe_or_block_others(self):
        errors = []
        node = Node(error_handler=lambda topic, cb, exc: errors.append((topic, str(exc))))
        healthy_received = []
        should_fail = {"flag": True}

        def flaky_subscriber(payload):
            if should_fail["flag"]:
                raise RuntimeError("fallo simulado")
            healthy_received.append(("flaky_recovered", payload))

        node.subscribe(MODELO_CARGAR, flaky_subscriber)
        node.subscribe(MODELO_CARGAR, lambda payload: healthy_received.append(("healthy", payload)))

        delivered_first = node.publish(MODELO_CARGAR, {"version": 1})
        self.assertEqual(delivered_first, 1)
        self.assertEqual(node.error_count, 1)
        self.assertEqual( errors, [(MODELO_CARGAR, "fallo simulado")])
        self.assertEqual(healthy_received, [("healthy", {"version": 1})])
        self.assertEqual(node.subscriber_count(MODELO_CARGAR), 2)

        should_fail["flag"] = False
        delivered_second = node.publish(MODELO_CARGAR, {"version": 2})
        self.assertEqual(delivered_second, 2)
        self.assertEqual(len(healthy_received), 3)

    def test_faulty_error_handler_does_not_block_other_subscribers(self):
        healthy_received = []

        def faulty_error_handler(_topic, _callback, _error):
            raise RuntimeError("falló el manejador")

        node = Node(error_handler=faulty_error_handler)

        def faulty_subscriber(_payload):
            raise ValueError("falló callback")

        node.subscribe(MODELO_CARGAR, faulty_subscriber)
        node.subscribe(MODELO_CARGAR, healthy_received.append)

        delivered = node.publish(MODELO_CARGAR, {"version": 1})

        self.assertEqual(delivered, 1)
        self.assertEqual(healthy_received, [{"version": 1}])
        self.assertEqual(node.error_count, 1)
        self.assertEqual(node.error_handler_error_count, 1)
        self.assertEqual(str(node.last_error), "falló callback")
        self.assertEqual(str(node.last_error_handler_error), "falló el manejador")
        self.assertEqual(node.subscriber_count(MODELO_CARGAR), 2)

    def test_reentrant_publish_stops_at_max_depth(self):
        errors = []
        node = Node(
            error_handler=lambda topic, cb, exc: errors.append((topic, str(exc))),
            max_depth=3,
        )
        calls = []

        def recursive_subscriber(payload):
            calls.append(payload)
            node.publish(SIMULACION_COMANDO, payload + 1)

        node.subscribe(SIMULACION_COMANDO, recursive_subscriber)
        node.publish(SIMULACION_COMANDO, 1)

        self.assertEqual(calls, [1, 2, 3])
        self.assertEqual(node.error_count, 1)
        self.assertIn("Profundidad máxima", errors[0][1])

    def test_topics_helpers_and_policies(self):
        self.assertEqual(
            full_topic(MODELO_CARGAR),
            "udfjc/hiles/v1/equipo1/pico01/modelo/cargar",
        )
        self.assertEqual(
            relative_topic("udfjc/hiles/v1/equipo1/pico01/simulacion/estado"),
            SIMULACION_ESTADO,
        )
        self.assertIsNone(relative_topic("otro/prefijo/simulacion/estado"))
        self.assertIsNone(relative_topic(TOPIC_PREFIX))

        self.assertEqual(
            set(ENTRANTES),
            {LED_COMANDO, SIMULACION_COMANDO, ENTRADA_ESTABLECER, MODELO_CARGAR},
        )
        self.assertEqual(
            set(SALIENTES.keys()),
            {
                LED_ESTADO,
                ESTADO_CONEXION,
                TELEMETRIA,
                SALIDA,
                ERROR,
                MODELO_CONFIRMACION,
                SIMULACION_ESTADO,
            },
        )
        self.assertTrue(SALIENTES[LED_ESTADO]["retain"])
        self.assertTrue(SALIENTES[ESTADO_CONEXION]["retain"])
        self.assertTrue(SALIENTES[SIMULACION_ESTADO]["retain"])
        self.assertFalse(SALIENTES[MODELO_CONFIRMACION]["retain"])

    def test_fake_transport_captures_outgoing_and_injects_incoming(self):
        node = Node()
        transport = FakeTransport(node)
        received_commands = []
        node.subscribe(LED_COMANDO, lambda payload: received_commands.append(payload))

        ok = transport.inject(
            full_topic(LED_COMANDO),
            b'{"accion":"encender","id_mensaje":"m-1"}',
        )
        self.assertTrue(ok)
        self.assertEqual(received_commands, [{"accion": "encender", "id_mensaje": "m-1"}])

        node.publish(LED_ESTADO, {"encendido": True, "pin": "LED"})
        captured = transport.published_for(LED_ESTADO)
        self.assertEqual(len(captured), 1)
        self.assertEqual(captured[0]["full_topic"], full_topic(LED_ESTADO))
        self.assertEqual(captured[0]["qos"], 1)
        self.assertTrue(captured[0]["retain"])

        bad_json = transport.inject(full_topic(LED_COMANDO), "{json_roto")
        self.assertFalse(bad_json)
        errors = transport.published_for(ERROR)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["payload"]["codigo"], "JSON_INVALIDO")

        bad_topic = transport.inject("udfjc/hiles/v1/equipo1/pico01/desconocido", "{}")
        self.assertFalse(bad_topic)
        errors = transport.published_for(ERROR)
        self.assertEqual(len(errors), 2)
        self.assertEqual(errors[1]["payload"]["codigo"], "TOPIC_NO_SOPORTADO")

        transport.close()
        node.publish(LED_ESTADO, {"encendido": False})
        self.assertEqual(len(transport.published_for(LED_ESTADO)), 1)


if __name__ == "__main__":
    unittest.main()
