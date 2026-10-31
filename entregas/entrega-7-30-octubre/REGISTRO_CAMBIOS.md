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

### [2026-10-28 09:25] — Persona 1 — Protocolo y particionador de ejecución distribuida v3

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

### [2026-10-28 13:32] — Persona 2 — Worker MicroPython multi-Pico y ejecución distribuida v3

- **Objetivo:** convertir cada Raspberry Pi Pico W en un ejecutor direccionable y general (`pico:<deviceId>`) capaz de descubrirse por MQTT v3, validar y cargar/liberar atómicamente únicamente su fragmento IR v2 asignado, intercambiar canales remotos (`cch`, `dch`, `lch`) con otros ejecutores sin duplicación lógica y recuperarse ante caídas del broker o reinicios manteniendo el scheduler cooperativo no bloqueante.
- **Estado:** [x] Hecho (implementación completa y verificada en PC; validación en placas físicas sujeta a disponibilidad de las Pico W).
- **Commit o rama:** `mqtt-pico`, trabajo preparado sobre `d2b8e81`; pendiente de commit al momento de este registro.
- **Archivos modificados:**
  - **Archivos propios de Persona 2:** `firmware/pico/config_local.example.py`; `firmware/pico/main.py`; `firmware/pico/pubsub/topics.py`; `firmware/pico/pubsub/__init__.py`; `firmware/pico/pubsub/mqtt_transport.py`; `firmware/pico/hiles/distributed_worker.py` (creado); `firmware/tests/test_distributed_worker.py` (creado); `firmware/tests/test_mqtt_transport.py`.
  - **Archivos externos a Persona 2 editados o creados (de otras personas/capas compartidas):**
    - *De Persona 1 (contrato y particionador v3):* `docs/mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md` (editado); `frontend/src/services/ir/tiposIrDistribuida.ts` (editado); `frontend/src/services/ir/particionarIr.ts` (editado); `frontend/src/services/ir/particionarIr.test.ts` (editado); `frontend/src/services/distributed/topics.ts` (editado); `frontend/src/services/distributed/messages.ts` (editado); `docs/mqtt/vectores_v3/01_fixtures_distribucion_v3.json` (creado como vector compartido TS↔MicroPython).
    - *Del núcleo compartido de firmware / entregas previas:* `firmware/pico/platform/hardware.py` (editado: `resolve_device_id`); `firmware/pico/platform/mqtt_client.py` (editado: soporte `last_will`); `firmware/pico/hiles/channels.py` (editado: rutas remotas de entrada/salida); `firmware/pico/hiles/engine_v2.py` (editado: inyección y emisión de canales remotos); `firmware/pico/hiles/engine_task_v2.py` (editado: `install_compiled_engine` y `clear_active_engine`); `firmware/pico/hiles/__init__.py` (editado: exportación de `DistributedWorker`); `firmware/tests/test_hiles_channels.py` (editado); además de `entregas/entrega-7-30-octubre/PLAN_IMPLEMENTACION_ENTREGA_30.md` y este registro.
- **Decisiones tomadas y motivo:**
  - **Identidad dinámica sin constantes fijas:** `resolve_device_id` obtiene el identificador desde `DEVICE_ID`, o el `machine.unique_id()` en hexadecimal (`pico-<hex>`), o `MQTT_CLIENT_ID`, derivando automáticamente el prefijo v1 (`udfjc/hiles/v1/<teamId>/<deviceId>/`) y el `executorId` v3 (`pico:<deviceId>`).
  - **Coexistencia v1 + v3 y optimización de RAM en `MqttTransport`:** se añadieron suscripciones/publicaciones absolutas (`subscribe_absolute` con `raw=True/False`, `publish_absolute`), configuración de Last Will retenido (`offline`), manejo de payloads retenidos vacíos (`b""` → `None`) y reconexión limpia inmediata (`request_clean_reconnect`) al cambiar de `deployment_id` para liberar suscripciones antiguas en el broker (`umqtt.simple` no implementa `UNSUBSCRIBE`). Con `raw=True`, el worker calcula `SHA-256` directamente sobre los `bytes` recibidos del socket sin re-serializar el JSON en RAM.
  - **Paridad criptográfica y preservación semántica en canales remotos:** se extendió `RutaRemotaV3` y `particionarIrV2Distribuida` para conservar `retardo_ms` y `capacidad_cola`, exportando `serializarCanonico` y `sha256` junto con el vector `01_fixtures_distribucion_v3.json`; en MicroPython, `ChannelBus` y `HilesEngineV2` conectan `inbound_routes` y `outbound_routes` preservando idéntica semántica local (`CCH` solo en cambio o muestra de `Service`, `DCH` con cola FIFO acotada y 1 evento por paso, `LCH` para disparo de `Transition`, y retardos lógicos sin `sleep`), manteniendo `hiles/` libre de dependencias MQTT.
  - **Carga/liberación atómica y tolerancia a fallos en `DistributedWorker`:** el worker valida `protocol_version`, `project_id`, `deployment_id`, `epoch`, propiedad única (`executor_id == owner_executor_id` y `manifest.owners`), capacidades (`max_fragment_bytes`, `max_elementos`, `lenguajes`, `ir_versions`), hash `SHA-256` y compilación de bloques Python en una instancia temporal antes de sustituir el motor activo; cualquier fallo emite ACK negativo y error estructurado conservando el modelo anterior. En canales aplica los 7 pasos de validación, ventana de deduplicación acotada (64 IDs), secuencia estrictamente creciente por `connection_id`, outbox acotado (32 mensajes) que se vacía al reconectar y modo de resincronización (`degraded` → `deploying` → `ready`/`running`) al recuperar el broker.
- **Pruebas ejecutadas y resultado exacto:**
  - Suite de firmware en Python (`python -m unittest discover -s firmware/tests -p "test_*.py" -v`): **165 pruebas ejecutadas y 165 aprobadas en 0.620 s** (incluye `test_architecture.py`, `test_mqtt_transport.py`, `test_hiles_channels.py` y las 8 pruebas integrales multi-worker en `test_distributed_worker.py` con pipeline de 3 Pico W).
  - Suite de particionador frontend (`npm.cmd --prefix frontend run test:run -- src/services/ir/particionarIr.test.ts`): **1 archivo y 10 pruebas aprobadas**; `npm.cmd --prefix frontend run lint`: **aprobado**; `npm.cmd --prefix frontend run build`: **aprobado (259 módulos transformados)**.
- **Evidencia física o visual:** vector inter-lenguaje `docs/mqtt/vectores_v3/01_fixtures_distribucion_v3.json` (50 335 bytes) verificado bit a bit entre TypeScript y Python, y simulación determinista multi-Pico sobre `FakeBroker`. No se ejecutó prueba en placas físicas por no contar con las Pico W conectadas en este momento.
- **Errores encontrados y corrección:**
  1. En CPython `json.dumps` escapaba por defecto caracteres no-ASCII (`\u00f3`, `\u2014`), difiriendo de `JSON.stringify` en TypeScript; se resolvió en `_json_quote_str` con `ensure_ascii=False` y fallback compatible con `ujson` de MicroPython.
  2. En `ChannelBus`, inyectar múltiples eventos `DCH` remotos antes de un paso consumía prematuramente el primero si pasaba por `_deliver`; se separó `_deliver_inbound` para encolar en `DchQueue` y delegar el consumo único al barrido estándar de `begin_step`.
  3. Al cambiar de `deployment_id`, `request_clean_reconnect()` dejaba la sesión desconectada hasta el siguiente tick e impedía publicar el primer ACK del nuevo despliegue; se ajustó para reconectar inmediatamente cuando el Wi-Fi está activo.
- **Riesgos o limitaciones:** queda pendiente únicamente ejecutar la prueba en hardware real con las placas Raspberry Pi Pico W cuando estén disponibles (junto con Persona 5).
- **Entrada que recibe:** contrato y particionador de ejecución distribuida v3 de Persona 1 (`d2b8e81`).
- **Handoff entregado a:** Persona 3 (worker de navegador, panel de ejecutores e inyección distribuida en `deployments/<deploymentId>/input` y `command`) y Persona 5 (automatización física multi-Pico y pruebas integradas).
- **Cómo revertir o recuperar:** eliminar `firmware/pico/hiles/distributed_worker.py`, `firmware/tests/test_distributed_worker.py` y `docs/mqtt/vectores_v3/01_fixtures_distribucion_v3.json`, y restaurar con `git checkout` los archivos listados en esta entrada.

### [2026-10-28 15:13] — Persona 3 — Worker de navegador, colaboración y experiencia de usuario

- **Objetivo:** permitir que un navegador sea ejecutor con el mismo contrato v3 que una Pico W y hacer comprensible la distribución: asignar bloques, desplegar, observar el estado agregado, colaborar y aprender a usar HiLeS sin conocimiento previo.
- **Estado:** [x] Hecho en software y probado en escritorio. [!] Pendientes: ensayo con Mosquitto real y dos o más navegadores o Pico W, verificación visual en el navegador y prueba del tutorial con un usuario nuevo.
- **Commit o rama:** `mqtt-pico`, commit `9135cf0` (preparado sobre `f0ccc39`).
- **Archivos modificados:**
  - **Creados, propios de Persona 3:**
    - `frontend/src/services/distributed/BrowserWorker.ts` y `BrowserWorker.test.ts`
    - `frontend/src/stores/useDistributedExecutionStore.ts`
    - `frontend/src/features/distributed/`: `assignments.ts`, `assignments.test.ts`, `assignmentSync.test.ts`, `AssignmentSelector.tsx`, `DistributedPanel.tsx`, `distributedTransport.ts`, `useFaseDistribuida.ts`, `distributed.css`
    - `frontend/src/features/collaboration/`: `ShareDialog.tsx`, `clipboard.ts`, `focus.ts`, `presence.ts`, `presence.test.ts`, `useFollowStore.ts`, `collaboration.css`
    - `frontend/src/features/onboarding/`: `Tutorial.tsx`, `tutorialSteps.ts`, `tutorialState.ts`, `ejemploMinimo.ts`, `ejemploMinimo.test.ts`, `EmptyCanvas.tsx`, `HelpHint.tsx`, `onboarding.css`
    - `frontend/src/assets/brand/`: `hiles-mark.svg`, `brand.ts`
  - **Modificados, propios de Persona 3 en esta entrega:**
    - `frontend/src/features/editor/TopBar.tsx`: textos en español, botones Ejecutores, Compartir y Ayuda, etiqueta de fase distribuida y logo; conserva las mismas props.
    - `frontend/src/features/editor/editor.css`: variables de marca, tamaños mínimos legibles, foco visible, `prefers-reduced-motion` y estilos compartidos; se retiraron las reglas antiguas de avatares.
    - `frontend/src/features/collaboration/Participants.tsx`: venía de Persona 5 (entrega 6) y ahora pertenece a Persona 3 según el plan.
  - **Creados fuera de la lista prevista:**
    - `docs/mqtt/vectores_v3/02_paridad_worker_navegador.json`: vector compartido TS ↔ MicroPython en la carpeta de vectores de Personas 1 y 2; no se modificó el vector 01.
    - `firmware/tests/test_paridad_worker_navegador.py`: verifica el vector 02 con el motor de la Pico.
    - `docs/ux/REVISION_VISUAL_Y_ACCESIBILIDAD.md`.
  - **Archivos de otras personas modificados (detalle en «Cambios en trabajo de otras personas»):**
    - `frontend/src/features/editor/Canvas.tsx`
    - `frontend/src/services/projects/ProjectSyncClient.ts`
    - `frontend/vitest.config.ts`
    - este registro y el plan
- **Decisiones tomadas y motivo:**
  1. **Motor sin modificaciones.** `BrowserWorker` ejecuta el fragmento con `MotorSimulacion` sin modificarlo.
     - Cada ruta remota de entrada se conecta a un Service proxy (`__remoto__<conexión>`). Las rutas CCH y DCH llegan por DCH, de modo que cada mensaje se entrega una sola vez, como `inject_remote_channel` en la Pico; LCH se conserva para que el pulso se limpie en Transitions.
     - Las rutas de salida se capturan en `bus.notificar` con la semántica remota de la Pico: CCH solo al cambiar, DCH por evento, LCH solo en pulsos verdaderos y `retardo_ms` como fecha límite.
     - Al generar el vector se comprobó que un proxy CCH reenviaría el valor en cada paso y marcaría un evento en cada paso en los Hold. Por eso se eligió DCH para los proxies.
  2. **Conexiones MQTT propias del plano v3.** El worker usa una conexión con Last Will retenido `offline` y el control usa otra. No se reutiliza el cliente de colaboración por dos motivos: su validador marca como error cualquier topic v3, y un Last Will compartido no describiría al ejecutor.
  3. **Identidades separadas.** La identidad del ejecutor es `browser:<sessionId>` (sesión de la pestaña), distinta del `clientId` del colaborador. Editar no obliga a ejecutar.
  4. **Asignación en el documento compartido.** La asignación se guarda en `properties.deploymentTarget` de Structural Blocks, Functional Blocks y ejecutables de raíz, y viaja como una sola operación `node.update` del protocolo de proyecto v2. El plan v3 se construye desde esas propiedades.
  5. **Despliegue con limpieza de retenidos.** Al desplegar se compila, se resuelven asignaciones, se particiona con el código de Persona 1, se limpian los retenidos de la época anterior y se publican los fragmentos canónicos y el manifiesto. «Iniciar» solo se habilita cuando todos los ACK de la época están aceptados.
  6. **Estado agregado.** Se compone por propietario y época del manifiesto y se pinta en `node.data.runtime`, que no se serializa ni se sincroniza. Los elementos de un ejecutor `offline` se marcan obsoletos.
  7. **Selección remota.** Se anuncia en el campo existente `vista_activa` de la presencia (`canvas#<nodeId>`), sin crear un topic nuevo. «Seguir» es un estado local que centra la vista.
  8. **Idioma.** La interfaz propia queda en español; los textos en inglés de archivos ajenos se listan en `docs/ux/REVISION_VISUAL_Y_ACCESIBILIDAD.md` en lugar de editarse.
- **Pruebas ejecutadas y resultado exacto:**
  - `npx vitest run` en `frontend/`: **23 archivos y 144 pruebas aprobadas** (línea base: 18 archivos y 114 pruebas; 30 pruebas nuevas). Se reparten así:
    - `BrowserWorker.test.ts`: 14 (paridad con la Pico, hash del manifiesto, estado retenido y Last Will, ACK, rechazo por hash y por destino, siete validaciones de canal, salidas sin eco, start/stop/reset, liberación por manifiesto vacío o nueva época, resincronización tras perder el broker, entradas propias y `offline` al detener).
    - `assignments.test.ts`: 7.
    - `assignmentSync.test.ts`: 3 (una sola operación por asignación; reaplicarla es idempotente).
    - `presence.test.ts`: 3.
    - `ejemploMinimo.test.ts`: 3 (el ejemplo compila a IR v2 y se particiona entre Pico y navegador con una ruta remota; el tutorial cubre los seis temas pedidos).
  - `npm.cmd run lint`: **0 errores**. `npx tsc -p tsconfig.app.json --noEmit`: **sin errores**. `npm.cmd run build`: **aprobado (282 módulos)**, con el aviso conocido de tamaño de chunk.
  - `python -m unittest discover -s firmware/tests -t .`: **166 pruebas aprobadas** (165 de línea base + `test_paridad_worker_navegador.py`).
- **Evidencia física o visual:** el vector `docs/mqtt/vectores_v3/02_paridad_worker_navegador.json` tiene 2 casos y 11 pasos, con snapshots y salidas remotas generados con `firmware/pico/hiles/engine_v2.py`, y lo reproducen ambos lenguajes. No hay capturas: no se levantó la aplicación ni Mosquitto en esta sesión.
- **Errores encontrados y corrección:**
  1. El proxy CCH inicial reenviaba el valor remoto en cada paso; se cambió a entrega por evento.
  2. TypeScript rechazó parámetros-propiedad por `erasableSyntaxOnly`; se declararon los campos explícitamente.
  3. ESLint (`react-refresh/only-export-components`) pidió separar `copiarTexto` y el estado del tutorial en módulos sin componentes.
  4. Dos expectativas de prueba propias se corrigieron antes de registrar.
- **Cambios en trabajo de otras personas:**
  - `frontend/src/services/projects/ProjectSyncClient.ts` (Persona 2, entrega 6): el latido de presencia republicaba siempre `vista_activa: null` y borraba la selección anunciada. Ahora conserva la última vista publicada (campo `vistaActivaPresencia`, 3 líneas). El formato del mensaje no cambia.
  - `frontend/src/features/editor/Canvas.tsx`: se agregó un `useEffect` que escucha el evento `hiles:enfocar-elemento` y llama `setCenter` (seguir colaborador, «Ir a…», errores). La pista de zoom se tradujo al español. No se cambió ninguna otra lógica del lienzo.
  - `frontend/vitest.config.ts`: se agregó `src/features/**/*.test.ts` al `include` para que corran las pruebas de `features/distributed`, `collaboration` y `onboarding`.
  - `docs/mqtt/vectores_v3/`: se agregó el archivo `02_...` sin tocar el `01_...` de Personas 1 y 2.
  - `PLAN_IMPLEMENTACION_ENTREGA_30.md` (Persona 5): se registró el trabajo de Persona 3 y se marcaron sus casillas, P1/P0 propios y cronograma, junto con la fila de evidencia. Quedan abiertos los criterios del tutorial con un usuario real y la verificación visual de estados.
- **Riesgos o limitaciones:**
  - Sin ensayo con broker real: la conexión mqtt.js del worker, el Last Will y los retenidos solo se probaron con un broker simulado.
  - Los Functional Blocks Python en el navegador usan Pyodide; el fixture de paridad usa Hold, por lo que la paridad de Python navegador ↔ Pico no está cubierta por el vector 02.
  - Si llegan dos mensajes CCH remotos de la misma conexión en un mismo paso, el navegador entrega el segundo en el paso siguiente; la Pico los entrega juntos.
  - El panel no muestra RSSI, porque el estado v3 del ejecutor no lo publica.
  - Quedan textos en inglés en archivos ajenos.
- **Entrada que recibe:** contrato, particionador y fixtures v3 de Persona 1 (`d2b8e81`); worker Pico, rutas remotas y vector 01 de Persona 2 (`f0ccc39`).
- **Handoff entregado a:** Persona 5 (integración y pruebas):
  - Ensayo con Mosquitto y la guía manual de `docs/ux/REVISION_VISUAL_Y_ACCESIBILIDAD.md` §5.
  - Matriz Pico↔browser y browser↔browser.
  - Captura de los estados de la etiqueta de fase.
  - Prueba del tutorial con un usuario nuevo.
- **Cómo revertir o recuperar:**
  1. Eliminar los archivos creados listados.
  2. Restaurar con `git checkout` `TopBar.tsx`, `editor.css`, `Participants.tsx`, `Canvas.tsx`, `ProjectSyncClient.ts` y `vitest.config.ts`.
  3. Revertir esta entrada y las casillas de Persona 3 del plan.
  - La propiedad `deploymentTarget` en documentos ya guardados es inofensiva para versiones anteriores, porque se ignora al compilar.

### [2026-10-29 19:51] — Persona 5 — Integración, automatización segura y cierre sin hardware

- **Objetivo:** integrar y verificar de forma repetible los entregables distribuidos de Personas 1, 2 y 3 sin presentar evidencia física inexistente; dejar listos los runners para repetir la matriz sobre Mosquitto y Pico W cuando el hardware esté disponible.
- **Estado:** [x] Hecho para el alcance de software sin hardware. [!] Pendientes externos: Mosquitto real, Pico W, matriz física Pico↔Pico/Pico↔browser, memoria/RSSI de placa, demo vial física y ensayo visual con varios navegadores.
- **Commit o rama:** rama `mqtt-pico`, cambios locales sobre `6d02a02`; pendiente de commit y push al momento de este registro.
- **Archivos creados:**
  - `scripts/test-distributed-mqtt.mjs`
  - `scripts/test-distributed-physical.ps1`
- **Archivos modificados:**
  - `entregas/entrega-7-30-octubre/PLAN_IMPLEMENTACION_ENTREGA_30.md`
  - `entregas/entrega-7-30-octubre/REGISTRO_CAMBIOS.md`
  - `frontend/src/features/distributed/assignmentSync.test.ts` (corrección mínima de tipos en prueba de Persona 3; no cambia producción).
- **Qué se implementó:**
  1. **Runner de integración distribuida (`test-distributed-mqtt.mjs`):** modo `memory` autónomo y modo `mqtt` para el listener WebSocket configurado en `frontend/.env.local`. Usa el fixture v3 de cuatro ejecutores, recalcula SHA-256 después de aislar el `projectId`, registra workers, publica manifiesto/fragmentos, exige cuatro ACK, inyecta entrada, ejecuta pasos, recoge snapshots, verifica tres canales remotos, época/deduplicación, desconexión/recuperación y liberación. Puede guardar un informe JSON mediante `--report` y nunca imprime usuario o contraseña.
  2. **Métricas y errores trazables:** el informe registra heap antes/después, duración total y por etapa, snapshots, mensajes aceptados/descartados y reconexiones. Un fallo incluye etapa, dispositivo lógico, fragmento y conexiones involucradas.
  3. **Runner físico seguro (`test-distributed-physical.ps1`):** modos `DryRun`, `Inventory`, `Backup` y `Deploy`; inventario tolerante a permisos CIM restringidos; soporte de `-DevicePath` para filesystem montado o doble de prueba; respaldo obligatorio antes de desplegar; manifiesto de tamaños/hashes; hashes de configuración/secretos redactados; copia exclusiva de firmware `.py`; exclusión y verificación de integridad de `config_local.py`; salida JSON y reporte opcional.
  4. **Guion sin hardware:** comandos y resultados esperados añadidos al documento maestro, junto con la variante futura sobre Mosquitto y los límites reales.
  5. **Cierre acumulativo:** cronología de Personas 1–5, evidencia actualizada y separación explícita entre pruebas simuladas, de broker y físicas.
- **Decisiones tomadas y motivo:**
  - El modo por defecto es `memory` para que el ensayo no dependa de credenciales, red, broker o placa y pueda ejecutarse desde un checkout normal.
  - El modo MQTT reutiliza `mqtt` desde las dependencias del frontend y carga `.env.local` sin mostrar valores sensibles.
  - El runner físico no escribe en ningún dispositivo con el modo por defecto; `Deploy` debe solicitarse explícitamente y siempre crea primero un respaldo en una ruta única.
  - No se agregó lógica de semáforos ni se modificaron workers de producción. Los cuatro ejecutores del arnés son dobles del contrato; la implementación real continúa cubierta por las suites de `BrowserWorker` y `DistributedWorker`.
- **Pruebas ejecutadas y resultado exacto:**
  - `node --check scripts/test-distributed-mqtt.mjs` → aprobado.
  - `node scripts/test-distributed-mqtt.mjs --mode=memory --timeout=5000` → **6 etapas aprobadas** con 4 ejecutores, 4 ACK, entrada `5`, salida final `6`, 20 snapshots, 2 mensajes antiguos/duplicados descartados, 1 reconexión y 4 fragmentos liberados; duración **161 ms** en la ejecución final registrada.
  - `scripts/test-distributed-physical.ps1 -Mode DryRun -AllowNoDevice` → aprobado en **68 ms**; `hardware_available: false`, sin credenciales ni falso positivo físico.
  - Prueba del runner físico con un filesystem temporal y `-Mode Deploy` → **33 archivos desplegados**, respaldo previo creado y `config_local.py` conservado byte a byte; 1 dispositivo simulado aprobado.
  - Frontend: `npm run test:run -- --maxWorkers=1 --isolate=false` → **23 archivos y 144 pruebas aprobadas**. La ejecución paralela inicial perdió artefactos SSR temporales del sandbox (`ENOENT`); no fue un fallo de aserción y la repetición no aislada aprobó todo.
  - Frontend: `npm run lint` → **0 errores**.
  - Frontend: `npm run build` → **aprobado**, 282 módulos transformados. Se mantienen los avisos conocidos de Pyodide externalizado y chunk principal mayor de 500 kB.
  - Firmware con el Python incluido por Codex: `python -m unittest discover -s firmware/tests -t .` → **166 pruebas aprobadas en 0,453 s**. El alias `WindowsApps/python.exe` local no tenía permisos, por lo que se usó el intérprete real del runtime.
  - Modo MQTT real: el intento autorizado alcanzó `127.0.0.1:9001` y devolvió `ECONNREFUSED`; Mosquitto no está instalado ni escuchando en este equipo. El runner devolvió el fallo estructurado con etapa `conexion-broker`, dispositivo lógico, fragmento y conexiones; la prueba no se marca como aprobada.
- **Error de integración encontrado y corrección:** `npm run build` detectó dos conversiones directas de `HilesNodeProperties` a `Record<string, unknown>` en `assignmentSync.test.ts`. Se aplicó exactamente el cast intermedio `unknown` recomendado por TypeScript 6. No cambió lógica, datos ni archivos de producción; después aprobaron build, lint y las 144 pruebas.
- **Evidencia obtenida:** salida JSON estructurada de ambos runners y resultados completos en consola. No se guardaron credenciales, respaldos ni informes generados dentro del repositorio; el respaldo de la prueba quedó en el directorio temporal del sistema.
- **Impacto sobre otros integrantes:**
  - **Personas 1–3:** sus contratos y workers no se modificaron. El runner consume los fixtures, tópicos, hashes y mensajes ya congelados.
  - **Persona 4:** Three.js continúa aislado y no bloquea el cierre de P0.
  - **Equipo de demo:** puede repetir primero el modo memoria y, al disponer de Mosquitto/Pico, usar los mismos runners cambiando únicamente el modo y las rutas de dispositivo.
- **Riesgos o limitaciones:**
  - Los ejecutores `pico:*` del modo memoria son dobles de protocolo, no MicroPython ejecutándose en una placa.
  - El modo memoria no valida sockets, QoS real, retained del broker, Last Will de red, Wi-Fi, memoria MicroPython ni GPIO.
  - El modo físico sobre filesystem temporal valida seguridad de archivos, no `mpremote`, puerto serial ni reinicio de una Pico real.
  - Falta ejecutar el flujo con Mosquitto y las placas, capturar evidencia visual, probar el tutorial con un usuario nuevo y completar la demo vial segura.
- **Handoff para el ensayo físico:** iniciar Mosquitto con WebSockets, ejecutar primero `--mode=mqtt`, conectar las Pico, correr el runner físico en `Inventory` y `Backup`, revisar el reporte, y solo después usar `Deploy`. Registrar versiones, memoria/RSSI, desconexión, reconexión, checksum y capturas sin modificar este resultado histórico.
- **Cómo revertir o recuperar:** eliminar los dos scripts nuevos, revertir las dos conversiones de tipo en `assignmentSync.test.ts` y restaurar esta entrada y las casillas de Persona 5 del plan. No existen migraciones ni estado persistente en el repositorio.

### [2026-10-29 21:16] — Persona 5 — Responsive móvil, identidad colaborativa y validación LAN

- **Objetivo:** permitir que el editor colaborativo se use de forma práctica desde celular y tablet, identificar a cada participante con un nombre elegido antes de sincronizar y verificar la colaboración navegador↔navegador sobre el broker local real.
- **Estado:** [x] Hecho y validado en software. La ejecución física con Pico W continúa fuera del alcance de esta mejora.
- **Commit o rama:** rama `mqtt-pico`; commit en español y push preparados después de este registro, sin crear otra rama.
- **Archivos creados:**
  - `frontend/src/features/collaboration/DisplayNameDialog.tsx`
- **Archivos modificados:**
  - `frontend/src/stores/useProjectStore.ts`
  - `frontend/src/features/editor/Editor.tsx`
  - `frontend/src/features/editor/Canvas.tsx`
  - `frontend/src/features/editor/Palette.tsx`
  - `frontend/src/features/editor/editor.css`
  - `frontend/src/features/collaboration/Participants.tsx`
  - `frontend/src/features/collaboration/collaboration.css`
  - `frontend/src/features/distributed/distributed.css`
  - `entregas/entrega-7-30-octubre/PLAN_IMPLEMENTACION_ENTREGA_30.md`
  - `entregas/entrega-7-30-octubre/REGISTRO_CAMBIOS.md`
- **Qué se implementó:**
  1. **Nombre antes de sincronizar:** un diálogo obligatorio solicita un nombre de hasta 40 caracteres, normaliza espacios y solo inicia `ProjectSyncClient` después de confirmarlo. El nombre y `clientId` se conservan por sesión de pestaña, sin autenticación ficticia.
  2. **Identidad visible:** el avatar propio usa iniciales y el panel de colaboradores muestra nombre, estado «Tú · conectado», cursores y selección remota. «Ir» mantiene el enfoque puntual y «Seguir» centra la vista cuando la otra persona cambia de selección.
  3. **Topbar responsive:** en celular se distribuye en dos niveles, conserva proyecto y colaboradores, usa botones táctiles de 42 px y permite desplazar horizontalmente las acciones sin una barra visual invasiva. En tablet mantiene acceso al panel de participantes.
  4. **Paneles móviles:** Propiedades, Simulación, MQTT y Ejecutores se presentan como hojas inferiores con altura limitada, scroll interno, controles de cierre grandes y respeto por `safe-area`.
  5. **Paleta táctil:** los componentes se pueden arrastrar en escritorio o tocar para insertarlos al centro del viewport; si hay un Structural Block seleccionado, se agregan como hijos. En móvil la paleta se cierra después de insertar.
  6. **Canvas táctil:** se habilitó paneo con botón principal/un dedo, se ocultó el minimapa en celular, se ampliaron controles y se evitó que la pista de zoom tape los botones.
  7. **Broker y LAN local:** Mosquitto 2.1.2 quedó escuchando WebSockets autenticados en `192.168.1.8:9001`; Vite se expone con `--host 0.0.0.0`. `frontend/.env.local` contiene la configuración local, está cubierto por `*.local` y no se incluye en Git ni en este commit.
- **Decisiones tomadas y motivo:**
  - La identidad es un nombre de presencia, no una cuenta ni autorización. Se guarda en `sessionStorage` para diferenciar pestañas y no crear persistencia de usuario engañosa.
  - Se añadió interacción por toque además del drag-and-drop porque HTML5 drag no es fiable en pantallas táctiles.
  - Los paneles se convierten en hojas inferiores solamente hasta 760 px; escritorio conserva el flujo lateral existente.
  - El broker se limita a la IP LAN y exige usuario/contraseña. No se versionan credenciales ni se abre un broker público.
- **Pruebas y evidencia:**
  - `npm run test:run` con `TEMP`/`TMP` dentro del workspace → **23 archivos y 144 pruebas aprobadas**.
  - `npm run lint` → **0 errores**.
  - `npm run build` → **aprobado**, 283 módulos transformados; permanecen únicamente los avisos conocidos de Pyodide y tamaño del chunk principal.
  - `git diff --check` → aprobado, sin errores de espacios.
  - Verificación visual e interactiva en viewport **390×844**: diálogo de nombre, topbar, toque para añadir Functional Block, cierre automático de paleta, panel inferior de Propiedades y nombre propio en colaboradores.
  - Verificación visual en viewport **820×1180**: topbar, proyecto, estados, colaboradores, canvas y paleta accesibles sin desbordamiento crítico.
  - `http://192.168.1.8:5173/` → HTTP **200**; listener MQTT `192.168.1.8:9001` activo y conexión WebSocket autenticada aprobada.
- **Riesgos o limitaciones:**
  - El nombre es declarativo y cualquier participante de la LAN puede elegirlo; no reemplaza autenticación de usuarios.
  - En pantallas pequeñas las acciones de la topbar se recorren horizontalmente.
  - El PC que ejecuta Vite y Mosquitto debe permanecer encendido; la IP `192.168.1.8` puede cambiar si el router no tiene reserva DHCP.
  - No se validó ejecución MicroPython ni matriz física porque no había Pico W disponible.
- **Cómo revertir:** revertir esta entrada y los archivos enumerados. Eliminar `frontend/.env.local` solo si también se desea retirar la configuración local; el archivo no pertenece al historial Git.
### [2026-10-28 15:55] — Persona 1 — Revisión de integración de Personas 2 y 3

- **Objetivo:** comprobar el pull completo, auditar los cambios de Persona 2 sobre el contrato de Persona 1 y verificar que los workers Pico/navegador consuman el mismo protocolo.
- **Estado:** [x] Hecho en escritorio; [!] pruebas con Mosquitto y Pico W físicas continúan pendientes.
- **Commit o rama:** `mqtt-pico`, revisión sobre `6d02a02`; correcciones locales pendientes de commit.
- **Archivos modificados:** `frontend/src/types/hiles.ts`; `frontend/src/features/distributed/assignments.ts`; `frontend/src/features/distributed/assignmentSync.test.ts`; `frontend/src/stores/useDistributedExecutionStore.ts`; `frontend/src/services/ir/particionarIr.test.ts`; `frontend/src/services/distributed/BrowserWorker.ts`; `frontend/src/services/distributed/BrowserWorker.test.ts`; este plan y este registro.
- **Decisiones tomadas y motivo:** se conservaron los cambios cruzados de Persona 2 porque cierran requisitos reales del contrato: JSON canónico compatible con MicroPython, SHA-256 sobre bytes publicados, preservación de `retardo_ms`/`capacidad_cola`, entrada externa, comando `step` y vectores TS↔MicroPython. Se tipó `deploymentTarget` como propiedad opcional del documento para eliminar casts inseguros y garantizar su sincronización colaborativa.
- **Pruebas ejecutadas y resultado exacto:** firmware con el Python de Thonny: **166/166 aprobadas**; frontend: **23 archivos y 145/145 aprobadas**; ESLint: **aprobado**; TypeScript y build Vite: **aprobados, 282 módulos transformados**.
- **Evidencia física o visual:** no se ejecutó hardware ni inspección visual en navegador durante esta revisión.
- **Errores encontrados y corrección:** el primer build falló con dos errores `TS2352` en `assignmentSync.test.ts` porque `deploymentTarget` no existía en `HilesNodeProperties`; se añadió el campo opcional y se retiraron los casts. La prueba del particionador podía crear silenciosamente el vector v3 si faltaba; ahora exige que el archivo esté versionado y falla si no existe. El worker navegador convertía entradas CCH remotas en DCH, por lo que dos valores recibidos antes de un paso se repartían en dos pasos; ahora conserva CCH y aplica el último valor en el mismo paso, como la Pico, con una prueba de regresión. También se retiraron nombres propios de los documentos de la entrega.
- **Riesgos o limitaciones:** falta validar broker Mosquitto real, Pico↔Pico, Pico↔browser, memoria real y recuperación física. El panel aún no muestra RSSI ni el modelo activo, por lo que su criterio P1 permanece abierto. El bundle principal supera 500 kB y Vite mantiene una advertencia de tamaño, sin impedir el build.
- **Entrada que recibe:** contrato/particionador de Persona 1, worker MicroPython de Persona 2 y worker navegador/UX de Persona 3.
- **Handoff entregado a:** Persona 5 para pruebas físicas, integración y documentación final.
- **Cómo revertir o recuperar:** restaurar los siete archivos TypeScript modificados en esta revisión y retirar esta entrada; los commits `d2b8e81`, `f0ccc39`, `9135cf0` y `6d02a02` permanecen intactos.

### [2026-10-28 16:42] — Persona 1 — Prueba real sin Pico y corrección de Python distribuido

- **Objetivo:** comprobar que el proyecto se puede compartir y ejecutar sin hardware, usando dos navegadores como ejecutores independientes sobre Mosquitto real.
- **Estado:** [x] Browser↔browser aprobado; [!] combinaciones con Pico continúan pendientes.
- **Commit o rama:** `mqtt-pico`, cambios locales pendientes de commit.
- **Archivos modificados:** `frontend/src/engine/MotorSimulacion.ts`; `frontend/src/engine/__tests__/MotorSimulacionIrV2.test.ts`; este plan y este registro.
- **Prueba real y resultado:** se abrió `?project=prueba-sin-pico-20261028` en dos sesiones; ambas conectaron a MQTT, mostraron dos colaboradores y anunciaron ejecutores distintos. Se asignó `Sensor` al primer navegador y `Proceso`/`Sumar uno` al segundo. El despliegue produjo dos fragmentos y dos ACK. Al inyectar `41`, el CCH cruzó MQTT y ambos colaboradores mostraron `Entrada = 41`, `Sumar uno = 42` y `Resultado = 42`.
- **Recuperación:** tras recargar ambas sesiones, los ejecutores conservaron sus identidades de pestaña, recuperaron el manifiesto y fragmentos retenidos, volvieron a estado `Listo` y reanudaron la ejecución.
- **Error encontrado y corrección:** el motor entregaba a Pyodide las variables públicas y también las claves internas de puerto; `calcular(**inputs)` rechazaba identificadores como `ejemplo-sumar-in`. Ahora el Worker recibe únicamente `normalizarEntradasPython`, es decir, la firma IR v2 validada. Se añadió una regresión que exige exactamente `['x']`.
- **Pruebas ejecutadas:** frontend **23 archivos, 146/146**; firmware **166/166**; ESLint **aprobado**; TypeScript y build Vite **aprobados, 282 módulos**. Persiste únicamente el aviso no bloqueante del chunk principal mayor de 500 kB.
- **Limitaciones pendientes:** no se probó Pico↔browser ni Pico↔Pico; tampoco un segundo PC físico ni un usuario nuevo siguiendo el tutorial.

### [2026-10-30 08:20] — Persona 1 — Integración del pull y auditoría de cierre

- **Objetivo:** recuperar los cambios locales que no se habían subido, traer los commits compartidos más recientes, resolver los conflictos sin perder trabajo y revisar el estado completo de la entrega.
- **Estado:** [x] Integración y validación de software completadas; [!] las combinaciones con Pico física permanecen pendientes.
- **Commit o rama:** rama `mqtt-pico`, actualizada por avance rápido hasta `a3302a9`; cambios integrados todavía sin commit ni push.
- **Archivos modificados:** este plan y registro; correcciones locales de protocolo/worker/Python distribuidos; `scripts/test-distributed-mqtt.mjs`; y el texto de ejemplo de `frontend/src/features/collaboration/DisplayNameDialog.tsx`.
- **Integración realizada:** se creó un stash de recuperación, se ejecutó `pull --ff-only` y se reaplicaron los cambios locales. Se resolvieron tres conflictos en el plan, el registro y `assignmentSync.test.ts`. El campo `deploymentTarget` se conservó tipado y los documentos quedaron sin nombres propios, usando solamente `Persona N`.
- **Pruebas ejecutadas y resultado exacto:** frontend **23 archivos, 146/146**; firmware **166/166**; ESLint aprobado; build Vite aprobado con **283 módulos**; runner en memoria con **6/6 etapas**, cuatro ACK, `5 → 6`, veinte snapshots, dos descartes, una reconexión y cuatro liberaciones; runner físico `DryRun -AllowNoDevice` aprobado y reportando correctamente que no había hardware.
- **Evidencia MQTT real:** el runner de red aprobó **6/6 etapas** sobre el listener WebSocket configurado localmente: cuatro ejecutores registrados, cuatro ACK, entrada `5`, salida `6`, veinte snapshots, dos mensajes descartados y desconexión observada. Terminó con código `0` sin imprimir credenciales.
- **Errores encontrados y corrección:** el runner esperaba liberar también el fragmento del worker que había desconectado deliberadamente, condición imposible antes de una reconexión; además MQTT.js mantenía recursos WebSocket durante el cierre. Se limitó la liberación a workers conectados, se informa el worker offline pendiente de sincronización retained, se acotó la limpieza y se destruyen los streams al cerrar. El diálogo de identidad también cambió su ejemplo a `Persona 1` para cumplir la regla documental.
- **Riesgos o limitaciones:** no existe evidencia nueva de Pico↔Pico ni Pico↔browser con placas reales; faltan memoria/RSSI reales, la demo física de semáforos, el prototipo Three.js y una prueba guiada con usuario nuevo. El build conserva los avisos no bloqueantes de Pyodide y del chunk principal mayor de 500 kB. Los cambios móviles y el diálogo de nombre no añadieron pruebas unitarias específicas, aunque pasan build, lint y la regresión existente.
- **Estado de entrega:** sólida para demostración distribuida sin hardware y por LAN con navegadores; no debe presentarse todavía como matriz física completa.
- **Recuperación:** el stash `codex-respaldo-antes-integrar-2026-10-30` se mantiene temporalmente hasta confirmar el commit final; no se hizo push en esta revisión.

### [2026-10-30 08:55] — Persona 1 — Cuatro semáforos pares sin controlador central

- **Objetivo:** convertir el ejemplo vial en una demostración real de ejecución distribuida donde cuatro Functional Blocks, potencialmente en cuatro dispositivos, calculan sus colores sin un quinto bloque orquestador.
- **Estado:** [x] Demo software con token y temporización completa y probada; [!] hardware físico y lease/fail-safe pendientes.
- **Arquitectura:** cuatro Structural Blocks contienen un Service local, un Functional Block de decisión, cinco Places y cinco Transitions. Un token circula Norte→Este→Sur→Oeste; al distribuir un bloque por ejecutor se obtienen cuatro fragmentos y ocho rutas MQTT remotas.
- **Decisión y motivo:** cada par conoce solamente su fila. Con demanda consume el permiso y recorre verde 3 s → amarillo 1 s → rojo; sin demanda permanece rojo y cede. La exclusión mutua proviene del token y el estado Petri explícito, no de un ganador global.
- **Archivos modificados:** generador y JSON de `demo-4-semaforos-distribuidos`; fixture IR v2; protocolo y matriz vial; pruebas del compilador, particionador, `PythonExecutor` y `EngineTaskV2`; este plan y registro.
- **Pruebas funcionales:** compilación oficial con cuatro Functional Blocks, cuatro Services, veinte Places, veinte Transitions y ochenta conexiones; particionado aprobado en cuatro fragmentos con ocho rutas remotas; `N=0, E=5, S=0, O=0` hace que Norte ceda, Este pase verde → amarillo → rojo y entregue exactamente un token a Sur.
- **Regresión exacta:** frontend **24 archivos y 148/148 pruebas**; firmware **167/167 pruebas**; ESLint aprobado; TypeScript y build Vite aprobados con 284 módulos.
- **Visualización:** los Places `🔴 Rojo`, `🟢 Verde`, `🟡 Amarillo` y `● Token local` muestran el marcado real; el runtime conserva además indicadores genéricos para valores de color.
- **Límites honestos:** amarillo y duración mínima ya están implementados. Faltan token con lease/vencimiento, heartbeat, regeneración sin duplicados y fail-safe físico en rojo ante caída de un ejecutor.
- **Alternativas consideradas:** parqueadero distribuido, banda transportadora y habitaciones HVAC. El cruce se conservó porque hace más visibles los canales remotos, el consenso y una violación de seguridad.

### [2026-10-30 19:20] — Persona 1 — Preparación física multi-Pico y paquete actualizado

- **Objetivo:** dejar instrucciones reproducibles para preparar Pico nuevas, actualizar la placa actual sin perder credenciales y probar las matrices Pico↔Pico/Pico↔browser.
- **Estado:** [x] Guías, plantilla y paquete preparados/verificados; [!] ejecución sobre placas reales pendiente.
- **Cambios:** se reescribió `docs/mqtt/GUIA_PRUEBA_PICO_W.md`, se actualizó la guía completa, la ficha MQTT, la arquitectura y README. Se documentaron Thonny y `mpremote`, respaldo, instalación de `umqtt.simple`, identidades únicas, proyecto compartido, estructura remota, validación de imports, presencia v3, LED, despliegue, token y recuperación.
- **Error preventivo encontrado:** el ZIP anterior no incluía `hiles/distributed_worker.py` aunque `main.py` lo importaba. `prepare-pico-deployment.ps1` ahora exige ese módulo, Watchdog, motor v2, PythonExecutor y topics v3 antes de aceptar el paquete.
- **Compatibilidad corregida:** la regresión detectó que el motor MicroPython v1 no consumía la guarda al disparar, a diferencia del navegador y del motor v2. Se alineó `hiles/elements.py`; las 167 pruebas de firmware volvieron a aprobar.
- **Paquete generado:** `output/hiles-pico-w-deploy.zip`, 32 archivos, SHA-256 `7A18DFFB697E07DF3AA68618A4BEEFF0E4784ED308E88E2CFBCF6DD8A162172F`. No contiene `config_local.py`, credenciales, bytecode ni ejemplos.
- **Verificación:** los 32 entries se compararon por SHA-256 con sus fuentes; no hubo diferencias. La carpeta extraída versionada también se sincronizó y su `config_local.py` sigue siendo únicamente una plantilla sin secretos.
- **Limitación honesta:** el runner físico automatiza inventario/respaldo sobre filesystem y modo seco, pero la transferencia serie real se realizará con Thonny o `mpremote`. No se marca Pico↔Pico ni Pico↔browser como aprobado hasta ejecutar la guía con hardware.
