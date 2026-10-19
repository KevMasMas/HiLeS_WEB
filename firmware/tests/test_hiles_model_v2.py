import copy
import unittest

from firmware.pico.hiles.model import IrError
from firmware.pico.hiles.model_v2 import (
    IR_CAPACIDAD_INVALIDA,
    IR_CODIGO_NO_SOPORTADO,
    IR_RETARDO_INVALIDO,
    MAX_MODELO_BYTES,
    migrate_v1_to_v2,
    orden_topologico_v2,
    validate_ir_v2,
    validate_load_message_v2,
)
from firmware.tests.hiles_vectors import load_vectors


def load_v2(category):
    return load_vectors("../vectores_ir_v2/" + category)


def modelo(elementos, conexiones=()):
    return {"ir_version": 2, "elementos": list(elementos), "conexiones": list(conexiones)}


def service(element_id, tipo_dato="boolean", **extra):
    definicion = {
        "id": element_id, "tipo": "service", "nombre": element_id,
        "tipo_dato": tipo_dato, "salidas": [element_id + "-out"], "entradas": [],
    }
    definicion.update(extra)
    return definicion


def place(element_id, tokens=0, capacidad=1):
    return {"id": element_id, "tipo": "place", "nombre": element_id, "tokens": tokens, "capacidad": capacidad}


def transition(element_id, **extra):
    definicion = {
        "id": element_id, "tipo": "transition", "nombre": element_id, "habilitada": True,
        "puerto_condicion": "condicion", "puerto_accion": element_id + "-accion",
    }
    definicion.update(extra)
    return definicion


def canal(conn_id, tipo, origen, puerto_origen, destino, puerto_destino, **extra):
    definicion = {
        "id": conn_id, "tipo": tipo, "origen": origen, "puerto_origen": puerto_origen,
        "destino": destino, "puerto_destino": puerto_destino,
    }
    definicion.update(extra)
    return definicion


class SharedV2VectorTests(unittest.TestCase):
    def test_accepts_valid_models(self):
        vectores = load_v2("modelos/validos")
        self.assertGreaterEqual(len(vectores), 3)
        for nombre, vector in vectores:
            with self.subTest(vector=nombre):
                validado = validate_ir_v2(vector)
                self.assertEqual(validado["ir_version"], 2)
                self.assertEqual(len(validado["elementos"]), len(vector["elementos"]))

    def test_rejects_invalid_models_with_web_code(self):
        vectores = load_v2("modelos/invalidos")
        self.assertGreaterEqual(len(vectores), 8)
        for nombre, vector in vectores:
            with self.subTest(vector=nombre):
                with self.assertRaises(IrError) as contexto:
                    validate_ir_v2(vector["modelo"])
                self.assertEqual(contexto.exception.codigo, vector["codigo_esperado"])
                self.assertTrue(contexto.exception.mensaje)

    def test_execution_vector_models_are_valid(self):
        for nombre, vector in load_v2("ejecucion"):
            with self.subTest(vector=nombre):
                validate_ir_v2(vector["modelo"])


class V1CompatibilityTests(unittest.TestCase):
    def test_all_v1_models_migrate_and_validate(self):
        modelos = [vector for _, vector in load_vectors("validos")]
        modelos += [vector["modelo"] for _, vector in load_vectors("ejecucion")]
        for indice, modelo_v1 in enumerate(modelos):
            with self.subTest(indice=indice):
                con_version = dict(modelo_v1)
                con_version["ir_version"] = 1
                validado = validate_ir_v2(con_version)
                self.assertEqual(validado["ir_version"], 2)

    def test_migration_maps_action_ports_to_lch_and_data_to_cch(self):
        _, vector = load_vectors("validos")[1]
        migrado = migrate_v1_to_v2(vector)
        tipos = dict((c["id"], c["tipo"]) for c in migrado["conexiones"])
        self.assertEqual(tipos["sensor-condicion"], "cch")
        self.assertEqual(tipos["espera-transicion"], "arco")
        bloque = [e for e in migrado["elementos"] if e["tipo"] == "functional_block"][0]
        self.assertEqual(bloque["lenguaje"], "expresion")
        self.assertEqual(bloque["salidas"][0]["variable"], "out")
        self.assertEqual(migrado["entradas_externas"][0]["elemento_id"], "sensor")


class AdditionalV2RulesTests(unittest.TestCase):
    def assert_code(self, modelo_ir, codigo):
        with self.assertRaises(IrError) as contexto:
            validate_ir_v2(modelo_ir)
        self.assertEqual(contexto.exception.codigo, codigo)

    def test_root_and_version_rules(self):
        self.assert_code(None, "IR_ESTRUCTURA_INVALIDA")
        self.assert_code({"ir_version": 3, "elementos": [], "conexiones": []}, "IR_VERSION_NO_SOPORTADA")
        self.assert_code({"ir_version": 2, "elementos": []}, "IR_ESTRUCTURA_INVALIDA")
        self.assert_code({"ir_version": 2, "version": 0, "elementos": [], "conexiones": []}, "IR_ESTRUCTURA_INVALIDA")
        self.assert_code(modelo([place("p{}".format(i)) for i in range(65)]), "IR_LIMITE_EXCEDIDO")

    def test_place_capacity_rules(self):
        validado = validate_ir_v2(modelo([place("p", tokens=5, capacidad=None)]))
        self.assertIsNone(validado["elementos"][0]["capacidad"])
        self.assert_code(modelo([place("p", tokens=2, capacidad=1)]), IR_CAPACIDAD_INVALIDA)
        sin_capacidad = place("p")
        del sin_capacidad["capacidad"]
        self.assert_code(modelo([sin_capacidad]), IR_CAPACIDAD_INVALIDA)

    def test_language_delay_and_channel_rules(self):
        bloque = {
            "id": "fb", "tipo": "functional_block", "nombre": "fb", "lenguaje": "javascript",
            "entradas": [], "salidas": [{"puerto": "out", "variable": "y", "tipo_dato": "real"}],
        }
        self.assert_code(modelo([bloque]), IR_CODIGO_NO_SOPORTADO)
        self.assert_code(modelo([service("s", retardo_ms=-1)]), IR_RETARDO_INVALIDO)
        self.assert_code(modelo([service("s", retardo_ms=600001)]), IR_RETARDO_INVALIDO)

        base = [service("s"), transition("t"), place("p", 1)]
        self.assert_code(
            modelo(base, [canal("c", "cch", "s", "s-out", "t", "condicion", retardo_ms=1.5)]),
            IR_RETARDO_INVALIDO,
        )
        self.assert_code(
            modelo(base, [canal("c", "dch", "s", "s-out", "t", "condicion", capacidad_cola=0)]),
            IR_CAPACIDAD_INVALIDA,
        )
        self.assert_code(
            modelo(base, [canal("c", "otro", "s", "s-out", "t", "condicion")]),
            "IR_CONEXION_NO_SOPORTADA",
        )
        self.assert_code(modelo(base, [canal("p", "cch", "s", "s-out", "t", "condicion")]), "IR_ID_DUPLICADO")
        self.assert_code(modelo(base, [canal("c", "cch", "s", "s-out", "p", "x")]), "IR_PUERTO_INVALIDO")
        # ``dato`` de la IR v1 se acepta como CCH.
        validado = validate_ir_v2(modelo(base, [canal("c", "dato", "s", "s-out", "t", "condicion")]))
        self.assertEqual(validado["conexiones"][0]["tipo"], "cch")

    def test_delayed_feedback_is_not_an_algebraic_cycle(self):
        def bloque(element_id):
            return {
                "id": element_id, "tipo": "functional_block", "nombre": element_id, "lenguaje": "expresion",
                "entradas": [{"puerto": element_id + "-in", "variable": "x", "tipo_dato": "real"}],
                "salidas": [{"puerto": element_id + "-out", "variable": "y", "tipo_dato": "real"}],
                "expresion": {"var": "x"},
            }

        conexiones = [
            canal("ab", "cch", "a", "a-out", "b", "b-in"),
            canal("ba", "cch", "b", "b-out", "a", "a-in", retardo_ms=10),
        ]
        validate_ir_v2(modelo([bloque("a"), bloque("b")], conexiones))
        conexiones[1] = canal("ba", "cch", "b", "b-out", "a", "a-in")
        self.assert_code(modelo([bloque("a"), bloque("b")], conexiones), "IR_CICLO_DATOS")

    def test_external_inputs_must_reference_services(self):
        base = modelo([service("s"), place("p")])
        base["entradas_externas"] = [{"elemento_id": "p", "puerto_salida": "x", "tipo_dato": "boolean"}]
        self.assert_code(base, "IR_REFERENCIA_INVALIDA")
        base["entradas_externas"] = [{"elemento_id": "s", "puerto_salida": "x", "tipo_dato": "boolean"}]
        self.assert_code(base, "IR_PUERTO_INVALIDO")

    def test_model_size_budget(self):
        grande = service("s", "string", valor_inicial="x" * 200)
        elementos = [dict(grande, id="s{}".format(i), salidas=["o{}".format(i)]) for i in range(64)]
        for elemento in elementos:
            elemento["nombre"] = "n" * 300
        self.assert_code(modelo(elementos), "IR_LIMITE_EXCEDIDO")
        self.assertEqual(MAX_MODELO_BYTES, 31744)

    def test_validation_does_not_mutate_input(self):
        _, vector = load_v2("modelos/validos")[1]
        original = copy.deepcopy(vector)
        validate_ir_v2(vector)
        self.assertEqual(vector, original)

    def test_topological_order_ignores_lch_and_delayed_edges(self):
        elementos = [{"id": i} for i in ("a", "b", "c")]
        conexiones = [
            {"tipo": "lch", "origen": "c", "destino": "a"},
            {"tipo": "cch", "origen": "c", "destino": "b", "retardo_ms": 5},
            {"tipo": "dch", "origen": "b", "destino": "a"},
        ]
        self.assertEqual(orden_topologico_v2(elementos, conexiones), ["b", "c", "a"])


class LoadMessageV2Tests(unittest.TestCase):
    def mensaje(self, **cambios):
        _, vector = load_v2("ejecucion")[0]
        base = {
            "modelo_id": "m", "version": 1, "ir_version": 2,
            "modelo": vector["modelo"], "id_mensaje": "c-1",
        }
        base.update(cambios)
        return base

    def test_accepts_v1_and_v2_envelopes(self):
        modelo_id, version, ir_version, validado = validate_load_message_v2(self.mensaje())
        self.assertEqual((modelo_id, version, ir_version), ("m", 1, 2))
        self.assertEqual(validado["ir_version"], 2)

        _, vector_v1 = load_vectors("validos")[1]
        _, _, ir_version, validado = validate_load_message_v2(self.mensaje(ir_version=1, modelo=vector_v1))
        self.assertEqual(ir_version, 1)
        self.assertNotIn("ir_version", validado)

    def test_envelope_errors(self):
        casos = [
            (self.mensaje(ir_version=3), "IR_VERSION_NO_SOPORTADA"),
            (self.mensaje(ir_version=True), "IR_VERSION_NO_SOPORTADA"),
            (self.mensaje(version=0), "IR_ESTRUCTURA_INVALIDA"),
            (self.mensaje(id_mensaje=""), "IR_ESTRUCTURA_INVALIDA"),
            (self.mensaje(modelo=[]), "IR_ESTRUCTURA_INVALIDA"),
        ]
        for mensaje, codigo in casos:
            with self.subTest(codigo=codigo):
                with self.assertRaises(IrError) as contexto:
                    validate_load_message_v2(mensaje)
                self.assertEqual(contexto.exception.codigo, codigo)


if __name__ == "__main__":
    unittest.main()
