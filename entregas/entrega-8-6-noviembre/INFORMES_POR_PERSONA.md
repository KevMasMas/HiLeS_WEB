# Informes por persona — desde el inicio del proyecto hasta la entrega 8

**Responsable del documento:** Persona 5 (entrega 8)
**Corte:** `d15d5a0` en `multi-pico`, 7 de noviembre de 2026.
**Método:** cada aporte se contrastó con un commit de `multi-pico` o con una entrada de registro. Si solo existe el registro, se indica "solo registro". Si el trabajo de una casilla aparece en el commit de otra persona, se indica.

## 1. Equivalencia entre alias de Git y número de persona

El número de persona no identifica a un integrante: se reasigna en cada entrega.

| Alias Git | E2 (18 sep) | E3 (26 sep) | E4 (9 oct) | E5 (13 oct) | E6 (20 oct) | E7 (30 oct) | **E8 (6 nov)** | Commits en `multi-pico` |
|---|---|---|---|---|---|---|---|---:|
| KevMasMas | Organización/demo | Revisión y cierre | Broker y red | Persona 1 | Persona 1 | Persona 1 | **Persona 1** | 45 |
| JulianRomero17 | Backend demo | Persona 3 (elementos) | Cliente MQTT web | Persona 2 | Persona 5 | Persona 4 (sin commit, por descarte) | **Persona 2** | 12 |
| IvanPrado23 | Conexiones | Persona 4 (UI) | Pico W | Persona 4 | Persona 2 | Persona 2 | **Persona 3** | 10 |
| juandav08 / Juandav08 | Rutas y visual | Petri | Contrato e integración | no identificado | Persona 4 | Persona 5 | **Persona 4** | 17 |
| jusraome | Integración front-back | Motor y orquestación | — | Persona 3 | Persona 3 | Persona 3 | **Persona 5** | 11 |

Notas:

- En la entrega 3 los registros usan "Persona 3" y "Persona 4" para elementos y UI; los demás aparecen por rol.
- En la entrega 5 la Persona 5 no tiene nombre ni commit ("sin commit por indicación"); no se atribuye a nadie.
- En la entrega 7 la Persona 4 (Three.js) no dejó commit; la atribución a JulianRomero17 es solo por descarte y no está verificada.
- `valeld`, `SalasinformaticaUD` y `ValC01` tienen un commit cada uno (27 ago y 16 oct) desde cuentas compartidas o de prueba; no se asocian a un número de persona.

---

## 2. KevMasMas — Persona 1 en la entrega 8

### Responsabilidad en la entrega 8

Estado único de ejecución y validación multi-Pico (plan, sección 10).

### Aportes de la entrega 8

| Aporte | Archivos principales | Commit | Verificación de Persona 5 |
|---|---|---|---|
| Plan y registro de la entrega 8 | `entregas/entrega-8-6-noviembre/*.md` | `efab6eb` | Archivos presentes |
| Validación central de payload, proyecto, actividad, estado y capacidades | `services/distributed/messages.ts`, `features/distributed/executorAvailability.ts` | `efab6eb` | Código presente; causas legibles (`proyecto_distinto`, `obsoleto` a los 15 s, `degraded`, `ir_incompatible`…) |
| Selector y despliegue con el mismo criterio | `AssignmentSelector.tsx`, `assignments.ts`, `useDistributedExecutionStore.ts` | `efab6eb` | Incluido en las 187 pruebas actuales |
| Fachada de control de ejecución (`executionControl`) | `features/distributed/executionControl.ts` y su prueba | `6aac632` | Usada por `TopBar.tsx` |
| Generador seguro de `config_local.py` y panel de placas | `features/setup/PicoSetupPanel.tsx`, `picoConfig.ts`, `picoConfig.test.ts` | `6aac632` | Prueba con identidad `pico03w` presente |

**Decisiones:** la actividad se mide con la hora de recepción del navegador, no con el uptime de la Pico; una asignación no se borra si el ejecutor cae.
**Resultado declarado:** 161 pruebas frontend (4 nov).
**Pendiente:** verificación visual de `pico:pico01w` y `pico:pico02w` en `proyecto-hl950c` y despliegue Pico ↔ Pico con ACK reales.
**Observación de trazabilidad:** el generador de configuración (`PicoSetupPanel`, `picoConfig*`) estaba asignado a Persona 2, pero su commit es `6aac632` de Persona 1. Las casillas "Preparar el formulario/generador seguro" y "Probar `pico03w`" de Persona 2 se apoyan en ese commit.

### Historial anterior

- **Inicio:** commit inicial, documento de referencia HiLeS, Converters, import/export JSON, primer backend con demo de token.
- **E2:** organización de la entrega y demo 2 de token.
- **E3:** eliminó el backend (`cf9ee38`), completó y probó el motor frontend, aisló código entre bloques y creó el demo de parqueadero.
- **E4:** Mosquitto 2.1.2 con autenticación, listeners 1883/9001, ficha de conexión y cierre de la demo LED web → Pico → web.
- **E5:** scheduler cooperativo (`Task`, `Scheduler`, `FakeClock`), revisión de Persona 2, integración de Personas 3 y 5, `EngineTask` en `main.py`, deduplicación y paquete de despliegue.
- **E6:** `PythonExecutor`, valores de runtime, Watchdog, revisión de Persona 2 y cierre físico del 25 de octubre.
- **Generalización:** desacopló el firmware y el demo de semáforos (`8ce4e06`, `baadff6`).
- **E7:** protocolo y particionador v3 (`d2b8e81`), integración del pull, semáforos en anillo y preparación multi-Pico (`19ef63c`, `f7cc9b6`).

---

## 3. JulianRomero17 — Persona 2 en la entrega 8

### Responsabilidad en la entrega 8

Flota de Picos, firmware canónico y aprovisionamiento.

### Aportes de la entrega 8 (commit `c61dbad`)

> **El registro de cambios no tenía entrada de Persona 2.** La entrada actual del registro fue reconstruida por Persona 5 a partir del commit y debe ser confirmada por Persona 2.

| Aporte | Archivos | Verificación de Persona 5 |
|---|---|---|
| `board_model` y `firmware_version` en el estado publicado | `firmware/pico/platform/hardware.py` (`resolve_board_model`), `hiles/distributed_worker.py`, `main.py` | Código presente; versión `3.0.0`; pruebas en `test_architecture.py` y `test_distributed_worker.py` |
| Manifiesto SHA-256 por archivo en el paquete | `scripts/prepare-pico-deployment.ps1`, `output/hiles-pico-w-deploy.zip` | ZIP de 33 archivos; SHA-256 `3e89069c…692921` coincide con `.sha256` |
| Aprovisionador con modos `Inventory`, `Backup` y `Deploy` que preserva `config_local.py` y `umqtt/` | `scripts/test-distributed-physical.ps1` | — |
| Prueba de aprovisionamiento sobre filesystem simulado | `scripts/test-pico-provisioning.ps1` (nuevo) | **Ejecutada por Persona 5: `PASS`** |
| Documentación del flujo | `docs/mqtt/GUIA_PRUEBA_PICO_W.md`, `PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md`, `firmware/tests/README.md` | Presentes |

**Pendiente:** inventario, respaldo y sincronización de las dos placas reales; comprobación de Pico W (RP2040) y Pico 2 W (RP2350) con el mismo runtime.
**Limitación:** el aprovisionador no usa puerto serie; la carga real sigue siendo con Thonny o `mpremote`.

### Historial anterior

- **Inicio:** textos, triángulos, conectores de nodos y menú hamburguesa.
- **E2:** verificación del backend y motor del demo.
- **E3:** Service, Functional Block, Sample, Hold y ejecución JavaScript aislada (`4bc57c8`).
- **E4:** cliente MQTT web (`04291f8`), 31/31 pruebas.
- **E5:** `LedTask` no bloqueante, `FakeLed`, plataforma Pico y `MqttTransport` (`8173811`, `f2efe24`).
- **E6 (Persona 5):** colaboración, integración y guía de demo (`9417dea`).
- **E7 (Persona 4 por descarte):** prototipo Three.js sin evidencia en Git.

---

## 4. IvanPrado23 — Persona 3 en la entrega 8

### Responsabilidad en la entrega 8

Frontend unificado, responsive y tutorial.

### Aportes de la entrega 8 (commit `ba76303`, 39 archivos)

| Aporte | Archivos principales | Verificación de Persona 5 |
|---|---|---|
| Controles únicos `Iniciar`/`Paso`/`Detener`/`Reiniciar` en la barra superior | `features/editor/TopBar.tsx` | Confirmado en el código; el panel de Ejecutores remite a la barra |
| Separación entre modo de conexión (Local/LAN, Remoto `wss://`) y destino de ejecución | `features/mqtt/MqttPanel.tsx`, `services/mqtt/config.ts` | Panel "Conexión" con texto "No decide dónde se ejecuta cada bloque" |
| Tokens `×N` en Places | `features/editor/PlaceTokenView.tsx` y su prueba | Presente |
| Estado obsoleto en nodos | `features/editor/nodeRuntimeView.ts`, `CustomNodes.tsx` | Presente |
| Responsive y menú compacto `⋯` | `editor.css`, `TopBar.tsx` | Menú móvil presente en el código |
| Tutorial de 12 pasos | `features/onboarding/tutorialSteps.ts` | 12 títulos confirmados |

**Resultado declarado:** 180 pruebas; seis viewports sin desbordamiento global.
**Evidencia no versionada:** el registro cita `reporte_implementacion_persona3.md` y capturas `step*_tutorial_highlight.png` y `audit_*.png`, que **no están en el repositorio**. Hasta que se agreguen, la evidencia visual queda declarada pero no verificable.
**Observación:** el registro de Persona 3 lleva fecha 4 de noviembre; el commit es del 5 de noviembre a las 00:17.

### Historial anterior

- **Inicio:** ajuste de espacios.
- **E2:** conexiones manuales y validaciones (`62073ba`, `846135f`).
- **E3 (Persona 4):** CodeMirror, panel de simulación, toggle JS/Python y clase pub/sub (`0ce01f1`, `e31264c`).
- **E4:** Pico W con MicroPython, Wi-Fi, `umqtt.simple`, LED físico, reconexión y evidencia física (solo registro; el código entró en `dd38309`).
- **E5 (Persona 4):** contrato e IR v1, compilador, vectores y bus `Node` (`723a7d6`).
- **E6 (Persona 2):** IR v2, compilador, canales y protocolo de proyecto (`20227da`, `89ccefc`).
- **E7 (Persona 2):** worker MicroPython multi-Pico (`f0ccc39`).

---

## 5. juandav08 — Persona 4 en la entrega 8

### Responsabilidad en la entrega 8

Conformidad, integración y pruebas físicas.

### Aportes de la entrega 8 (commit `d15d5a0`)

| Aporte | Archivos | Verificación de Persona 5 |
|---|---|---|
| Conformidad IR v2 Browser ↔ MicroPython con los mismos vectores | `frontend/src/engine/__tests__/ConformidadIrV2.test.ts` | Incluida en 187 pruebas |
| Canales CCH/DCH/LCH entre dos motores de fragmento | `ConformidadCanalesDistribuidos.test.ts` | Incluida en 187 pruebas |
| Vectores 04 (tokens, pesos, capacidad y conflicto) y 05 (Services y tipos) | `docs/mqtt/vectores_ir_v2/ejecucion/04_*.json`, `05_*.json` | Presentes; el firmware los usa (169 pruebas OK) |
| Matriz de conformidad | `docs/mqtt/vectores_ir_v2/MATRIZ_CONFORMIDAD_PERSONA_4.md` | Presente |
| Tutorial inactivo mientras se pide el nombre; sin bucle de renderizado del panel | `tutorialVisibility.ts`, `Editor.tsx`, `panelState.ts`, `PanelDock.test.tsx` | Presentes |

**Resultado declarado:** 187 frontend, 169 firmware, lint, TypeScript y build aprobados; runners MQTT en memoria y sobre broker real.
**Pendiente:** Pico ↔ navegador y Pico ↔ Pico físicas; tutorial con una persona nueva; ensayo humano completo.
**Observación:** la entrada usa nombres propios ("Juan David Romero", "Juan Romero"), en contra de la regla de identificación del registro.

### Historial anterior

- **Inicio:** modelo de persistencia, componentes, conexiones, zoom, undo/redo y figura 29.
- **E2:** rutas, waypoints y movimiento estable (`883c197`).
- **E3:** Place, Transition y evaluador Petri (`8340cb6`).
- **E4:** contrato JSON y puente MQTT → Service (`069ad92`, `831b79c`), 39/39 pruebas.
- **E6 (Persona 4):** topbar y paneles del canvas (`44baa29`).
- **E7 (Persona 5):** runners distribuidos automáticos, responsive móvil e identidad por nombre (`25b5dd7`, `a3302a9`).

---

## 6. jusraome — Persona 5 en la entrega 8

### Responsabilidad en la entrega 8

Documentación histórica, informes y trazabilidad. Sin código de producción.

### Aportes de la entrega 8

- [`CRONOLOGIA_PROYECTO.md`](CRONOLOGIA_PROYECTO.md), este documento, [`MATRIZ_REQUISITO_EVIDENCIA.md`](MATRIZ_REQUISITO_EVIDENCIA.md), [`INFORME_FINAL_ENTREGA_8.md`](INFORME_FINAL_ENTREGA_8.md) y [`GUION_DEMOSTRACION.md`](GUION_DEMOSTRACION.md).
- [`docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md`](../../docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md) y [`docs/architecture/ARQUITECTURA_SISTEMA.md`](../../docs/architecture/ARQUITECTURA_SISTEMA.md).
- Reconciliación de `README.md` y de las guías de `docs/`.
- Reverificación de suites, checksum y aprovisionamiento sobre `d15d5a0`.

**Observación:** las dos entradas "Persona 5" del 4 de noviembre (creación del plan y dedicación exclusiva) entraron en el commit `efab6eb` de KevMasMas; se conservan como redacción del plan.

### Historial anterior

- **E2:** integración front-back y cierre técnico (`818ad45`).
- **E3:** motor de simulación y orquestación (`6fa3dac`).
- **E5 (Persona 3):** motor HiLeS MicroPython y EngineTask (`1739c9a`, `db242b8`).
- **E6 (Persona 3):** motor MicroPython v2, canales, retardos y cuatro semáforos (`d0ed8fb`).
- **E7 (Persona 3):** worker de navegador v3, panel de ejecutores, colaboración y tutorial (`9135cf0`).
