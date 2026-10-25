# Registro de cambios — entrega del 30 de octubre

Registrar únicamente trabajo comprobable. No reemplazar resultados anteriores ni incluir credenciales.

## Plantilla por entrada

```markdown
### [AAAA-MM-DD HH:MM] — Persona N — Título

- **Objetivo:**
- **Estado:** [ ] Pendiente / [x] Hecho / [!] Bloqueado
- **Commit o rama:**
- **Archivos modificados:**
- **Decisiones tomadas y motivo:**
- **Pruebas ejecutadas y resultado exacto:**
- **Evidencia física o visual:**
- **Errores encontrados y corrección:**
- **Riesgos o limitaciones:**
- **Entrada que recibe:**
- **Handoff entregado a:**
- **Cómo revertir o recuperar:**
```

## Línea base

### [2026-10-25] — Planeación inicial

- **Objetivo:** convertir las notas de la siguiente entrega en arquitectura, responsabilidades y evidencias verificables.
- **Estado:** [x] Hecho.
- **Base:** rama `mqtt-pico`, commit `baadff6`.
- **Decisiones:** Structural Block como unidad principal de despliegue; propiedad única; workers Pico/browser; mensajes remotos por MQTT; semáforos pares con propuesta de token lógico; Three.js aislado; Persona 5 mantiene el documento maestro.
- **Pruebas de la base:** 153 firmware, 104 frontend, ESLint, TypeScript y build aprobados antes de iniciar esta entrega.
- **Pendiente:** confirmar hardware, responsables y alcance P0 con el equipo/profesor.

## Entradas de Personas 1 a 5

Agregar cada entrada debajo de este encabezado en orden cronológico. Cada integrante debe registrar su propia evidencia antes del handoff.
