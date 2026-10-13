"""Punto de composición del firmware HiLeS.

Conecta scheduler, bus interno, LED, motor HiLeS y transporte MQTT sin mover
la lógica de negocio fuera de sus módulos especializados.
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


def build_default_application(config=None, clock=None, machine_module=None,
                              network_module=None, mqtt_module=None):
    """Compone el runtime real de la Pico conservando adaptadores inyectables."""

    if config is None:
        try:
            import config_local as config
        except ImportError:  # pragma: no cover - depende del sistema de archivos de la Pico
            from . import config_local as config

    try:
        from devices.led_task import APAGADO, LedTask
        from hiles.engine_task import EngineTask
        from platform.hardware import create_led_output
        from platform.mqtt_client import create_mqtt_client
        from platform.wifi import WifiConnection
        from pubsub.mqtt_transport import MqttTransport
        from pubsub.node import Node
        from pubsub.topics import ERROR, LED_COMANDO, LED_ESTADO
    except ImportError:  # Permite construir la aplicación desde las pruebas de escritorio.
        from .devices.led_task import APAGADO, LedTask
        from .hiles.engine_task import EngineTask
        from .platform.hardware import create_led_output
        from .platform.mqtt_client import create_mqtt_client
        from .platform.wifi import WifiConnection
        from .pubsub.mqtt_transport import MqttTransport
        from .pubsub.node import Node
        from .pubsub.topics import ERROR, LED_COMANDO, LED_ESTADO

    scheduler = Scheduler(clock=clock)
    node = Node()
    led_output = create_led_output(machine_module=machine_module)

    def publish_led_state(state, action, message_id):
        payload = {
            "encendido": state != APAGADO,
            "accion_aplicada": action,
        }
        if message_id is not None:
            payload["id_mensaje"] = message_id
        node.publish(LED_ESTADO, payload)

    led_task = LedTask(scheduler, led_output, on_state_change=publish_led_state)
    engine_task = EngineTask(
        scheduler,
        node,
        period_ms=getattr(config, "ENGINE_PERIOD_MS", 20),
        step_interval_ms=getattr(config, "ENGINE_STEP_INTERVAL_MS", 1000),
    )

    def handle_led_command(payload):
        try:
            if not isinstance(payload, dict):
                raise ValueError("el comando LED debe ser un objeto JSON")
            action = payload.get("accion")
            message_id = payload.get("id_mensaje")
            previous_state = led_task.state
            current_state = led_task.command(action, message_id)
            if current_state == previous_state:
                publish_led_state(current_state, action, message_id)
        except Exception as exc:
            error_payload = {"codigo": "COMANDO_LED_INVALIDO", "mensaje": str(exc)}
            if isinstance(payload, dict) and payload.get("id_mensaje") is not None:
                error_payload["id_mensaje"] = payload["id_mensaje"]
            node.publish(ERROR, error_payload)

    led_command_handle = node.subscribe(LED_COMANDO, handle_led_command)
    wifi = WifiConnection(
        config.WIFI_SSID,
        config.WIFI_PASSWORD,
        network_module=network_module,
        clock=scheduler.clock,
    )

    def client_factory(client_id, host, port, username, password, keepalive):
        return create_mqtt_client(
            client_id,
            host,
            port,
            username,
            password,
            keepalive,
            mqtt_module=mqtt_module,
        )

    mqtt_transport = MqttTransport(
        scheduler,
        node,
        wifi,
        client_factory,
        client_id=config.MQTT_CLIENT_ID,
        host=config.MQTT_HOST,
        port=config.MQTT_PORT,
        username=config.MQTT_USERNAME,
        password=config.MQTT_PASSWORD,
    )
    scheduler.components = {
        "node": node,
        "wifi": wifi,
        "led": led_task,
        "engine": engine_task,
        "led_command_handle": led_command_handle,
        "mqtt": mqtt_transport,
    }
    return scheduler


def main(task_factories=None):
    print("[HiLeS] Construyendo runtime cooperativo...")
    scheduler = (
        build_default_application()
        if task_factories is None
        else build_application(task_factories=task_factories)
    )
    print("[HiLeS] Tareas activas: {}".format(
        ", ".join(task.name for task in scheduler.tasks)
    ))
    print("[HiLeS] Esperando Wi-Fi y MQTT; el scheduler sigue atendiendo tareas.")
    scheduler.run_forever()


if __name__ == "__main__":
    main()
