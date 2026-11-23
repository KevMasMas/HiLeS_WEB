"""Validación acotada de valores que cruzan Functional Blocks remotos.

El módulo evita depender de CPython para poder copiarse sin cambios a
MicroPython. Los límites son parte del contrato de Persona 1: Persona 2 debe
reflejarlos en TypeScript y Persona 3 debe consumir estas funciones, no crear
otro validador incompatible.
"""

try:
    import ujson as json
except ImportError:  # pragma: no cover - CPython usa json durante las pruebas
    import json

try:
    import math
except ImportError:  # pragma: no cover - MicroPython normalmente incluye math
    math = None


VALOR_TIPO_INVALIDO = "VALOR_TIPO_INVALIDO"
VALOR_LIMITE_EXCEDIDO = "VALOR_LIMITE_EXCEDIDO"
VALOR_NO_SERIALIZABLE = "VALOR_NO_SERIALIZABLE"

TIPOS_RUNTIME = ("boolean", "integer", "real", "string", "vector", "custom")

MAX_VALUE_DEPTH = 6
MAX_CONTAINER_ITEMS = 64
MAX_VECTOR_LENGTH = 32
MAX_STRING_LENGTH = 256
MAX_SERIALIZED_BYTES = 2048


class RuntimeValueError(ValueError):
    """Valor incompatible con el perfil remoto o con sus límites."""

    def __init__(self, codigo, mensaje, path="valor"):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje
        self.path = path


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_finite(value):
    if not isinstance(value, float):
        return True
    if math is not None and hasattr(math, "isfinite"):
        return math.isfinite(value)
    return value == value and value not in (float("inf"), float("-inf"))


def _encoded_size(value):
    try:
        encoded = json.dumps(value)
    except (TypeError, ValueError, OverflowError) as error:
        raise RuntimeValueError(
            VALOR_NO_SERIALIZABLE,
            "el valor no se puede serializar como JSON: {}".format(error),
        )
    if isinstance(encoded, bytes):
        return len(encoded)
    return len(encoded.encode("utf-8"))


def _validate_shape(value, path, depth, counter):
    if depth > MAX_VALUE_DEPTH:
        raise RuntimeValueError(
            VALOR_LIMITE_EXCEDIDO,
            "{} supera la profundidad máxima {}".format(path, MAX_VALUE_DEPTH),
            path,
        )

    if isinstance(value, bool):
        return
    if _is_number(value):
        if not _is_finite(value):
            raise RuntimeValueError(
                VALOR_NO_SERIALIZABLE,
                "{} debe ser un número finito".format(path),
                path,
            )
        return
    if isinstance(value, str):
        if len(value) > MAX_STRING_LENGTH:
            raise RuntimeValueError(
                VALOR_LIMITE_EXCEDIDO,
                "{} supera {} caracteres".format(path, MAX_STRING_LENGTH),
                path,
            )
        return
    if isinstance(value, list):
        if len(value) > MAX_VECTOR_LENGTH:
            raise RuntimeValueError(
                VALOR_LIMITE_EXCEDIDO,
                "{} supera {} posiciones".format(path, MAX_VECTOR_LENGTH),
                path,
            )
        counter[0] += len(value)
        if counter[0] > MAX_CONTAINER_ITEMS:
            raise RuntimeValueError(
                VALOR_LIMITE_EXCEDIDO,
                "el valor supera {} elementos internos".format(MAX_CONTAINER_ITEMS),
                path,
            )
        for index, item in enumerate(value):
            _validate_shape(item, "{}[{}]".format(path, index), depth + 1, counter)
        return
    if isinstance(value, dict):
        counter[0] += len(value)
        if counter[0] > MAX_CONTAINER_ITEMS:
            raise RuntimeValueError(
                VALOR_LIMITE_EXCEDIDO,
                "el valor supera {} elementos internos".format(MAX_CONTAINER_ITEMS),
                path,
            )
        for key, item in value.items():
            if not isinstance(key, str) or not key or len(key) > MAX_STRING_LENGTH:
                raise RuntimeValueError(
                    VALOR_TIPO_INVALIDO,
                    "{} solo admite claves de texto no vacías".format(path),
                    path,
                )
            _validate_shape(item, "{}.{}".format(path, key), depth + 1, counter)
        return

    raise RuntimeValueError(
        VALOR_TIPO_INVALIDO,
        "{} contiene un tipo no compatible: {}".format(path, type(value).__name__),
        path,
    )


def _matches_type(value, expected_type):
    if expected_type == "boolean":
        return isinstance(value, bool)
    if expected_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected_type == "real":
        return _is_number(value)
    if expected_type == "string":
        return isinstance(value, str)
    if expected_type == "vector":
        return isinstance(value, list)
    if expected_type == "custom":
        return isinstance(value, dict)
    return False


def validate_runtime_value(value, expected_type=None, path="valor"):
    """Valida y retorna ``value`` sin modificarlo.

    ``expected_type`` puede omitirse para validar únicamente que el valor
    pertenezca al subconjunto JSON acotado.
    """

    if expected_type is not None:
        if expected_type not in TIPOS_RUNTIME:
            raise RuntimeValueError(
                VALOR_TIPO_INVALIDO,
                "tipo runtime desconocido: {}".format(expected_type),
                path,
            )
        if not _matches_type(value, expected_type):
            raise RuntimeValueError(
                VALOR_TIPO_INVALIDO,
                "{} debe ser de tipo {}".format(path, expected_type),
                path,
            )

    _validate_shape(value, path, 1, [0])
    size = _encoded_size(value)
    if size > MAX_SERIALIZED_BYTES:
        raise RuntimeValueError(
            VALOR_LIMITE_EXCEDIDO,
            "{} ocupa {} bytes; el máximo es {}".format(path, size, MAX_SERIALIZED_BYTES),
            path,
        )
    return value


def clone_runtime_value(value):
    """Copia un valor validado para que el código de usuario no mute el motor."""

    validate_runtime_value(value)
    try:
        return json.loads(json.dumps(value))
    except (TypeError, ValueError, OverflowError) as error:
        raise RuntimeValueError(
            VALOR_NO_SERIALIZABLE,
            "el valor no se pudo copiar: {}".format(error),
        )


def validate_runtime_mapping(values, declared_types=None, reject_unknown=False, path="entradas"):
    """Valida un diccionario de puertos y retorna una copia JSON segura."""

    if not isinstance(values, dict):
        raise RuntimeValueError(
            VALOR_TIPO_INVALIDO,
            "{} debe ser un diccionario".format(path),
            path,
        )
    declared_types = declared_types or {}
    result = {}
    for name, value in values.items():
        if not isinstance(name, str) or not name:
            raise RuntimeValueError(
                VALOR_TIPO_INVALIDO,
                "{} contiene un nombre de puerto inválido".format(path),
                path,
            )
        if reject_unknown and name not in declared_types:
            raise RuntimeValueError(
                VALOR_TIPO_INVALIDO,
                "{} contiene el puerto no declarado {}".format(path, name),
                "{}.{}".format(path, name),
            )
        expected_type = declared_types.get(name)
        validate_runtime_value(value, expected_type, "{}.{}".format(path, name))
        result[name] = clone_runtime_value(value)
    validate_runtime_value(result, "custom", path)
    return result
