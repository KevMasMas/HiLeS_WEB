"""Ejecutor acotado de código Python para Functional Blocks en MicroPython.

No es un sandbox para código hostil. Es un perfil pedagógico que elimina las
construcciones capaces de bloquear de forma evidente el scheduler cooperativo
y ejecuta con un conjunto mínimo de builtins. El contrato público está en
``docs/mqtt/IR_V2_PYTHON.md``.
"""

try:
    import time
except ImportError:  # pragma: no cover
    time = None

from .runtime_values import RuntimeValueError, validate_runtime_mapping


PYTHON_CODIGO_INVALIDO = "PYTHON_CODIGO_INVALIDO"
PYTHON_PERFIL_PROHIBIDO = "PYTHON_PERFIL_PROHIBIDO"
PYTHON_COMPILACION_ERROR = "PYTHON_COMPILACION_ERROR"
PYTHON_EJECUCION_ERROR = "PYTHON_EJECUCION_ERROR"
PYTHON_SALIDA_INVALIDA = "PYTHON_SALIDA_INVALIDA"
PYTHON_TIEMPO_EXCEDIDO = "PYTHON_TIEMPO_EXCEDIDO"

MAX_CODE_BYTES = 2048
MAX_CODE_LINES = 40
MAX_INPUTS = 16
MAX_OUTPUTS = 16
DEFAULT_MAX_EXECUTION_US = 20000

SAFE_BUILTINS = {
    "abs": abs,
    "bool": bool,
    "float": float,
    "int": int,
    "len": len,
    "max": max,
    "min": min,
    "round": round,
    "str": str,
    "sum": sum,
}

FORBIDDEN_WORDS = (
    "import", "from", "while", "for", "class", "lambda", "try", "except",
    "finally", "with", "async", "await", "yield", "global", "nonlocal",
    "del", "raise", "eval", "exec", "open", "compile", "globals", "locals",
    "vars", "dir", "getattr", "setattr", "delattr", "input", "help",
    "breakpoint", "memoryview", "super", "type", "object", "__import__",
)

LANGUAGE_WORDS = (
    "def", "return", "if", "elif", "else", "and", "or", "not", "in", "is",
    "True", "False", "None", "pass",
)


class PythonExecutorError(Exception):
    """Error estable que Persona 3 puede publicar sin interpretar el texto."""

    def __init__(self, codigo, mensaje, element_id=None):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje
        self.element_id = element_id


def _is_identifier(value):
    if not isinstance(value, str) or not value:
        return False
    first = value[0]
    if not (first == "_" or "a" <= first <= "z" or "A" <= first <= "Z"):
        return False
    for char in value[1:]:
        if not (char == "_" or char.isdigit() or "a" <= char <= "z" or "A" <= char <= "Z"):
            return False
    return True


def _tokenize(source):
    """Tokenizador pequeño: ignora comentarios y contenido de strings."""

    tokens = []
    index = 0
    length = len(source)
    while index < length:
        char = source[index]
        if char.isspace():
            index += 1
            continue
        if char == "#":
            while index < length and source[index] not in "\r\n":
                index += 1
            continue
        if char in ("'", '"'):
            quote = char
            triple = source[index:index + 3] == quote * 3
            index += 3 if triple else 1
            closed = False
            while index < length:
                if source[index] == "\\":
                    index += 2
                    continue
                if triple and source[index:index + 3] == quote * 3:
                    index += 3
                    closed = True
                    break
                if not triple and source[index] == quote:
                    index += 1
                    closed = True
                    break
                index += 1
            if not closed:
                raise PythonExecutorError(PYTHON_CODIGO_INVALIDO, "string sin cerrar")
            tokens.append("STRING")
            continue
        if char == "_" or char.isalpha():
            start = index
            index += 1
            while index < length and (
                source[index] == "_"
                or source[index].isdigit()
                or "a" <= source[index] <= "z"
                or "A" <= source[index] <= "Z"
            ):
                index += 1
            tokens.append(source[start:index])
            continue
        if char.isdigit():
            index += 1
            while index < length and (source[index].isdigit() or source[index] in ".eExXabcdefABCDEF_+-"):
                # Los signos solo pertenecen al exponente; compile hará la validación final.
                if source[index] in "+-" and source[index - 1] not in "eE":
                    break
                index += 1
            tokens.append("NUMBER")
            continue
        two = source[index:index + 2]
        if two in ("==", "!=", "<=", ">=", "**", "//", "->", ":="):
            tokens.append(two)
            index += 2
        else:
            tokens.append(char)
            index += 1
    return tokens


def _raise_profile(message):
    raise PythonExecutorError(PYTHON_PERFIL_PROHIBIDO, message)


def _validate_tokens(tokens, function_mode):
    def_count = 0
    for index, token in enumerate(tokens):
        if token in FORBIDDEN_WORDS:
            _raise_profile("la construcción «{}» no está permitida".format(token))
        if _is_identifier(token) and (token.startswith("__") or token.endswith("__")):
            _raise_profile("los nombres dunder no están permitidos")
        if token == "def":
            def_count += 1
            if not function_mode or index + 1 >= len(tokens) or tokens[index + 1] != "calcular":
                _raise_profile("solo se permite una función llamada calcular")
        if token == ".":
            previous = tokens[index - 1] if index else None
            following = tokens[index + 1] if index + 1 < len(tokens) else None
            if previous != "inputs" or following != "get":
                _raise_profile("solo se permite el acceso inputs.get(...) como atributo")
        if token in ("f", "F", "fr", "Fr", "fR", "FR", "rf", "rF", "Rf", "RF"):
            if index + 1 < len(tokens) and tokens[index + 1] == "STRING":
                _raise_profile("los f-strings no están permitidos")

    if function_mode and def_count != 1:
        _raise_profile("debe existir exactamente una función calcular")
    if not function_mode and def_count:
        _raise_profile("una expresión no puede declarar funciones")

    allowed_calls = set(SAFE_BUILTINS.keys())
    language_words = set(LANGUAGE_WORDS)
    for index in range(len(tokens) - 1):
        token = tokens[index]
        if not _is_identifier(token) or tokens[index + 1] != "(":
            continue
        previous = tokens[index - 1] if index else None
        if previous == "def":
            continue
        if previous == "." and token == "get":
            continue
        if token == "calcular":
            _raise_profile("la recursión no está permitida")
        if token in language_words:
            continue
        if token not in allowed_calls:
            _raise_profile("la llamada a «{}» no está autorizada".format(token))


def validate_python_source(source):
    """Valida el perfil y retorna ``"function"`` o ``"expression"``."""

    if not isinstance(source, str) or not source.strip():
        raise PythonExecutorError(PYTHON_CODIGO_INVALIDO, "el código debe ser texto no vacío")
    size = len(source.encode("utf-8"))
    if size > MAX_CODE_BYTES:
        raise PythonExecutorError(
            PYTHON_CODIGO_INVALIDO,
            "el código ocupa {} bytes; el máximo es {}".format(size, MAX_CODE_BYTES),
        )
    lines = source.splitlines()
    if len(lines) > MAX_CODE_LINES:
        raise PythonExecutorError(
            PYTHON_CODIGO_INVALIDO,
            "el código tiene {} líneas; el máximo es {}".format(len(lines), MAX_CODE_LINES),
        )
    if any(ord(char) < 32 and char not in "\t\r\n" for char in source):
        raise PythonExecutorError(PYTHON_CODIGO_INVALIDO, "el código contiene caracteres de control")

    meaningful = [line for line in lines if line.strip() and not line.lstrip().startswith("#")]
    if not meaningful:
        raise PythonExecutorError(PYTHON_CODIGO_INVALIDO, "el código debe contener una expresión o función")
    function_mode = meaningful[0].lstrip().startswith("def ")
    if function_mode:
        if not meaningful or not meaningful[0].lstrip().startswith("def calcular("):
            _raise_profile("la única función pública debe llamarse calcular")
        # Todo lo posterior debe pertenecer al cuerpo o a una continuación indentada.
        for line in meaningful[1:]:
            if line and not line[0].isspace():
                _raise_profile("no se permite código de nivel superior fuera de calcular")
    else:
        if len(meaningful) != 1:
            _raise_profile("la forma de expresión debe ocupar una sola línea")

    _validate_tokens(_tokenize(source), function_mode)
    return "function" if function_mode else "expression"


def _ticks_us():
    if time is None:
        return None
    ticks = getattr(time, "ticks_us", None)
    return ticks() if callable(ticks) else None


def _diff_us(end, start):
    if end is None or start is None:
        return 0
    diff = getattr(time, "ticks_diff", None) if time is not None else None
    return diff(end, start) if callable(diff) else max(0, end - start)


class PythonExecutor:
    """Compila una vez y ejecuta repetidamente un Functional Block."""

    def __init__(
        self,
        element_id,
        source,
        input_names,
        output_names,
        input_types=None,
        output_types=None,
        max_execution_us=DEFAULT_MAX_EXECUTION_US,
    ):
        if not isinstance(element_id, str) or not element_id:
            raise ValueError("element_id debe ser texto no vacío")
        self.element_id = element_id
        self.input_names = self._validate_ports(input_names, "entradas", MAX_INPUTS)
        self.output_names = self._validate_ports(output_names, "salidas", MAX_OUTPUTS)
        if not self.output_names:
            raise ValueError("el Functional Block necesita al menos una salida")
        self.input_types = dict(input_types or {})
        self.output_types = dict(output_types or {})
        self.max_execution_us = max_execution_us
        if not isinstance(max_execution_us, int) or isinstance(max_execution_us, bool) or max_execution_us <= 0:
            raise ValueError("max_execution_us debe ser un entero mayor que cero")
        if any(name not in self.input_names for name in self.input_types):
            raise ValueError("input_types contiene una entrada no declarada")
        if any(name not in self.output_names for name in self.output_types):
            raise ValueError("output_types contiene una salida no declarada")

        self.compile_count = 0
        self.run_count = 0
        self.error_count = 0
        self.overrun_count = 0
        self.last_duration_us = 0
        self.max_duration_us = 0
        self.last_error = None
        self._function = self._compile(source)

    @staticmethod
    def _validate_ports(names, label, limit):
        if not isinstance(names, (list, tuple)):
            raise ValueError("{} debe ser una lista".format(label))
        result = []
        for name in names:
            if not _is_identifier(name) or name.startswith("__") or name.endswith("__"):
                raise ValueError("nombre de puerto inválido en {}: {}".format(label, name))
            if name in result:
                raise ValueError("puerto repetido en {}: {}".format(label, name))
            result.append(name)
        if len(result) > limit:
            raise ValueError("{} supera el límite {}".format(label, limit))
        return tuple(result)

    def _compile(self, source):
        try:
            mode = validate_python_source(source)
        except PythonExecutorError as error:
            error.element_id = self.element_id
            raise
        executable = source
        if mode == "expression":
            signature = ", ".join(self.input_names)
            executable = "def calcular({}):\n    return ({})".format(signature, source.strip())

        namespace = {"__builtins__": SAFE_BUILTINS}
        try:
            compiled = compile(executable, "<functional_block:{}>".format(self.element_id), "exec")
            exec(compiled, namespace, namespace)
            function = namespace.get("calcular")
            if not callable(function):
                raise TypeError("calcular no es invocable")
        except PythonExecutorError:
            raise
        except Exception as error:
            raise PythonExecutorError(
                PYTHON_COMPILACION_ERROR,
                "no se pudo compilar calcular: {}".format(error),
                self.element_id,
            )
        self.compile_count += 1
        return function

    def execute(self, inputs):
        try:
            unknown = [name for name in inputs if name not in self.input_names] if isinstance(inputs, dict) else []
            if unknown:
                raise RuntimeValueError(
                    "VALOR_TIPO_INVALIDO",
                    "entrada no declarada: {}".format(unknown[0]),
                )
            safe_inputs = validate_runtime_mapping(inputs, self.input_types, path="entradas")
            started = _ticks_us()
            result = self._function(**safe_inputs)
            duration = _diff_us(_ticks_us(), started)
            self.last_duration_us = duration
            if duration > self.max_duration_us:
                self.max_duration_us = duration
            if duration > self.max_execution_us:
                self.overrun_count += 1
                raise PythonExecutorError(
                    PYTHON_TIEMPO_EXCEDIDO,
                    "calcular tardó {} us; el máximo es {} us".format(duration, self.max_execution_us),
                    self.element_id,
                )
            outputs = self._normalize_outputs(result)
            self.run_count += 1
            self.last_error = None
            return outputs
        except PythonExecutorError as error:
            self.error_count += 1
            self.last_error = error
            raise
        except RuntimeValueError as error:
            wrapped = PythonExecutorError(error.codigo, error.mensaje, self.element_id)
            self.error_count += 1
            self.last_error = wrapped
            raise wrapped
        except Exception as error:
            wrapped = PythonExecutorError(
                PYTHON_EJECUCION_ERROR,
                "falló calcular: {}".format(error),
                self.element_id,
            )
            self.error_count += 1
            self.last_error = wrapped
            raise wrapped

    def _normalize_outputs(self, result):
        if result is None:
            return {}

        treat_as_mapping = isinstance(result, dict)
        if len(self.output_names) == 1 and self.output_types.get(self.output_names[0]) == "custom":
            treat_as_mapping = False

        if treat_as_mapping:
            unknown = [name for name in result if name not in self.output_names]
            if unknown:
                raise PythonExecutorError(
                    PYTHON_SALIDA_INVALIDA,
                    "calcular retornó la salida no declarada {}".format(unknown[0]),
                    self.element_id,
                )
            outputs = result
        else:
            if len(self.output_names) != 1:
                raise PythonExecutorError(
                    PYTHON_SALIDA_INVALIDA,
                    "un bloque con varias salidas debe retornar un diccionario",
                    self.element_id,
                )
            outputs = {self.output_names[0]: result}

        declared_types = {name: self.output_types.get(name) for name in self.output_names}
        try:
            return validate_runtime_mapping(
                outputs,
                declared_types,
                reject_unknown=True,
                path="salidas",
            )
        except RuntimeValueError as error:
            raise PythonExecutorError(error.codigo, error.mensaje, self.element_id)

    def stats(self):
        return {
            "element_id": self.element_id,
            "compile_count": self.compile_count,
            "run_count": self.run_count,
            "error_count": self.error_count,
            "overrun_count": self.overrun_count,
            "last_duration_us": self.last_duration_us,
            "max_duration_us": self.max_duration_us,
            "last_error": None if self.last_error is None else self.last_error.codigo,
        }
