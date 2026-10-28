import json
import unittest

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.devices.led_task import APAGADO, LedTask
from firmware.pico.main import build_default_application
from firmware.pico.hiles.engine_task_v2 import EngineTaskV2
from firmware.pico.platform.mqtt_client import create_mqtt_client
from firmware.pico.platform.wifi import WifiConnection
from firmware.pico.pubsub import (
    MODELO_CARGAR,
    MODELO_CONFIRMACION,
    ERROR,
    ESTADO_CONEXION,
    LED_COMANDO,
    LED_ESTADO,
    SIMULACION_COMANDO,
    SIMULACION_ESTADO,
    Node,
)
from firmware.pico.pubsub.mqtt_transport import MqttTransport
from firmware.pico.pubsub.topics import (
    build_executor_id,
    build_v1_prefix,
    mqtt_topic_matches,
    v3_ack_topic,
    v3_channel_topic,
    v3_command_topic,
    v3_error_topic,
    v3_executor_status_filter,
    v3_executor_status_topic,
    v3_fragment_filter,
    v3_fragment_topic,
    v3_input_topic,
    v3_manifest_topic,
    v3_snapshot_topic,
    validate_segment_v3,
)
from firmware.pico.platform.hardware import resolve_device_id
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
        self.check_msg_count = 0
        self.wait_msg_count = 0
        self.ping_count = 0
        self.raise_on_check = False
        self.idle_on_check = False
        self.connect_timeout = None
        self.last_will = None

    def set_last_will(self, topic, payload, retain=False, qos=0):
        self.last_will = (topic, payload, retain, qos)

    def set_callback(self, callback):
        self.callback = callback

    def connect(self, timeout=None):
        self.connect_timeout = timeout
        self.connected = True

    def subscribe(self, topic, qos=0):
        self.subscriptions.append((topic, qos))

    def publish(self, topic, payload, qos=0, retain=False):
        self.published.append((topic, payload, qos, retain))

    def check_msg(self):
        self.check_msg_count += 1
        if self.idle_on_check:
            raise OSError(-1)
        if self.raise_on_check:
            raise OSError("broker desconectado")
        if self.incoming:
            topic, payload = self.incoming.pop(0)
            self.callback(topic, payload)

    def wait_msg(self):
        self.wait_msg_count += 1
        if self.incoming:
            topic, payload = self.incoming.pop(0)
            self.callback(topic, payload)

    def ping(self):
        self.ping_count += 1

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
        self.assertEqual(client.connect_timeout, 2)
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

    def test_reconnects_after_check_msg_failure_without_retrying_in_a_tight_loop(self):
        clock, scheduler, _node, _wifi, clients, transport = self.create()
        transport.reconnect_interval_ms = 5
        scheduler.run_pending()
        clients[0].raise_on_check = True

        clock.advance_ms(1)
        scheduler.run_pending()
        self.assertFalse(transport.connected)
        self.assertEqual(len(clients), 1)

        clock.advance_ms(4)
        scheduler.run_pending()
        self.assertEqual(len(clients), 1)
        clock.advance_ms(1)
        scheduler.run_pending()
        self.assertEqual(len(clients), 2)
        self.assertTrue(transport.connected)

    def test_keeps_connection_when_nonblocking_socket_has_no_message(self):
        clock, scheduler, _node, _wifi, clients, transport = self.create()
        scheduler.run_pending()
        client = clients[0]
        client.idle_on_check = True

        clock.advance_ms(1)
        scheduler.run_pending()

        self.assertTrue(transport.connected)
        self.assertIs(transport.client, client)
        self.assertEqual(len(clients), 1)

    def test_socket_poller_avoids_empty_nonblocking_reads(self):
        class FakePoller:
            def __init__(self):
                self.ready = False

            def poll(self, _timeout):
                return [(1, 1)] if self.ready else []

        clock, scheduler, node, _wifi, clients, transport = self.create()
        received = []
        node.subscribe(LED_COMANDO, received.append)
        scheduler.run_pending()
        client = clients[0]
        poller = FakePoller()
        transport._socket_poller = poller

        clock.advance_ms(1)
        scheduler.run_pending()
        self.assertEqual(client.wait_msg_count, 0)

        client.incoming.append((b"udfjc/hiles/v1/equipo1/pico01/led/comando", b'{"accion":"encender"}'))
        poller.ready = True
        clock.advance_ms(1)
        scheduler.run_pending()
        self.assertEqual(client.wait_msg_count, 1)
        self.assertEqual(received, [{"accion": "encender"}])

    def test_sends_keepalive_ping_before_broker_timeout(self):
        clock, scheduler, _node, _wifi, clients, transport = self.create()
        scheduler.run_pending()
        client = clients[0]

        clock.advance_ms(14999)
        scheduler.run_pending()
        self.assertEqual(client.ping_count, 0)
        clock.advance_ms(1)
        scheduler.run_pending()

        self.assertEqual(client.ping_count, 1)
        self.assertTrue(transport.connected)

    def test_rejects_oversized_internal_publication(self):
        _clock, scheduler, node, _wifi, clients, transport = self.create()
        errors = []
        node.subscribe(ERROR, errors.append)
        scheduler.run_pending()
        clients[0].published.clear()
        transport.max_payload_bytes = 16

        node.publish(LED_ESTADO, {"mensaje": "x" * 40})

        self.assertEqual(clients[0].published, [])
        self.assertEqual(errors[-1]["codigo"], "PAYLOAD_DEMASIADO_GRANDE")

    def test_led_blink_and_mqtt_messages_share_the_cooperative_scheduler(self):
        clock, scheduler, node, _wifi, clients, _transport = self.create()
        from firmware.tests.fakes import FakeLed

        led = FakeLed()
        remote_commands = []
        led_task = LedTask(scheduler, led, period_ms=1, blink_interval_ms=10, blink_count=2)
        node.subscribe(LED_COMANDO, lambda payload: led_task.command(payload["accion"], payload["id_mensaje"]))
        node.subscribe(SIMULACION_COMANDO, remote_commands.append)
        scheduler.run_pending()  # conecta el transporte
        clients[0].incoming.append((b"udfjc/hiles/v1/equipo1/pico01/led/comando", b'{"accion":"titilar","id_mensaje":"m-2"}'))
        clock.advance_ms(1)
        scheduler.run_pending()
        self.assertNotEqual(led_task.state, APAGADO)
        clients[0].incoming.append((
            b"udfjc/hiles/v1/equipo1/pico01/simulacion/comando",
            b'{"accion":"paso","id_mensaje":"m-3"}',
        ))
        clock.advance_ms(1)
        scheduler.run_pending()
        self.assertEqual(remote_commands, [{"accion": "paso", "id_mensaje": "m-3"}])
        self.assertNotEqual(led_task.state, APAGADO)
        for _ in range(40):
            clock.advance_ms(1)
            scheduler.run_pending()
        self.assertEqual(led_task.state, APAGADO)
        self.assertGreaterEqual(len(led.transitions), 5)


class WifiConnectionTests(unittest.TestCase):
    def test_retries_after_connection_loss_without_sleep(self):
        class FakeWlan:
            def __init__(self):
                self.connected = False
                self.connect_count = 0

            def active(self, _enabled):
                return None

            def isconnected(self):
                return self.connected

            def connect(self, _ssid, _password):
                self.connect_count += 1

        clock = FakeClock()
        wlan = FakeWlan()
        wifi = WifiConnection("red", "clave", wlan=wlan, retry_interval_ms=5, clock=clock)

        self.assertFalse(wifi.poll())
        self.assertEqual(wlan.connect_count, 1)
        clock.advance_ms(4)
        self.assertFalse(wifi.poll())
        self.assertEqual(wlan.connect_count, 1)
        clock.advance_ms(1)
        self.assertFalse(wifi.poll())
        self.assertEqual(wlan.connect_count, 2)


class MqttClientFactoryTests(unittest.TestCase):
    def test_encodes_umqtt_identifiers_and_credentials_as_bytes(self):
        captured = {}

        class FakeMqttModule:
            @staticmethod
            def MQTTClient(client_id, host, **kwargs):
                captured.update(client_id=client_id, host=host, **kwargs)
                return object()

        create_mqtt_client(
            "pico01",
            "broker",
            username="usuario",
            password="secreto",
            mqtt_module=FakeMqttModule,
        )

        self.assertEqual(captured["client_id"], b"pico01")
        self.assertEqual(captured["user"], b"usuario")
        self.assertEqual(captured["password"], b"secreto")


class DefaultApplicationTests(unittest.TestCase):
    def test_main_composition_routes_led_command_and_publishes_state(self):
        class Config:
            WIFI_SSID = "red"
            WIFI_PASSWORD = "clave"
            MQTT_HOST = "broker"
            MQTT_PORT = 1883
            MQTT_USERNAME = "usuario"
            MQTT_PASSWORD = "secreto"
            MQTT_CLIENT_ID = "pico-prueba"

        class FakePin:
            OUT = 1

            def __init__(self, _name, _mode):
                self.state = False

            def on(self):
                self.state = True

            def off(self):
                self.state = False

            def value(self):
                return int(self.state)

        class FakeMachine:
            Pin = FakePin

        class FakeWlan:
            def __init__(self):
                self.connected = False

            def active(self, _enabled):
                return None

            def isconnected(self):
                return self.connected

            def connect(self, _ssid, _password):
                self.connected = True

            def ifconfig(self):
                return ("127.0.0.1", "255.0.0.0", "127.0.0.1", "127.0.0.1")

        class FakeNetwork:
            STA_IF = 0
            wlan = FakeWlan()

            @classmethod
            def WLAN(cls, _station):
                return cls.wlan

        class FakeMqttModule:
            clients = []

            @classmethod
            def MQTTClient(cls, *_args, **_kwargs):
                client = FakeMqttClient()
                cls.clients.append(client)
                return client

        clock = FakeClock()
        scheduler = build_default_application(
            config=Config,
            clock=clock,
            machine_module=FakeMachine,
            network_module=FakeNetwork,
            mqtt_module=FakeMqttModule,
        )
        scheduler.run_pending()
        client = FakeMqttModule.clients[0]
        client.incoming.append((
            b"udfjc/hiles/v1/equipo1/pico-prueba/led/comando",
            b'{"accion":"encender","id_mensaje":"integracion-1"}',
        ))

        clock.advance_ms(10)
        scheduler.run_pending()

        led_states = [
            json.loads(payload)
            for topic, payload, _qos, _retain in client.published
            if topic.endswith(b"/led/estado")
        ]
        self.assertEqual(led_states[-1], {
            "encendido": True,
            "accion_aplicada": "encender",
            "id_mensaje": "integracion-1",
        })

    def test_main_composition_routes_model_through_engine_and_mqtt(self):
        class Config:
            WIFI_SSID = "red"
            WIFI_PASSWORD = "clave"
            MQTT_HOST = "broker"
            MQTT_PORT = 1883
            MQTT_USERNAME = "usuario"
            MQTT_PASSWORD = "secreto"
            MQTT_CLIENT_ID = "pico-prueba-motor"

        class FakePin:
            OUT = 1

            def __init__(self, _name, _mode):
                self.state = False

            def on(self): self.state = True
            def off(self): self.state = False

        class FakeMachine:
            Pin = FakePin

        class FakeWlan:
            def __init__(self): self.connected = False
            def active(self, _enabled): return None
            def isconnected(self): return self.connected
            def connect(self, _ssid, _password): self.connected = True

        class FakeNetwork:
            STA_IF = 0
            wlan = FakeWlan()

            @classmethod
            def WLAN(cls, _station): return cls.wlan

        class FakeMqttModule:
            clients = []

            @classmethod
            def MQTTClient(cls, *_args, **_kwargs):
                client = FakeMqttClient()
                cls.clients.append(client)
                return client

        from firmware.tests.hiles_vectors import load_vectors
        _name, vector = load_vectors("ejecucion")[0]
        clock = FakeClock()
        scheduler = build_default_application(
            config=Config,
            clock=clock,
            machine_module=FakeMachine,
            network_module=FakeNetwork,
            mqtt_module=FakeMqttModule,
        )
        scheduler.run_pending()
        client = FakeMqttModule.clients[0]
        client.incoming.append((
            b"udfjc/hiles/v1/equipo1/pico-prueba-motor/modelo/cargar",
            json.dumps({
                "modelo_id": "integracion-motor",
                "version": 1,
                "ir_version": 1,
                "modelo": vector["modelo"],
                "id_mensaje": "carga-integrada-1",
            }).encode("utf-8"),
        ))

        clock.advance_ms(20)
        scheduler.run_pending()

        published = [(topic, json.loads(payload)) for topic, payload, _qos, _retain in client.published]
        confirmations = [payload for topic, payload in published if topic.endswith(b"/modelo/confirmacion")]
        snapshots = [payload for topic, payload in published if topic.endswith(b"/simulacion/estado")]
        self.assertEqual(confirmations[-1]["aceptado"], True)
        self.assertEqual(confirmations[-1]["id_mensaje"], "carga-integrada-1")
        self.assertEqual(snapshots[-1]["modelo_id"], "integracion-motor")
        self.assertEqual(snapshots[-1]["secuencia"], 0)
        self.assertIs(scheduler.components["engine"].engine is not None, True)
        self.assertIsInstance(scheduler.components["engine"], EngineTaskV2)
        self.assertEqual(scheduler.components["engine"].queue_size, 32)
        self.assertIsNotNone(scheduler.components["watchdog"])
        self.assertEqual(scheduler.components["device_id"], "pico-prueba-motor")
        self.assertEqual(scheduler.components["executor_id"], "pico:pico-prueba-motor")
        self.assertEqual(
            scheduler.components["topic_prefix"],
            "udfjc/hiles/v1/equipo1/pico-prueba-motor/",
        )

    def test_resolve_device_id_prefers_config_then_unique_id_then_client_id(self):
        class ConfigWithDeviceId:
            DEVICE_ID = "pico-norte"
            MQTT_CLIENT_ID = "cliente-alterno"

        class ConfigWithoutDeviceId:
            DEVICE_ID = ""
            MQTT_CLIENT_ID = "cliente-alterno"

        class FakeMachineUnique:
            @staticmethod
            def unique_id():
                return b"\xe6\x61\x41\x03"

        self.assertEqual(
            resolve_device_id(config=ConfigWithDeviceId, machine_module=FakeMachineUnique),
            "pico-norte",
        )
        self.assertEqual(
            resolve_device_id(config=ConfigWithoutDeviceId, machine_module=FakeMachineUnique),
            "pico-e6614103",
        )
        self.assertEqual(
            resolve_device_id(config=ConfigWithoutDeviceId, machine_module=object()),
            "cliente-alterno",
        )


class DistributedV3TopicsAndTransportTests(unittest.TestCase):
    def test_v3_topic_builders_and_wildcard_matching_mirror_frontend_contract(self):
        self.assertEqual(build_v1_prefix("pico02", "equipoA"), "udfjc/hiles/v1/equipoA/pico02/")
        self.assertEqual(build_executor_id("pico02"), "pico:pico02")
        self.assertEqual(build_executor_id("pico:pico02"), "pico:pico02")
        self.assertEqual(
            v3_executor_status_topic("demo", "pico:01"),
            "udfjc/hiles/v3/projects/demo/executors/pico:01/status",
        )
        self.assertEqual(
            v3_executor_status_filter("demo"),
            "udfjc/hiles/v3/projects/demo/executors/+/status",
        )
        self.assertEqual(
            v3_manifest_topic("demo"),
            "udfjc/hiles/v3/projects/demo/deployments/manifest",
        )
        self.assertEqual(
            v3_fragment_topic("demo", "deploy-1", "pico:01"),
            "udfjc/hiles/v3/projects/demo/deployments/deploy-1/fragments/pico:01",
        )
        self.assertEqual(
            v3_fragment_filter("demo", "pico:01"),
            "udfjc/hiles/v3/projects/demo/deployments/+/fragments/pico:01",
        )
        self.assertEqual(
            v3_ack_topic("demo", "deploy-1", "pico:01"),
            "udfjc/hiles/v3/projects/demo/deployments/deploy-1/ack/pico:01",
        )
        self.assertEqual(
            v3_channel_topic("demo", "deploy-1", "conn-a-b"),
            "udfjc/hiles/v3/projects/demo/deployments/deploy-1/channels/conn-a-b",
        )
        self.assertEqual(
            v3_snapshot_topic("demo", "deploy-1", "pico:01"),
            "udfjc/hiles/v3/projects/demo/deployments/deploy-1/snapshot/pico:01",
        )
        self.assertEqual(
            v3_error_topic("demo", "deploy-1"),
            "udfjc/hiles/v3/projects/demo/deployments/deploy-1/error",
        )
        self.assertEqual(
            v3_command_topic("demo", "deploy-1"),
            "udfjc/hiles/v3/projects/demo/deployments/deploy-1/command",
        )
        self.assertEqual(
            v3_input_topic("demo", "deploy-1"),
            "udfjc/hiles/v3/projects/demo/deployments/deploy-1/input",
        )
        for invalid in ("", "  ", "proy/1", "proy+1", "proy#1", "proy\x001"):
            with self.assertRaises(ValueError):
                validate_segment_v3(invalid, "projectId")

        pattern = v3_fragment_filter("demo", "pico:a")
        self.assertTrue(
            mqtt_topic_matches(pattern, "udfjc/hiles/v3/projects/demo/deployments/dep-9/fragments/pico:a")
        )
        self.assertFalse(
            mqtt_topic_matches(pattern, "udfjc/hiles/v3/projects/demo/deployments/dep-9/fragments/pico:b")
        )

    def test_absolute_subscriptions_raw_bytes_empty_retained_last_will_and_clean_reconnect(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        node = Node()
        wifi = FakeWifi(connected=True)
        clients = []
        events = []

        def factory(*_args):
            client = FakeMqttClient()
            clients.append(client)
            return client

        transport = MqttTransport(
            scheduler,
            node,
            wifi,
            factory,
            client_id="pico-a",
            prefix=build_v1_prefix("pico-a"),
            period_ms=1,
        )
        status_topic = v3_executor_status_topic("demo", "pico:a")
        transport.set_last_will(status_topic, {"estado": "offline"}, qos=1, retain=True)
        transport.on_connection_change(events.append)

        received_fragments = []
        transport.subscribe_absolute(
            v3_fragment_filter("demo", "pico:a"),
            lambda topic, payload, raw: received_fragments.append((topic, payload, raw)),
            qos=1,
            raw=True,
        )

        scheduler.run_pending()
        client = clients[0]
        self.assertEqual(events, [True])
        self.assertIsNotNone(client.last_will)
        self.assertEqual(client.last_will[0], status_topic.encode("utf-8"))
        self.assertEqual(json.loads(client.last_will[1]), {"estado": "offline"})
        self.assertEqual(client.last_will[2:], (True, 1))

        frag_topic = v3_fragment_topic("demo", "dep-1", "pico:a")
        raw_body = b'{"deployment_id":"dep-1","epoch":1}'
        client.incoming.append((frag_topic.encode("utf-8"), raw_body))
        client.incoming.append((frag_topic.encode("utf-8"), b""))
        clock.advance_ms(1)
        scheduler.run_pending()
        clock.advance_ms(1)
        scheduler.run_pending()

        self.assertEqual(len(received_fragments), 2)
        self.assertEqual(received_fragments[0], (frag_topic, {"deployment_id": "dep-1", "epoch": 1}, raw_body))
        self.assertEqual(received_fragments[1], (frag_topic, None, b""))

        # Publicación absoluta y reconexión limpia para soltar suscripciones dinámicas antiguas.
        channel_handle = transport.subscribe_absolute(
            v3_channel_topic("demo", "dep-1", "conn-1"),
            lambda _t, _p: None,
            qos=1,
        )
        self.assertTrue(transport.publish_absolute(status_topic, {"estado": "ready"}, qos=1, retain=True))
        self.assertTrue(transport.unsubscribe_absolute(channel_handle))
        self.assertTrue(transport.request_clean_reconnect())
        self.assertTrue(transport.connected)
        self.assertEqual(len(clients), 2)
        self.assertEqual(events, [True, True])
        second_subs = [sub[0] for sub in clients[1].subscriptions]
        self.assertIn(v3_fragment_filter("demo", "pico:a").encode("utf-8"), second_subs)
        self.assertNotIn(v3_channel_topic("demo", "dep-1", "conn-1").encode("utf-8"), second_subs)


if __name__ == "__main__":
    unittest.main()

