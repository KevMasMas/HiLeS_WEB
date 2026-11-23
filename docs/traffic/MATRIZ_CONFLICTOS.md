# Matriz demostrativa de conflictos

**Responsable:** Persona 1
**Fuente de verdad:** [`scripts/generate-distributed-traffic-demo.mjs`](../../scripts/generate-distributed-traffic-demo.mjs)

## Anillo y estado inicial

| Nodo | Entrada local | Functional Block | Siguiente | Token inicial |
|---|---|---|---|---:|
| Norte | `sensor-norte` | `decision-norte` | Este | 1 |
| Este | `sensor-este` | `decision-este` | Sur | 0 |
| Sur | `sensor-sur` | `decision-sur` | Oeste | 0 |
| Oeste | `sensor-oeste` | `decision-oeste` | Norte | 0 |

Todos comienzan en rojo. Cada nodo conserva localmente su red Petri completa;
solo las dos posibles cesiones de token cruzan al ejecutor siguiente.

## Fases permitidas

| Estado local | Entrada necesaria | Siguiente estado | Duración |
|---|---|---|---:|
| Rojo con token y demanda | rojo + token + `hay_demanda` | Verde | inmediata |
| Rojo con token sin demanda | rojo + token + `sin_demanda` | Rojo y cesión | inmediata |
| Verde | `ciclo_activo` | Amarillo | 3000 ms |
| Amarillo | `ciclo_activo` | Rojo y cesión | 1000 ms |
| Rojo sin token | mensaje del anterior | Rojo con token | inmediata |

## Exclusión mutua

Todo par de accesos diferentes es incompatible. La propiedad se obtiene de un
único permiso circulante, no de calcular un ganador central:

| Acceso | En conflicto con |
|---|---|
| Norte | Este, Sur, Oeste |
| Este | Norte, Sur, Oeste |
| Sur | Norte, Este, Oeste |
| Oeste | Norte, Este, Sur |

Una transición consume su pulso de guarda al dispararse. Esto evita reutilizar
un mensaje LCH anterior para recibir o ceder dos veces el mismo token. Las
pruebas comprueban un token inicial, ocho rutas remotas, verde → amarillo → rojo
y una sola recepción en el nodo siguiente.
