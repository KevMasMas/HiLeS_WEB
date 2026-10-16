"""Clase base de las tareas cooperativas."""


class Task:
    """Unidad periódica ejecutada por :class:`Scheduler`.

    Las subclases deben implementar ``update`` y retornar rápidamente. Una
    tarea no crea hilos: conserva su estado entre llamadas consecutivas.
    """

    def __init__(
        self,
        scheduler,
        period_ms,
        priority=1,
        name=None,
        run_immediately=True,
        max_update_ms=None,
    ):
        if scheduler is None:
            raise ValueError("Task necesita un scheduler")
        if not isinstance(period_ms, int) or isinstance(period_ms, bool) or period_ms <= 0:
            raise ValueError("period_ms debe ser un entero mayor que cero")
        if not isinstance(priority, int) or isinstance(priority, bool):
            raise ValueError("priority debe ser un entero")
        if max_update_ms is not None and (
            not isinstance(max_update_ms, int)
            or isinstance(max_update_ms, bool)
            or max_update_ms <= 0
        ):
            raise ValueError("max_update_ms debe ser un entero mayor que cero")

        self.scheduler = scheduler
        self.period_ms = period_ms
        self.priority = priority
        self.name = name or self.__class__.__name__
        self.max_update_ms = max_update_ms
        self.enabled = True

        self.run_count = 0
        self.error_count = 0
        self.overrun_count = 0
        self.last_duration_us = 0
        self.max_duration_us = 0
        self.last_error = None

        now = scheduler.clock.now_ms()
        self.next_run = now if run_immediately else scheduler.clock.add_ms(now, period_ms)
        scheduler.add(self)

    @property
    def period(self):
        """Alias compatible con el ejemplo original de PicoROS."""

        return self.period_ms

    def update(self):
        """Realiza una porción breve de trabajo.

        Toda tarea concreta debe sobrescribir este método.
        """

        raise NotImplementedError("{} debe implementar update()".format(self.name))

    def enable(self, run_immediately=False):
        self.enabled = True
        now = self.scheduler.clock.now_ms()
        self.next_run = now if run_immediately else self.scheduler.clock.add_ms(now, self.period_ms)

    def disable(self):
        self.enabled = False

    def stats(self):
        return {
            "period_ms": self.period_ms,
            "priority": self.priority,
            "enabled": self.enabled,
            "run_count": self.run_count,
            "error_count": self.error_count,
            "overrun_count": self.overrun_count,
            "last_duration_us": self.last_duration_us,
            "max_duration_us": self.max_duration_us,
            "last_error": None if self.last_error is None else repr(self.last_error),
        }

    def _run_measured(self):
        clock = self.scheduler.clock
        started_at = clock.now_us()
        try:
            self.update()
        except Exception as error:
            self.error_count += 1
            self.last_error = error
            raise
        finally:
            finished_at = clock.now_us()
            duration_us = clock.diff_us(finished_at, started_at)
            if duration_us < 0:
                duration_us = 0
            self.last_duration_us = duration_us
            if duration_us > self.max_duration_us:
                self.max_duration_us = duration_us
            self.run_count += 1
            if self.max_update_ms is not None and duration_us > self.max_update_ms * 1_000:
                self.overrun_count += 1
