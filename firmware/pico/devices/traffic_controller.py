"""Cuatro semáforos independientes con solicitudes y permisos de paso.

Cada sentido tiene su propia :class:`TrafficLightFsm` con estado
``ROJO → VERDE → AMARILLO → ROJO`` y decide con su propio sensor. No existe un
estado común de fase: :class:`IntersectionArbiter` solo concede o niega
permisos según la matriz de conflictos y nunca cambia el color de un sentido.

Reglas de seguridad (``docs/traffic/PROTOCOLO_SEMAFOROS.md``):

- Un sentido solo pasa a verde con permiso.
- Un permiso solo se concede si todos los sentidos en conflicto están en rojo
  desde hace al menos ``todo_rojo_ms`` y no tienen permiso vigente.
- Un verde siempre termina pasando por amarillo.
- Una solicitud no puede adelantar a otra más antigua con la que está en
  conflicto, y una espera mayor que ``espera_max_ms`` obliga a ceder.
- Un sensor inválido se trata como presencia (modo seguro de recuperación).

Todos los tiempos son fechas límite con el reloj del scheduler; ``update()``
solo hace un número fijo de comparaciones por sentido.
"""

try:
    from ..core.task import Task
except ImportError:  # Permite cargar el módulo directamente en MicroPython.
    from core.task import Task


ROJO = "rojo"
VERDE = "verde"
AMARILLO = "amarillo"

NORTE = "norte"
SUR = "sur"
ESTE = "este"
OESTE = "oeste"
SENTIDOS = (NORTE, SUR, ESTE, OESTE)

# Movimientos incompatibles del cruce: Norte–Sur comparten eje y son
# compatibles entre sí; ninguno puede convivir con Este u Oeste.
MATRIZ_CONFLICTOS = {
    NORTE: (ESTE, OESTE),
    SUR: (ESTE, OESTE),
    ESTE: (NORTE, SUR),
    OESTE: (NORTE, SUR),
}

MODO_NORMAL = "normal"
MODO_SEGURO = "seguro"


def validate_conflict_matrix(sentidos, matriz):
    """La matriz debe ser simétrica, sin autoconflictos y con sentidos conocidos."""

    for sentido in sentidos:
        if sentido not in matriz:
            raise ValueError("falta el sentido {} en la matriz".format(sentido))
    for sentido, conflictos in matriz.items():
        if sentido not in sentidos:
            raise ValueError("sentido desconocido en la matriz: {}".format(sentido))
        for otro in conflictos:
            if otro == sentido:
                raise ValueError("{} no puede estar en conflicto consigo mismo".format(sentido))
            if otro not in sentidos:
                raise ValueError("conflicto con sentido desconocido: {}".format(otro))
            if sentido not in matriz[otro]:
                raise ValueError("la matriz no es simétrica entre {} y {}".format(sentido, otro))


class TrafficTiming:
    """Tiempos de la intersección en milisegundos."""

    def __init__(
        self,
        verde_min_ms=5000,
        verde_max_ms=20000,
        amarillo_ms=3000,
        todo_rojo_ms=2000,
        espera_max_ms=30000,
    ):
        valores = (verde_min_ms, verde_max_ms, amarillo_ms, todo_rojo_ms, espera_max_ms)
        for valor in valores:
            if not isinstance(valor, int) or isinstance(valor, bool) or valor <= 0:
                raise ValueError("los tiempos deben ser enteros mayores que cero")
        if verde_max_ms < verde_min_ms:
            raise ValueError("verde_max_ms no puede ser menor que verde_min_ms")
        self.verde_min_ms = verde_min_ms
        self.verde_max_ms = verde_max_ms
        self.amarillo_ms = amarillo_ms
        self.todo_rojo_ms = todo_rojo_ms
        self.espera_max_ms = espera_max_ms

    def as_dict(self):
        return {
            "verde_min_ms": self.verde_min_ms,
            "verde_max_ms": self.verde_max_ms,
            "amarillo_ms": self.amarillo_ms,
            "todo_rojo_ms": self.todo_rojo_ms,
            "espera_max_ms": self.espera_max_ms,
        }


class TrafficLightFsm:
    """Estado privado de un sentido. Solo cambia de color por sí misma."""

    def __init__(self, sentido, timing, clock, now_ms):
        self.sentido = sentido
        self.timing = timing
        self.clock = clock
        self.color = ROJO
        self.desde_ms = now_ms
        self.presencia = False
        self.sensor_valido = True
        self.solicitud_desde = None
        self.transiciones = []

    def elapsed(self, now_ms):
        return self.clock.diff_ms(now_ms, self.desde_ms)

    def observe(self, lectura, now_ms):
        """Registra la lectura del sensor propio; ``None`` es lectura inválida."""

        if lectura is None:
            self.sensor_valido = False
            presencia = True  # Fail-safe: un sensor defectuoso no deja al sentido sin servicio.
        else:
            self.sensor_valido = True
            presencia = bool(lectura)
        self.presencia = presencia
        if self.color == ROJO and presencia:
            if self.solicitud_desde is None:
                self.solicitud_desde = now_ms
        elif self.color == ROJO:
            self.solicitud_desde = None

    def requesting(self):
        return self.solicitud_desde is not None

    def waited(self, now_ms):
        if self.solicitud_desde is None:
            return 0
        return self.clock.diff_ms(now_ms, self.solicitud_desde)

    def advance(self, now_ms, permiso, ceder, urgente):
        """Aplica como máximo un cambio de color y retorna el color nuevo o ``None``."""

        elapsed = self.elapsed(now_ms)
        if self.color == ROJO:
            if permiso and self.requesting():
                return self._go(VERDE, now_ms)
            return None
        if self.color == VERDE:
            if elapsed < self.timing.verde_min_ms:
                return None
            termina = (
                not self.presencia
                or urgente
                or (ceder and elapsed >= self.timing.verde_max_ms)
            )
            return self._go(AMARILLO, now_ms) if termina else None
        if elapsed >= self.timing.amarillo_ms:
            return self._go(ROJO, now_ms)
        return None

    def force_yellow(self, now_ms):
        """Usado solo por el monitor de seguridad: un verde nunca salta a rojo."""

        if self.color == VERDE:
            return self._go(AMARILLO, now_ms)
        return None

    def _go(self, color, now_ms):
        if self.color == VERDE and color == ROJO:
            raise RuntimeError("transición prohibida verde → rojo en {}".format(self.sentido))
        self.transiciones.append((self.color, color))
        if len(self.transiciones) > 8:
            self.transiciones.pop(0)
        self.color = color
        self.desde_ms = now_ms
        if color == VERDE:
            self.solicitud_desde = None
        elif color == ROJO and self.presencia:
            # Si siguen esperando vehículos, la nueva solicitud empieza ahora.
            self.solicitud_desde = now_ms
        return color

    def status(self, now_ms):
        return {
            "color": self.color,
            "presencia": self.presencia,
            "sensor_valido": self.sensor_valido,
            "solicitud": self.requesting(),
            "espera_ms": self.waited(now_ms),
            "en_estado_ms": self.elapsed(now_ms),
        }


class IntersectionArbiter:
    """Concede permisos de paso; no conoce ni modifica estados internos de las FSM."""

    def __init__(self, sentidos, matriz, timing, clock):
        validate_conflict_matrix(sentidos, matriz)
        self.sentidos = tuple(sentidos)
        self.matriz = matriz
        self.timing = timing
        self.clock = clock
        self.permisos = {}
        self.en_uso = {}
        self.revoke_all()

    def revoke_all(self):
        for sentido in self.sentidos:
            self.permisos[sentido] = False
            self.en_uso[sentido] = False

    def _cleared(self, sentido, colores, rojo_desde, now_ms):
        for otro in self.matriz[sentido]:
            if self.permisos[otro] or colores[otro] != ROJO:
                return False
            if self.clock.diff_ms(now_ms, rojo_desde[otro]) < self.timing.todo_rojo_ms:
                return False
        return True

    def update(self, now_ms, colores, rojo_desde, solicitudes):
        """Actualiza permisos con la vista pública de cada sentido.

        ``colores`` y ``rojo_desde`` son de solo lectura; ``solicitudes`` mapea
        sentido → instante de la solicitud o ``None``. Retorna
        ``(permisos, ceder, urgente)`` por sentido.
        """

        # Un permiso sirve para un solo ciclo verde: termina cuando el sentido
        # vuelve a rojo tras usarlo, o si la solicitud desaparece sin usarlo.
        for sentido in self.sentidos:
            if not self.permisos[sentido]:
                continue
            if colores[sentido] != ROJO:
                self.en_uso[sentido] = True
            elif self.en_uso[sentido] or solicitudes[sentido] is None:
                self.permisos[sentido] = False
                self.en_uso[sentido] = False

        pendientes = [s for s in self.sentidos if solicitudes[s] is not None and not self.permisos[s]]
        # Las solicitudes más antiguas eligen primero; el orden fijo desempata.
        pendientes.sort(key=lambda s: (self.clock.diff_ms(now_ms, solicitudes[s]) * -1, self.sentidos.index(s)))
        bloqueados = []
        for sentido in pendientes:
            adelantaria = False
            for anterior in bloqueados:
                if anterior in self.matriz[sentido]:
                    adelantaria = True
                    break
            if not adelantaria and self._cleared(sentido, colores, rojo_desde, now_ms):
                self.permisos[sentido] = True
            else:
                bloqueados.append(sentido)

        ceder = {}
        urgente = {}
        for sentido in self.sentidos:
            ceder[sentido] = False
            urgente[sentido] = False
            for otro in self.matriz[sentido]:
                if solicitudes[otro] is not None and not self.permisos[otro]:
                    ceder[sentido] = True
                    if self.clock.diff_ms(now_ms, solicitudes[otro]) >= self.timing.espera_max_ms:
                        urgente[sentido] = True
        return dict(self.permisos), ceder, urgente


def incompatible_greens(colores, matriz=MATRIZ_CONFLICTOS):
    """Pares de sentidos en conflicto que no están en rojo al mismo tiempo."""

    pares = []
    for sentido, conflictos in matriz.items():
        if colores[sentido] == ROJO:
            continue
        for otro in conflictos:
            if colores[otro] != ROJO and (otro, sentido) not in pares:
                pares.append((sentido, otro))
    return pares


class TrafficControllerTask(Task):
    """Tarea cooperativa que coordina sensores, FSM, árbitro y salidas.

    ``sensors`` mapea sentido → objeto con ``reading()`` que retorna ``True``,
    ``False`` o ``None`` (lectura inválida). ``outputs`` mapea sentido →
    objeto con ``show(color)``. ``on_change(estado)`` recibe la instantánea
    cuando algo cambia y ``on_engine_input(servicio_id, valor)`` permite
    reflejar el estado en un modelo HiLeS sin acoplar esta tarea a MQTT.
    """

    def __init__(
        self,
        scheduler,
        sensors,
        timing=None,
        matriz=MATRIZ_CONFLICTOS,
        outputs=None,
        on_change=None,
        on_engine_input=None,
        period_ms=100,
        priority=3,
        name="semaforos",
    ):
        sentidos = tuple(matriz.keys())
        for sentido in sentidos:
            if sentido not in sensors:
                raise ValueError("falta el sensor del sentido {}".format(sentido))
        self.timing = timing or TrafficTiming()
        self.matriz = matriz
        self.sentidos = tuple(s for s in SENTIDOS if s in sentidos) + tuple(
            s for s in sentidos if s not in SENTIDOS
        )
        self.sensors = sensors
        self.outputs = outputs or {}
        self.on_change = on_change
        self.on_engine_input = on_engine_input
        self.modo = MODO_NORMAL
        self.violaciones = 0
        self.cambios = 0
        self._ultimo_estado = None
        self._ultimas_entradas = {}
        clock = scheduler.clock
        now = clock.now_ms()
        self.fsms = {}
        for sentido in self.sentidos:
            self.fsms[sentido] = TrafficLightFsm(sentido, self.timing, clock, now)
        self.arbiter = IntersectionArbiter(self.sentidos, matriz, self.timing, clock)
        super().__init__(
            scheduler,
            period_ms=period_ms,
            priority=priority,
            name=name,
            max_update_ms=period_ms,
        )
        self._apply_outputs()

    def _read(self, sentido):
        try:
            lectura = self.sensors[sentido].reading()
        except Exception:
            return None
        if lectura is None or isinstance(lectura, bool):
            return lectura
        if lectura in (0, 1):
            return bool(lectura)
        return None

    def update(self):
        now = self.scheduler.clock.now_ms()
        for sentido in self.sentidos:
            self.fsms[sentido].observe(self._read(sentido), now)

        colores = {}
        rojo_desde = {}
        solicitudes = {}
        for sentido in self.sentidos:
            fsm = self.fsms[sentido]
            colores[sentido] = fsm.color
            rojo_desde[sentido] = fsm.desde_ms
            solicitudes[sentido] = fsm.solicitud_desde

        if self.modo == MODO_SEGURO:
            permisos = dict((s, False) for s in self.sentidos)
            ceder = dict((s, True) for s in self.sentidos)
            urgente = dict((s, True) for s in self.sentidos)
        else:
            permisos, ceder, urgente = self.arbiter.update(now, colores, rojo_desde, solicitudes)

        for sentido in self.sentidos:
            self.fsms[sentido].advance(now, permisos[sentido], ceder[sentido], urgente[sentido])

        self._check_safety(now)
        self._apply_outputs()
        self._publish(now)

    def _check_safety(self, now):
        colores = dict((s, self.fsms[s].color) for s in self.sentidos)
        if not incompatible_greens(colores, self.matriz):
            return
        # Nunca debería ocurrir: se entra en modo seguro y los verdes pasan a amarillo.
        self.violaciones += 1
        self.modo = MODO_SEGURO
        self.arbiter.revoke_all()
        for fsm in self.fsms.values():
            fsm.force_yellow(now)

    def reset_safe_mode(self):
        """Sale del modo seguro solo cuando todos los sentidos están en rojo."""

        if all(self.fsms[s].color == ROJO for s in self.sentidos):
            self.modo = MODO_NORMAL
            return True
        return False

    def _apply_outputs(self):
        for sentido, salida in self.outputs.items():
            try:
                salida.show(self.fsms[sentido].color)
            except Exception:
                pass  # Una salida física defectuosa no detiene la lógica.

    def snapshot(self, now=None):
        if now is None:
            now = self.scheduler.clock.now_ms()
        sentidos = {}
        for sentido in self.sentidos:
            estado = self.fsms[sentido].status(now)
            estado["permiso"] = self.arbiter.permisos[sentido]
            sentidos[sentido] = estado
        return {"modo": self.modo, "violaciones": self.violaciones, "sentidos": sentidos}

    def _publish(self, now):
        firma = tuple(
            (self.fsms[s].color, self.fsms[s].presencia, self.fsms[s].sensor_valido, self.arbiter.permisos[s])
            for s in self.sentidos
        ) + (self.modo,)
        if firma == self._ultimo_estado:
            return
        self._ultimo_estado = firma
        self.cambios += 1
        if self.on_change is not None:
            self.on_change(self.snapshot(now))
        if self.on_engine_input is not None:
            for servicio_id, valor in engine_inputs(self.fsms).items():
                if self._ultimas_entradas.get(servicio_id) != valor:
                    self._ultimas_entradas[servicio_id] = valor
                    self.on_engine_input(servicio_id, valor)


def engine_inputs(fsms):
    """Valores para los Services del demo ``demo-4-semaforos-distribuidos.json``."""

    entradas = {}
    for sentido, fsm in fsms.items():
        entradas["sensor-{}".format(sentido)] = fsm.presencia
        entradas["luz-{}".format(sentido)] = fsm.color
    return entradas
