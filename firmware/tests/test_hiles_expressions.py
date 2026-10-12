import unittest

from firmware.pico.hiles.expressions import evaluar, profundidad, validar_expresion


def binaria(op, izquierda, derecha):
    return {"op": op, "args": [izquierda, derecha]}


def lit(valor):
    return {"lit": valor}


VAR_X = {"var": "x"}


class ExpressionGrammarTests(unittest.TestCase):
    def test_accepts_literals_variables_and_operators(self):
        variables = set()
        expresion = binaria("and", binaria(">=", VAR_X, lit(6)), {"op": "not", "args": [{"var": "y"}]})
        self.assertTrue(validar_expresion(expresion, variables))
        self.assertEqual(variables, {"x", "y"})

    def test_rejects_unknown_operator_and_malformed_nodes(self):
        invalidas = [
            binaria("eval", VAR_X, lit(1)),
            {"op": "not", "args": [VAR_X, VAR_X]},
            {"op": "+", "args": [VAR_X]},
            {"lit": None},
            {"lit": float("inf")},
            {"var": ""},
            {"lit": 1, "var": "x"},
            [VAR_X],
        ]
        for expresion in invalidas:
            self.assertFalse(validar_expresion(expresion, set()), expresion)

    def test_depth_counts_leaves_as_one(self):
        self.assertEqual(profundidad(lit(1)), 1)
        self.assertEqual(profundidad(binaria("+", lit(1), binaria("*", VAR_X, lit(2)))), 3)


class ExpressionEvaluationTests(unittest.TestCase):
    def test_absent_variable_semantics(self):
        self.assertIsNone(evaluar(VAR_X, {}))
        self.assertFalse(evaluar(binaria("==", VAR_X, lit(0)), {}))
        self.assertTrue(evaluar(binaria("!=", VAR_X, lit(0)), {}))
        self.assertFalse(evaluar(binaria("<", VAR_X, lit(0)), {}))
        self.assertIsNone(evaluar(binaria("+", VAR_X, lit(1)), {}))
        self.assertFalse(evaluar({"op": "not", "args": [VAR_X]}, {}))
        self.assertIsNone(evaluar(None, {}))

    def test_equality_requires_same_logical_type(self):
        self.assertFalse(evaluar(binaria("==", lit(True), lit(1)), {}))
        self.assertFalse(evaluar(binaria("==", lit("1"), lit(1)), {}))
        self.assertTrue(evaluar(binaria("==", lit(1), lit(1.0)), {}))
        self.assertTrue(evaluar(binaria("!=", lit(False), lit(0)), {}))

    def test_ordering_only_between_numbers(self):
        self.assertTrue(evaluar(binaria(">=", VAR_X, lit(6)), {"x": 8}))
        self.assertFalse(evaluar(binaria(">=", VAR_X, lit(6)), {"x": 3}))
        self.assertFalse(evaluar(binaria("<", lit("a"), lit("b")), {}))
        self.assertFalse(evaluar(binaria("<", lit(True), lit(2)), {}))

    def test_arithmetic_matches_javascript(self):
        self.assertEqual(evaluar(binaria("/", lit(6), lit(3)), {}), 2)
        self.assertIsInstance(evaluar(binaria("/", lit(6), lit(3)), {}), int)
        self.assertEqual(evaluar(binaria("/", lit(7), lit(2)), {}), 3.5)
        self.assertIsNone(evaluar(binaria("/", lit(1), lit(0)), {}))
        self.assertIsNone(evaluar(binaria("%", lit(1), lit(0)), {}))
        self.assertEqual(evaluar(binaria("%", lit(-7), lit(3)), {}), -1)
        self.assertEqual(evaluar(binaria("%", lit(7), lit(-3)), {}), 1)
        self.assertIsNone(evaluar(binaria("*", lit(True), lit(2)), {}))
        self.assertEqual(evaluar({"op": "-", "args": [VAR_X]}, {"x": 4}), -4)

    def test_logical_operators_treat_non_booleans_as_false(self):
        self.assertTrue(evaluar(binaria("and", lit(True), lit(True)), {}))
        self.assertFalse(evaluar(binaria("and", lit(True), lit(1)), {}))
        self.assertTrue(evaluar(binaria("or", lit(1), lit(True)), {}))
        self.assertFalse(evaluar(binaria("or", lit(1), VAR_X), {}))
        self.assertTrue(evaluar({"op": "not", "args": [lit(False)]}, {}))


if __name__ == "__main__":
    unittest.main()
