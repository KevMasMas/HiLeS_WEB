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

    def test_remote_outbound_and_inbound_channels_preserve_cch_dch_lch_and_delays(self):
        # Fragmento emisor: service-a -> (dch remoto con retardo) + fb-b -> (cch remoto)
        modelo_emisor = validate_ir_v2({
            "ir_version": 2,
            "elementos": [
                {"id": "service-a", "tipo": "service", "nombre": "Entrada", "tipo_dato": "integer",
                 "salidas": ["out"], "entradas": []},
                {"id": "fb-b", "tipo": "functional_block", "nombre": "Doble", "habilitado": True,
                 "lenguaje": "python", "codigo": "x * 2",
                 "entradas": [{"puerto": "in", "variable": "x", "tipo_dato": "integer"}],
                 "salidas": [{"puerto": "out", "variable": "res", "tipo_dato": "integer"}]},
            ],
            "conexiones": [
                {"id": "local-a-b", "tipo": "cch", "origen": "service-a", "puerto_origen": "out",
                 "destino": "fb-b", "puerto_destino": "in"},
            ],
        })
        ruta_dch = {
            "connection_id": "rem-dch",
            "tipo": "dch",
            "tipo_dato": "integer",
            "source_element_id": "service-a",
            "source_port_id": "out",
            "source_executor_id": "pico:a",
            "target_element_id": "hold-c",
            "target_port_id": "in",
            "target_executor_id": "pico:b",
            "capacidad_cola": 2,
            "retardo_ms": 50,
        }
        ruta_cch = {
            "connection_id": "rem-cch",
            "tipo": "cch",
            "tipo_dato": "integer",
            "source_element_id": "fb-b",
            "source_port_id": "out",
            "source_executor_id": "pico:a",
            "target_element_id": "fb-d",
            "target_port_id": "in",
            "target_executor_id": "pico:b",
        }

        emitidos = []
        emisor = HilesEngineV2(
            modelo_emisor,
            outbound_routes=[ruta_dch, ruta_cch],
            remote_sink=lambda conn_id, val: emitidos.append((conn_id, val)),
        )

        # Fragmento receptor: hold-c (recibe DCH remoto), fb-d (recibe CCH remoto) y transition-t (recibe LCH remoto)
        modelo_receptor = validate_ir_v2({
            "ir_version": 2,
            "elementos": [
                {"id": "hold-c", "tipo": "hold", "nombre": "Hold C", "habilitado": True, "tipo_dato": "integer",
                 "puerto_entrada": "in", "puerto_cch": "out", "puerto_lch": "pulse"},
                {"id": "fb-d", "tipo": "functional_block", "nombre": "Mas diez", "habilitado": True,
                 "lenguaje": "python", "codigo": "x + 10",
                 "entradas": [{"puerto": "in", "variable": "x", "tipo_dato": "integer"}],
                 "salidas": [{"puerto": "out", "variable": "res", "tipo_dato": "integer"}]},
                {"id": "place-p", "tipo": "place", "nombre": "P", "tokens": 1, "capacidad": 1},
                {"id": "place-q", "tipo": "place", "nombre": "Q", "tokens": 0, "capacidad": 1},
                {"id": "trans-t", "tipo": "transition", "nombre": "T", "habilitada": True,
                 "puerto_condicion": "cond", "puerto_accion": None},
            ],
            "conexiones": [
                {"id": "arc-p-t", "tipo": "arco", "origen": "place-p", "destino": "trans-t", "peso": 1},
                {"id": "arc-t-q", "tipo": "arco", "origen": "trans-t", "destino": "place-q", "peso": 1},
            ],
        })
        ruta_lch = {
            "connection_id": "rem-lch",
            "tipo": "lch",
            "tipo_dato": "boolean",
            "source_element_id": "hold-c",
            "source_port_id": "pulse",
            "source_executor_id": "pico:a",
            "target_element_id": "trans-t",
            "target_port_id": "cond",
            "target_executor_id": "pico:b",
        }
        receptor = HilesEngineV2(
            modelo_receptor,
            inbound_routes=[ruta_dch, ruta_cch, ruta_lch],
        )

        # Paso 1 en emisor: inyectamos 3 muestras en service-a (5, 6, 7).
        for m in (5, 6, 7):
            emisor.set_input("service-a", m)
        emisor.step(0)
        # El CCH remoto emite inmediatamente 7*2=14; el DCH remoto tiene retardo 50 ms y está pendiente.
        self.assertEqual(emitidos, [("rem-cch", 14)])
        self.assertTrue(emisor.pending_work())

        # Paso 2 en emisor sin cambiar entrada y sin vencer retardo: CCH no vuelve a emitir el mismo 14.
        emitidos.clear()
        emisor.step(20)
        self.assertEqual(emitidos, [])

        # Paso 3 en emisor: vence retardo (20 + 30 = 50 ms) -> emite las 3 muestras DCH en orden.
        emisor.step(30)
        self.assertEqual(emitidos, [("rem-dch", 5), ("rem-dch", 6), ("rem-dch", 7)])

        # Las inyectamos en el receptor junto con el CCH (14) y un pulso LCH (True).
        receptor.inject_remote_channel("rem-cch", 14)
        for _, valor_dch in emitidos:
            receptor.inject_remote_channel("rem-dch", valor_dch)
        receptor.inject_remote_channel("rem-lch", True)

        receptor.step(0)
        snap1 = receptor.snapshot()
        # fb-d calculó 14 + 10 = 24; hold-c consumió 5, tiene 6 en cola y 7 desbordó (capacidad 2); trans-t disparó.
        self.assertEqual(snap1["fb-d"]["salida"], 24)
        self.assertEqual(snap1["hold-c"], {
            "valor_retenido": 5,
            "salida": 5,
            "evento_pendiente": True,
            "cola_dch": 1,
            "cola_desbordada": True,
        })
        self.assertEqual(snap1["trans-t"]["disparada"], True)
        self.assertEqual(snap1["place-p"]["tokens"], 0)
        self.assertEqual(snap1["place-q"]["tokens"], 1)

        # Siguiente paso del receptor: hold-c consume 6 y el pulso LCH sobre trans-t ya se limpió.
        receptor.step(10)
        snap2 = receptor.snapshot()
        self.assertEqual(snap2["hold-c"]["valor_retenido"], 6)
        self.assertEqual(snap2["trans-t"]["habilitada"], False)


if __name__ == "__main__":
    unittest.main()
