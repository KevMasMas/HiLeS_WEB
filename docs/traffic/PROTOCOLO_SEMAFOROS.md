# Protocolo de los cuatro semáforos independientes

**Responsable:** Juan Ramos (Persona 3)
**Entrega:** 20 de octubre de 2026
**Matriz y tiempos:** [`MATRIZ_CONFLICTOS.md`](MATRIZ_CONFLICTOS.md)

## 1. Arquitectura

```text
VehicleSensorTask ×4 ──reading()──▶ TrafficControllerTask ──show(color)──▶ TrafficLightOutput ×4 (opcional)
 (simulado o GPIO)                    │  4 × TrafficLightFsm                (GPIO)
                                      │  1 × IntersectionArbiter
                                      ├──on_change(estado)──▶ publicación (la define Persona 5)
                                      └──on_engine_input(servicio, valor)──▶ EngineTaskV2.submit_local_input
                                                                              │
                                                    demo-4-semaforos-distribuidos.json (modelo HiLeS)
                                                                              │
                                                       simulacion/estado ──▶ cuatro navegadores
```

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| `TrafficLightFsm` | `firmware/pico/devices/traffic_controller.py` | Estado privado de un sentido: color, presencia, solicitud y tiempos. Solo cambia de color por sí misma. |
| `IntersectionArbiter` | mismo archivo | Concede permisos de paso según la matriz. No conoce ni modifica estados internos de las FSM. |
| `TrafficControllerTask` | mismo archivo | Tarea cooperativa: lee sensores, consulta al árbitro, avanza cada FSM y vigila la seguridad. |
| `VehicleSensorTask` | `firmware/pico/devices/vehicle_sensor_task.py` | Muestreo, antirrebote y detección de fallas de un sensor. |
| `SimulatedVehicleSource`, `ScriptedVehicleSource`, `ManualVehicleSource` | mismo archivo | Simuladores de sensores sin hardware. |
| `GpioPresenceInput`, `TrafficLightOutput`, `build_traffic_io` | `firmware/pico/platform/traffic_io.py` | Adaptadores GPIO opcionales con `machine` inyectable. |
| Modelo HiLeS del demo | `output/demo-4-semaforos-distribuidos.json` | Refleja sensores, luces, lámparas, solicitudes y la matriz de conflictos en el canvas. |

## 2. Máquina de estados de cada sentido

```text
        permiso concedido y solicitud
ROJO ───────────────────────────────▶ VERDE
 ▲                                      │ verde ≥ verde_min y
 │ amarillo ≥ amarillo_ms               │ (sin presencia, o espera urgente en conflicto,
 │                                      │  o conflicto esperando y verde ≥ verde_max)
 └────────────── AMARILLO ◀─────────────┘
```

- Cada `update()` aplica como máximo un cambio de color por sentido.
- `VERDE → ROJO` directo está prohibido: `_go` lanza `RuntimeError` si se intentara.
- Una solicitud nace cuando el sentido está en rojo y su sensor detecta presencia. Termina cuando el sentido pasa a verde o desaparece la presencia.

## 3. Solicitudes y permisos de paso

1. Cada FSM publica una vista de solo lectura: color, instante desde el que está en ese color e instante de su solicitud.
2. El árbitro ordena las solicitudes pendientes de la más antigua a la más reciente. El orden fijo norte, sur, este, oeste desempata.
3. Una solicitud recibe permiso si:
   - ningún sentido en conflicto tiene permiso;
   - todos los sentidos en conflicto están en rojo desde hace al menos `todo_rojo_ms`;
   - ninguna solicitud más antigua y en conflicto con ella sigue bloqueada (no se adelanta a nadie).
4. Un permiso sirve para un solo ciclo verde. Se libera cuando el sentido vuelve a rojo después de usarlo, o cuando su solicitud desaparece sin usarlo.
5. El árbitro informa a cada sentido si debe ceder (hay una solicitud en conflicto esperando) y si la espera es urgente (supera `espera_max_ms`).

Los sentidos compatibles, como Norte y Sur, pueden tener permiso al mismo tiempo. Cada uno decide con su propio sensor si lo usa y cuánto dura su verde.

## 4. Seguridad y fail-safe

| Situación | Comportamiento |
|---|---|
| Sensor que retorna `None`, un valor que no es booleano ni `0`/`1`, o lanza una excepción | El sentido se trata como con presencia, se marca `sensor_valido: false` y sigue recibiendo servicio. |
| `VehicleSensorTask` sin lecturas válidas durante `falla_ms` | `reading()` retorna `None` (falla). Antes de ese plazo conserva la última lectura confiable. |
| Dos sentidos incompatibles activos (no debería ocurrir) | Entra en `modo: "seguro"`: revoca permisos, pasa los verdes a amarillo y no concede nada hasta que todos estén en rojo y se llame `reset_safe_mode()`. |
| Salida GPIO que falla | Se ignora la excepción; la lógica continúa. |
| Color desconocido en `TrafficLightOutput.show` | Se muestra rojo. |

## 5. Estado publicado

`on_change(estado)` se invoca solo cuando cambia algún color, presencia, validez de sensor, permiso o el modo:

```json
{
  "modo": "normal",
  "violaciones": 0,
  "sentidos": {
    "norte": {"color": "verde", "presencia": true, "sensor_valido": true, "solicitud": false,
              "espera_ms": 0, "en_estado_ms": 4200, "permiso": true}
  }
}
```

`on_engine_input(servicio_id, valor)` envía solo los valores que cambiaron hacia los Services `sensor-<sentido>` (boolean) y `luz-<sentido>` (string) del demo. Con `EngineTaskV2.submit_local_input` esos valores entran a la cola acotada del motor y se aplican en una `update()` posterior, sin MQTT ni `id_mensaje`.

## 6. Modelo HiLeS del demo

`node scripts/generate-distributed-traffic-demo.mjs` regenera `output/demo-4-semaforos-distribuidos.json`. El archivo no se edita a mano.

- Hay cuatro Structural Blocks, uno por sentido. Cada uno tiene su Service de sensor, su Service de luz y un Functional Block Python `Lámparas <Sentido>`, que produce `rojo`, `amarillo`, `verde` y `solicitud`.
- El bloque `Seguridad del cruce` es un Functional Block Python que recibe las cuatro luces y publica `seguro` y `eje` (`norte-sur`, `este-oeste`, `todo-rojo` o `conflicto`).
- El modelo compila a IR v2 con el compilador web sin errores ni advertencias: 13 elementos y 12 conexiones CCH. La IR compilada se guarda como fixture en `docs/traffic/ir_demo_semaforos_distribuidos.json` y las pruebas del firmware la ejecutan.

### Por qué las FSM no son una red de Petri dentro del modelo

La IR v2 aplica la política de conflicto de forma **global**: si dos transiciones cualesquiera están listas en el mismo paso, ninguna dispara. Cuatro FSM Petri concurrentes se bloquearían en cuanto dos sentidos cambiaran a la vez. Con retardos iguales, además, sus temporizadores se rearmarían juntos indefinidamente.

Serializarlas con un token de turno exige más de 64 elementos y 128 conexiones, que es el límite de la IR. Por eso las FSM y el árbitro se ejecutan como tareas de firmware y el modelo HiLeS refleja su estado oficial. Si Persona 2 limita el conflicto a transiciones que comparten Places de entrada, se podría estudiar una versión puramente Petri.

## 7. Integración pendiente (Persona 5, `main.py`)

```python
from devices.traffic_controller import TrafficControllerTask, TrafficTiming
from devices.vehicle_sensor_task import SimulatedVehicleSource, VehicleSensorTask
from hiles.engine_task_v2 import EngineTaskV2
from platform.traffic_io import build_traffic_io

engine_task = EngineTaskV2(scheduler, node, period_ms=20, step_interval_ms=1000, queue_size=16)
fuentes, salidas = build_traffic_io(config)  # vacío si no hay pines configurados
sensores = {
    sentido: VehicleSensorTask(scheduler, fuentes.get(sentido) or SimulatedVehicleSource(semilla), sentido)
    for semilla, sentido in enumerate(("norte", "sur", "este", "oeste"), start=1)
}
TrafficControllerTask(scheduler, sensores, timing=TrafficTiming(), outputs=salidas,
                      on_engine_input=engine_task.submit_local_input)
```

`EngineTaskV2` acepta IR v1 e IR v2 y puede sustituir a `EngineTask` sin cambiar los topics.
