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


def resolve_device_id(config=None, machine_module=None, default="pico01"):
    """Resuelve el identificador único del dispositivo sin acoplar ``machine``.

    Orden de precedencia:
    1. ``config.DEVICE_ID`` cuando es un texto no vacío.
    2. ``machine.unique_id()`` convertido a hexadecimal en minúsculas.
    3. ``config.MQTT_CLIENT_ID`` cuando es un texto no vacío.
    4. ``default``.
    """

    if config is not None:
        configured = getattr(config, "DEVICE_ID", None)
        if isinstance(configured, str) and configured.strip():
            return configured.strip()

    if machine_module is None:
        try:
            import machine as machine_module
        except ImportError:
            machine_module = None

    unique_id_fn = getattr(machine_module, "unique_id", None) if machine_module is not None else None
    if callable(unique_id_fn):
        try:
            raw_id = unique_id_fn()
            if isinstance(raw_id, (bytes, bytearray)) and len(raw_id) > 0:
                hex_id = "".join("{:02x}".format(b) for b in raw_id)
                return "pico-" + hex_id
        except Exception:
            pass

    if config is not None:
        client_id = getattr(config, "MQTT_CLIENT_ID", None)
        if isinstance(client_id, str) and client_id.strip():
            return client_id.strip()

    return default

