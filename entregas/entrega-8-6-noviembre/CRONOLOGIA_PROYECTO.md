# Cronología del proyecto HiLeS Web

**Responsable del documento:** Persona 5 (entrega 8)
**Fuente de verdad:** historial Git de la rama `multi-pico` (`origin/multi-pico` = `d15d5a0`), planes y registros de `entregas/**`.
**Fecha de corte:** 7 de noviembre de 2026.

## Convenciones

- Los integrantes se identifican por su **alias de autor en Git**, porque es el único identificador verificable en el repositorio. La regla de la entrega 8 prohíbe registrar nombres propios nuevos; los documentos históricos que ya los contienen no se reescriben.
- El número de "Persona N" **cambia en cada entrega**. La tabla de equivalencias está en [`INFORMES_POR_PERSONA.md`](INFORMES_POR_PERSONA.md).
- Una fila marcada como *registro* se apoya en un plan o registro de cambios; una fila marcada como *Git* se apoya en un commit. Cuando un registro afirma algo que no tiene commit propio se indica.
- Los commits `main`, `master` y el archivo suelto `commit revision` no forman parte de esta reconstrucción.

## Línea de tiempo resumida

| Etapa | Fechas | Objetivo | Resultado verificable | Commits clave |
|---|---|---|---|---|
| Inicio del editor | 27 ago – 11 sep | Editor visual HiLeS y modelo documental | Primer commit, modelo de persistencia, componentes, conexiones, zoom, undo/redo, import/export JSON | `263ebe2`, `a9ef667`, `79cc495`, `8bbac7b`, `a4204c8`, `ef4b493`, `1cc3f93` |
| Entrega 2 — presentación | 17 – 18 sep | Reconstruir el circuito a mano y presentarlo | Conexiones manuales, rutas estables, integración front-back, demo de token | `ced6cc1`, `62073ba`, `846135f`, `883c197`, `818ad45`, `41a516d`, `444ae4c` |
| Entrega 3 — motor frontend | 22 – 25 sep | Eliminar backend y ejecutar HiLeS en el navegador | Backend retirado; motor TS, Petri, Service/FB/Sample/Hold, CodeMirror, Pyodide; 28 pruebas | `cf9ee38`, `8340cb6`, `6fa3dac`, `4bc57c8`, `0ce01f1`, `5362451`, `1eda202` |
| Entrega 4 — MQTT y Pico W | 7 – 9 oct | Conectar la web con una Pico W mediante Mosquitto | LED físico controlado desde la web; Service alimentado por MQTT; 39 pruebas frontend | `b4f25c2`, `04291f8`, `dd38309`, `069ad92`, `831b79c`, `7af5c98` |
| Entrega 5 — runtime MicroPython | 9 – 13 oct | Ejecutar HiLeS dentro de la Pico | Scheduler cooperativo, pub/sub, IR v1, motor MicroPython, cliente remoto web; 82 firmware / 70 frontend | `5b86d90`, `8173811`, `723a7d6`, `f2efe24`, `1739c9a`, `db242b8`, `b0bdade` |
| Guía de réplica | 16 oct | Reproducir el proyecto en otro PC | Guía Windows completa | `86a78a4`, `d6a2a39` |
| Entrega 6 — paridad remota | 18 – 20 oct | IR v2, Python en la Pico, colaboración | PythonExecutor, IR v2, motor v2, topbar, colaboración por proyecto; cierre físico el 25 oct | `ce56e51`, `20227da`, `89ccefc`, `d0ed8fb`, `44baa29`, `9417dea`, `4946984` |
| Generalización | 23 – 25 oct | Desacoplar el ejemplo de semáforos | Runtime general sin lógica vial; 153 firmware / 104 frontend en `baadff6` | `8ce4e06`, `baadff6`, `76381ff` |
| Entrega 7 — ejecución distribuida | 25 – 30 oct | Repartir un modelo entre varias Picos y navegadores | Protocolo v3, particionador, worker Pico, worker navegador, runners; 167 firmware / 148 frontend | `d2b8e81`, `f0ccc39`, `9135cf0`, `25b5dd7`, `a3302a9`, `19ef63c` |
| Preparación multi-Pico | 3 nov | Dos Picos físicas en el mismo proyecto | Base de la entrega 8; rama `multi-pico` parte de aquí | `f7cc9b6` |
| Entrega 8 — experiencia multi-Pico | 4 – 6 nov | Interfaz única, flota de Picos, conformidad | Ver detalle abajo | `efab6eb`, `6aac632`, `ba76303`, `c61dbad`, `d15d5a0` |

## Detalle por entrega

### Inicio del editor (27 de agosto – 11 de septiembre)

| Fecha | Autor Git | Aporte | Commit |
|---|---|---|---|
| 27 ago | KevMasMas | Commit inicial del repositorio | `263ebe2` |
| 27 ago | Juandav08 | Modelo inicial de persistencia HiLeS | `a9ef667` |
| 27 ago | valeld, SalasinformaticaUD | Commits de prueba y avance de front desde cuentas compartidas | `a8baa7f`, `3c89ef7` |
| 1 – 4 sep | juandav08 | Componentes, conexiones, figuras, zoom, Structural Block, undo/redo, persistencia tras F5, figura 29 | `79cc495`, `868cc3b`, `74ce822`, `a4204c8`, `3a59368` |
| 1 – 2 sep | KevMasMas | Documento de referencia HiLeS, Converters, import/export JSON | `6e24bf4`, `8bbac7b` |
| 2 sep | IvanPrado23 | Ajuste de espacios entre componentes | `b4184fe` |
| 3 – 10 sep | JulianRomero17 | Textos, triángulos, conectores de nodos, menú hamburguesa | `75ea6c1`, `05bc9f9`, `eaf6bcb`, `0efa003` |
| 11 sep | KevMasMas | Pliegues de flechas, rotación, primer backend con demo de token; merge de `front` | `ef4b493`, `1cc3f93` |

### Entrega 2 — 18 de septiembre

Documentos: [`entrega-2-18-septiembre/`](../entrega-2-18-septiembre/) (la carpeta `Primera-entrega/` contiene una copia anterior del mismo plan).

| Autor Git | Responsabilidad | Evidencia |
|---|---|---|
| IvanPrado23 | Conexiones manuales y reproducción del fallo | `62073ba`, `846135f`; registro 16:35 |
| juandav08 | Movimiento, rutas, waypoints y presentación visual | `883c197`, `1fb0447`; registro 18:11 |
| JulianRomero17 | Backend y motor del demo | `41a516d`, `30d871b` |
| jusraome | Integración front-back y cierre técnico | `818ad45`, `5eff73a`; registro 18:55 |
| KevMasMas | Organización de la entrega y demo 2 de token | `ced6cc1`, `444ae4c`, `f62529a` |

### Entrega 3 — 26 de septiembre (motor frontend)

Documentos: [`entrega-3-26-septiembre/`](../entrega-3-26-septiembre/).

| Autor Git | Responsabilidad | Evidencia |
|---|---|---|
| KevMasMas | Refactor: eliminación del backend y estructura del motor; cierre, pruebas, aislamiento entre bloques, demo de parqueadero | `cf9ee38`, `5362451`, `87a57ea`, `c632fcb`, `73b4d32`, `17a6bbb`, `1eda202` |
| juandav08 | Place, Transition y evaluador Petri | `8340cb6`, `09192c9`; seis escenarios Petri |
| jusraome | Motor de simulación y orquestación (grafo, Kahn, ciclos) | `6fa3dac`, `01c398f`; 99 aserciones |
| JulianRomero17 | Service, Functional Block, Sample, Hold, ejecución JS segura | `4bc57c8` |
| IvanPrado23 | Editor de código, panel de simulación, toggle JS/Python | `0ce01f1`, `e31264c` |

Resultado del cierre: 5 suites y 28 pruebas aprobadas, Pyodide local, demo de parqueadero funcional (registro del 25 de septiembre).

### Entrega 4 — 9 de octubre (MQTT y Pico W)

Documentos: [`entrega-4-9-octubre/`](../entrega-4-9-octubre/).

| Autor Git | Responsabilidad | Evidencia |
|---|---|---|
| KevMasMas | Mosquitto, red, ficha de conexión, cierre de la integración y demo LED web → Pico → web | `b4f25c2`, `dd38309`, `57fa399`, `7af5c98`; registros 16:17, 19:20, 19:35, 15:59, 16:23 |
| IvanPrado23 | Pico W, MicroPython, Wi-Fi, MQTT, reconexión, evidencia física del LED | Registros del 8 oct (16:35–20:30). Sin commit propio: el código entró en `dd38309` |
| JulianRomero17 | Cliente MQTT de la web | `04291f8`; 31/31 pruebas |
| juandav08 | Contrato JSON, puente MQTT → Service, pruebas de integración | `069ad92`, `831b79c`, `af3357b`; 39/39 pruebas |

### Entrega 5 — 13 de octubre (runtime MicroPython)

Documentos: [`entrega-5-13-octubre/`](../entrega-5-13-octubre/).

| Persona | Autor Git | Responsabilidad | Evidencia |
|---|---|---|---|
| 1 | KevMasMas | Scheduler cooperativo, integración y revisión final | `5b86d90`, `f7a8ebf`, `6f1313b`, `3af1bfc`, `dec6c68`, `b0bdade`; 82 firmware / 70 frontend |
| 2 | JulianRomero17 | LedTask, plataforma Pico y transporte MQTT | `8173811`, `f2efe24`; 28 firmware |
| 3 | jusraome | Motor HiLeS MicroPython y EngineTask | `1739c9a`, `db242b8`, `e64bc67`; 68 → 78 firmware |
| 4 | IvanPrado23 | Contrato, IR v1, compilador, vectores | `723a7d6` |
| 5 | **no identificado** | Cliente remoto web | Registro 18:15 "sin commit por indicación"; el plan dice "asignación de Persona 5 pendiente" |

### Entrega 6 — 20 de octubre (IR v2 y colaboración)

Documentos: [`entrega-6-20-octubre/`](../entrega-6-20-octubre/). Responsables confirmados en la sección "Confirmación de responsables" de su registro.

| Persona | Autor Git | Responsabilidad | Evidencia |
|---|---|---|---|
| 1 | KevMasMas | PythonExecutor, runtime values, Watchdog, revisión e integración | `3ea5220`, `13a7dd7`, `ce56e51`, `4625bf5`, `4946984` |
| 2 | IvanPrado23 | IR v2, compilador, canales, protocolo de proyecto | `20227da`, `89ccefc` |
| 3 | jusraome | Motor MicroPython v2 y demo manual | `d0ed8fb`, `72f81a9` |
| 4 | juandav08 | Topbar y aprovechamiento del canvas | `44baa29` |
| 5 | JulianRomero17 | Colaboración, integración y demo | `9417dea` |

Cierre físico posterior (25 de octubre, registro): flujo navegador → broker → Pico → navegadores confirmado; 153 firmware y 104 frontend en `baadff6`.

### Entrega 7 — 30 de octubre (ejecución distribuida v3)

Documentos: [`entrega-7-30-octubre/`](../entrega-7-30-octubre/).

| Persona | Autor Git | Responsabilidad | Evidencia |
|---|---|---|---|
| 1 | KevMasMas | Protocolo y particionador v3; integración final; semáforos en anillo; preparación multi-Pico | `d2b8e81`, `19ef63c`, `f7cc9b6` |
| 2 | IvanPrado23 | Worker MicroPython multi-Pico | `f0ccc39` |
| 3 | jusraome | Worker navegador, colaboración, tutorial y UX | `9135cf0`, `6d02a02` |
| 4 | **sin commit** | Prototipo Three.js (quedó pendiente) | Ninguna evidencia en Git |
| 5 | juandav08 | Runners de integración, responsive móvil, identidad colaborativa | `25b5dd7`, `a3302a9` |

Resultado: 167 firmware y 148 frontend; Browser ↔ Browser sobre Mosquitto real; placas físicas pendientes.

### Entrega 8 — 6 de noviembre (experiencia multi-Pico)

Documentos: este directorio. Rama `multi-pico`, base `f7cc9b6`.

| Fecha y hora (−05:00) | Persona | Autor Git | Objetivo | Commit | Estado |
|---|---|---|---|---|---|
| 04 nov 14:35 | 1 (y plan) | KevMasMas | Plan, registro y validación central de ejecutores | `efab6eb` | Software terminado |
| 04 nov 19:48 | 1 | KevMasMas | Control de ejecución único, `PicoSetupPanel`, generador `config_local.py` | `6aac632` | Software terminado |
| 05 nov 00:17 | 3 | IvanPrado23 | Interfaz unificada, responsive, tokens ×N, tutorial de 12 pasos | `ba76303` | Software y visual terminados |
| 05 nov 21:01 | 2 | JulianRomero17 | `board_model`/`firmware_version`, manifiesto SHA-256, aprovisionador | `c61dbad` | Software terminado; placas pendientes |
| 06 nov 10:05 | 4 | juandav08 | Conformidad Browser/MicroPython, canales distribuidos, foco del tutorial | `d15d5a0` | Software terminado; matrices físicas pendientes |
| 07 nov | 5 | jusraome | Cronología, informes, matriz de evidencia, reconciliación documental | este cambio | Documental |

## Evolución de las suites de prueba

| Momento | Frontend | Firmware | Fuente |
|---|---:|---:|---|
| Entrega 3 (25 sep) | 28 | — | Registro motor |
| Entrega 4 (8 oct) | 39 | — | Registro MQTT |
| Entrega 5 (12 oct) | 70 | 82 | Registro entrega 5 |
| Cierre físico (25 oct) | 104 | 153 | Registro entrega 6 |
| Entrega 7 (30 oct) | 148 | 167 | Plan entrega 7 |
| Entrega 8, Persona 1 (4 nov) | 161 | — | Registro entrega 8 |
| Entrega 8, Persona 3 (5 nov) | 180 | — | Registro entrega 8 |
| Entrega 8, Persona 4 (6 nov) | 187 | 169 | Registro entrega 8 |
| **Verificación de Persona 5 (7 nov, `d15d5a0`)** | **187 (intermitente: 186/187)** | **169** | Ver [`INFORME_FINAL_ENTREGA_8.md`](INFORME_FINAL_ENTREGA_8.md) |
