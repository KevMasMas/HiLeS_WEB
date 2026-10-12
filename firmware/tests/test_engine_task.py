import json
import unittest

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.core.task import Task
from firmware.pico.hiles import EngineTask
from firmware.pico.pubsub import (
    ENTRADA_ESTABLECER,
    ERROR,
    MODELO_CARGAR,
    MODELO_CONFIRMACION,
    Node,
    SIMULACION_COMANDO,
    SIMULACION_ESTADO,
    full_topic,
)
from firmware.tests.fakes import FakeClock, FakeTransport
from firmware.tests.hiles_vectors import load_vectors


class CounterTask(Task):
    def __init__(self, scheduler):
        self.count = 0
        super().__init__(scheduler, period_ms=10, priority=5, name="contador")

    def update(self):
        self.count += 1


class EngineTaskTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.errors = []
        self.scheduler = Scheduler(
            clock=self.clock,
            error_handler=lambda task, error: self.errors.append((task.name, error)),
        )
        self.node = Node()
        self.transport = FakeTransport(self.node)
        self.task = EngineTask(self.scheduler, self.node, period_ms=20, step_interval_ms=100)
        _, self.vector = load_vectors("ejecucion")[0]

    # Utilidades -------------------------------------------------------

    def send(self, topic, payload):
        self.assertTrue(self.transport.inject(full_topic(topic), json.dumps(payload).encode("utf-8")))

    def tick(self, ms=20):
        self.clock.advance_ms(ms)
        return self.scheduler.run_pending()

    def drain(self):
        while self.task.pending():
            self.tick()

    def load(self, modelo=None, modelo_id="humedad-01", version=1, id_mensaje="carga-1"):
        self.send(
            MODELO_CARGAR,
            {
                "modelo_id": modelo_id,
                "version": version,
                "ir_version": 1,
                "modelo": self.vector["modelo"] if modelo is None else modelo,
                "id_mensaje": id_mensaje,
            },
        )
        self.drain()

    def command(self, accion, id_mensaje, modelo_id="humedad-01", version=1):
        self.send(
            SIMULACION_COMANDO,
            {"accion": accion, "modelo_id": modelo_id, "version": version, "id_mensaje": id_mensaje},
        )
        self.drain()

    def set_input(self, servicio_id, valor, id_mensaje):
        self.send(
            ENTRADA_ESTABLECER,
            {
                "servicio_id": servicio_id,
                "valor": valor,
                "modelo_id": "humedad-01",
                "version": 1,
                "id_mensaje": id_mensaje,
            },
        )
        self.drain()

    def states(self):
        return [item["payload"] for item in self.transport.published_for(SIMULACION_ESTADO)]

    def error_payloads(self):
        return [item["payload"] for item in self.transport.published_for(ERROR)]

    # Pruebas ----------------------------------------------------------

    def test_load_publishes_confirmation_and_initial_snapshot(self):
        self.assertEqual(self.task.estado, "sin_modelo")
        self.load()

        confirmaciones = self.transport.published_for(MODELO_CONFIRMACION)
        self.assertEqual(
            [item["payload"] for item in confirmaciones],
            [{"modelo_id": "humedad-01", "version": 1, "ir_version": 1, "aceptado": True, "id_mensaje": "carga-1"}],
        )
        estado = self.states()[0]
        self.assertEqual(estado["secuencia"], 0)
        self.assertEqual(estado["estado"], "lista")
        self.assertEqual(estado["elementos"], self.vector["estado_inicial"])
        self.assertEqual(estado["id_mensaje"], "carga-1")
        self.assertTrue(self.transport.published_for(SIMULACION_ESTADO)[0]["retain"])

    def test_callbacks_only_enqueue_and_update_is_bounded(self):
        self.send(MODELO_CARGAR, {
            "modelo_id": "humedad-01", "version": 1, "ir_version": 1,
            "modelo": self.vector["modelo"], "id_mensaje": "carga-1",
        })
        self.send(SIMULACION_COMANDO, {"accion": "paso", "modelo_id": "humedad-01", "version": 1, "id_mensaje": "p-1"})
        self.send(SIMULACION_COMANDO, {"accion": "paso", "modelo_id": "humedad-01", "version": 1, "id_mensaje": "p-2"})

        # Nada se procesa dentro de los callbacks de Node.
        self.assertEqual(self.task.pending(), 3)
        self.assertEqual(self.transport.published, [])

        self.tick()
        self.assertEqual(self.task.pending(), 2)
        self.assertEqual(len(self.states()), 1)
        self.tick()
        self.assertEqual(self.task.pending(), 1)
        self.assertEqual([s["secuencia"] for s in self.states()], [0, 1])
        self.tick()
        self.assertEqual([s["secuencia"] for s in self.states()], [0, 1, 2])

    def test_full_vector_through_mqtt_messages(self):
        self.load()
        for indice, paso in enumerate(self.vector["pasos"], start=1):
            for servicio_id, valor in paso["entradas"].items():
                self.set_input(servicio_id, valor, "entrada-{}".format(indice))
            self.command("paso", "paso-{}".format(indice))
            estado = self.states()[-1]
            self.assertEqual(estado["secuencia"], indice)
            self.assertEqual(estado["estado"], "pausada")
            self.assertEqual(estado["id_mensaje"], "paso-{}".format(indice))
            self.assertEqual(estado["elementos"], paso["elementos_esperados"])
        self.assertEqual(self.error_payloads(), [])

    def test_reset_restores_initial_state_with_newer_sequence(self):
        self.load()
        self.set_input("sensor", 70, "e-1")
        self.command("paso", "p-1")
        self.assertEqual(self.states()[-1]["elementos"]["activo"], {"tokens": 1})

        self.command("reiniciar", "r-1")
        estado = self.states()[-1]
        self.assertEqual(estado["estado"], "lista")
        self.assertEqual(estado["secuencia"], 2)
        self.assertEqual(estado["elementos"], self.vector["estado_inicial"])

    def test_invalid_model_is_rejected_and_active_model_is_kept(self):
        self.load()
        _, invalido = load_vectors("invalidos")[5]
        self.load(modelo=invalido["modelo"], modelo_id="otro", version=2, id_mensaje="carga-2")

        rechazo = self.transport.published_for(MODELO_CONFIRMACION)[-1]["payload"]
        self.assertFalse(rechazo["aceptado"])
        self.assertEqual(rechazo["codigo"], invalido["codigo_esperado"])
        self.assertEqual(rechazo["ir_version"], 1)
        self.assertEqual(rechazo["id_mensaje"], "carga-2")
        self.assertTrue(rechazo["error"])
        self.assertEqual((self.task.modelo_id, self.task.version), ("humedad-01", 1))

        self.command("paso", "p-1")
        self.assertEqual(self.states()[-1]["secuencia"], 1)

    def test_unsupported_ir_version_and_broken_envelope(self):
        self.send(MODELO_CARGAR, {
            "modelo_id": "m", "version": 1, "ir_version": 2,
            "modelo": {"elementos": [], "conexiones": []}, "id_mensaje": "c-1",
        })
        self.send(MODELO_CARGAR, {"modelo": {"elementos": [], "conexiones": []}})
        self.drain()

        rechazo = self.transport.published_for(MODELO_CONFIRMACION)[0]["payload"]
        self.assertEqual(rechazo["codigo"], "IR_VERSION_NO_SOPORTADA")
        self.assertEqual(self.error_payloads()[0]["codigo"], "IR_ESTRUCTURA_INVALIDA")
        self.assertNotIn("id_mensaje", self.error_payloads()[0])
        self.assertEqual(self.task.estado, "sin_modelo")
        self.assertEqual(self.errors, [])

    def test_commands_are_rejected_for_missing_or_different_model(self):
        self.command("paso", "p-0")
        self.load()
        self.command("paso", "p-1", modelo_id="otro")
        self.command("paso", "p-2", version=2)
        self.command("saltar", "p-3")
        self.set_input("espera", 1, "e-1")
        self.set_input("sensor", "alto", "e-2")

        errores = self.error_payloads()
        self.assertEqual(
            [(e["codigo"], e["id_mensaje"]) for e in errores],
            [
                ("COMANDO_RECHAZADO", "p-0"),
                ("COMANDO_RECHAZADO", "p-1"),
                ("COMANDO_RECHAZADO", "p-2"),
                ("COMANDO_RECHAZADO", "p-3"),
                ("ENTRADA_HILES_RECHAZADA", "e-1"),
                ("ENTRADA_HILES_RECHAZADA", "e-2"),
            ],
        )
        # Ningún comando rechazado produjo una instantánea nueva.
        self.assertEqual([s["secuencia"] for s in self.states()], [0])

    def test_continuous_execution_one_step_per_interval(self):
        self.load()
        self.set_input("sensor", 70, "e-1")
        self.command("iniciar", "i-1")
        self.assertEqual(self.states()[-1]["estado"], "ejecutando")
        inicio = len(self.states())

        for _ in range(10):  # 200 ms con intervalo de 100 ms
            self.tick()
        automaticos = self.states()[inicio:]
        self.assertEqual(len(automaticos), 2)
        self.assertTrue(all("id_mensaje" not in s for s in automaticos))
        self.assertEqual(automaticos[0]["elementos"]["activo"], {"tokens": 1})

        self.command("detener", "d-1")
        self.assertEqual(self.states()[-1]["estado"], "detenida")
        cantidad = len(self.states())
        for _ in range(10):
            self.tick()
        self.assertEqual(len(self.states()), cantidad)
        secuencias = [s["secuencia"] for s in self.states()]
        self.assertEqual(secuencias, sorted(set(secuencias)))

    def test_full_queue_reports_busy_without_blocking(self):
        for indice in range(self.task.queue_size + 2):
            self.send(SIMULACION_COMANDO, {
                "accion": "paso", "modelo_id": "m", "version": 1, "id_mensaje": "p-{}".format(indice),
            })
        self.assertEqual(self.task.pending(), self.task.queue_size)
        ocupado = [e for e in self.error_payloads() if e["codigo"] == "MOTOR_OCUPADO"]
        self.assertEqual(len(ocupado), 2)
        self.assertEqual(self.task.dropped_count, 2)

    def test_other_tasks_keep_running_while_engine_works(self):
        contador = CounterTask(self.scheduler)
        self.load()
        self.command("iniciar", "i-1")
        for _ in range(20):
            self.tick()
        self.assertGreaterEqual(contador.count, 20)
        self.assertEqual(self.errors, [])

    def test_close_unsubscribes_from_node(self):
        self.task.close()
        self.send(SIMULACION_COMANDO, {"accion": "paso", "modelo_id": "m", "version": 1, "id_mensaje": "p"})
        self.assertEqual(self.task.pending(), 0)


if __name__ == "__main__":
    unittest.main()
