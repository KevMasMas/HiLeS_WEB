"""Validación y evaluación del AST de expresiones de la IR v1 sin ``eval``.

La semántica replica ``evaluarExpresionIr`` del frontend
(``frontend/src/services/ir/expresiones.ts``). ``None`` representa un valor
ausente: una variable que todavía no recibió dato o una operación sin resultado.
"""

OPERADORES_BINARIOS = (
    "==", "!=", "<", "<=", ">", ">=", "+", "-", "*", "/", "%", "and", "or",
)
OPERADORES_UNARIOS = ("not", "-")
MAX_PROFUNDIDAD = 16

# Enteros que un número de JavaScript representa sin pérdida.
_MAX_ENTERO_SEGURO = 9007199254740991


def es_numero(valor):
    """``True`` para ``int`` o ``float`` finito; los booleanos no son números."""

    if isinstance(valor, bool):
        return False
    if isinstance(valor, int):
        return True
    # inf - inf y nan - nan producen nan, que nunca es igual a cero.
    return isinstance(valor, float) and valor - valor == 0


def _es_texto_no_vacio(valor):
    return isinstance(valor, str) and len(valor) > 0


def validar_expresion(expresion, variables):
    """Comprueba la gramática del AST y agrega a ``variables`` las usadas."""

    if not isinstance(expresion, dict):
        return False
    claves = len(expresion)
    if claves == 1 and "lit" in expresion:
        literal = expresion["lit"]
        return isinstance(literal, (bool, str)) or es_numero(literal)
    if claves == 1 and "var" in expresion:
        if not _es_texto_no_vacio(expresion["var"]):
            return False
        variables.add(expresion["var"])
        return True
    if claves == 2 and "op" in expresion and "args" in expresion:
        operador = expresion["op"]
        argumentos = expresion["args"]
        if not isinstance(operador, str) or not isinstance(argumentos, list):
            return False
        if len(argumentos) == 1 and operador in OPERADORES_UNARIOS:
            return validar_expresion(argumentos[0], variables)
        if len(argumentos) == 2 and operador in OPERADORES_BINARIOS:
            return validar_expresion(argumentos[0], variables) and validar_expresion(
                argumentos[1], variables
            )
    return False


def profundidad(expresion):
    """Profundidad del árbol: un literal o una variable valen 1."""

    if "op" not in expresion:
        return 1
    return 1 + max(profundidad(argumento) for argumento in expresion["args"])


def _tipo_logico(valor):
    if isinstance(valor, bool):
        return "boolean"
    if isinstance(valor, str):
        return "string"
    return "number"


def _iguales(izquierdo, derecho):
    return (
        izquierdo is not None
        and derecho is not None
        and _tipo_logico(izquierdo) == _tipo_logico(derecho)
        and izquierdo == derecho
    )


def _normalizar_numero(valor):
    """Representa como ``int`` los resultados enteros, como lo hace JSON en la web."""

    if isinstance(valor, float) and valor - valor == 0 and valor == int(valor):
        if -_MAX_ENTERO_SEGURO <= valor <= _MAX_ENTERO_SEGURO:
            return int(valor)
    return valor


def _residuo(izquierdo, derecho):
    # El operador % de JavaScript conserva el signo del dividendo.
    resultado = abs(izquierdo) % abs(derecho)
    return -resultado if izquierdo < 0 else resultado


def evaluar(expresion, variables):
    """Evalúa un AST ya validado con el diccionario ``variables``."""

    if expresion is None:
        return None
    if "lit" in expresion:
        return expresion["lit"]
    if "var" in expresion:
        return variables.get(expresion["var"])

    operador = expresion["op"]
    argumentos = expresion["args"]

    if len(argumentos) == 1:
        valor = evaluar(argumentos[0], variables)
        if operador == "not":
            return (not valor) if isinstance(valor, bool) else False
        return _normalizar_numero(-valor) if es_numero(valor) else None

    izquierdo = evaluar(argumentos[0], variables)
    derecho = evaluar(argumentos[1], variables)

    if operador == "and":
        if isinstance(izquierdo, bool) and isinstance(derecho, bool):
            return izquierdo and derecho
        return False
    if operador == "or":
        return (izquierdo is True) or (derecho is True)
    if operador == "==":
        return _iguales(izquierdo, derecho)
    if operador == "!=":
        return not _iguales(izquierdo, derecho)

    if operador in ("<", "<=", ">", ">="):
        if not es_numero(izquierdo) or not es_numero(derecho):
            return False
        if operador == "<":
            return izquierdo < derecho
        if operador == "<=":
            return izquierdo <= derecho
        if operador == ">":
            return izquierdo > derecho
        return izquierdo >= derecho

    if not es_numero(izquierdo) or not es_numero(derecho):
        return None
    if operador == "+":
        return _normalizar_numero(izquierdo + derecho)
    if operador == "-":
        return _normalizar_numero(izquierdo - derecho)
    if operador == "*":
        return _normalizar_numero(izquierdo * derecho)
    if derecho == 0:
        return None
    if operador == "/":
        return _normalizar_numero(izquierdo / derecho)
    return _normalizar_numero(_residuo(izquierdo, derecho))
