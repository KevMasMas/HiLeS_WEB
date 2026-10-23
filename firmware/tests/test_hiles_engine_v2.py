import json
import unittest
from pathlib import Path

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.hiles.engine import InputError
from firmware.pico.hiles.engine_task_v2 import EngineTaskV2
from firmware.pico.hiles.engine_v2 import HilesEngineV2
from firmware.pico.hiles.model_v2 import validate_ir_v2
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

DEMO_IR = Path(__file__).resolve().parents[2] / "docs" / "traffic" / "ir_demo_semaforos_distribuidos.json"


def load_v2(category):
    return load_vectors("../vectores_ir_v2/" + category)


def run_vector(motor, vector, test):
    test.assertEqual(motor.snapshot(), vector["estado_inicial"], "estado inicial")
    for indice, paso in enumerate(vector["pasos"], start=1):
        for servicio_id, valor in paso.get("entradas", {}).items():
            motor.set_input(servicio_id, valor)
        motor.step(paso.get("avance_tiempo_ms", 0))
        test.assertEqual(motor.snapshot(), paso["elementos_esperados"], "paso {}".format(indice))


def python_model(codigo, salidas=None, entradas=None):
    return validate_ir_v2({
        "ir_version": 2,
        "elementos": [
            {"id": "srv", "tipo": "service", "nombre": "Entrada", "tipo_dato": "integer",
             "salidas": ["out"], "entradas": []},
            {"id": "fb", "tipo": "functional_block", "nombre": "Bloque", "habilitado": True,
             "lenguaje": "python", "codigo": codigo,
             "entradas": entradas or [{"puerto": "fb-in", "variable": "x", "tipo_dato": "integer"}],
             "salidas": salidas or [{"puerto": "fb-out", "variable": "y", "tipo_dato": "integer"}]},
            {"id": "otro", "tipo": "functional_block", "nombre": "Independiente", "habilitado": True,
             "lenguaje": "python", "codigo": "x + 1",
             "entradas": [{"puerto": "otro-in", "variable": "x", "tipo_dato": "integer"}],
             "salidas": [{"puerto": "otro-out", "variable": "y", "tipo_dato": "integer"}]},
        ],
        "conexiones": [
            {"id": "c1", "tipo": "cch", "origen": "srv", "puerto_origen": "out",
             "destino": "fb", "puerto_destino": "fb-in"},
            {"id": "c2", "tipo": "cch", "origen": "srv", "puerto_origen": "out",
             "destino": "otro", "puerto_destino": "otro-in"},
        ],
    })


class ConformanceVectorTests(unittest.TestCase):
    def test_reproduces_all_v2_execution_vectors(self):
        vectores = load_v2("ejecucion")
        self.assertGreaterEqual(len(vectores), 3)
        for nombre, vector in vectores:
            with self.subTest(vector=nombre):
                run_vector(HilesEngineV2(validate_ir_v2(vector["modelo"])), vector, self)

    def test_reset_restores_initial_state_for_all_vectors(self):
        for nombre, vector in load_v2("ejecucion"):
            with self.subTest(vector=nombre):
                motor = HilesEngineV2(validate_ir_v2(vector["modelo"]))
                for paso in vector["pasos"]:
                    for servicio_id, valor in paso.get("entradas", {}).items():
                        motor.set_input(servicio_id, valor)
                    motor.step(paso.get("avance_tiempo_ms", 0))
                motor.reset()
                self.assertEqual(motor.snapshot(), vector["estado_inicial"])
                self.assertFalse(motor.pending_work())
                run_vector(motor, vector, self)

    def test_snapshots_are_json_serializable_and_reproducible(self):
        _, vector = load_v2("ejecucion")[1]

        def ejecutar():
            motor = HilesEngineV2(validate_ir_v2(vector["modelo"]))
            salida = []
            for paso in vector["pasos"]:
                for servicio_id, valor in paso.get("entradas", {}).items():
                    motor.set_input(servicio_id, valor)
                motor.step(paso.get("avance_tiempo_ms", 0))
                salida.append(json.dumps(motor.snapshot(), sort_keys=True))
            return salida

        self.assertEqual(ejecutar(), ejecutar())


class PythonBlockTests(unittest.TestCase):
    def test_execution_error_is_observable_and_isolated(self):
        motor = HilesEngineV2(python_model("def calcular(x):\n    return 10 // (x - 3)"))
        motor.set_input("srv", 5)
        motor.step()
        self.assertEqual(motor.snapshot()["fb"], {"salida": 5})

        motor.set_input("srv", 3)
        motor.step()
        estado = motor.snapshot()
        self.assertEqual(estado["fb"], {"salida": 5, "error": "PYTHON_EJECUCION_ERROR"})
        self.assertEqual(estado["otro"], {"salida": 4})

        motor.set_input("srv", 4)
        motor.step()
        self.assertEqual(motor.snapshot()["fb"], {"salida": 10})

    def test_invalid_output_type_reports_value_code(self):
        motor = HilesEngineV2(python_model("def calcular(x):\n    return 'texto'"))
        motor.set_input("srv", 1)
        motor.step()
        self.assertEqual(motor.snapshot()["fb"]["error"], "VALOR_TIPO_INVALIDO")

    def test_none_means_no_output_and_multiple_outputs_are_routed(self):
        salidas = [
            {"puerto": "fb-par", "variable": "par", "tipo_dato": "boolean"},
            {"puerto": "fb-doble", "variable": "doble", "tipo_dato": "integer"},
        ]
        codigo = "def calcular(x):\n    if x < 0:\n        return None\n    return {'par': x % 2 == 0, 'doble': x * 2}"
        motor = HilesEngineV2(python_model(codigo, salidas=salidas))
        motor.set_input("srv", -1)
        motor.step()
        self.assertEqual(motor.snapshot()["fb"], {})
        motor.set_input("srv", 4)
        motor.step()
        self.assertEqual(motor.snapshot()["fb"], {"salida": True, "salidas": {"fb-par": True, "fb-doble": 8}})

    def test_disabled_block_does_not_execute(self):
        modelo = python_model("x * 2")
        modelo["elementos"][1]["habilitado"] = False
        motor = HilesEngineV2(modelo)
        motor.set_input("srv", 2)
        motor.step()
        self.assertEqual(motor.snapshot()["fb"], {})
        self.assertEqual(motor.element("fb").executor.run_count, 0)

    def test_code_is_compiled_once_per_load(self):
        motor = HilesEngineV2(python_model("x * 2"))
        for valor in range(5):
            motor.set_input("srv", valor)
            motor.step()
        motor.reset()
        motor.step()
        self.assertEqual(motor.element("fb").executor.compile_count, 1)


class ValueBoundsTests(unittest.TestCase):
    def vector_model(self):
        return validate_ir_v2({
            "ir_version": 2,
            "elementos": [
                {"id": "v", "tipo": "service", "nombre": "Vector", "tipo_dato": "vector",
                 "salidas": ["out"], "entradas": []},
                {"id": "c", "tipo": "service", "nombre": "Custom", "tipo_dato": "custom",
                 "salidas": ["out"], "entradas": []},
            ],
            "conexiones": [],
        })

    def test_injected_values_are_bounded_and_copied_once(self):
        motor = HilesEngineV2(self.vector_model())
        with self.assertRaises(InputError):
            motor.set_input("v", list(range(33)))
        with self.assertRaises(InputError):
            motor.set_input("v", "no es vector")
        with self.assertRaises(InputError):
            motor.set_input("c", {"a": {"b": {"c": {"d": {"e": {"f": {"g": 1}}}}}}})
        self.assertEqual(motor.snapshot(), {"v": {}, "c": {}})

        original = [1, 2, 3]
        motor.set_input("v", original)
        original.append(4)  # mutar el valor del llamador no altera el motor
        motor.step()
        retenido = motor.snapshot()["v"]["valor"]
        self.assertEqual(retenido, [1, 2, 3])
        for _ in range(10):
            motor.step()
        # El mismo objeto viaja en cada paso: no se crean copias por propagación.
        self.assertIs(motor.snapshot()["v"]["valor"], retenido)


class EngineTaskV2Tests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.scheduler = Scheduler(clock=self.clock)
        self.node = Node()
        self.transport = FakeTransport(self.node)
        self.task = EngineTaskV2(self.scheduler, self.node, period_ms=20, step_interval_ms=100)

    def send(self, topic, payload):
        self.assertTrue(self.transport.inject(full_topic(topic), json.dumps(payload).encode("utf-8")))

    def drain(self):
        while self.task.pending():
            self.clock.advance_ms(20)
            self.scheduler.run_pending()

    def load(self, modelo, ir_version=2, version=1, id_mensaje="carga"):
        self.send(MODELO_CARGAR, {
            "modelo_id": "m", "version": version, "ir_version": ir_version,
            "modelo": modelo, "id_mensaje": id_mensaje,
        })
        self.drain()
        return self.transport.published_for(MODELO_CONFIRMACION)[-1]["payload"]

    def test_v2_vector_through_mqtt_messages(self):
        _, vector = load_v2("ejecucion")[1]
        confirmacion = self.load(vector["modelo"])
        self.assertEqual((confirmacion["aceptado"], confirmacion["ir_version"]), (True, 2))
        self.assertEqual(self.transport.published_for(SIMULACION_ESTADO)[-1]["payload"]["elementos"], vector["estado_inicial"])
        for indice, paso in enumerate(vector["pasos"], start=1):
            for servicio_id, valor in paso["entradas"].items():
                self.send(ENTRADA_ESTABLECER, {"servicio_id": servicio_id, "valor": valor, "modelo_id": "m",
                                               "version": 1, "id_mensaje": "e{}{}".format(indice, servicio_id)})
            self.send(SIMULACION_COMANDO, {"accion": "paso", "modelo_id": "m", "version": 1,
                                           "id_mensaje": "p{}".format(indice)})
            self.drain()
            estado = self.transport.published_for(SIMULACION_ESTADO)[-1]["payload"]
            self.assertEqual(estado["secuencia"], indice)
            self.assertEqual(estado["elementos"], paso["elementos_esperados"])
        self.assertEqual(self.transport.published_for(ERROR), [])

    def test_v1_models_keep_v1_engine_and_snapshots(self):
        for nombre, vector in load_vectors("ejecucion"):
            with self.subTest(vector=nombre):
                confirmacion = self.load(vector["modelo"], ir_version=1, id_mensaje="c-" + nombre)
                self.assertEqual((confirmacion["aceptado"], confirmacion["ir_version"]), (True, 1))
                self.assertEqual(self.task.ir_version, 1)
                for paso in vector["pasos"]:
                    for servicio_id, valor in paso["entradas"].items():
                        self.task.engine.set_input(servicio_id, valor)
                    self.task.engine.step()
                    self.assertEqual(self.task.engine.snapshot(), paso["elementos_esperados"])

    def test_compile_failure_keeps_previous_model(self):
        _, vector = load_v2("ejecucion")[0]
        self.load(vector["modelo"])
        activo = self.task.engine

        modelo = python_model("x * 2")
        modelo["elementos"][1]["codigo"] = "def calcular(x):\n    return (x"  # error de compilación
        confirmacion = self.load(modelo, version=2, id_mensaje="carga-mala")
        self.assertFalse(confirmacion["aceptado"])
        self.assertEqual(confirmacion["codigo"], "PYTHON_COMPILACION_ERROR")
        self.assertIn("fb", confirmacion["error"])
        self.assertEqual(confirmacion["ir_version"], 2)
        self.assertIs(self.task.engine, activo)
        self.assertEqual(self.task.version, 1)

    def test_invalid_python_signature_keeps_previous_model(self):
        _, vector = load_v2("ejecucion")[0]
        self.load(vector["modelo"])
        activo = self.task.engine

        invalido = python_model("def calcular(x):\n    return x")
        invalido["elementos"][1]["codigo"] = "def calcular(z):\n    return z"
        confirmacion = self.load(invalido, version=2, id_mensaje="firma-mala")
        self.assertFalse(confirmacion["aceptado"])
        self.assertEqual(confirmacion["codigo"], "PYTHON_CODIGO_INVALIDO")
        self.assertIs(self.task.engine, activo)
        self.assertEqual(self.task.version, 1)

    def test_profile_violation_is_rejected_before_compiling(self):
        _, invalido = load_v2("modelos/invalidos")[0]
        confirmacion = self.load(invalido["modelo"], id_mensaje="import")
        self.assertEqual((confirmacion["aceptado"], confirmacion["codigo"]), (False, "PYTHON_PERFIL_PROHIBIDO"))
        self.assertIsNone(self.task.engine)

    def test_local_inputs_from_devices(self):
        _, vector = load_v2("ejecucion")[2]
        self.load(vector["modelo"])
        self.assertTrue(self.task.submit_local_input("entrada-habilitar", True))
        self.assertTrue(self.task.submit_local_input("no-existe", True))
        self.assertTrue(self.task.submit_local_input("entrada-habilitar", "no booleano"))
        self.drain()
        self.assertEqual(self.task.local_inputs_applied, 1)
        self.assertEqual(self.task.local_inputs_ignored, 2)
        self.assertEqual(self.task.stats()["ir_version"], 2)

    def test_manual_services_demo_ir_runs(self):
        modelo = json.loads(DEMO_IR.read_text(encoding="utf-8"))
        confirmacion = self.load(modelo)
        self.assertTrue(confirmacion["aceptado"])
        for sentido in ("norte", "sur", "este", "oeste"):
            self.task.submit_local_input("sensor-" + sentido, 5 if sentido == "este" else 0)
        self.drain()
        self.task.engine.step(1000)
        estado = self.task.engine.snapshot()
        self.assertEqual(estado["lamparas-norte"]["salidas"]["lamparas-norte-rojo"], True)
        self.assertEqual(estado["lamparas-este"]["salidas"]["lamparas-este-solicitud"], True)
        self.assertEqual(estado["seguridad-cruce"]["salidas"], {"seguridad-seguro": True, "seguridad-eje": "todo-rojo"})
        for elemento in estado.values():
            self.assertNotIn("error", elemento)

        self.task.engine.set_input("luz-norte", "verde")
        self.task.engine.set_input("luz-este", "amarillo")
        self.task.engine.step(1000)
        self.assertEqual(
            self.task.engine.snapshot()["seguridad-cruce"]["salidas"],
            {"seguridad-seguro": False, "seguridad-eje": "conflicto"},
        )


if __name__ == "__main__":
    unittest.main()
