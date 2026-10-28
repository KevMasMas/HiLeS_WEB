"""Pruebas de aceptación para Persona 2: worker MicroPython multi-Pico (v3).

Cubre:
1. Paridad criptográfica SHA-256 y serialización canónica contra los vectores
   generados por el particionador TypeScript (`docs/mqtt/vectores_v3/01_fixtures_distribucion_v3.json`).
2. Criterio 1: dos workers no consumen ni confirman fragmentos ajenos.
3. Criterio 2: un worker publica exactamente una vez cada salida lógica aunque
   MQTT repita el mensaje o haya reconexión, y descarta secuencias repetidas o
   atrasadas en recepción.
4. Criterio 3: reiniciar un worker no cambia la propiedad de los demás y recupera
   su fragmento desde los mensajes retenidos del broker.
5. Criterio 4: perder el broker deja el runtime en un estado observable (`degraded`
   local + Last Will `offline` en el broker), el motor local continúa cooperativamente,
   y al regresar el broker resincroniza manifiesto/fragmento y vacía el outbox pendiente.
6. Rechazo atómico (hash corrupto, propietario inválido, capacidad o lenguaje no
   soportado) conservando el fragmento anterior activo.
7. Liberación explícita de fragmentos (`unload_fragment` por limpieza de retained o
   redespliegue sin asignación) y reconexión limpia al cambiar de `deployment_id`.
8. Cadena completa con 3 Pico W conectadas (`pico:1` -> `pico:2` -> `pico:3`).
"""

import json
import unittest
from pathlib import Path

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.hiles.distributed_worker import (
    DistributedWorker,
    canonical_json_bytes,
    canonical_json_str,
    sha256_hex,
)
from firmware.pico.hiles.engine_task_v2 import EngineTaskV2
from firmware.pico.pubsub.mqtt_transport import MqttTransport
from firmware.pico.pubsub.node import Node
from firmware.pico.pubsub.topics import (
    build_v1_prefix,
    mqtt_topic_matches,
    v3_ack_topic,
    v3_channel_topic,
    v3_command_topic,
    v3_error_topic,
    v3_executor_status_topic,
    v3_fragment_topic,
    v3_input_topic,
    v3_manifest_topic,
    v3_snapshot_topic,
)
from firmware.tests.fakes import FakeClock

VECTORS_V3_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "mqtt"
    / "vectores_v3"
    / "01_fixtures_distribucion_v3.json"
)
BASE_METADATA_V2 = {
    "documento_schema_version": 2,
    "compilado_en": "2026-10-28T12:00:00.000Z",
    "bloque_raiz_id": None,
}


class _BrokerClientSession:
    def __init__(self, broker, client_id):
        self.broker = broker
        self.client_id = client_id.decode("utf-8") if isinstance(client_id, bytes) else str(client_id)
        self.callback = None
        self.connected = False
        self.subscriptions = []
        self.incoming = []
        self.last_will = None
        self.broken = False

    def set_callback(self, callback):
        self.callback = callback

    def set_last_will(self, topic, payload, retain=False, qos=0):
        t_str = topic.decode("utf-8") if isinstance(topic, bytes) else str(topic)
        raw = payload if isinstance(payload, bytes) else str(payload).encode("utf-8")
        self.last_will = (t_str, raw, bool(retain), int(qos))

    def connect(self, timeout=None):
        if self.broken:
            raise OSError("broker inaccesible")
        self.connected = True
        self.subscriptions = []
        self.broker._register_session(self)

    def subscribe(self, topic, qos=0):
        if not self.connected or self.broken:
            raise OSError("cliente desconectado")
        pattern = topic.decode("utf-8") if isinstance(topic, bytes) else str(topic)
        if pattern not in self.subscriptions:
            self.subscriptions.append(pattern)
        for retained_topic, retained_payload in sorted(self.broker.retained.items()):
            if mqtt_topic_matches(pattern, retained_topic):
                self.incoming.append((retained_topic.encode("utf-8"), retained_payload))

    def publish(self, topic, payload, qos=0, retain=False):
        if not self.connected or self.broken:
            raise OSError("cliente desconectado al publicar")
        t_str = topic.decode("utf-8") if isinstance(topic, bytes) else str(topic)
        raw = payload if isinstance(payload, bytes) else str(payload).encode("utf-8")
        self.broker.publish_raw(t_str, raw, qos=int(qos), retain=bool(retain), sender=self.client_id)

    def check_msg(self):
        if not self.connected or self.broken:
            raise OSError("conexión perdida con el broker")
        if self.incoming and self.callback is not None:
            topic, payload = self.incoming.pop(0)
            self.callback(topic, payload)

    def ping(self):
        if not self.connected or self.broken:
            raise OSError("ping fallido")

    def disconnect(self):
        self.connected = False


class FakeBroker:
    """Enrutador MQTT determinista en memoria compartido por múltiples workers."""

    def __init__(self):
        self.sessions = []
        self.retained = {}
        self.history = []

    def _register_session(self, session):
        if session not in self.sessions:
            self.sessions.append(session)

    def client_factory_for(self, default_client_id="pico"):
        def _factory(client_id=None, *_args, **_kwargs):
            return _BrokerClientSession(self, client_id or default_client_id)

        return _factory

    def publish_raw(self, topic, raw_payload, qos=1, retain=False, sender="controller"):
        if not isinstance(raw_payload, bytes):
            raw_payload = str(raw_payload).encode("utf-8")
        if retain:
            if len(raw_payload) == 0:
                self.retained.pop(topic, None)
            else:
                self.retained[topic] = raw_payload

        parsed = None
        if len(raw_payload) > 0:
            try:
                parsed = json.loads(raw_payload.decode("utf-8"))
            except Exception:
                parsed = None
        self.history.append({
            "topic": topic,
            "raw": raw_payload,
            "payload": parsed,
            "qos": int(qos),
            "retain": bool(retain),
            "sender": sender,
        })

        for session in list(self.sessions):
            if not session.connected or session.broken:
                continue
            if any(mqtt_topic_matches(pattern, topic) for pattern in session.subscriptions):
                session.incoming.append((topic.encode("utf-8"), raw_payload))

    def publish_json(self, topic, payload_obj, qos=1, retain=False, sender="controller"):
        if payload_obj is None or payload_obj == b"":
            raw = b""
        elif isinstance(payload_obj, bytes):
            raw = payload_obj
        elif isinstance(payload_obj, str):
            raw = payload_obj.encode("utf-8")
        else:
            raw = json.dumps(payload_obj, separators=(",", ":")).encode("utf-8")
        self.publish_raw(topic, raw, qos=qos, retain=retain, sender=sender)

    def simulate_abrupt_drop(self, session):
        session.broken = True
        if session.connected and session.last_will is not None:
            will_topic, will_raw, will_retain, will_qos = session.last_will
            self.publish_raw(
                will_topic,
                will_raw,
                qos=will_qos,
                retain=will_retain,
                sender="broker:last_will",
            )

    def messages_for(self, topic_pattern):
        return [
            item for item in self.history
            if mqtt_topic_matches(topic_pattern, item["topic"])
        ]


class _AlwaysConnectedWifi:
    def __init__(self, connected=True):
        self.connected = connected

    def poll(self):
        return self.connected


class _Rig:
    """Agrupa reloj, scheduler, transporte, motor y worker de una Pico simulada."""

    def __init__(
        self,
        broker,
        project_id,
        device_id,
        tipo="pico",
        executor_id=None,
        max_fragment_bytes=30000,
        max_elementos=64,
        lenguajes=("python", "expresion"),
    ):
        self.broker = broker
        self.clock = FakeClock()
        self.scheduler = Scheduler(clock=self.clock)
        self.node = Node()
        self.wifi = _AlwaysConnectedWifi(connected=True)
        self.engine_task = EngineTaskV2(
            self.scheduler,
            self.node,
            period_ms=5,
            step_interval_ms=100,
            queue_size=32,
        )
        self.transport = MqttTransport(
            self.scheduler,
            self.node,
            self.wifi,
            broker.client_factory_for(device_id),
            client_id=device_id,
            prefix=build_v1_prefix(device_id),
            period_ms=1,
            reconnect_interval_ms=10,
        )
        self.worker = DistributedWorker(
            self.scheduler,
            self.transport,
            self.engine_task,
            project_id=project_id,
            executor_id=executor_id,
            device_id=device_id,
            tipo=tipo,
            max_fragment_bytes=max_fragment_bytes,
            max_elementos=max_elementos,
            lenguajes=lenguajes,
            period_ms=2,
            status_period_ms=1000,
            memory_reader=lambda: 81920,
        )

    def tick(self, steps=6, advance_ms=1):
        for _ in range(steps):
            self.clock.advance_ms(advance_ms)
            self.scheduler.run_pending()


def _tick_all(rigs, rounds=8, advance_ms=1):
    for _ in range(rounds):
        for rig in rigs:
            rig.tick(steps=1, advance_ms=advance_ms)


def _deploy_scenario(broker, scenario):
    """Publica manifiesto y fragmentos retenidos de un escenario sobre el broker en memoria."""

    project_id = scenario["project_id"]
    deployment_id = scenario["deployment_id"]
    broker.publish_json(v3_manifest_topic(project_id), scenario["manifest"], qos=1, retain=True)
    for fragment in scenario["fragments"]:
        exec_id = fragment["executor_id"]
        raw = (
            scenario["canonical_fragments"][exec_id].encode("utf-8")
            if "canonical_fragments" in scenario and exec_id in scenario["canonical_fragments"]
            else canonical_json_bytes(fragment)
        )
        broker.publish_raw(
            v3_fragment_topic(project_id, deployment_id, exec_id),
            raw,
            qos=1,
            retain=True,
        )


def _build_three_picos_scenario(project_id="demo-3-picos", deployment_id="deploy-3p", epoch=1):
    """Construye un escenario distribuido entre 3 Pico W (`pico:1` -> `pico:2` -> `pico:3`)."""

    route_1_2 = {
        "connection_id": "conn-a-b",
        "tipo": "dch",
        "tipo_dato": "integer",
        "source_element_id": "service-a",
        "source_port_id": "out",
        "source_executor_id": "pico:1",
        "target_element_id": "fb-b",
        "target_port_id": "in",
        "target_executor_id": "pico:2",
        "topic": v3_channel_topic(project_id, deployment_id, "conn-a-b"),
        "qos": 1,
        "retain": False,
        "capacidad_cola": 8,
    }
    route_2_3 = {
        "connection_id": "conn-b-c",
        "tipo": "cch",
        "tipo_dato": "integer",
        "source_element_id": "fb-b",
        "source_port_id": "out",
        "source_executor_id": "pico:2",
        "target_element_id": "hold-c",
        "target_port_id": "in",
        "target_executor_id": "pico:3",
        "topic": v3_channel_topic(project_id, deployment_id, "conn-b-c"),
        "qos": 1,
        "retain": False,
    }

    frag_1 = {
        "protocol_version": 3,
        "project_id": project_id,
        "deployment_id": deployment_id,
        "epoch": epoch,
        "fragment_id": "{}:pico:1".format(deployment_id),
        "executor_id": "pico:1",
        "owner_executor_id": "pico:1",
        "modelo": {
            "ir_version": 2,
            "modelo_id": "m-3p",
            "version": 1,
            "nombre": "Modelo — pico:1",
            "metadata": BASE_METADATA_V2,
            "entradas_externas": [
                {
                    "elemento_id": "service-a",
                    "nombre": "Entrada",
                    "puerto_salida": "out",
                    "tipo_dato": "integer",
                }
            ],
            "elementos": [
                {
                    "id": "service-a",
                    "tipo": "service",
                    "nombre": "Entrada",
                    "tipo_dato": "integer",
                    "entradas": [],
                    "salidas": ["out"],
                }
            ],
            "conexiones": [],
        },
        "inbound_routes": [],
        "outbound_routes": [route_1_2],
    }
    frag_2 = {
        "protocol_version": 3,
        "project_id": project_id,
        "deployment_id": deployment_id,
        "epoch": epoch,
        "fragment_id": "{}:pico:2".format(deployment_id),
        "executor_id": "pico:2",
        "owner_executor_id": "pico:2",
        "modelo": {
            "ir_version": 2,
            "modelo_id": "m-3p",
            "version": 1,
            "nombre": "Modelo — pico:2",
            "metadata": BASE_METADATA_V2,
            "entradas_externas": [],
            "elementos": [
                {
                    "id": "fb-b",
                    "tipo": "functional_block",
                    "nombre": "Sumar diez",
                    "habilitado": True,
                    "lenguaje": "python",
                    "codigo": "x + 10",
                    "entradas": [{"puerto": "in", "variable": "x", "tipo_dato": "integer"}],
                    "salidas": [{"puerto": "out", "variable": "res", "tipo_dato": "integer"}],
                }
            ],
            "conexiones": [],
        },
        "inbound_routes": [route_1_2],
        "outbound_routes": [route_2_3],
    }
    frag_3 = {
        "protocol_version": 3,
        "project_id": project_id,
        "deployment_id": deployment_id,
        "epoch": epoch,
        "fragment_id": "{}:pico:3".format(deployment_id),
        "executor_id": "pico:3",
        "owner_executor_id": "pico:3",
        "modelo": {
            "ir_version": 2,
            "modelo_id": "m-3p",
            "version": 1,
            "nombre": "Modelo — pico:3",
            "metadata": BASE_METADATA_V2,
            "entradas_externas": [],
            "elementos": [
                {
                    "id": "hold-c",
                    "tipo": "hold",
                    "nombre": "Hold C",
                    "habilitado": True,
                    "tipo_dato": "integer",
                    "puerto_entrada": "in",
                    "puerto_cch": "out",
                    "puerto_lch": "pulse",
                }
            ],
            "conexiones": [],
        },
        "inbound_routes": [route_2_3],
        "outbound_routes": [],
    }

    fragments = [frag_1, frag_2, frag_3]
    manifest = {
        "protocol_version": 3,
        "project_id": project_id,
        "deployment_id": deployment_id,
        "epoch": epoch,
        "model_id": "m-3p",
        "model_version": 1,
        "owners": {"service-a": "pico:1", "fb-b": "pico:2", "hold-c": "pico:3"},
        "fragments": [
            {
                "fragment_id": f["fragment_id"],
                "executor_id": f["executor_id"],
                "hash": sha256_hex(f),
                "size_bytes": len(canonical_json_bytes(f)),
                "element_ids": [e["id"] for e in f["modelo"]["elementos"]],
            }
            for f in fragments
        ],
        "routes": [route_1_2, route_2_3],
    }
    return {
        "project_id": project_id,
        "deployment_id": deployment_id,
        "epoch": epoch,
        "manifest": manifest,
        "fragments": fragments,
        "routes": (route_1_2, route_2_3),
    }


class DistributedWorkerV3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vectors_data = json.loads(VECTORS_V3_PATH.read_text(encoding="utf-8"))
        cls.scenarios = {item["deployment_id"]: item for item in cls.vectors_data["escenarios"]}

    def test_canonical_json_and_sha256_match_typescript_vectors_bit_for_bit(self):
        for scenario in self.vectors_data["escenarios"]:
            manifest = scenario["manifest"]
            summaries_by_exec = {item["executor_id"]: item for item in manifest["fragments"]}
            for fragment in scenario["fragments"]:
                exec_id = fragment["executor_id"]
                expected_canonical = scenario["canonical_fragments"][exec_id]
                expected_summary = summaries_by_exec[exec_id]

                python_canonical = canonical_json_str(fragment)
                python_bytes = canonical_json_bytes(fragment)
                self.assertEqual(python_canonical, expected_canonical)
                self.assertEqual(len(python_bytes), expected_summary["size_bytes"])
                self.assertEqual(sha256_hex(python_bytes), expected_summary["hash"])
                self.assertEqual(sha256_hex(fragment), expected_summary["hash"])

    def test_two_workers_do_not_consume_foreign_fragments(self):
        scenario = self.scenarios["deploy-4"]
        project_id = scenario["project_id"]
        deployment_id = scenario["deployment_id"]
        broker = FakeBroker()

        pico_a = _Rig(broker, project_id, "a", executor_id="pico:a")
        pico_d = _Rig(broker, project_id, "d", executor_id="pico:d")
        _tick_all([pico_a, pico_d], rounds=4)

        _deploy_scenario(broker, scenario)
        _tick_all([pico_a, pico_d], rounds=12)

        self.assertEqual(pico_a.worker.active_fragment_id, "deploy-4:pico:a")
        self.assertEqual(pico_a.worker.owned_element_ids, ("service-a",))
        self.assertEqual(pico_d.worker.active_fragment_id, "deploy-4:pico:d")
        self.assertEqual(pico_d.worker.owned_element_ids, ("hold-d",))
        self.assertEqual(pico_a.worker.fragments_rejected, 0)
        self.assertEqual(pico_d.worker.fragments_rejected, 0)

        # Si un controlador mal configurado publica el fragmento de pico:d en el tópico de pico:a,
        # pico:a lo rechaza por propiedad y conserva intacto su fragmento service-a.
        frag_d_raw = scenario["canonical_fragments"]["pico:d"].encode("utf-8")
        broker.publish_raw(
            v3_fragment_topic(project_id, deployment_id, "pico:a"),
            frag_d_raw,
            qos=1,
            retain=False,
        )
        _tick_all([pico_a, pico_d], rounds=8)

        self.assertEqual(pico_a.worker.fragments_rejected, 1)
        self.assertEqual(pico_a.worker.owned_element_ids, ("service-a",))
        ack_a_msgs = broker.messages_for(v3_ack_topic(project_id, deployment_id, "pico:a"))
        self.assertEqual(ack_a_msgs[-1]["payload"]["accepted"], False)
        self.assertEqual(
            ack_a_msgs[-1]["payload"]["error"]["codigo"],
            "DISTRIBUCION_ASIGNACION_INVALIDA",
        )

    def test_three_picos_end_to_end_pipeline_and_single_logical_publication_under_duplicates(self):
        # Construimos un despliegue con las 3 Pico W disponibles el jueves:
        # pico:1 (service-a) --DCH--> pico:2 (fb-b: x+10) --CCH--> pico:3 (hold-c)
        scenario = _build_three_picos_scenario()
        project_id = scenario["project_id"]
        deployment_id = scenario["deployment_id"]
        epoch = scenario["epoch"]
        route_1_2, route_2_3 = scenario["routes"]

        broker = FakeBroker()
        p1 = _Rig(broker, project_id, "1", executor_id="pico:1")
        p2 = _Rig(broker, project_id, "2", executor_id="pico:2")
        p3 = _Rig(broker, project_id, "3", executor_id="pico:3")
        rigs = [p1, p2, p3]
        _tick_all(rigs, rounds=4)

        _deploy_scenario(broker, scenario)
        _tick_all(rigs, rounds=12)

        for rig in rigs:
            self.assertEqual(rig.worker.estado, "ready")
            self.assertEqual(rig.worker.fragments_accepted, 1)

        # Inyectamos valor 25 en service-a a través del tópico v3 input.
        broker.publish_json(
            v3_input_topic(project_id, deployment_id),
            {
                "protocol_version": 3,
                "project_id": project_id,
                "deployment_id": deployment_id,
                "epoch": epoch,
                "servicio_id": "service-a",
                "valor": 25,
            },
            qos=1,
        )
        _tick_all(rigs, rounds=6)

        # Paso 1 global -> pico:1 evalúa service-a y publica conn-a-b (seq=1, value=25).
        step_cmd = {
            "protocol_version": 3,
            "project_id": project_id,
            "deployment_id": deployment_id,
            "epoch": epoch,
            "command": "step",
        }
        broker.publish_json(v3_command_topic(project_id, deployment_id), step_cmd, qos=1)
        _tick_all(rigs, rounds=10)

        conn_ab_msgs = broker.messages_for(route_1_2["topic"])
        self.assertEqual(len(conn_ab_msgs), 1)
        first_channel_msg = conn_ab_msgs[0]["payload"]
        self.assertEqual(first_channel_msg["sequence"], 1)
        self.assertEqual(first_channel_msg["value"], 25)
        self.assertEqual(p2.worker.channels_accepted, 1)

        # Reentrega QoS1 duplicada (mismo message_id y sequence=1) y un mensaje atrasado:
        # pico:2 los descarta sin apilar otro evento DCH en fb-b.
        broker.publish_json(route_1_2["topic"], first_channel_msg, qos=1)
        broker.publish_json(route_1_2["topic"], first_channel_msg, qos=1)
        _tick_all(rigs, rounds=8)
        self.assertEqual(p2.worker.channels_accepted, 1)
        self.assertEqual(p2.worker.channels_discarded, 2)

        # Paso 2 global -> pico:2 consume el único evento (25), calcula 25+10=35 y publica conn-b-c una sola vez.
        broker.publish_json(v3_command_topic(project_id, deployment_id), step_cmd, qos=1)
        _tick_all(rigs, rounds=10)

        conn_bc_msgs = broker.messages_for(route_2_3["topic"])
        self.assertEqual(len(conn_bc_msgs), 1)
        self.assertEqual(conn_bc_msgs[0]["payload"]["value"], 35)
        self.assertEqual(p3.worker.channels_accepted, 1)

        # Paso 3 global -> pico:3 aplica 35 en hold-c y publica su snapshot parcial.
        broker.publish_json(v3_command_topic(project_id, deployment_id), step_cmd, qos=1)
        _tick_all(rigs, rounds=10)

        snap_p3 = broker.messages_for(v3_snapshot_topic(project_id, deployment_id, "pico:3"))[-1]["payload"]
        self.assertEqual(snap_p3["elements"]["hold-c"]["valor_retenido"], 35)
        self.assertEqual(list(snap_p3["elements"].keys()), ["hold-c"])

    def test_restarting_a_worker_preserves_other_owners_and_recovers_from_retained(self):
        scenario = self.scenarios["deploy-2"]
        project_id = scenario["project_id"]
        deployment_id = scenario["deployment_id"]
        broker = FakeBroker()

        pico_a = _Rig(broker, project_id, "a", executor_id="pico:a")
        browser_b = _Rig(broker, project_id, "b", tipo="browser", executor_id="browser:b")
        _tick_all([pico_a, browser_b], rounds=4)

        _deploy_scenario(broker, scenario)
        _tick_all([pico_a, browser_b], rounds=12)

        self.assertEqual(pico_a.worker.owned_element_ids, ("fb-b", "service-a"))
        self.assertEqual(browser_b.worker.owned_element_ids, ("hold-c", "hold-d"))
        browser_accepts_before = browser_b.worker.fragments_accepted

        # Simulamos reinicio físico de pico:a (se pierde su RAM y se crea una instancia nueva).
        pico_a.transport.close()
        pico_a_restarted = _Rig(broker, project_id, "a", executor_id="pico:a")
        _tick_all([pico_a_restarted, browser_b], rounds=12)

        # pico:a recuperó su fragmento desde los retained del broker y browser:b no sufrió cambios.
        self.assertEqual(pico_a_restarted.worker.estado, "ready")
        self.assertEqual(pico_a_restarted.worker.active_fragment_id, "deploy-2:pico:a")
        self.assertEqual(pico_a_restarted.worker.owned_element_ids, ("fb-b", "service-a"))
        self.assertEqual(browser_b.worker.owned_element_ids, ("hold-c", "hold-d"))
        self.assertEqual(browser_b.worker.fragments_accepted, browser_accepts_before)

    def test_broker_loss_is_observable_and_recovers_after_resync_While_rejecting_stale_epochs(self):
        scenario = self.scenarios["deploy-2"]
        project_id = scenario["project_id"]
        deployment_id = scenario["deployment_id"]
        broker = FakeBroker()

        pico_a = _Rig(broker, project_id, "a", executor_id="pico:a")
        browser_b = _Rig(broker, project_id, "b", tipo="browser", executor_id="browser:b")
        _tick_all([pico_a, browser_b], rounds=4)

        _deploy_scenario(broker, scenario)
        _tick_all([pico_a, browser_b], rounds=12)

        # Caída abrupta de browser_b frente al broker:
        session_b = browser_b.transport.client
        broker.simulate_abrupt_drop(session_b)

        # El broker publicó el Last Will retenido con estado offline:
        status_b_topic = v3_executor_status_topic(project_id, "browser:b")
        self.assertEqual(json.loads(broker.retained[status_b_topic].decode("utf-8"))["estado"], "offline")

        # Al intentar leer el socket en el siguiente ciclo, browser_b detecta la caída y pasa a degraded:
        browser_b.tick(steps=2, advance_ms=1)
        self.assertFalse(browser_b.transport.connected)
        self.assertEqual(browser_b.worker.estado, "degraded")
        # Su motor local sigue intacto:
        self.assertIsNotNone(browser_b.engine_task.engine)

        # Cuando vence reconnect_interval_ms (10 ms), browser_b reconecta, entra en deploying (resync),
        # recibe manifiesto y fragmento retenidos y vuelve a ready sin perder su modelo:
        browser_b.tick(steps=15, advance_ms=2)
        self.assertTrue(browser_b.transport.connected)
        self.assertEqual(browser_b.worker.estado, "ready")
        self.assertEqual(json.loads(broker.retained[status_b_topic].decode("utf-8"))["estado"], "ready")

        # Un mensaje de canal con otra época, otro proyecto o propietario falso se descarta:
        route_topic = scenario["manifest"]["routes"][0]["topic"]
        conn_id = scenario["manifest"]["routes"][0]["connection_id"]
        for bad_msg in (
            {
                "protocol_version": 3,
                "project_id": project_id,
                "deployment_id": deployment_id,
                "epoch": 999,  # época distinta
                "message_id": "m-bad-epoch",
                "connection_id": conn_id,
                "owner_executor_id": "pico:a",
                "sequence": 1,
                "value": 10,
            },
            {
                "protocol_version": 3,
                "project_id": "otro-proyecto",
                "deployment_id": deployment_id,
                "epoch": 1,
                "message_id": "m-bad-proj",
                "connection_id": conn_id,
                "owner_executor_id": "pico:a",
                "sequence": 1,
                "value": 10,
            },
            {
                "protocol_version": 3,
                "project_id": project_id,
                "deployment_id": deployment_id,
                "epoch": 1,
                "message_id": "m-bad-owner",
                "connection_id": conn_id,
                "owner_executor_id": "pico:impostor",
                "sequence": 1,
                "value": 10,
            },
            {
                "protocol_version": 3,
                "project_id": project_id,
                "deployment_id": deployment_id,
                "epoch": 1,
                "message_id": "m-bad-type",
                "connection_id": conn_id,
                "owner_executor_id": "pico:a",
                "sequence": 1,
                "value": "texto-no-entero",
            },
        ):
            broker.publish_json(route_topic, bad_msg, qos=1)
        _tick_all([pico_a, browser_b], rounds=10)
        self.assertEqual(browser_b.worker.channels_accepted, 0)
        self.assertEqual(browser_b.worker.channels_discarded, 4)

    def test_invalid_fragment_hash_or_capacity_is_rejected_and_previous_model_is_kept(self):
        scenario = self.scenarios["deploy-2"]
        project_id = scenario["project_id"]
        deployment_id = scenario["deployment_id"]
        broker = FakeBroker()

        pico_a = _Rig(broker, project_id, "a", executor_id="pico:a")
        pico_a.tick(steps=4)

        broker.publish_json(v3_manifest_topic(project_id), scenario["manifest"], qos=1, retain=True)
        frag_a_raw = scenario["canonical_fragments"]["pico:a"].encode("utf-8")
        broker.publish_raw(
            v3_fragment_topic(project_id, deployment_id, "pico:a"),
            frag_a_raw,
            qos=1,
            retain=True,
        )
        pico_a.tick(steps=12)
        original_engine = pico_a.engine_task.engine
        self.assertIsNotNone(original_engine)
        self.assertEqual(pico_a.worker.active_epoch, 1)

        # Publicamos época 2 con un hash que no corresponde al fragmento enviado:
        bad_manifest = dict(scenario["manifest"])
        bad_manifest["epoch"] = 2
        bad_manifest["fragments"] = [
            dict(item, hash="0" * 64) if item["executor_id"] == "pico:a" else item
            for item in scenario["manifest"]["fragments"]
        ]
        bad_fragment = dict(scenario["fragments"][0] if scenario["fragments"][0]["executor_id"] == "pico:a" else scenario["fragments"][1])
        bad_fragment["epoch"] = 2

        broker.publish_json(v3_manifest_topic(project_id), bad_manifest, qos=1, retain=True)
        broker.publish_raw(
            v3_fragment_topic(project_id, deployment_id, "pico:a"),
            canonical_json_bytes(bad_fragment),
            qos=1,
            retain=True,
        )
        pico_a.tick(steps=12)

        # El rechazo conserva el motor y la época 1 anterior:
        self.assertIs(pico_a.engine_task.engine, original_engine)
        self.assertEqual(pico_a.worker.active_epoch, 1)
        self.assertEqual(pico_a.worker.fragments_rejected, 1)
        errors = broker.messages_for(v3_error_topic(project_id, deployment_id))
        self.assertEqual(errors[-1]["payload"]["codigo"], "DISTRIBUCION_MODELO_INVALIDO")
        self.assertEqual(errors[-1]["payload"]["stage"], "fragment")

        # Si restringimos capacidades (max_elementos=1 o lenguaje no soportado) en época 3,
        # también se rechaza atómicamente conservando el motor original:
        pico_a.worker.max_elementos = 1
        epoch3_fragment = dict(bad_fragment, epoch=3)
        epoch3_hash = sha256_hex(epoch3_fragment)
        epoch3_manifest = dict(
            scenario["manifest"],
            epoch=3,
            fragments=[
                dict(item, hash=epoch3_hash) if item["executor_id"] == "pico:a" else item
                for item in scenario["manifest"]["fragments"]
            ],
        )
        broker.publish_json(v3_manifest_topic(project_id), epoch3_manifest, qos=1, retain=True)
        broker.publish_raw(
            v3_fragment_topic(project_id, deployment_id, "pico:a"),
            canonical_json_bytes(epoch3_fragment),
            qos=1,
            retain=True,
        )
        pico_a.tick(steps=12)
        self.assertIs(pico_a.engine_task.engine, original_engine)
        self.assertEqual(pico_a.worker.active_epoch, 1)
        self.assertEqual(pico_a.worker.fragments_rejected, 2)
        self.assertEqual(
            broker.messages_for(v3_error_topic(project_id, deployment_id))[-1]["payload"]["codigo"],
            "DISTRIBUCION_CAPACIDAD_EXCEDIDA",
        )

    def test_unload_fragment_on_empty_retained_and_clean_reconnect_on_deployment_change(self):
        scenario_dep2 = self.scenarios["deploy-2"]
        project_id = scenario_dep2["project_id"]
        broker = FakeBroker()

        pico_a = _Rig(broker, project_id, "a", executor_id="pico:a")
        pico_a.tick(steps=4)

        _deploy_scenario(broker, scenario_dep2)
        pico_a.tick(steps=12)
        self.assertEqual(pico_a.worker.active_deployment_id, "deploy-2")
        self.assertEqual(pico_a.worker.estado, "ready")

        # Cambio de deployment_id ("deploy-2" -> "deploy-4") dentro del mismo project_id
        # hace reconexión limpia inmediata, publica ACK + status ready para deploy-4 y
        # desuscribe los tópicos de deploy-2:
        scenario_dep4 = dict(self.scenarios["deploy-4"], project_id=project_id)
        scenario_dep4["manifest"] = dict(scenario_dep4["manifest"], project_id=project_id, epoch=2)
        scenario_dep4["fragments"] = [
            dict(f, project_id=project_id, epoch=2) for f in scenario_dep4["fragments"]
        ]
        scenario_dep4["canonical_fragments"] = {
            f["executor_id"]: canonical_json_str(f) for f in scenario_dep4["fragments"]
        }
        scenario_dep4["manifest"]["fragments"] = [
            dict(
                item,
                hash=sha256_hex(scenario_dep4["canonical_fragments"][item["executor_id"]]),
                size_bytes=len(scenario_dep4["canonical_fragments"][item["executor_id"]].encode("utf-8")),
            )
            for item in scenario_dep4["manifest"]["fragments"]
        ]
        _deploy_scenario(broker, scenario_dep4)
        pico_a.tick(steps=12)
        self.assertTrue(pico_a.transport.connected)
        self.assertEqual(pico_a.worker.active_deployment_id, "deploy-4")
        self.assertEqual(pico_a.worker.estado, "ready")
        ack_dep4 = broker.messages_for(v3_ack_topic(project_id, "deploy-4", "pico:a"))
        self.assertGreaterEqual(len(ack_dep4), 1)
        self.assertTrue(ack_dep4[-1]["payload"]["accepted"])
        for sub in pico_a.transport.client.subscriptions:
            self.assertNotIn("deploy-2", sub)

        # Limpieza explícita del manifiesto retenido (b"") libera el motor y deja el worker en online:
        broker.publish_raw(v3_manifest_topic(project_id), b"", qos=1, retain=True)
        pico_a.tick(steps=8)
        self.assertIsNone(pico_a.worker.active_fragment)
        self.assertIsNone(pico_a.engine_task.engine)
        self.assertEqual(pico_a.worker.estado, "online")

    def test_outbox_flushes_pending_channel_outputs_after_broker_reconnect(self):
        scenario = _build_three_picos_scenario()
        project_id = scenario["project_id"]
        deployment_id = scenario["deployment_id"]
        route_1_2, _route_2_3 = scenario["routes"]

        broker = FakeBroker()
        p1 = _Rig(broker, project_id, "1", executor_id="pico:1")
        p2 = _Rig(broker, project_id, "2", executor_id="pico:2")
        _tick_all([p1, p2], rounds=4)

        _deploy_scenario(broker, scenario)
        _tick_all([p1, p2], rounds=12)

        # p1 pierde conexión con el broker pero su motor local sigue operando:
        broker.simulate_abrupt_drop(p1.transport.client)
        p1.tick(steps=2, advance_ms=1)
        self.assertFalse(p1.transport.connected)
        self.assertEqual(p1.worker.estado, "degraded")

        # Mientras está desconectado, el motor local de p1 recibe una muestra y ejecuta un paso:
        p1.engine_task.engine.set_input("service-a", 77)
        p1.engine_task.engine.step()
        self.assertEqual(len(p1.worker._outbox), 1)
        self.assertEqual(len(broker.messages_for(route_1_2["topic"])), 0)

        # Al restaurarse la red y reconectar al broker, p1 vacía el outbox y p2 recibe el valor 77:
        p1.transport.client = None
        for session in broker.sessions:
            session.broken = False
        _tick_all([p1, p2], rounds=16, advance_ms=2)

        self.assertTrue(p1.transport.connected)
        self.assertEqual(len(p1.worker._outbox), 0)
        delivered = broker.messages_for(route_1_2["topic"])
        self.assertEqual(len(delivered), 1)
        self.assertEqual(delivered[0]["payload"]["value"], 77)
        self.assertEqual(p2.worker.channels_accepted, 1)


if __name__ == "__main__":
    unittest.main()
