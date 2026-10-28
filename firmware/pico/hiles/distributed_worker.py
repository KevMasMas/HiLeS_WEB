"""Worker cooperativo de ejecución distribuida HiLeS v3 para MicroPython.

Convierte cada Raspberry Pi Pico W en un ejecutor direccionable (``pico:<deviceId>``)
sin introducir lógica de dominio en el firmware:

- Anuncia presencia, estado, capacidades, versión y memoria libre en
  ``udfjc/hiles/v3/projects/<projectId>/executors/<executorId>/status`` con Last Will
  retenido en ``offline``.
- Se suscribe únicamente al manifiesto del proyecto y a los fragmentos dirigidos
  a su ``executorId``.
- Verifica atómicamente ``protocol_version``, ``project_id``, ``deployment_id``,
  ``epoch``, propiedad (``executor_id == owner_executor_id``), capacidades,
  SHA-256 sobre los bytes canónicos UTF-8 y validez de la IR v2 + bloques Python
  antes de sustituir el modelo activo; cualquier rechazo conserva el fragmento
  anterior y publica ACK negativo.
- Publica y consume canales remotos ``cch``/``dch``/``lch`` aplicando los 7 pasos
  de validación del contrato v3, ventana de deduplicación acotada y outbox con
  reintento idempotente tras reconexión.
- Al reconectar al broker, entra en resincronización (``deploying``) hasta leer
  manifiesto y fragmento retenidos de la época activa antes de aceptar canales.
"""

try:
    import gc
except ImportError:  # pragma: no cover
    gc = None

try:
    import uhashlib as hashlib
except ImportError:  # pragma: no cover
    import hashlib

try:
    import ubinascii as binascii
except ImportError:  # pragma: no cover
    import binascii

try:
    import ujson as json
except ImportError:  # pragma: no cover
    import json

try:
    from ..core.task import Task
    from ..pubsub.topics import (
        PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
        V3_POLICIES,
        build_executor_id,
        v3_ack_topic,
        v3_channel_topic,
        v3_command_topic,
        v3_error_topic,
        v3_executor_status_topic,
        v3_fragment_filter,
        v3_input_topic,
        v3_manifest_topic,
        v3_snapshot_topic,
        validate_segment_v3,
    )
except ImportError:  # pragma: no cover - import directo en MicroPython
    from core.task import Task
    from pubsub.topics import (
        PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
        V3_POLICIES,
        build_executor_id,
        v3_ack_topic,
        v3_channel_topic,
        v3_command_topic,
        v3_error_topic,
        v3_executor_status_topic,
        v3_fragment_filter,
        v3_input_topic,
        v3_manifest_topic,
        v3_snapshot_topic,
        validate_segment_v3,
    )

from .engine import InputError
from .engine_task import DETENIDA, EJECUTANDO, LISTA
from .engine_v2 import HilesEngineV2
from .model import IrError, es_entero, es_texto
from .model_v2 import IR_VERSION_V2, MAX_ELEMENTOS, validate_ir_v2
from .python_executor import PythonExecutorError
from .runtime_values import RuntimeValueError, clone_runtime_value, validate_runtime_value

DEFAULT_MAX_FRAGMENT_BYTES = 30000
DEFAULT_STATUS_PERIOD_MS = 5000
DEFAULT_OUTBOX_CAPACITY = 32
DEFAULT_DEDUP_CAPACITY = 64
DEFAULT_MAX_PENDING_FRAGMENTS = 4
DEFAULT_MAX_EVENTS_PER_UPDATE = 4
DEFAULT_MAX_FLUSH_PER_UPDATE = 4
FIRMWARE_WORKER_VERSION = "3.0.0"


def _json_quote_str(text):
    """Codifica un ``str`` como literal JSON UTF-8 sin escapar caracteres no-ASCII (paridad con JS ``JSON.stringify``)."""

    try:
        return json.dumps(text, ensure_ascii=False)
    except TypeError:
        return json.dumps(text)


def canonical_json_str(value):
    """Serializa ``value`` con el mismo orden canónico de claves que ``serializarCanonico`` en TS."""

    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return repr(value)
    if isinstance(value, str):
        return _json_quote_str(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_json_str(item) for item in value) + "]"
    if isinstance(value, dict):
        parts = []
        for key in sorted(value.keys()):
            parts.append("{}:{}".format(_json_quote_str(str(key)), canonical_json_str(value[key])))
        return "{" + ",".join(parts) + "}"
    raise TypeError("Tipo no serializable en JSON canónico: {}".format(type(value).__name__))


def canonical_json_bytes(value):
    return canonical_json_str(value).encode("utf-8")


def sha256_hex(data):
    """Calcula el digest SHA-256 en hexadecimal minúscula compatible con CPython y MicroPython."""

    if isinstance(data, str):
        raw = data.encode("utf-8")
    elif isinstance(data, (bytes, bytearray)):
        raw = bytes(data)
    else:
        raw = canonical_json_bytes(data)
    digest_obj = hashlib.sha256(raw)
    hexdigest = getattr(digest_obj, "hexdigest", None)
    if callable(hexdigest):
        return hexdigest().lower()
    return binascii.hexlify(digest_obj.digest()).decode("ascii").lower()


class DistributedWorker(Task):
    """Ejecutor distribuido v3 acoplado por inyección al transporte y a ``EngineTaskV2``."""

    def __init__(
        self,
        scheduler,
        transport,
        engine_task,
        project_id="default",
        executor_id=None,
        device_id="pico01",
        tipo="pico",
        max_fragment_bytes=DEFAULT_MAX_FRAGMENT_BYTES,
        max_elementos=MAX_ELEMENTOS,
        lenguajes=("python", "expresion"),
        ir_versions=(IR_VERSION_V2,),
        status_period_ms=DEFAULT_STATUS_PERIOD_MS,
        period_ms=20,
        priority=1,
        queue_size=32,
        outbox_capacity=DEFAULT_OUTBOX_CAPACITY,
        dedup_capacity=DEFAULT_DEDUP_CAPACITY,
        max_events_per_update=DEFAULT_MAX_EVENTS_PER_UPDATE,
        max_flush_per_update=DEFAULT_MAX_FLUSH_PER_UPDATE,
        memory_reader=None,
        name="worker_v3",
        max_update_ms=200,
    ):
        if transport is None:
            raise ValueError("DistributedWorker necesita un transporte con API absoluta")
        if engine_task is None:
            raise ValueError("DistributedWorker necesita un EngineTaskV2")

        self.transport = transport
        self.engine_task = engine_task
        self.project_id = validate_segment_v3(project_id, "projectId")
        self.tipo = tipo if tipo in ("pico", "browser") else "pico"
        self.executor_id = (
            validate_segment_v3(executor_id, "executorId")
            if executor_id is not None
            else build_executor_id(device_id, self.tipo)
        )
        self.max_fragment_bytes = int(max_fragment_bytes)
        self.max_elementos = int(max_elementos)
        self.lenguajes = list(lenguajes)
        self.ir_versions = [int(v) for v in ir_versions]
        self.status_period_ms = int(status_period_ms)
        self.queue_size = int(queue_size)
        self.outbox_capacity = int(outbox_capacity)
        self.dedup_capacity = int(dedup_capacity)
        self.max_events_per_update = int(max_events_per_update)
        self.max_flush_per_update = int(max_flush_per_update)
        self.memory_reader = memory_reader

        self.estado = "offline"
        self.active_deployment_id = None
        self.active_epoch = None
        self.active_fragment_id = None
        self.active_fragment_hash = None
        self.active_fragment = None
        self.active_manifest = None
        self.owned_element_ids = ()
        self.inbound_routes = {}
        self.outbound_routes = {}

        self._pending_manifest = None
        self._pending_fragments = {}
        self._pending_fragments_order = []
        self._resyncing = False
        self._resync_manifest_seen = False
        self._resync_fragment_seen = False

        self._event_queue = []
        self._outbox = []
        self._outbound_seq = {}
        self._inbound_last_seq = {}
        self._dedup_order = []
        self._dedup_set = set()
        self._snapshot_seq = 0
        self._last_engine_seq_published = -1
        self._next_status_at = None
        self._static_handles = []
        self._dynamic_handles = []

        self.fragments_accepted = 0
        self.fragments_rejected = 0
        self.channels_published = 0
        self.channels_accepted = 0
        self.channels_discarded = 0
        self.outbox_dropped = 0

        super().__init__(
            scheduler,
            period_ms=period_ms,
            priority=priority,
            name=name,
            max_update_ms=max_update_ms,
        )

        self._configure_transport()

    # ------------------------------------------------------------------
    # Configuración de transporte y suscripciones.
    # ------------------------------------------------------------------

    def _configure_transport(self):
        status_topic = v3_executor_status_topic(self.project_id, self.executor_id)
        will_payload = self._build_status_payload(override_state="offline")
        self.transport.set_last_will(
            status_topic,
            will_payload,
            qos=V3_POLICIES["status"]["qos"],
            retain=V3_POLICIES["status"]["retain"],
        )
        self.transport.on_connection_change(self._on_transport_connection)
        self._static_handles.append(
            self.transport.subscribe_absolute(
                v3_manifest_topic(self.project_id),
                self._enqueue_manifest,
                qos=V3_POLICIES["manifest"]["qos"],
                raw=False,
            )
        )
        self._static_handles.append(
            self.transport.subscribe_absolute(
                v3_fragment_filter(self.project_id, self.executor_id),
                self._enqueue_fragment,
                qos=V3_POLICIES["fragment"]["qos"],
                raw=True,
            )
        )
        if getattr(self.transport, "connected", False):
            self._on_transport_connection(True)

    def close(self):
        while self._dynamic_handles:
            self.transport.unsubscribe_absolute(self._dynamic_handles.pop())
        while self._static_handles:
            self.transport.unsubscribe_absolute(self._static_handles.pop())

    def _enqueue_event(self, kind, topic, payload, raw=None):
        if len(self._event_queue) >= self.queue_size:
            self._publish_error(
                "WORKER_COLA_LLENA",
                "La cola del worker distribuido está llena; se descartó evento {}.".format(kind),
                stage=kind,
            )
            return
        self._event_queue.append((kind, topic, payload, raw))

    def _enqueue_manifest(self, topic, payload):
        self._enqueue_event("manifest", topic, payload, None)

    def _enqueue_fragment(self, topic, payload, raw):
        self._enqueue_event("fragment", topic, payload, raw)

    def _enqueue_channel(self, topic, payload):
        self._enqueue_event("channel", topic, payload, None)

    def _enqueue_command(self, topic, payload):
        self._enqueue_event("command", topic, payload, None)

    def _enqueue_input(self, topic, payload):
        self._enqueue_event("input", topic, payload, None)

    def _on_transport_connection(self, connected):
        if not connected:
            if self.active_fragment is not None:
                self.estado = "degraded"
            else:
                self.estado = "offline"
            return

        if self.active_fragment is not None:
            self._resyncing = True
            self._resync_manifest_seen = False
            self._resync_fragment_seen = False
            self.estado = "deploying"
        else:
            self._resyncing = False
            self.estado = "online"
        self.publish_status()
        self._schedule_next_status()

    # ------------------------------------------------------------------
    # Ciclo cooperativo (update).
    # ------------------------------------------------------------------

    def update(self):
        processed = 0
        while self._event_queue and processed < self.max_events_per_update:
            kind, topic, payload, raw = self._event_queue.pop(0)
            processed += 1
            if kind == "manifest":
                self._handle_manifest(topic, payload)
            elif kind == "fragment":
                self._handle_fragment(topic, payload, raw)
            elif kind == "channel":
                self._handle_channel(topic, payload)
            elif kind == "command":
                self._handle_command(topic, payload)
            elif kind == "input":
                self._handle_input(topic, payload)

        self._flush_outbox()
        self._sync_snapshot_from_engine()

        if getattr(self.transport, "connected", False) and self._status_due():
            self.publish_status()
            self._schedule_next_status()

    def _schedule_next_status(self):
        if self.status_period_ms > 0:
            now = self.scheduler.clock.now_ms()
            self._next_status_at = self.scheduler.clock.add_ms(now, self.status_period_ms)
        else:
            self._next_status_at = None

    def _status_due(self):
        if self._next_status_at is None:
            return False
        now = self.scheduler.clock.now_ms()
        return self.scheduler.clock.diff_ms(now, self._next_status_at) >= 0

    # ------------------------------------------------------------------
    # Presencia y capacidades.
    # ------------------------------------------------------------------

    def _free_memory_bytes(self):
        if callable(self.memory_reader):
            try:
                value = self.memory_reader()
                if es_entero(value) and value >= 0:
                    return int(value)
            except Exception:
                pass
        if gc is not None and callable(getattr(gc, "mem_free", None)):
            try:
                return int(gc.mem_free())
            except Exception:
                return None
        return None

    def capabilities(self):
        caps = {
            "ir_versions": list(self.ir_versions),
            "lenguajes": list(self.lenguajes),
            "max_fragment_bytes": self.max_fragment_bytes,
            "max_elementos": self.max_elementos,
        }
        mem_free = self._free_memory_bytes()
        if mem_free is not None:
            caps["memoria_libre_bytes"] = mem_free
        return caps

    def _build_status_payload(self, override_state=None):
        state = override_state if override_state is not None else self.estado
        payload = {
            "protocol_version": PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
            "project_id": self.project_id,
            "executor_id": self.executor_id,
            "tipo": self.tipo,
            "estado": state,
            "version": FIRMWARE_WORKER_VERSION,
            "capacidades": self.capabilities(),
            "last_seen_ms": self.scheduler.clock.now_ms(),
        }
        if self.active_deployment_id is not None:
            payload["active_deployment_id"] = self.active_deployment_id
        if self.active_epoch is not None:
            payload["active_epoch"] = self.active_epoch
        return payload

    def publish_status(self, override_state=None):
        topic = v3_executor_status_topic(self.project_id, self.executor_id)
        return self.transport.publish_absolute(
            topic,
            self._build_status_payload(override_state=override_state),
            qos=V3_POLICIES["status"]["qos"],
            retain=V3_POLICIES["status"]["retain"],
        )

    # ------------------------------------------------------------------
    # Manifiesto y carga atómica de fragmentos.
    # ------------------------------------------------------------------

    def _handle_manifest(self, _topic, payload):
        if payload is None:
            # Payload retenido vacío: limpieza explícita de manifiesto y liberación de fragmento.
            self._pending_manifest = None
            if self.active_fragment is not None:
                self.unload_fragment()
            return
        if not isinstance(payload, dict):
            return
        if payload.get("protocol_version") != PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION:
            return
        if payload.get("project_id") != self.project_id:
            return
        deployment_id = payload.get("deployment_id")
        epoch = payload.get("epoch")
        if not es_texto(deployment_id) or not es_entero(epoch) or epoch < 1:
            self._publish_error(
                "DISTRIBUCION_IDENTIFICADOR_INVALIDO",
                "Manifiesto con deployment_id o epoch inválido.",
                deployment_id=deployment_id if es_texto(deployment_id) else None,
                epoch=epoch if es_entero(epoch) else None,
                stage="manifest",
            )
            return

        if self.active_epoch is not None and epoch < self.active_epoch:
            # Época anterior: descartar silenciosamente según contrato.
            return

        if (
            self._resyncing
            and deployment_id == self.active_deployment_id
            and epoch == self.active_epoch
        ):
            self._resync_manifest_seen = True
            self.active_manifest = payload
            self._complete_resync_if_ready()
            return

        # Si el nuevo manifiesto de una época mayor ya no incluye a este ejecutor,
        # liberamos el fragmento anterior para no seguir ejecutando nodos obsoletos.
        if (
            self.active_fragment is not None
            and (self.active_epoch is None or epoch > self.active_epoch)
            and self._find_manifest_summary(payload, self.executor_id) is None
        ):
            self._pending_manifest = payload
            self.unload_fragment()
            return

        self._pending_manifest = payload
        key = (deployment_id, epoch)
        if key in self._pending_fragments:
            frag_topic, frag_payload, frag_raw = self._pop_pending_fragment(key)
            self._apply_fragment_with_manifest(payload, frag_topic, frag_payload, frag_raw)

    def _handle_fragment(self, topic, payload, raw):
        if payload is None or (raw is not None and len(raw) == 0):
            # Limpieza de fragmento retenido: si corresponde al despliegue activo, libera el motor.
            if self.active_deployment_id is not None and "/deployments/{}/fragments/{}".format(
                self.active_deployment_id, self.executor_id
            ) in str(topic):
                self.unload_fragment()
            return
        if not isinstance(payload, dict):
            return
        if payload.get("protocol_version") != PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION:
            return
        if payload.get("project_id") != self.project_id:
            return

        deployment_id = payload.get("deployment_id")
        epoch = payload.get("epoch")
        if not es_texto(deployment_id) or not es_entero(epoch) or epoch < 1:
            return

        if self.active_epoch is not None and epoch < self.active_epoch:
            return

        # Si estamos resincronizando el mismo despliegue/época tras reconectar:
        if (
            self._resyncing
            and deployment_id == self.active_deployment_id
            and epoch == self.active_epoch
        ):
            computed_hash = self._compute_fragment_hash(payload, raw)
            if computed_hash == self.active_fragment_hash:
                self._resync_fragment_seen = True
                self._complete_resync_if_ready()
                return

        manifest = self._matching_manifest_for(deployment_id, epoch)
        if manifest is None:
            # Puede llegar el fragmento retenido antes que el manifiesto retenido.
            self._store_pending_fragment((deployment_id, epoch), (topic, payload, raw))
            return

        self._apply_fragment_with_manifest(manifest, topic, payload, raw)

    def _store_pending_fragment(self, key, item):
        if key in self._pending_fragments_order:
            self._pending_fragments_order.remove(key)
        elif len(self._pending_fragments_order) >= DEFAULT_MAX_PENDING_FRAGMENTS:
            oldest = self._pending_fragments_order.pop(0)
            self._pending_fragments.pop(oldest, None)
        self._pending_fragments_order.append(key)
        self._pending_fragments[key] = item

    def _pop_pending_fragment(self, key):
        if key in self._pending_fragments_order:
            self._pending_fragments_order.remove(key)
        return self._pending_fragments.pop(key)

    def _clear_pending_fragments(self):
        self._pending_fragments.clear()
        self._pending_fragments_order.clear()

    def unload_fragment(self):
        """Libera el fragmento activo, limpia suscripciones dinámicas y devuelve el worker a ``online``/``offline``."""

        had_deployment = self.active_deployment_id is not None
        while self._dynamic_handles:
            self.transport.unsubscribe_absolute(self._dynamic_handles.pop())

        self.active_manifest = None
        self.active_fragment = None
        self.active_deployment_id = None
        self.active_epoch = None
        self.active_fragment_id = None
        self.active_fragment_hash = None
        self.owned_element_ids = ()
        self.inbound_routes = {}
        self.outbound_routes = {}
        self._outbound_seq = {}
        self._inbound_last_seq = {}
        self._dedup_order = []
        self._dedup_set = set()
        self._outbox = []
        self._snapshot_seq = 0
        self._last_engine_seq_published = -1
        self._resyncing = False
        self._resync_manifest_seen = False
        self._resync_fragment_seen = False
        self._clear_pending_fragments()

        clear_engine = getattr(self.engine_task, "clear_active_engine", None)
        if callable(clear_engine):
            clear_engine()

        if had_deployment and getattr(self.transport, "connected", False):
            self.transport.request_clean_reconnect()

        self.estado = "online" if getattr(self.transport, "connected", False) else "offline"
        self.publish_status()

    def _matching_manifest_for(self, deployment_id, epoch):
        for candidate in (self._pending_manifest, self.active_manifest):
            if (
                isinstance(candidate, dict)
                and candidate.get("deployment_id") == deployment_id
                and candidate.get("epoch") == epoch
            ):
                return candidate
        return None

    def _complete_resync_if_ready(self):
        if not self._resyncing:
            return
        if not (self._resync_manifest_seen and self._resync_fragment_seen):
            return
        self._resyncing = False
        self._publish_ack(
            self.active_deployment_id,
            self.active_epoch,
            self.active_fragment_id,
            True,
            self.active_fragment_hash,
        )
        if self.engine_task.estado == EJECUTANDO:
            self.estado = "running"
        else:
            self.estado = "ready"
        self.publish_status()

    @staticmethod
    def _compute_fragment_hash(payload, raw):
        if isinstance(raw, (bytes, bytearray)) and len(raw) > 0:
            raw_hash = sha256_hex(raw)
            return raw_hash
        return sha256_hex(payload)

    def _find_manifest_summary(self, manifest, executor_id):
        fragments = manifest.get("fragments")
        if not isinstance(fragments, list):
            return None
        for item in fragments:
            if isinstance(item, dict) and item.get("executor_id") == executor_id:
                return item
        return None

    def _apply_fragment_with_manifest(self, manifest, _topic, payload, raw):
        deployment_id = payload.get("deployment_id")
        epoch = payload.get("epoch")
        fragment_id = payload.get("fragment_id") or "{}:{}".format(deployment_id, self.executor_id)
        computed_hash = self._compute_fragment_hash(payload, raw)

        # Si el mismo fragmento de la misma época ya está cargado y su hash coincide,
        # el redespliegue o reconexión es idempotente: re-emite ACK sin reiniciar estado.
        if (
            deployment_id == self.active_deployment_id
            and epoch == self.active_epoch
            and computed_hash == self.active_fragment_hash
            and self.active_fragment is not None
        ):
            self._resyncing = False
            self._publish_ack(deployment_id, epoch, fragment_id, True, computed_hash)
            self.estado = "running" if self.engine_task.estado == EJECUTANDO else "ready"
            self.publish_status()
            return

        # 1. Propiedad única del fragmento.
        if payload.get("executor_id") != self.executor_id or payload.get("owner_executor_id") != self.executor_id:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_ASIGNACION_INVALIDA",
                "El fragmento está dirigido a {} (propietario {}), no a {}.".format(
                    payload.get("executor_id"),
                    payload.get("owner_executor_id"),
                    self.executor_id,
                ),
            )
            return

        # 2. Resumen y hash en manifiesto.
        summary = self._find_manifest_summary(manifest, self.executor_id)
        if summary is None:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_DESTINO_INEXISTENTE",
                "El manifiesto no declara un fragmento para {}.".format(self.executor_id),
            )
            return

        expected_hash = summary.get("hash")
        if not es_texto(expected_hash) or expected_hash.lower() != computed_hash.lower():
            # Si el payload no venía en forma canónica exacta pero su representación
            # canónica sí coincide con expected_hash, verificamos ambos.
            canonical_hash = sha256_hex(payload)
            if not es_texto(expected_hash) or expected_hash.lower() != canonical_hash.lower():
                self._reject_fragment(
                    deployment_id,
                    epoch,
                    fragment_id,
                    computed_hash,
                    "DISTRIBUCION_MODELO_INVALIDO",
                    "Hash SHA-256 del fragmento ({}) no coincide con el manifiesto ({}).".format(
                        computed_hash, expected_hash
                    ),
                )
                return
            computed_hash = canonical_hash

        # 3. Capacidades de tamaño, versión IR, elementos y lenguaje.
        raw_size = len(raw) if isinstance(raw, (bytes, bytearray)) and len(raw) > 0 else len(canonical_json_bytes(payload))
        if raw_size > self.max_fragment_bytes:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_CAPACIDAD_EXCEDIDA",
                "El fragmento ocupa {} bytes y supera el límite {} de {}.".format(
                    raw_size, self.max_fragment_bytes, self.executor_id
                ),
            )
            return

        modelo_raw = payload.get("modelo")
        if not isinstance(modelo_raw, dict):
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_MODELO_INVALIDO",
                "El fragmento no incluye un objeto modelo IR v2.",
            )
            return

        ir_version = modelo_raw.get("ir_version", IR_VERSION_V2)
        if ir_version not in self.ir_versions:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_CAPACIDAD_EXCEDIDA",
                "El ejecutor {} no soporta ir_version {}.".format(self.executor_id, ir_version),
            )
            return

        elementos_raw = modelo_raw.get("elementos")
        if isinstance(elementos_raw, list) and len(elementos_raw) > self.max_elementos:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_CAPACIDAD_EXCEDIDA",
                "El fragmento contiene {} elementos y supera el máximo {}.".format(
                    len(elementos_raw), self.max_elementos
                ),
            )
            return

        if isinstance(elementos_raw, list):
            for el in elementos_raw:
                if isinstance(el, dict) and el.get("tipo") == "functional_block":
                    lenguaje = el.get("lenguaje")
                    if lenguaje not in self.lenguajes:
                        self._reject_fragment(
                            deployment_id,
                            epoch,
                            fragment_id,
                            computed_hash,
                            "DISTRIBUCION_CAPACIDAD_EXCEDIDA",
                            "El ejecutor {} no soporta el lenguaje {} del bloque {}.".format(
                                self.executor_id, lenguaje, el.get("id")
                            ),
                            elemento_id=el.get("id"),
                        )
                        return

        # 4. Validación de propietarios en manifiesto.
        owners = manifest.get("owners") if isinstance(manifest.get("owners"), dict) else {}
        if isinstance(elementos_raw, list):
            for el in elementos_raw:
                el_id = el.get("id") if isinstance(el, dict) else None
                if el_id and owners.get(el_id) != self.executor_id:
                    self._reject_fragment(
                        deployment_id,
                        epoch,
                        fragment_id,
                        computed_hash,
                        "DISTRIBUCION_ASIGNACION_INVALIDA",
                        "El elemento {} no pertenece a {} según el manifiesto.".format(
                            el_id, self.executor_id
                        ),
                        elemento_id=el_id,
                    )
                    return

        inbound_list = payload.get("inbound_routes")
        outbound_list = payload.get("outbound_routes")
        if not isinstance(inbound_list, list) or not isinstance(outbound_list, list):
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_MODELO_INVALIDO",
                "inbound_routes y outbound_routes deben ser listas.",
            )
            return

        # 5. Validación IR v2 y compilación atómica del motor + rutas remotas.
        try:
            if gc is not None:
                gc.collect()
            modelo_validado = validate_ir_v2(modelo_raw)
            engine = HilesEngineV2(
                modelo_validado,
                time_source=self.scheduler.clock,
                inbound_routes=inbound_list,
                outbound_routes=outbound_list,
                remote_sink=self._on_engine_remote_output,
            )
        except IrError as error:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_MODELO_INVALIDO",
                "{}: {}".format(error.codigo, error.mensaje),
                elemento_id=getattr(error, "elemento_id", None),
                conexion_id=getattr(error, "conexion_id", None),
            )
            return
        except PythonExecutorError as error:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_MODELO_INVALIDO",
                "Bloque '{}': {}".format(error.element_id, error.mensaje),
                elemento_id=error.element_id,
            )
            return
        except Exception as error:
            self._reject_fragment(
                deployment_id,
                epoch,
                fragment_id,
                computed_hash,
                "DISTRIBUCION_MODELO_INVALIDO",
                "Error construyendo motor del fragmento: {}".format(error),
            )
            return

        # 6. Sustitución atómica del fragmento y época activos.
        previous_deployment_id = self.active_deployment_id
        self.estado = "deploying"
        self.active_manifest = manifest
        self.active_fragment = payload
        self.active_deployment_id = deployment_id
        self.active_epoch = int(epoch)
        self.active_fragment_id = fragment_id
        self.active_fragment_hash = computed_hash
        self.owned_element_ids = tuple(el["id"] for el in modelo_validado["elementos"])
        self.inbound_routes = {r["connection_id"]: r for r in inbound_list}
        self.outbound_routes = {r["connection_id"]: r for r in outbound_list}

        # Reiniciar secuencias, deduplicación, pendientes y outbox para la nueva época.
        self._outbound_seq = {}
        self._inbound_last_seq = {}
        self._dedup_order = []
        self._dedup_set = set()
        self._outbox = []
        self._snapshot_seq = 0
        self._resyncing = False
        self._clear_pending_fragments()

        modelo_id = modelo_raw.get("modelo_id") or manifest.get("model_id") or deployment_id
        version = int(modelo_raw.get("version") or manifest.get("model_version") or 1)
        self.engine_task.install_compiled_engine(engine, modelo_id, version, ir_version=IR_VERSION_V2)
        self._last_engine_seq_published = -1
        if gc is not None:
            gc.collect()

        self._rebind_deployment_subscriptions(
            need_clean_reconnect=(
                previous_deployment_id is not None and previous_deployment_id != deployment_id
            )
        )

        self.fragments_accepted += 1
        self.estado = "ready"
        self._publish_ack(deployment_id, epoch, fragment_id, True, computed_hash)
        self.publish_status()
        self.publish_partial_snapshot()

    def _rebind_deployment_subscriptions(self, need_clean_reconnect=False):
        while self._dynamic_handles:
            self.transport.unsubscribe_absolute(self._dynamic_handles.pop())

        for conn_id in sorted(self.inbound_routes.keys()):
            topic = v3_channel_topic(self.project_id, self.active_deployment_id, conn_id)
            self._dynamic_handles.append(
                self.transport.subscribe_absolute(
                    topic,
                    self._enqueue_channel,
                    qos=V3_POLICIES["channel"]["qos"],
                    raw=False,
                )
            )
        self._dynamic_handles.append(
            self.transport.subscribe_absolute(
                v3_command_topic(self.project_id, self.active_deployment_id),
                self._enqueue_command,
                qos=V3_POLICIES["command"]["qos"],
                raw=False,
            )
        )
        self._dynamic_handles.append(
            self.transport.subscribe_absolute(
                v3_input_topic(self.project_id, self.active_deployment_id),
                self._enqueue_input,
                qos=V3_POLICIES["input"]["qos"],
                raw=False,
            )
        )

        if need_clean_reconnect:
            # ``umqtt.simple`` no implementa UNSUBSCRIBE. Reconectar limpia las
            # suscripciones del broker para el deployment_id anterior y re-suscribe
            # únicamente las actuales en el siguiente ciclo cooperativo.
            self.transport.request_clean_reconnect()
            # Ya tenemos el nuevo fragmento validado localmente; al reconectar no
            # bloqueamos por resync de un despliegue previo.
            self._resyncing = False

    def _reject_fragment(
        self,
        deployment_id,
        epoch,
        fragment_id,
        fragment_hash,
        codigo,
        mensaje,
        elemento_id=None,
        conexion_id=None,
    ):
        self.fragments_rejected += 1
        err = {
            "codigo": codigo,
            "mensaje": mensaje,
            "executor_id": self.executor_id,
        }
        if elemento_id is not None:
            err["elemento_id"] = elemento_id
        if conexion_id is not None:
            err["conexion_id"] = conexion_id
        self._publish_ack(deployment_id, epoch, fragment_id, False, fragment_hash or "", error=err)
        self._publish_error(
            codigo,
            mensaje,
            deployment_id=deployment_id,
            epoch=epoch,
            fragment_id=fragment_id,
            connection_id=conexion_id,
            element_id=elemento_id,
            stage="fragment",
        )

    def _publish_ack(self, deployment_id, epoch, fragment_id, accepted, fragment_hash, error=None):
        if not es_texto(deployment_id) or not es_entero(epoch):
            return False
        ack = {
            "protocol_version": PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
            "project_id": self.project_id,
            "deployment_id": deployment_id,
            "epoch": int(epoch),
            "executor_id": self.executor_id,
            "fragment_id": fragment_id,
            "accepted": bool(accepted),
            "fragment_hash": fragment_hash,
        }
        if error is not None:
            ack["error"] = error
        topic = v3_ack_topic(self.project_id, deployment_id, self.executor_id)
        return self.transport.publish_absolute(
            topic,
            ack,
            qos=V3_POLICIES["ack"]["qos"],
            retain=V3_POLICIES["ack"]["retain"],
        )

    # ------------------------------------------------------------------
    # Canales distribuidos (emisión con outbox + recepción con 7 pasos).
    # ------------------------------------------------------------------

    def _on_engine_remote_output(self, connection_id, value):
        if self.active_deployment_id is None or self.active_epoch is None:
            return
        route = self.outbound_routes.get(connection_id)
        if route is None:
            return
        seq = self._outbound_seq.get(connection_id, 0) + 1
        self._outbound_seq[connection_id] = seq
        message_id = "{}:{}:{}".format(self.executor_id, connection_id, seq)
        payload = {
            "protocol_version": PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
            "project_id": self.project_id,
            "deployment_id": self.active_deployment_id,
            "epoch": self.active_epoch,
            "message_id": message_id,
            "connection_id": connection_id,
            "owner_executor_id": self.executor_id,
            "sequence": seq,
            "value": clone_runtime_value(value),
        }
        topic = route.get("topic") or v3_channel_topic(
            self.project_id, self.active_deployment_id, connection_id
        )
        if len(self._outbox) >= self.outbox_capacity:
            self._outbox.pop(0)
            self.outbox_dropped += 1
        self._outbox.append((topic, payload))

    def _flush_outbox(self):
        if not self._outbox or not getattr(self.transport, "connected", False):
            return
        sent = 0
        while self._outbox and sent < self.max_flush_per_update:
            topic, payload = self._outbox[0]
            ok = self.transport.publish_absolute(
                topic,
                payload,
                qos=V3_POLICIES["channel"]["qos"],
                retain=V3_POLICIES["channel"]["retain"],
            )
            if not ok:
                break
            self._outbox.pop(0)
            self.channels_published += 1
            sent += 1

    def _handle_channel(self, _topic, payload):
        if payload is None or not isinstance(payload, dict):
            return
        if self._resyncing or self.active_fragment is None:
            self.channels_discarded += 1
            return

        # 1. Protocolo, proyecto y despliegue activos.
        if (
            payload.get("protocol_version") != PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION
            or payload.get("project_id") != self.project_id
            or payload.get("deployment_id") != self.active_deployment_id
        ):
            self.channels_discarded += 1
            return

        # 2. Época exacta.
        if payload.get("epoch") != self.active_epoch:
            self.channels_discarded += 1
            return

        # 3. Conexión declarada en inbound_routes.
        connection_id = payload.get("connection_id")
        if not es_texto(connection_id) or connection_id not in self.inbound_routes:
            self.channels_discarded += 1
            self._publish_error(
                "CANAL_CONEXION_NO_DECLARADA",
                "La conexión {} no pertenece a las inbound_routes de {}.".format(
                    connection_id, self.executor_id
                ),
                connection_id=connection_id if es_texto(connection_id) else None,
                stage="channel",
            )
            return
        route = self.inbound_routes[connection_id]

        # 4. Propietario igual al source_executor_id del manifiesto/ruta.
        owner = payload.get("owner_executor_id")
        if owner != route.get("source_executor_id"):
            self.channels_discarded += 1
            self._publish_error(
                "CANAL_PROPIETARIO_INVALIDO",
                "El emisor {} no es el propietario autorizado ({}) de {}.".format(
                    owner, route.get("source_executor_id"), connection_id
                ),
                connection_id=connection_id,
                stage="channel",
            )
            return

        # 5. Valor compatible con tipo_dato y límites IR v2.
        if "value" not in payload:
            self.channels_discarded += 1
            self._publish_error(
                "VALOR_TIPO_INVALIDO",
                "El mensaje del canal {} no incluye value.".format(connection_id),
                connection_id=connection_id,
                stage="channel",
            )
            return
        try:
            validate_runtime_value(payload["value"], route.get("tipo_dato"), "value")
        except RuntimeValueError as error:
            self.channels_discarded += 1
            self._publish_error(
                error.codigo,
                "Valor inválido en canal {}: {}".format(connection_id, error.mensaje),
                connection_id=connection_id,
                stage="channel",
            )
            return

        # 6 y 7. Deduplicación por message_id y sequence estrictamente creciente.
        message_id = payload.get("message_id")
        sequence = payload.get("sequence")
        if not es_texto(message_id) or not es_entero(sequence) or sequence < 1:
            self.channels_discarded += 1
            return
        if message_id in self._dedup_set:
            self.channels_discarded += 1
            return
        last_seq = self._inbound_last_seq.get(connection_id, 0)
        if sequence <= last_seq:
            self.channels_discarded += 1
            return

        self._inbound_last_seq[connection_id] = int(sequence)
        self._remember_message_id(message_id)

        if self.engine_task.engine is not None:
            try:
                self.engine_task.engine.inject_remote_channel(connection_id, payload["value"])
                self.channels_accepted += 1
            except InputError as error:
                self.channels_discarded += 1
                self._publish_error(
                    error.codigo,
                    error.mensaje,
                    connection_id=connection_id,
                    stage="channel",
                )

    def _remember_message_id(self, message_id):
        self._dedup_set.add(message_id)
        self._dedup_order.append(message_id)
        while len(self._dedup_order) > self.dedup_capacity:
            oldest = self._dedup_order.pop(0)
            self._dedup_set.discard(oldest)

    # ------------------------------------------------------------------
    # Comandos y entradas externas v3.
    # ------------------------------------------------------------------

    def _handle_command(self, _topic, payload):
        if payload is None or not isinstance(payload, dict):
            return
        if self._resyncing or self.active_fragment is None or self.engine_task.engine is None:
            return
        if (
            payload.get("protocol_version") != PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION
            or payload.get("project_id") != self.project_id
            or payload.get("deployment_id") != self.active_deployment_id
            or payload.get("epoch") != self.active_epoch
        ):
            return

        command = payload.get("command")
        if command == "start":
            self.engine_task.estado = EJECUTANDO
            now = self.scheduler.clock.now_ms()
            self.engine_task._next_auto_step = self.scheduler.clock.add_ms(
                now, self.engine_task.step_interval_ms
            )
            self.estado = "running"
            self.publish_status()
            self.publish_partial_snapshot()
        elif command == "stop":
            self.engine_task.estado = DETENIDA
            self.engine_task._next_auto_step = None
            self.estado = "ready"
            self.publish_status()
            self.publish_partial_snapshot()
        elif command == "reset":
            self.engine_task.engine.reset()
            self.engine_task.estado = LISTA
            self.engine_task._next_auto_step = None
            self._outbound_seq = {}
            self._inbound_last_seq = {}
            self._dedup_order = []
            self._dedup_set = set()
            self._outbox = []
            self.estado = "ready"
            self.publish_status()
            self.publish_partial_snapshot()
        elif command == "step":
            self.engine_task.engine.step()
            self._flush_outbox()
            self.publish_partial_snapshot()
        else:
            self._publish_error(
                "COMANDO_RECHAZADO",
                "Comando distribuido no soportado: {}.".format(command),
                stage="command",
            )

    def _handle_input(self, _topic, payload):
        if payload is None or not isinstance(payload, dict):
            return
        if self._resyncing or self.active_fragment is None or self.engine_task.engine is None:
            return
        if (
            payload.get("protocol_version") != PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION
            or payload.get("project_id") != self.project_id
            or payload.get("deployment_id") != self.active_deployment_id
            or payload.get("epoch") != self.active_epoch
        ):
            return

        servicio_id = payload.get("servicio_id")
        if not es_texto(servicio_id) or servicio_id not in self.owned_element_ids:
            # En el tópico compartido de input cada worker ignora Services ajenos.
            return
        try:
            self.engine_task.engine.set_input(servicio_id, payload.get("valor"))
        except InputError as error:
            self._publish_error(
                error.codigo,
                error.mensaje,
                element_id=servicio_id,
                stage="input",
            )

    # ------------------------------------------------------------------
    # Snapshots parciales y errores v3.
    # ------------------------------------------------------------------

    def _sync_snapshot_from_engine(self):
        if (
            self.active_fragment is None
            or self.engine_task.engine is None
            or self.engine_task.secuencia == self._last_engine_seq_published
        ):
            return
        self._last_engine_seq_published = self.engine_task.secuencia
        self._flush_outbox()
        self.publish_partial_snapshot()

    def publish_partial_snapshot(self):
        if self.active_deployment_id is None or self.active_epoch is None or self.engine_task.engine is None:
            return False
        full_elements = self.engine_task.engine.snapshot()
        owned_elements = {
            element_id: full_elements[element_id]
            for element_id in self.owned_element_ids
            if element_id in full_elements
        }
        self._snapshot_seq += 1
        payload = {
            "protocol_version": PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
            "project_id": self.project_id,
            "deployment_id": self.active_deployment_id,
            "epoch": self.active_epoch,
            "executor_id": self.executor_id,
            "sequence": self._snapshot_seq,
            "elements": owned_elements,
        }
        topic = v3_snapshot_topic(self.project_id, self.active_deployment_id, self.executor_id)
        return self.transport.publish_absolute(
            topic,
            payload,
            qos=V3_POLICIES["snapshot"]["qos"],
            retain=V3_POLICIES["snapshot"]["retain"],
        )

    def _publish_error(
        self,
        codigo,
        mensaje,
        deployment_id=None,
        epoch=None,
        fragment_id=None,
        connection_id=None,
        element_id=None,
        stage="runtime",
    ):
        dep_id = deployment_id or self.active_deployment_id
        ep = epoch if epoch is not None else self.active_epoch
        if not es_texto(dep_id):
            return False
        payload = {
            "protocol_version": PROTOCOLO_EJECUCION_DISTRIBUIDA_VERSION,
            "project_id": self.project_id,
            "deployment_id": dep_id,
            "epoch": int(ep) if es_entero(ep) else 0,
            "executor_id": self.executor_id,
            "codigo": codigo,
            "mensaje": mensaje,
            "stage": stage,
        }
        frag_id = fragment_id or self.active_fragment_id
        if frag_id is not None:
            payload["fragment_id"] = frag_id
        if connection_id is not None:
            payload["connection_id"] = connection_id
        if element_id is not None:
            payload["element_id"] = element_id
        topic = v3_error_topic(self.project_id, dep_id)
        return self.transport.publish_absolute(
            topic,
            payload,
            qos=V3_POLICIES["error"]["qos"],
            retain=V3_POLICIES["error"]["retain"],
        )

    def stats(self):
        result = super().stats()
        result.update({
            "executor_id": self.executor_id,
            "project_id": self.project_id,
            "estado": self.estado,
            "active_deployment_id": self.active_deployment_id,
            "active_epoch": self.active_epoch,
            "fragments_accepted": self.fragments_accepted,
            "fragments_rejected": self.fragments_rejected,
            "channels_published": self.channels_published,
            "channels_accepted": self.channels_accepted,
            "channels_discarded": self.channels_discarded,
            "outbox_pending": len(self._outbox),
            "outbox_dropped": self.outbox_dropped,
        })
        return result
