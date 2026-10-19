import json
import unittest

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.core.task import Task
from firmware.pico.devices.watchdog_task import WatchdogTask
from firmware.pico.hiles.engine_task_v2 import EngineTaskV2
from firmware.pico.hiles.engine_v2 import HilesEngineV2
from firmware.pico.hiles.model_v2 import validate_ir_v2
from firmware.pico.pubsub import (
    ENTRADA_ESTABLECER,
    MODELO_CARGAR,
    Node,
    SIMULACION_COMANDO,
    SIMULACION_ESTADO,
    TELEMETRIA,
    full_topic,
)
from firmware.tests.fakes import FakeClock, FakeTransport


def timed_transition_model(retardo_ms=200):
    return validate_ir_v2({
        "ir_version": 2,
        "elementos": [
            {"id": "srv-cond", "tipo": "service", "nombre": "Condición", "tipo_dato": "boolean",
             "salidas": ["out"], "entradas": []},
            {"id": "p-inicio", "tipo": "place", "nombre": "Inicio", "tokens": 1, "capacidad": 1},
            {"id": "t-lenta", "tipo": "transition", "nombre": "Lenta", "habilitada": True,
             "puerto_condicion": "condicion", "puerto_accion": "accion", "retardo_ms": retardo_ms},
            {"id": "p-fin", "tipo": "place", "nombre": "Fin", "tokens": 0, "capacidad": 1},
        ],
        "conexiones": [
            {"id": "cch-cond", "tipo": "cch", "origen": "srv-cond", "puerto_origen": "out",
             "destino": "t-lenta", "puerto_destino": "condicion"},
            {"id": "a1", "tipo": "arco", "origen": "p-inicio", "destino": "t-lenta", "peso": 1},
            {"id": "a2", "tipo": "arco", "origen": "t-lenta", "destino": "p-fin", "peso": 1},
        ],
    })


def python_block(element_id, codigo, entrada="x", salida="y", tipo="integer", **extra):
    definicion = {
        "id": element_id, "tipo": "functional_block", "nombre": element_id, "habilitado": True,
        "lenguaje": "python", "codigo": codigo,
        "entradas": [{"puerto": element_id + "-in", "variable": entrada, "tipo_dato": tipo}],
        "salidas": [{"puerto": element_id + "-out", "variable": salida, "tipo_dato": tipo}],
    }
    definicion.update(extra)
    return definicion


def service_block_model(retardo_conexion=0, retardo_bloque=0):
    bloque = python_block("fb-doble", "def calcular(x):\n    return x * 2")
    if retardo_bloque:
        bloque["retardo_ms"] = retardo_bloque
    conexion = {"id": "cch", "tipo": "cch", "origen": "srv", "puerto_origen": "out",
                "destino": "fb-doble", "puerto_destino": "fb-doble-in"}
    if retardo_conexion:
        conexion["retardo_ms"] = retardo_conexion
    return validate_ir_v2({
        "ir_version": 2,
        "elementos": [
            {"id": "srv", "tipo": "service", "nombre": "Entrada", "tipo_dato": "integer",
             "salidas": ["out"], "entradas": []},
            bloque,
        ],
        "conexiones": [conexion],
    })


class TransitionDelayTests(unittest.TestCase):
    """Porta la prueba web de cancelación de temporizador y reset."""

    def test_timer_is_cancelled_when_transition_loses_enablement(self):
        motor = HilesEngineV2(timed_transition_model())
        motor.set_input("srv-cond", True)
        motor.step(0)
        self.assertEqual(motor.snapshot()["t-lenta"], {"habilitada": True, "disparada": False, "timer_pendiente": True})

        motor.set_input("srv-cond", False)
        motor.step(100)
        self.assertEqual(motor.snapshot()["t-lenta"], {"habilitada": False, "disparada": False})

        motor.set_input("srv-cond", True)
        motor.step(150)
        self.assertEqual(motor.snapshot()["t-lenta"]["timer_pendiente"], True)
        self.assertEqual(motor.snapshot()["p-fin"], {"tokens": 0})
        motor.step(199)
        self.assertEqual(motor.snapshot()["p-fin"], {"tokens": 0})
        motor.step(1)
        self.assertEqual(motor.snapshot()["p-fin"], {"tokens": 1})

    def test_reset_cancels_timers_and_logical_clock(self):
        motor = HilesEngineV2(timed_transition_model())
        motor.set_input("srv-cond", True)
        motor.step(0)
        self.assertTrue(motor.pending_work())
        motor.reset()
        self.assertEqual(motor.reloj_ms, 0)
        self.assertFalse(motor.pending_work())
        self.assertEqual(motor.snapshot()["t-lenta"], {"habilitada": False, "disparada": False})


class ElementAndConnectionDelayTests(unittest.TestCase):
    def test_connection_delay_delivers_once_and_stabilizes(self):
        motor = HilesEngineV2(service_block_model(retardo_conexion=100))
        motor.set_input("srv", 7)
        motor.step(0)
        self.assertTrue(motor.bus.has_deferred())
        self.assertTrue(motor.snapshot()["srv"]["timer_pendiente"])
        motor.step(50)
        self.assertEqual(len(motor.bus.diferidas), 1)
        motor.step(50)
        self.assertFalse(motor.bus.has_deferred())
        self.assertEqual(motor.snapshot()["fb-doble"], {"salida": 14})
        for _ in range(5):
            motor.step(50)
        self.assertFalse(motor.pending_work())

    def test_element_delay_holds_output_until_deadline(self):
        motor = HilesEngineV2(service_block_model(retardo_bloque=300))
        motor.set_input("srv", 5)
        motor.step(0)
        self.assertEqual(motor.snapshot()["fb-doble"], {"timer_pendiente": True})
        motor.step(299)
        self.assertEqual(motor.snapshot()["fb-doble"], {"timer_pendiente": True})
        motor.step(1)
        self.assertEqual(motor.snapshot()["fb-doble"], {"salida": 10})

        motor.set_input("srv", 6)
        motor.step(10)
        self.assertEqual(motor.snapshot()["fb-doble"], {"salida": 10, "timer_pendiente": True})
        motor.step(300)
        self.assertEqual(motor.snapshot()["fb-doble"]["salida"], 12)

    def test_time_source_measures_real_elapsed_time(self):
        reloj = FakeClock(1000)
        motor = HilesEngineV2(timed_transition_model(retardo_ms=500), time_source=reloj)
        motor.set_input("srv-cond", True)
        motor.step()
        reloj.advance_ms(499)
        motor.step()
        self.assertEqual(motor.snapshot()["p-fin"], {"tokens": 0})
        reloj.advance_ms(1)
        motor.step()
        self.assertEqual(motor.snapshot()["p-fin"], {"tokens": 1})
        self.assertEqual(motor.reloj_ms, 500)


class CounterTask(Task):
    def __init__(self, scheduler):
        self.count = 0
        super().__init__(scheduler, period_ms=10, priority=5, name="contador")

    def update(self):
        self.count += 1


class NonBlockingDelayTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.errors = []
        self.scheduler = Scheduler(clock=self.clock, error_handler=lambda t, e: self.errors.append((t.name, e)))
        self.node = Node()
        self.transport = FakeTransport(self.node)
        self.task = EngineTaskV2(self.scheduler, self.node, period_ms=20, step_interval_ms=100)
        self.watchdog = WatchdogTask(self.scheduler, self.node, period_ms=200, gc_module=None)
        self.counter = CounterTask(self.scheduler)

    def send(self, topic, payload):
        self.transport.inject(full_topic(topic), json.dumps(payload).encode("utf-8"))

    def run_for(self, ms, paso=10):
        for _ in range(ms // paso):
            self.clock.advance_ms(paso)
            self.scheduler.run_pending()

    def test_tasks_keep_running_while_a_long_delay_is_pending(self):
        modelo = timed_transition_model(retardo_ms=5000)
        self.send(MODELO_CARGAR, {"modelo_id": "m", "version": 1, "ir_version": 2, "modelo": modelo, "id_mensaje": "c"})
        self.send(ENTRADA_ESTABLECER, {"servicio_id": "srv-cond", "valor": True, "modelo_id": "m", "version": 1, "id_mensaje": "e"})
        self.send(SIMULACION_COMANDO, {"accion": "iniciar", "modelo_id": "m", "version": 1, "id_mensaje": "i"})
        self.run_for(200)  # incluye el primer paso automático, que arma el temporizador
        self.assertTrue(self.task.engine.pending_work())

        contador_inicial = self.counter.count
        telemetria_inicial = len(self.transport.published_for(TELEMETRIA))
        self.run_for(4000)
        self.assertEqual(self.task.engine.snapshot()["p-fin"], {"tokens": 0})
        self.assertGreaterEqual(self.counter.count - contador_inicial, 390)
        self.assertGreaterEqual(len(self.transport.published_for(TELEMETRIA)) - telemetria_inicial, 19)

        self.run_for(1200)
        self.assertEqual(self.task.engine.snapshot()["p-fin"], {"tokens": 1})
        self.assertEqual(self.errors, [])
        # Cada update del motor terminó rápido: nunca esperó el retardo.
        self.assertLess(self.task.max_duration_us, 50000)

    def test_loading_another_model_discards_pending_timers(self):
        modelo = timed_transition_model(retardo_ms=1000)
        self.send(MODELO_CARGAR, {"modelo_id": "m", "version": 1, "ir_version": 2, "modelo": modelo, "id_mensaje": "c1"})
        self.send(ENTRADA_ESTABLECER, {"servicio_id": "srv-cond", "valor": True, "modelo_id": "m", "version": 1, "id_mensaje": "e1"})
        self.send(SIMULACION_COMANDO, {"accion": "paso", "modelo_id": "m", "version": 1, "id_mensaje": "p1"})
        self.run_for(100)
        anterior = self.task.engine
        self.assertTrue(anterior.pending_work())

        self.send(MODELO_CARGAR, {"modelo_id": "m", "version": 2, "ir_version": 2, "modelo": modelo, "id_mensaje": "c2"})
        self.run_for(100)
        self.assertIsNot(self.task.engine, anterior)
        self.assertFalse(self.task.engine.pending_work())
        self.assertEqual(self.task.engine.snapshot()["p-inicio"], {"tokens": 1})

        self.send(SIMULACION_COMANDO, {"accion": "reiniciar", "modelo_id": "m", "version": 2, "id_mensaje": "r"})
        self.run_for(100)
        estado = self.transport.published_for(SIMULACION_ESTADO)[-1]["payload"]
        self.assertEqual(estado["estado"], "lista")
        self.assertFalse(self.task.engine.pending_work())


if __name__ == "__main__":
    unittest.main()
