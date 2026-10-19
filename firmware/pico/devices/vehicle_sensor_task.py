"""Sensores de presencia vehicular independientes, uno por sentido.

``VehicleSensorTask`` muestrea una fuente con ``read()`` (simulada o GPIO),
aplica antirrebote y detecta fallas. ``reading()`` retorna ``True``/``False``
o ``None`` si la fuente está fallando; el controlador trata ``None`` como
presencia (modo seguro de recuperación).
"""

try:
    from ..core.task import Task
except ImportError:  # Permite cargar el módulo directamente en MicroPython.
    from core.task import Task


def normalize_presence(valor):
    """Acepta ``bool`` o ``0``/``1``; cualquier otro valor es inválido."""

    if isinstance(valor, bool):
        return valor
    if isinstance(valor, int) and valor in (0, 1):
        return valor == 1
    return None


class VehicleSensorTask(Task):
    """Muestrea un sensor sin bloquear y conserva su última lectura confiable."""

    def __init__(
        self,
        scheduler,
        source,
        sentido,
        period_ms=50,
        confirmaciones=2,
        falla_ms=1000,
        priority=2,
        name=None,
    ):
        if not callable(getattr(source, "read", None)):
            raise ValueError("source debe implementar read()")
        if not isinstance(confirmaciones, int) or isinstance(confirmaciones, bool) or confirmaciones <= 0:
            raise ValueError("confirmaciones debe ser un entero mayor que cero")
        if not isinstance(falla_ms, int) or isinstance(falla_ms, bool) or falla_ms <= 0:
            raise ValueError("falla_ms debe ser un entero mayor que cero")
        self.source = source
        self.sentido = sentido
        self.confirmaciones = confirmaciones
        self.falla_ms = falla_ms
        self.presencia = False
        self.en_falla = False
        self.lecturas_invalidas = 0
        self._candidato = None
        self._repeticiones = 0
        self._ultima_valida_ms = scheduler.clock.now_ms()
        super().__init__(
            scheduler,
            period_ms=period_ms,
            priority=priority,
            name=name or "sensor-{}".format(sentido),
            max_update_ms=period_ms,
        )

    def update(self):
        clock = self.scheduler.clock
        now = clock.now_ms()
        try:
            valor = normalize_presence(self.source.read())
        except Exception:
            valor = None

        if valor is None:
            self.lecturas_invalidas += 1
            if clock.diff_ms(now, self._ultima_valida_ms) >= self.falla_ms:
                self.en_falla = True
            return

        self._ultima_valida_ms = now
        self.en_falla = False
        if valor == self.presencia:
            self._candidato = None
            self._repeticiones = 0
            return
        if valor != self._candidato:
            self._candidato = valor
            self._repeticiones = 0
        self._repeticiones += 1
        if self._repeticiones >= self.confirmaciones:
            self.presencia = valor
            self._candidato = None
            self._repeticiones = 0

    def reading(self):
        return None if self.en_falla else self.presencia


class ManualVehicleSource:
    """Fuente controlada por pruebas o por una orden externa."""

    def __init__(self, valor=False):
        self.valor = valor

    def set(self, valor):
        self.valor = valor

    def read(self):
        return self.valor


class SimulatedVehicleSource:
    """Llegadas pseudoaleatorias reproducibles para el demo sin hardware.

    Usa un generador congruencial propio para obtener la misma secuencia en
    CPython y MicroPython. Cada lectura avanza el generador una vez.
    """

    def __init__(self, semilla=1, prob_llegada=0.2, prob_salida=0.1):
        if not (0 <= prob_llegada <= 1 and 0 <= prob_salida <= 1):
            raise ValueError("las probabilidades deben estar entre 0 y 1")
        self._estado = (int(semilla) & 0x7FFFFFFF) or 1
        self.prob_llegada = prob_llegada
        self.prob_salida = prob_salida
        self.presente = False

    def _aleatorio(self):
        self._estado = (1103515245 * self._estado + 12345) & 0x7FFFFFFF
        return self._estado / 0x7FFFFFFF

    def read(self):
        muestra = self._aleatorio()
        if self.presente:
            if muestra < self.prob_salida:
                self.presente = False
        elif muestra < self.prob_llegada:
            self.presente = True
        return self.presente


class ScriptedVehicleSource:
    """Reproduce una secuencia ``[(t_ms, valor)]`` según el reloj indicado."""

    def __init__(self, clock, eventos, inicio_ms=None):
        self.clock = clock
        self.eventos = sorted(eventos, key=lambda evento: evento[0])
        self.inicio_ms = clock.now_ms() if inicio_ms is None else inicio_ms

    def read(self):
        transcurrido = self.clock.diff_ms(self.clock.now_ms(), self.inicio_ms)
        valor = False
        for instante, nuevo in self.eventos:
            if instante > transcurrido:
                break
            valor = nuevo
        return valor
