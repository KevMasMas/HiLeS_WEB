"""Scheduler cooperativo, periódico y tolerante a errores de tareas."""

import sys

from .clock import SystemClock


def _default_error_handler(task, error):
    print("[ERROR] Task {}: {}".format(task.name, repr(error)))
    print_exception = getattr(sys, "print_exception", None)
    if print_exception is not None:
        print_exception(error)


def _default_overrun_handler(task):
    print(
        "[WARN] Task {} tardó {} us; presupuesto {} ms".format(
            task.name,
            task.last_duration_us,
            task.max_update_ms,
        )
    )


class Scheduler:
    """Ejecuta secuencialmente las tareas cuyo periodo ya venció."""

    def __init__(self, clock=None, error_handler=None, overrun_handler=None):
        self.clock = clock or SystemClock()
        self.tasks = []
        self.running = False
        self.error_handler = error_handler or _default_error_handler
        self.overrun_handler = overrun_handler or _default_overrun_handler
        self._next_order = 0

    def add(self, task):
        if task.scheduler is not self:
            raise ValueError("La tarea pertenece a otro scheduler")
        if task in self.tasks:
            raise ValueError("La tarea ya está registrada")
        task._scheduler_order = self._next_order
        self._next_order += 1
        self.tasks.append(task)
        self.tasks.sort(key=lambda item: (item.priority, item._scheduler_order))

    def remove(self, task):
        self.tasks.remove(task)

    def _report_error(self, task, error):
        try:
            self.error_handler(task, error)
        except Exception as handler_error:
            _default_error_handler(task, handler_error)

    def _report_overrun(self, task):
        try:
            self.overrun_handler(task)
        except Exception as handler_error:
            _default_error_handler(task, handler_error)

    def run_pending(self, now_ms=None):
        """Ejecuta una vez cada tarea vencida y retorna sus nombres.

        Al terminar se agenda desde el tiempo actual, sin intentar recuperar en
        ráfaga las iteraciones perdidas durante un bloqueo o una desconexión.
        """

        now = self.clock.now_ms() if now_ms is None else now_ms
        executed = []

        for task in tuple(self.tasks):
            if not task.enabled or self.clock.diff_ms(now, task.next_run) < 0:
                continue

            executed.append(task.name)
            try:
                task._run_measured()
            except Exception as error:
                self._report_error(task, error)
            finally:
                rescheduled_at = self.clock.now_ms()
                task.next_run = self.clock.add_ms(rescheduled_at, task.period_ms)

            if task.max_update_ms is not None and task.last_duration_us > task.max_update_ms * 1_000:
                self._report_overrun(task)

        return executed

    def run_forever(self, idle_sleep_ms=1):
        if not isinstance(idle_sleep_ms, int) or idle_sleep_ms < 0:
            raise ValueError("idle_sleep_ms debe ser un entero mayor o igual que cero")

        self.running = True
        try:
            while self.running:
                self.run_pending()
                if idle_sleep_ms:
                    self.clock.sleep_ms(idle_sleep_ms)
        finally:
            self.running = False

    def stop(self):
        self.running = False

    def stats(self):
        return {task.name: task.stats() for task in self.tasks}
