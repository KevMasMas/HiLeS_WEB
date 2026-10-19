"""Motor HiLeS general para la IR v2, sin dependencias de MQTT ni de GPIO.

Replica el paso de ``MotorSimulacion.paso`` (``frontend/src/engine``):

1. Avanza el reloj lógico.
2. Entrega diferidas vencidas y consume un evento por cola DCH.
3. Evalúa en orden: services, transitions y el resto en orden topológico.
   Los Functional Blocks Python usan ``PythonExecutor`` de Persona 1.
4. Evalúa la red de Petri con temporizadores de transición y política de
   conflicto (más de una lista para disparar: no se mueve ningún token).
5. Limpia pulsos LCH de transiciones y muestras de services.

Los retardos son fechas límite sobre el reloj lógico. ``step(avance_ms)``
recibe cuánto avanzó el tiempo; con ``time_source`` el avance se mide con el
reloj del scheduler y nunca se espera con ``sleep``.
"""

from .channels import ChannelBus, same_value
from .elements_v2 import FunctionalBlockV2, PlaceV2, ServiceV2, TransitionV2, build_element_v2
from .engine import ENTRADA_HILES_RECHAZADA, InputError
from .model import es_texto
from .model_v2 import orden_topologico_v2
from .python_executor import PythonExecutorError
from .runtime_values import RuntimeValueError, clone_runtime_value, validate_runtime_value

DCH_COLA_DESBORDADA = "DCH_COLA_DESBORDADA"
PYTHON_EJECUCION_ERROR = "PYTHON_EJECUCION_ERROR"


class HilesEngineV2:
    """Ejecuta un modelo previamente validado con ``validate_ir_v2``.

    El constructor compila todos los Functional Blocks Python antes de quedar
    listo; si uno falla se lanza :class:`PythonExecutorError` y el llamador
    conserva el modelo activo anterior.
    """

    def __init__(self, modelo, time_source=None):
        self.modelo = modelo
        self.elementos = [build_element_v2(definicion) for definicion in modelo["elementos"]]
        self._por_id = {}
        for elemento in self.elementos:
            self._por_id[elemento.id] = elemento

        self._lugares = {}
        self._transiciones = []
        for elemento in self.elementos:
            if isinstance(elemento, PlaceV2):
                self._lugares[elemento.id] = elemento
            elif isinstance(elemento, TransitionV2):
                self._transiciones.append(elemento)
        for conexion in modelo["conexiones"]:
            if conexion["tipo"] != "arco":
                continue
            origen = self._por_id[conexion["origen"]]
            if isinstance(origen, PlaceV2):
                self._por_id[conexion["destino"]].add_input_arc(origen.id, conexion["peso"])
            else:
                origen.add_output_arc(conexion["destino"], conexion["peso"])

        topologico = [self._por_id[i] for i in orden_topologico_v2(modelo["elementos"], modelo["conexiones"])]
        self._orden = (
            [e for e in topologico if isinstance(e, ServiceV2)]
            + [e for e in topologico if isinstance(e, TransitionV2)]
            + [e for e in topologico if not isinstance(e, (ServiceV2, TransitionV2))]
        )
        self.bus = ChannelBus(self._por_id, modelo["conexiones"])

        self._time_source = time_source
        self._last_tick = None
        self.reset()

    # ------------------------------------------------------------------
    # Estado y reinicio.
    # ------------------------------------------------------------------

    def reset(self):
        """Limpia valores, colas, eventos, timers, retenidos y tokens."""

        for elemento in self.elementos:
            elemento.reset()
        self.bus.reset()
        self.reloj_ms = 0
        self.valores = {}
        self.salidas_por_nodo = {}
        self.errores = {}
        self.timers_elementos = {}
        self.salidas_retenidas = {}
        self.timers_transiciones = {}
        self.disparadas = []
        self.pulsos = {}
        self.ultimo_resumen = None
        self._last_tick = self._now() if self._time_source is not None else None

    def element(self, elemento_id):
        return self._por_id.get(elemento_id)

    def pending_work(self):
        """``True`` si quedan eventos DCH, entregas diferidas o temporizadores."""

        return (
            self.bus.has_pending_events()
            or self.bus.has_deferred()
            or bool(self.timers_elementos)
            or bool(self.timers_transiciones)
        )

    def set_input(self, servicio_id, valor):
        """Inyecta una muestra en un ``service``; se publica en el siguiente paso."""

        if not es_texto(servicio_id):
            raise InputError("servicio_id debe ser un texto no vacío.")
        servicio = self._por_id.get(servicio_id)
        if servicio is None:
            raise InputError("No existe el Service {} en el modelo activo.".format(servicio_id))
        if not isinstance(servicio, ServiceV2):
            raise InputError("El elemento {} no es un Service.".format(servicio_id))
        if not servicio.salidas:
            raise InputError("El Service {} necesita al menos un puerto de salida.".format(servicio_id))
        try:
            validate_runtime_value(valor, servicio.tipo_dato, "valor")
            valor = clone_runtime_value(valor)
        except RuntimeValueError as error:
            raise InputError(
                "El Service {} espera {}: {}".format(servicio_id, servicio.tipo_dato, error.mensaje),
                ENTRADA_HILES_RECHAZADA,
            )
        servicio.set_value(valor)
        self.bus.register_service_sample(servicio_id, valor)

    # ------------------------------------------------------------------
    # Paso.
    # ------------------------------------------------------------------

    def _now(self):
        return self._time_source.now_ms()

    def _elapsed_ms(self):
        ahora = self._now()
        if self._last_tick is None:
            self._last_tick = ahora
            return 0
        transcurrido = self._time_source.diff_ms(ahora, self._last_tick)
        self._last_tick = ahora
        return transcurrido if transcurrido > 0 else 0

    def step(self, avance_ms=None):
        """Ejecuta un paso acotado y retorna el resumen de la red de Petri."""

        if avance_ms is None:
            avance_ms = self._elapsed_ms() if self._time_source is not None else 0
        if not self.elementos:
            return {"habilitadas": [], "disparada": None, "conflicto": False}
        if avance_ms > 0:
            self.reloj_ms += int(avance_ms)
        self.disparadas = []

        self.bus.begin_step(self.reloj_ms)
        for elemento in self._orden:
            salidas = self._evaluate(elemento)
            for puerto, valor in salidas:
                self.valores[elemento.id] = valor
                self.bus.notify(elemento.id, puerto, valor)

        for cola in self.bus.colas:
            if cola.desbordada:
                self.errores[cola.destino.id] = DCH_COLA_DESBORDADA

        resumen = self._evaluate_petri()
        self.bus.end_step()
        self.ultimo_resumen = resumen
        return resumen

    def _evaluate(self, elemento):
        try:
            salidas = elemento.evaluate()
        except PythonExecutorError as error:
            self.errores[elemento.id] = error.codigo
            return []
        except Exception:  # Un fallo inesperado del bloque no detiene el paso.
            self.errores[elemento.id] = PYTHON_EJECUCION_ERROR
            return []

        if isinstance(elemento, FunctionalBlockV2) or elemento.error is None:
            self.errores.pop(elemento.id, None)
        else:
            self.errores[elemento.id] = elemento.error

        if elemento.tipo == "sample":
            self.pulsos[elemento.id] = len(salidas) > 0
        elif elemento.tipo == "hold":
            self.pulsos[elemento.id] = any(p == elemento.puerto_lch and v is True for p, v in salidas)

        if elemento.retardo_ms > 0:
            salidas = self._apply_element_delay(elemento, salidas)

        if salidas:
            registro = self.salidas_por_nodo.get(elemento.id)
            if registro is None:
                registro = {}
                self.salidas_por_nodo[elemento.id] = registro
            for puerto, valor in salidas:
                registro[puerto] = valor
        return salidas

    def _apply_element_delay(self, elemento, calculadas):
        """Retarda las salidas como ``timersElementos`` del motor web."""

        timer = self.timers_elementos.get(elemento.id)
        if timer is not None and self.reloj_ms >= timer[0]:
            del self.timers_elementos[elemento.id]
            self.salidas_retenidas[elemento.id] = list(timer[1])
            return list(timer[1])
        if not calculadas:
            return calculadas
        retenidas = self.salidas_retenidas.get(elemento.id)
        cambio = retenidas is None or not _same_outputs(calculadas, retenidas)
        if cambio and timer is None:
            self.timers_elementos[elemento.id] = (self.reloj_ms + elemento.retardo_ms, list(calculadas))
        return list(retenidas) if retenidas is not None else []

    def _evaluate_petri(self):
        habilitadas = [t for t in self._transiciones if t.can_fire(self._lugares)]
        ids_habilitadas = set(t.id for t in habilitadas)
        for transicion_id in list(self.timers_transiciones.keys()):
            if transicion_id not in ids_habilitadas:
                del self.timers_transiciones[transicion_id]

        listas = []
        for transicion in habilitadas:
            if transicion.retardo_ms <= 0:
                listas.append(transicion)
                continue
            vence = self.timers_transiciones.get(transicion.id)
            if vence is None:
                self.timers_transiciones[transicion.id] = self.reloj_ms + transicion.retardo_ms
            elif self.reloj_ms >= vence:
                del self.timers_transiciones[transicion.id]
                listas.append(transicion)

        resumen = {
            "habilitadas": [t.id for t in habilitadas],
            "disparada": None,
            "conflicto": len(listas) > 1,
        }
        if len(listas) == 1:
            listas[0].fire(self._lugares)
            self.disparadas.append(listas[0].id)
            resumen["disparada"] = listas[0].id
        return resumen

    # ------------------------------------------------------------------
    # Instantánea.
    # ------------------------------------------------------------------

    def _timer_pending(self, elemento_id):
        return (
            elemento_id in self.timers_elementos
            or elemento_id in self.timers_transiciones
            or self.bus.has_deferred(elemento_id)
        )

    def _cola(self, elemento_id, estado):
        cola = self.bus.queue_for(elemento_id)
        if cola is None:
            return
        if cola.cola:
            estado["cola_dch"] = len(cola.cola)
        if cola.desbordada:
            estado["cola_desbordada"] = True

    def _publicado(self, elemento):
        valor = self.valores.get(elemento.id)
        return valor if valor is not None else elemento.base_value()

    def snapshot(self):
        """Diccionario ``elementos`` con el formato de ``extraerElementosEstadoIrV2``."""

        resultado = {}
        for elemento in self.elementos:
            estado = {}
            tipo = elemento.tipo
            if tipo == "service":
                valor = self._publicado(elemento)
                if valor is not None:
                    estado["valor"] = valor
                    if self._timer_pending(elemento.id):
                        estado["timer_pendiente"] = True
            elif tipo == "functional_block":
                salidas = self.salidas_por_nodo.get(elemento.id)
                principal = salidas.get(elemento.salidas[0]["puerto"]) if salidas else None
                if principal is None:
                    principal = self.valores.get(elemento.id)
                if principal is not None:
                    estado["salida"] = principal
                if salidas and len(salidas) > 1:
                    estado["salidas"] = dict(salidas)
                if self._timer_pending(elemento.id):
                    estado["timer_pendiente"] = True
                if self.errores.get(elemento.id):
                    estado["error"] = self.errores[elemento.id]
            elif tipo == "sample":
                valor = self._publicado(elemento)
                if valor is not None:
                    estado["salida"] = valor
                self._cola(elemento.id, estado)
                if self._timer_pending(elemento.id):
                    estado["timer_pendiente"] = True
            elif tipo == "hold":
                retenido = elemento.valor if elemento.valor is not None else self.valores.get(elemento.id)
                if retenido is not None:
                    estado["valor_retenido"] = retenido
                    estado["salida"] = retenido
                estado["evento_pendiente"] = bool(self.pulsos.get(elemento.id))
                self._cola(elemento.id, estado)
                if self._timer_pending(elemento.id):
                    estado["timer_pendiente"] = True
            elif tipo == "place":
                estado["tokens"] = elemento.tokens
            else:
                estado["habilitada"] = elemento.is_enabled()
                estado["disparada"] = elemento.id in self.disparadas
                if self._timer_pending(elemento.id):
                    estado["timer_pendiente"] = True
            resultado[elemento.id] = estado
        return resultado

    def errors(self):
        """Errores observables por elemento, por ejemplo códigos ``PYTHON_*``."""

        return dict(self.errores)


def _same_outputs(a, b):
    if len(a) != len(b):
        return False
    for (puerto_a, valor_a), (puerto_b, valor_b) in zip(a, b):
        if puerto_a != puerto_b or not same_value(valor_a, valor_b):
            return False
    return True
