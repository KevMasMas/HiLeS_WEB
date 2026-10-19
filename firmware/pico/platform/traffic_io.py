"""Adaptadores GPIO opcionales para el demo de semáforos.

Ningún módulo de lógica importa ``machine``: estas clases reciben el módulo
por inyección y solo lo importan cuando se usan en la Pico. Así el mismo
``TrafficControllerTask`` funciona con hardware real o con dobles de prueba.
"""


def _machine(machine_module):
    if machine_module is not None:
        return machine_module
    import machine  # pragma: no cover - solo existe en MicroPython

    return machine  # pragma: no cover


class GpioPresenceInput:
    """Sensor de presencia en un pin digital (pulsador, lazo o barrera IR)."""

    def __init__(self, pin, active_low=True, machine_module=None):
        machine = _machine(machine_module)
        pull = getattr(machine.Pin, "PULL_UP", None) if active_low else getattr(machine.Pin, "PULL_DOWN", None)
        if pull is None:
            self._pin = machine.Pin(pin, machine.Pin.IN)
        else:
            self._pin = machine.Pin(pin, machine.Pin.IN, pull)
        self.active_low = active_low

    def read(self):
        nivel = self._pin.value()
        return (nivel == 0) if self.active_low else (nivel == 1)


class TrafficLightOutput:
    """Tres salidas digitales que muestran un color a la vez."""

    COLORES = ("rojo", "amarillo", "verde")

    def __init__(self, pines, machine_module=None):
        faltantes = [color for color in self.COLORES if color not in pines]
        if faltantes:
            raise ValueError("faltan pines para: {}".format(", ".join(faltantes)))
        machine = _machine(machine_module)
        self._pines = {}
        for color in self.COLORES:
            self._pines[color] = machine.Pin(pines[color], machine.Pin.OUT)
        self.color = None
        self.show("rojo")

    def show(self, color):
        if color not in self.COLORES:
            # Fail-safe: un color desconocido se muestra como rojo.
            color = "rojo"
        # Primero apaga los demás para no mostrar dos colores a la vez.
        for nombre, pin in self._pines.items():
            if nombre != color:
                pin.value(0)
        self._pines[color].value(1)
        self.color = color


def build_traffic_io(config, machine_module=None):
    """Construye sensores y salidas desde ``config_local`` si están definidos.

    ``config.TRAFFIC_SENSOR_PINS = {"norte": 2, ...}`` y
    ``config.TRAFFIC_LIGHT_PINS = {"norte": {"rojo": 3, "amarillo": 4, "verde": 5}, ...}``.
    Retorna ``(fuentes, salidas)``; un diccionario vacío significa sin hardware.
    """

    fuentes = {}
    salidas = {}
    for sentido, pin in (getattr(config, "TRAFFIC_SENSOR_PINS", None) or {}).items():
        fuentes[sentido] = GpioPresenceInput(pin, machine_module=machine_module)
    for sentido, pines in (getattr(config, "TRAFFIC_LIGHT_PINS", None) or {}).items():
        salidas[sentido] = TrafficLightOutput(pines, machine_module=machine_module)
    return fuentes, salidas
