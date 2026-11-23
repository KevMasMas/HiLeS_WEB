"""Telemetría periódica del runtime cooperativo inspirada en PicoROS."""

try:
    import gc
except ImportError:  # pragma: no cover
    gc = None

try:
    from ..core.task import Task
    from ..pubsub.topics import TELEMETRIA
except ImportError:  # pragma: no cover - import directo en MicroPython
    from core.task import Task
    from pubsub.topics import TELEMETRIA


class WatchdogTask(Task):
    """Publica salud del scheduler sin conocer MQTT ni hardware concreto."""

    def __init__(
        self,
        scheduler,
        node,
        device_id="pico01",
        period_ms=5000,
        rssi_reader=None,
        temperature_reader=None,
        gc_module=None,
        priority=9,
        name="watchdog",
        max_update_ms=100,
    ):
        if node is None:
            raise ValueError("WatchdogTask necesita un Node")
        if rssi_reader is not None and not callable(rssi_reader):
            raise ValueError("rssi_reader debe ser invocable o None")
        if temperature_reader is not None and not callable(temperature_reader):
            raise ValueError("temperature_reader debe ser invocable o None")
        if not isinstance(device_id, str) or not device_id.strip():
            raise ValueError("device_id debe ser un texto no vacío")
        self.node = node
        self.device_id = device_id.strip()
        self.rssi_reader = rssi_reader
        self.temperature_reader = temperature_reader
        self.gc_module = gc if gc_module is None else gc_module
        self.publish_count = 0
        self.sensor_error_count = 0
        self.last_payload = None
        super().__init__(
            scheduler,
            period_ms=period_ms,
            priority=priority,
            name=name,
            max_update_ms=max_update_ms,
        )

    @staticmethod
    def _read(reader, label, errors):
        if reader is None:
            return None
        try:
            return reader()
        except Exception as error:
            errors.append({"fuente": label, "error": repr(error)})
            return None

    def _memory(self, errors):
        if self.gc_module is None:
            return None
        result = {}
        for name in ("mem_free", "mem_alloc"):
            reader = getattr(self.gc_module, name, None)
            if not callable(reader):
                continue
            try:
                result[name] = reader()
            except Exception as error:
                errors.append({"fuente": "gc.{}".format(name), "error": repr(error)})
        return result or None

    def update(self):
        errors = []
        payload = {
            "dispositivo": self.device_id,
            "tiempo_ms": self.scheduler.clock.now_ms(),
            "tareas": self.scheduler.stats(),
        }
        payload["tiempo_activo"] = payload["tiempo_ms"]
        memory = self._memory(errors)
        if memory is not None:
            payload["memoria"] = memory
            if "mem_free" in memory:
                payload["memoria_libre"] = memory["mem_free"]
        rssi = self._read(self.rssi_reader, "rssi", errors)
        if rssi is not None:
            payload["rssi_dbm"] = rssi
            payload["rssi"] = rssi
        temperature = self._read(self.temperature_reader, "temperatura", errors)
        if temperature is not None:
            payload["temperatura_c"] = temperature
        if errors:
            self.sensor_error_count += len(errors)
            payload["diagnosticos"] = errors
        self.node.publish(TELEMETRIA, payload)
        self.publish_count += 1
        self.last_payload = payload

    def stats(self):
        result = super().stats()
        result["publish_count"] = self.publish_count
        result["sensor_error_count"] = self.sensor_error_count
        return result
