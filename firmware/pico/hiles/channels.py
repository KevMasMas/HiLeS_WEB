"""Bus de canales CCH, DCH y LCH de la IR v2 con entregas diferidas.

Replica ``BusObserver`` (``frontend/src/engine/BusObserver.ts``):

- **CCH:** entrega el último valor. Con ``retardo_ms > 0`` solo programa una
  entrega cuando el valor cambia y reemplaza la entrega pendiente anterior.
- **DCH:** cola FIFO acotada por puerto destino; consume como máximo un evento
  por paso y marca ``desbordada`` si llega un evento con la cola llena.
- **LCH:** pulso booleano. Al cerrar el paso, los pulsos que llegaron a una
  ``transition`` vuelven a ``False``.

Un ``service`` conectado por DCH o LCH solo emite las muestras inyectadas en
el paso actual. Las fechas límite usan el reloj lógico del motor; nunca se
espera con ``sleep``. Los valores no se copian al entregarse: el motor valida
y clona una sola vez cada valor inyectado y el ejecutor Python ya retorna
copias, así que ninguna estructura crece por reenvío.
"""

DEFAULT_DCH_QUEUE_CAPACITY = 8
MAX_DCH_QUEUE_CAPACITY = 32


def same_value(a, b):
    """Igualdad con la semántica de ``JSON.stringify``: ``True`` no es ``1``."""

    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b
    if isinstance(a, str) or isinstance(b, str):
        return isinstance(a, str) and isinstance(b, str) and a == b
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        for izquierdo, derecho in zip(a, b):
            if not same_value(izquierdo, derecho):
                return False
        return True
    if isinstance(a, dict) and isinstance(b, dict):
        if len(a) != len(b):
            return False
        for clave in a:
            if clave not in b or not same_value(a[clave], b[clave]):
                return False
        return True
    return a is None and b is None


class DchQueue:
    """Cola FIFO acotada de un puerto destino."""

    def __init__(self, destino, puerto, capacidad):
        self.destino = destino
        self.puerto = puerto
        self.capacidad = min(MAX_DCH_QUEUE_CAPACITY, max(1, int(capacidad)))
        self.cola = []
        self.desbordada = False
        self.consumido_en_paso = False

    def push(self, valor):
        if len(self.cola) >= self.capacidad:
            self.desbordada = True
        else:
            self.cola.append(valor)

    def consume_one(self):
        """Entrega un evento si este puerto no consumió otro en el paso."""

        if self.consumido_en_paso or not self.cola:
            return
        self.consumido_en_paso = True
        self.destino.receive(self.puerto, self.cola.pop(0))

    def reset(self):
        self.cola = []
        self.desbordada = False
        self.consumido_en_paso = False


class _Subscription:
    def __init__(self, conexion, origen, destino, cola):
        self.id = conexion["id"]
        self.tipo = conexion["tipo"]
        self.origen = origen
        self.destino = destino
        self.puerto_destino = conexion["puerto_destino"]
        self.retardo = int(conexion.get("retardo_ms", 0) or 0)
        self.cola = cola


class ChannelBus:
    """Entrega las emisiones de cada puerto según el tipo de canal."""

    def __init__(self, elementos_por_id, conexiones):
        self.reloj_ms = 0
        self._por_puerto = {}
        self.colas = []
        self._colas_por_clave = {}
        self._pulsos = []
        self._ultimo_cch = {}
        self._muestras_service = {}
        self.diferidas = []

        for conexion in conexiones:
            if conexion["tipo"] not in ("cch", "dch", "lch"):
                continue
            destino = elementos_por_id[conexion["destino"]]
            cola = None
            if conexion["tipo"] == "dch":
                clave = (conexion["destino"], conexion["puerto_destino"])
                cola = self._colas_por_clave.get(clave)
                if cola is None:
                    cola = DchQueue(
                        destino,
                        conexion["puerto_destino"],
                        conexion.get("capacidad_cola", DEFAULT_DCH_QUEUE_CAPACITY),
                    )
                    self._colas_por_clave[clave] = cola
                    self.colas.append(cola)
            clave_origen = (conexion["origen"], conexion["puerto_origen"])
            suscripciones = self._por_puerto.get(clave_origen)
            if suscripciones is None:
                suscripciones = []
                self._por_puerto[clave_origen] = suscripciones
            suscripciones.append(
                _Subscription(conexion, elementos_por_id[conexion["origen"]], destino, cola)
            )

    # ------------------------------------------------------------------
    # Ciclo de un paso.
    # ------------------------------------------------------------------

    def register_service_sample(self, servicio_id, valor):
        """Una inyección produce un evento DCH/LCH en el siguiente paso."""

        muestras = self._muestras_service.get(servicio_id)
        if muestras is None:
            muestras = []
            self._muestras_service[servicio_id] = muestras
        muestras.append(valor)

    def begin_step(self, reloj_ms):
        """Entrega diferidas vencidas y consume un evento pendiente por cola."""

        self.reloj_ms = reloj_ms
        for cola in self.colas:
            cola.consumido_en_paso = False

        if self.diferidas:
            vencidas = []
            pendientes = []
            for entrega in self.diferidas:
                if entrega[4] <= reloj_ms:
                    vencidas.append(entrega)
                else:
                    pendientes.append(entrega)
            self.diferidas = pendientes
            for suscripcion, valor, _, _, _ in vencidas:
                self._deliver(suscripcion, valor)

        for cola in self.colas:
            cola.consume_one()

    def end_step(self):
        """Limpia pulsos LCH de transiciones y muestras de services."""

        for destino, puerto in self._pulsos:
            if destino.tipo == "transition":
                destino.receive(puerto, False)
        self._pulsos = []
        self._muestras_service = {}

    def reset(self):
        for cola in self.colas:
            cola.reset()
        self._pulsos = []
        self._ultimo_cch = {}
        self._muestras_service = {}
        self.diferidas = []
        self.reloj_ms = 0

    # ------------------------------------------------------------------
    # Publicación.
    # ------------------------------------------------------------------

    def notify(self, origen_id, puerto, valor):
        suscripciones = self._por_puerto.get((origen_id, puerto))
        if not suscripciones:
            return
        for suscripcion in suscripciones:
            self._on_value(suscripcion, valor)

    def _schedule(self, suscripcion, valor):
        self.diferidas.append(
            (
                suscripcion,
                valor,
                suscripcion.origen.id,
                suscripcion.destino.id,
                self.reloj_ms + suscripcion.retardo,
            )
        )

    def _on_value(self, suscripcion, valor):
        if suscripcion.origen.tipo == "service" and suscripcion.tipo in ("dch", "lch"):
            muestras = self._muestras_service.get(suscripcion.origen.id)
            if not muestras:
                return
            if suscripcion.retardo > 0:
                for muestra in muestras:
                    self._schedule(suscripcion, muestra)
                return
            if suscripcion.tipo == "dch":
                for muestra in muestras:
                    suscripcion.cola.push(muestra)
                suscripcion.cola.consume_one()
                return
            for muestra in muestras:
                self._deliver(suscripcion, muestra)
            return

        if suscripcion.tipo == "cch":
            tenia_valor = suscripcion.id in self._ultimo_cch
            sin_cambio = tenia_valor and same_value(self._ultimo_cch[suscripcion.id], valor)
            self._ultimo_cch[suscripcion.id] = valor
            if suscripcion.retardo > 0:
                if sin_cambio:
                    return
                # Reemplaza la entrega pendiente de este CCH para no acumular copias.
                self.diferidas = [e for e in self.diferidas if e[0] is not suscripcion]
                self._schedule(suscripcion, valor)
                return
            self._deliver(suscripcion, valor)
            return

        if suscripcion.retardo > 0:
            self._schedule(suscripcion, valor)
            return
        self._deliver(suscripcion, valor)

    def _deliver(self, suscripcion, valor):
        if suscripcion.tipo == "dch":
            suscripcion.cola.push(valor)
            suscripcion.cola.consume_one()
            return
        if suscripcion.tipo == "lch":
            pulso = bool(valor)
            suscripcion.destino.receive(suscripcion.puerto_destino, pulso)
            if pulso:
                clave = (suscripcion.destino, suscripcion.puerto_destino)
                if clave not in self._pulsos:
                    self._pulsos.append(clave)
            return
        suscripcion.destino.receive(suscripcion.puerto_destino, valor)

    # ------------------------------------------------------------------
    # Consultas para la instantánea.
    # ------------------------------------------------------------------

    def queue_for(self, destino_id):
        """Primera cola DCH que llega al elemento, como ``obtenerEstadoColaDch``."""

        for cola in self.colas:
            if cola.destino.id == destino_id:
                return cola
        return None

    def has_deferred(self, elemento_id=None):
        if elemento_id is None:
            return bool(self.diferidas)
        for entrega in self.diferidas:
            if entrega[2] == elemento_id or entrega[3] == elemento_id:
                return True
        return False

    def has_pending_events(self):
        for cola in self.colas:
            if cola.cola:
                return True
        return False
