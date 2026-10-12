import copy
import unittest

from firmware.pico.hiles.model import (
    IR_ARCO_INVALIDO,
    IR_CONEXION_NO_SOPORTADA,
    IR_ESTRUCTURA_INVALIDA,
    IR_EXPRESION_INVALIDA,
    IR_ID_DUPLICADO,
    IR_LIMITE_EXCEDIDO,
    IR_PUERTO_INVALIDO,
    IR_REFERENCIA_INVALIDA,
    IR_TIPO_DATO_INVALIDO,
    IR_VERSION_NO_SOPORTADA,
    IrError,
    validate_ir_v1,
    validate_load_message,
)
from firmware.tests.hiles_vectors import arc, data, load_vectors, place, service, transition


def modelo(elementos, conexiones=()):
    return {"elementos": list(elementos), "conexiones": list(conexiones)}


class SharedVectorTests(unittest.TestCase):
    def test_accepts_all_valid_vectors(self):
        vectores = load_vectors("validos")
        self.assertGreaterEqual(len(vectores), 3)
        for nombre, vector in vectores:
            with self.subTest(vector=nombre):
                validado = validate_ir_v1(vector)
                self.assertEqual(len(validado["elementos"]), len(vector["elementos"]))

    def test_rejects_invalid_vectors_with_expected_code(self):
        vectores = load_vectors("invalidos")
        self.assertGreaterEqual(len(vectores), 8)
        for nombre, vector in vectores:
            with self.subTest(vector=nombre):
                with self.assertRaises(IrError) as contexto:
                    validate_ir_v1(vector["modelo"])
                self.assertEqual(contexto.exception.codigo, vector["codigo_esperado"])
                self.assertTrue(contexto.exception.mensaje)


class AdditionalValidationTests(unittest.TestCase):
    def assert_code(self, modelo_ir, codigo):
        with self.assertRaises(IrError) as contexto:
            validate_ir_v1(modelo_ir)
        self.assertEqual(contexto.exception.codigo, codigo)

    def test_root_structure_and_limits(self):
        self.assert_code(None, IR_ESTRUCTURA_INVALIDA)
        self.assert_code({"elementos": []}, IR_ESTRUCTURA_INVALIDA)
        self.assert_code(modelo([place("p{}".format(i), 0) for i in range(65)]), IR_LIMITE_EXCEDIDO)
        validate_ir_v1(modelo([place("p{}".format(i), 0) for i in range(64)]))

    def test_expression_depth_limit(self):
        expresion = {"var": "x"}
        for _ in range(16):
            expresion = {"op": "not", "args": [expresion]}
        bloque = {
            "id": "fb",
            "tipo": "functional_block",
            "nombre": "Profundo",
            "habilitado": True,
            "entradas": [{"puerto": "in", "variable": "x"}],
            "salidas": ["out"],
            "expresion": expresion,
        }
        self.assert_code(modelo([bloque]), IR_LIMITE_EXCEDIDO)

    def test_missing_expression_key_is_not_null(self):
        bloque = {
            "id": "fb",
            "tipo": "functional_block",
            "nombre": "Sin expresión",
            "habilitado": True,
            "entradas": [],
            "salidas": ["out"],
        }
        self.assert_code(modelo([bloque]), IR_EXPRESION_INVALIDA)
        bloque["expresion"] = None
        validate_ir_v1(modelo([bloque]))

    def test_element_field_rules(self):
        self.assert_code(modelo([place("p", 2, 1)]), IR_ESTRUCTURA_INVALIDA)
        self.assert_code(modelo([place("p", -1, 1)]), IR_ESTRUCTURA_INVALIDA)
        self.assert_code(modelo([service("s", "integer", valor_inicial=1.5)]), IR_TIPO_DATO_INVALIDO)
        self.assert_code(modelo([service("s", "boolean", valor_inicial=None)]), IR_TIPO_DATO_INVALIDO)
        validate_ir_v1(modelo([service("s", "integer", valor_inicial=3)]))

        sin_puerto = transition("t")
        del sin_puerto["puerto_accion"]
        self.assert_code(modelo([sin_puerto]), IR_ESTRUCTURA_INVALIDA)

    def test_connection_rules(self):
        base = [service("s"), place("p", 1), transition("t")]
        self.assert_code(
            modelo(base, [data("c", "s", "s-out", "p", "p-in")]),
            IR_PUERTO_INVALIDO,
        )
        self.assert_code(
            modelo(base, [{"id": "c", "tipo": "otro", "origen": "s", "destino": "t"}]),
            IR_CONEXION_NO_SOPORTADA,
        )
        self.assert_code(modelo(base, [data("c", "s", "s-out", "fantasma")]), IR_REFERENCIA_INVALIDA)
        self.assert_code(modelo(base, [arc("a", "p", "t", peso=0)]), IR_ARCO_INVALIDO)
        self.assert_code(modelo(base, [arc("a", "p", "t", peso=1.5)]), IR_ARCO_INVALIDO)
        self.assert_code(modelo(base, [arc("t", "p", "t")]), IR_ID_DUPLICADO)
        self.assert_code(modelo(base, [arc("a", "p", "t"), arc("a", "t", "p")]), IR_ID_DUPLICADO)

    def test_validation_does_not_mutate_input(self):
        vector = load_vectors("validos")[1][1]
        original = copy.deepcopy(vector)
        validate_ir_v1(vector)
        self.assertEqual(vector, original)


class LoadMessageTests(unittest.TestCase):
    def mensaje(self, **cambios):
        base = {
            "modelo_id": "m-1",
            "version": 1,
            "ir_version": 1,
            "modelo": modelo([]),
            "id_mensaje": "carga-1",
        }
        base.update(cambios)
        return base

    def test_valid_message_returns_identity_and_model(self):
        modelo_id, version, validado = validate_load_message(self.mensaje(version=3))
        self.assertEqual((modelo_id, version), ("m-1", 3))
        self.assertEqual(validado, {"elementos": [], "conexiones": []})

    def test_envelope_errors(self):
        casos = [
            (self.mensaje(ir_version=2), IR_VERSION_NO_SOPORTADA),
            (self.mensaje(ir_version=True), IR_VERSION_NO_SOPORTADA),
            (self.mensaje(version=0), IR_ESTRUCTURA_INVALIDA),
            (self.mensaje(version=True), IR_ESTRUCTURA_INVALIDA),
            (self.mensaje(modelo_id=""), IR_ESTRUCTURA_INVALIDA),
            (self.mensaje(id_mensaje=None), IR_ESTRUCTURA_INVALIDA),
            (self.mensaje(modelo="no-es-objeto"), IR_ESTRUCTURA_INVALIDA),
        ]
        for mensaje, codigo in casos:
            with self.subTest(codigo=codigo, mensaje=mensaje):
                with self.assertRaises(IrError) as contexto:
                    validate_load_message(mensaje)
                self.assertEqual(contexto.exception.codigo, codigo)


if __name__ == "__main__":
    unittest.main()
