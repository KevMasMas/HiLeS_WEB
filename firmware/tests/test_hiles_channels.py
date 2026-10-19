import unittest

from firmware.pico.hiles.channels import ChannelBus, DchQueue, same_value
from firmware.pico.hiles.engine_v2 import HilesEngineV2
from firmware.pico.hiles.model_v2 import validate_ir_v2


class Recorder:
    """Destino mínimo que registra lo que recibe."""

    def __init__(self, element_id, tipo="functional_block"):
        self.id = element_id
        self.tipo = tipo
        self.recibidos = []

    def receive(self, puerto, valor):
        self.recibidos.append((puerto, valor))


def conexion(conn_id, tipo, destino="d", **extra):
    definicion = {
        "id": conn_id, "tipo": tipo, "origen": "o", "puerto_origen": "out",
        "destino": destino, "puerto_destino": "in",
    }
    definicion.update(extra)
    return definicion


def build_bus(*conexiones, origen_tipo="functional_block", destino_tipo="functional_block"):
    origen = Recorder("o", origen_tipo)
    destino = Recorder("d", destino_tipo)
    bus = ChannelBus({"o": origen, "d": destino}, list(conexiones))
    return bus, destino


class SameValueTests(unittest.TestCase):
    def test_json_semantics(self):
        self.assertTrue(same_value(1, 1.0))
        self.assertFalse(same_value(True, 1))
        self.assertFalse(same_value("1", 1))
        self.assertTrue(same_value([1, {"a": [2]}], [1.0, {"a": [2]}]))
        self.assertFalse(same_value({"a": 1}, {"a": 1, "b": 2}))
        self.assertFalse(same_value([True], [1]))


class DchTests(unittest.TestCase):
    def test_fifo_one_event_per_step_and_visible_overflow(self):
        bus, destino = build_bus(conexion("c", "dch", capacidad_cola=2))
        bus.begin_step(0)
        for valor in (10, 20, 30, 40):
            bus.notify("o", "out", valor)
        # 10 se consume en este paso; 20 y 30 esperan; 40 desborda.
        self.assertEqual(destino.recibidos, [("in", 10)])
        cola = bus.queue_for("d")
        self.assertEqual(cola.cola, [20, 30])
        self.assertTrue(cola.desbordada)

        bus.end_step()
        bus.begin_step(10)
        self.assertEqual(destino.recibidos, [("in", 10), ("in", 20)])
        bus.end_step()
        bus.begin_step(20)
        self.assertEqual(destino.recibidos[-1], ("in", 30))
        bus.end_step()
        bus.begin_step(30)
        self.assertEqual(len(destino.recibidos), 3)
        self.assertFalse(bus.has_pending_events())

    def test_capacity_is_bounded(self):
        cola = DchQueue(Recorder("d"), "in", 999)
        self.assertEqual(cola.capacidad, 32)
        for valor in range(100):
            cola.push(valor)
        self.assertEqual(len(cola.cola), 32)
        self.assertTrue(cola.desbordada)
        cola.reset()
        self.assertEqual((cola.cola, cola.desbordada), ([], False))

    def test_service_emits_dch_only_for_injected_samples(self):
        bus, destino = build_bus(conexion("c", "dch"), origen_tipo="service")
        bus.begin_step(0)
        bus.notify("o", "out", 5)  # valor retenido sin inyección
        self.assertEqual(destino.recibidos, [])
        bus.register_service_sample("o", 5)
        bus.notify("o", "out", 5)
        self.assertEqual(destino.recibidos, [("in", 5)])
        bus.end_step()
        bus.begin_step(1)
        bus.notify("o", "out", 5)
        self.assertEqual(destino.recibidos, [("in", 5)])


class LchTests(unittest.TestCase):
    def test_pulse_is_cleared_only_for_transitions(self):
        bus, transicion = build_bus(conexion("c", "lch"), destino_tipo="transition")
        bus.begin_step(0)
        bus.notify("o", "out", 1)
        bus.end_step()
        self.assertEqual(transicion.recibidos, [("in", True), ("in", False)])

        bus, bloque = build_bus(conexion("c", "lch"))
        bus.begin_step(0)
        bus.notify("o", "out", True)
        bus.end_step()
        self.assertEqual(bloque.recibidos, [("in", True)])


class CchTests(unittest.TestCase):
    def test_immediate_delivery(self):
        bus, destino = build_bus(conexion("c", "cch"))
        bus.notify("o", "out", [1, 2])
        self.assertEqual(destino.recibidos, [("in", [1, 2])])

    def test_delayed_cch_schedules_only_on_change_and_replaces_pending(self):
        bus, destino = build_bus(conexion("c", "cch", retardo_ms=100))
        bus.begin_step(0)
        bus.notify("o", "out", 7)
        bus.begin_step(50)
        bus.notify("o", "out", 7)  # mismo valor: no reprograma
        self.assertEqual(len(bus.diferidas), 1)
        bus.notify("o", "out", 8)  # cambio: reemplaza, no acumula
        self.assertEqual(len(bus.diferidas), 1)
        bus.begin_step(100)
        self.assertEqual(destino.recibidos, [])
        bus.begin_step(150)
        self.assertEqual(destino.recibidos, [("in", 8)])
        self.assertFalse(bus.has_deferred())

    def test_constant_delayed_values_do_not_grow_memory(self):
        bus, _ = build_bus(conexion("c", "cch", retardo_ms=100))
        valor = {"lista": list(range(20))}
        for paso in range(500):
            bus.begin_step(paso * 10)
            bus.notify("o", "out", valor)
            self.assertLessEqual(len(bus.diferidas), 1)


class EngineChannelIntegrationTests(unittest.TestCase):
    """Porta la prueba web «Service → DCH → Hold sin repetir muestras»."""

    def test_service_dch_hold_overflow_route(self):
        modelo = validate_ir_v2({
            "ir_version": 2,
            "elementos": [
                {"id": "srv", "tipo": "service", "nombre": "Eventos", "tipo_dato": "integer",
                 "salidas": ["out"], "entradas": []},
                {"id": "hold-1", "tipo": "hold", "nombre": "Hold", "habilitado": True, "tipo_dato": "integer",
                 "puerto_entrada": "in", "puerto_cch": "cch-out", "puerto_lch": "lch-out"},
            ],
            "conexiones": [
                {"id": "dch-1", "tipo": "dch", "origen": "srv", "puerto_origen": "out",
                 "destino": "hold-1", "puerto_destino": "in", "capacidad_cola": 2},
            ],
        })
        motor = HilesEngineV2(modelo)
        for valor in (10, 20, 30):
            motor.set_input("srv", valor)

        motor.step()
        self.assertEqual(motor.snapshot()["hold-1"], {
            "valor_retenido": 10, "salida": 10, "evento_pendiente": True,
            "cola_dch": 1, "cola_desbordada": True,
        })
        motor.step()
        estado = motor.snapshot()["hold-1"]
        self.assertEqual((estado["valor_retenido"], estado["evento_pendiente"]), (20, True))
        self.assertNotIn("cola_dch", estado)
        for _ in range(2):
            motor.step()
            estado = motor.snapshot()["hold-1"]
            self.assertEqual((estado["valor_retenido"], estado["evento_pendiente"]), (20, False))

        motor.reset()
        self.assertEqual(motor.snapshot()["hold-1"], {"evento_pendiente": False})
        self.assertFalse(motor.pending_work())


if __name__ == "__main__":
    unittest.main()
