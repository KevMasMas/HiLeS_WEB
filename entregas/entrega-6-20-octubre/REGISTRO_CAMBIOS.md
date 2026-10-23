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

### [2026-10-18 21:12] — Responsable: Kevin Rincón (Persona 1, revisión técnica del handoff de Persona 2)

- **Estado:** [x] Correcciones de revisión terminadas y probadas en escritorio; [!] prueba E2E con Mosquitto real y cuatro navegadores continúa asignada a Persona 5.
- **Actividad del plan:** cierre de defectos encontrados al revisar Persona 2 antes del merge de sincronización colaborativa.
- **Qué se corrigió:**
  - La presencia retenida dejó de compartir un único topic. Cada colaborador publica en `udfjc/hiles/v2/projects/<projectId>/presence/<clientId>` y los clientes se suscriben a `presence/+`, por lo que el broker conserva una entrada independiente por usuario.
  - El parser de topics extrae `clientIdPresencia` y `ProjectSyncClient` rechaza mensajes cuyo `client_id` no coincide con el segmento del topic.
  - Se agregó reconexión MQTT limpia para instalar realmente el Last Will cuando el cliente compartido ya estaba conectado o conectándose. Las suscripciones registradas se recuperan sin duplicar el contador de consumidores.
  - El cierre MQTT normal ahora usa DISCONNECT limpio y evita disparar incorrectamente el Last Will.
  - Se agregó heartbeat automático de presencia con intervalo configurable y valor por defecto `ttl_ms / 3`; el mismo ciclo expira colaboradores remotos vencidos y elimina sus cursores.
  - Una publicación incremental fallida ya no adelanta el documento confirmado. El documento objetivo queda pendiente y se recalcula/reintenta cuando MQTT vuelve a `CONNECTED`.
  - Después de operaciones exitosas se genera un checkpoint retenido de `document/snapshot`, con debounce configurable de 2 segundos, para que un cliente tardío pueda hidratar el estado actual sin historial de operaciones.
  - Se eliminó la doble suscripción causada por suscribirse en `conectar()` y otra vez en cada evento `CONNECTED`.
  - Al cerrar o cambiar de proyecto se publica primero cualquier edición que aún estuviera esperando el debounce y después su checkpoint, evitando perder el último movimiento del usuario.
- **Archivos modificados:**
  - `frontend/src/services/projects/projectTopics.ts`
  - `frontend/src/services/projects/ProjectSyncClient.ts`
  - `frontend/src/services/projects/projectSync.test.ts`
  - `frontend/src/services/mqtt/MqttClient.ts`
  - `docs/mqtt/PROTOCOLO_PROYECTOS_V2.md`
  - `entregas/entrega-6-20-octubre/PLAN_IMPLEMENTACION_ENTREGA_20.md`
  - `entregas/entrega-6-20-octubre/REGISTRO_CAMBIOS.md`
- **Commit o rama:** `persona2-local`, commit pendiente.
- **Cómo se probó:**
  - `npm.cmd test -- --run` en `frontend/`: **15 archivos y 95 pruebas aprobadas**.
  - `npm.cmd run lint` en `frontend/`: **0 errores y 0 advertencias**.
  - `npm.cmd run build` en `frontend/`: TypeScript y Vite aprobados; permanece únicamente el aviso conocido del chunk principal mayor a 500 kB.
  - Python incluido con Codex, `-m unittest discover -s firmware/tests -v`: **104 pruebas aprobadas en 0,063 s**.
- **Evidencia nueva:** pruebas automáticas para topic de presencia por cliente, wildcard, Last Will individual, una sola suscripción por topic, reconexión para aplicar Will, reintento de una edición fallida, checkpoint retenido, heartbeat periódico y vaciado del último cambio con debounce al cerrar.
- **Impacto sobre otros integrantes:** Persona 5 puede integrar `ProjectSyncClient` con los stores y componentes sin implementar temporizadores, reintentos, checkpoints ni corregir la gestión de presencia en archivos de Persona 2.
- **Riesgos o pendientes:** falta ejecutar con Mosquitto real la desconexión abrupta, comprobar el Last Will y abrir cuatro navegadores para validar la retención de cuatro presencias. Esa evidencia no se reemplaza con las pruebas de escritorio.
- **Reversión, si aplica:** revertir esta entrada y los cambios de los seis archivos funcionales/documentales anteriores; no existen migraciones persistentes.

### [2026-10-18 22:03] — Responsable: Juan Ramos (Persona 3)

- **Estado:** [x] Motor MicroPython v2 y semáforos distribuidos terminados y probados en escritorio. [!] Pendientes: integración en `main.py` y paquete de despliegue (Persona 5), y prueba en la Pico física.
- **Actividad del plan:** Persona 3 — Motor MicroPython completo y cuatro semáforos independientes (las 18 casillas de «Control de avance nuevo» y las 5 del entregable).
- **Revisión previa:**
  - Se revisaron el plan, este registro, `IR_V2.md`, `IR_V2_PYTHON.md`, los 18 vectores de `docs/mqtt/vectores_ir_v2/`, `python_executor.py` y `runtime_values.py` de Persona 1.
  - También el motor TypeScript de referencia de Persona 2 (`validadorIrV2.ts`, `BusObserver.ts`, `GrafoDatos.ts`, `MotorSimulacion.ts`, elementos, `extraerElementosEstadoIrV2` y `MotorSimulacionIrV2.test.ts`) y el `EngineTask` con deduplicación de Persona 1.
  - Línea base: 104 pruebas de firmware y 95 de frontend aprobadas.
- **Qué se implementó:**
  1. **Carga IR v2 con compatibilidad v1** (`hiles/model_v2.py`):
     - `validate_ir_v2` replica el orden de comprobaciones de `validarModeloIrV2` y reporta el mismo primer código que la web.
     - Cubre límites, perfil Python (mediante `validate_python_source`), valores (mediante `validate_runtime_value`), `IR_CAPACIDAD_INVALIDA`, `IR_RETARDO_INVALIDO`, puertos, arcos, ciclos (DFS iterativo) y presupuesto de 31744 bytes.
     - `migrate_v1_to_v2` equivale a `migrarIrV1AV2`.
     - `validate_load_message_v2` acepta `ir_version` 1 o 2.
  2. **Canales diferenciados** (`hiles/channels.py`):
     - CCH continuo, con retardo solo si el valor cambia y reemplazo de la entrega pendiente.
     - DCH con cola FIFO acotada (8 por defecto, 32 como máximo), un consumo por paso y puerto, y `desbordada` visible.
     - LCH como pulso de un paso; al cerrar el paso se limpia en transiciones.
     - Un Service solo emite por DCH/LCH las muestras inyectadas en el paso.
  3. **Elementos v2** (`hiles/elements_v2.py`): `Service`, `Functional Block` en modo Python o expresión, `Sample`, `Hold`, `Place` (con `capacidad: null` sin cota) y `Transition`.
  4. **`PythonExecutor` de Persona 1 en Functional Block:**
     - Compila una sola vez al cargar; un fallo rechaza toda la carga y conserva el modelo activo.
     - Ejecuta una vez por evaluación, enruta salidas por nombre de variable y trata `None` como «sin salida».
     - Publica en el snapshot el `codigo` del error del bloque sin detener a los demás elementos.
  5. **Motor v2** (`hiles/engine_v2.py`):
     - Paso igual al de `MotorSimulacion.paso`: reloj lógico, entregas vencidas, orden services → transitions → resto topológico, Petri con conflicto y cierre de pulsos.
     - Retardos de elemento, conexión y transición como fechas límite; con `time_source` el avance se mide con `scheduler.clock`.
     - Snapshot con el formato exacto de `extraerElementosEstadoIrV2`: `salidas`, `valor_retenido`, `evento_pendiente`, `cola_dch`, `cola_desbordada`, `timer_pendiente` y `error`.
     - `reset()` limpia entradas, salidas, colas, eventos, timers, retenidos, tokens y reloj.
     - Los valores inyectados se validan y clonan una sola vez y se propagan sin nuevas copias.
  6. **`EngineTaskV2`** (`hiles/engine_task_v2.py`):
     - Hereda sin modificarlo el `EngineTask` existente (cola, deduplicación y comandos).
     - `ir_version: 1` usa el motor v1 y conserva sus snapshots; `ir_version: 2` usa el motor v2.
     - `submit_local_input` permite que los dispositivos de la Pico inyecten valores por la cola acotada, sin MQTT.
  7. **Cuatro semáforos independientes** (`devices/traffic_controller.py`):
     - Una `TrafficLightFsm` por sentido, con estado privado `ROJO → VERDE → AMARILLO → ROJO`; el salto verde → rojo lanza excepción.
     - `IntersectionArbiter` solo concede permisos de un ciclo: exige que los conflictos estén en rojo hace al menos `todo_rojo_ms`, impide adelantar a solicitudes más antiguas en conflicto y señala ceder o urgente.
     - Matriz de conflictos validada (simétrica) y `TrafficTiming` para verde mínimo y máximo, amarillo, todo-rojo y espera máxima.
     - Monitor que entra en modo seguro ante un conflicto imposible.
     - Fail-safe: un sensor inválido se trata como presencia.
  8. **Sensores, simulador y GPIO:**
     - `VehicleSensorTask` (`devices/vehicle_sensor_task.py`): antirrebote, detección de falla por `falla_ms` y fuentes `Simulated`, `Scripted` y `Manual` (generador reproducible igual en CPython y MicroPython).
     - `platform/traffic_io.py`: `GpioPresenceInput`, `TrafficLightOutput` y `build_traffic_io` con `machine` inyectable.
  9. **Demo generado por script:**
     - `scripts/generate-distributed-traffic-demo.mjs` genera `output/demo-4-semaforos-distribuidos.json`: cuatro bloques con su sensor, su luz y un Functional Block Python de lámparas y solicitud, más un bloque «Seguridad del cruce» con la matriz.
     - Se compiló con el compilador web real `compilarModeloEditorAIrV2`: 0 errores, 0 advertencias, 13 elementos y 12 conexiones CCH.
     - La IR resultante quedó como fixture en `docs/traffic/ir_demo_semaforos_distribuidos.json`.
  10. **Documentación:** `docs/traffic/PROTOCOLO_SEMAFOROS.md` (arquitectura, FSM, permisos, fail-safe, formato publicado y fragmento de integración para `main.py`) y `docs/traffic/MATRIZ_CONFLICTOS.md` (pares incompatibles, tiempos y espera máxima garantizada).
- **Archivos creados:**
  - `firmware/pico/hiles/model_v2.py`
  - `firmware/pico/hiles/channels.py`
  - `firmware/pico/hiles/elements_v2.py`
  - `firmware/pico/hiles/engine_v2.py`
  - `firmware/pico/hiles/engine_task_v2.py`
  - `firmware/pico/devices/traffic_controller.py`
  - `firmware/pico/devices/vehicle_sensor_task.py`
  - `firmware/pico/platform/traffic_io.py`
  - `firmware/tests/test_hiles_model_v2.py`
  - `firmware/tests/test_hiles_engine_v2.py`
  - `firmware/tests/test_hiles_channels.py`
  - `firmware/tests/test_hiles_delays.py`
  - `firmware/tests/test_traffic_controller.py`
  - `scripts/generate-distributed-traffic-demo.mjs`
  - `output/demo-4-semaforos-distribuidos.json` (generado; no se edita a mano)
  - `docs/traffic/PROTOCOLO_SEMAFOROS.md`
  - `docs/traffic/MATRIZ_CONFLICTOS.md`
  - `docs/traffic/ir_demo_semaforos_distribuidos.json` (fixture compilado; archivo adicional dentro de la carpeta propia `docs/traffic/`)
- **Archivos modificados:**
  - `firmware/tests/test_hiles_engine.py` (prueba propia de la entrega 5; ver el detalle en «Cambios en archivos fuera de la lista propia»)
  - `entregas/entrega-6-20-octubre/PLAN_IMPLEMENTACION_ENTREGA_20.md`
  - `entregas/entrega-6-20-octubre/REGISTRO_CAMBIOS.md`
- **Commit o rama:** rama `mqtt-pico`, commit `d0ed8fb`.
- **Cómo se probó:**
  - Firmware, desde la raíz: `python -m unittest discover -s firmware/tests -t .` (Python 3.13.2) → **172 pruebas aprobadas** (`OK`): las 104 anteriores y 68 nuevas.
  - Por archivo nuevo: `test_hiles_model_v2` 15, `test_hiles_engine_v2` 15, `test_hiles_channels` 10, `test_hiles_delays` 6 y `test_traffic_controller` 22.
  - Frontend, como regresión en `frontend/`: `npx vitest run` → **15 archivos y 95 pruebas aprobadas**, sin cambios en archivos del frontend.
  - Compilación del demo: prueba temporal de Vitest fuera del repositorio que llama `compilarModeloEditorAIrV2` sobre `output/demo-4-semaforos-distribuidos.json` → aprobada, sin errores ni advertencias. Esa prueba no quedó en el repositorio.
- **Resultado obtenido:**
  - Paridad: los 3 modelos válidos, los 8 inválidos (con el mismo `codigo_esperado`) y los 3 vectores de ejecución v2 se reproducen sin modificar los vectores. También se portaron las 3 pruebas de `MotorSimulacionIrV2.test.ts` (ruta Service → DCH → Hold con desborde, CCH con retardo que se estabiliza, cancelación de timer y reset).
  - Compatibilidad v1: los 3 vectores v1 siguen produciendo sus snapshots por `EngineTaskV2`, y los modelos v1 se migran y validan como v2.
  - No bloqueo: con un retardo pendiente de 5 s, `CounterTask` y `WatchdogTask` siguieron ejecutándose (≥ 390 actualizaciones y ≥ 19 publicaciones de telemetría) y la transición disparó al vencer la fecha límite. Cargar otro modelo o reiniciar descarta los temporizadores.
  - Semáforos:
    - Con demanda permanente en los cuatro sentidos se observa `rr → vv (20 s) → aa (3 s) → rr (2 s) → ` alternando ejes; tiempo máximo en rojo ≤ 27,2 s y al menos tres verdes por sentido.
    - Con tráfico aleatorio no hubo verdes incompatibles ni saltos verde → rojo: 3 semillas en las pruebas, más 5 horas virtuales en una exploración previa con espera máxima de 17 s.
    - Una espera larga obliga a ceder.
    - Con sensores inválidos (`None`, excepción o texto) todos los sentidos siguen recibiendo servicio.
    - El monitor entra en modo seguro ante un conflicto forzado.
  - Integración del demo: `TrafficControllerTask` alimentó el modelo del demo por `submit_local_input`; `Seguridad del cruce` reportó siempre `seguro: true`.
- **Evidencia:** salida de `unittest` y Vitest en la consola de trabajo.
- **Cambios en archivos fuera de la lista propia:**
  - `firmware/tests/test_hiles_engine.py` es una prueba propia de la entrega 5. Buscaba palabras del semáforo como subcadenas, y `ensure_ascii` de `model_v2.py` contiene «sur». Ahora compara palabras completas y se agregó «oeste». Es el riesgo que se dejó anotado en la entrega 5.
  - No se modificó `engine_task.py`, `python_executor.py`, `runtime_values.py`, `watchdog_task.py`, `main.py`, ningún archivo del frontend, los contratos ni los vectores.
- **Impacto sobre otros integrantes:**
  - **Persona 5:** debe reemplazar `EngineTask` por `EngineTaskV2` en `main.py` y registrar sensores y `TrafficControllerTask`; el fragmento está en `PROTOCOLO_SEMAFOROS.md` §7. También debe agregar a `prepare-pico-deployment.ps1` los archivos nuevos de `hiles/`, `devices/` y `platform/`. Conviene `queue_size` ≥ 16 porque el controlador puede encolar hasta 8 entradas locales por cambio.
  - **Persona 4:** los estados observables para la UI son los campos del snapshot v2 (`salidas`, `valor_retenido`, `evento_pendiente`, `cola_dch`, `cola_desbordada`, `timer_pendiente`, `error`) y, en el demo, `seguridad-cruce.salidas.seguridad-eje`.
  - **Persona 2 (diferencias encontradas en el motor TS; la Pico sigue la decisión indicada):**
    1. En TS, `capacidad: null` crea un Place con capacidad 1, pero `IR_V2.md` dice «sin cota»; la Pico sigue la especificación.
    2. El validador acepta `+` y `!` unarios y `&&`/`||`, pero el evaluador TS niega numéricamente `!` y devuelve 0 para `&&`/`||`; la Pico los trata como alias de identidad, `not`, `and` y `or`.
    3. Sample y Hold ignoran `habilitado` en TS; la Pico hace lo mismo por paridad.
    4. La política de conflicto Petri es global, lo que impide FSM Petri concurrentes (explicado en `PROTOCOLO_SEMAFOROS.md` §6).
    5. Con varias salidas, TS exige el diccionario completo y el ejecutor de Persona 1 acepta uno parcial; la Pico usa el ejecutor, como manda el contrato.
- **Riesgos o pendientes:**
  - No hay MicroPython ni Pico disponibles. El código evita funciones exclusivas de CPython (sin f-strings, sin recursión profunda en la detección de ciclos), pero falta medir memoria y tiempos de `update()` con modelos de 64 elementos en la placa.
  - El adaptador GPIO solo se probó con un `machine` simulado.
  - En la simulación local de la web, `paso()` avanza el tiempo en 0 ms, así que los retardos solo avanzan cuando el llamador indica tiempo. En la Pico, `EngineTaskV2` usa el tiempo real del scheduler.
- **Reversión, si aplica:** eliminar los archivos creados listados, restaurar `firmware/tests/test_hiles_engine.py` y revertir esta entrada y las casillas de Persona 3 del plan. No hay migraciones persistentes.

### [2026-10-19 12:38] — Responsable: Juan David Romero (Persona 4)

- **Estado:** [x] Implementación funcional terminada y validada en escritorio con pruebas automáticas, lint y build. [!] Queda pendiente la inspección visual manual en todas las resoluciones exactas que se usarán durante la demo.
- **Actividad del plan:** Persona 4 — Topbar y aprovechamiento del canvas (9 de las 10 casillas de «Control de avance nuevo» y los 3 criterios del entregable completados).
- **Revisión previa:**
  - Se revisaron el shell anterior de `Editor`, la paleta, propiedades, simulación y MQTT, preservando las APIs y stores existentes.
  - Se consumieron la identidad de proyecto y `asegurarProjectIdEnUrl` entregados por Persona 2, además de los estados locales/remotos expuestos por Personas 2 y 3.
  - Se evitó modificar `App.tsx`, propiedad de Persona 5, mediante un punto de montaje estable para el panel MQTT y otro contenedor reservado para colaboración.
- **Qué se implementó:**
  1. **Topbar compacta (`TopBar.tsx`):** agrupación de proyecto, archivo, nuevo, importar, exportar, undo/redo, apertura de paneles y acciones de ejecución. Muestra permanentemente modo Local/Pico, estado de ejecución y conexión MQTT, con `title`, etiquetas accesibles, foco visible y estados `disabled`.
  2. **Identidad y archivo del proyecto (`Editor.tsx`):** lectura y normalización de `?project=<id>`, edición del identificador desde la barra, nombre del JSON importado y exportación con el identificador actual, sin retirar autosave ni atajos de undo/redo.
  3. **Dock de paneles (`PanelDock.tsx`, `panelState.ts`):** Propiedades, Simulación y MQTT comparten un único panel flotante con tabs, cierre y conmutación exclusiva. Al cerrarlo no se reserva un rail lateral y el canvas recupera el área disponible.
  4. **Paleta flotante (`Palette.tsx`):** se retiró el botón duplicado y se integró la apertura en la topbar; la paleta puede cerrarse desde su propia cabecera y se superpone al canvas sin reducirlo permanentemente.
  5. **Simulación integrada (`SimulationPanel.tsx`):** modo `embedded` para conservar selección Local/Pico, sesión remota, inyección de entradas y eventos, mientras las acciones Paso/Ejecutar/Detener/Reiniciar quedan centralizadas en la topbar sin duplicarse.
  6. **MQTT integrado sin segunda instancia (`MqttPanel.tsx`, `panelPortal.ts`):** el panel existente se monta en el dock mediante portal y un store externo pequeño; así se conservan la única conexión, las suscripciones y la integración previa sin tocar `App.tsx`.
  7. **Shell adaptable (`editor.css`, `simulation.css`, `mqtt.css`):** topbar, chips de estado, paneles flotantes, foco, estados activos/deshabilitados y breakpoints para escritorio y anchos reducidos.
  8. **Punto de integración de Persona 5:** `#hiles-collaboration-slot` con `data-collaboration-slot` queda estable en la topbar para montar participantes sin editar los archivos de Persona 4.
  9. **Pruebas (`PanelDock.test.tsx`, `panelState.ts`, `vitest.config.ts`):** apertura, cambio y cierre del dock, exclusividad del panel activo y disponibilidad de controles de ejecución Local/Pico.
- **Archivos creados:**
  - `frontend/src/features/editor/TopBar.tsx`
  - `frontend/src/features/editor/PanelDock.tsx`
  - `frontend/src/features/editor/PanelDock.test.tsx`
  - `frontend/src/features/editor/panelState.ts`
  - `frontend/src/features/editor/panelPortal.ts`
- **Archivos modificados:**
  - `frontend/src/features/editor/Editor.tsx`
  - `frontend/src/features/editor/Palette.tsx`
  - `frontend/src/features/editor/editor.css`
  - `frontend/src/features/simulation/SimulationPanel.tsx`
  - `frontend/src/features/simulation/simulation.css`
  - `frontend/src/features/mqtt/MqttPanel.tsx`
  - `frontend/src/features/mqtt/mqtt.css`
  - `frontend/vitest.config.ts`
  - `entregas/entrega-6-20-octubre/PLAN_IMPLEMENTACION_ENTREGA_20.md`
  - `entregas/entrega-6-20-octubre/REGISTRO_CAMBIOS.md`
- **Archivos de otros integrantes tocados:** ninguno. En particular, `frontend/src/App.tsx` no se modificó; el panel MQTT existente se reubica mediante portal.
- **Commit o rama:** rama `mqtt-pico`; cambios locales todavía sin commit ni push.
- **Cómo se probó:**
  - Pruebas frontend, desde `frontend/`: `npm run test:run` → **16 archivos y 99 pruebas aprobadas**.
  - Linter: `npm run lint` → **aprobado sin errores**.
  - TypeScript y build de producción: `npm run build` → **exit code 0**. Vite solo informó las advertencias preexistentes de Pyodide externalizado y tamaño del bundle.
  - Pruebas focales nuevas: apertura/cambio/cierre de paneles, un único panel activo y habilitación/deshabilitación de Paso, Ejecutar, Reiniciar y Detener según motor Local o sesión Pico.
- **Resultado obtenido:**
  - Con paleta y dock cerrados, el canvas ocupa toda el área de trabajo bajo la topbar.
  - Importación, exportación, autosave, undo/redo, edición de propiedades/código, simulación local/remota y MQTT conservan sus rutas existentes.
  - Los controles dispersos quedan centralizados sin crear un segundo cliente MQTT ni una segunda suscripción.
  - Persona 5 dispone de un contenedor estable para participantes y puede conservar la instancia MQTT montada desde `App.tsx`.
- **Evidencia:** suite completa de 99 pruebas, lint y build aprobados en la consola de trabajo; pruebas focales en `frontend/src/features/editor/PanelDock.test.tsx`.
- **Impacto sobre otros integrantes:**
  - **Persona 5:** puede montar la lista de participantes en `#hiles-collaboration-slot` o `[data-collaboration-slot]`; el panel MQTT se inserta en `#hiles-mqtt-panel-slot` sin cambios en `App.tsx`.
  - **Integración:** `Editor` conserva los stores, importación/exportación y contratos de ejecución existentes; no cambia el formato JSON ni la IR v2.
- **Riesgos o pendientes:**
  - Falta inspeccionar manualmente la interfaz en cada resolución exacta de escritorio usada en la demo. La automatización del navegador se detuvo porque no pudo verificar con seguridad la URL de Brave; por eso esa casilla permanece abierta en el plan.
  - Los breakpoints responsivos están implementados, pero no sustituyen la evidencia visual pendiente.
- **Reversión, si aplica:** eliminar los cinco archivos creados, restaurar los ocho archivos funcionales modificados y revertir esta entrada y las casillas de Persona 4 en el plan. No hay migraciones persistentes ni cambios de formato JSON.

### [2026-10-19 18:52] — Responsable: revisión de integración Personas 3, 4 y 5

- **Estado:** [x] Correcciones de código y regresión de escritorio/broker terminadas. [!] La prueba con Raspberry Pi Pico W y GPIO reales continúa pendiente porque Windows no detectó placa, volumen RP2/PICO ni puerto serial.
- **Actividad del plan:** auditoría cruzada de motor MicroPython v2, semáforos, composición del firmware, topbar/paneles, sincronización de proyecto, presencia, cursores y paquete final.
- **Correcciones de Persona 3:**
  1. `firmware/pico/hiles/model_v2.py` valida antes de activar un modelo los límites de entradas/salidas, tipos, identificadores, duplicados y parámetros de `calcular(...)`. Un bloque con una firma que no corresponde a sus entradas ya no llega a reemplazar el motor activo.
  2. `firmware/tests/test_hiles_model_v2.py` y `firmware/tests/test_hiles_engine_v2.py` cubren firma incorrecta, tipo inválido, puerto repetido, exceso de entradas y conservación transaccional del modelo anterior.
  3. Se confirmó que `TrafficControllerTask`, sensores y GPIO continúan aislados en `devices/` y `platform/`: el motor HiLeS general no contiene una dependencia obligatoria del ejemplo vial.
- **Correcciones de Persona 4:**
  1. `frontend/src/App.tsx` dejó de envolver `MqttPanel` en el contenedor flotante legado. El portal del dock ya no deja una tarjeta blanca vacía encima del canvas.
  2. Se verificaron visualmente topbar, canvas y dock a 1366×768 y 1920×1080, incluyendo Simulación y MQTT, sin superposición crítica.
  3. La revisión visual descubrió el fallo de arranque `Maximum update depth exceeded`; se corrigió en `Participants.tsx` seleccionando la referencia estable del store y filtrando participantes con `useMemo`.
- **Correcciones de Persona 5:**
  1. `main.py` compone `EngineTaskV2` con `ENGINE_QUEUE_SIZE=32`, Watchdog y semáforos únicamente cuando existen los cuatro sensores requeridos. Esto evita desbordar la cola inicial y evita `KeyError` por configuraciones parciales o con claves incorrectas.
  2. `config_local.example.py` documenta cola, Watchdog, periodos y mapas GPIO opcionales sin convertir el demo de semáforos en requisito del motor general.
  3. El modo remoto usa `?project=<id>` como `modelo_id` predeterminado; el panel de simulación conserva la edición manual sin un efecto React que produzca renders encadenados.
  4. `useProjectStore.ts` valida la identidad recuperada de `sessionStorage` y evita programar varios temporizadores de preparación ante eventos `CONNECTED` repetidos.
  5. `projectMessages.ts` dejó de publicar una operación cuando lo único que cambió fue `metadata.savedAt`; seleccionar o renderizar un nodo ya no se presenta como edición colaborativa.
  6. Se agregó `useProjectStore.test.ts` para comprobar snapshot retenido antes de editar, supresión de eco, publicación posterior de cambios locales y reconexiones repetidas.
  7. Se creó `scripts/test-project-collaboration.mjs`: conecta cuatro clientes al proyecto A y uno al B, comprueba operación única, aislamiento, snapshot retenido para un cliente tardío, presencia y cursor, y limpia sus tópicos de prueba.
  8. Se regeneró `output/hiles-pico-w-deploy.zip` con 34 archivos. Después de actualizar la guía de replicación y el `LEEME_PRIMERO.md` incluido, el paquete vigente tiene SHA-256 `1813BF4584FC33F1198D57CE169DA13D696240DDC07A98450A16FA6D86B04C60`.
- **Pruebas ejecutadas y resultado:**
  - Firmware: `python -m unittest discover -s firmware/tests -p 'test_*.py'` → **174 pruebas aprobadas**.
  - Frontend: `vitest run` → **17 archivos y 103 pruebas aprobadas**.
  - ESLint → **aprobado sin errores**.
  - TypeScript + Vite → **build aprobado**; permanecen únicamente las advertencias conocidas de Pyodide externalizado y chunk principal mayor de 500 kB.
  - `scripts/test-project-collaboration.mjs` → `PROJECT_COLLABORATION_OK`: cuatro clientes, snapshot retenido, presencia, cursor y aislamiento A/B aprobados sobre el broker configurado.
  - `scripts/test-mqtt-four-clients.mjs` → `MQTT_CUATRO_CLIENTES_OK: 4 de 4`.
  - Navegadores reales: cuatro identidades visibles; el cambio temporal `Sensor E2E sincronizado` apareció en el cuarto navegador, se restauró a `Sensor de vehículos`, y la presencia pasó de 4 a 1 al cerrar tres clientes.
  - Generador del demo distribuido → 18 elementos y 12 conexiones, sin diferencias contra los JSON versionados.
- **Archivos creados:**
  - `frontend/src/stores/useProjectStore.test.ts`
  - `scripts/test-project-collaboration.mjs`
- **Archivos corregidos:**
  - `firmware/pico/hiles/model_v2.py`
  - `firmware/pico/main.py`
  - `firmware/pico/config_local.example.py`
  - `firmware/tests/test_hiles_model_v2.py`
  - `firmware/tests/test_hiles_engine_v2.py`
  - `firmware/tests/test_mqtt_transport.py`
  - `frontend/src/App.tsx`
  - `frontend/src/features/collaboration/Participants.tsx`
  - `frontend/src/features/simulation/SimulationPanel.tsx`
  - `frontend/src/services/projects/projectMessages.ts`
  - `frontend/src/services/projects/projectSync.test.ts`
  - `frontend/src/stores/useProjectStore.ts`
  - `frontend/src/stores/useRemoteExecutionStore.ts`
  - plan, guía, ZIP y checksum de esta entrega.
- **Riesgos o pendientes reales:**
  - Falta copiar el ZIP a una Pico W, crear `config_local.py` en la placa y ejecutar navegador → broker → Pico → snapshot.
  - Falta medir memoria libre, duración de los bloques y Watchdog sobre MicroPython real.
  - Falta repetir Sample/Hold, DCH, retardos y las cuatro FSM con GPIO/sensores reales. Las pruebas actuales de esas piezas son de escritorio con reloj, transporte y `machine` simulados.
- **Reversión, si aplica:** revertir únicamente esta entrada y los archivos enumerados. El script colaborativo usa identificadores de proyecto únicos y limpia de forma best-effort los snapshots/presencias retenidos que crea.

### [2026-10-20 09:15] — Responsable: corrección del demo de vehículos y semáforos

- **Estado:** [x] Corrección implementada y validada en escritorio. [!] Falta repetir el flujo navegador → broker → Pico con la placa física actualizada.
- **Error encontrado:** el demo distribuido declaraba cada sensor como `boolean` (`presencia`), por lo que una cantidad como `8` no cumplía el contrato. Además, la guía proponía `def calcular(carros): return carros >= 6`; ese ejemplo falla si el puerto no se llama exactamente `carros` o si todavía no recibió un valor. La guía física también conservaba el Service legado `Habilitar ciclo`, que no existe en el modelo distribuido.
- **Correcciones realizadas:**
  1. El contrato vial usa ahora `vehiculos_esperando` de tipo `integer` en los cuatro Services, conexiones, Functional Blocks, IR v2 y entradas locales de la Pico. Cero significa sin cola y un entero positivo representa la cantidad detenida esperando verde.
  2. `VehicleSensorTask` acepta enteros no negativos, conserva antirrebote y detección de falla, y mantiene compatibilidad con sensores GPIO booleanos convirtiéndolos a `0`/`1`.
  3. Cada FSM publica `vehiculos_esperando` además del campo derivado `presencia`; crea solicitud con cantidad mayor que cero. El árbitro conserva la antigüedad como criterio principal y usa la cola mayor para desempatar solicitudes simultáneas.
  4. `SimulatedVehicleSource` modela una cola: acumula llegadas en rojo y permite salidas únicamente en verde. `main.py` puede crear las cuatro fuentes simuladas solo con `TRAFFIC_SIMULATION = True`; el valor predeterminado `False` mantiene desacoplado el motor HiLeS general.
  5. El ejemplo Python quedó protegido ante la entrada inicial ausente mediante `**inputs`, puerto `carros` (`integer`) y salida nombrada `hay_fila` (`boolean`). Se verificaron `{}` → `False`, `3` → `False` y `8` → `True`.
  6. Se corrigieron la guía de demo, la guía de prueba en Pico, la guía de replicación y el protocolo vial. Ya no se indica usar `Habilitar ciclo`; la prueba explica cómo observar las cuatro colas numéricas.
  7. Se regeneraron `output/demo-4-semaforos-distribuidos.json`, la fixture `docs/traffic/ir_demo_semaforos_distribuidos.json` mediante el compilador oficial y el ZIP de despliegue.
- **Pruebas ejecutadas:**
  - Firmware: `python -m unittest discover -s firmware/tests -p 'test_*.py'` → **177 aprobadas**.
  - Frontend: `vitest run --no-isolate` con `TEMP` dentro del workspace → **17 archivos y 104 pruebas aprobadas**. La primera corrida paralela falló por archivos temporales eliminados por el sandbox (`ENOENT`), no por aserciones; al usar una ruta temporal persistente quedó aprobada.
  - ESLint → **aprobado**.
  - TypeScript + Vite → **build aprobado**; solo permanecen las advertencias conocidas de Pyodide externalizado y tamaño del chunk.
  - `git diff --check` → sin errores de espacios; únicamente avisos de normalización LF/CRLF de Git.
- **Paquete vigente:** `output/hiles-pico-w-deploy.zip`, 34 archivos, SHA-256 `9FA30B970D05E02A6A34070A432D495A3F16F533F81793B9E1CE40813182CAB2`. Este hash reemplaza el registrado el 19 de octubre.
- **Pendiente físico:** actualizar los archivos de la Pico con el ZIP nuevo, activar `TRAFFIC_SIMULATION = True` en `config_local.py` si no se usarán cuatro sensores GPIO, cargar el demo y verificar las colas y transiciones reales por MQTT.

### [2026-10-20 09:30] — Responsable: desacoplamiento total del ejemplo vial

- **Estado:** [x] Runtime general restaurado y validado. [!] Falta copiar este paquete a la Pico y ejecutar el flujo físico.
- **Motivo:** se determinó que `TrafficControllerTask`, `VehicleSensorTask`, `traffic_io` y las variables `TRAFFIC_*` colocaban lógica de un ejemplo particular dentro de la composición general. Aunque eran opcionales, el demo dependía de código que no había sido construido en el canvas.
- **Corrección aplicada:**
  1. `main.py` ahora compone únicamente scheduler, LED, `EngineTaskV2`, Watchdog, Wi-Fi, MQTT y bus interno. No importa, crea ni registra componentes viales.
  2. `config_local.example.py` contiene solo conectividad y parámetros generales del motor; se eliminaron todas las variables `TRAFFIC_*`.
  3. Se retiraron del firmware `devices/traffic_controller.py`, `devices/vehicle_sensor_task.py` y `platform/traffic_io.py`, junto con la prueba específica `test_traffic_controller.py`.
  4. El demo conserva únicamente Services y Functional Blocks generales. El usuario introduce manualmente `vehiculos_esperando` (`integer`) y `luz` (`string`) desde el panel; la Pico ejecuta el Python declarado en el modelo.
  5. El bloque `Seguridad del cruce` es demostrativo: detecta combinaciones manuales incompatibles, pero no existe una FSM ni un controlador oculto.
  6. Se agregó una prueba de arquitectura que falla si `main.py`, la configuración o el árbol del firmware vuelven a incorporar código específico de tráfico.
  7. Se actualizaron plan, guía demo, guía de replicación, guía de prueba en Pico, protocolo y generador del JSON para declarar el alcance manual real.
  8. Los Services numéricos del demo comienzan en `0` y los Services de luz en `rojo`; la prueba básica requiere introducir únicamente cantidades y ejecutar un paso. Los colores manuales quedan como comprobación opcional.
- **Pruebas ejecutadas:**
  - Firmware general: **153 pruebas aprobadas**.
  - Frontend: **17 archivos y 104 pruebas aprobadas**.
  - ESLint: aprobado.
  - TypeScript + Vite: build aprobado; solo advertencias conocidas de Pyodide y tamaño de chunk.
  - El demo manual compila a IR v2 y la prueba de motor inyecta enteros y colores por Services sin componentes de dominio.
- **Paquete vigente:** `output/hiles-pico-w-deploy.zip`, **31 archivos**, SHA-256 `209AEF16AB85DCAA7D0966D7F2DE00EC748BBC952A2DAA1CD38ABA3AFB82A57D`. Se verificó el listado del ZIP y no contiene `traffic_controller.py`, `vehicle_sensor_task.py` ni `traffic_io.py`. La guía incluida indica cómo retirar esos tres archivos obsoletos de una Pico que conserve la versión anterior.
- **Alcance posterior:** cuando se conecte un sensor real, deberá alimentar un Service mediante un adaptador genérico. No se modificará `main.py`, el scheduler ni el motor para agregar lógica de semáforos.

## Confirmación de responsables

- [x] Persona 1 — Nombre: Kevin Rincón
- [x] Persona 2 — Nombre: Ivan Felipe Prado Blanco
- [x] Persona 3 — Nombre: Juan Ramos
- [x] Persona 4 — Nombre: Juan David Romero
- [x] Persona 5 — Nombre: Julián Romero

## Control de integración

- [x] Persona 1 registra contrato y runtime autónomo; integración IR v2 y prueba física continúan pendientes.
- [x] Persona 2 registra protocolo web y URL.
- [x] Persona 3 registra motor v2 y demo manual; el runtime general no contiene sensores ni lógica vial.
- [x] Persona 4 registra UI/UX y la comprobación visual a 1366×768 y 1920×1080.
- [x] Persona 5 registra colaboración e integración.
- [x] Todos los integrantes registraron sus cambios y pruebas de escritorio disponibles.
- [x] La entrada de cierre coincide con los resultados reales y declara la Pico física como pendiente.
- [x] No hay casillas cerradas sin prueba o evidencia; las casillas dependientes de hardware permanecen abiertas.

