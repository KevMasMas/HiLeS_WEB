# Contrato de mensajes MQTT de HiLeS

Responsable del protocolo: **Kevin Rincon**

Responsable de validación e integración: **Juan David Romero**

Versión del contrato: `v1.1`

Prefijo común: `udfjc/hiles/v1/equipo1/pico01/`

Este documento describe la frontera compartida por la aplicación web, Mosquitto y la Raspberry Pi Pico W. La fuente de verdad del frontend está en `frontend/src/services/mqtt/config.ts` y `frontend/src/services/mqtt/messages.ts`.

## Reglas comunes

- Cada publicación contiene un único objeto JSON codificado en UTF-8.
- Los campos indicados como obligatorios deben existir y tener el tipo exacto.
- `id_mensaje` es un texto no vacío que permite relacionar un comando con su respuesta.
- `modelo_id` y `version` evitan aplicar una entrada o un comando a un modelo diferente del que está activo.
- `secuencia` comienza en `0` y aumenta con cada instantánea. La web descarta estados con una secuencia menor o igual a la última aplicada.
- `ir_version` vale `1` para la primera representación ejecutable soportada por la Pico.
- Los valores de un `Service` admitidos en esta versión son `boolean`, `number` o `string`.
- `version` debe ser un número entero positivo.
- El tamaño máximo de un mensaje es `32768` bytes codificados en UTF-8.
- Un modelo puede contener como máximo `64` elementos y `128` conexiones en esta primera versión.
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
| Web → Pico | `simulacion/comando` | `MensajeSimulacionComando` | `accion`, `id_mensaje` |
| Web → Pico | `entrada/establecer` | `MensajeEntradaEstablecer` | `servicio_id`, `valor`, `id_mensaje` |
| Web → Pico | `modelo/cargar` | `MensajeModeloCargar` | `modelo_id`, `version`, `ir_version`, `modelo`, `id_mensaje` |
| Pico → web | `modelo/confirmacion` | `MensajeModeloConfirmacion` | `modelo_id`, `version`, `ir_version`, `aceptado`, `id_mensaje` |
| Pico → web | `simulacion/estado` | `MensajeSimulacionEstado` | `modelo_id`, `version`, `secuencia`, `estado`, `elementos` |

## Política de entrega

| Topic | QoS | Retenido | Motivo |
|---|---:|---:|---|
| `led/comando` | 1 | No | Debe llegar, pero no debe repetirse al reconectar. |
| `led/estado` | 1 | Sí | La interfaz recupera el último estado físico. |
| `estado/conexion` | 1 | Sí | Los clientes nuevos conocen la disponibilidad actual. |
| `telemetria` | 0 | No | Perder una muestra no altera la simulación. |
| `salida` | 1 | No | Es un resultado puntual del motor. |
| `error` | 1 | No | Es un diagnóstico asociado a una operación. |
| `simulacion/comando` | 1 | No | Retenerlo podría ejecutar un paso antiguo. |
| `entrada/establecer` | 1 | No | Retenerla podría modificar otro modelo al reconectar. |
| `modelo/cargar` | 1 | No | La web debe cargarlo de manera explícita. |
| `modelo/confirmacion` | 1 | No | Corresponde a una solicitud concreta. |
| `simulacion/estado` | 1 | Sí | Es la fuente oficial para reconstruir la interfaz. |

MQTT QoS 1 puede entregar un mensaje más de una vez. Por ello, la Pico debe conservar temporalmente los últimos `id_mensaje`: si recibe uno repetido, no vuelve a ejecutar la operación y publica otra vez la respuesta previamente asociada. La primera implementación conservará al menos los últimos 32 identificadores.

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
{"accion":"paso","modelo_id":"paso-token-01","version":1,"id_mensaje":"sim-001"}
```

`accion` solo puede ser `iniciar`, `detener`, `reiniciar` o `paso`.

Para conservar compatibilidad con la integración local existente, la web todavía acepta mensajes sin `modelo_id` y `version`. Ambos campos son obligatorios cuando el destino es el motor remoto de la Pico.

### `entrada/establecer`

```json
{"servicio_id":"confirmacion","valor":true,"modelo_id":"paso-token-01","version":1,"id_mensaje":"entrada-001"}
```

`modelo_id` y `version` siguen la misma regla de compatibilidad descrita para `simulacion/comando`.

### `modelo/cargar`

```json
{"modelo_id":"paso-token-01","version":1,"ir_version":1,"modelo":{"elementos":[],"conexiones":[]},"id_mensaje":"modelo-001"}
```

`modelo` contiene la representación intermedia compilada por la web, no el documento visual completo ni código JavaScript o Python.

### `modelo/confirmacion`

```json
{"modelo_id":"paso-token-01","version":1,"ir_version":1,"aceptado":true,"id_mensaje":"modelo-001"}
```

Si `aceptado` es `false`, se puede agregar `error` con una explicación no vacía.

### `simulacion/estado`

```json
{
  "modelo_id":"paso-token-01",
  "version":1,
  "secuencia":3,
  "estado":"pausada",
  "elementos":{
    "confirmacion":{"valor":true},
    "validar":{"salida":true},
    "espera":{"tokens":0},
    "avanzar":{"habilitada":true,"disparada":true},
    "confirmado":{"tokens":1}
  },
  "id_mensaje":"sim-001"
}
```

`estado` puede ser `sin_modelo`, `lista`, `ejecutando`, `pausada`, `detenida` o `error`. `id_mensaje` es opcional únicamente para estados espontáneos, como el publicado después de una reconexión.

## Reconexión, duplicados y orden

1. La web se vuelve a suscribir a los topics configurados cuando MQTT confirma la reconexión.
2. Mosquitto entrega los últimos estados retenidos de conexión, LED y simulación.
3. La web solo aplica `simulacion/estado` si coinciden `modelo_id` y `version` con el modelo remoto activo.
4. La web descarta una instantánea si su `secuencia` no es mayor que la última aplicada.
5. La Pico identifica duplicados por `id_mensaje`, no repite sus efectos y vuelve a enviar la respuesta almacenada.
6. Cargar una versión nueva del modelo reinicia la secuencia a `0` y limpia el registro de comandos de la versión anterior.

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
| Mensaje mayor de 32768 bytes | Se rechaza antes de decodificar o ejecutar. |
| Versión de IR diferente de 1 | La carga se rechaza mediante `modelo/confirmacion`. |
| Modelo sobre los límites iniciales | La carga se rechaza sin sustituir el modelo activo. |
| Comando duplicado | No se repite el efecto; se publica nuevamente su respuesta. |
| Estado antiguo o de otro modelo | La web lo descarta. |
| Service inexistente | No se modifica el motor; se informa y se publica `error`. |
| Tipo incompatible | No se modifica el motor; se informa el tipo esperado y se publica `error`. |

## Verificación automatizada

Desde `frontend/`:

```powershell
npm run test:run -- src/services/mqtt/messages.test.ts src/services/mqtt/MqttHilesBridge.test.ts
```

La prueba recorre todos los ejemplos del contrato, valida límites y errores, y comprueba la integración MQTT existente con un `Service`.
