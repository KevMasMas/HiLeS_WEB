import json
import unittest
from pathlib import Path

from firmware.pico.hiles import HilesEngine, InputError, validate_ir_v1
from firmware.tests.hiles_vectors import arc, data, load_vectors, place, service, transition

HILES_DIRECTORY = Path(__file__).resolve().parents[1] / "pico" / "hiles"


def engine_for(elementos, conexiones=()):
    return HilesEngine(validate_ir_v1({"elementos": list(elementos), "conexiones": list(conexiones)}))


def guarded_net(lugares, arcos, guardas=("t",)):
    """Red con un Service booleano ``orden`` conectado a la guarda de cada Transition."""

    elementos = [service("orden")] + list(lugares) + [transition(t) for t in guardas]
    conexiones = [data("g-" + t, "orden", "orden-out", t) for t in guardas] + list(arcos)
    return engine_for(elementos, conexiones)


class ExecutionVectorTests(unittest.TestCase):
    def test_reproduces_web_engine_vectors_step_by_step(self):
        vectores = load_vectors("ejecucion")
        self.assertGreaterEqual(len(vectores), 3)
        for nombre, vector in vectores:
            motor = HilesEngine(validate_ir_v1(vector["modelo"]))
            self.assertEqual(motor.snapshot(), vector["estado_inicial"], nombre)
            for indice, paso in enumerate(vector["pasos"], start=1):
                for servicio_id, valor in paso.get("entradas", {}).items():
                    motor.set_input(servicio_id, valor)
                motor.step()
                self.assertEqual(
                    motor.snapshot(),
                    paso["elementos_esperados"],
                    "{} paso {}".format(nombre, indice),
                )

    def test_reset_returns_vector_to_initial_snapshot(self):
        for nombre, vector in load_vectors("ejecucion"):
            motor = HilesEngine(validate_ir_v1(vector["modelo"]))
            for paso in vector["pasos"]:
                for servicio_id, valor in paso.get("entradas", {}).items():
                    motor.set_input(servicio_id, valor)
                motor.step()
            motor.reset()
            self.assertEqual(motor.snapshot(), vector["estado_inicial"], nombre)

    def test_snapshots_are_reproducible_and_json_serializable(self):
        _, vector = load_vectors("ejecucion")[1]

        def run():
            motor = HilesEngine(validate_ir_v1(vector["modelo"]))
            salida = [json.dumps(motor.snapshot(), sort_keys=True)]
            for paso in vector["pasos"]:
                for servicio_id, valor in paso.get("entradas", {}).items():
                    motor.set_input(servicio_id, valor)
                motor.step()
                salida.append(json.dumps(motor.snapshot(), sort_keys=True))
            return salida

        self.assertEqual(run(), run())


class TokenMovementTests(unittest.TestCase):
    def test_output_capacity_blocks_firing_without_partial_moves(self):
        motor = guarded_net(
            [place("a", 1), place("b", 0), place("lleno", 1)],
            [arc("a-t", "a", "t"), arc("t-b", "t", "b"), arc("t-lleno", "t", "lleno")],
        )
        motor.set_input("orden", True)
        resumen = motor.step()
        self.assertEqual(resumen["disparada"], None)
        self.assertEqual(
            {k: motor.snapshot()[k]["tokens"] for k in ("a", "b", "lleno")},
            {"a": 1, "b": 0, "lleno": 1},
        )

    def test_weights_are_summed_and_respected(self):
        motor = guarded_net(
            [place("origen", 3, 3), place("destino", 0, 4)],
            [arc("a1", "origen", "t"), arc("a2", "origen", "t"), arc("s", "t", "destino", peso=2)],
        )
        motor.set_input("orden", True)
        self.assertEqual(motor.step()["disparada"], "t")
        self.assertEqual(motor.element("origen").tokens, 1)
        self.assertEqual(motor.element("destino").tokens, 2)

        # Quedan 1 token y se requieren 2: la transición no dispara.
        self.assertIsNone(motor.step()["disparada"])
        self.assertEqual(motor.element("origen").tokens, 1)
        self.assertEqual(motor.element("destino").tokens, 2)

    def test_place_as_input_and_output_uses_net_balance(self):
        motor = guarded_net(
            [place("ciclo", 1, 1), place("contador", 0, 5)],
            [arc("in", "ciclo", "t"), arc("out", "t", "ciclo"), arc("c", "t", "contador")],
        )
        motor.set_input("orden", True)
        for esperado in range(1, 4):
            motor.step()
            self.assertEqual(motor.element("ciclo").tokens, 1)
            self.assertEqual(motor.element("contador").tokens, esperado)

    def test_transition_requires_input_and_output_arcs(self):
        motor = guarded_net([place("p", 1)], [arc("a", "p", "t")])
        motor.set_input("orden", True)
        self.assertIsNone(motor.step()["disparada"])
        self.assertEqual(motor.element("p").tokens, 1)

    def test_conflict_keeps_all_tokens(self):
        motor = guarded_net(
            [place("o", 1), place("a", 0), place("b", 0)],
            [arc("1", "o", "t1"), arc("2", "t1", "a"), arc("3", "o", "t2"), arc("4", "t2", "b")],
            guardas=("t1", "t2"),
        )
        motor.set_input("orden", True)
        resumen = motor.step()
        self.assertTrue(resumen["conflicto"])
        self.assertEqual(resumen["habilitadas"], ["t1", "t2"])
        self.assertEqual([motor.element(p).tokens for p in ("o", "a", "b")], [1, 0, 0])

    def test_disabled_transition_never_fires(self):
        elementos = [service("orden"), place("a", 1), place("b", 0), transition("t", habilitada=False)]
        conexiones = [data("g", "orden", "orden-out", "t"), arc("x", "a", "t"), arc("y", "t", "b")]
        motor = engine_for(elementos, conexiones)
        motor.set_input("orden", True)
        motor.step()
        self.assertEqual(motor.snapshot()["t"], {"habilitada": False, "disparada": False})
        self.assertEqual(motor.element("a").tokens, 1)


class PropagationTests(unittest.TestCase):
    def test_action_port_is_emitted_on_the_following_step(self):
        elementos = [
            service("orden"),
            place("a", 1),
            place("b", 0),
            transition("t", puerto_accion="t-accion"),
            service("aviso", entradas=["aviso-in"]),
        ]
        conexiones = [
            data("g", "orden", "orden-out", "t"),
            data("accion", "t", "t-accion", "aviso", "aviso-in"),
            arc("x", "a", "t"),
            arc("y", "t", "b"),
        ]
        motor = engine_for(elementos, conexiones)
        motor.set_input("orden", True)
        motor.step()
        self.assertEqual(motor.snapshot()["aviso"], {})
        motor.step()
        self.assertEqual(motor.snapshot()["aviso"], {"valor": True})

    def test_initial_value_and_disabled_block(self):
        bloque = {
            "id": "fb",
            "tipo": "functional_block",
            "nombre": "Doble",
            "habilitado": False,
            "entradas": [{"puerto": "fb-in", "variable": "x"}],
            "salidas": ["fb-out"],
            "expresion": {"op": "*", "args": [{"var": "x"}, {"lit": 2}]},
        }
        elementos = [service("n", "integer", valor_inicial=4), bloque]
        motor = engine_for(elementos, [data("c", "n", "n-out", "fb", "fb-in")])
        self.assertEqual(motor.snapshot()["n"], {"valor": 4})
        motor.step()
        self.assertEqual(motor.snapshot()["fb"], {})

        bloque["habilitado"] = True
        motor = engine_for(elementos, [data("c", "n", "n-out", "fb", "fb-in")])
        motor.step()
        self.assertEqual(motor.snapshot()["fb"], {"salida": 8})
        motor.reset()
        self.assertEqual(motor.snapshot(), {"n": {"valor": 4}, "fb": {}})

    def test_topological_order_does_not_depend_on_declaration_order(self):
        bloque = {
            "id": "fb",
            "tipo": "functional_block",
            "nombre": "Mayor",
            "habilitado": True,
            "entradas": [{"puerto": "fb-in", "variable": "x"}],
            "salidas": ["fb-out"],
            "expresion": {"op": ">", "args": [{"var": "x"}, {"lit": 1}]},
        }
        # El consumidor se declara antes que el productor.
        elementos = [transition("t"), bloque, place("a", 1), place("b", 0), service("x", "real")]
        conexiones = [
            data("c1", "x", "x-out", "fb", "fb-in"),
            data("c2", "fb", "fb-out", "t"),
            arc("a1", "a", "t"),
            arc("a2", "t", "b"),
        ]
        motor = engine_for(elementos, conexiones)
        motor.set_input("x", 5)
        self.assertEqual(motor.step()["disparada"], "t")
        self.assertEqual(motor.element("b").tokens, 1)

    def test_rejected_inputs_do_not_change_state(self):
        motor = engine_for([service("s", "integer"), place("p", 0)])
        casos = [("fantasma", 1), ("p", 1), ("s", True), ("s", 1.5), ("s", "1"), ("", 1)]
        for servicio_id, valor in casos:
            with self.subTest(servicio_id=servicio_id, valor=valor):
                with self.assertRaises(InputError):
                    motor.set_input(servicio_id, valor)
        self.assertEqual(motor.snapshot(), {"s": {}, "p": {"tokens": 0}})
        motor.set_input("s", 2.0)
        self.assertEqual(motor.snapshot()["s"], {"valor": 2.0})


class GeneralityTests(unittest.TestCase):
    def test_renamed_model_behaves_identically(self):
        """El motor no depende de los identificadores del ejemplo del semáforo."""

        _, vector = load_vectors("ejecucion")[1]
        texto = json.dumps(vector).replace("sem1-", "zz-")
        renombrado = json.loads(texto)
        motor = HilesEngine(validate_ir_v1(renombrado["modelo"]))
        for paso in renombrado["pasos"]:
            for servicio_id, valor in paso.get("entradas", {}).items():
                motor.set_input(servicio_id, valor)
            motor.step()
            self.assertEqual(motor.snapshot(), paso["elementos_esperados"])

    def test_engine_sources_contain_no_traffic_light_rules(self):
        prohibidas = ("semaforo", "semáforo", "sem1", "verde", "amarillo", "rojo", "norte", "sur")
        for path in sorted(HILES_DIRECTORY.glob("*.py")):
            contenido = path.read_text(encoding="utf-8").lower()
            for palabra in prohibidas:
                self.assertNotIn(palabra, contenido, "{} contiene «{}»".format(path.name, palabra))


if __name__ == "__main__":
    unittest.main()
