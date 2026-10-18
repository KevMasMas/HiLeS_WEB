import json
import unittest
from pathlib import Path

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.core.task import Task
from firmware.pico.hiles.python_executor import (
    PYTHON_COMPILACION_ERROR,
    PYTHON_EJECUCION_ERROR,
    PYTHON_PERFIL_PROHIBIDO,
    PYTHON_SALIDA_INVALIDA,
    PythonExecutor,
    PythonExecutorError,
    validate_python_source,
)
from firmware.tests.fakes import FakeClock


class PythonExecutorTests(unittest.TestCase):
    def assert_code(self, code, callback):
        with self.assertRaises(PythonExecutorError) as captured:
            callback()
        self.assertEqual(captured.exception.codigo, code)
        return captured.exception

    def test_expression_is_compiled_once_and_reused(self):
        executor = PythonExecutor(
            "fb-suma",
            "a + b",
            ["a", "b"],
            ["resultado"],
            input_types={"a": "real", "b": "real"},
            output_types={"resultado": "real"},
        )
        self.assertEqual(executor.execute({"a": 2, "b": 3}), {"resultado": 5})
        self.assertEqual(executor.execute({"a": 7, "b": 1}), {"resultado": 8})
        self.assertEqual(executor.compile_count, 1)
        self.assertEqual(executor.run_count, 2)

    def test_function_with_inputs_get_matches_editor_example(self):
        source = """def calcular(**inputs):
    vehiculos = inputs.get('vehiculos')
    if vehiculos is None:
        return False
    return vehiculos < 10
"""
        executor = PythonExecutor(
            "fb-cupo",
            source,
            ["vehiculos"],
            ["hay_cupo"],
            input_types={"vehiculos": "integer"},
            output_types={"hay_cupo": "boolean"},
        )
        self.assertEqual(executor.execute({"vehiculos": 7}), {"hay_cupo": True})
        self.assertEqual(executor.execute({"vehiculos": 12}), {"hay_cupo": False})

    def test_multiple_outputs_require_declared_mapping(self):
        executor = PythonExecutor(
            "fb-estados",
            """def calcular(x):
    return {'doble': x * 2, 'positivo': x > 0}
""",
            ["x"],
            ["doble", "positivo"],
            output_types={"doble": "integer", "positivo": "boolean"},
        )
        self.assertEqual(executor.execute({"x": 4}), {"doble": 8, "positivo": True})

        scalar = PythonExecutor("fb-mal", "x + 1", ["x"], ["a", "b"])
        self.assert_code(PYTHON_SALIDA_INVALIDA, lambda: scalar.execute({"x": 1}))

    def test_custom_single_output_may_be_a_dictionary(self):
        executor = PythonExecutor(
            "fb-custom",
            """def calcular(x):
    return {'medida': x, 'valida': x > 0}
""",
            ["x"],
            ["estado"],
            output_types={"estado": "custom"},
        )
        self.assertEqual(
            executor.execute({"x": 2}),
            {"estado": {"medida": 2, "valida": True}},
        )

    def test_rejects_blocking_privileged_and_dynamic_constructs(self):
        forbidden = [
            "import machine",
            "while True:\n    pass",
            "[x for x in datos]",
            "open('secreto')",
            "eval('1 + 1')",
            "machine.Pin(1)",
            "def calcular(x):\n    return calcular(x)",
            "def calcular(x):\n    return x\ndef otra():\n    return 1",
            "def calcular(x):\n    return f'{().__class__}'",
        ]
        for source in forbidden:
            with self.subTest(source=source):
                self.assert_code(PYTHON_PERFIL_PROHIBIDO, lambda source=source: validate_python_source(source))

    def test_allows_comments_before_the_single_function(self):
        executor = PythonExecutor(
            "fb-comentado",
            "# Código pedagógico\n\ndef calcular(x):\n    return x + 1",
            ["x"],
            ["salida"],
        )
        self.assertEqual(executor.execute({"x": 2}), {"salida": 3})

    def test_reports_compile_runtime_and_output_errors_with_element(self):
        compile_error = self.assert_code(
            PYTHON_COMPILACION_ERROR,
            lambda: PythonExecutor("fb-sintaxis", "x +", ["x"], ["y"]),
        )
        self.assertEqual(compile_error.element_id, "fb-sintaxis")

        runtime = PythonExecutor("fb-cero", "10 / divisor", ["divisor"], ["salida"])
        runtime_error = self.assert_code(
            PYTHON_EJECUCION_ERROR,
            lambda: runtime.execute({"divisor": 0}),
        )
        self.assertEqual(runtime_error.element_id, "fb-cero")

        bad_output = PythonExecutor(
            "fb-tipo",
            "1",
            [],
            ["salida"],
            output_types={"salida": "boolean"},
        )
        output_error = self.assert_code("VALOR_TIPO_INVALIDO", lambda: bad_output.execute({}))
        self.assertEqual(output_error.element_id, "fb-tipo")

    def test_rejects_unknown_input_and_output_names(self):
        executor = PythonExecutor("fb", "x", ["x"], ["salida"])
        self.assert_code("VALOR_TIPO_INVALIDO", lambda: executor.execute({"x": 1, "y": 2}))

        unknown_output = PythonExecutor(
            "fb-out",
            """def calcular(x):
    return {'otra': x}
""",
            ["x"],
            ["salida"],
        )
        self.assert_code(PYTHON_SALIDA_INVALIDA, lambda: unknown_output.execute({"x": 1}))

    def test_scheduler_keeps_other_tasks_alive_after_python_error(self):
        clock = FakeClock()
        errors = []
        scheduler = Scheduler(clock=clock, error_handler=lambda task, error: errors.append((task.name, error)))
        executor = PythonExecutor("fb", "10 / x", ["x"], ["salida"])

        class FailingFunctionalTask(Task):
            def update(self):
                executor.execute({"x": 0})

        class Heartbeat(Task):
            def __init__(self, owner):
                self.count = 0
                super().__init__(owner, period_ms=1, priority=2, name="heartbeat")

            def update(self):
                self.count += 1

        FailingFunctionalTask(scheduler, period_ms=1, priority=1, name="functional")
        heartbeat = Heartbeat(scheduler)
        for _ in range(3):
            scheduler.run_pending()
            clock.advance_ms(1)

        self.assertEqual(heartbeat.count, 3)
        self.assertEqual(len(errors), 3)
        self.assertTrue(all(item[0] == "functional" for item in errors))

    def test_shared_contract_vectors(self):
        root = Path(__file__).resolve().parents[2] / "docs" / "mqtt" / "vectores_ir_v2" / "python"
        for path in sorted((root / "validos").glob("*.json")):
            vector = json.loads(path.read_text(encoding="utf-8"))
            executor = PythonExecutor(
                vector["element_id"],
                vector["codigo"],
                vector["entradas"],
                vector["salidas"],
                vector.get("tipos_entrada"),
                vector.get("tipos_salida"),
            )
            for case in vector["casos"]:
                self.assertEqual(executor.execute(case["entradas"]), case["salidas"], path.name)

        for path in sorted((root / "invalidos").glob("*.json")):
            vector = json.loads(path.read_text(encoding="utf-8"))
            error = self.assert_code(
                vector["codigo_esperado"],
                lambda vector=vector: PythonExecutor(
                    vector["element_id"],
                    vector["codigo"],
                    vector["entradas"],
                    vector["salidas"],
                ),
            )
            self.assertEqual(error.element_id, vector["element_id"])


if __name__ == "__main__":
    unittest.main()
