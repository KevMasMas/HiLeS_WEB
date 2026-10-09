"""Prueba independiente de Wi-Fi para Raspberry Pi Pico W."""

import time

import network

from config_local import WIFI_PASSWORD, WIFI_SSID


TIMEOUT_MS = 20_000

STATUS_NAMES = {
    network.STAT_IDLE: "inactivo",
    network.STAT_CONNECTING: "conectando",
    network.STAT_WRONG_PASSWORD: "contrasena incorrecta",
    network.STAT_NO_AP_FOUND: "red no encontrada",
    network.STAT_CONNECT_FAIL: "fallo de conexion",
    network.STAT_GOT_IP: "conectado",
}


def status_name(status):
    return STATUS_NAMES.get(status, "desconocido ({})".format(status))


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        print("Wi-Fi ya estaba conectado")
        print("Configuracion de red:", wlan.ifconfig())
        return wlan

    print("Conectando a la red Wi-Fi...")
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    started_at = time.ticks_ms()

    while not wlan.isconnected():
        status = wlan.status()
        if status < 0:
            raise RuntimeError("Wi-Fi: {}".format(status_name(status)))
        if time.ticks_diff(time.ticks_ms(), started_at) >= TIMEOUT_MS:
            wlan.disconnect()
            raise RuntimeError(
                "Wi-Fi: timeout despues de {} segundos; ultimo estado: {}".format(
                    TIMEOUT_MS // 1000,
                    status_name(status),
                )
            )
        print("Estado:", status_name(status))
        time.sleep(1)

    print("Wi-Fi conectado")
    print("Configuracion de red:", wlan.ifconfig())
    return wlan


if __name__ == "__main__":
    connect_wifi()

