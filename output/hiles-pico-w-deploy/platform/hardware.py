"""Fábricas pequeñas para desacoplar ``machine.Pin`` de la lógica."""


def create_led_output(pin_name="LED", machine_module=None):
    """Crea la salida del LED integrado sin importar ``machine`` en escritorio."""

    if machine_module is None:
        try:
            import machine as machine_module
        except ImportError as exc:  # pragma: no cover - solo ocurre fuera de Pico
            raise RuntimeError("machine no está disponible; inyecte un módulo de hardware") from exc

    pin = getattr(machine_module, "Pin", None)
    if pin is None:
        raise ValueError("el módulo machine debe exponer Pin")
    output_mode = getattr(pin, "OUT", 1)
    return pin(pin_name, output_mode)

