# Registro de cambios — entrega del 13 de octubre de 2026

Este archivo reúne el registro de implementación y pruebas. No se marca una actividad del plan como terminada hasta documentar cómo se probó y cuál fue el resultado. Las fotos, capturas, logs y videos son opcionales.

## Plantilla

### [AAAA-MM-DD HH:MM] — Responsable: [NOMBRE]

- **Actividad del plan:** [SECCIÓN Y CASILLA]
- **Qué se implementó:** [POR COMPLETAR]
- **Archivos modificados:** [POR COMPLETAR]
- **Cómo se probó:** [POR COMPLETAR]
- **Resultado esperado:** [POR COMPLETAR]
- **Resultado obtenido:** [POR COMPLETAR]
- **Evidencia adicional opcional:** [CAPTURA, LOG, VIDEO O NO APLICA]
- **Commit:** [HASH]
- **Riesgos o pendientes:** [POR COMPLETAR]

## Entradas

### [2026-10-12 17:55] — Responsable: Juan Ramos (Persona 3)

- **Actividad del plan:** Persona 3 — Motor HiLeS en MicroPython (las siete casillas de la sección) y, en el alcance P0, «Motor HiLeS MicroPython» y «Probar movimiento de tokens y límites de capacidad».
- **Revisión previa:** se revisaron el plan, este registro, `docs/mqtt/IR_V1.md`, `docs/mqtt/CONTRATO_MENSAJES_MQTT.md`, los 14 vectores de `docs/mqtt/vectores_ir_v1/`, el firmware existente (`core`, `pubsub`, `devices`, dobles de prueba) y el motor y validador de referencia en TypeScript (`validadorIr.ts`, `expresiones.ts`, `EvaluadorPetri.ts`, `ElementoTransicion.ts`, `GrafoDatos.ts`). La línea base del firmware tenía 23 pruebas aprobadas.
- **Qué se implementó:**
  1. `hiles/expressions.py`: validación de la gramática del AST y evaluador sin `eval` con la semántica normativa de §5 (valor ausente `None`, igualdad por tipo lógico, orden solo numérico, `/` y `%` entre cero retornan ausente, `%` con el signo del dividendo como en JavaScript y resultados enteros representados como `int`).
  2. `hiles/model.py`: carga y validación de la IR v1 (`validate_ir_v1`) y del sobre de `modelo/cargar` (`validate_load_message`). Replica el orden de comprobación de `validarIrV1` y se detiene en el primer problema, de modo que web y Pico reportan el mismo `CodigoIr`. Incluye límites (64 elementos, 128 conexiones, profundidad 16), puertos, arcos, identificadores duplicados y ciclos de datos mediante Kahn.
  3. `hiles/elements.py`: clases `Service`, `FunctionalBlock`, `Place` y `Transition` con su configuración y estado de ejecución. `Transition` acumula pesos por Place, comprueba el balance neto (consumo, producción y capacidad) y mueve los tokens de forma atómica.
  4. `hiles/engine.py`: `HilesEngine` con `reset()`, `set_input()`, `step()` (propagación en orden topológico, red de Petri con política de conflicto) y `snapshot()` con la representación exacta de `simulacion/estado.elementos`.
  5. `hiles/engine_task.py`: `EngineTask`, subclase de `Task`. Los callbacks de `Node` solo encolan (cola acotada, 8 mensajes por defecto). Cada `update()` atiende como máximo `max_commands_per_update` mensajes (1 por defecto) o un paso automático. Publica `modelo/confirmacion`, `simulacion/estado` (con `modelo_id`, `version`, `secuencia`, `estado` e `id_mensaje`) y `error`. Soporta `paso`, `reiniciar`, `iniciar` y `detener`.
  6. Pruebas de escritorio: 45 pruebas nuevas en cuatro archivos y un módulo auxiliar para leer los vectores compartidos.
- **Decisiones que afectan a otras personas:**
  - `reiniciar` publica una instantánea con la secuencia **incrementada** (no vuelve a `0`), porque la web descarta secuencias menores o iguales a la última. Solo una carga nueva reinicia la secuencia a `0`.
  - Una carga rechazada responde con `ir_version: 1` (la versión soportada), porque el validador web exige ese valor en `modelo/confirmacion`.
  - Nuevos códigos de `error` del motor: `COMANDO_RECHAZADO`, `MOTOR_OCUPADO` y `ERROR_INTERNO_MOTOR`; para entradas se reutiliza `ENTRADA_HILES_RECHAZADA`.
  - En la Pico, `modelo_id` y `version` son obligatorios en comandos y entradas, como indica el contrato.
- **Archivos creados:** `firmware/pico/hiles/__init__.py`, `firmware/pico/hiles/expressions.py`, `firmware/pico/hiles/model.py`, `firmware/pico/hiles/elements.py`, `firmware/pico/hiles/engine.py`, `firmware/pico/hiles/engine_task.py`, `firmware/tests/hiles_vectors.py`, `firmware/tests/test_hiles_expressions.py`, `firmware/tests/test_hiles_model.py`, `firmware/tests/test_hiles_engine.py`, `firmware/tests/test_engine_task.py`.
- **Archivos modificados:** `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`, `entregas/entrega-5-13-octubre/REGISTRO_CAMBIOS.md`, `docs/mqtt/CONTRATO_MENSAJES_MQTT.md`, `firmware/tests/test_architecture.py`, `firmware/tests/README.md`.
- **Cómo se probó:** desde la raíz del repositorio, `python -m unittest discover -s firmware/tests -t . -v` (Python 3.13.2). Los vectores se leen directamente de `docs/mqtt/vectores_ir_v1/`, sin copias.
- **Resultado esperado:**
  - Aceptar los 3 vectores válidos y rechazar los 8 inválidos con su `codigo_esperado`.
  - Reproducir paso a paso los 3 vectores de ejecución generados con `MotorSimulacion`.
  - Respetar pesos, capacidad, balance neto y conflicto sin movimientos parciales.
  - Devolver el estado inicial al reiniciar y producir instantáneas idénticas en ejecuciones repetidas.
  - Procesar como máximo un mensaje por `update()` sin bloquear otras tareas.
  - Conservar el modelo activo ante una carga inválida y no incluir reglas propias del semáforo.
- **Resultado obtenido:** 68 pruebas aprobadas en 0,050 s (`OK`): las 23 anteriores y 45 nuevas. Los 14 vectores compartidos pasan sin modificaciones. El mismo vector del semáforo con identificadores renombrados produce los mismos resultados, y una prueba verifica que `firmware/pico/hiles/` no contiene términos del semáforo.
- **Evidencia adicional opcional:** salida de `unittest` en la consola de trabajo.
- **Commit:** `1739c9a` (motor y pruebas); integrado con los cambios de Personas 1 y 2 en el merge `db242b8`. Después del merge, la suite completa del firmware aprobó 78 pruebas (`OK`).
- **Riesgos o pendientes:**
  - No hay intérprete MicroPython ni Pico disponibles. El código evita funciones exclusivas de CPython, pero falta medir memoria y la duración de `update()` en la placa (`max_update_ms` queda configurable).
  - Falta registrar `EngineTask` en `main.py` para conectarla al `MqttTransport` que se incorporó en el commit `3af1bfc` (integración de Persona 1).
  - `MqttTransport` ya aplica el límite de 32768 bytes; la deduplicación de 32 `id_mensaje` sigue pendiente. Volver a cargar el mismo `modelo_id` y la misma `version` reinicia la secuencia a `0`, y la web podría descartar esas instantáneas hasta que exista la deduplicación.

#### Cambios en trabajo de otras personas

- **Persona 4 (Ivan Felipe Prado Blanco):**
  - En el plan se marcó «Comparar instantáneas esperadas del motor web y MicroPython», que estaba pendiente del motor de Persona 3.
  - En `docs/mqtt/CONTRATO_MENSAJES_MQTT.md` se agregó la sección «Respuestas del motor MicroPython», con los nuevos códigos y la regla de secuencia de `reiniciar`. No se modificó ninguna regla existente del contrato ni los vectores.
- **Personas 1 y 4:** en `firmware/tests/test_architecture.py` se agregó una prueba que impide que `hiles` importe `devices`, `platform`, `machine`, `network` o `umqtt`. Las pruebas existentes no cambiaron.
- **Persona 2 (Julian Romero):** en `firmware/tests/README.md` se agregaron `pubsub/` y `hiles/` a la lista de carpetas que se copian a la Pico, junto con la descripción de las nuevas pruebas. No se modificó código de Persona 2.
- **Plan general:**
  - Se registró a Juan Ramos como responsable de Persona 3.
  - Se actualizaron «Equipo», «Estado actual» y el árbol de `hiles/`, que ahora incluye `expressions.py` y `engine.py`.
  - Se marcaron como cumplidos los criterios «La Pico o su runtime simulado carga y ejecuta el modelo» (solo con el runtime simulado) y «El motor no contiene reglas codificadas exclusivamente para el semáforo».
  - No se modificó `main.py`.

### [2026-10-12 15:49] — Responsable: Ivan Felipe Prado Blanco (Persona 4)

- **Actividad del plan:** Persona 4 — Contrato, compilador `HilesModelDocument → IR v1`, validador, vectores compartidos de conformidad, filtro de secuencia/deduplicación y bus interno `Node` + `FakeTransport`.
- **Qué se implementó:**
  1. Especificación normativa `docs/mqtt/IR_V1.md` y actualización de `docs/mqtt/CONTRATO_MENSAJES_MQTT.md` (`v1.2`) con el esquema exacto de `elementos`, `conexiones`, AST de expresiones sin `eval`, tabla de códigos `CodigoIr`, campo `codigo` en `modelo/confirmacion` y mapeo de `simulacion/estado.elementos`.
  2. Compilador `compilarDocumentoAIr`, validador de referencia `validarIrV1`, parser/evaluador de expresiones `compilarExpresion`/`evaluarExpresionIr` y extractor de instantáneas `extraerElementosEstadoIr` en `frontend/src/services/ir/`, con mensajes de aviso amigables cuando un elemento usa código JS/Python, `SAMPLE` o `HOLD`.
  3. Integración del esquema `IrModeloV1` en `frontend/src/services/mqtt/messages.ts`, junto con `ControlSecuenciaRemota` (filtro de sesión, versión y secuencia monótona) y `DeduplicadorMensajes` (ventana deslizante de 32 `id_mensaje`).
  4. Suite de 14 vectores JSON compartidos en `docs/mqtt/vectores_ir_v1/` (`validos/`, `invalidos/`, `ejecucion/`) verificados automáticamente contra `validarIrV1` y `MotorSimulacion`.
  5. Bus pub/sub cooperativo `Node` y catálogo de topics relativos en `firmware/pico/pubsub/` (`node.py`, `topics.py`), doble determinista `FakeTransport` en `firmware/tests/fakes/fake_transport.py` y pruebas de arquitectura/unidad en `firmware/tests/test_node.py` y `firmware/tests/test_architecture.py`.
- **Archivos modificados:** `docs/mqtt/IR_V1.md`, `docs/mqtt/CONTRATO_MENSAJES_MQTT.md`, `docs/mqtt/vectores_ir_v1/**`, `frontend/src/engine/elementos/ElementoBloqueFuncional.ts`, `frontend/src/services/ir/tiposIr.ts`, `frontend/src/services/ir/expresiones.ts`, `frontend/src/services/ir/validadorIr.ts`, `frontend/src/services/ir/compiladorIr.ts`, `frontend/src/services/ir/index.ts`, `frontend/src/services/ir/ir.test.ts`, `frontend/src/services/mqtt/messages.ts`, `frontend/src/services/mqtt/messages.test.ts`, `firmware/pico/pubsub/__init__.py`, `firmware/pico/pubsub/topics.py`, `firmware/pico/pubsub/node.py`, `firmware/tests/fakes/fake_transport.py`, `firmware/tests/fakes/__init__.py`, `firmware/tests/test_node.py`, `firmware/tests/test_architecture.py`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`, `entregas/entrega-5-13-octubre/REGISTRO_CAMBIOS.md`.
- **Cómo se probó:**
  - Firmware: `& "C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe" -m unittest discover -s firmware/tests -t . -v`
  - Frontend (tests): `npm.cmd run test:run` en `frontend/`
  - Frontend (lint y build): `npm.cmd run lint` y `npm.cmd run build` en `frontend/`
- **Resultado esperado:** aprobar todas las pruebas unitarias del firmware (`core`, `devices`, `pubsub`, `FakeTransport`, arquitectura) y del frontend (compilación de modelos reales de `output/`, avisos amigables, validación de vectores válidos/inválidos, reproducción paso a paso de vectores de ejecución, deduplicación y filtro de secuencia), además de lint y build sin errores.
- **Resultado obtenido:**
  - Firmware: 23 pruebas aprobadas en 0,022 s (`OK`).
  - Frontend tests: 10 archivos de prueba y 63 pruebas aprobadas (`vitest run`).
  - Frontend lint y build: `eslint .` sin errores y `tsc -b && vite build` completado en 1,02 s.
- **Evidencia adicional opcional:** salida de consola de `unittest`, `vitest`, `eslint` y `vite build`.
- **Commit:** `723a7d6`
- **Riesgos o pendientes al momento de esta entrada:** Persona 3 debía implementar el motor MicroPython y ejecutar los mismos vectores de `docs/mqtt/vectores_ir_v1/`. Ese punto fue cerrado posteriormente por Persona 3 y está documentado en su entrada. La deduplicación de comandos QoS 1 continúa pendiente en el receptor de la Pico.

#### Revisión de alcance y solapamientos de Persona 4

- **Trabajo propio de Persona 4:** cerró la IR v1 y el contrato MQTT, implementó el compilador y validador web, definió límites, preparó los vectores de conformidad y probó mensajes, secuencias y deduplicación como utilidades web.
- **Trabajo asumido de Persona 1 (arquitectura e integración):** creó el bus interno `Node`, el catálogo de topics y amplió las pruebas de arquitectura para comprobar que `pubsub` no dependa de `devices`, `hiles` ni `platform`. Este aporte queda integrado, pero no significa que esté terminada la integración general de las cinco personas.
- **Trabajo relacionado con Persona 2:** creó `FakeTransport` y lo exportó desde los dobles de prueba. Esto habilita las futuras pruebas de `MqttTransport`, pero no implementa Wi-Fi, el transporte MQTT real ni modifica la lógica de `LedTask` de Persona 2.
- **Trabajo adelantado de Persona 5:** agregó `ControlSecuenciaRemota` y `DeduplicadorMensajes` en la web. En ese momento eran piezas de apoyo sin cliente conectado al canvas; Persona 5 completó posteriormente el cliente remoto, mientras la deduplicación en la Pico continúa abierta.
- **Trabajo relacionado con Persona 3:** dejó vectores de ejecución para el entonces futuro motor MicroPython. Persona 3 implementó posteriormente el motor y cerró la reproducción de esos vectores, según su entrada del 12 de octubre.
- **Cambio fuera de alcance corregido:** el commit de Persona 4 había limitado a tres los reintentos del cliente MQTT web y había agregado archivos `__pycache__/*.pyc`. La revisión posterior restauró la reconexión continua y eliminó esos artefactos generados en el commit `f7a8ebf`.
- **Conclusión de la revisión:** no se marcaron como terminadas las tareas de Personas 2, 3 o 5 que solo recibieron infraestructura preparatoria. Las casillas cerradas cuentan con código y pruebas; las integraciones reales con Pico, MQTT externo y cuatro navegadores continúan pendientes.

### [2026-10-11] — Responsable: Julian Romero

- **Actividad del plan:** corrección de `LedTask` y cierre de pruebas de `FakeLed`/scheduler.
- **Qué se implementó:** estado interno de salida para soportar adaptadores que solo implementan `on()` y `off()`; se agregó una regresión para verificar el titilado sin `value()`.
- **Archivos modificados:** `firmware/pico/devices/led_task.py`, `firmware/tests/test_led_task.py`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`.
- **Cómo se probó:** prueba específica de `LedTask`, pruebas del scheduler y suite completa `python -m unittest discover -s firmware/tests -t . -v`, usando el intérprete Python disponible en el entorno.
- **Resultado esperado:** una salida sin `value()` debe alternar y finalizar apagada; `FakeLed` y otra tarea deben continuar funcionando durante el titilado.
- **Resultado obtenido:** pruebas específicas, scheduler y suite completa aprobadas; 16 pruebas en total.
- **Evidencia adicional opcional:** salida de unittest en la consola de trabajo.
- **Commit:** `8173811`
- **Riesgos o pendientes:** `MqttTransport`, integración MQTT, publicación JSON y validación física continúan pendientes.

### [2026-10-11] — Responsable: Julian Romero

- **Actividad del plan:** Persona 2 — LED no bloqueante y dobles de hardware.
- **Qué se implementó:** `LedTask` como máquina de estados `APAGADO`/`ENCENDIDO`/`TITILANDO`, con intervalo configurable, sin `sleep` y con una sola transición por `update()`; `FakeLed` para pruebas sin GPIO.
- **Archivos modificados:** `firmware/pico/devices/__init__.py`, `firmware/pico/devices/led_task.py`, `firmware/tests/fakes/fake_led.py`, `firmware/tests/fakes/__init__.py`, `firmware/tests/test_led_task.py`, `firmware/tests/README.md`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`.
- **Cómo se probó:** `C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe -m unittest discover -s firmware/tests -t . -v`. El comando solicitado con `python` no pudo ejecutarse porque no está en `PATH`.
- **Resultado esperado:** validar estados, rechazo de órdenes inválidas, titilado con `FakeClock`, ejecución concurrente de otra tarea e independencia del GPIO.
- **Resultado obtenido:** 15 pruebas aprobadas; la suite incluyó 4 pruebas nuevas de LED y las 11 pruebas existentes. No se usó broker ni hardware físico.
- **Evidencia adicional opcional:** salida de unittest en la consola de trabajo.
- **Commit:** `8173811`
- **Riesgos o pendientes:** `MqttTransport` no se implementó porque el repositorio aún no contiene `Node` ni una interfaz Python congelada; Wi-Fi, MQTT y validación en Pico quedan pendientes.

### [2026-10-11 16:35] — Responsable: Kevin Rincón (Persona 1)

- **Actividad del plan:** núcleo cooperativo, composición inicial y pruebas sin hardware.
- **Qué se implementó:** reloj intercambiable, `Task`, `Scheduler`, métricas de duración, aislamiento de errores, detección de sobrepasos, `main.py` basado en fábricas y `FakeClock`.
- **Archivos modificados:** `firmware/pico/core/`, `firmware/pico/main.py`, `firmware/tests/`, documentación de arquitectura y plan.
- **Cómo se probó:** `python -m unittest discover -s firmware/tests -t . -v`, usando el ejecutable Python incluido en el entorno porque `python` no estaba publicado en el `PATH`.
- **Resultado esperado:** ejecutar tareas vencidas por prioridad, respetar periodos, aislar errores, detectar actualizaciones lentas, detener el ciclo de forma controlada y conservar la independencia del núcleo.
- **Resultado obtenido:** 11 pruebas aprobadas en 0,004 segundos; se verificaron planificación, prioridades, periodos, aislamiento de errores, sobrepasos, detención controlada, composición y límites de arquitectura.
- **Evidencia adicional opcional:** no aplica.
- **Commit:** `5b86d90`
- **Riesgos o pendientes:** integrar las tareas MQTT, LED y motor; validar temporización y memoria en la Pico física.

- [x] Persona 1 registra sus entregas.
- [x] Persona 2 registra sus entregas.
- [x] Persona 3 registra sus entregas.
- [x] Persona 4 registra sus entregas.
- [x] Persona 5 registra sus entregas.

### [2026-10-12 17:45] — Responsable: Julian Romero (Persona 2)

- **Actividad del plan:** Persona 2 — separación de plataforma Pico, transporte MQTT cooperativo, enrutamiento Node ↔ MQTT y continuidad del LED durante el transporte.
- **Qué se implementó:** se separaron los adaptadores de GPIO, Wi‑Fi y cliente `umqtt` en `firmware/pico/platform/`; se implementó `MqttTransport` como tarea `Task` no bloqueante; se agregaron suscripciones a los topics entrantes, publicación de topics salientes con QoS/retención del contrato, serialización JSON, validación de tamaño, errores de JSON/topic y estado de conexión.
- **Archivos modificados:** `firmware/pico/platform/__init__.py`, `firmware/pico/platform/hardware.py`, `firmware/pico/platform/wifi.py`, `firmware/pico/platform/mqtt_client.py`, `firmware/pico/pubsub/mqtt_transport.py`, `firmware/pico/pubsub/__init__.py`, `firmware/tests/test_mqtt_transport.py`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`.
- **Cómo se probó:** `& "C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe" -m unittest discover -s firmware/tests -t . -v`; además `npm.cmd run test:run`, `npm.cmd run lint` y `npm.cmd run build` desde `frontend/`.
- **Resultado esperado:** el transporte conecta sin bloquear, enruta mensajes en ambas direcciones, conserva las políticas MQTT, informa errores como JSON y permite que el scheduler siga ejecutando el LED durante el titilado.
- **Resultado obtenido:** 28 pruebas de firmware aprobadas; 10 archivos y 63 pruebas de frontend aprobadas; lint sin errores; build exitoso. Las pruebas del transporte verifican conexión, cuatro suscripciones, publicación retenida del estado LED, recepción JSON, rechazo de JSON/topic inválidos, ausencia de cliente sin Wi‑Fi y titilado concurrente.
- **Evidencia adicional opcional:** salida de consola de unittest, vitest, eslint y vite build.
- **Commit:** `f2efe24`.
- **Riesgos o pendientes:** la revisión posterior encontró que todavía faltaban la composición real en `main.py`, recuperación de conexiones, validación de tamaño saliente y publicación automática del estado LED. Estos puntos se corrigieron en la entrada siguiente. La validación física con una Pico W continúa pendiente; `config_local.py` no se crea ni se versiona.

### [2026-10-12 17:58] — Responsable: Kevin Rincón (revisión y correcciones de Persona 2)

- **Actividad del plan:** revisión de integración del transporte MQTT, reconexión cooperativa, composición del firmware y corrección de evidencia/casillas.
- **Qué se corrigió:** `main.py` ahora compone `Node`, `WifiConnection`, salida GPIO, `LedTask` y `MqttTransport`; los comandos LED publican automáticamente su estado o un error; Wi‑Fi y MQTT reintentan con intervalos no bloqueantes; una caída de `check_msg()` limpia el cliente y recupera las cuatro suscripciones; las publicaciones salientes mayores de 32768 bytes se rechazan antes de llegar al broker; el adaptador `umqtt` convierte identificador y credenciales a bytes como requiere la Pico. Además, un fallo del `error_handler` de `Node` queda registrado sin interrumpir a los demás suscriptores.
- **Archivos modificados:** `firmware/pico/main.py`, `firmware/pico/platform/wifi.py`, `firmware/pico/platform/mqtt_client.py`, `firmware/pico/pubsub/node.py`, `firmware/pico/pubsub/mqtt_transport.py`, `firmware/tests/test_mqtt_transport.py`, `firmware/tests/test_node.py`, `firmware/tests/README.md`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`, `entregas/entrega-5-13-octubre/REGISTRO_CAMBIOS.md`.
- **Cómo se probó:** prueba focal `python -m unittest firmware.tests.test_mqtt_transport -v`, seguida de la suite completa de firmware; además se repiten pruebas, lint y build del frontend.
- **Resultado esperado:** iniciar el runtime modular desde `main.py`, procesar otro comando MQTT durante el titilado, publicar el estado LED, rechazar una salida sobredimensionada y reconectar sin un ciclo cerrado ni `sleep` dentro de las tareas.
- **Resultado obtenido:** las pruebas focales aprobaron, incluyendo composición completa, publicación automática del estado, segundo mensaje durante el titilado, caída y reconexión MQTT, espera entre reintentos, recuperación de suscripciones, reconexión Wi‑Fi, límite de salida, codificación compatible con `umqtt` y aislamiento de un `error_handler` defectuoso. La suite completa aprobó 34 pruebas de firmware y conserva las 63 pruebas de frontend, lint y build aprobados en la misma revisión.
- **Evidencia adicional opcional:** salida de las suites en consola.
- **Commit:** [PENDIENTE]
- **Riesgos o pendientes:** falta validar los adaptadores `machine`, `network` y `umqtt` en la Pico física y ejecutar una integración contra Mosquitto con las credenciales locales. El motor MicroPython y el cliente remoto pertenecen a Personas 3 y 5.

### [2026-10-12 18:15] — Responsable: Persona 5

- **Actividad del plan:** Persona 5 — ejecución remota web, bloqueo del motor local y preparación multiusuario.
- **Qué se implementó:** cliente remoto desacoplado de React con sesión `modelo_id` + `version`; publicación del IR, comandos e inyección de Services con identificadores únicos; recepción de confirmaciones e instantáneas; descarte por sesión, versión y secuencia; selector Local/Pico; controles de cargar, iniciar, avanzar, detener y reiniciar; aplicación de valores, tokens y actividad al canvas; e incorporación de otros navegadores mediante un enlace que conserva la sesión en la URL. En modo Pico las operaciones del motor TypeScript y el puente MQTT hacia ese motor quedan bloqueados, y el canvas solo aplica el estado oficial aceptado por el cliente remoto.
- **Archivos modificados:** `frontend/src/services/mqtt/RemoteExecutionClient.ts`, `frontend/src/services/mqtt/RemoteExecutionClient.test.ts`, `frontend/src/stores/useRemoteExecutionStore.ts`, `frontend/src/stores/useSimulationStore.ts`, `frontend/src/features/simulation/SimulationPanel.tsx`, `frontend/src/features/simulation/simulation.css`, `frontend/src/features/mqtt/MqttPanel.tsx`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`, `entregas/entrega-5-13-octubre/REGISTRO_CAMBIOS.md`.
- **Cómo se probó:** `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc -b`, `node node_modules/eslint/bin/eslint.js .` y `node node_modules/vite/bin/vite.js build` desde `frontend/`. El doble MQTT verifica suscripciones, sesión compartida en todos los mensajes, rechazo de acciones sin sesión y descarte de instantáneas antiguas o de otro modelo.
- **Resultado esperado:** la web debe alternar entre motor local y Pico sin ejecutar ambos; debe publicar mensajes asociados a una sesión, aceptar únicamente estados nuevos de esa sesión y reflejarlos en los nodos del canvas.
- **Resultado obtenido:** 11 archivos y 67 pruebas de frontend aprobadas; TypeScript y ESLint sin errores; build de producción exitoso. Las cuatro pruebas nuevas del cliente remoto aprobaron. La compilación conserva las advertencias ya existentes de Vite sobre Pyodide y tamaño de chunks, sin impedir el build.
- **Evidencia adicional opcional:** no aplica.
- **Commit:** sin commit por indicación de Kevin Rincón.
- **Riesgos o pendientes:** no se confirmó aún la sincronización real en cuatro navegadores porque falta integrar el `EngineTask` de Persona 3 en `main.py`, ejecutar el flujo contra broker/Pico y realizar el ensayo conjunto. También continúa pendiente convertir el modelo visual en el cruce Norte–Sur / Este–Oeste seguro.

### [2026-10-12 18:36] — Responsable: Kevin Rincón (integración de Personas 3 y 5)

- **Actividad del plan:** actualización de la rama compartida, resolución del conflicto documental e integración de las implementaciones de Personas 3 y 5.
- **Qué se corrigió:** se conservaron el motor HiLeS MicroPython y sus registros de Persona 3, el cliente remoto web y sus registros de Persona 5, y las correcciones previas de `Node`. Se unificó el estado actual del plan para no presentar como inexistentes componentes que ya están implementados, y se aclararon los pendientes históricos del registro.
- **Archivos modificados por la resolución:** `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md` y `entregas/entrega-5-13-octubre/REGISTRO_CAMBIOS.md`. El resto de los archivos conserva el contenido aportado por cada responsable.
- **Cómo se probó:** suite completa de firmware con `unittest`; suite completa de frontend con Vitest; compilación TypeScript; ESLint; y build de producción con Vite.
- **Resultado esperado:** conservar ambos trabajos sin marcadores de conflicto ni regresiones y mantener explícitos únicamente los pendientes reales.
- **Resultado obtenido:** 79 pruebas de firmware y 67 pruebas de frontend aprobadas; TypeScript y ESLint sin errores; build exitoso; ningún archivo permanece en conflicto.
- **Evidencia adicional opcional:** no aplica.
- **Commit:** sin commit por indicación de Kevin Rincón.
- **Riesgos o pendientes:** integrar `EngineTask` en `main.py`, ejecutar la prueba física, comprobar cuatro navegadores contra el mismo estado oficial y completar el cruce visual seguro.

### [2026-10-12 19:05] — Responsable: Kevin Rincón (revisión final sin Pico)

- **Actividad del plan:** cierre de la integración que puede validarse sin placa física y corrección de los pendientes detectados en las revisiones de Personas 1, 3, 4 y 5.
- **Qué se corrigió:** se registró `EngineTask` en `main.py`; se agregó deduplicación de 32 `id_mensaje` con repetición de respuestas; se corrigió el reinicio del filtro de secuencia cuando se recarga la misma sesión; se protegieron las suscripciones MQTT compartidas con conteo de referencias; el cliente remoto ahora recibe errores del topic `error` y conserva el estado remoto exacto; la activación del modo Pico evita perder estados retenidos; y se añadió una prueba que confirma que la instantánea modifica el store y el canvas sin ejecutar el motor local. La interfaz muestra explícitamente si la sesión está activa, coloca el mensaje de unión junto a los controles y permite reintentar la conexión sin duplicar suscripciones.
- **Demo y documentación:** `output/demo-4-semaforos-inteligentes.json` se convirtió en un cruce Norte–Sur / Este–Oeste con fases atómicas seguras y entrada booleana general. Se agregó `scripts/generate-coordinated-traffic-demo.mjs` para regenerarlo y `docs/mqtt/GUIA_ENSAYO_REMOTO_SIN_PICO.md` para explicar que los cuatro navegadores deben importar el mismo JSON y compartir la sesión. El enlace comparte la sesión, no el diagrama.
- **Archivos principales modificados:** `firmware/pico/main.py`, `firmware/pico/hiles/engine_task.py`, `firmware/pico/config_local.example.py`, pruebas de firmware, cliente/estado/panel remoto del frontend, pruebas del compilador y store, modelo de `output/`, contrato, README y plan.
- **Cómo se probó:** suite completa de Vitest; `tsc -b`; ESLint; build de producción con Vite; suite completa de `unittest`; prueba de composición que recorre `main.py → MqttTransport → Node → EngineTask → respuesta MQTT`; prueba de 15 pasos del cruce; y comprobación de exclusión Git para `.env.local` y `config_local.py`.
- **Resultado esperado:** que todo el flujo sin hardware sea reproducible, que no se repitan efectos con QoS 1, que una recarga admita nuevamente la secuencia `0`, que el canvas refleje el estado remoto y que el modelo nunca deje verdes ambos ejes.
- **Resultado obtenido:** 70 pruebas de frontend y 82 pruebas de firmware aprobadas; TypeScript y ESLint sin errores; build de producción exitoso. La prueba focal posterior del botón de unión aprobó 6 pruebas y se comprobó una conexión WebSocket real al Mosquitto local. La prueba del cruce mantiene un solo color por sentido y nunca activa verde Norte–Sur junto con verde Este–Oeste. No hay credenciales locales rastreadas por Git.
- **Evidencia adicional opcional:** salida de las suites en consola; no se requieren fotos, logs ni video para cerrar estas casillas.
- **Commit:** sin commit por indicación de Kevin Rincón.
- **Riesgos o pendientes reales:** validar memoria, temporización y adaptadores en una Pico W; comprobar el broker y la red del lugar; abrir cuatro navegadores y ejecutar el ensayo completo; y confirmar físicamente que la Pico es la fuente oficial. Los pendientes históricos sobre integración, deduplicación y cruce quedaron resueltos por esta entrada.

### [2026-10-12 19:25] — Responsable: Kevin Rincón (preparación para la Pico W)

- **Actividad del plan:** preparar el despliegue físico y comprobar todo el alcance disponible antes de conectar la placa.
- **Qué se preparó:** guía completa de MicroPython, `umqtt.simple`, red, Firewall, estructura de archivos, configuración local, prueba del LED, carga del modelo y ensayo de cuatro navegadores; script reproducible de empaquetado; mensajes iniciales en la consola serie; y prueba real de reparto MQTT entre cuatro clientes WebSocket.
- **Archivos creados:** `docs/mqtt/GUIA_PRUEBA_PICO_W.md`, `scripts/prepare-pico-deployment.ps1`, `scripts/test-mqtt-four-clients.mjs`, `output/hiles-pico-w-deploy.zip` y su checksum SHA-256.
- **Cómo se probó:** validación de los 22 archivos Python del ZIP mediante análisis sintáctico; inspección automática del contenido del paquete; conexión real de cuatro clientes al Mosquitto local; suite completa de firmware y frontend; TypeScript, ESLint y build de producción.
- **Resultado obtenido:** ZIP de 23 entradas sin credenciales, ejemplos, `__pycache__` ni `.pyc`; cuatro de cuatro clientes recibieron el mismo estado JSON; 82 pruebas de firmware y 70 de frontend aprobadas; tipos, lint y build correctos.
- **Evidencia adicional opcional:** `output/hiles-pico-w-deploy.sha256` permite verificar que el archivo utilizado mañana sea el paquete preparado.
- **Commit:** sin commit por indicación de Kevin Rincón.
- **Riesgos o pendientes:** no hay intérprete MicroPython ni Pico W conectada hoy. Mañana deben verificarse `machine`, `network`, `umqtt.simple`, memoria, tiempos, acceso al PC desde la red elegida y el ensayo visual de cuatro navegadores.
