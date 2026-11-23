"""Elementos ejecutables de la IR v2.

Cada clase replica el elemento equivalente del motor TypeScript de referencia
(``frontend/src/engine/elementos/``). Los elementos solo conocen sus puertos y
su estado; la entrega por canales, los retardos y la red de Petri los
coordina :class:`HilesEngineV2`.
"""

from .expressions import evaluar
from .model import PUERTO_CONDICION
from .python_executor import PYTHON_CODIGO_INVALIDO, PythonExecutor, PythonExecutorError

PUERTO_ACCION_POR_DEFECTO = "transition-action-out"

# Alias aceptados por el validador web que el evaluador IR expresa con otro nombre.
_ALIAS_OPERADORES = {"&&": "and", "||": "or", "!": "not"}


def _normalizar_expresion(expresion):
    """Traduce alias de operadores para reutilizar el evaluador de la IR v1."""

    if not isinstance(expresion, dict) or "op" not in expresion:
        return expresion
    argumentos = [_normalizar_expresion(argumento) for argumento in expresion["args"]]
    operador = _ALIAS_OPERADORES.get(expresion["op"], expresion["op"])
    if operador == "+" and len(argumentos) == 1:
        # ``+x`` es la identidad numérica: equivale a ``x - 0``.
        return {"op": "-", "args": [argumentos[0], {"lit": 0}]}
    return {"op": operador, "args": argumentos}


def _es_escalar(valor):
    return isinstance(valor, (bool, int, float, str))


class ElementV2:
    tipo = None

    def __init__(self, definicion):
        self.id = definicion["id"]
        self.nombre = definicion["nombre"]
        self.retardo_ms = int(definicion.get("retardo_ms", 0) or 0)
        self.error = None

    def receive(self, puerto, valor):
        pass

    def evaluate(self):
        """Retorna ``[(puerto, valor)]`` en el orden en que se publica."""

        return []

    def reset(self):
        self.error = None

    def base_value(self):
        """Valor propio usado como respaldo en la instantánea."""

        return None


class ServiceV2(ElementV2):
    tipo = "service"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.tipo_dato = definicion["tipo_dato"]
        self.salidas = list(definicion["salidas"])
        self.entradas = list(definicion["entradas"])
        self.tiene_valor_inicial = "valor_inicial" in definicion
        self.valor_inicial = definicion.get("valor_inicial")
        self.valor = None
        self.reset()

    def reset(self):
        super().reset()
        self.valor = self.valor_inicial if self.tiene_valor_inicial else None

    def receive(self, puerto, valor):
        if puerto not in self.entradas:
            self.error = "El puerto {} no es una entrada válida del Service.".format(puerto)
            return
        self.valor = valor
        self.error = None

    def set_value(self, valor):
        self.valor = valor
        self.error = None

    def evaluate(self):
        if self.valor is None:
            return []
        return [(puerto, self.valor) for puerto in self.salidas]

    def base_value(self):
        return self.valor


class FunctionalBlockV2(ElementV2):
    tipo = "functional_block"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.habilitado = definicion["habilitado"]
        self.lenguaje = definicion["lenguaje"]
        self.entradas = definicion["entradas"]
        self.salidas = definicion["salidas"]
        self.puertos_entrada = set(item["puerto"] for item in self.entradas)
        self.expresion = None
        self.executor = None
        if self.lenguaje == "python":
            self.executor = self._build_executor(definicion["codigo"])
        elif definicion.get("expresion") is not None:
            self.expresion = _normalizar_expresion(definicion["expresion"])
        self.entradas_recibidas = {}

    def _build_executor(self, codigo):
        """Compila una sola vez al cargar; un fallo rechaza toda la carga."""

        try:
            return PythonExecutor(
                element_id=self.id,
                source=codigo,
                input_names=[item["variable"] for item in self.entradas],
                output_names=[item["variable"] for item in self.salidas],
                input_types=dict((item["variable"], item["tipo_dato"]) for item in self.entradas),
                output_types=dict((item["variable"], item["tipo_dato"]) for item in self.salidas),
            )
        except PythonExecutorError as error:
            error.element_id = self.id
            raise
        except ValueError as error:
            raise PythonExecutorError(PYTHON_CODIGO_INVALIDO, str(error), self.id)

    def reset(self):
        super().reset()
        self.entradas_recibidas = {}

    def receive(self, puerto, valor):
        if puerto not in self.puertos_entrada:
            self.error = "El puerto {} no es una entrada válida.".format(puerto)
            return
        self.entradas_recibidas[puerto] = valor
        for item in self.entradas:
            if item["puerto"] == puerto:
                self.entradas_recibidas[item["variable"]] = valor

    def _valor_entrada(self, item):
        valor = self.entradas_recibidas.get(item["variable"])
        if valor is None:
            valor = self.entradas_recibidas.get(item["puerto"])
        return valor

    def evaluate(self):
        """Puede lanzar :class:`PythonExecutorError`; el motor lo asocia al bloque."""

        if not self.habilitado:
            return []
        if self.executor is not None:
            argumentos = {}
            for item in self.entradas:
                valor = self._valor_entrada(item)
                if valor is not None:
                    argumentos[item["variable"]] = valor
            resultado = self.executor.execute(argumentos)
            return [
                (item["puerto"], resultado[item["variable"]])
                for item in self.salidas
                if item["variable"] in resultado
            ]
        if self.expresion is None:
            return []
        # Igual que el motor web: una entrada ausente o no escalar vale 0 y un
        # resultado ausente se publica como 0 en todas las salidas.
        variables = {}
        for item in self.entradas:
            valor = self.entradas_recibidas.get(item["puerto"])
            if valor is None:
                valor = self.entradas_recibidas.get(item["variable"])
            variables[item["variable"]] = valor if _es_escalar(valor) else 0
        resultado = evaluar(self.expresion, variables)
        if resultado is None:
            resultado = 0
        return [(item["puerto"], resultado) for item in self.salidas]


class SampleV2(ElementV2):
    """Captura el dato continuo cuando llega ``true`` por el control LCH."""

    tipo = "sample"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.puerto_dato = definicion["puerto_dato"]
        self.puerto_control = definicion["puerto_control"]
        self.puerto_salida = definicion["puerto_salida"]
        self.reset()

    def reset(self):
        super().reset()
        self.dato = None
        self.capturado = None
        self.tiene_captura = False
        self.control = False

    def receive(self, puerto, valor):
        if puerto == self.puerto_control:
            self.control = bool(valor)
        elif puerto == self.puerto_dato:
            self.dato = valor
        else:
            self.error = "El puerto {} no es una entrada válida del Sample.".format(puerto)
            return
        self.error = None
        if self.control and self.dato is not None:
            self.capturado = self.dato
            self.tiene_captura = True
            self.control = False

    def evaluate(self):
        if not self.tiene_captura:
            return []
        self.tiene_captura = False
        return [(self.puerto_salida, self.capturado)]

    def base_value(self):
        return self.capturado


class HoldV2(ElementV2):
    """Retiene el último evento DCH; lo expone por CCH y pulsa su LCH."""

    tipo = "hold"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.puerto_entrada = definicion["puerto_entrada"]
        self.puerto_cch = definicion["puerto_cch"]
        self.puerto_lch = definicion["puerto_lch"]
        self.tiene_valor_inicial = "valor_inicial" in definicion
        self.valor_inicial = definicion.get("valor_inicial")
        self.reset()

    def reset(self):
        super().reset()
        # El valor inicial no cuenta como evento: en reposo solo publica CCH.
        self.valor = self.valor_inicial if self.tiene_valor_inicial else None
        self.evento_pendiente = False

    def receive(self, puerto, valor):
        if puerto == self.puerto_entrada:
            self.valor = valor
            self.evento_pendiente = True

    def evaluate(self):
        if self.valor is None:
            return []
        salidas = [(self.puerto_cch, self.valor)]
        if self.evento_pendiente:
            salidas.append((self.puerto_lch, True))
            self.evento_pendiente = False
        return salidas

    def base_value(self):
        return self.valor


class PlaceV2(ElementV2):
    tipo = "place"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.tokens_iniciales = int(definicion["tokens"])
        capacidad = definicion.get("capacidad")
        # ``None`` es un Place sin cota superior, según IR_V2.md §4.5.
        self.capacidad = None if capacidad is None else int(capacidad)
        self.tokens = self.tokens_iniciales

    def reset(self):
        super().reset()
        self.tokens = self.tokens_iniciales


class TransitionV2(ElementV2):
    tipo = "transition"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.habilitada_config = definicion["habilitada"]
        self.puerto_condicion = definicion["puerto_condicion"]
        self.puerto_accion = definicion.get("puerto_accion") or PUERTO_ACCION_POR_DEFECTO
        self.consumo = {}
        self.produccion = {}
        self._lugares = []
        self.reset()

    def add_input_arc(self, lugar_id, peso):
        self.consumo[lugar_id] = self.consumo.get(lugar_id, 0) + int(peso)
        if lugar_id not in self._lugares:
            self._lugares.append(lugar_id)

    def add_output_arc(self, lugar_id, peso):
        self.produccion[lugar_id] = self.produccion.get(lugar_id, 0) + int(peso)
        if lugar_id not in self._lugares:
            self._lugares.append(lugar_id)

    def reset(self):
        super().reset()
        self.condicion = False
        self.disparo_pendiente = False

    def receive(self, puerto, valor):
        if puerto != self.puerto_condicion and puerto != PUERTO_CONDICION:
            self.error = "El puerto {} no es la entrada de condición de la Transition.".format(puerto)
            return
        if not isinstance(valor, bool):
            self.error = "La condición de una Transition debe ser booleana."
            self.condicion = False
            return
        self.condicion = valor
        self.error = None

    def is_enabled(self):
        return bool(self.habilitada_config and self.condicion and self.error is None)

    def can_fire(self, lugares):
        """Guarda verdadera y balance neto válido en todos los Places."""

        if not self.is_enabled() or not self.consumo or not self.produccion:
            return False
        for lugar_id in self._lugares:
            lugar = lugares[lugar_id]
            consumo = self.consumo.get(lugar_id, 0)
            final = lugar.tokens - consumo + self.produccion.get(lugar_id, 0)
            if lugar.tokens < consumo or final < 0:
                return False
            if lugar.capacidad is not None and final > lugar.capacidad:
                return False
        return True

    def fire(self, lugares):
        for lugar_id in self._lugares:
            lugar = lugares[lugar_id]
            lugar.tokens = lugar.tokens - self.consumo.get(lugar_id, 0) + self.produccion.get(lugar_id, 0)
        self.disparo_pendiente = True
        # Una guarda LCH es un pulso consumible. Si permaneciera verdadera, una
        # entrega remota podría reutilizarse y crear otro token sin mensaje nuevo.
        self.condicion = False

    def evaluate(self):
        if not self.disparo_pendiente:
            return []
        self.disparo_pendiente = False
        return [(self.puerto_accion, True)]


ELEMENT_CLASSES_V2 = {
    ServiceV2.tipo: ServiceV2,
    FunctionalBlockV2.tipo: FunctionalBlockV2,
    SampleV2.tipo: SampleV2,
    HoldV2.tipo: HoldV2,
    PlaceV2.tipo: PlaceV2,
    TransitionV2.tipo: TransitionV2,
}


def build_element_v2(definicion):
    return ELEMENT_CLASSES_V2[definicion["tipo"]](definicion)
