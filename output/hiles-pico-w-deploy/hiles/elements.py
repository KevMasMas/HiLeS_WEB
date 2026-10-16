"""Elementos ejecutables de la IR v1: ``Service``, ``Functional Block``,
``Place`` y ``Transition``.

Cada clase conserva su configuración (tomada de la IR ya validada) y su estado
de ejecución. Ninguna conoce MQTT, GPIO ni el nombre de un circuito concreto:
la coordinación entre elementos la realiza :class:`HilesEngine`.
"""

from .expressions import evaluar
from .model import coincide_tipo_dato


class Element:
    tipo = None

    def __init__(self, definicion):
        self.id = definicion["id"]
        self.nombre = definicion["nombre"]

    def reset(self):
        raise NotImplementedError

    def emit(self):
        """Retorna la lista ``[(puerto, valor)]`` que publica en la fase de datos."""

        return []

    def receive(self, puerto, valor):
        pass

    def snapshot(self):
        raise NotImplementedError


class Service(Element):
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
        self.valor = self.valor_inicial if self.tiene_valor_inicial else None

    def accepts(self, valor):
        return coincide_tipo_dato(valor, self.tipo_dato)

    def set_value(self, valor):
        self.valor = valor

    def emit(self):
        if self.valor is None:
            return []
        return [(puerto, self.valor) for puerto in self.salidas]

    def receive(self, puerto, valor):
        self.valor = valor

    def snapshot(self):
        return {} if self.valor is None else {"valor": self.valor}


class FunctionalBlock(Element):
    tipo = "functional_block"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.habilitado = definicion["habilitado"]
        self.salidas = list(definicion["salidas"])
        self.expresion = definicion["expresion"]
        self._variable_por_puerto = {}
        for entrada in definicion["entradas"]:
            self._variable_por_puerto[entrada["puerto"]] = entrada["variable"]
        self.variables = {}
        self.salida = None
        self.reset()

    def reset(self):
        self.variables = {}
        self.salida = None

    def emit(self):
        if not self.habilitado or self.expresion is None:
            return []
        resultado = evaluar(self.expresion, self.variables)
        if resultado is None:
            return []
        self.salida = resultado
        return [(puerto, resultado) for puerto in self.salidas]

    def receive(self, puerto, valor):
        variable = self._variable_por_puerto.get(puerto)
        if variable is not None:
            self.variables[variable] = valor

    def snapshot(self):
        return {} if self.salida is None else {"salida": self.salida}


class Place(Element):
    tipo = "place"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.tokens_iniciales = int(definicion["tokens"])
        self.capacidad = int(definicion["capacidad"])
        self.tokens = self.tokens_iniciales

    def reset(self):
        self.tokens = self.tokens_iniciales

    def snapshot(self):
        return {"tokens": self.tokens}


class Transition(Element):
    tipo = "transition"

    def __init__(self, definicion):
        super().__init__(definicion)
        self.habilitada_config = definicion["habilitada"]
        self.puerto_accion = definicion["puerto_accion"]
        # Pesos netos por Place, sumando arcos repetidos en la misma dirección.
        self.consumo = {}
        self.produccion = {}
        self.condicion = False
        self.error = False
        self.disparo_pendiente = False
        self.ultimo_disparo = False

    def add_input_arc(self, lugar_id, peso):
        self.consumo[lugar_id] = self.consumo.get(lugar_id, 0) + int(peso)

    def add_output_arc(self, lugar_id, peso):
        self.produccion[lugar_id] = self.produccion.get(lugar_id, 0) + int(peso)

    def reset(self):
        self.condicion = False
        self.error = False
        self.disparo_pendiente = False
        self.ultimo_disparo = False

    def is_enabled(self):
        """Guarda verdadera y transición habilitada por configuración."""

        return self.habilitada_config and self.condicion and not self.error

    def emit(self):
        if not self.disparo_pendiente:
            return []
        self.disparo_pendiente = False
        if self.puerto_accion is None:
            return []
        return [(self.puerto_accion, True)]

    def receive(self, puerto, valor):
        if not isinstance(valor, bool):
            # Igual que en la web: una guarda no booleana deshabilita el disparo.
            self.condicion = False
            self.error = True
            return
        self.condicion = valor
        self.error = False
        self.ultimo_disparo = False

    def can_fire(self, lugares):
        """Comprueba consumo y capacidad netos de cada Place sin modificarlos."""

        if not self.is_enabled() or not self.consumo or not self.produccion:
            return False
        for lugar_id in self._lugares_conectados():
            lugar = lugares[lugar_id]
            consumo = self.consumo.get(lugar_id, 0)
            final = lugar.tokens - consumo + self.produccion.get(lugar_id, 0)
            if lugar.tokens < consumo or final < 0 or final > lugar.capacidad:
                return False
        return True

    def fire(self, lugares):
        """Mueve los tokens de forma atómica; solo se llama si ``can_fire``."""

        for lugar_id in self._lugares_conectados():
            lugar = lugares[lugar_id]
            lugar.tokens = (
                lugar.tokens - self.consumo.get(lugar_id, 0) + self.produccion.get(lugar_id, 0)
            )
        self.disparo_pendiente = True
        self.ultimo_disparo = True

    def _lugares_conectados(self):
        lugares = list(self.consumo.keys())
        for lugar_id in self.produccion:
            if lugar_id not in self.consumo:
                lugares.append(lugar_id)
        return lugares

    def snapshot(self):
        return {"habilitada": bool(self.is_enabled()), "disparada": self.ultimo_disparo}


ELEMENT_CLASSES = {
    Service.tipo: Service,
    FunctionalBlock.tipo: FunctionalBlock,
    Place.tipo: Place,
    Transition.tipo: Transition,
}


def build_element(definicion):
    return ELEMENT_CLASSES[definicion["tipo"]](definicion)
