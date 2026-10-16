"""Motor HiLeS general para la IR v1, sin dependencias de MQTT ni del scheduler.

Implementa la semántica normativa de ``docs/mqtt/IR_V1.md`` §6: propagación de
datos en orden topológico, evaluación de la red de Petri con disparo atómico y
política de conflicto, y serialización de instantáneas. El trabajo de un
``step()`` está acotado por los límites de la IR (64 elementos, 128 conexiones
y expresiones de profundidad 16).
"""

from .elements import Place, Service, Transition, build_element
from .model import es_texto, orden_topologico

ENTRADA_HILES_RECHAZADA = "ENTRADA_HILES_RECHAZADA"


class InputError(Exception):
    """Entrada rechazada sin modificar el estado del motor."""

    def __init__(self, mensaje, codigo=ENTRADA_HILES_RECHAZADA):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje


class HilesEngine:
    """Ejecuta un modelo IR v1 previamente validado con ``validate_ir_v1``."""

    def __init__(self, modelo):
        self.elementos = [build_element(definicion) for definicion in modelo["elementos"]]
        self._por_id = {}
        for elemento in self.elementos:
            self._por_id[elemento.id] = elemento

        orden, _ = orden_topologico(modelo["elementos"], modelo["conexiones"])
        self._orden = [self._por_id[elemento_id] for elemento_id in orden]

        # (origen, puerto_origen) -> [(destino, puerto_destino)] en orden de declaración.
        self._destinos = {}
        for conexion in modelo["conexiones"]:
            if conexion["tipo"] == "dato":
                clave = (conexion["origen"], conexion["puerto_origen"])
                destinos = self._destinos.get(clave)
                if destinos is None:
                    destinos = []
                    self._destinos[clave] = destinos
                destinos.append((self._por_id[conexion["destino"]], conexion["puerto_destino"]))
            elif self._por_id[conexion["origen"]].tipo == "place":
                self._por_id[conexion["destino"]].add_input_arc(conexion["origen"], conexion["peso"])
            else:
                self._por_id[conexion["origen"]].add_output_arc(conexion["destino"], conexion["peso"])

        self._lugares = {}
        self._transiciones = []
        for elemento in self.elementos:
            if isinstance(elemento, Place):
                self._lugares[elemento.id] = elemento
            elif isinstance(elemento, Transition):
                self._transiciones.append(elemento)

        self.reset()

    def reset(self):
        """Restaura el marcado inicial y limpia valores, salidas y guardas."""

        for elemento in self.elementos:
            elemento.reset()

    def element(self, elemento_id):
        return self._por_id.get(elemento_id)

    def set_input(self, servicio_id, valor):
        """Guarda el valor en un ``service``; se propaga en el siguiente paso."""

        if not es_texto(servicio_id):
            raise InputError("servicio_id debe ser un texto no vacío.")
        servicio = self._por_id.get(servicio_id)
        if servicio is None:
            raise InputError("No existe el Service {} en el modelo activo.".format(servicio_id))
        if not isinstance(servicio, Service):
            raise InputError("El elemento {} no es un Service.".format(servicio_id))
        if not servicio.accepts(valor):
            raise InputError(
                "El Service {} espera un valor de tipo {}.".format(servicio_id, servicio.tipo_dato)
            )
        servicio.set_value(valor)

    def step(self):
        """Ejecuta un paso completo y retorna un resumen de la fase de Petri."""

        self._propagate()
        return self._evaluate_petri()

    def _propagate(self):
        for elemento in self._orden:
            for puerto, valor in elemento.emit():
                destinos = self._destinos.get((elemento.id, puerto))
                if destinos is None:
                    continue
                for destino, puerto_destino in destinos:
                    destino.receive(puerto_destino, valor)

    def _evaluate_petri(self):
        habilitadas = [t for t in self._transiciones if t.can_fire(self._lugares)]
        resumen = {
            "habilitadas": [t.id for t in habilitadas],
            "disparada": None,
            "conflicto": len(habilitadas) > 1,
        }
        if len(habilitadas) == 1:
            habilitadas[0].fire(self._lugares)
            resumen["disparada"] = habilitadas[0].id
        return resumen

    def snapshot(self):
        """Diccionario ``elementos`` de ``simulacion/estado`` para todo el modelo."""

        resultado = {}
        for elemento in self.elementos:
            resultado[elemento.id] = elemento.snapshot()
        return resultado
