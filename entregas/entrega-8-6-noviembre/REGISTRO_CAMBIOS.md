# Registro de cambios — entrega del 6 de noviembre de 2026

**Rama:** `mqtt-pico`  
**Commit base:** `f7cc9b6`  
**Plan:** `PLAN_IMPLEMENTACION_ENTREGA_6_NOVIEMBRE.md`  
**Regla de identificación:** usar únicamente `Persona 1`, `Persona 2`, etc.; no registrar nombres propios.  
**Seguridad:** no copiar SSID, contraseñas, tokens, credenciales MQTT ni el contenido real de `config_local.py`.

## Estado inicial verificado

- La rama local inicia alineada con `origin/mqtt-pico` en `f7cc9b6` antes de los cambios locales de esta entrega.
- Existen cambios locales sin commit correspondientes a la corrección del Paso 1; deben preservarse durante la integración.
- El broker recibió estados v3 válidos de `pico:pico01w` y `pico:pico02w` en `proyecto-hl950c`.
- Ambas placas publicaron estado `online`, IR v2, lenguajes Python/expresión y capacidades válidas durante la verificación previa.
- El frontend conserva dos arquitecturas visibles: simulación legado `Local/Pico` y ejecución distribuida por ejecutores.
- Pico 1 contenía archivos antiguos adicionales en la raíz; Pico 2 mostraba una estructura más limpia. No se concluye todavía que los runtimes sean idénticos hasta ejecutar inventario y checksums.
- El firmware soporta Places con múltiples tokens, pero la representación visual actual muestra un único indicador aunque el valor sea mayor que uno.
- La configuración Wi-Fi/MQTT todavía requiere editar o cargar `config_local.py`; no existe aprovisionamiento completo desde la aplicación.

## Formato obligatorio de cada entrada

```text
### [AAAA-MM-DD HH:MM] — Persona N — título

- Objetivo:
- Estado: [ ] pendiente / [x] terminado / [!] parcial
- Archivos modificados:
- Cambios realizados:
- Pruebas ejecutadas:
- Resultado exacto:
- Evidencia física o visual:
- Riesgos o pendientes:
- Commit o rama:
- Cómo revertir o recuperar:
```

## Entradas

### [2026-11-04] — Persona 1 — Auditoría y corrección de validaciones multi-Pico

- **Objetivo:** determinar por qué dos Picos conectadas y publicando estados válidos no quedaban reconocidas de forma fiable como destinos seleccionables en los bloques estructurales.
- **Estado:** [x] corrección de software y pruebas terminadas; [!] verificación visual y despliegue físico todavía pendientes.
- **Archivos modificados:**
  - `frontend/src/services/distributed/messages.ts`
  - `frontend/src/services/distributed/messages.test.ts`
  - `frontend/src/features/distributed/executorAvailability.ts`
  - `frontend/src/features/distributed/executorAvailability.test.ts`
  - `frontend/src/features/distributed/AssignmentSelector.tsx`
  - `frontend/src/features/distributed/DistributedPanel.tsx`
  - `frontend/src/features/distributed/assignments.ts`
  - `frontend/src/features/distributed/assignments.test.ts`
  - `frontend/src/stores/useDistributedExecutionStore.ts`
- **Cambios realizados:**
  1. Se validan payload, protocolo, proyecto, identidad, tipo, estado, actividad y capacidades antes de registrar un ejecutor.
  2. Se creó una evaluación única de disponibilidad utilizada por el selector y por el despliegue.
  3. Los estados `online`, `ready` y `running` recientes quedan seleccionables y desplegables.
  4. Los estados offline, degradado, obsoleto o incompatible permanecen visibles con una causa legible, pero no pueden desplegar.
  5. La vigencia usa la hora local de recepción del navegador, no el uptime publicado por MicroPython.
  6. `Desplegar` se bloquea si falta un destino o si el destino elegido no está disponible.
  7. El panel muestra el `projectId` que deben compartir las Picos.
- **Pruebas ejecutadas:** compilación TypeScript, suite completa de Vitest, ESLint sobre el alcance y `git diff --check`.
- **Resultado exacto:** 27 archivos de prueba y 161 pruebas frontend aprobadas; TypeScript, ESLint y comprobación de espacios aprobados.
- **Evidencia física o visual:** el broker local publicó estados válidos y `online` de `pico:pico01w` y `pico:pico02w` bajo `proyecto-hl950c`. Aún no se registra como aprobada la selección visual ni el despliegue Pico ↔ Pico.
- **Riesgos o pendientes:** los cambios permanecen locales y sin commit; falta abrir el proyecto exacto en el frontend, seleccionar ambas placas, desplegar y recibir ACK reales.
- **Commit o rama:** rama `mqtt-pico`; cambios locales posteriores a `f7cc9b6`.
- **Cómo revertir o recuperar:** revertir únicamente los archivos enumerados o conservarlos en un commit separado antes de integrar el resto del frontend.

### [2026-11-04] — Persona 5 — Creación y priorización de la entrega

- **Objetivo:** convertir las necesidades de frontend, multi-Pico, configuración, tutorial, motor general, responsive y documentación en un plan ejecutable para el viernes 6 de noviembre.
- **Estado:** [x] plan inicial creado; [ ] asignaciones y horarios pendientes de confirmación del equipo.
- **Archivos creados:**
  - `entregas/entrega-8-6-noviembre/PLAN_IMPLEMENTACION_ENTREGA_6_NOVIEMBRE.md`
  - `entregas/entrega-8-6-noviembre/REGISTRO_CAMBIOS.md`
- **Cambios realizados:**
  1. Se separaron modo de conexión y destino de ejecución.
  2. Se definió una sola experiencia de ejecución y el retiro gradual de controles duplicados.
  3. Se priorizó Pico ↔ Pico, Pico ↔ navegador y conformidad general de elementos.
  4. Se definieron criterios responsive para seis viewports.
  5. Se estableció un flujo de firmware canónico, identidad por placa y configuración sin editar código fuente.
  6. Se clasificó Web Serial como P1 hasta comprobar estabilidad y compatibilidad.
  7. Se distribuyó el trabajo entre cinco personas sin nombres propios y con propiedad de archivos.
- **Pruebas ejecutadas:** auditoría de archivos, historial, guías, stores, paneles, firmware, scripts y documentación existentes.
- **Resultado exacto:** plan dividido en P0/P1/P2, cinco responsables, cronograma de tres días, matriz de pruebas y doce criterios finales.
- **Evidencia física o visual:** no aplica; esta entrada documenta planificación y auditoría.
- **Riesgos o pendientes:** el alcance es amplio para tres días; los recortes autorizados están documentados y no incluyen los criterios críticos multi-Pico.
- **Commit o rama:** rama `mqtt-pico`; archivos nuevos sin commit.
- **Cómo revertir o recuperar:** eliminar únicamente la carpeta `entregas/entrega-8-6-noviembre/`.

### [2026-11-04] — Persona 5 — Dedicación exclusiva a documentación y trazabilidad

- **Objetivo:** liberar a una persona de implementación para que documente todo lo realizado por el equipo a partir de informes, entregas anteriores, historial Git y resultados de pruebas.
- **Estado:** [x] responsabilidades redistribuidas en el plan; [ ] reconstrucción histórica e informes por persona pendientes.
- **Archivos modificados:**
  - `entregas/entrega-8-6-noviembre/PLAN_IMPLEMENTACION_ENTREGA_6_NOVIEMBRE.md`
  - `entregas/entrega-8-6-noviembre/REGISTRO_CAMBIOS.md`
- **Cambios realizados:**
  1. Persona 5 quedó dedicada exclusivamente a documentación, informes, cronología y trazabilidad.
  2. Persona 5 no modificará código de producción ni asumirá pruebas físicas.
  3. Persona 4 absorbió integración, suites finales y matrices browser/Pico además de la conformidad del motor.
  4. Personas 1 a 4 deberán entregar informes verificables a Persona 5 al cerrar cada bloque.
  5. Todo informe se contrastará con commits, archivos, pruebas o evidencia antes de incorporarse.
- **Pruebas ejecutadas:** revisión de coherencia de responsables, dependencias, cronograma y matriz de cierre.
- **Resultado exacto:** cuatro frentes técnicos y un frente documental sin propiedad simultánea de archivos de producción.
- **Evidencia física o visual:** no aplica; cambio organizativo.
- **Riesgos o pendientes:** Persona 4 concentra conformidad e integración; Personas 1 a 3 deben entregar piezas probadas y no delegar defectos de sus módulos. Persona 5 necesita recibir informes a tiempo para no reconstruir todo al cierre.
- **Commit o rama:** rama `mqtt-pico`; documentos sin commit.
- **Cómo revertir o recuperar:** restaurar la división anterior en la sección 10 y la matriz de cierre.

## Matriz de cierre

| Evidencia | Responsable | Estado | Resultado |
|---|---|---|---|
| Validación central de ejecutores | Persona 1 | [x] Software | 161 pruebas frontend aprobadas |
| Dos Picos seleccionables en UI | Persona 1 | [ ] | Pendiente |
| Runtime canónico en ambas placas | Persona 2 | [ ] | Pendiente |
| Configuración sin editar Python | Persona 2 | [ ] | Pendiente |
| Controles únicos y responsive | Persona 3 | [ ] | Pendiente |
| Tutorial actualizado | Persona 3 | [ ] | Pendiente |
| Matriz de elementos y tokens | Persona 4 | [ ] | Pendiente |
| Browser ↔ browser | Persona 4 | [ ] Regresión | Pendiente en esta entrega |
| Pico ↔ browser | Persona 4 | [ ] Física | Pendiente |
| Pico ↔ Pico | Persona 4 | [ ] Física | Pendiente |
| Documentación reconciliada | Persona 5 | [ ] | Pendiente |
| Informes históricos por persona | Persona 5 | [ ] | Pendiente |
| Matriz requisito → evidencia | Persona 5 | [ ] | Pendiente |
| Build, lint y suites finales | Persona 4 | [ ] | Pendiente |

## Bloqueadores activos

- Confirmar quién asume cada número de persona.
- Mantener disponibles las dos Picos, cables y puertos seriales durante la prueba física.
- Mantener PC, Mosquitto y frontend en la misma red para la matriz LAN.
- Definir si existe un broker remoto seguro para probar P1; su ausencia no bloquea P0.
- Evitar que Thonny y otra herramienta reclamen simultáneamente el mismo puerto serial.

## Decisiones que no deben cambiar sin registrar motivo

- El destino se asigna por bloque; el modo de conexión pertenece al proyecto.
- El firmware continúa siendo general y no incorpora lógica de semáforos.
- Cada Pico tiene identidad única y comparte el paquete canónico.
- Las credenciales son locales y no viajan en el documento colaborativo.
- No se afirma soporte de Internet productivo sin `wss://`, autenticación y control de acceso.
- No se marca una matriz física como aprobada usando dobles o simuladores.
