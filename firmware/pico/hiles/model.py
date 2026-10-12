"""Carga y validación de la IR versión 1 recibida en ``modelo/cargar``.

Las reglas y el orden de comprobación replican ``validarIrV1``
(``frontend/src/services/ir/validadorIr.ts``): la validación se detiene en el
primer problema para que la Pico y la web reporten el mismo código. Ninguna
regla depende de nombres o identificadores de un circuito concreto.
"""

from .expressions import MAX_PROFUNDIDAD, es_numero, profundidad, validar_expresion

IR_VERSION = 1
MAX_ELEMENTOS = 64
MAX_CONEXIONES = 128
PUERTO_CONDICION = "condicion"

IR_VERSION_NO_SOPORTADA = "IR_VERSION_NO_SOPORTADA"
IR_LIMITE_EXCEDIDO = "IR_LIMITE_EXCEDIDO"
IR_TIPO_NO_SOPORTADO = "IR_TIPO_NO_SOPORTADO"
IR_ID_DUPLICADO = "IR_ID_DUPLICADO"
IR_REFERENCIA_INVALIDA = "IR_REFERENCIA_INVALIDA"
IR_PUERTO_INVALIDO = "IR_PUERTO_INVALIDO"
IR_ARCO_INVALIDO = "IR_ARCO_INVALIDO"
IR_CONEXION_NO_SOPORTADA = "IR_CONEXION_NO_SOPORTADA"
IR_CICLO_DATOS = "IR_CICLO_DATOS"
IR_EXPRESION_INVALIDA = "IR_EXPRESION_INVALIDA"
IR_TIPO_DATO_INVALIDO = "IR_TIPO_DATO_INVALIDO"
IR_ESTRUCTURA_INVALIDA = "IR_ESTRUCTURA_INVALIDA"

TIPOS_ELEMENTO = ("service", "functional_block", "place", "transition")
TIPOS_DATO = ("boolean", "integer", "real", "string")


class IrError(Exception):
    """Rechazo de la IR con un código ``CodigoIr`` y un mensaje legible."""

    def __init__(self, codigo, mensaje, elemento_id=None, conexion_id=None):
        super().__init__(mensaje)
        self.codigo = codigo
        self.mensaje = mensaje
        self.elemento_id = elemento_id
        self.conexion_id = conexion_id


def es_texto(valor):
    return isinstance(valor, str) and len(valor) > 0


def es_entero(valor):
    """Entero en el sentido de JSON/JavaScript: ``5`` y ``5.0`` lo son; ``True`` no."""

    if isinstance(valor, bool):
        return False
    if isinstance(valor, int):
        return True
    return es_numero(valor) and valor == int(valor)


def _es_lista_textos(valor):
    if not isinstance(valor, list):
        return False
    for item in valor:
        if not es_texto(item):
            return False
    return True


def _es_entero_no_negativo(valor):
    return es_entero(valor) and valor >= 0


def coincide_tipo_dato(valor, tipo_dato):
    if tipo_dato == "boolean":
        return isinstance(valor, bool)
    if tipo_dato == "string":
        return isinstance(valor, str)
    if tipo_dato == "integer":
        return es_entero(valor)
    return es_numero(valor)


def puertos_salida(elemento):
    tipo = elemento["tipo"]
    if tipo == "service" or tipo == "functional_block":
        return elemento["salidas"]
    if tipo == "transition":
        return [elemento["puerto_accion"]] if elemento["puerto_accion"] else []
    return []


def puertos_entrada(elemento):
    tipo = elemento["tipo"]
    if tipo == "service":
        return elemento["entradas"]
    if tipo == "functional_block":
        return [entrada["puerto"] for entrada in elemento["entradas"]]
    if tipo == "transition":
        return [PUERTO_CONDICION]
    return []


def _validar_elemento(valor, indice):
    def falla(codigo, detalle, elemento_id=None):
        etiqueta = elemento_id if elemento_id is not None else "#{}".format(indice)
        raise IrError(
            codigo,
            "Aviso en elemento {}: {}.".format(etiqueta, detalle),
            elemento_id=elemento_id,
        )

    if not isinstance(valor, dict) or not es_texto(valor.get("id")):
        falla(IR_ESTRUCTURA_INVALIDA, "debe ser un objeto con id de texto")
    elemento_id = valor["id"]
    tipo = valor.get("tipo")
    if not isinstance(tipo, str) or tipo not in TIPOS_ELEMENTO:
        falla(
            IR_TIPO_NO_SOPORTADO,
            "el tipo «{}» no está soportado en la IR v1".format(tipo),
            elemento_id,
        )
    if not isinstance(valor.get("nombre"), str):
        falla(IR_ESTRUCTURA_INVALIDA, "nombre debe ser texto", elemento_id)

    if tipo == "service":
        tipo_dato = valor.get("tipo_dato")
        if not isinstance(tipo_dato, str) or tipo_dato not in TIPOS_DATO:
            falla(
                IR_TIPO_DATO_INVALIDO,
                "tipo_dato debe ser boolean, integer, real o string",
                elemento_id,
            )
        if not _es_lista_textos(valor.get("salidas")) or not _es_lista_textos(valor.get("entradas")):
            falla(IR_ESTRUCTURA_INVALIDA, "salidas y entradas deben ser listas de texto", elemento_id)
        if "valor_inicial" in valor and not coincide_tipo_dato(valor["valor_inicial"], tipo_dato):
            falla(IR_TIPO_DATO_INVALIDO, "valor_inicial no coincide con tipo_dato", elemento_id)

    elif tipo == "functional_block":
        if not isinstance(valor.get("habilitado"), bool):
            falla(IR_ESTRUCTURA_INVALIDA, "habilitado debe ser booleano", elemento_id)
        if not _es_lista_textos(valor.get("salidas")):
            falla(IR_ESTRUCTURA_INVALIDA, "salidas debe ser una lista de texto", elemento_id)
        entradas = valor.get("entradas")
        entradas_validas = isinstance(entradas, list)
        if entradas_validas:
            for entrada in entradas:
                if (
                    not isinstance(entrada, dict)
                    or not es_texto(entrada.get("puerto"))
                    or not es_texto(entrada.get("variable"))
                ):
                    entradas_validas = False
                    break
        if not entradas_validas:
            falla(IR_ESTRUCTURA_INVALIDA, "entradas debe ser una lista de { puerto, variable }", elemento_id)
        # Una clave ausente no equivale a ``null``: la web también la rechaza.
        if "expresion" not in valor:
            falla(IR_EXPRESION_INVALIDA, "la expresión no respeta la gramática de la IR v1", elemento_id)
        expresion = valor["expresion"]
        if expresion is not None:
            usadas = set()
            if not validar_expresion(expresion, usadas):
                falla(IR_EXPRESION_INVALIDA, "la expresión no respeta la gramática de la IR v1", elemento_id)
            if profundidad(expresion) > MAX_PROFUNDIDAD:
                falla(
                    IR_LIMITE_EXCEDIDO,
                    "la expresión supera la profundidad {}".format(MAX_PROFUNDIDAD),
                    elemento_id,
                )
            declaradas = set(entrada["variable"] for entrada in entradas)
            for variable in sorted(usadas):
                if variable not in declaradas:
                    falla(
                        IR_REFERENCIA_INVALIDA,
                        "la variable «{}» no corresponde a ninguna entrada".format(variable),
                        elemento_id,
                    )

    elif tipo == "place":
        tokens = valor.get("tokens")
        capacidad = valor.get("capacidad")
        if (
            not _es_entero_no_negativo(tokens)
            or not _es_entero_no_negativo(capacidad)
            or tokens > capacidad
        ):
            falla(
                IR_ESTRUCTURA_INVALIDA,
                "tokens y capacidad deben ser enteros ≥ 0 y tokens ≤ capacidad",
                elemento_id,
            )

    else:
        if not isinstance(valor.get("habilitada"), bool):
            falla(IR_ESTRUCTURA_INVALIDA, "habilitada debe ser booleano", elemento_id)
        if "puerto_accion" not in valor or (
            valor["puerto_accion"] is not None and not es_texto(valor["puerto_accion"])
        ):
            falla(IR_ESTRUCTURA_INVALIDA, "puerto_accion debe ser texto o null", elemento_id)

    return valor


def _validar_conexion(valor, indice, elementos):
    def falla(codigo, detalle, conexion_id=None):
        etiqueta = conexion_id if conexion_id is not None else "#{}".format(indice)
        raise IrError(
            codigo,
            "Aviso en conexión {}: {}.".format(etiqueta, detalle),
            conexion_id=conexion_id,
        )

    if not isinstance(valor, dict) or not es_texto(valor.get("id")):
        falla(IR_ESTRUCTURA_INVALIDA, "debe ser un objeto con id de texto")
    conexion_id = valor["id"]
    tipo = valor.get("tipo")
    if tipo != "dato" and tipo != "arco":
        falla(IR_CONEXION_NO_SOPORTADA, "tipo debe ser «dato» o «arco»", conexion_id)

    origen_id = valor.get("origen")
    destino_id = valor.get("destino")
    origen = elementos.get(origen_id) if es_texto(origen_id) else None
    destino = elementos.get(destino_id) if es_texto(destino_id) else None
    if origen is None or destino is None:
        falla(IR_REFERENCIA_INVALIDA, "origen y destino deben ser elementos existentes", conexion_id)

    if tipo == "arco":
        lugar_a_transicion = origen["tipo"] == "place" and destino["tipo"] == "transition"
        transicion_a_lugar = origen["tipo"] == "transition" and destino["tipo"] == "place"
        if not lugar_a_transicion and not transicion_a_lugar:
            falla(IR_ARCO_INVALIDO, "un arco une un place con una transition", conexion_id)
        peso = valor.get("peso")
        if not es_entero(peso) or peso < 1:
            falla(IR_ARCO_INVALIDO, "peso debe ser un entero ≥ 1", conexion_id)
        return valor

    puerto_origen = valor.get("puerto_origen")
    if not es_texto(puerto_origen) or puerto_origen not in puertos_salida(origen):
        falla(
            IR_PUERTO_INVALIDO,
            "«{}» no es una salida de {}".format(puerto_origen, origen["id"]),
            conexion_id,
        )
    puerto_destino = valor.get("puerto_destino")
    if not es_texto(puerto_destino) or puerto_destino not in puertos_entrada(destino):
        falla(
            IR_PUERTO_INVALIDO,
            "«{}» no es una entrada de {}".format(puerto_destino, destino["id"]),
            conexion_id,
        )
    return valor


def orden_topologico(elementos, conexiones):
    """Kahn sobre conexiones ``dato`` conservando el orden de declaración.

    Retorna ``(orden, en_ciclo)`` con listas de identificadores.
    """

    grado = {}
    sucesores = {}
    for elemento in elementos:
        grado[elemento["id"]] = 0
        sucesores[elemento["id"]] = []
    for conexion in conexiones:
        if conexion["tipo"] != "dato":
            continue
        sucesores[conexion["origen"]].append(conexion["destino"])
        grado[conexion["destino"]] += 1

    pendientes = [elemento["id"] for elemento in elementos if grado[elemento["id"]] == 0]
    orden = []
    cursor = 0
    while cursor < len(pendientes):
        actual = pendientes[cursor]
        cursor += 1
        orden.append(actual)
        for sucesor in sucesores[actual]:
            grado[sucesor] -= 1
            if grado[sucesor] == 0:
                pendientes.append(sucesor)

    resueltos = set(orden)
    en_ciclo = [elemento["id"] for elemento in elementos if elemento["id"] not in resueltos]
    return orden, en_ciclo


def validate_ir_v1(modelo):
    """Valida un ``IrModeloV1`` y retorna ``{"elementos", "conexiones"}``.

    Lanza :class:`IrError` con el primer problema encontrado.
    """

    if (
        not isinstance(modelo, dict)
        or not isinstance(modelo.get("elementos"), list)
        or not isinstance(modelo.get("conexiones"), list)
    ):
        raise IrError(
            IR_ESTRUCTURA_INVALIDA,
            "Aviso: el modelo debe contener las listas elementos y conexiones.",
        )
    if len(modelo["elementos"]) > MAX_ELEMENTOS or len(modelo["conexiones"]) > MAX_CONEXIONES:
        raise IrError(
            IR_LIMITE_EXCEDIDO,
            "Aviso: la IR v1 admite hasta {} elementos y {} conexiones.".format(
                MAX_ELEMENTOS, MAX_CONEXIONES
            ),
        )

    elementos = []
    por_id = {}
    for indice, crudo in enumerate(modelo["elementos"]):
        elemento = _validar_elemento(crudo, indice)
        if elemento["id"] in por_id:
            raise IrError(
                IR_ID_DUPLICADO,
                "Aviso: el id {} está repetido.".format(elemento["id"]),
                elemento_id=elemento["id"],
            )
        por_id[elemento["id"]] = elemento
        elementos.append(elemento)

    conexiones = []
    ids_conexion = set()
    for indice, crudo in enumerate(modelo["conexiones"]):
        conexion = _validar_conexion(crudo, indice, por_id)
        if conexion["id"] in ids_conexion or conexion["id"] in por_id:
            raise IrError(
                IR_ID_DUPLICADO,
                "Aviso: el id {} está repetido.".format(conexion["id"]),
                conexion_id=conexion["id"],
            )
        ids_conexion.add(conexion["id"])
        conexiones.append(conexion)

    _, en_ciclo = orden_topologico(elementos, conexiones)
    if en_ciclo:
        raise IrError(
            IR_CICLO_DATOS,
            "Aviso: hay un ciclo de datos entre: {}.".format(", ".join(en_ciclo)),
        )
    return {"elementos": elementos, "conexiones": conexiones}


def validate_load_message(mensaje):
    """Valida el sobre de ``modelo/cargar`` y la IR que contiene.

    Retorna ``(modelo_id, version, modelo_validado)``. El tamaño en bytes del
    mensaje lo controla el transporte antes de decodificar el JSON.
    """

    if not isinstance(mensaje, dict):
        raise IrError(IR_ESTRUCTURA_INVALIDA, "modelo/cargar debe ser un objeto JSON.")
    if not es_texto(mensaje.get("id_mensaje")):
        raise IrError(IR_ESTRUCTURA_INVALIDA, "id_mensaje debe ser un texto no vacío.")
    if not es_texto(mensaje.get("modelo_id")):
        raise IrError(IR_ESTRUCTURA_INVALIDA, "modelo_id debe ser un texto no vacío.")
    version = mensaje.get("version")
    if not es_entero(version) or version < 1:
        raise IrError(IR_ESTRUCTURA_INVALIDA, "version debe ser un entero positivo.")
    ir_version = mensaje.get("ir_version")
    if isinstance(ir_version, bool) or ir_version != IR_VERSION:
        raise IrError(
            IR_VERSION_NO_SOPORTADA,
            "La Pico solo admite ir_version {}; se recibió {}.".format(IR_VERSION, ir_version),
        )
    modelo = validate_ir_v1(mensaje.get("modelo"))
    return mensaje["modelo_id"], int(version), modelo
