# Matriz demostrativa de conflictos

**Responsable:** Juan Ramos (Persona 3)
**Fuente de verdad del ejemplo manual:** [`scripts/generate-distributed-traffic-demo.mjs`](../../scripts/generate-distributed-traffic-demo.mjs). La matriz solo permite que el Functional Block `Seguridad del cruce` detecte combinaciones introducidas manualmente; no existe un controlador vial en el firmware.

## Movimientos

El ejemplo tiene cuatro accesos. Cada entrada `Sensor` es un Service entero
rellenado manualmente; no representa todavía un dispositivo físico.

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

Norte y Sur son compatibles entre sí. Lo mismo ocurre con Este y Oeste. El
Functional Block `Seguridad del cruce` usa esta matriz únicamente para señalar
combinaciones manuales incompatibles. No concede turnos, no controla tiempos y
no cambia colores automáticamente.

Los tiempos, la transición verde → amarillo → rojo y la conexión de sensores
reales quedan fuera de este demo manual. Cuando se implementen, deberán formar
parte del modelo o de un adaptador genérico de Services, no del firmware base.
