"""Cliente MQTT de la Raspberry Pi Pico W para la demostración HiLeS."""

import time

import network
import ujson
from machine import Pin
from umqtt.simple import MQTTClient

from config_local import (
    MQTT_CLIENT_ID,
    MQTT_HOST,
    MQTT_PASSWORD,
    MQTT_PORT,
    MQTT_USERNAME,
    WIFI_PASSWORD,
    WIFI_SSID,
)


TOPIC_BASE = "udfjc/hiles/v1/equipo1/pico01/"
TOPIC_LED_COMANDO = (TOPIC_BASE + "led/comando").encode()
TOPIC_LED_ESTADO = (TOPIC_BASE + "led/estado").encode()
TOPIC_ESTADO_CONEXION = (TOPIC_BASE + "estado/conexion").encode()
TOPIC_ERROR = (TOPIC_BASE + "error").encode()

WIFI_TIMEOUT_MS = 20_000
RECONNECT_DELAY_SECONDS = 3
MQTT_KEEPALIVE_SECONDS = 30
MQTT_PING_INTERVAL_MS = 15_000

led = Pin("LED", Pin.OUT)
client = None


def json_bytes(data):
    return ujson.dumps(data).encode()


def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        print("Wi-Fi conectado:", wlan.ifconfig()[0])
        return wlan

    print("Conectando a Wi-Fi...")
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)
    started_at = time.ticks_ms()

    while not wlan.isconnected():
        if wlan.status() < 0:
            raise RuntimeError("Fallo de Wi-Fi; estado {}".format(wlan.status()))
        if time.ticks_diff(time.ticks_ms(), started_at) >= WIFI_TIMEOUT_MS:
            wlan.disconnect()
            raise RuntimeError("Timeout de Wi-Fi")
        time.sleep_ms(500)

    print("Wi-Fi conectado:", wlan.ifconfig()[0])
    return wlan


def publish_json(topic, data, retain=False):
    client.publish(topic, json_bytes(data), retain=retain)


def publish_led_state(action, message_id=None):
    payload = {
        "encendido": bool(led.value()),
        "accion_aplicada": action,
    }
    if message_id is not None:
        payload["id_mensaje"] = message_id
    publish_json(TOPIC_LED_ESTADO, payload, retain=True)


def publish_error(message, message_id=None):
    payload = {"error": message}
    if message_id is not None:
        payload["id_mensaje"] = message_id
    publish_json(TOPIC_ERROR, payload)


def apply_led_action(action, message_id):
    if action == "encender":
        led.on()
    elif action == "apagar":
        led.off()
    elif action == "titilar":
        for _ in range(3):
            led.on()
            time.sleep_ms(300)
            led.off()
            time.sleep_ms(300)
    else:
        raise ValueError("Acción no soportada: {}".format(action))

    publish_led_state(action, message_id)


def on_message(topic, message):
    print("Mensaje recibido:", topic, message)

    if topic != TOPIC_LED_COMANDO:
        return

    message_id = None
    try:
        payload = ujson.loads(message)
        if not isinstance(payload, dict):
            raise ValueError("El JSON debe ser un objeto")

        action = payload.get("accion")
        message_id = payload.get("id_mensaje")
        if not isinstance(action, str):
            raise ValueError("Falta el campo accion")

        apply_led_action(action, message_id)
    except Exception as error:
        print("Comando rechazado:", error)
        publish_error(str(error), message_id)


def connect_mqtt():
    global client

    client = MQTTClient(
        MQTT_CLIENT_ID.encode(),
        MQTT_HOST,
        port=MQTT_PORT,
        user=MQTT_USERNAME.encode(),
        password=MQTT_PASSWORD.encode(),
        keepalive=MQTT_KEEPALIVE_SECONDS,
    )
    client.set_callback(on_message)
    client.set_last_will(
        TOPIC_ESTADO_CONEXION,
        json_bytes({"conectado": False, "dispositivo": MQTT_CLIENT_ID}),
        retain=True,
    )
    client.connect(timeout=5)
    client.subscribe(TOPIC_LED_COMANDO)
    publish_json(
        TOPIC_ESTADO_CONEXION,
        {"conectado": True, "dispositivo": MQTT_CLIENT_ID},
        retain=True,
    )
    publish_led_state("inicio")
    print("MQTT conectado; esperando comandos")


def run():
    global client

    while True:
        try:
            connect_wifi()
            connect_mqtt()
            last_ping = time.ticks_ms()

            while True:
                client.check_msg()
                now = time.ticks_ms()
                if time.ticks_diff(now, last_ping) >= MQTT_PING_INTERVAL_MS:
                    client.ping()
                    last_ping = now
                time.sleep_ms(100)
        except KeyboardInterrupt:
            if client is not None:
                try:
                    publish_json(
                        TOPIC_ESTADO_CONEXION,
                        {"conectado": False, "dispositivo": MQTT_CLIENT_ID},
                        retain=True,
                    )
                    client.disconnect()
                except Exception:
                    pass
            print("Programa detenido")
            return
        except Exception as error:
            print("Conexión perdida:", repr(error))
            if client is not None:
                try:
                    client.disconnect()
                except Exception:
                    pass
            client = None
            time.sleep(RECONNECT_DELAY_SECONDS)


run()
