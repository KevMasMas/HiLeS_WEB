# Demo manual de cuatro semáforos

Este modelo es solamente un ejemplo construido con componentes generales de
HiLeS. El firmware no contiene controladores, sensores, GPIO ni configuración
especial para tráfico.

## Arquitectura

Cada sentido contiene:

- un Service `vehiculos_esperando` de tipo `integer`;
- un Service `luz` de tipo `string`;
- un Functional Block Python con salidas `rojo`, `amarillo`, `verde` y
  `solicitud`.

El usuario selecciona los Services en el panel de simulación, introduce sus
valores y los envía a la Pico. La Pico ejecuta los Functional Blocks como
cualquier otro modelo y publica la instantánea oficial por MQTT.

Los contadores comienzan en `0` y las luces comienzan en `rojo`. Por eso la
prueba básica solo requiere escribir una cantidad en un Service `Sensor` y
ejecutar un paso. Cambiar un Service `Luz` es opcional y sirve para probar las
lámparas o el detector de conflictos.

| Service | Tipo | Ejemplos |
|---|---|---|
| `sensor-norte`, `sensor-sur`, `sensor-este`, `sensor-oeste` | `integer` | `0`, `3`, `8` |
| `luz-norte`, `luz-sur`, `luz-este`, `luz-oeste` | `string` | `rojo`, `amarillo`, `verde` |

`0` significa que no hay vehículos esperando. Una cantidad positiva produce
`solicitud = true` cuando la luz introducida manualmente es `rojo`.

El bloque `Seguridad del cruce` recibe las cuatro luces y detecta si se
introdujeron manualmente colores incompatibles. No controla las luces ni
implementa una FSM automática.

## Alcance actual

- Sí demuestra carga de un modelo general, entradas manuales de Services,
  ejecución Python en la Pico y resultados compartidos por MQTT.
- No incorpora sensores físicos.
- No incorpora lógica vial en `main.py`.
- No cambia automáticamente verde → amarillo → rojo.
- La conexión futura de sensores debe implementarse mediante un adaptador de
  entradas genérico para Services, sin modificar el motor ni añadir un
  controlador específico del ejemplo.

## Regeneración

```powershell
node scripts/generate-distributed-traffic-demo.mjs
```

El comando regenera `output/demo-4-semaforos-distribuidos.json`. La IR v2 de
prueba está en `docs/traffic/ir_demo_semaforos_distribuidos.json`.
