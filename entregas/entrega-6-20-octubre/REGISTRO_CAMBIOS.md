# Registro de cambios — entrega del 20 de octubre

Este archivo registra únicamente trabajo comprobable de la entrega. Crear una interfaz, dejar un comentario o preparar infraestructura para otra persona no permite marcar como terminada la tarea completa.

## Reglas

1. Agregar una entrada por unidad comprobable.
2. Indicar responsable y número de persona.
3. Referenciar una actividad concreta del plan.
4. Enumerar archivos modificados.
5. Registrar comandos y resultados exactos.
6. Diferenciar pruebas de escritorio, broker real y Pico física.
7. No escribir “funciona” sin evidencia.
8. Registrar riesgos, pendientes y cambios de contrato.
9. No incluir credenciales, SSID, contraseñas ni tokens.
10. Cada integrante debe crear su propia entrada sin sobrescribir las entradas ajenas.

## Plantilla de entrada

```markdown
### [AAAA-MM-DD HH:MM] — Responsable: [NOMBRE] (Persona N)

- **Estado:** [ ] Pendiente / [x] Hecho / [!] Bloqueado
- **Actividad del plan:**
- **Qué se implementó o corrigió:**
- **Archivos modificados:**
  - `ruta/archivo`
- **Commit o rama:**
- **Cómo se probó:**
  - Comando:
  - Resultado:
- **Evidencia:**
- **Impacto sobre otros integrantes:**
- **Riesgos o pendientes:**
- **Reversión, si aplica:**
```

## Registro

### [2026-10-18] — Preparación de la entrega

- **Estado:** [x] Hecho
- **Actividad del plan:** análisis de línea base y creación de documentación de la sexta entrega.
- **Qué se realizó:**
  - Se aclaró que Vite, React, Pyodide y Mosquitto permanecen en el PC.
  - Se definió como objetivo que el código Python escrito en Functional Blocks se ejecute con MicroPython dentro de la Pico.
  - Se establecieron alcance P0, división ascendente entre cinco personas, propiedad de archivos, criterios de aceptación y guion de demostración dentro del plan.
  - Se dejó un único registro para documentar cambios, pruebas, evidencias y pendientes por responsable.
- **Archivos agregados:**
  - `entregas/entrega-6-20-octubre/PLAN_IMPLEMENTACION_ENTREGA_20.md`
  - `entregas/entrega-6-20-octubre/REGISTRO_CAMBIOS.md`
  - `entregas/entrega-6-20-octubre/GUIA_DEMO.md`
- **Validación de línea base frontend:** 12 archivos de prueba aprobados, 70 pruebas aprobadas; TypeScript y build de Vite aprobados.
- **Limitación del entorno:** las pruebas de firmware no se ejecutaron porque Python no está disponible en `PATH` en la máquina de revisión.
- **Código funcional modificado:** ninguno.
- **Pendiente inmediato:** confirmar nombres de responsables y congelar IR v2/perfil Python antes de implementar.

### [2026-10-18] — Ampliación a paridad completa del runtime remoto

- **Estado:** [x] Hecho en planeación; implementación pendiente.
- **Actividad del plan:** ampliar P0 para que el día 20 no se limite al ejecutor Python ni al demo de semáforos.
- **Qué se incorporó al plan:**
  - Paridad web/Pico para `Service`, `Functional Block`, `Sample`, `Hold`, `Place` y `Transition`.
  - Semánticas separadas para CCH, DCH y PETRI/LCH.
  - Cola DCH FIFO, eventos de un solo consumo y política de desbordamiento.
  - Retardos de elementos, conexiones y transiciones mediante `Scheduler`/`Task`, sin esperas bloqueantes.
  - Aplanado verificable de Structural Blocks y normalización de tipos legados.
  - Tipos escalares, `vector` y `custom` JSON acotados.
  - Reset y snapshots completos.
  - Vectores de conformidad compartidos y matriz automática de paridad TypeScript/MicroPython.
  - Redistribución: Persona 1 conserva núcleo cooperativo y Python; Persona 2 contrato, compilador y motor TypeScript de referencia; Persona 3 motor remoto completo y semáforos; Personas 4 y 5 UI e integración.
- **Hallazgo de línea base:** `Task` y `Scheduler` ya existen y miden tiempos; el motor Pico actual solo construye `Service`, `Functional Block`, `Place` y `Transition`, y usa una conexión genérica `dato` para CCH/DCH.
- **Código funcional modificado:** ninguno.

## Confirmación de responsables

- [ ] Persona 1 — Nombre:
- [ ] Persona 2 — Nombre:
- [ ] Persona 3 — Nombre:
- [ ] Persona 4 — Nombre:
- [ ] Persona 5 — Nombre:

## Control de integración

- [ ] Persona 1 registra contrato y runtime.
- [ ] Persona 2 registra protocolo web y URL.
- [ ] Persona 3 registra semáforos y sensores.
- [ ] Persona 4 registra UI/UX.
- [ ] Persona 5 registra colaboración e integración.
- [ ] Todos los integrantes registraron sus cambios y pruebas.
- [ ] La entrada de cierre coincide con los resultados reales.
- [ ] No hay casillas cerradas sin prueba o evidencia.

