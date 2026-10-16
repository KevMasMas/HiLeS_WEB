"""Tarea no bloqueante para controlar un LED.

La tarea solo conoce una salida con ``on()``, ``off()`` y opcionalmente
``value()``. De esta forma el mismo comportamiento funciona con ``machine.Pin``
en la Pico y con un doble de pruebas en escritorio.
"""

try:
    from ..core.task import Task
except ImportError:  # Permite cargar el módulo directamente en MicroPython.
    from core.task import Task


APAGADO = "APAGADO"
ENCENDIDO = "ENCENDIDO"
TITILANDO = "TITILANDO"
ACCIONES_VALIDAS = ("encender", "apagar", "titilar")


class LedTask(Task):
    """Máquina de estados cooperativa para ``encender``, ``apagar`` y ``titilar``."""

    def __init__(
        self,
        scheduler,
        led,
        period_ms=50,
        blink_interval_ms=300,
        blink_count=3,
        priority=1,
        name="led",
        on_state_change=None,
    ):
        if not isinstance(blink_interval_ms, int) or isinstance(blink_interval_ms, bool):
            raise ValueError("blink_interval_ms debe ser un entero")
        if blink_interval_ms <= 0:
            raise ValueError("blink_interval_ms debe ser mayor que cero")
        if not isinstance(blink_count, int) or isinstance(blink_count, bool) or blink_count <= 0:
            raise ValueError("blink_count debe ser un entero mayor que cero")
        if not callable(getattr(led, "on", None)) or not callable(getattr(led, "off", None)):
            raise ValueError("led debe implementar on() y off()")

        self.led = led
        self.blink_interval_ms = blink_interval_ms
        self.blink_count = blink_count
        self.on_state_change = on_state_change
        self.state = APAGADO
        self.last_action = "inicio"
        self.last_message_id = None
        self._next_toggle = None
        self._toggle_count = 0
        self._output_on = False
        self._write_output(False)
        super().__init__(
            scheduler,
            period_ms=period_ms,
            priority=priority,
            name=name,
            max_update_ms=period_ms,
        )

    def command(self, action, message_id=None):
        """Valida y aplica una orden sin esperar ni ejecutar un ciclo de parpadeo."""

        if action not in ACCIONES_VALIDAS:
            raise ValueError("Acción no soportada: {}".format(action))

        self.last_action = action
        self.last_message_id = message_id
        now = self.scheduler.clock.now_ms()
        if action == "encender":
            self._set_state(ENCENDIDO)
            self._write_output(True)
            self._next_toggle = None
        elif action == "apagar":
            self._set_state(APAGADO)
            self._write_output(False)
            self._next_toggle = None
        else:
            self._set_state(TITILANDO)
            self._toggle_count = 0
            self._write_output(True)
            self._next_toggle = self.scheduler.clock.add_ms(now, self.blink_interval_ms)

        return self.state

    def update(self):
        if self.state != TITILANDO or self._next_toggle is None:
            return

        now = self.scheduler.clock.now_ms()
        if self.scheduler.clock.diff_ms(now, self._next_toggle) < 0:
            return

        # Como máximo se hace un cambio por actualización: nunca se recupera
        # una ráfaga de cambios atrasados ni se bloquea al scheduler.
        self._write_output(not self._is_on())
        self._toggle_count += 1

        if self._toggle_count >= self.blink_count * 2:
            self._write_output(False)
            self._set_state(APAGADO)
            self._next_toggle = None
            return

        self._next_toggle = self.scheduler.clock.add_ms(now, self.blink_interval_ms)

    def _is_on(self):
        value = getattr(self.led, "value", None)
        if callable(value):
            return bool(value())
        return self._output_on

    def _write_output(self, on):
        if on:
            self.led.on()
        else:
            self.led.off()
        self._output_on = bool(on)

    def _set_state(self, state):
        changed = self.state != state
        self.state = state
        if changed and self.on_state_change is not None:
            self.on_state_change(self.state, self.last_action, self.last_message_id)
