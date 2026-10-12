"""Conexión Wi-Fi no bloqueante y comprobable sin hardware."""


class WifiConnection:
    """Adaptador de ``network.WLAN`` con conexión iniciada una sola vez."""

    def __init__(self, ssid, password, wlan=None, network_module=None):
        self.ssid = ssid
        self.password = password
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

    def start(self):
        self.wlan.active(True)
        if not self.wlan.isconnected():
            self.wlan.connect(self.ssid, self.password)
        self._started = True

    def poll(self):
        """Inicia o consulta la conexión; nunca espera ni duerme."""

        if not self._started:
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

