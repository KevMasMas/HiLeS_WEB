import unittest

from firmware.pico.hiles.runtime_values import (
    MAX_STRING_LENGTH,
    MAX_VALUE_DEPTH,
    MAX_VECTOR_LENGTH,
    VALOR_LIMITE_EXCEDIDO,
    VALOR_NO_SERIALIZABLE,
    VALOR_TIPO_INVALIDO,
    RuntimeValueError,
    clone_runtime_value,
    validate_runtime_mapping,
    validate_runtime_value,
)


class RuntimeValueTests(unittest.TestCase):
    def assert_code(self, code, callback):
        with self.assertRaises(RuntimeValueError) as captured:
            callback()
        self.assertEqual(captured.exception.codigo, code)

    def test_accepts_all_declared_runtime_types(self):
        cases = [
            (True, "boolean"),
            (3, "integer"),
            (3.5, "real"),
            ("verde", "string"),
            ([1, 2, 3], "vector"),
            ({"color": "verde", "activo": True}, "custom"),
        ]
        for value, expected_type in cases:
            with self.subTest(expected_type=expected_type):
                self.assertIs(validate_runtime_value(value, expected_type), value)

    def test_boolean_is_not_an_integer_or_real(self):
        self.assert_code(VALOR_TIPO_INVALIDO, lambda: validate_runtime_value(True, "integer"))
        self.assert_code(VALOR_TIPO_INVALIDO, lambda: validate_runtime_value(True, "real"))

    def test_rejects_non_finite_and_non_json_values(self):
        self.assert_code(VALOR_NO_SERIALIZABLE, lambda: validate_runtime_value(float("inf"), "real"))
        self.assert_code(VALOR_TIPO_INVALIDO, lambda: validate_runtime_value({"x": object()}))

    def test_enforces_string_vector_and_depth_limits(self):
        self.assert_code(
            VALOR_LIMITE_EXCEDIDO,
            lambda: validate_runtime_value("x" * (MAX_STRING_LENGTH + 1), "string"),
        )
        self.assert_code(
            VALOR_LIMITE_EXCEDIDO,
            lambda: validate_runtime_value([0] * (MAX_VECTOR_LENGTH + 1), "vector"),
        )
        value = 1
        for _ in range(MAX_VALUE_DEPTH):
            value = [value]
        self.assert_code(VALOR_LIMITE_EXCEDIDO, lambda: validate_runtime_value(value))

    def test_mapping_validates_types_unknown_ports_and_returns_copy(self):
        original = {"vector": [1, 2]}
        copied = validate_runtime_mapping(original, {"vector": "vector"}, reject_unknown=True)
        copied["vector"].append(3)
        self.assertEqual(original, {"vector": [1, 2]})
        self.assert_code(
            VALOR_TIPO_INVALIDO,
            lambda: validate_runtime_mapping({"otro": 1}, {"vector": "vector"}, reject_unknown=True),
        )

    def test_clone_prevents_shared_mutation(self):
        original = {"a": [1, {"b": True}]}
        cloned = clone_runtime_value(original)
        cloned["a"][1]["b"] = False
        self.assertTrue(original["a"][1]["b"])


if __name__ == "__main__":
    unittest.main()
