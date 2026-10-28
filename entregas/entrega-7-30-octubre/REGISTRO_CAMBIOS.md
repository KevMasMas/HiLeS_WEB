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

### [2026-10-28 15:13] — Persona 3 (Juan Ramos) — Worker de navegador, colaboración y experiencia de usuario

- **Objetivo:** permitir que un navegador sea ejecutor con el mismo contrato v3 que una Pico W y hacer comprensible la distribución: asignar bloques, desplegar, observar el estado agregado, colaborar y aprender a usar HiLeS sin conocimiento previo.
- **Estado:** [x] Hecho en software y probado en escritorio. [!] Pendientes: ensayo con Mosquitto real y dos o más navegadores o Pico W, verificación visual en el navegador y prueba del tutorial con un usuario nuevo.
- **Commit o rama:** `mqtt-pico`, trabajo preparado sobre `f0ccc39`; commit pendiente al momento de este registro.
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
  - `PLAN_IMPLEMENTACION_ENTREGA_30.md` (Persona 5): se registró a Juan Ramos como Persona 3 y se marcaron sus casillas, P1/P0 propios y cronograma, junto con la fila de evidencia. Quedan abiertos los criterios del tutorial con un usuario real y la verificación visual de estados.
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
