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

### [2026-10-18 13:52] — Responsable: Kevin Rincón (Persona 1)

- **Estado:** [x] Unidad autónoma terminada y probada en escritorio; [!] integración con IR v2 y prueba en Pico física pendientes de Personas 3 y 5.
- **Actividad del plan:** ejecutor Python y observabilidad en la Pico.
- **Qué se implementó:**
  - `PythonExecutor`, con compilación única, forma de expresión o `def calcular(...)`, entradas por nombre y salida escalar o por puertos.
  - Validador estático portable a MicroPython que rechaza imports, ciclos, recursión, introspección, archivos, hardware, atributos no autorizados y llamadas fuera de la lista segura.
  - Entorno de ejecución con builtins mínimos y errores estables con `codigo`, `mensaje` y `element_id`.
  - Validación y copia JSON de `boolean`, `integer`, `real`, `string`, `vector` y `custom`, con límites de profundidad, elementos, texto, vector y bytes.
  - `WatchdogTask` cooperativo para memoria, RSSI, temperatura opcional y estadísticas del scheduler; los fallos de sensores se informan sin detener la tarea.
  - Contrato de handoff y cuatro vectores compartidos para que Personas 2 y 3 consuman la API sin modificar los módulos de Persona 1.
- **Archivos creados:**
  - `firmware/pico/hiles/python_executor.py`
  - `firmware/pico/hiles/runtime_values.py`
  - `firmware/pico/devices/watchdog_task.py`
  - `firmware/tests/test_python_executor.py`
  - `firmware/tests/test_runtime_values.py`
  - `firmware/tests/test_watchdog_task.py`
  - `docs/mqtt/IR_V2_PYTHON.md`
  - `docs/mqtt/vectores_ir_v2/python/validos/01_expresion_escalar.json`
  - `docs/mqtt/vectores_ir_v2/python/validos/02_funcion_multiples_salidas.json`
  - `docs/mqtt/vectores_ir_v2/python/invalidos/01_import_hardware.json`
  - `docs/mqtt/vectores_ir_v2/python/invalidos/02_ciclo_infinito.json`
- **Archivos modificados:**
  - `firmware/tests/README.md`
  - `entregas/entrega-6-20-octubre/PLAN_IMPLEMENTACION_ENTREGA_20.md`
  - `entregas/entrega-6-20-octubre/REGISTRO_CAMBIOS.md`
- **Archivos deliberadamente no modificados:** `firmware/pico/core/task.py`, `scheduler.py`, `clock.py`, `pubsub/mqtt_transport.py`, el motor IR v1 y `main.py`.
- **Commit o rama:** árbol de trabajo actual; commit pendiente.
- **Cómo se probó:**
  - Comando focal: Python incluido en el entorno, `-m unittest firmware.tests.test_runtime_values firmware.tests.test_python_executor firmware.tests.test_watchdog_task -v`.
  - Resultado focal: **19 pruebas aprobadas**.
  - Comando firmware: Python incluido en el entorno, `-m unittest discover -s firmware/tests -v`.
  - Resultado firmware: **104 pruebas aprobadas en 0,062 s**; eran 85 y se agregaron 19.
  - Comando frontend: `vitest run`, `eslint .`, `tsc -b` y `vite build` mediante los binarios locales.
  - Resultado frontend: **70 pruebas aprobadas en 12 archivos**, lint y tipos sin errores, build exitoso. Vite conserva únicamente el aviso conocido por tamaño del chunk principal.
- **Evidencia funcional:** expresión reutilizada con una sola compilación; función `calcular(**inputs)` del modelo de parqueadero; múltiples salidas; custom; rechazos de import/ciclo/recursión/hardware; error del bloque sin detener una tarea heartbeat; telemetría aun cuando falla un sensor.
- **Impacto sobre otros integrantes:**
  - Persona 2 debe copiar el esquema y límites de `IR_V2_PYTHON.md` en TypeScript y usar los vectores compartidos.
  - Persona 3 debe importar `PythonExecutor` y `runtime_values`; no debe duplicar ni modificar la validación. La integración debe ser transaccional: si un executor no compila, el modelo anterior continúa activo.
  - Persona 5 debe registrar `WatchdogTask` y los lectores reales desde `main.py`.
- **Riesgos o pendientes:**
  - No se ejecutó todavía en una Pico física; `compile`/`exec`, consumo de memoria y tiempos deben medirse en la placa.
  - El perfil previene bloqueos evidentes, pero no es un sandbox para código hostil ni puede interrumpir una función ya iniciada.
  - El executor todavía no está conectado al motor IR v2; esa integración pertenece a Persona 3.
  - Publicación MQTT del error y conservación transaccional del modelo se validarán al integrar `EngineTask` v2.
- **Reversión:** retirar los archivos nuevos y revertir únicamente las secciones añadidas al plan, README de pruebas y este registro; no hay migración de datos ni cambios al runtime anterior.
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

### [2026-10-18 20:20] — Responsable: Ivan Felipe Prado Blanco (Persona 2)

- **Estado:** [x] Hecho (unidad autónoma, contratos, vectores de conformidad, motor TS de referencia y cliente de sincronización por proyecto terminados y probados en escritorio; [!] integración de `?project=<id>` en la interfaz/stores y prueba E2E física pendientes de Personas 3, 4 y 5).
- **Actividad del plan:** Persona 2 — IR v2, compilador, canales y protocolo de proyecto.
- **Qué se implementó o corrigió:**
  - **Contrato y tipos IR v2 (`tiposIrV2.ts`, `IR_V2.md`):** extensión de la representación intermedia a `ir_version: 2` manteniendo compatibilidad de lectura y migración automática desde IR v1 (`ir_version: 1` vía `migrarIrV1AV2`). Soporte de `service`, `functional_block` (`lenguaje: "python" | "expresion"`, `codigo`, `entradas`, `salidas`, `retardo_ms`), `sample`, `hold`, `place` y `transition` (`retardo_ms`), canales diferenciados `cch`, `dch` (con `capacidad_cola`, `DEFAULT_DCH_QUEUE_CAPACITY = 8`, `MAX_DCH_QUEUE_CAPACITY = 32` y diagnóstico `DCH_COLA_DESBORDADA`), `lch` y `arco`, además de valores runtime `boolean`, `integer`, `real`, `string`, `vector` y `custom` acotados. Documentación en `IR_V2.md` alineada con la ruta real del firmware (`firmware/pico/hiles/`) y profundidad máxima AST `16`.
  - **Validador del perfil Python v2 y presupuesto MQTT (`validadorIrV2.ts`):** validación estática en TypeScript alineada 1:1 con `firmware/pico/hiles/python_executor.py` y `runtime_values.py` de Persona 1 (mismos límites exactos: `2048` bytes y `40` líneas de código Python, máximo `16` entradas y `16` salidas, vectores de hasta `32` posiciones, profundidad JSON `6`, máximo `2048` bytes por valor serializado; mismos códigos `PYTHON_*` y `VALOR_*`). Se eliminó el traductor Python-a-JS duplicado para que la simulación local delegue en el pipeline `ejecutarPython` (Worker Pyodide) junto con `normalizarEntradasPython` (sin rellenar entradas faltantes con valores por defecto) y `normalizarSalidasPython`. Se agregó además la validación del tamaño total del modelo IR v2 serializado (`IR_MAX_MODELO_BYTES_V2 = 31744` bytes dentro del presupuesto MQTT de `32 KiB`, código `IR_LIMITE_EXCEDIDO`).
  - **Compilador IR v2 (`compiladorIrV2.ts`, `index.ts`):** compilación de documentos visuales (`HilesModelDocument`) a `IrModeloV2` mediante `compilarModeloEditorAIrV2` sin edición manual; resolución y aplanado verificable de `STRUCTURAL_BLOCK` y puertos de frontera; normalización de elementos/conexiones legados `TOKEN` y `TOKEN_FLOW`; preservación de `executionDelay`, `delay` de transición y `connection.delay`.
  - **Motor TypeScript de referencia (`BusObserver.ts`, `GrafoDatos.ts`, `MotorSimulacion.ts`):** colas FIFO para canales `DCH` con consumo de 1 evento por paso y puerto, emisión discreta desde `Service` únicamente cuando se inyecta una nueva muestra (`inyectarEntrada` -> `registrarMuestraService`, evitando repetir muestras retenidas en pasos sin inyección); canales `CCH` continuos con retención del último valor que solo reprograman o reemplazan entregas diferidas cuando el valor emitido cambia (permitiendo estabilización con `retardo_ms > 0`); canales `LCH` de un pulso por paso; planificación cooperativa de retardos por fechas límite (`relojMs`) sin `sleep`; métodos `construirDesdeIrV2(modelo)` y `extraerElementosEstadoIrV2(modelo, motor)`; limpieza completa de colas, eventos, valores retenidos y timers en `reiniciar()`.
  - **Protocolo y cliente de proyecto compartido (`projectUrl.ts`, `projectTopics.ts`, `projectMessages.ts`, `ProjectSyncClient.ts`, `PROTOCOLO_PROYECTOS_V2.md`):** lectura/escritura de `?project=<id>` (`obtenerProjectIdDeSearch`, `construirUrlCompartibleProyecto`, `asegurarProjectIdEnUrl`); unificación de tópicos con el plan congelado `udfjc/hiles/v2/projects/<projectId>/{document/snapshot,document/ops,presence,cursor}`; operaciones incrementales reales en `document/ops` (`node.add`, `node.move`, `node.update`, `node.remove`, `connection.add`, `connection.update`, `connection.remove`, `document.patch`) mediante `calcularOperacionesEntreDocumentos` y `aplicarOperacionIncrementalADocumento` sin publicar dos veces el documento completo; reloj lógico Lamport real (`clock`), deduplicación por `operationId` y resolución determinista LWW `(clock, client_id)` por entidad en `ControlConvergenciaProyectoV2`; esquema y sincronización de cursores (`MensajeProyectoCursor`, `publicarCursor`, `onRemoteCursor`); presencia retenida (`retain: true, qos: 1`) con configuración de MQTT Last Will (`setWillMessage`) y expiración por TTL (`ttl_ms`, `expirarColaboradoresInactivos`).
  - **Enrutamiento y validación MQTT por proyecto (`config.ts`, `messages.ts`, `MqttClient.ts`, `RemoteExecutionClient.ts`):** enrutamiento en `validarMensajeMqtt` de los sufijos de simulación y error por proyecto (`simulacion/modelo/cargar`, `simulacion/modelo/confirmacion`, `simulacion/comando`, `simulacion/entrada/establecer`, `simulacion/estado`, `simulacion/salida`, `error`) hacia las reglas de validación de simulación preservando el topic original del proyecto para `RemoteExecutionClient`, y soporte de `setWillMessage` en `MqttClient.ts`.
  - **Vectores de conformidad compartidos (`docs/mqtt/vectores_ir_v2/**`):** 3 modelos válidos, 8 modelos inválidos y 3 vectores de ejecución paso a paso (Python vector/custom, Sample/Hold + DCH/LCH + desborde FIFO, retardos no bloqueantes + cancelación en reset).
- **Archivos modificados:**
  - `docs/mqtt/IR_V2.md` (nuevo)
  - `docs/mqtt/PROTOCOLO_PROYECTOS_V2.md` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/validos/01_python_vector_custom.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/validos/02_sample_hold_canales.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/validos/03_retardos_no_bloqueantes.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/01_python_import_prohibido.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/02_python_bucle_prohibido.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/03_valor_vector_excede_limite.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/04_dch_capacidad_invalida.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/05_retardo_invalido.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/06_ciclo_datos_cch.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/07_puerto_invalido.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/modelos/invalidos/08_arco_invalido.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/ejecucion/01_python_vector_custom.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/ejecucion/02_sample_hold_dch_lch.json` (nuevo)
  - `docs/mqtt/vectores_ir_v2/ejecucion/03_retardos_y_cancelacion.json` (nuevo)
  - `frontend/src/services/ir/tiposIrV2.ts` (nuevo)
  - `frontend/src/services/ir/validadorIrV2.ts` (nuevo)
  - `frontend/src/services/ir/compiladorIrV2.ts` (nuevo)
  - `frontend/src/services/ir/irV2.test.ts` (nuevo)
  - `frontend/src/services/ir/index.ts`
  - `frontend/src/services/projects/projectUrl.ts` (nuevo)
  - `frontend/src/services/projects/projectTopics.ts` (nuevo)
  - `frontend/src/services/projects/projectMessages.ts` (nuevo)
  - `frontend/src/services/projects/ProjectSyncClient.ts` (nuevo)
  - `frontend/src/services/projects/projectSync.test.ts` (nuevo)
  - `frontend/src/services/mqtt/config.ts`
  - `frontend/src/services/mqtt/messages.ts`
  - `frontend/src/services/mqtt/MqttClient.ts`
  - `frontend/src/services/mqtt/RemoteExecutionClient.ts`
  - `frontend/src/engine/BusObserver.ts`
  - `frontend/src/engine/GrafoDatos.ts`
  - `frontend/src/engine/MotorSimulacion.ts`
  - `frontend/src/engine/__tests__/MotorSimulacionIrV2.test.ts` (nuevo)
  - `entregas/entrega-6-20-octubre/PLAN_IMPLEMENTACION_ENTREGA_20.md`
  - `entregas/entrega-6-20-octubre/REGISTRO_CAMBIOS.md`
- **Archivos de otros integrantes tocados:** ninguno (se respetó estrictamente la frontera de propiedad definida en el plan).
- **Commit o rama:** rama `implementacionp2` (lista para merge con `mqtt-pico`).
- **Cómo se probó:**
  - Comando pruebas unitarias y de conformidad (escritorio): `npm.cmd test -- --run` en `frontend/`
  - Resultado pruebas: **15 archivos de prueba aprobados, 92 pruebas aprobadas** (incluyendo las 70 pruebas preexistentes de regresión + 22 pruebas nuevas en `irV2.test.ts`, `projectSync.test.ts` y `MotorSimulacionIrV2.test.ts`).
  - Comando linter: `npm.cmd run lint` (`eslint .`) en `frontend/`
  - Resultado linter: **0 errores, 0 advertencias**.
  - Comando compilación y tipos: `npm.cmd run build` (`tsc -b && vite build`) en `frontend/`
  - Resultado compilación: **exit code 0**, build de producción generado en `frontend/dist/`.
- **Evidencia:**
  - Validación de los 11 modelos v2 (`docs/mqtt/vectores_ir_v2/modelos/**`), rechazo de modelos que superan el presupuesto MQTT de 32 KiB (`IR_LIMITE_EXCEDIDO`) y reproducción paso a paso de los 3 vectores de ejecución (`docs/mqtt/vectores_ir_v2/ejecucion/**`) en `irV2.test.ts`.
  - Prueba integral de la ruta real `Service → conexión DCH → BusObserver → Hold` mediante `motor.inyectarEntrada(...)` comprobando no repetición de muestras en pasos sin inyección, y prueba de estabilización `Service constante → CCH con retardo → Functional Block` en `MotorSimulacionIrV2.test.ts`.
  - Pruebas de tópicos `udfjc/hiles/v2/projects/<projectId>/...`, reloj Lamport, deduplicación por `operationId`, desempate LWW `(clock, client_id)` por entidad, fusión de operaciones incrementales concurrentes sin sobrescritura, cursores, Last Will, expiración TTL y ruta completa `MqttClient → validarMensajeMqtt → RemoteExecutionClient` para tópicos de simulación por proyecto en `projectSync.test.ts`.
- **Impacto sobre otros integrantes:**
  - **Persona 3:** dispone de `docs/mqtt/IR_V2.md` y de todos los vectores en `docs/mqtt/vectores_ir_v2/{modelos,ejecucion}/**` para verificar paridad entre `MotorSimulacion` (TypeScript) y `engine_v2.py` (MicroPython).
  - **Persona 4:** dispone de `obtenerProjectIdDeSearch`, `construirUrlCompartibleProyecto` y `asegurarProjectIdEnUrl` en `frontend/src/services/projects/projectUrl.ts`, además de los estados extendidos en `IrEstadoElementoV2`.
  - **Persona 5:** dispone de `ProjectSyncClient` en `frontend/src/services/projects/ProjectSyncClient.ts` y `RemoteExecutionClient.cargarModeloIrV2` en `frontend/src/services/mqtt/RemoteExecutionClient.ts` para integrarlos con `App.tsx` y los stores de colaboración/proyecto.
- **Riesgos o pendientes:**
  - La lectura automática de `?project=<id>` al iniciar `App.tsx` y su conexión con `useProjectStore` / `useCollaborationStore` permanece pendiente para Persona 5 (propietaria de `App.tsx` y de los stores).
  - Las pruebas ejecutadas por Persona 2 son de escritorio sobre Vitest; la prueba E2E con broker Mosquitto real, cuatro navegadores y la Pico física corresponde a la integración de Persona 5.
- **Reversión, si aplica:** eliminar los archivos nuevos listados arriba y restaurar con `git checkout --` los archivos modificados de `frontend/src/`; la compatibilidad con IR v1 permanece intacta.

## Confirmación de responsables

- [x] Persona 1 — Nombre: Kevin Rincón
- [x] Persona 2 — Nombre: Ivan Felipe Prado Blanco
- [ ] Persona 3 — Nombre:
- [ ] Persona 4 — Nombre:
- [ ] Persona 5 — Nombre:

## Control de integración

- [x] Persona 1 registra contrato y runtime autónomo; integración IR v2 y prueba física continúan pendientes.
- [x] Persona 2 registra protocolo web y URL.
- [ ] Persona 3 registra semáforos y sensores.
- [ ] Persona 4 registra UI/UX.
- [ ] Persona 5 registra colaboración e integración.
- [ ] Todos los integrantes registraron sus cambios y pruebas.
- [ ] La entrada de cierre coincide con los resultados reales.
- [ ] No hay casillas cerradas sin prueba o evidencia.

