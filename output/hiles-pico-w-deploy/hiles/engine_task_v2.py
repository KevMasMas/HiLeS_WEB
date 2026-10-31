"""Tarea del motor que acepta IR v1 e IR v2 sobre el ``EngineTask`` existente.

Hereda sin cambios la cola acotada, la deduplicación de ``id_mensaje``, los
comandos ``paso``/``reiniciar``/``iniciar``/``detener`` y las publicaciones de
``EngineTask``. Solo cambia la carga:

- ``ir_version: 1`` conserva ``HilesEngine`` y su semántica IR v1.
- ``ir_version: 2`` construye ``HilesEngineV2``; todos los Functional Blocks
  Python se compilan antes de sustituir el modelo activo.

El motor v2 mide el avance de cada paso con ``scheduler.clock``. Los retardos
son fechas límite: ninguna actualización espera con ``sleep``.
"""

from .engine import HilesEngine, InputError
from .engine_task import LISTA, SIN_MODELO, EngineTask
from .engine_v2 import HilesEngineV2
from .model import IrError, es_entero, es_texto
from .model_v2 import IR_VERSION_V2, IR_VERSIONES_SOPORTADAS, validate_load_message_v2
from .python_executor import PythonExecutorError

try:
    import gc
except ImportError:  # pragma: no cover
    gc = None

try:
    from ..pubsub.topics import MODELO_CONFIRMACION
except ImportError:  # Permite cargar el módulo directamente en MicroPython.
    from pubsub.topics import MODELO_CONFIRMACION

# Topic exclusivo de la cola interna: nunca llega desde MQTT.
ENTRADA_LOCAL = "interno/entrada_local"


class EngineTaskV2(EngineTask):
    """``EngineTask`` con carga IR v2 y entradas locales de dispositivos."""

    def __init__(self, scheduler, node, **opciones):
        self.ir_version = None
        self.local_inputs_applied = 0
        self.local_inputs_ignored = 0
        super().__init__(scheduler, node, **opciones)

    # ------------------------------------------------------------------
    # Carga de modelo.
    # ------------------------------------------------------------------

    def _handle_load(self, payload):
        try:
            modelo_id, version, ir_version, modelo = validate_load_message_v2(payload)
            if ir_version == 1:
                engine = HilesEngine(modelo)
            else:
                # Compila todos los bloques Python en una instancia temporal.
                engine = HilesEngineV2(modelo, time_source=self.scheduler.clock)
        except IrError as error:
            self._reject_load(payload, error.codigo, error.mensaje)
            return
        except PythonExecutorError as error:
            self._reject_load(
                payload,
                error.codigo,
                "Bloque funcional '{}': {}".format(error.element_id, error.mensaje),
            )
            return

        # Solo ahora se sustituye el modelo: el anterior y todos sus eventos,
        # colas y temporizadores pendientes quedan descartados.
        self.engine = engine
        self.ir_version = ir_version
        self.modelo_id = modelo_id
        self.version = version
        self.secuencia = 0
        self.estado = LISTA
        self._next_auto_step = None
        self._dedup_order = []
        self._dedup_responses = {}
        self._emit(
            MODELO_CONFIRMACION,
            {
                "modelo_id": modelo_id,
                "version": version,
                "ir_version": ir_version,
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
            self._publish_error(codigo, mensaje, payload)
            return
        ir_version = payload.get("ir_version")
        if isinstance(ir_version, bool) or ir_version not in IR_VERSIONES_SOPORTADAS:
            # El cliente web solo acepta confirmaciones con una versión soportada.
            ir_version = IR_VERSION_V2
        self._emit(
            MODELO_CONFIRMACION,
            {
                "modelo_id": payload["modelo_id"],
                "version": int(payload["version"]),
                "ir_version": ir_version,
                "aceptado": False,
                "codigo": codigo,
                "error": mensaje,
                "id_mensaje": payload["id_mensaje"],
            },
        )

    def install_compiled_engine(self, engine, modelo_id, version, ir_version=IR_VERSION_V2):
        """Sustituye atómicamente el motor activo por una instancia ya compilada y validada."""

        self.engine = engine
        self.ir_version = ir_version
        self.modelo_id = modelo_id
        self.version = version
        self.secuencia = 0
        self.estado = LISTA
        self._next_auto_step = None
        self._dedup_order = []
        self._dedup_responses = {}
        self._cola = []

    def clear_active_engine(self):
        """Libera el motor activo y su estado en memoria (RAM de la Pico W)."""

        self.engine = None
        self.ir_version = None
        self.modelo_id = None
        self.version = None
        self.secuencia = 0
        self.estado = SIN_MODELO
        self._next_auto_step = None
        self._dedup_order = []
        self._dedup_responses = {}
        self._cola = []
        if gc is not None:
            gc.collect()

    # ------------------------------------------------------------------
    # Entradas locales de dispositivos (sensores y controladores).
    # ------------------------------------------------------------------

    def submit_local_input(self, servicio_id, valor):
        """Encola una muestra producida dentro de la Pico.

        No usa MQTT ni ``id_mensaje``: el valor se aplica al modelo activo en
        una ``update()`` posterior. Retorna ``False`` si la cola está llena.
        """

        if len(self._cola) >= self.queue_size:
            self.dropped_count += 1
            return False
        self._cola.append((ENTRADA_LOCAL, {"servicio_id": servicio_id, "valor": valor}))
        return True

    def _dispatch(self, topic, payload):
        if topic == ENTRADA_LOCAL:
            self._apply_local_input(payload)
            return
        EngineTask._dispatch(self, topic, payload)

    def _apply_local_input(self, payload):
        if self.engine is None or self.engine.element(payload["servicio_id"]) is None:
            # El modelo activo no tiene ese Service: el dispositivo sigue funcionando.
            self.local_inputs_ignored += 1
            return
        try:
            self.engine.set_input(payload["servicio_id"], payload["valor"])
            self.local_inputs_applied += 1
        except InputError:
            self.local_inputs_ignored += 1

    # ------------------------------------------------------------------
    # Observabilidad.
    # ------------------------------------------------------------------

    def stats(self):
        datos = EngineTask.stats(self)
        datos["ir_version"] = self.ir_version
        datos["entradas_locales"] = self.local_inputs_applied
        datos["entradas_locales_ignoradas"] = self.local_inputs_ignored
        if isinstance(self.engine, HilesEngineV2):
            datos["reloj_ms"] = self.engine.reloj_ms
            datos["trabajo_pendiente"] = self.engine.pending_work()
            datos["errores_elementos"] = self.engine.errors()
        return datos
