# Contrato de mensajes MQTT de HiLeS

Responsable: **Juan David Romero**  
Versión del contrato: `v1`  
Prefijo común: `udfjc/hiles/v1/equipo1/pico01/`

Este documento describe la frontera compartida por la aplicación web, Mosquitto y la Raspberry Pi Pico W. La fuente de verdad del frontend está en `frontend/src/services/mqtt/config.ts` y `frontend/src/services/mqtt/messages.ts`.

## Reglas comunes

- Cada publicación contiene un único objeto JSON codificado en UTF-8.
- Los campos indicados como obligatorios deben existir y tener el tipo exacto.
- `id_mensaje` es un texto no vacío que permite relacionar un comando con su respuesta.
- Los valores de un `Service` admitidos en esta versión son `boolean`, `number` o `string`.
- `version` debe ser un número entero positivo.
- Un campo adicional no invalida por sí solo el mensaje; los consumidores usan únicamente el contrato conocido.
- Un JSON mal formado, un topic desconocido o un campo inválido se rechaza antes de llegar al panel o al motor. La web muestra el diagnóstico en español.
- Ningún mensaje incluye credenciales, SSID ni datos de autenticación.

## Topics y tipos

| Dirección | Sufijo del topic | Tipo TypeScript | Campos obligatorios |
|---|---|---|---|
| Web → Pico | `led/comando` | `MensajeLedComando` | `accion`, `id_mensaje` |
| Pico → web | `led/estado` | `MensajeLedEstado` | `encendido`, `accion_aplicada` |
| Pico → web | `estado/conexion` | `MensajeEstadoConexion` | `conectado`, `dispositivo` |
| Pico → web | `telemetria` | `MensajeTelemetria` | `dispositivo` |
| Motor → MQTT | `salida` | `MensajeSalidaHiles` | `servicio_id`, `valor`, `id_mensaje` |
| Pico → web | `error` | `MensajeErrorMqtt` | `mensaje` o `error` |
| MQTT → web | `simulacion/comando` | `MensajeSimulacionComando` | `accion`, `id_mensaje` |
| MQTT → Service | `entrada/establecer` | `MensajeEntradaEstablecer` | `servicio_id`, `valor`, `id_mensaje` |
| Web → Pico, P1 | `modelo/cargar` | `MensajeModeloCargar` | `modelo_id`, `version`, `modelo`, `id_mensaje` |
| Pico → web, P1 | `modelo/confirmacion` | `MensajeModeloConfirmacion` | `modelo_id`, `aceptado`, `id_mensaje` |

## Ejemplos válidos

### `led/comando`

```json
{"accion":"encender","id_mensaje":"cmd-001"}
```

`accion` solo puede ser `encender`, `apagar` o `titilar`.

### `led/estado`

```json
{"encendido":true,"accion_aplicada":"encender","id_mensaje":"cmd-001"}
```

Al iniciar, la Pico también publica `{"encendido":false,"accion_aplicada":"inicio"}`. Por eso `inicio` es válido solo como estado recibido e `id_mensaje` es opcional en esta respuesta espontánea.

### `estado/conexion`

```json
{"conectado":true,"dispositivo":"pico01"}
```

### `telemetria`

```json
{"dispositivo":"pico01","rssi":-48,"memoria_libre":81232,"tiempo_activo":120}
```

`rssi`, `memoria_libre` y `tiempo_activo` son numéricos y opcionales.

### `salida`

```json
{"servicio_id":"service-output","valor":true,"id_mensaje":"salida-001"}
```

### `error`

```json
{"codigo":"JSON_INVALIDO","mensaje":"No fue posible interpretar el comando.","id_mensaje":"cmd-001"}
```

`codigo` e `id_mensaje` son opcionales.

La implementación MicroPython actual publica `{"error":"Acción no soportada"}`. La web acepta `mensaje` o `error` para conservar compatibilidad; los mensajes originados por la web usan `mensaje`.

### `simulacion/comando`

```json
{"accion":"paso","id_mensaje":"sim-001"}
```

`accion` solo puede ser `iniciar`, `detener`, `reiniciar` o `paso`.

### `entrada/establecer`

```json
{"servicio_id":"demo2-humidity","valor":70,"id_mensaje":"entrada-001"}
```

### `modelo/cargar`

```json
{"modelo_id":"demo-01","version":1,"modelo":{"schemaVersion":2},"id_mensaje":"modelo-001"}
```

### `modelo/confirmacion`

```json
{"modelo_id":"demo-01","aceptado":true,"id_mensaje":"modelo-001"}
```

Si `aceptado` es `false`, se puede agregar `error` con una explicación no vacía.

## Integración con un Service HiLeS

`MqttHilesBridge` se suscribe a `entrada/establecer`. Al recibir un mensaje válido:

1. Busca `servicio_id` entre los Services inyectables del modelo cargado.
2. Comprueba que `valor` coincida con el tipo de salida del Service: `boolean`, `integer`, `real` o `string`.
3. Llama a la interfaz pública `inyectarEntrada`; MQTT no accede a elementos internos ni reemplaza `BusObserver`.
4. Refleja en el panel el éxito o el error en español.
5. Si el Service no existe, el tipo no coincide o el motor rechaza la entrada, publica un mensaje en `error` con código `ENTRADA_HILES_RECHAZADA`.

El método `publicarSalida` aplica el recorrido inverso y genera un `MensajeSalidaHiles` sobre el topic `salida`.

## Comportamiento ante errores

| Caso | Resultado esperado |
|---|---|
| Texto que no es JSON | Se descarta y se muestra “el contenido no es JSON válido”. |
| Topic fuera del contrato | Se descarta y se informa que el topic no pertenece al contrato. |
| Campo obligatorio ausente | Se descarta y se identifica el campo. |
| Acción no admitida | Se descarta y se muestran las opciones válidas. |
| Service inexistente | No se modifica el motor; se informa y se publica `error`. |
| Tipo incompatible | No se modifica el motor; se informa el tipo esperado y se publica `error`. |

## Verificación automatizada

Desde `frontend/`:

```powershell
npm run test:run -- src/services/mqtt/messages.test.ts src/services/mqtt/MqttHilesBridge.test.ts
```

La prueba recorre los diez ejemplos, valida errores y demuestra que una entrada MQTT llega a un `Service`, entra al motor y mueve el token del circuito de humedad.
