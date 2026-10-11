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
- [ ] Persona 2 registra sus entregas.
- [ ] Persona 3 registra sus entregas.
- [ ] Persona 4 registra sus entregas.
- [ ] Persona 5 registra sus entregas.
