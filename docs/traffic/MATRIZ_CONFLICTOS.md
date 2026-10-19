# Matriz de conflictos y tiempos del cruce

**Responsable:** Juan Ramos (Persona 3)
**Fuente de verdad:** `MATRIZ_CONFLICTOS` en [`firmware/pico/devices/traffic_controller.py`](../../firmware/pico/devices/traffic_controller.py). El generador [`scripts/generate-distributed-traffic-demo.mjs`](../../scripts/generate-distributed-traffic-demo.mjs) y este documento deben coincidir con ella; `firmware/tests/test_traffic_controller.py` lo comprueba automáticamente.

## Movimientos

El cruce tiene cuatro accesos. Cada acceso tiene un semáforo y un sensor de presencia propios:

| Sentido | Eje | Sensor (Service del demo) | Luz (Service del demo) |
|---|---|---|---|
| norte | Norte–Sur | `sensor-norte` | `luz-norte` |
| sur | Norte–Sur | `sensor-sur` | `luz-sur` |
| este | Este–Oeste | `sensor-este` | `luz-este` |
| oeste | Este–Oeste | `sensor-oeste` | `luz-oeste` |

## Pares incompatibles

Un sentido “activo” es un sentido en verde o amarillo. Dos sentidos incompatibles nunca pueden estar activos a la vez.

| Sentido | En conflicto con |
|---|---|
| norte | este |
| norte | oeste |
| sur | este |
| sur | oeste |
| este | norte |
| este | sur |
| oeste | norte |
| oeste | sur |

Norte y Sur son compatibles entre sí y pueden estar en verde al mismo tiempo. Lo mismo ocurre con Este y Oeste. La matriz debe ser simétrica y sin autoconflictos (`validate_conflict_matrix`).

## Tiempos por defecto

| Parámetro | Valor | Significado |
|---|---:|---|
| `verde_min_ms` | 5000 | Un verde dura al menos este tiempo, aunque desaparezca la demanda. |
| `verde_max_ms` | 20000 | Si hay una solicitud en conflicto esperando, el verde termina al alcanzar este tiempo. |
| `amarillo_ms` | 3000 | Duración fija del amarillo. Todo verde termina en amarillo. |
| `todo_rojo_ms` | 2000 | Tiempo mínimo en que todos los sentidos en conflicto deben estar en rojo antes de conceder un permiso. |
| `espera_max_ms` | 30000 | Si una solicitud en conflicto supera esta espera, el verde contrario cede en cuanto cumple `verde_min_ms`. |

Los tiempos se configuran con `TrafficTiming`. Son fechas límite medidas con el reloj del scheduler; ninguna tarea usa `sleep`.

## Espera máxima garantizada

Con demanda permanente en los cuatro sentidos, un sentido permanece en rojo como máximo:

```text
todo_rojo_ms + verde_max_ms + amarillo_ms + todo_rojo_ms + un periodo del controlador
= 2000 + 20000 + 3000 + 2000 + 100 ms ≈ 27,1 s
```

El primer `todo_rojo_ms` precede al verde del eje contrario; el segundo precede al propio. Si una solicitud supera `espera_max_ms`, el verde contrario cede apenas cumpla `verde_min_ms`, por lo que la espera queda acotada también por `espera_max_ms + amarillo_ms + todo_rojo_ms`. Ambos casos están cubiertos por pruebas.
