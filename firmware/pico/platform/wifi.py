"""Conexión Wi-Fi cooperativa y comprobable sin hardware."""

import time


class WifiConnection:
    """Adaptador de ``network.WLAN`` con conexión iniciada una sola vez."""

    def __init__(self, ssid, password, wlan=None, network_module=None,
                 retry_interval_ms=5000, clock=None):
        if not isinstance(retry_interval_ms, int) or isinstance(retry_interval_ms, bool) or retry_interval_ms <= 0:
            raise ValueError("retry_interval_ms debe ser un entero mayor que cero")
        self.ssid = ssid
        self.password = password
        self.retry_interval_ms = retry_interval_ms
        self.clock = clock
        if wlan is None:
            if network_module is None:
                try:
                    import network as network_module
                except ImportError as exc:  # pragma: no cover
                    raise RuntimeError("network no está disponible; inyecte wlan") from exc
            wlan_class = getattr(network_module, "WLAN", None)
            station = getattr(network_module, "STA_IF", 0)
            if wlan_class is None:
                raise ValueError("el módulo network debe exponer WLAN")
            wlan = wlan_class(station)
        self.wlan = wlan
        self._started = False
        self._next_attempt = None

    def _now_ms(self):
        if self.clock is not None:
            return self.clock.now_ms()
        ticks_ms = getattr(time, "ticks_ms", None)
        return ticks_ms() if ticks_ms is not None else time.monotonic_ns() // 1_000_000

    def _add_ms(self, value, delta_ms):
        if self.clock is not None:
            return self.clock.add_ms(value, delta_ms)
        ticks_add = getattr(time, "ticks_add", None)
        return ticks_add(value, delta_ms) if ticks_add is not None else value + delta_ms

    def _diff_ms(self, later, earlier):
        if self.clock is not None:
            return self.clock.diff_ms(later, earlier)
        ticks_diff = getattr(time, "ticks_diff", None)
        return ticks_diff(later, earlier) if ticks_diff is not None else later - earlier

    def start(self):
        self.wlan.active(True)
        now = self._now_ms()
        self._started = True
        self._next_attempt = self._add_ms(now, self.retry_interval_ms)
        if not self.wlan.isconnected():
            self.wlan.connect(self.ssid, self.password)

    def poll(self):
        """Inicia o consulta la conexión; nunca espera ni duerme."""

        if self.is_connected():
            return True
        now = self._now_ms()
        if not self._started or self._next_attempt is None or self._diff_ms(now, self._next_attempt) >= 0:
            self.start()
        return self.is_connected()

    def is_connected(self):
        return bool(self.wlan.isconnected())

    def ifconfig(self):
        return self.wlan.ifconfig() if self.is_connected() else None

    def disconnect(self):
        disconnect = getattr(self.wlan, "disconnect", None)
        if callable(disconnect):
            disconnect()
        self._started = False
        self._next_attempt = None

