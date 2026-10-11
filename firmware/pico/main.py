"""Punto de composición del firmware HiLeS.

Los módulos de MQTT, dispositivos y motor se conectarán aquí mediante fábricas;
la lógica de cada componente permanece fuera de este archivo.
"""

try:
    from core.scheduler import Scheduler
except ImportError:  # Permite importar este módulo como firmware.pico.main en escritorio.
    from .core.scheduler import Scheduler


def build_application(task_factories=(), clock=None, error_handler=None, overrun_handler=None):
    """Construye el scheduler y registra los componentes configurados.

    Cada fábrica recibe el scheduler y crea una o más tareas. La fábrica puede
    retornar la tarea creada, pero el registro ocurre desde el constructor de
    ``Task``.
    """

    scheduler = Scheduler(
        clock=clock,
        error_handler=error_handler,
        overrun_handler=overrun_handler,
    )
    for factory in task_factories:
        factory(scheduler)
    return scheduler


def main(task_factories=()):
    scheduler = build_application(task_factories=task_factories)
    scheduler.run_forever()


if __name__ == "__main__":
    main()
