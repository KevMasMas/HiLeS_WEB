"""Runtime HiLeS para MicroPython.

El paquete no importa submódulos de forma anticipada. En una Pico W, cargar a
la vez los motores v1/v2 y el worker distribuido fragmenta la RAM antes de que
``main.build_default_application`` pueda construir las tareas. Los consumidores
deben importar las clases desde su módulo concreto.
"""

import sys


# Conserva la API histórica del paquete durante las pruebas de escritorio, pero
# evita los imports ansiosos en el dispositivo con memoria restringida.
if sys.implementation.name != "micropython":
    from .distributed_worker import (
        DistributedWorker,
        canonical_json_bytes,
        canonical_json_str,
        sha256_hex,
    )
    from .engine import HilesEngine, InputError
    from .engine_task import EngineTask
    from .engine_task_v2 import EngineTaskV2
    from .engine_v2 import HilesEngineV2
    from .model import IrError, validate_ir_v1, validate_load_message

    __all__ = (
        "DistributedWorker",
        "EngineTask",
        "EngineTaskV2",
        "HilesEngine",
        "HilesEngineV2",
        "InputError",
        "IrError",
        "canonical_json_bytes",
        "canonical_json_str",
        "sha256_hex",
        "validate_ir_v1",
        "validate_load_message",
    )
