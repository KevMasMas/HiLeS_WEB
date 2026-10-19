import ast
import json
import unittest
from pathlib import Path

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.devices.traffic_controller import (
    AMARILLO,
    ESTE,
    MATRIZ_CONFLICTOS,
    MODO_SEGURO,
    NORTE,
    OESTE,
    ROJO,
    SENTIDOS,
    SUR,
    VERDE,
    TrafficControllerTask,
    TrafficTiming,
    engine_inputs,
    incompatible_greens,
    validate_conflict_matrix,
)
from firmware.pico.devices.vehicle_sensor_task import (
    ManualVehicleSource,
    ScriptedVehicleSource,
    SimulatedVehicleSource,
    VehicleSensorTask,
    normalize_presence,
)
from firmware.pico.hiles.engine_task_v2 import EngineTaskV2
from firmware.pico.platform.traffic_io import GpioPresenceInput, TrafficLightOutput, build_traffic_io
from firmware.pico.pubsub import MODELO_CARGAR, MODELO_CONFIRMACION, Node, full_topic
from firmware.tests.fakes import FakeClock, FakeTransport

ROOT = Path(__file__).resolve().parents[2]
TIMING = TrafficTiming(verde_min_ms=5000, verde_max_ms=20000, amarillo_ms=3000, todo_rojo_ms=2000, espera_max_ms=30000)


class Lectura:
    """Sensor controlado directamente por la prueba."""

    def __init__(self, valor=False):
        self.valor = valor

    def reading(self):
        if isinstance(self.valor, Exception):
            raise self.valor
        return self.valor


class Cruce:
    def __init__(self, timing=TIMING, outputs=None, on_change=None, on_engine_input=None):
        self.clock = FakeClock()
        self.scheduler = Scheduler(clock=self.clock)
        self.sensores = dict((s, Lectura()) for s in SENTIDOS)
        self.controlador = TrafficControllerTask(
            self.scheduler,
            self.sensores,
            timing=timing,
            outputs=outputs,
            on_change=on_change,
            on_engine_input=on_engine_input,
            period_ms=100,
        )
        self.historial = []
        self.transiciones = []

    def colores(self):
        return dict((s, self.controlador.fsms[s].color) for s in SENTIDOS)

    def run(self, ms, paso=100):
        for _ in range(ms // paso):
            anterior = self.colores()
            self.clock.advance_ms(paso)
            self.scheduler.run_pending()
            actual = self.colores()
            self.historial.append((self.clock.now_ms(), actual))
            for sentido in SENTIDOS:
                if anterior[sentido] != actual[sentido]:
                    self.transiciones.append((self.clock.now_ms(), sentido, anterior[sentido], actual[sentido]))

    def start(self):
        return self


class MatrixTests(unittest.TestCase):
    def test_default_matrix_is_symmetric(self):
        validate_conflict_matrix(SENTIDOS, MATRIZ_CONFLICTOS)
        self.assertNotIn(SUR, MATRIZ_CONFLICTOS[NORTE])
        self.assertNotIn(OESTE, MATRIZ_CONFLICTOS[ESTE])

    def test_invalid_matrices_are_rejected(self):
        with self.assertRaises(ValueError):
            validate_conflict_matrix(SENTIDOS, {NORTE: (ESTE,), SUR: (), ESTE: (), OESTE: ()})
        with self.assertRaises(ValueError):
            validate_conflict_matrix(SENTIDOS, {NORTE: (NORTE,), SUR: (), ESTE: (), OESTE: ()})

    def test_matrix_document_and_demo_match_firmware(self):
        documento = (ROOT / "docs" / "traffic" / "MATRIZ_CONFLICTOS.md").read_text(encoding="utf-8")
        for sentido, conflictos in MATRIZ_CONFLICTOS.items():
            for otro in conflictos:
                self.assertIn("| {} | {} |".format(sentido, otro), documento)
        generador = (ROOT / "scripts" / "generate-distributed-traffic-demo.mjs").read_text(encoding="utf-8")
        for sentido, conflictos in MATRIZ_CONFLICTOS.items():
            self.assertIn("{}: [{}]".format(sentido, ", ".join("'{}'".format(o) for o in conflictos)), generador)

    def test_timing_validation(self):
        with self.assertRaises(ValueError):
            TrafficTiming(verde_min_ms=10, verde_max_ms=5)
        with self.assertRaises(ValueError):
            TrafficTiming(amarillo_ms=0)


class SequenceTests(unittest.TestCase):
    def test_starts_all_red_and_grants_after_all_red_interval(self):
        cruce = Cruce().start()
        self.assertEqual(set(cruce.colores().values()), {ROJO})
        cruce.sensores[NORTE].valor = True
        cruce.run(1900)
        self.assertEqual(cruce.colores()[NORTE], ROJO)
        cruce.run(200)
        self.assertEqual(cruce.colores()[NORTE], VERDE)

    def test_green_always_goes_through_yellow(self):
        cruce = Cruce().start()
        cruce.sensores[NORTE].valor = True
        cruce.run(3000)
        cruce.sensores[NORTE].valor = False
        cruce.run(20000)
        cambios = [(a, b) for _, s, a, b in cruce.transiciones if s == NORTE]
        self.assertEqual(cambios, [(ROJO, VERDE), (VERDE, AMARILLO), (AMARILLO, ROJO)])

    def test_minimum_green_and_yellow_durations(self):
        cruce = Cruce().start()
        cruce.sensores[NORTE].valor = True
        cruce.run(2100)
        inicio_verde = [t for t, s, a, b in cruce.transiciones if s == NORTE and b == VERDE][0]
        cruce.sensores[NORTE].valor = False
        cruce.run(15000)
        inicio_amarillo = [t for t, s, a, b in cruce.transiciones if s == NORTE and b == AMARILLO][0]
        fin_amarillo = [t for t, s, a, b in cruce.transiciones if s == NORTE and a == AMARILLO][0]
        self.assertGreaterEqual(inicio_amarillo - inicio_verde, TIMING.verde_min_ms)
        self.assertGreaterEqual(fin_amarillo - inicio_amarillo, TIMING.amarillo_ms)

    def test_compatible_directions_share_green(self):
        cruce = Cruce().start()
        cruce.sensores[NORTE].valor = True
        cruce.sensores[SUR].valor = True
        cruce.run(2500)
        self.assertEqual((cruce.colores()[NORTE], cruce.colores()[SUR]), (VERDE, VERDE))

    def test_all_red_before_conflicting_movement(self):
        cruce = Cruce().start()
        cruce.sensores[NORTE].valor = True
        cruce.run(2500)
        cruce.sensores[ESTE].valor = True
        cruce.sensores[NORTE].valor = False
        cruce.run(30000)
        rojo_norte = [t for t, s, a, b in cruce.transiciones if s == NORTE and b == ROJO][0]
        verde_este = [t for t, s, a, b in cruce.transiciones if s == ESTE and b == VERDE][0]
        self.assertGreaterEqual(verde_este - rojo_norte, TIMING.todo_rojo_ms)


class FairnessAndSafetyTests(unittest.TestCase):
    def assert_safe(self, cruce):
        for instante, colores in cruce.historial:
            self.assertEqual(incompatible_greens(colores), [], "conflicto en t={}".format(instante))
        for _, sentido, anterior, nuevo in cruce.transiciones:
            self.assertNotEqual((anterior, nuevo), (VERDE, ROJO), sentido)

    def test_sustained_demand_alternates_axes_without_starvation(self):
        cruce = Cruce().start()
        for sentido in SENTIDOS:
            cruce.sensores[sentido].valor = True
        cruce.run(200000)
        self.assert_safe(cruce)
        verdes = dict((s, 0) for s in SENTIDOS)
        for _, sentido, _, nuevo in cruce.transiciones:
            if nuevo == VERDE:
                verdes[sentido] += 1
        self.assertGreaterEqual(min(verdes.values()), 3)
        # Tiempo máximo en rojo: todo-rojo + verde máximo contrario + amarillo
        # contrario + todo-rojo + un periodo del controlador.
        limite = TIMING.verde_max_ms + TIMING.amarillo_ms + 2 * TIMING.todo_rojo_ms + 200
        self.assertLessEqual(self.max_wait(cruce), limite)

    def max_wait(self, cruce):
        peor = 0
        rojo_desde = dict((s, 0) for s in SENTIDOS)
        for instante, colores in cruce.historial:
            for sentido in SENTIDOS:
                if colores[sentido] == ROJO:
                    peor = max(peor, instante - rojo_desde[sentido])
                else:
                    rojo_desde[sentido] = instante
        return peor

    def test_long_wait_forces_conflicting_green_to_yield(self):
        timing = TrafficTiming(verde_min_ms=5000, verde_max_ms=60000, amarillo_ms=3000, todo_rojo_ms=2000, espera_max_ms=10000)
        cruce = Cruce(timing=timing).start()
        cruce.sensores[NORTE].valor = True
        cruce.run(3000)
        cruce.sensores[ESTE].valor = True
        cruce.run(30000)
        verde_este = [t for t, s, a, b in cruce.transiciones if s == ESTE and b == VERDE]
        self.assertTrue(verde_este)
        self.assertLessEqual(verde_este[0] - 3000, timing.espera_max_ms + timing.amarillo_ms + timing.todo_rojo_ms + 200)
        self.assert_safe(cruce)

    def test_random_traffic_never_produces_incompatible_greens(self):
        for semilla in range(1, 4):
            with self.subTest(semilla=semilla):
                cruce = Cruce().start()
                fuentes = dict(
                    (s, SimulatedVehicleSource(semilla * 31 + i, prob_llegada=0.05, prob_salida=0.03))
                    for i, s in enumerate(SENTIDOS)
                )
                for _ in range(1500):
                    for sentido in SENTIDOS:
                        cruce.sensores[sentido].valor = fuentes[sentido].read()
                    cruce.run(200)
                self.assert_safe(cruce)
                self.assertEqual(cruce.controlador.violaciones, 0)

    def test_invalid_sensor_is_treated_as_demand(self):
        cruce = Cruce().start()
        cruce.sensores[OESTE].valor = None
        cruce.sensores[SUR].valor = RuntimeError("sensor desconectado")
        cruce.sensores[NORTE].valor = "basura"
        cruce.run(40000)
        estado = cruce.controlador.snapshot()["sentidos"]
        self.assertFalse(estado[OESTE]["sensor_valido"])
        self.assertTrue(estado[OESTE]["presencia"])
        servidos = set(s for _, s, _, b in cruce.transiciones if b == VERDE)
        self.assertTrue({OESTE, SUR, NORTE} <= servidos)
        self.assert_safe(cruce)

    def test_safety_monitor_enters_safe_mode(self):
        cruce = Cruce().start()
        # Fuerza artificialmente un estado imposible para comprobar el monitor.
        cruce.controlador.fsms[NORTE].color = VERDE
        cruce.controlador.fsms[ESTE].color = VERDE
        cruce.run(100)
        self.assertEqual(cruce.controlador.modo, MODO_SEGURO)
        self.assertEqual(cruce.colores()[NORTE], AMARILLO)
        self.assertEqual(cruce.colores()[ESTE], AMARILLO)
        cruce.run(5000)
        self.assertEqual(set(cruce.colores().values()), {ROJO})
        self.assertTrue(cruce.controlador.reset_safe_mode())

    def test_each_fsm_keeps_its_own_state(self):
        cruce = Cruce().start()
        fsms = cruce.controlador.fsms
        self.assertEqual(len(set(id(f) for f in fsms.values())), 4)
        cruce.sensores[NORTE].valor = True
        cruce.run(2500)
        self.assertEqual(fsms[NORTE].color, VERDE)
        self.assertEqual(fsms[SUR].color, ROJO)  # Sur no tiene vehículos: no se enciende
        self.assertFalse(fsms[SUR].presencia)


class OutputsAndPublicationTests(unittest.TestCase):
    def test_outputs_publication_and_engine_inputs(self):
        class Salida:
            def __init__(self):
                self.colores = []

            def show(self, color):
                self.colores.append(color)

        salidas = dict((s, Salida()) for s in SENTIDOS)
        publicados = []
        entradas = []
        cruce = Cruce(outputs=salidas, on_change=publicados.append,
                      on_engine_input=lambda k, v: entradas.append((k, v))).start()
        cruce.sensores[NORTE].valor = True
        cruce.run(2500)
        self.assertEqual(salidas[NORTE].colores[-1], VERDE)
        self.assertEqual(publicados[-1]["sentidos"][NORTE]["color"], VERDE)
        self.assertIn(("luz-norte", VERDE), entradas)
        self.assertIn(("sensor-norte", True), entradas)
        # Solo se publican cambios.
        cantidad = len(publicados)
        cruce.run(1000)
        self.assertEqual(len(publicados), cantidad)
        self.assertEqual(sorted(engine_inputs(cruce.controlador.fsms)), sorted(
            ["sensor-" + s for s in SENTIDOS] + ["luz-" + s for s in SENTIDOS]
        ))

    def test_controller_drives_the_hiles_demo_model(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        node = Node()
        transport = FakeTransport(node)
        motor = EngineTaskV2(scheduler, node, period_ms=20, step_interval_ms=500)
        modelo = json.loads((ROOT / "docs" / "traffic" / "ir_demo_semaforos_distribuidos.json").read_text(encoding="utf-8"))
        transport.inject(full_topic(MODELO_CARGAR), json.dumps({
            "modelo_id": "semaforos", "version": 1, "ir_version": 2, "modelo": modelo, "id_mensaje": "c",
        }))
        fuentes = dict((s, ManualVehicleSource(s in (NORTE, ESTE))) for s in SENTIDOS)
        sensores = dict((s, VehicleSensorTask(scheduler, fuentes[s], s)) for s in SENTIDOS)
        TrafficControllerTask(scheduler, sensores, timing=TIMING, on_engine_input=motor.submit_local_input)
        motor.queue_size = 32
        for _ in range(600):
            clock.advance_ms(50)
            scheduler.run_pending()
            if motor.engine is not None and not motor.pending():
                motor.engine.step()
                cruce = motor.engine.snapshot()["seguridad-cruce"]
                if "salidas" in cruce:
                    self.assertTrue(cruce["salidas"]["seguridad-seguro"])
        self.assertTrue(transport.published_for(MODELO_CONFIRMACION)[0]["payload"]["aceptado"])
        self.assertGreater(motor.local_inputs_applied, 8)
        estado = motor.engine.snapshot()
        self.assertTrue(any(estado["lamparas-" + s].get("salidas", {}).get("lamparas-{}-verde".format(s)) for s in SENTIDOS))


class SensorTaskTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.scheduler = Scheduler(clock=self.clock)

    def avanzar(self, ms):
        for _ in range(ms // 50):
            self.clock.advance_ms(50)
            self.scheduler.run_pending()

    def test_debounce_and_fault_detection(self):
        fuente = ManualVehicleSource(False)
        sensor = VehicleSensorTask(self.scheduler, fuente, NORTE, confirmaciones=2, falla_ms=300)
        fuente.set(True)
        self.avanzar(50)
        self.assertFalse(sensor.reading())
        self.avanzar(50)
        self.assertTrue(sensor.reading())

        fuente.set("ruido")
        self.avanzar(200)
        self.assertTrue(sensor.reading())  # conserva la última lectura confiable
        self.avanzar(200)
        self.assertIsNone(sensor.reading())
        self.assertTrue(sensor.en_falla)
        fuente.set(0)
        self.avanzar(100)
        self.assertFalse(sensor.reading())

    def test_normalize_and_sources(self):
        self.assertEqual([normalize_presence(v) for v in (True, 0, 1, 2, "1", None)], [True, False, True, None, None, None])
        a = SimulatedVehicleSource(5)
        b = SimulatedVehicleSource(5)
        self.assertEqual([a.read() for _ in range(50)], [b.read() for _ in range(50)])
        guion = ScriptedVehicleSource(self.clock, [(1000, True), (3000, False)])
        self.assertFalse(guion.read())
        self.clock.advance_ms(1500)
        self.assertTrue(guion.read())
        self.clock.advance_ms(2000)
        self.assertFalse(guion.read())


class FakePin:
    IN = "in"
    OUT = "out"
    PULL_UP = "up"
    niveles = {}

    def __init__(self, numero, modo, pull=None):
        self.numero = numero
        self.modo = modo
        FakePin.niveles.setdefault(numero, 1)

    def value(self, nivel=None):
        if nivel is None:
            return FakePin.niveles[self.numero]
        FakePin.niveles[self.numero] = nivel


class FakeMachine:
    Pin = FakePin


class TrafficIoTests(unittest.TestCase):
    def test_gpio_adapters_with_fake_machine(self):
        entrada = GpioPresenceInput(2, machine_module=FakeMachine)
        self.assertFalse(entrada.read())
        FakePin.niveles[2] = 0
        self.assertTrue(entrada.read())

        salida = TrafficLightOutput({"rojo": 10, "amarillo": 11, "verde": 12}, machine_module=FakeMachine)
        self.assertEqual([FakePin.niveles[p] for p in (10, 11, 12)], [1, 0, 0])
        salida.show("verde")
        self.assertEqual([FakePin.niveles[p] for p in (10, 11, 12)], [0, 0, 1])
        salida.show("morado")
        self.assertEqual(salida.color, "rojo")

    def test_build_from_config(self):
        class Config:
            TRAFFIC_SENSOR_PINS = {"norte": 2}
            TRAFFIC_LIGHT_PINS = {"norte": {"rojo": 3, "amarillo": 4, "verde": 5}}

        fuentes, salidas = build_traffic_io(Config, machine_module=FakeMachine)
        self.assertEqual(list(fuentes), ["norte"])
        self.assertEqual(list(salidas), ["norte"])
        self.assertEqual(build_traffic_io(object(), machine_module=FakeMachine), ({}, {}))

    def test_logic_modules_do_not_import_hardware(self):
        for ruta in ("devices/traffic_controller.py", "devices/vehicle_sensor_task.py"):
            arbol = ast.parse((ROOT / "firmware" / "pico" / ruta).read_text(encoding="utf-8"))
            for nodo in ast.walk(arbol):
                if isinstance(nodo, (ast.Import, ast.ImportFrom)):
                    nombres = [a.name for a in nodo.names] if isinstance(nodo, ast.Import) else [nodo.module or ""]
                    for nombre in nombres:
                        self.assertNotIn(nombre.split(".")[0], ("machine", "network", "platform", "umqtt"), ruta)


if __name__ == "__main__":
    unittest.main()
