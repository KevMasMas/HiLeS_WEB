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

### [2026-10-28 09:25] — Persona 1 (Kevin Rincon) — Protocolo y particionador de ejecución distribuida v3

- **Objetivo:** congelar el contrato que permite asignar elementos de un mismo modelo a varias Pico W y navegadores, y producir un fragmento IR v2 válido para cada ejecutor.
- **Estado:** [x] Hecho.
- **Commit o rama:** `mqtt-pico`, trabajo preparado sobre `76381ff`; pendiente de commit al momento de este registro.
- **Archivos modificados:** `docs/mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md`; `frontend/src/services/distributed/`; `frontend/src/services/ir/tiposIrDistribuida.ts`; `frontend/src/services/ir/particionarIr.ts`; `frontend/src/services/ir/particionarIr.test.ts`; `frontend/src/services/ir/index.ts`; este plan y este registro.
- **Decisiones tomadas y motivo:** se separó colaboración v2 de ejecución v3; `Structural Block` hereda destino a sus descendientes y `Functional Block` puede sobreescribirlo; cada elemento tiene propietario único por época; las conexiones locales permanecen en la IR y las remotas se convierten en rutas MQTT tipadas; los arcos Petri no pueden cruzar workers en P0; manifiesto y fragmentos usan SHA-256 sobre JSON canónico; un error impide producir un despliegue parcial.
- **Pruebas ejecutadas y resultado exacto:** prueba focalizada `particionarIr.test.ts`: 1 archivo y 8 pruebas aprobadas; suite frontend aislada: 18 archivos y 112 pruebas aprobadas; `npm run lint`: aprobado; `npm run build`: aprobado, 259 módulos transformados.
- **Evidencia física o visual:** no aplica a Persona 1; se dejaron fixtures exportables de dos, tres y cuatro ejecutores para las pruebas de workers e integración.
- **Errores encontrados y corrección:** ESLint rechazó NUL dentro de una expresión regular y se reemplazó por una comprobación explícita. Una primera suite completa ejecutada en paralelo con lint y build produjo tres timeouts en stores existentes (108/111); repetida de forma aislada aprobó 111/111, confirmando saturación del entorno y no una regresión.
- **Riesgos o limitaciones:** todavía faltan workers Pico/browser, ACK reales, canales MQTT en ejecución, estado agregado y validación física. SHA-256 usa Web Crypto en el compilador web; el worker MicroPython debe verificar el mismo hash con su implementación disponible.
- **Entrada que recibe:** IR v2, compilador, motor general, colaboración y runtime físico aprobados en la entrega anterior.
- **Handoff entregado a:** Personas 2, 3 y 5 mediante tipos, tópicos, mensajes, fixtures y documentación versionados.
- **Cómo revertir o recuperar:** eliminar los archivos nuevos de protocolo/distribución/particionado, retirar las dos exportaciones añadidas en `frontend/src/services/ir/index.ts` y restaurar las casillas/documentación de esta entrada.
