import json
import unittest

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.devices.led_task import APAGADO, LedTask
from firmware.pico.pubsub import ERROR, ESTADO_CONEXION, LED_COMANDO, LED_ESTADO, Node
from firmware.pico.pubsub.mqtt_transport import MqttTransport
from firmware.tests.fakes import FakeClock


class FakeWifi:
    def __init__(self, connected=True):
        self.connected = connected
        self.poll_count = 0

    def poll(self):
        self.poll_count += 1
        return self.connected


class FakeMqttClient:
    def __init__(self):
        self.callback = None
        self.connected = False
        self.subscriptions = []
        self.published = []
        self.incoming = []

    def set_callback(self, callback):
        self.callback = callback

    def connect(self):
        self.connected = True

    def subscribe(self, topic, qos=0):
        self.subscriptions.append((topic, qos))

    def publish(self, topic, payload, qos=0, retain=False):
        self.published.append((topic, payload, qos, retain))

    def check_msg(self):
        if self.incoming:
            topic, payload = self.incoming.pop(0)
            self.callback(topic, payload)

    def disconnect(self):
        self.connected = False


class MqttTransportTests(unittest.TestCase):
    def create(self, connected=True):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        node = Node()
        wifi = FakeWifi(connected=connected)
        clients = []

        def factory(*_args):
            client = FakeMqttClient()
            clients.append(client)
            return client

        transport = MqttTransport(scheduler, node, wifi, factory, period_ms=1)
        return clock, scheduler, node, wifi, clients, transport

    def test_connects_subscribes_and_routes_internal_publications(self):
        _clock, scheduler, node, _wifi, clients, _transport = self.create()
        scheduler.run_pending()
        client = clients[0]
        self.assertTrue(client.connected)
        self.assertEqual(len(client.subscriptions), 4)
        self.assertEqual(node.subscriber_count(LED_ESTADO), 1)

        node.publish(LED_ESTADO, {"encendido": True, "accion_aplicada": "encender"})
        self.assertEqual(len(client.published), 2)  # estado de conexión + LED
        self.assertEqual(json.loads(client.published[-1][1]), {"encendido": True, "accion_aplicada": "encender"})
        self.assertEqual(client.published[-1][2:], (1, True))

    def test_routes_json_incoming_without_blocking(self):
        _clock, scheduler, node, _wifi, clients, _transport = self.create()
        received = []
        node.subscribe(LED_COMANDO, received.append)
        scheduler.run_pending()
        client = clients[0]
        client.incoming.append((b"udfjc/hiles/v1/equipo1/pico01/led/comando", b'{"accion":"titilar","id_mensaje":"m-1"}'))
        _clock.advance_ms(1)
        scheduler.run_pending()
        self.assertEqual(received, [{"accion": "titilar", "id_mensaje": "m-1"}])

    def test_invalid_json_and_topic_are_reported_on_internal_error_topic(self):
        _clock, scheduler, node, _wifi, clients, _transport = self.create()
        errors = []
        node.subscribe(ERROR, errors.append)
        scheduler.run_pending()
        client = clients[0]
        client.incoming.append((b"udfjc/hiles/v1/equipo1/pico01/led/comando", b"{roto"))
        client.incoming.append((b"udfjc/hiles/v1/equipo1/pico01/no-existe", b"{}"))
        _clock.advance_ms(1)
        scheduler.run_pending()
        _clock.advance_ms(1)
        scheduler.run_pending()
        self.assertEqual([item["codigo"] for item in errors], ["JSON_INVALIDO", "TOPIC_NO_SOPORTADO"])

    def test_wifi_disconnect_does_not_create_mqtt_client(self):
        _clock, scheduler, _node, wifi, clients, _transport = self.create(connected=False)
        scheduler.run_pending()
        self.assertEqual(clients, [])
        self.assertEqual(wifi.poll_count, 1)

    def test_led_blink_and_mqtt_messages_share_the_cooperative_scheduler(self):
        clock, scheduler, node, _wifi, clients, _transport = self.create()
        from firmware.tests.fakes import FakeLed

        led = FakeLed()
        led_task = LedTask(scheduler, led, period_ms=1, blink_interval_ms=2, blink_count=2)
        node.subscribe(LED_COMANDO, lambda payload: led_task.command(payload["accion"], payload["id_mensaje"]))
        scheduler.run_pending()  # conecta el transporte
        clients[0].incoming.append((b"udfjc/hiles/v1/equipo1/pico01/led/comando", b'{"accion":"titilar","id_mensaje":"m-2"}'))
        clock.advance_ms(1)
        scheduler.run_pending()
        self.assertNotEqual(led_task.state, APAGADO)
        for _ in range(8):
            clock.advance_ms(1)
            scheduler.run_pending()
        self.assertEqual(led_task.state, APAGADO)
        self.assertGreaterEqual(len(led.transitions), 5)


if __name__ == "__main__":
    unittest.main()

