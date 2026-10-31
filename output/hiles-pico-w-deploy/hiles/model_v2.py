"""Carga, migración y validación de la IR versión 2 recibida en ``modelo/cargar``.

Las reglas y su orden replican ``validarModeloIrV2``
(``frontend/src/services/ir/validadorIrV2.ts``). La web acumula diagnósticos;
aquí se lanza el primero, que es el mismo código que la web reporta en
``errores[0]``. Los valores y el perfil Python se validan exclusivamente con
``runtime_values`` y ``python_executor`` de Persona 1.
"""

try:
    import ujson as json
except ImportError:  # pragma: no cover - CPython usa json durante las pruebas
    import json

from .expressions import MAX_PROFUNDIDAD, es_numero, profundidad
from .model import (
    IR_ARCO_INVALIDO,
    IR_CICLO_DATOS,
    IR_CONEXION_NO_SOPORTADA,
    IR_ESTRUCTURA_INVALIDA,
    IR_EXPRESION_INVALIDA,
    IR_ID_DUPLICADO,
    IR_LIMITE_EXCEDIDO,
    IR_PUERTO_INVALIDO,
    IR_REFERENCIA_INVALIDA,
    IR_TIPO_DATO_INVALIDO,
    IR_TIPO_NO_SOPORTADO,
    IR_VERSION_NO_SOPORTADA,
    MAX_CONEXIONES,
    MAX_ELEMENTOS,
    PUERTO_CONDICION,
    IrError,
    es_entero,
    es_texto,
    validate_ir_v1,
)
from .python_executor import (
    FORBIDDEN_WORDS,
    MAX_INPUTS,
    MAX_OUTPUTS,
    PYTHON_CODIGO_INVALIDO,
    PYTHON_COMPILACION_ERROR,
    PYTHON_PERFIL_PROHIBIDO,
    PythonExecutorError,
    validate_python_source,
)
from .runtime_values import RuntimeValueError, validate_runtime_value

IR_VERSION_V2 = 2
IR_VERSIONES_SOPORTADAS = (1, 2)

IR_CAPACIDAD_INVALIDA = "IR_CAPACIDAD_INVALIDA"
IR_RETARDO_INVALIDO = "IR_RETARDO_INVALIDO"
IR_CODIGO_NO_SOPORTADO = "IR_CODIGO_NO_SOPORTADO"

TIPOS_DATO_V2 = ("boolean", "integer", "real", "string", "vector", "custom")
CANALES = ("cch", "dch", "lch")

DEFAULT_DCH_QUEUE_CAPACITY = 8
MAX_DCH_QUEUE_CAPACITY = 32
MAX_DELAY_MS = 600000
MAX_MODELO_BYTES = 31744

_CLAVES_IR_V2_COMPACTAS = {
    "v": "ir_version", "m": "modelo_id", "w": "version",
    "x": "entradas_externas", "e": "elementos", "c": "conexiones",
    "d": "elemento_id", "q": "puerto_salida", "t": "tipo_dato",
    "z": "valor_inicial", "i": "id", "y": "tipo", "s": "salidas",
    "a": "entradas", "o": "codigo", "p": "puerto", "b": "variable",
    "g": "origen", "j": "puerto_origen", "k": "destino",
    "u": "puerto_destino",
}

OPERADORES_UNARIOS_V2 = ("-", "+", "!", "not")
OPERADORES_BINARIOS_V2 = (
    "==", "!=", "<", "<=", ">", ">=", "+", "-", "*", "/", "%",
    "and", "or", "&&", "||",
)


def _falla(codigo, mensaje, elemento_id=None, conexion_id=None):
    raise IrError(codigo, mensaje, elemento_id=elemento_id, conexion_id=conexion_id)


def _indice_base36(texto):
    indice = 0
    if not texto:
        return None
    for caracter in texto:
        if "0" <= caracter <= "9":
            digito = ord(caracter) - ord("0")
        elif "a" <= caracter <= "z":
            digito = ord(caracter) - ord("a") + 10
        else:
            return None
        indice = indice * 36 + digito
    return indice


def _expandir_valor_ir_v2_compacto(valor, diccionario):
    if isinstance(valor, list):
        for indice in range(len(valor)):
            valor[indice] = _expandir_valor_ir_v2_compacto(valor[indice], diccionario)
        return valor
    if isinstance(valor, dict):
        for clave in list(valor):
            hijo = _expandir_valor_ir_v2_compacto(valor[clave], diccionario)
            clave_expandida = _CLAVES_IR_V2_COMPACTAS.get(clave, clave)
            if clave_expandida != clave:
                del valor[clave]
            valor[clave_expandida] = hijo
        return valor
    if isinstance(valor, str) and valor.startswith("$"):
        if valor.startswith("$$"):
            return valor[1:]
        indice = _indice_base36(valor[1:])
        if indice is None or indice >= len(diccionario):
            _falla(IR_ESTRUCTURA_INVALIDA, "Referencia inválida en el diccionario IR v2 compacto.")
        return diccionario[indice]
    return valor


def _expandir_modelo_ir_v2_compacto(modelo):
    if not isinstance(modelo, dict) or modelo.get("_f") != "ir2c1":
        return modelo
    diccionario = modelo.get("_d")
    contenido = modelo.get("_m")
    if (
        not isinstance(diccionario, list)
        or not all(isinstance(valor, str) for valor in diccionario)
        or not isinstance(contenido, dict)
    ):
        _falla(IR_ESTRUCTURA_INVALIDA, "El modelo IR v2 compacto es inválido.")
    return _expandir_valor_ir_v2_compacto(contenido, diccionario)


def _es_texto_limpio(valor):
    return isinstance(valor, str) and valor.strip() != ""


def _es_entero_no_negativo(valor):
    return es_entero(valor) and valor >= 0


def _validar_retardo(contenedor, elemento_id=None, conexion_id=None):
    if "retardo_ms" not in contenedor:
        return
    retardo = contenedor["retardo_ms"]
    if not es_entero(retardo) or retardo < 0 or retardo > MAX_DELAY_MS:
        _falla(
            IR_RETARDO_INVALIDO,
            "retardo_ms debe ser un entero entre 0 y {}.".format(MAX_DELAY_MS),
            elemento_id,
            conexion_id,
        )


def _validar_valor_inicial(valor, tipo_dato, contexto, elemento_id):
    try:
        validate_runtime_value(valor, tipo_dato, "valor_inicial")
    except RuntimeValueError as error:
        codigo = IR_TIPO_DATO_INVALIDO if error.codigo == "VALOR_TIPO_INVALIDO" else error.codigo
        _falla(
            codigo,
            "valor_inicial inválido en {} '{}': {}".format(contexto, elemento_id, error.mensaje),
            elemento_id,
        )


def _validar_expresion_ast(expresion, usadas):
    """Gramática canónica ``{lit} | {var} | {op, args}`` de la IR."""

    if not isinstance(expresion, dict):
        return False
    claves = len(expresion)
    if claves == 1 and "lit" in expresion:
        literal = expresion["lit"]
        return isinstance(literal, (bool, str)) or es_numero(literal)
    if claves == 1 and "var" in expresion:
        if not _es_texto_limpio(expresion["var"]):
            return False
        usadas.add(expresion["var"])
        return True
    if claves == 2 and "op" in expresion and "args" in expresion:
        operador = expresion["op"]
        argumentos = expresion["args"]
        if not isinstance(operador, str) or not isinstance(argumentos, list):
            return False
        if len(argumentos) == 1 and operador in OPERADORES_UNARIOS_V2:
            return _validar_expresion_ast(argumentos[0], usadas)
        if len(argumentos) == 2 and operador in OPERADORES_BINARIOS_V2:
            return _validar_expresion_ast(argumentos[0], usadas) and _validar_expresion_ast(
                argumentos[1], usadas
            )
    return False


def _normalizar_puertos(lista, prefijo):
    """Acepta ``["id"]`` (forma v1) o ``[{puerto, variable, tipo_dato}]``."""

    if not isinstance(lista, list):
        return None
    resultado = []
    for indice, item in enumerate(lista):
        if _es_texto_limpio(item):
            variable = prefijo if indice == 0 else "{}_{}".format(prefijo, indice + 1)
            resultado.append({"puerto": item, "variable": variable, "tipo_dato": "real"})
        elif (
            isinstance(item, dict)
            and _es_texto_limpio(item.get("puerto"))
            and _es_texto_limpio(item.get("variable"))
        ):
            tipo = item.get("tipo_dato")
            resultado.append({
                "puerto": item["puerto"],
                "variable": item["variable"],
                "tipo_dato": tipo if isinstance(tipo, str) else "real",
            })
        else:
            return None
    return resultado


def _es_identificador_python(valor):
    if not isinstance(valor, str) or not valor:
        return False
    primero = valor[0]
    if not (primero == "_" or "a" <= primero <= "z" or "A" <= primero <= "Z"):
        return False
    for caracter in valor[1:]:
        if not (
            caracter == "_"
            or caracter.isdigit()
            or "a" <= caracter <= "z"
            or "A" <= caracter <= "Z"
        ):
            return False
    return True


def _validar_firma_python(codigo, entradas, salidas, elemento_id):
    """Replica la validación de puertos y parámetros del contrato web v2."""

    if len(entradas) > MAX_INPUTS or len(salidas) > MAX_OUTPUTS:
        _falla(
            PYTHON_CODIGO_INVALIDO,
            "Bloque funcional '{}': se permiten máximo {} entradas y {} salidas.".format(
                elemento_id, MAX_INPUTS, MAX_OUTPUTS
            ),
            elemento_id,
        )

    for etiqueta, descriptores in (("entrada", entradas), ("salida", salidas)):
        puertos = set()
        variables = set()
        for descriptor in descriptores:
            puerto = descriptor["puerto"]
            variable = descriptor["variable"]
            tipo_dato = descriptor["tipo_dato"]
            if (
                not _es_identificador_python(variable)
                or variable in FORBIDDEN_WORDS
                or variable.startswith("__")
            ):
                _falla(
                    PYTHON_CODIGO_INVALIDO,
                    "Bloque funcional '{}': variable '{}' de {} no permitida.".format(
                        elemento_id, variable, etiqueta
                    ),
                    elemento_id,
                )
            if tipo_dato not in TIPOS_DATO_V2:
                _falla(
                    PYTHON_CODIGO_INVALIDO,
                    "Bloque funcional '{}': tipo_dato '{}' inválido en {}.".format(
                        elemento_id, tipo_dato, etiqueta
                    ),
                    elemento_id,
                )
            if puerto in puertos or variable in variables:
                repetido = puerto if puerto in puertos else variable
                _falla(
                    PYTHON_CODIGO_INVALIDO,
                    "Bloque funcional '{}': identificador duplicado '{}' en {}.".format(
                        elemento_id, repetido, etiqueta
                    ),
                    elemento_id,
                )
            puertos.add(puerto)
            variables.add(variable)

    modo = validate_python_source(codigo)
    if modo != "function":
        return

    lineas = [
        linea.strip()
        for linea in codigo.splitlines()
        if linea.strip() and not linea.lstrip().startswith("#")
    ]
    cabecera = lineas[0] if lineas else ""
    prefijo = "def calcular("
    if not cabecera.startswith(prefijo) or not cabecera.endswith(":"):
        _falla(
            PYTHON_COMPILACION_ERROR,
            "Bloque funcional '{}': firma inválida de calcular().".format(elemento_id),
            elemento_id,
        )
    cierre = cabecera.rfind(")")
    if cierre < len(prefijo) or cabecera[cierre + 1:].strip() != ":":
        _falla(
            PYTHON_COMPILACION_ERROR,
            "Bloque funcional '{}': firma inválida de calcular().".format(elemento_id),
            elemento_id,
        )

    declaradas = set(item["variable"] for item in entradas)
    parametros = cabecera[len(prefijo):cierre].strip()
    kwargs_encontrado = False
    if parametros:
        for parametro in parametros.split(","):
            parametro = parametro.strip()
            if parametro.startswith("**"):
                nombre = parametro[2:].strip()
                if kwargs_encontrado or not _es_identificador_python(nombre):
                    _falla(
                        PYTHON_PERFIL_PROHIBIDO,
                        "Bloque funcional '{}': firma **kwargs inválida.".format(elemento_id),
                        elemento_id,
                    )
                kwargs_encontrado = True
                continue
            if parametro.startswith("*") or "=" in parametro or not _es_identificador_python(parametro):
                _falla(
                    PYTHON_PERFIL_PROHIBIDO,
                    "Bloque funcional '{}': parámetro '{}' no permitido.".format(
                        elemento_id, parametro
                    ),
                    elemento_id,
                )
            if parametro not in declaradas:
                _falla(
                    PYTHON_CODIGO_INVALIDO,
                    "Bloque funcional '{}': el parámetro '{}' no corresponde a una entrada declarada.".format(
                        elemento_id, parametro
                    ),
                    elemento_id,
                )


def _copiar_retardo(origen, destino):
    if "retardo_ms" in origen and es_numero(origen["retardo_ms"]):
        destino["retardo_ms"] = int(origen["retardo_ms"])


def _validar_service(el, elemento_id, nombre):
    tipo_dato = el.get("tipo_dato")
    if tipo_dato not in TIPOS_DATO_V2:
        _falla(
            IR_TIPO_DATO_INVALIDO,
            "tipo_dato '{}' inválido en service '{}'.".format(tipo_dato, elemento_id),
            elemento_id,
        )
    salidas = el.get("salidas")
    entradas = el.get("entradas")
    if not (
        isinstance(salidas, list)
        and all(_es_texto_limpio(s) for s in salidas)
        and isinstance(entradas, list)
        and all(_es_texto_limpio(s) for s in entradas)
    ):
        _falla(
            IR_ESTRUCTURA_INVALIDA,
            "El service '{}' debe declarar listas válidas de entradas y salidas.".format(elemento_id),
            elemento_id,
        )
    resultado = {
        "id": elemento_id,
        "tipo": "service",
        "nombre": nombre,
        "tipo_dato": tipo_dato,
        "salidas": list(salidas),
        "entradas": list(entradas),
    }
    if "valor_inicial" in el:
        _validar_valor_inicial(el["valor_inicial"], tipo_dato, "service", elemento_id)
        resultado["valor_inicial"] = el["valor_inicial"]
    _validar_retardo(el, elemento_id)
    _copiar_retardo(el, resultado)
    return resultado, set(entradas), set(salidas)


def _validar_functional_block(el, elemento_id, nombre):
    if "habilitado" in el and not isinstance(el["habilitado"], bool):
        _falla(IR_ESTRUCTURA_INVALIDA, "habilitado en '{}' debe ser booleano.".format(elemento_id), elemento_id)
    entradas = _normalizar_puertos(el.get("entradas"), "in")
    salidas = _normalizar_puertos(el.get("salidas"), "out")
    if entradas is None or salidas is None or not salidas:
        _falla(
            IR_ESTRUCTURA_INVALIDA,
            "El bloque funcional '{}' debe definir arreglos válidos de entradas y al menos una salida.".format(
                elemento_id
            ),
            elemento_id,
        )
    lenguaje = el.get("lenguaje")
    if lenguaje is not None and lenguaje not in ("python", "expresion"):
        _falla(
            IR_CODIGO_NO_SOPORTADO,
            "El lenguaje '{}' en '{}' no está soportado en IR v2.".format(lenguaje, elemento_id),
            elemento_id,
        )
    es_python = lenguaje == "python" or isinstance(el.get("codigo"), str)
    resultado = {
        "id": elemento_id,
        "tipo": "functional_block",
        "nombre": nombre,
        "habilitado": el.get("habilitado") if isinstance(el.get("habilitado"), bool) else True,
        "lenguaje": "python" if es_python else "expresion",
        "entradas": entradas,
        "salidas": salidas,
    }
    if es_python:
        codigo = el.get("codigo")
        try:
            _validar_firma_python(codigo, entradas, salidas, elemento_id)
        except PythonExecutorError as error:
            _falla(error.codigo, "Bloque funcional '{}': {}".format(elemento_id, error.mensaje), elemento_id)
        resultado["codigo"] = codigo
    else:
        permitidas = set()
        for item in entradas:
            if item["tipo_dato"] not in TIPOS_DATO_V2:
                _falla(
                    IR_TIPO_DATO_INVALIDO,
                    "tipo_dato '{}' inválido en entrada de '{}'.".format(item["tipo_dato"], elemento_id),
                    elemento_id,
                )
            permitidas.add(item["variable"])
        for item in salidas:
            if item["tipo_dato"] not in TIPOS_DATO_V2:
                _falla(
                    IR_TIPO_DATO_INVALIDO,
                    "tipo_dato '{}' inválido en salida de '{}'.".format(item["tipo_dato"], elemento_id),
                    elemento_id,
                )
        expresion = el.get("expresion")
        if expresion is not None:
            usadas = set()
            if not _validar_expresion_ast(expresion, usadas):
                _falla(
                    IR_EXPRESION_INVALIDA,
                    "La expresión de '{}' no respeta la gramática de la IR v2.".format(elemento_id),
                    elemento_id,
                )
            if profundidad(expresion) > MAX_PROFUNDIDAD:
                _falla(
                    IR_LIMITE_EXCEDIDO,
                    "La expresión de '{}' supera la profundidad máxima {}.".format(elemento_id, MAX_PROFUNDIDAD),
                    elemento_id,
                )
            for variable in sorted(usadas):
                if variable not in permitidas:
                    _falla(
                        IR_REFERENCIA_INVALIDA,
                        "La variable '{}' no corresponde a ninguna entrada declarada de '{}'.".format(
                            variable, elemento_id
                        ),
                        elemento_id,
                    )
        resultado["expresion"] = expresion
    _validar_retardo(el, elemento_id)
    _copiar_retardo(el, resultado)
    return (
        resultado,
        set(item["puerto"] for item in entradas),
        set(item["puerto"] for item in salidas),
    )


def _puerto_texto(el, clave):
    valor = el.get(clave)
    return valor if _es_texto_limpio(valor) else ""


def _validar_sample(el, elemento_id, nombre):
    tipo_dato = el.get("tipo_dato", "real")
    if tipo_dato not in TIPOS_DATO_V2:
        _falla(
            IR_TIPO_DATO_INVALIDO,
            "tipo_dato '{}' inválido en sample '{}'.".format(tipo_dato, elemento_id),
            elemento_id,
        )
    dato = _puerto_texto(el, "puerto_dato")
    control = _puerto_texto(el, "puerto_control")
    salida = _puerto_texto(el, "puerto_salida")
    if not dato or not control or not salida:
        _falla(
            IR_ESTRUCTURA_INVALIDA,
            "Sample '{}' debe definir puerto_dato, puerto_control y puerto_salida.".format(elemento_id),
            elemento_id,
        )
    _validar_retardo(el, elemento_id)
    resultado = {
        "id": elemento_id,
        "tipo": "sample",
        "nombre": nombre,
        "habilitado": el.get("habilitado") if isinstance(el.get("habilitado"), bool) else True,
        "tipo_dato": tipo_dato,
        "puerto_dato": dato,
        "puerto_control": control,
        "puerto_salida": salida,
    }
    _copiar_retardo(el, resultado)
    return resultado, set((dato, control)), set((salida,))


def _validar_hold(el, elemento_id, nombre):
    tipo_dato = el.get("tipo_dato", "real")
    if tipo_dato not in TIPOS_DATO_V2:
        _falla(
            IR_TIPO_DATO_INVALIDO,
            "tipo_dato '{}' inválido en hold '{}'.".format(tipo_dato, elemento_id),
            elemento_id,
        )
    entrada = _puerto_texto(el, "puerto_entrada")
    cch = _puerto_texto(el, "puerto_cch")
    lch = _puerto_texto(el, "puerto_lch")
    if not entrada or not cch or not lch:
        _falla(
            IR_ESTRUCTURA_INVALIDA,
            "Hold '{}' debe definir puerto_entrada, puerto_cch y puerto_lch.".format(elemento_id),
            elemento_id,
        )
    resultado = {
        "id": elemento_id,
        "tipo": "hold",
        "nombre": nombre,
        "habilitado": el.get("habilitado") if isinstance(el.get("habilitado"), bool) else True,
        "tipo_dato": tipo_dato,
        "puerto_entrada": entrada,
        "puerto_cch": cch,
        "puerto_lch": lch,
    }
    if "valor_inicial" in el:
        _validar_valor_inicial(el["valor_inicial"], tipo_dato, "hold", elemento_id)
        resultado["valor_inicial"] = el["valor_inicial"]
    _validar_retardo(el, elemento_id)
    _copiar_retardo(el, resultado)
    return resultado, set((entrada,)), set((cch, lch))


def _validar_place(el, elemento_id, nombre):
    tokens = el.get("tokens")
    if not _es_entero_no_negativo(tokens):
        _falla(
            IR_ESTRUCTURA_INVALIDA,
            "tokens en place '{}' debe ser un entero >= 0.".format(elemento_id),
            elemento_id,
        )
    capacidad = el.get("capacidad")
    if not (capacidad is None and "capacidad" in el) and not _es_entero_no_negativo(capacidad):
        _falla(
            IR_CAPACIDAD_INVALIDA,
            "capacidad en place '{}' debe ser null o un entero >= 0.".format(elemento_id),
            elemento_id,
        )
    if capacidad is not None and tokens > capacidad:
        _falla(
            IR_CAPACIDAD_INVALIDA,
            "tokens iniciales ({}) exceden la capacidad ({}) en place '{}'.".format(tokens, capacidad, elemento_id),
            elemento_id,
        )
    resultado = {
        "id": elemento_id,
        "tipo": "place",
        "nombre": nombre,
        "tokens": int(tokens),
        "capacidad": None if capacidad is None else int(capacidad),
    }
    return resultado, set(), set()


def _validar_transition(el, elemento_id, nombre):
    if "habilitada" in el and not isinstance(el["habilitada"], bool):
        _falla(
            IR_ESTRUCTURA_INVALIDA,
            "habilitada en transition '{}' debe ser booleano.".format(elemento_id),
            elemento_id,
        )
    if "puerto_condicion" not in el:
        condicion = PUERTO_CONDICION
    else:
        condicion = _puerto_texto(el, "puerto_condicion")
    accion = el.get("puerto_accion")
    accion_valida = accion is None or _es_texto_limpio(accion)
    if not condicion or not accion_valida:
        _falla(
            IR_ESTRUCTURA_INVALIDA,
            "Transition '{}' debe definir puerto_condicion y puerto_accion válido.".format(elemento_id),
            elemento_id,
        )
    _validar_retardo(el, elemento_id)
    resultado = {
        "id": elemento_id,
        "tipo": "transition",
        "nombre": nombre,
        "habilitada": el.get("habilitada") if isinstance(el.get("habilitada"), bool) else True,
        "puerto_condicion": condicion,
        "puerto_accion": accion if isinstance(accion, str) else None,
    }
    _copiar_retardo(el, resultado)
    salidas = set((accion,)) if isinstance(accion, str) else set()
    return resultado, set((condicion, PUERTO_CONDICION)), salidas


_VALIDADORES = {
    "service": _validar_service,
    "functional_block": _validar_functional_block,
    "sample": _validar_sample,
    "hold": _validar_hold,
    "place": _validar_place,
    "transition": _validar_transition,
}


def migrate_v1_to_v2(modelo):
    """Convierte un ``IrModeloV1`` a ``IrModeloV2`` como ``migrarIrV1AV2``."""

    externas = []
    elementos = []
    for el in modelo["elementos"]:
        tipo = el.get("tipo")
        if tipo == "service":
            nuevo = {
                "id": el["id"], "tipo": "service", "nombre": el.get("nombre"),
                "tipo_dato": el.get("tipo_dato"), "salidas": list(el.get("salidas") or []),
                "entradas": list(el.get("entradas") or []),
            }
            if "valor_inicial" in el:
                nuevo["valor_inicial"] = el["valor_inicial"]
            if nuevo["salidas"] and not nuevo["entradas"]:
                externa = {
                    "elemento_id": el["id"], "nombre": el.get("nombre"),
                    "puerto_salida": nuevo["salidas"][0], "tipo_dato": el.get("tipo_dato"),
                }
                if "valor_inicial" in el:
                    externa["valor_inicial"] = el["valor_inicial"]
                externas.append(externa)
        elif tipo == "functional_block":
            salidas = []
            for indice, item in enumerate(el.get("salidas") or []):
                variable = "out" if indice == 0 else "out_{}".format(indice + 1)
                salidas.append({"puerto": item, "variable": variable, "tipo_dato": "boolean"})
            nuevo = {
                "id": el["id"], "tipo": "functional_block", "nombre": el.get("nombre"),
                "habilitado": el.get("habilitado"), "lenguaje": "expresion",
                "expresion": el.get("expresion"),
                "entradas": [
                    {"puerto": e["puerto"], "variable": e["variable"], "tipo_dato": "real"}
                    for e in el.get("entradas") or []
                ],
                "salidas": salidas,
            }
        elif tipo == "place":
            capacidad = el.get("capacidad")
            nuevo = {
                "id": el["id"], "tipo": "place", "nombre": el.get("nombre"),
                "tokens": el.get("tokens"),
                "capacidad": capacidad if es_entero(capacidad) and capacidad >= 1 else None,
            }
        else:
            nuevo = {
                "id": el["id"], "tipo": "transition", "nombre": el.get("nombre"),
                "habilitada": el.get("habilitada"), "puerto_condicion": PUERTO_CONDICION,
                "puerto_accion": el.get("puerto_accion"),
            }
        elementos.append(nuevo)

    por_id = {}
    for el in elementos:
        por_id[el["id"]] = el
    conexiones = []
    for c in modelo["conexiones"]:
        if c.get("tipo") == "arco":
            conexiones.append({
                "id": c["id"], "tipo": "arco", "origen": c["origen"],
                "destino": c["destino"], "peso": c["peso"],
            })
            continue
        origen = por_id.get(c.get("origen"))
        es_accion = (
            origen is not None
            and origen["tipo"] == "transition"
            and c.get("puerto_origen") == origen.get("puerto_accion")
        )
        conexiones.append({
            "id": c["id"], "tipo": "lch" if es_accion else "cch",
            "origen": c["origen"], "puerto_origen": c.get("puerto_origen"),
            "destino": c["destino"], "puerto_destino": c.get("puerto_destino"),
        })

    return {
        "ir_version": IR_VERSION_V2,
        "modelo_id": modelo.get("modelo_id") if _es_texto_limpio(modelo.get("modelo_id")) else "modelo-migrado-v1",
        "version": modelo.get("version") if es_entero(modelo.get("version")) and modelo.get("version") >= 1 else 1,
        "nombre": modelo.get("nombre") if _es_texto_limpio(modelo.get("nombre")) else "Modelo migrado desde IR v1",
        "metadata": {"normalizaciones_legadas": ["ir_v1_migrado_a_v2"]},
        "entradas_externas": externas,
        "elementos": elementos,
        "conexiones": conexiones,
    }


def orden_topologico_v2(elementos, conexiones):
    """Kahn sobre CCH/DCH sin retardo, como ``construirOrdenTopologico``."""

    grado = {}
    sucesores = {}
    for el in elementos:
        grado[el["id"]] = 0
        sucesores[el["id"]] = []
    for c in conexiones:
        if c["tipo"] in ("cch", "dch") and c.get("retardo_ms", 0) <= 0:
            sucesores[c["origen"]].append(c["destino"])
            grado[c["destino"]] += 1
    pendientes = [el["id"] for el in elementos if grado[el["id"]] == 0]
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
    return orden + [el["id"] for el in elementos if el["id"] not in resueltos]


def _detectar_ciclo(ids, adyacencia):
    """DFS equivalente a ``tieneCiclo`` del validador web."""

    estado = {}
    for inicio in ids:
        if inicio in estado:
            continue
        # Pila explícita: MicroPython tiene una pila de recursión pequeña.
        pila = [(inicio, iter(adyacencia[inicio]))]
        estado[inicio] = 1
        while pila:
            nodo, vecinos = pila[-1]
            avanzo = False
            for vecino in vecinos:
                marca = estado.get(vecino)
                if marca == 1:
                    return inicio
                if marca is None:
                    estado[vecino] = 1
                    pila.append((vecino, iter(adyacencia[vecino])))
                    avanzo = True
                    break
            if not avanzo:
                estado[nodo] = 2
                pila.pop()
    return None


def _bytes_json(valor):
    """Cuenta el JSON UTF-8 sin construir una segunda copia completa.

    En MicroPython un modelo válido puede caber como objetos dispersos en el
    heap aunque no quede un bloque contiguo para otro ``json.dumps`` completo.
    Serializar solo escalares mantiene el mismo límite con un pico pequeño.
    """
    if isinstance(valor, dict):
        total = 2
        primero = True
        for clave, hijo in valor.items():
            if not primero:
                total += 1
            primero = False
            total += _bytes_json(str(clave)) + 1 + _bytes_json(hijo)
        return total
    if isinstance(valor, (list, tuple)):
        total = 2
        for indice, hijo in enumerate(valor):
            if indice:
                total += 1
            total += _bytes_json(hijo)
        return total
    try:
        texto = json.dumps(valor, separators=(",", ":"), ensure_ascii=False)
    except TypeError:  # MicroPython no admite ensure_ascii ni separators.
        texto = json.dumps(valor)
    return len(texto.encode("utf-8"))


def _validar_conexiones(conexiones_raw, descriptores):
    ids = set()
    conexiones = []
    adyacencia = {}
    for elemento_id in descriptores:
        adyacencia[elemento_id] = []

    for indice, conn in enumerate(conexiones_raw):
        if not isinstance(conn, dict) or not _es_texto_limpio(conn.get("id")):
            _falla(IR_ESTRUCTURA_INVALIDA, "Cada conexión debe tener un id string no vacío (#{}).".format(indice))
        conexion_id = conn["id"]
        if conexion_id in ids or conexion_id in descriptores:
            _falla(IR_ID_DUPLICADO, "El identificador '{}' está duplicado.".format(conexion_id), conexion_id=conexion_id)
        ids.add(conexion_id)

        origen_id = conn.get("origen") if isinstance(conn.get("origen"), str) else ""
        destino_id = conn.get("destino") if isinstance(conn.get("destino"), str) else ""
        origen = descriptores.get(origen_id)
        destino = descriptores.get(destino_id)
        if origen is None:
            _falla(
                IR_REFERENCIA_INVALIDA,
                "La conexión '{}' referencia un elemento origen inexistente '{}'.".format(conexion_id, origen_id),
                conexion_id=conexion_id,
            )
        if destino is None:
            _falla(
                IR_REFERENCIA_INVALIDA,
                "La conexión '{}' referencia un elemento destino inexistente '{}'.".format(conexion_id, destino_id),
                conexion_id=conexion_id,
            )

        tipo = "cch" if conn.get("tipo") == "dato" else conn.get("tipo")
        if tipo in CANALES:
            puerto_origen = conn.get("puerto_origen") if isinstance(conn.get("puerto_origen"), str) else ""
            puerto_destino = conn.get("puerto_destino") if isinstance(conn.get("puerto_destino"), str) else ""
            if puerto_origen not in origen[2]:
                _falla(
                    IR_PUERTO_INVALIDO,
                    "El puerto de salida '{}' no existe en el elemento '{}'.".format(puerto_origen, origen_id),
                    origen_id,
                    conexion_id,
                )
            if puerto_destino not in destino[1]:
                _falla(
                    IR_PUERTO_INVALIDO,
                    "El puerto de entrada '{}' no existe en el elemento '{}'.".format(puerto_destino, destino_id),
                    destino_id,
                    conexion_id,
                )
            _validar_retardo(conn, conexion_id=conexion_id)
            nueva = {
                "id": conexion_id,
                "tipo": tipo,
                "origen": origen_id,
                "puerto_origen": puerto_origen,
                "destino": destino_id,
                "puerto_destino": puerto_destino,
            }
            if tipo == "dch" and "capacidad_cola" in conn:
                capacidad = conn["capacidad_cola"]
                if not es_entero(capacidad) or capacidad < 1 or capacidad > MAX_DCH_QUEUE_CAPACITY:
                    _falla(
                        IR_CAPACIDAD_INVALIDA,
                        "capacidad_cola en conexión DCH '{}' debe ser un entero entre 1 y {}.".format(
                            conexion_id, MAX_DCH_QUEUE_CAPACITY
                        ),
                        conexion_id=conexion_id,
                    )
                nueva["capacidad_cola"] = int(capacidad)
            _copiar_retardo(conn, nueva)
            if (
                tipo in ("cch", "dch")
                and nueva.get("retardo_ms", 0) == 0
                and origen[0] != "place"
                and destino[0] != "place"
            ):
                adyacencia[origen_id].append(destino_id)
            conexiones.append(nueva)
        elif tipo == "arco":
            valido = (origen[0] == "place" and destino[0] == "transition") or (
                origen[0] == "transition" and destino[0] == "place"
            )
            if not valido:
                _falla(
                    IR_ARCO_INVALIDO,
                    "El arco '{}' debe conectar Place -> Transition o Transition -> Place (actual: {} -> {}).".format(
                        conexion_id, origen[0], destino[0]
                    ),
                    conexion_id=conexion_id,
                )
            peso = conn.get("peso")
            if not es_entero(peso) or peso < 1:
                _falla(IR_ARCO_INVALIDO, "El peso del arco '{}' debe ser un entero >= 1.".format(conexion_id), conexion_id=conexion_id)
            conexiones.append({
                "id": conexion_id, "tipo": "arco", "origen": origen_id,
                "destino": destino_id, "peso": int(peso),
            })
        else:
            _falla(
                IR_CONEXION_NO_SOPORTADA,
                "El tipo de conexión '{}' en '{}' no está soportado en IR v2.".format(conn.get("tipo"), conexion_id),
                conexion_id=conexion_id,
            )

    en_ciclo = _detectar_ciclo(list(adyacencia.keys()), adyacencia)
    if en_ciclo is not None:
        _falla(IR_CICLO_DATOS, "Se detectó un ciclo algebraico en el flujo de datos.", en_ciclo)
    return conexiones


def validate_ir_v2(modelo):
    """Valida un ``IrModeloV2`` (o un ``IrModeloV1`` que se migra antes).

    Retorna el modelo normalizado o lanza :class:`IrError` con el primer
    diagnóstico, igual que ``errores[0]`` en la web.
    """

    if not isinstance(modelo, dict):
        _falla(IR_ESTRUCTURA_INVALIDA, "El modelo IR debe ser un objeto JSON en la raíz.")
    if (
        modelo.get("ir_version") == 1
        and not isinstance(modelo.get("ir_version"), bool)
        and isinstance(modelo.get("elementos"), list)
        and isinstance(modelo.get("conexiones"), list)
    ):
        modelo = migrate_v1_to_v2(modelo)

    if "ir_version" in modelo and (
        isinstance(modelo["ir_version"], bool) or modelo["ir_version"] not in IR_VERSIONES_SOPORTADAS
    ):
        _falla(
            IR_VERSION_NO_SOPORTADA,
            "ir_version '{}' no soportada. Se esperaba 2 (o 1 para compatibilidad).".format(modelo["ir_version"]),
        )
    if "modelo_id" in modelo and not _es_texto_limpio(modelo["modelo_id"]):
        _falla(IR_ESTRUCTURA_INVALIDA, "modelo_id debe ser un string no vacío.")
    if "version" in modelo and not (es_entero(modelo["version"]) and modelo["version"] >= 1):
        _falla(IR_ESTRUCTURA_INVALIDA, "version debe ser un entero mayor o igual a 1.")
    if "nombre" in modelo and not _es_texto_limpio(modelo["nombre"]):
        _falla(IR_ESTRUCTURA_INVALIDA, "nombre debe ser un string no vacío.")
    if not isinstance(modelo.get("elementos"), list):
        _falla(IR_ESTRUCTURA_INVALIDA, "elementos debe ser un arreglo.")
    if not isinstance(modelo.get("conexiones"), list):
        _falla(IR_ESTRUCTURA_INVALIDA, "conexiones debe ser un arreglo.")
    if "entradas_externas" in modelo and not isinstance(modelo["entradas_externas"], list):
        _falla(IR_ESTRUCTURA_INVALIDA, "entradas_externas debe ser un arreglo.")

    elementos_raw = modelo["elementos"]
    conexiones_raw = modelo["conexiones"]
    if len(elementos_raw) > MAX_ELEMENTOS or len(conexiones_raw) > MAX_CONEXIONES:
        _falla(
            IR_LIMITE_EXCEDIDO,
            "La IR v2 admite hasta {} elementos y {} conexiones.".format(MAX_ELEMENTOS, MAX_CONEXIONES),
        )

    # descriptor: (tipo, puertos_entrada, puertos_salida)
    descriptores = {}
    elementos = []
    for indice, el in enumerate(elementos_raw):
        if not isinstance(el, dict) or not _es_texto_limpio(el.get("id")):
            _falla(IR_ESTRUCTURA_INVALIDA, "Cada elemento debe ser un objeto con id no vacío (#{}).".format(indice))
        elemento_id = el["id"]
        if elemento_id in descriptores:
            _falla(
                IR_ID_DUPLICADO,
                "El elemento '{}' está duplicado en el modelo IR.".format(elemento_id),
                elemento_id,
            )
        if "nombre" in el and not isinstance(el["nombre"], str):
            _falla(IR_ESTRUCTURA_INVALIDA, "nombre en '{}' debe ser texto.".format(elemento_id), elemento_id)
        nombre = el["nombre"] if _es_texto_limpio(el.get("nombre")) else elemento_id
        validador = _VALIDADORES.get(el.get("tipo"))
        if validador is None:
            _falla(
                IR_TIPO_NO_SOPORTADO,
                "El tipo de elemento '{}' en '{}' no está soportado en IR v2.".format(el.get("tipo"), elemento_id),
                elemento_id,
            )
        normalizado, entradas, salidas = validador(el, elemento_id, nombre)
        descriptores[elemento_id] = (normalizado["tipo"], entradas, salidas)
        elementos.append(normalizado)

    externas = []
    for ext in modelo.get("entradas_externas") or []:
        if not isinstance(ext, dict) or not isinstance(ext.get("elemento_id"), str):
            _falla(IR_ESTRUCTURA_INVALIDA, "Cada entrada externa debe indicar elemento_id.")
        descriptor = descriptores.get(ext["elemento_id"])
        if descriptor is None or descriptor[0] != "service":
            _falla(
                IR_REFERENCIA_INVALIDA,
                "La entrada externa referencia un service inexistente '{}'.".format(ext["elemento_id"]),
                ext["elemento_id"],
            )
        if not isinstance(ext.get("puerto_salida"), str) or ext["puerto_salida"] not in descriptor[2]:
            _falla(
                IR_PUERTO_INVALIDO,
                "El puerto '{}' no existe en el service '{}'.".format(ext.get("puerto_salida"), ext["elemento_id"]),
                ext["elemento_id"],
            )
        if ext.get("tipo_dato") not in TIPOS_DATO_V2:
            _falla(
                IR_TIPO_DATO_INVALIDO,
                "tipo_dato '{}' inválido en entrada externa '{}'.".format(ext.get("tipo_dato"), ext["elemento_id"]),
                ext["elemento_id"],
            )
        if "valor_inicial" in ext:
            _validar_valor_inicial(ext["valor_inicial"], ext["tipo_dato"], "entrada externa", ext["elemento_id"])
        externas.append(ext)

    conexiones = _validar_conexiones(conexiones_raw, descriptores)

    resultado = {
        "ir_version": IR_VERSION_V2,
        "modelo_id": modelo.get("modelo_id", "modelo-ir-v2"),
        "version": int(modelo.get("version", 1)),
        "nombre": modelo.get("nombre", modelo.get("modelo_id", "Modelo IR v2")),
        "entradas_externas": externas,
        "elementos": elementos,
        "conexiones": conexiones,
    }
    tamano = _bytes_json(resultado)
    if tamano > MAX_MODELO_BYTES:
        _falla(
            IR_LIMITE_EXCEDIDO,
            "El modelo IR v2 ocupa {} bytes y supera el máximo de {} bytes.".format(tamano, MAX_MODELO_BYTES),
        )
    return resultado


def validate_load_message_v2(mensaje):
    """Valida el sobre de ``modelo/cargar`` para IR v1 o v2.

    Retorna ``(modelo_id, version, ir_version, modelo_validado)``. Un sobre con
    ``ir_version: 1`` conserva la validación y el motor de la IR v1.
    """

    if not isinstance(mensaje, dict):
        _falla(IR_ESTRUCTURA_INVALIDA, "modelo/cargar debe ser un objeto JSON.")
    if not es_texto(mensaje.get("id_mensaje")):
        _falla(IR_ESTRUCTURA_INVALIDA, "id_mensaje debe ser un texto no vacío.")
    if not es_texto(mensaje.get("modelo_id")):
        _falla(IR_ESTRUCTURA_INVALIDA, "modelo_id debe ser un texto no vacío.")
    version = mensaje.get("version")
    if not es_entero(version) or version < 1:
        _falla(IR_ESTRUCTURA_INVALIDA, "version debe ser un entero positivo.")
    ir_version = mensaje.get("ir_version")
    if isinstance(ir_version, bool) or ir_version not in IR_VERSIONES_SOPORTADAS:
        _falla(
            IR_VERSION_NO_SOPORTADA,
            "La Pico admite ir_version 1 o 2; se recibió {}.".format(ir_version),
        )
    if ir_version == 1:
        modelo = validate_ir_v1(mensaje.get("modelo"))
    else:
        modelo_expandido = _expandir_modelo_ir_v2_compacto(mensaje.get("modelo"))
        mensaje["modelo"] = modelo_expandido
        modelo = validate_ir_v2(modelo_expandido)
    return mensaje["modelo_id"], int(version), int(ir_version), modelo
