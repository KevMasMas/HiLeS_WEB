"""Acceso a los vectores de conformidad compartidos con el frontend."""

import json
from pathlib import Path

VECTORS_DIRECTORY = Path(__file__).resolve().parents[2] / "docs" / "mqtt" / "vectores_ir_v1"


def load_vectors(category):
    """Retorna ``[(nombre_archivo, contenido)]`` ordenados por nombre."""

    return [
        (path.name, json.loads(path.read_text(encoding="utf-8")))
        for path in sorted((VECTORS_DIRECTORY / category).glob("*.json"))
    ]


def place(element_id, tokens, capacidad=1):
    return {"id": element_id, "tipo": "place", "nombre": element_id, "tokens": tokens, "capacidad": capacidad}


def transition(element_id, habilitada=True, puerto_accion=None):
    return {
        "id": element_id,
        "tipo": "transition",
        "nombre": element_id,
        "habilitada": habilitada,
        "puerto_accion": puerto_accion,
    }


def service(element_id, tipo_dato="boolean", **extra):
    definicion = {
        "id": element_id,
        "tipo": "service",
        "nombre": element_id,
        "tipo_dato": tipo_dato,
        "salidas": [element_id + "-out"],
        "entradas": [],
    }
    definicion.update(extra)
    return definicion


def data(conn_id, origen, puerto_origen, destino, puerto_destino="condicion"):
    return {
        "id": conn_id,
        "tipo": "dato",
        "origen": origen,
        "puerto_origen": puerto_origen,
        "destino": destino,
        "puerto_destino": puerto_destino,
    }


def arc(conn_id, origen, destino, peso=1):
    return {"id": conn_id, "tipo": "arco", "origen": origen, "destino": destino, "peso": peso}
