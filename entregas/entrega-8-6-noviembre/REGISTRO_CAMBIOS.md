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
  3. Juan David Romero (Persona 4) absorbió integración, suites finales y matrices browser/Pico además de la conformidad del motor.
  4. Personas 1 a 4 deberán entregar informes verificables a Persona 5 al cerrar cada bloque.
  5. Todo informe se contrastará con commits, archivos, pruebas o evidencia antes de incorporarse.
- **Pruebas ejecutadas:** revisión de coherencia de responsables, dependencias, cronograma y matriz de cierre.
- **Resultado exacto:** cuatro frentes técnicos y un frente documental sin propiedad simultánea de archivos de producción.
- **Evidencia física o visual:** no aplica; cambio organizativo.
- **Riesgos o pendientes:** Juan David Romero (Persona 4) concentra conformidad e integración; Personas 1 a 3 deben entregar piezas probadas y no delegar defectos de sus módulos. Persona 5 necesita recibir informes a tiempo para no reconstruir todo al cierre.
- **Commit o rama:** rama `mqtt-pico`; documentos sin commit.
- **Cómo revertir o recuperar:** restaurar la división anterior en la sección 10 y la matriz de cierre.

### [2026-11-04] — Persona 3 — Unificación de controles, visualización de estado, responsive y tutorial interactivo

- **Objetivo:** unificar los controles de ejecución en la barra superior eliminando selectores legados, desacoplar el modo de conexión del destino de ejecución, renderizar tokens múltiples y estados obsoletos en nodos, garantizar cero desbordamiento horizontal en los 6 viewports obligatorios y actualizar el tutorial interactivo con posicionamiento dinámico inteligente.
- **Estado:** [x] terminado (software, visual, pruebas unitarias y responsive aprobados al 100%).
- **Archivos modificados:**
  - `frontend/src/features/editor/TopBar.tsx`
  - `frontend/src/features/editor/CustomNodes.tsx`
  - `frontend/src/features/editor/PlaceTokenView.tsx` (creado)
  - `frontend/src/features/editor/PlaceTokenView.test.tsx` (creado)
  - `frontend/src/features/editor/nodeRuntimeView.ts` (creado)
  - `frontend/src/features/editor/editor.css`
  - `frontend/src/features/editor/Editor.tsx`
  - `frontend/src/features/editor/PanelDock.tsx`
  - `frontend/src/features/editor/PanelDock.test.tsx`
  - `frontend/src/features/editor/panelState.ts`
  - `frontend/src/features/editor/Palette.tsx`
  - `frontend/src/features/editor/PropertiesPanel.tsx`
  - `frontend/src/features/distributed/executionControl.ts`
  - `frontend/src/features/distributed/executionControl.test.ts`
  - `frontend/src/features/distributed/DistributedPanel.tsx`
  - `frontend/src/features/distributed/distributed.css`
  - `frontend/src/features/mqtt/MqttPanel.tsx`
  - `frontend/src/features/mqtt/mqtt.css`
  - `frontend/src/features/simulation/SimulationPanel.tsx`
  - `frontend/src/features/simulation/simulation.css`
  - `frontend/src/features/simulation/elementStateSummary.ts` (creado)
  - `frontend/src/features/onboarding/Tutorial.tsx`
  - `frontend/src/features/onboarding/tutorialSteps.ts`
  - `frontend/src/features/onboarding/onboarding.css`
  - `frontend/src/features/onboarding/EmptyCanvas.tsx`
  - `frontend/src/features/onboarding/tutorialState.ts`
  - `frontend/src/features/onboarding/ejemploMinimo.ts`
  - `frontend/src/features/onboarding/ejemploMinimo.test.ts`
  - `frontend/src/features/collaboration/collaboration.css`
  - `frontend/src/features/setup/setup.css`
  - `frontend/src/stores/useProjectStore.ts`
  - `frontend/src/stores/useProjectStore.test.ts`
  - `frontend/src/stores/useDistributedExecutionStore.ts`
  - `frontend/src/services/mqtt/config.ts`
  - `frontend/src/services/mqtt/config.test.ts`
  - `frontend/src/index.css`
  - `.gitignore`
- **Cambios realizados:**
  1. Controles de ejecución unificados en la barra superior (`Iniciar`, `Paso`, `Detener`, `Reiniciar`); eliminación completa de selectores y botones legados `Local / Pico`.
  2. Desacoplamiento de conectividad (broker LAN vs Remoto WSS en `MqttPanel`) y destino de ejecución (por bloque estructural en `DistributedPanel`).
  3. Visualización de marcado en Places con `PlaceTokenView`: 1 punto (8px), 2-4 puntos ordenados + badge numérico `×N`, ≥5 con badge `×N`.
  4. Indicación de ejecutor inactivo o desactualizado con opacidad al 48% y badge de advertencia `Obsoleto` en nodos del canvas.
  5. Desbloqueo ante desconexión o lentitud del broker MQTT con timeout automático de 1000 ms y botón manual *"Continuar sin conexión"*; sincronización diferida e idempotente.
  6. Corrección de esquinas en TopBar: caja de proyecto con ancho mínimo para evitar truncar identificadores, y chips sin elipsis forzada.
  7. Tutorial interactivo de 12 pasos actualizado: el Paso 2 destaca la caja de proyecto completa, y los Pasos 10 y 11 posicionan la tarjeta a la izquierda de los paneles laterales evitando solapar botones de despliegue/envío o desbordar la pantalla.
  8. Responsive en 6 viewports: sin scroll horizontal global, docking y paleta con auto-cierre táctil en móvil, áreas táctiles ≥ 44px.
  9. Integración segura del generador de configuración `PicoSetupPanel` dentro del acordeón de `DistributedPanel` sin persistir contraseñas en `localStorage`.
- **Pruebas ejecutadas:**
  - `tsc -b`: 0 errores de compilación TypeScript.
  - `eslint .`: 0 errores, 0 advertencias de linter.
  - `vitest run`: 30 suites de prueba y 180 tests aprobados (100%).
  - `vite build`: empaquetado de producción exitoso en 456 ms.
  - `git diff --check`: 0 errores de whitespace o formato.
  - Auditoría automatizada vía Chrome CDP en 6 viewports: `360x800` (móvil estrecho), `390x844` (móvil referencia), `768x1024` (tablet vertical), `820x1180` (tablet grande), `1280x720` (laptop) y `1440x900` (desktop).
- **Resultado exacto:** 180 pruebas aprobadas; cero desbordamientos horizontales globales (`globalOverflowX: false`), sin solapamiento de tarjetas en tutorial, sin botones ocultos o inalcanzables.
- **Evidencia física o visual:**
  - Informe detallado: artifact `reporte_implementacion_persona3.md`.
  - Capturas tutorial: `step2_tutorial_highlight.png`, `step10_tutorial_highlight.png`, `step11_tutorial_highlight.png`.
  - Capturas responsive: `audit_360x800_mobile_narrow.png`, `audit_768x1024_tablet_portrait.png`, `audit_1440x900_desktop.png`.
- **Riesgos o pendientes:** la verificación física multi-Pico en hardware real (Pico ↔ Pico y Pico ↔ browser) y la suite de pruebas físicas en hardware corresponde a Juan David Romero (Persona 4).
- **Commit o rama:** rama `multi-pico`.
- **Cómo revertir o recuperar:** `git checkout` de los archivos frontend modificados o restauración selectiva por módulo.

### [2026-11-06 09:30] — Juan David Romero (Persona 4) — Conformidad Browser/MicroPython e integración distribuida

- **Objetivo:** demostrar con una fuente de verdad compartida que los motores Browser y MicroPython conservan la misma semántica para elementos, canales, retardos y Petri; cerrar Browser ↔ Browser y separar la evidencia simulada de las pruebas físicas pendientes.
- **Estado:** [x] conformidad e integración de software terminadas; [!] Pico ↔ Browser y Pico ↔ Pico físicas pendientes porque no se detectó hardware.
- **Archivos creados:**
  - `frontend/src/engine/__tests__/ConformidadIrV2.test.ts`
  - `frontend/src/engine/__tests__/ConformidadCanalesDistribuidos.test.ts`
  - `docs/mqtt/vectores_ir_v2/ejecucion/04_tokens_pesos_capacidad_conflicto.json`
  - `docs/mqtt/vectores_ir_v2/ejecucion/05_services_expresiones_tipos.json`
  - `docs/mqtt/vectores_ir_v2/MATRIZ_CONFORMIDAD_PERSONA_4.md`
  - `frontend/src/features/onboarding/tutorialVisibility.ts`
- **Archivos modificados:** este plan, este registro, `Editor.tsx`, `TopBar.tsx`, `panelState.ts` y `PanelDock.test.tsx`.
- **Cambios realizados:**
  1. El frontend ejecuta los mismos cinco vectores IR v2 que MicroPython, compara cada snapshot, reinicia y repite cada escenario para detectar estado residual.
  2. Se añadió conformidad explícita para Services booleano, numérico y texto, Functional Blocks de expresión y Python con varias salidas, Sample, Hold, retardos y reinicio.
  3. Se añadió un vector Petri con 0/1/N tokens, peso dos, capacidad insuficiente y dos transiciones en conflicto; Browser y MicroPython conservan exactamente los mismos tokens.
  4. Dos motores de fragmento navegador se conectan directamente mediante rutas CCH, DCH y LCH. CCH coalesce al último valor, DCH mantiene FIFO/capacidad y LCH dispara una sola vez la red Petri local del receptor.
  5. Se documentó que los arcos Petri nunca cruzan fragmentos: Place y Transition unidos por `arco` permanecen juntos; un pulso LCH sí puede cruzar MQTT y activar estado local.
  6. Se ejecutaron colaboración y distribución sobre Mosquitto WebSocket real. El runner obtuvo cuatro ACK, resultado `5 → 6`, veinte snapshots, dos descartes por deduplicación/época y caída observable de `browser:c`.
  7. Se preparó un guion técnico de diez minutos y una matriz que diferencia Browser real, dobles de protocolo y placas físicas.
  8. El tutorial queda inactivo mientras se solicita el nombre para evitar que robe el foco y cierre el teclado en PC o móvil.
  9. Las transiciones de panel sin cambios ya no generan otro estado, eliminando el ciclo `Maximum update depth exceeded` observado durante la prueba visual.
  10. Dos navegadores entraron al mismo proyecto por LAN como `Juan Romero` y `Codex - Persona 4`; la presencia y un cambio de nombre se sincronizaron mediante Mosquitto.
- **Pruebas ejecutadas:**
  - frontend: **32 archivos y 187/187 pruebas aprobadas**;
  - firmware: **169/169 pruebas aprobadas**;
  - ESLint: aprobado sin errores;
  - TypeScript y build Vite: aprobados, **290 módulos transformados**;
  - `git diff --check`: aprobado;
  - paquete canónico: 33 archivos y aprovisionamiento sobre filesystem simulado aprobado;
  - `test-project-collaboration.mjs`: cuatro clientes, retained, presencia, cursor y aislamiento de proyectos aprobados;
  - `test-distributed-mqtt.mjs --mode=memory`: seis etapas aprobadas;
  - `test-distributed-mqtt.mjs --mode=mqtt`: seis etapas aprobadas sobre broker real;
  - `test-distributed-physical.ps1 -Mode DryRun -AllowNoDevice`: terminó correctamente y reportó cero placas.
- **Resultado exacto:** paridad de cinco vectores en los dos motores; Browser ↔ Browser aprobado para CCH/DCH/LCH, presencia, edición compartida y control distribuido; firmware, frontend, build, lint, empaquetado y MQTT aprobados dentro del alcance sin hardware.
- **Evidencia física o visual:** no se detectó ninguna Pico ni puerto serial. En `proyecto-anboq6`, dos navegadores por LAN mostraron simultáneamente a `Juan Romero` y `Codex - Persona 4`; el cambio `Sumar uno` → `Sumar uno · Codex` apareció en el lienzo compartido. Se conserva además la evidencia de seis viewports de Persona 3.
- **Errores encontrados y corrección:** la primera expectativa del vector Petri marcaba una transición como habilitada después de consumir sus tokens y se corrigió al valor común `false`. En la UI, identidad y tutorial competían por el foco, y el tutorial repetía una transición de panel sin cambios hasta agotar la profundidad de renderizado; ambos defectos quedaron cubiertos por pruebas de regresión.
- **Riesgos o pendientes:** faltan Pico ↔ Browser y Pico ↔ Pico físicas, inventario real, memoria/RSSI, prueba del tutorial con una persona nueva y ensayo humano completo. El runner de red usa Mosquitto real, pero los ejecutores `pico:*` son dobles Node.js y no sustituyen MicroPython ni Wi-Fi.
- **Commit o rama:** rama `multi-pico`; commit de integración de Juan David Romero preparado para esta subida.
- **Cómo revertir o recuperar:** retirar los dos tests y los dos vectores nuevos, restaurar este plan/registro y eliminar la matriz de conformidad. No existen migraciones ni estado persistente.

## Matriz de cierre

| Evidencia | Responsable | Estado | Resultado |
|---|---|---|---|
| Validación central de ejecutores | Persona 1 | [x] Software | 161 pruebas frontend aprobadas |
| Dos Picos seleccionables en UI | Persona 1 | [ ] | Pendiente |
| Runtime canónico en ambas placas | Persona 2 | [ ] | Pendiente |
| Configuración sin editar Python | Persona 2 | [x] Software | Completado (PicoSetupPanel en frontend) |
| Controles únicos y responsive | Persona 3 | [x] Software/Visual | 180 pruebas, 6 viewports aprobados |
| Tutorial actualizado | Persona 3 | [x] UI | 12 pasos verificados sin solapamientos |
| Matriz de elementos y tokens | Juan David Romero (Persona 4) | [x] Software | Cinco vectores compartidos; 0/1/N tokens, pesos, capacidad y conflicto aprobados |
| Browser ↔ browser | Juan David Romero (Persona 4) | [x] Software/MQTT | CCH, DCH, LCH, retained, ACK, colaboración y desconexión aprobados |
| Pico ↔ browser | Juan David Romero (Persona 4) | [ ] Física | Pendiente |
| Pico ↔ Pico | Juan David Romero (Persona 4) | [ ] Física | Pendiente |
| Documentación reconciliada | Persona 5 | [ ] | Pendiente |
| Informes históricos por persona | Persona 5 | [ ] | Pendiente |
| Matriz requisito → evidencia | Persona 5 | [ ] | Pendiente |
| Build, lint y suites finales | Juan David Romero (Persona 4) | [x] Software | 187 frontend + 169 firmware, 0 lint, 0 type errors, build OK |

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
