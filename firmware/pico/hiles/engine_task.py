"""Tarea cooperativa que conecta el motor HiLeS con el bus interno ``Node``.

Los callbacks de ``Node`` no ejecutan la simulación: solo encolan el mensaje y
retornan. Cada ``update()`` atiende como máximo ``max_commands_per_update``
mensajes o, si la cola está vacía y la ejecución continua está activa, un único
paso automático. La tarea no importa el cliente MQTT: publica en topics
relativos y el transporte decide cómo enviarlos al broker.
"""

try:
    import gc
except ImportError:  # pragma: no cover
    gc = None

try:
    from ..core.task import Task
    from ..pubsub.topics import (
        ENTRADA_ESTABLECER,
        ERROR,
        MODELO_CARGAR,
        MODELO_CONFIRMACION,
        SIMULACION_COMANDO,
        SIMULACION_ESTADO,
    )
except ImportError:  # Permite cargar el módulo directamente en MicroPython.
    from core.task import Task
    from pubsub.topics import (
        ENTRADA_ESTABLECER,
        ERROR,
        MODELO_CARGAR,
        MODELO_CONFIRMACION,
        SIMULACION_COMANDO,
        SIMULACION_ESTADO,
    )

from .engine import ENTRADA_HILES_RECHAZADA, HilesEngine, InputError
from .model import IR_VERSION, IrError, es_entero, es_texto, validate_load_message

SIN_MODELO = "sin_modelo"
LISTA = "lista"
EJECUTANDO = "ejecutando"
PAUSADA = "pausada"
DETENIDA = "detenida"

ACCIONES_SIMULACION = ("iniciar", "detener", "reiniciar", "paso", "liberar")

COMANDO_RECHAZADO = "COMANDO_RECHAZADO"
MOTOR_OCUPADO = "MOTOR_OCUPADO"
ERROR_INTERNO_MOTOR = "ERROR_INTERNO_MOTOR"


class EngineTask(Task):
    """Recibe modelo, entradas y comandos y publica las instantáneas oficiales."""

    def __init__(
        self,
        scheduler,
        node,
        period_ms=20,
        step_interval_ms=1000,
        max_commands_per_update=1,
        queue_size=8,
        dedup_size=32,
        priority=2,
        name="motor",
        max_update_ms=None,
    ):
        if not isinstance(step_interval_ms, int) or isinstance(step_interval_ms, bool) or step_interval_ms <= 0:
            raise ValueError("step_interval_ms debe ser un entero mayor que cero")
        if (
            not isinstance(max_commands_per_update, int)
            or isinstance(max_commands_per_update, bool)
            or max_commands_per_update <= 0
        ):
            raise ValueError("max_commands_per_update debe ser un entero mayor que cero")
        if not isinstance(queue_size, int) or isinstance(queue_size, bool) or queue_size <= 0:
            raise ValueError("queue_size debe ser un entero mayor que cero")
        if not isinstance(dedup_size, int) or isinstance(dedup_size, bool) or dedup_size < 32:
            raise ValueError("dedup_size debe ser un entero mayor o igual que 32")

        self.node = node
        self.step_interval_ms = step_interval_ms
        self.max_commands_per_update = max_commands_per_update
        self.queue_size = queue_size
        self.dedup_size = dedup_size

        self.engine = None
        self.modelo_id = None
        self.version = None
        self.secuencia = 0
        self.estado = SIN_MODELO
        self.dropped_count = 0
        self._cola = []
        self._next_auto_step = None
        self._dedup_order = []
        self._dedup_responses = {}
        self._capturing_id = None
        self._captured_responses = []

        super().__init__(
            scheduler,
            period_ms=period_ms,
            priority=priority,
            name=name,
            max_update_ms=max_update_ms,
        )

        self._handles = [
            node.subscribe(MODELO_CARGAR, self._make_enqueuer(MODELO_CARGAR)),
            node.subscribe(SIMULACION_COMANDO, self._make_enqueuer(SIMULACION_COMANDO)),
            node.subscribe(ENTRADA_ESTABLECER, self._make_enqueuer(ENTRADA_ESTABLECER)),
        ]

    # ------------------------------------------------------------------
    # Callbacks de Node: solo encolan y retornan.
    # ------------------------------------------------------------------

    def _make_enqueuer(self, topic):
        def _enqueue(payload):
            if len(self._cola) >= self.queue_size:
                self.dropped_count += 1
                self._publish_error(
                    MOTOR_OCUPADO,
                    "La cola del motor está llena; se descartó el mensaje de {}.".format(topic),
                    payload,
                )
                return
            self._cola.append((topic, payload))

        return _enqueue

    def pending(self):
        return len(self._cola)

    def close(self):
        """Cancela las suscripciones de la tarea sobre ``Node``."""

        while self._handles:
            self.node.unsubscribe(self._handles.pop())

    # ------------------------------------------------------------------
    # Trabajo acotado por actualización.
    # ------------------------------------------------------------------

    def update(self):
        procesados = 0
        while self._cola and procesados < self.max_commands_per_update:
            topic, payload = self._cola.pop(0)
            procesados += 1
            self._dispatch(topic, payload)

        if procesados or self.estado != EJECUTANDO or self.engine is None:
            return

        clock = self.scheduler.clock
        now = clock.now_ms()
        if self._next_auto_step is not None and clock.diff_ms(now, self._next_auto_step) < 0:
            return
        self._next_auto_step = clock.add_ms(now, self.step_interval_ms)
        self.engine.step()
        self._publish_snapshot()

    def _dispatch(self, topic, payload):
        message_id = payload.get("id_mensaje") if isinstance(payload, dict) else None
        if es_texto(message_id) and message_id in self._dedup_responses:
            for response_topic, response_payload in self._dedup_responses[message_id]:
                self.node.publish(response_topic, response_payload)
            return

        self._capturing_id = message_id if es_texto(message_id) else None
        self._captured_responses = []
        try:
            if topic == MODELO_CARGAR:
                self._handle_load(payload)
            elif topic == SIMULACION_COMANDO:
                self._handle_command(payload)
            else:
                self._handle_input(payload)
        except Exception as error:
            self._publish_error(
                ERROR_INTERNO_MOTOR,
                "Error interno del motor al procesar {}: {}".format(topic, repr(error)),
                payload,
            )
            raise
        finally:
            if self._capturing_id is not None:
                self._remember_response(self._capturing_id, self._captured_responses)
            self._capturing_id = None
            self._captured_responses = []

    # ------------------------------------------------------------------
    # Manejo de mensajes.
    # ------------------------------------------------------------------

    def _handle_load(self, payload):
        try:
            modelo_id, version, modelo = validate_load_message(payload)
        except IrError as error:
            self._reject_load(payload, error.codigo, error.mensaje)
            return

        # Si el modelo es válido se sustituye el activo; si no, se conserva.
        self.engine = HilesEngine(modelo)
        self.modelo_id = modelo_id
        self.version = version
        self.secuencia = 0
        self.estado = LISTA
        self._next_auto_step = None
        # Una carga aceptada abre una ejecución nueva. Los identificadores de
        # la versión anterior ya no deben consumir la ventana de deduplicación.
        self._dedup_order = []
        self._dedup_responses = {}
        self._emit(
            MODELO_CONFIRMACION,
            {
                "modelo_id": modelo_id,
                "version": version,
                "ir_version": IR_VERSION,
                "aceptado": True,
                "id_mensaje": payload["id_mensaje"],
            },
        )
        self._publish_snapshot(payload["id_mensaje"], increment=False)

    def _reject_load(self, payload, codigo, mensaje):
        sobre_valido = (
            isinstance(payload, dict)
            and es_texto(payload.get("id_mensaje"))
            and es_texto(payload.get("modelo_id"))
            and es_entero(payload.get("version"))
            and payload.get("version") >= 1
        )
        if not sobre_valido:
            # Sin modelo_id, version o id_mensaje no se puede construir una
            # confirmación válida según el contrato: se informa por ``error``.
            self._publish_error(codigo, mensaje, payload)
            return
        self._emit(
            MODELO_CONFIRMACION,
            {
                "modelo_id": payload["modelo_id"],
                "version": int(payload["version"]),
                "ir_version": IR_VERSION,
                "aceptado": False,
                "codigo": codigo,
                "error": mensaje,
                "id_mensaje": payload["id_mensaje"],
            },
        )

    def _check_active_model(self, payload, codigo):
        """Valida id_mensaje y que el mensaje corresponda al modelo activo."""

        if not isinstance(payload, dict) or not es_texto(payload.get("id_mensaje")):
            self._publish_error(codigo, "id_mensaje debe ser un texto no vacío.", payload)
            return False
        if self.engine is None:
            self._publish_error(codigo, "No hay un modelo cargado en la Pico.", payload)
            return False
        version = payload.get("version")
        if (
            payload.get("modelo_id") != self.modelo_id
            or isinstance(version, bool)
            or version != self.version
        ):
            self._publish_error(
                codigo,
                "El mensaje corresponde a {} v{}, pero el modelo activo es {} v{}.".format(
                    payload.get("modelo_id"),
                    payload.get("version"),
                    self.modelo_id,
                    self.version,
                ),
                payload,
            )
            return False
        return True

    def _handle_command(self, payload):
        accion = payload.get("accion") if isinstance(payload, dict) else None
        if accion not in ACCIONES_SIMULACION:
            self._publish_error(
                COMANDO_RECHAZADO,
                "accion debe ser iniciar, detener, reiniciar, paso o liberar.",
                payload,
            )
            return
        if accion == "liberar":
            if not es_texto(payload.get("id_mensaje")):
                self._publish_error(COMANDO_RECHAZADO, "id_mensaje debe ser un texto no vacío.", payload)
                return
            self.engine = None
            self.modelo_id = None
            self.version = None
            self.secuencia = 0
            self.estado = SIN_MODELO
            self._next_auto_step = None
            self._dedup_order = []
            self._dedup_responses = {}
            if gc is not None:
                gc.collect()
            return
        if not self._check_active_model(payload, COMANDO_RECHAZADO):
            return

        id_mensaje = payload["id_mensaje"]
        if accion == "paso":
            self.engine.step()
            if self.estado != EJECUTANDO:
                self.estado = PAUSADA
        elif accion == "reiniciar":
            self.engine.reset()
            self.estado = LISTA
            self._next_auto_step = None
        elif accion == "iniciar":
            self.estado = EJECUTANDO
            self._next_auto_step = self.scheduler.clock.add_ms(
                self.scheduler.clock.now_ms(), self.step_interval_ms
            )
        else:
            self.estado = DETENIDA
            self._next_auto_step = None
        # ``reiniciar`` también incrementa la secuencia: la web descarta
        # cualquier instantánea con secuencia menor o igual a la última.
        self._publish_snapshot(id_mensaje)

    def _handle_input(self, payload):
        if not self._check_active_model(payload, ENTRADA_HILES_RECHAZADA):
            return
        try:
            self.engine.set_input(payload.get("servicio_id"), payload.get("valor"))
        except InputError as error:
            self._publish_error(error.codigo, error.mensaje, payload)

    # ------------------------------------------------------------------
    # Publicaciones.
    # ------------------------------------------------------------------

    def snapshot_message(self, id_mensaje=None):
        mensaje = {
            "modelo_id": self.modelo_id,
            "version": self.version,
            "secuencia": self.secuencia,
            "estado": self.estado,
            "elementos": self.engine.snapshot(),
        }
        if id_mensaje is not None:
            mensaje["id_mensaje"] = id_mensaje
        return mensaje

    def _publish_snapshot(self, id_mensaje=None, increment=True):
        if increment:
            self.secuencia += 1
        self._emit(SIMULACION_ESTADO, self.snapshot_message(id_mensaje))

    def _publish_error(self, codigo, mensaje, payload=None):
        error = {"codigo": codigo, "mensaje": mensaje}
        if isinstance(payload, dict) and es_texto(payload.get("id_mensaje")):
            error["id_mensaje"] = payload["id_mensaje"]
        self._emit(ERROR, error)

    def _emit(self, topic, payload):
        if self._capturing_id is not None:
            self._captured_responses.append((topic, payload))
        self.node.publish(topic, payload)

    def _remember_response(self, message_id, responses):
        if message_id in self._dedup_responses:
            self._dedup_order.remove(message_id)
        elif len(self._dedup_order) >= self.dedup_size:
            oldest = self._dedup_order.pop(0)
            self._dedup_responses.pop(oldest, None)
        self._dedup_order.append(message_id)
        self._dedup_responses[message_id] = list(responses)

    def stats(self):
        datos = super().stats()
        datos["estado"] = self.estado
        datos["secuencia"] = self.secuencia
        datos["pendientes"] = len(self._cola)
        datos["descartados"] = self.dropped_count
        datos["deduplicados"] = len(self._dedup_order)
        return datos
