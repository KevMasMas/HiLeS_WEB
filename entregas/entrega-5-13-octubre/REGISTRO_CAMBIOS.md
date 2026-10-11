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

### [2026-10-11 16:35] — Responsable: Persona 1

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
- [ ] Persona 4 registra sus entregas.
- [ ] Persona 5 registra sus entregas.
