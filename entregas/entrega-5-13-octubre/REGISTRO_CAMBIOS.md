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
- **Commit:** [PENDIENTE]
- **Riesgos o pendientes:** cuando Persona 3 implemente el motor MicroPython (`firmware/pico/hiles/`), deberá ejecutar los mismos vectores de `docs/mqtt/vectores_ir_v1/` para cerrar la comparación cruzada. `DeduplicadorMensajes` está probado como utilidad web, pero la deduplicación de comandos QoS 1 continúa pendiente en el receptor de la Pico.

### [2026-10-11] — Responsable: Julian Romero

- **Actividad del plan:** corrección de `LedTask` y cierre de pruebas de `FakeLed`/scheduler.
- **Qué se implementó:** estado interno de salida para soportar adaptadores que solo implementan `on()` y `off()`; se agregó una regresión para verificar el titilado sin `value()`.
- **Archivos modificados:** `firmware/pico/devices/led_task.py`, `firmware/tests/test_led_task.py`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`.
- **Cómo se probó:** prueba específica de `LedTask`, pruebas del scheduler y suite completa `python -m unittest discover -s firmware/tests -t . -v`, usando el intérprete Python disponible en el entorno.
- **Resultado esperado:** una salida sin `value()` debe alternar y finalizar apagada; `FakeLed` y otra tarea deben continuar funcionando durante el titilado.
- **Resultado obtenido:** pruebas específicas, scheduler y suite completa aprobadas; 16 pruebas en total.
- **Evidencia adicional opcional:** salida de unittest en la consola de trabajo.
- **Commit:** [PENDIENTE]
- **Riesgos o pendientes:** `MqttTransport`, integración MQTT, publicación JSON y validación física continúan pendientes.

### [2026-10-11] — Responsable: Julian Romero

- **Actividad del plan:** Persona 2 — LED no bloqueante y dobles de hardware.
- **Qué se implementó:** `LedTask` como máquina de estados `APAGADO`/`ENCENDIDO`/`TITILANDO`, con intervalo configurable, sin `sleep` y con una sola transición por `update()`; `FakeLed` para pruebas sin GPIO.
- **Archivos modificados:** `firmware/pico/devices/__init__.py`, `firmware/pico/devices/led_task.py`, `firmware/tests/fakes/fake_led.py`, `firmware/tests/fakes/__init__.py`, `firmware/tests/test_led_task.py`, `firmware/tests/README.md`, `entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md`.
- **Cómo se probó:** `C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe -m unittest discover -s firmware/tests -t . -v`. El comando solicitado con `python` no pudo ejecutarse porque no está en `PATH`.
- **Resultado esperado:** validar estados, rechazo de órdenes inválidas, titilado con `FakeClock`, ejecución concurrente de otra tarea e independencia del GPIO.
- **Resultado obtenido:** 15 pruebas aprobadas; la suite incluyó 4 pruebas nuevas de LED y las 11 pruebas existentes. No se usó broker ni hardware físico.
- **Evidencia adicional opcional:** salida de unittest en la consola de trabajo.
- **Commit:** [PENDIENTE]
- **Riesgos o pendientes:** `MqttTransport` no se implementó porque el repositorio aún no contiene `Node` ni una interfaz Python congelada; Wi-Fi, MQTT y validación en Pico quedan pendientes.

### [2026-10-11 16:35] — Responsable: Kevin Rincón (Persona 1)

- **Actividad del plan:** núcleo cooperativo, composición inicial y pruebas sin hardware.
- **Qué se implementó:** reloj intercambiable, `Task`, `Scheduler`, métricas de duración, aislamiento de errores, detección de sobrepasos, `main.py` basado en fábricas y `FakeClock`.
- **Archivos modificados:** `firmware/pico/core/`, `firmware/pico/main.py`, `firmware/tests/`, documentación de arquitectura y plan.
- **Cómo se probó:** `python -m unittest discover -s firmware/tests -t . -v`, usando el ejecutable Python incluido en el entorno porque `python` no estaba publicado en el `PATH`.
- **Resultado esperado:** ejecutar tareas vencidas por prioridad, respetar periodos, aislar errores, detectar actualizaciones lentas, detener el ciclo de forma controlada y conservar la independencia del núcleo.
- **Resultado obtenido:** 11 pruebas aprobadas en 0,004 segundos; se verificaron planificación, prioridades, periodos, aislamiento de errores, sobrepasos, detención controlada, composición y límites de arquitectura.
- **Evidencia adicional opcional:** no aplica.
- **Commit:** [PENDIENTE]
- **Riesgos o pendientes:** integrar las tareas MQTT, LED y motor; validar temporización y memoria en la Pico física.

- [x] Persona 1 registra sus entregas.
- [x] Persona 2 registra sus entregas.
- [ ] Persona 3 registra sus entregas.
- [x] Persona 4 registra sus entregas.
- [ ] Persona 5 registra sus entregas.
