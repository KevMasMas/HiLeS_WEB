# Plan de implementación — entrega del 20 de octubre

**Fecha límite:** martes 20 de octubre de 2026

**Equipo:** cinco personas

**Estado:** planeación corregida después de auditar entregas anteriores, código actual y pruebas
**Regla de avance:** una casilla se marca `[x]` únicamente cuando hay código terminado y prueba reproducible. Durante esta revisión no se agrega ninguna entrada al registro de cambios.

## 1. Objetivo real de esta entrega

Completar las capacidades que todavía no existen sobre la arquitectura actual, sin rehacer `Task`, `Scheduler`, MQTT, el editor ni el motor ya entregado:

1. Ejecutar en la Raspberry Pi Pico W el código **Python** escrito dentro de un `Functional Block`.
2. Ampliar el perfil remoto para ejecutar `Sample`, `Hold`, CCH, DCH, LCH/Petri y retardos sin bloquear el scheduler.
3. Abrir y reconstruir el documento visual mediante `?project=<id>`.
4. Sincronizar edición, presencia y cursores entre navegadores del mismo proyecto.
5. Reorganizar la interfaz para liberar espacio del canvas mediante una topbar y paneles compactos.
6. Reemplazar el semáforo coordinado anterior por cuatro controladores lógicos independientes, con sensores, FSM `Rojo → Verde → Amarillo → Rojo` y exclusión segura de movimientos incompatibles.
7. Validar el flujo completo en la Pico física y dejar una demostración repetible.

La Pico ejecuta el motor HiLeS y el Python de los Functional Blocks. Vite, React, Pyodide, Mosquitto y la sincronización visual permanecen en el PC y los navegadores.

## 2. Auditoría de las entregas anteriores

### 2.1 Capacidades terminadas que se reutilizan

Estas actividades ya fueron implementadas y probadas. **No se vuelven a repartir como trabajo nuevo.**

- [x] Editor React/React Flow, importación, exportación, autosave, undo y redo.
- [x] Motor local TypeScript con `Service`, `Functional Block`, `Sample`, `Hold`, `Place`, `Transition` y Structural Block visual.
- [x] Ejecución local de JavaScript y Python mediante Workers/Pyodide.
- [x] Mosquitto local con MQTT TCP para la Pico y WebSockets para los navegadores.
- [x] `Node` pub/sub, `MqttTransport`, reconexión, recuperación de suscripciones, keepalive y recepción cooperativa.
- [x] `Task`, `Scheduler` y `Clock` con prioridad, medición, aislamiento de errores, presupuesto, habilitación y pruebas deterministas.
- [x] `EngineTask` con cola acotada, un número limitado de comandos por actualización y deduplicación de 32 mensajes.
- [x] IR v1 y validadores compartidos para `Service`, Functional Block por árbol de expresión, `Place`, `Transition`, conexiones de dato y arcos Petri.
- [x] Motor MicroPython IR v1 con propagación topológica, tokens atómicos, reset, snapshots y ejecución continua.
- [x] Modo Local/Pico, carga de modelo, comandos, entradas y aplicación de snapshots oficiales al canvas.
- [x] Sesión remota por `?modelo=<id>&version=<n>` y descarte de estados de otra sesión o secuencia anterior.
- [x] Demostrador anterior de cuatro sentidos coordinados por una única red Petri Norte–Sur / Este–Oeste.
- [x] Difusión MQTT comprobada con cuatro clientes WebSocket usando un estado simulado.

### 2.2 Línea base verificada el 18 de octubre

- [x] Firmware: **85 pruebas aprobadas**.
- [x] Frontend: **70 pruebas aprobadas en 12 archivos**.
- [x] TypeScript y build de producción aprobados.
- [x] El `Task`/`Scheduler` local fue comparado con la rama `upy_min/pico_ros` del profesor; no necesita ser reimplementado.
- [ ] El flujo completo navegador → broker → Pico física → snapshot → cuatro navegadores debe repetirse y documentarse para esta entrega.

### 2.3 Capacidades parciales que no deben confundirse con la meta nueva

| Capacidad actual | Qué sí existe | Qué falta realmente |
|---|---|---|
| Enlace de sesión | `?modelo` y `version` filtran snapshots de ejecución | `?project=<id>` no carga ni sincroniza el documento del canvas |
| Functional Block remoto | La Pico ejecuta un árbol de expresión IR v1 | El código Python del editor se rechaza y no viaja a la Pico |
| Sample/Hold | Existen en el motor local | No existen en la IR ni en el motor MicroPython |
| CCH/DCH | El editor conserva el tipo visual | IR v1 los convierte al mismo tipo `dato`; no hay semántica DCH de evento/cola |
| LCH/Petri | Existen arcos Place–Transition | Las señales lógicas de control entre otros elementos no son compatibles remotamente |
| Retardos | El documento guarda `executionDelay` y `delay` | Los motores local y remoto no aplican esos tiempos |
| Structural Block | Se dibuja y sus hijos pueden aparecer planos | No se resuelven conexiones que atraviesan puertos de frontera del bloque |
| Tipos | El editor ofrece `vector` y `custom` | El runtime actual solo transporta boolean, integer, real y string |
| Cuatro navegadores | Pueden recibir un mismo snapshot MQTT | No comparten creación, movimiento o edición de nodos ni muestran presencia/cursor |
| Semáforos | Hay cuatro bloques visuales con una red común | No hay cuatro FSM independientes, sensores ni temporización realista |
| UI | Hay header, paleta izquierda y rail derecho | Los paneles todavía reducen de forma permanente el canvas |

## 3. Alcance exacto y límites

### 3.1 Perfil remoto que debe quedar terminado

Un modelo es compatible con la Pico cuando usa:

- `Service`, `Functional Block` con Python, `Sample`, `Hold`, `Place` y `Transition`;
- Structural Blocks aplanables y puertos de frontera resolubles;
- CCH continuo, DCH de evento, LCH de control y arcos Petri;
- retardos de elemento, transición o conexión implementados mediante fechas límite no bloqueantes;
- valores `boolean`, `integer`, `real`, `string`, `vector` acotado y `custom` JSON acotado;
- límites de elementos, conexiones, código, cola, profundidad y payload definidos en el contrato.

### 3.2 Qué significa “Python en la Pico”

El código se compila y ejecuta con MicroPython en la placa, pero no se acepta Python irrestricto. Permitir ciclos infinitos o acceso directo a red, archivos y hardware bloquearía el scheduler cooperativo.

Perfil obligatorio:

- función `calcular(...)` o expresión compatible;
- aritmética, comparaciones, booleanos, `if/else`, variables locales y retorno;
- funciones seguras explícitas como `min`, `max`, `abs` y `round`;
- salida escalar o diccionario `{puerto: valor}` para múltiples salidas;
- sin `import`, ciclos, recursión, `eval`, `exec`, archivos, red, `machine` ni nombres `__dunder__`;
- validación antes de sustituir el modelo activo;
- error de carga o ejecución asociado al bloque, sin detener otras tareas.

JavaScript continúa disponible en la simulación local, pero no forma parte del perfil MicroPython de esta entrega.

### 3.3 Sincronización de proyecto

El proyecto compartido usa MQTT del PC, no la Pico:

```text
udfjc/hiles/v2/projects/<projectId>/document/snapshot   retained
udfjc/hiles/v2/projects/<projectId>/document/ops        no retained
udfjc/hiles/v2/projects/<projectId>/presence/<clientId> retained/offline
udfjc/hiles/v2/projects/<projectId>/cursor              no retained
```

- El snapshot reconstruye el documento al abrir `?project=<id>`.
- Las operaciones actualizan nodos, conexiones y propiedades sin publicar el documento completo por cada movimiento.
- Cada mensaje incluye `projectId`, `clientId`, `operationId` y reloj lógico.
- Las operaciones repetidas son idempotentes.
- Para esta entrega se usa resolución determinista por entidad/campo con reloj lógico y `clientId`; no se implementa un CRDT de producción ni autenticación.
- `?modelo`/`version` se conserva temporalmente para retrocompatibilidad, pero `projectId` será la identidad del documento compartido y podrá usarse como `modelo_id` al cargarlo en la Pico.

## 4. Reglas de dependencias y propiedad

- Persona 1 no depende de nadie.
- Persona 2 depende únicamente del contrato de Persona 1.
- Persona 3 depende de Personas 1 y 2.
- Persona 4 depende de las interfaces congeladas por Personas 1, 2 y 3.
- Persona 5 integra todo lo anterior y realiza las pruebas completas.
- Un archivo tiene un solo dueño durante la entrega.
- Los archivos marcados “solo lectura” no se modifican salvo que una prueba demuestre un defecto y se acuerde el cambio.
- No se crea otro scheduler. Los retardos se representan como estado pendiente y fecha límite usando el reloj existente.

## 5. Distribución estricta entre cinco personas

### Persona 1 — Ejecutor Python y observabilidad en la Pico

**Responsable:** Kevin Rincón

**Dependencias:** ninguna.

#### Lo existente que reutiliza

- [x] `Task`, `Scheduler`, `Clock`, `Node`, `MqttTransport` y `EngineTask` base.
- [x] Límites de payload, cola y deduplicación.
- [x] Transporte MQTT entrante corregido con polling/keepalive y pruebas de escritorio.

#### Control de avance nuevo

- [x] Definir y congelar la extensión IR para Python: lenguaje, código, entradas, salidas, límites y errores.
- [x] Definir el perfil Python permitido y los casos explícitamente rechazados.
- [x] Implementar validación estática sin ejecutar el código recibido.
- [x] Implementar compilación única al cargar el modelo, no en cada paso.
- [x] Implementar entorno de ejecución con globals/builtins mínimos.
- [x] Resolver argumentos desde los puertos de entrada y resultados escalares o por nombre de puerto.
- [x] Validar tipos escalares, vector y custom acotados antes y después de ejecutar.
- [ ] Aislar errores por Functional Block y conservar activo el modelo anterior cuando falle la carga.
- [x] Agregar límites de tamaño de código, variables y resultado.
- [x] Crear `WatchdogTask` que publique memoria, RSSI, temperatura disponible y estadísticas de tareas.
- [ ] Probar que un error del bloque no detiene MQTT, LED, Watchdog ni las demás tareas.
- [ ] Probar en la Pico física un modelo mínimo `Service → Functional Block Python → Service`.
- [x] Entregar a Persona 2 los fixtures IR válidos/inválidos y los códigos de error congelados.
- [x] Entregar a Persona 3 la API estable de `PythonExecutor` y ejemplos de una y varias salidas.

#### Archivos propios

```text
docs/mqtt/IR_V2_PYTHON.md
docs/mqtt/vectores_ir_v2/python/**
firmware/pico/hiles/python_executor.py
firmware/pico/hiles/runtime_values.py
firmware/pico/devices/watchdog_task.py
firmware/tests/test_python_executor.py
firmware/tests/test_runtime_values.py
firmware/tests/test_watchdog_task.py
```

#### Archivos de solo lectura

```text
firmware/pico/core/task.py
firmware/pico/core/scheduler.py
firmware/pico/core/clock.py
firmware/pico/pubsub/mqtt_transport.py
```

#### Entregable y criterio de cierre

- [ ] Código Python válido produce una salida medida en la Pico física.
- [x] Código prohibido se rechaza antes de activarse.
- [ ] Error de ejecución se publica con `elemento_id` y no detiene el scheduler.
- [x] Persona 2 y Persona 3 recibieron contrato, fixtures y API sin depender de cambios posteriores.

---

### Persona 2 — IR v2, compilador, canales y protocolo de proyecto

**Responsable:** Ivan Felipe Prado Blanco

**Dependencias:** solo Persona 1.

#### Lo existente que reutiliza

- [x] IR v1, compilador, validadores y vectores de conformidad.
- [x] Cliente MQTT web y cliente de ejecución remota.
- [x] Motor local básico de Sample/Hold y Pyodide.
- [x] Sesión de ejecución por `modelo_id`, versión y secuencia.

#### Control de avance nuevo

- [x] Extender los tipos TypeScript a IR v2 conservando lectura de IR v1.
- [x] Transportar código Python, firma de puertos y límites definidos por Persona 1.
- [x] Compilar `Sample` y `Hold` en lugar de rechazarlos.
- [x] Mantener separados CCH, DCH, LCH y arco Petri en la IR.
- [x] Definir semántica exacta de DCH: evento de un solo consumo, orden FIFO y desbordamiento visible.
- [x] Definir y transportar `executionDelay`, retardo de transición y `connection.delay`.
- [x] Resolver Structural Blocks y puertos de frontera a conexiones planas verificables.
- [x] Normalizar elementos/conexiones legados `TOKEN` y `TOKEN_FLOW` cuando sea posible.
- [x] Validar valores `vector` y `custom` con límites de profundidad, longitud y bytes.
- [x] Actualizar el motor TypeScript de referencia para que CCH, DCH, LCH y retardos tengan la misma semántica acordada.
- [x] Implementar lectura y creación de `?project=<id>` sin romper `?modelo`/`version`.
- [x] Definir topics dinámicos y esquemas de snapshot, operación, presencia y cursor.
- [x] Implementar un cliente de proyecto desacoplado de React con deduplicación y reloj lógico.
- [x] Preparar fixtures de carga inicial, operación repetida, reconexión y aislamiento entre dos proyectos.
- [x] Entregar a Persona 3 vectores completos de conformidad web/MicroPython.
- [x] Entregar a Persona 5 la API estable de `ProjectSyncClient`.

#### Archivos propios

```text
docs/mqtt/IR_V2.md
docs/mqtt/PROTOCOLO_PROYECTOS_V2.md
docs/mqtt/vectores_ir_v2/modelos/**
docs/mqtt/vectores_ir_v2/ejecucion/**
frontend/src/services/ir/tiposIrV2.ts
frontend/src/services/ir/compiladorIrV2.ts
frontend/src/services/ir/validadorIrV2.ts
frontend/src/services/ir/irV2.test.ts
frontend/src/services/ir/index.ts
frontend/src/services/projects/projectUrl.ts
frontend/src/services/projects/projectMessages.ts
frontend/src/services/projects/projectTopics.ts
frontend/src/services/projects/ProjectSyncClient.ts
frontend/src/services/projects/*.test.ts
frontend/src/services/mqtt/config.ts
frontend/src/services/mqtt/messages.ts
frontend/src/services/mqtt/MqttClient.ts
frontend/src/services/mqtt/RemoteExecutionClient.ts
frontend/src/engine/GrafoDatos.ts
frontend/src/engine/BusObserver.ts
frontend/src/engine/MotorSimulacion.ts
frontend/src/engine/__tests__/**
```

#### Inputs recibidos de Persona 1

- [x] Perfil Python y límites congelados.
- [x] Forma de entradas/salidas del ejecutor.
- [x] Códigos de error y fixtures válidos/inválidos.

#### Entregable y criterio de cierre

- [x] Un documento con Python, Sample, Hold, CCH, DCH, LCH, Petri y retardos compila a IR v2 sin edición manual.
- [x] El motor local reproduce los vectores v2 esperados.
- [x] Abrir `?project=demo` solicita el snapshot de `demo` y nunca aplica mensajes de otro proyecto (integración con editor y broker aprobada).
- [x] Persona 3 y Persona 5 recibieron contratos y fixtures aprobados.

---

### Persona 3 — Motor MicroPython completo y cuatro semáforos independientes

**Responsable:** Juan Ramos

**Dependencias:** Personas 1 y 2.

#### Lo existente que reutiliza

- [x] Motor IR v1 de `Service`, Functional Block por expresión, Place y Transition.
- [x] Propagación topológica, movimiento atómico de tokens, snapshots y reset.
- [x] `EngineTask` cooperativo con comandos, cola y ejecución continua.
- [x] Generador del semáforo coordinado anterior, usado solo como referencia y regresión.

#### Control de avance nuevo

- [x] Cargar IR v2 y mantener compatibilidad de lectura con IR v1.
- [x] Integrar `PythonExecutor` de Persona 1 en Functional Block.
- [x] Implementar `Sample` con dato continuo, evento de captura y salida DCH.
- [x] Implementar `Hold` con entrada DCH, valor retenido CCH y evento LCH de actualización.
- [x] Implementar canales CCH, cola DCH y evento LCH diferenciados.
- [x] Implementar vector/custom acotados sin copiar estructuras indefinidamente.
- [x] Implementar retardos como fechas límite en el motor usando `scheduler.clock`, sin `sleep`.
- [x] Cancelar eventos y retardos pendientes al reiniciar o cargar otro modelo.
- [x] Ampliar snapshots con valor retenido, evento/cola pendiente, timer y error observable.
- [x] Reproducir todos los vectores de conformidad de Persona 2.
- [x] Diseñar cuatro FSM separadas: Norte, Sur, Este y Oeste.
- [x] Crear un sensor de presencia independiente por sentido.
- [x] Crear solicitudes y permisos de paso para que cada FSM decida con su sensor sin compartir un único estado interno.
- [x] Garantizar la secuencia `Rojo → Verde → Amarillo → Rojo`, con todo-rojo de seguridad antes de un movimiento conflictivo.
- [x] Definir matriz de conflictos, tiempo mínimo verde, amarillo, todo-rojo y espera máxima para evitar inanición.
- [x] Crear simulador de sensores y adaptador GPIO opcional (GPIO probado con un `machine` simulado; falta la placa física).
- [x] Generar el nuevo JSON desde script; no editar manualmente el archivo de demo.
- [x] Probar ausencia de verdes incompatibles, transición por amarillo, equidad y fail-safe ante sensor inválido.

#### Archivos propios

```text
firmware/pico/hiles/model_v2.py
firmware/pico/hiles/elements_v2.py
firmware/pico/hiles/channels.py
firmware/pico/hiles/engine_v2.py
firmware/pico/hiles/engine_task_v2.py
firmware/pico/devices/traffic_controller.py
firmware/pico/devices/vehicle_sensor_task.py
firmware/pico/platform/traffic_io.py
firmware/tests/test_hiles_model_v2.py
firmware/tests/test_hiles_engine_v2.py
firmware/tests/test_hiles_channels.py
firmware/tests/test_hiles_delays.py
firmware/tests/test_traffic_controller.py
scripts/generate-distributed-traffic-demo.mjs
output/demo-4-semaforos-distribuidos.json
docs/traffic/PROTOCOLO_SEMAFOROS.md
docs/traffic/MATRIZ_CONFLICTOS.md
```

#### Inputs recibidos

- [x] Persona 1: `PythonExecutor`, valores, límites y errores.
- [x] Persona 2: IR v2 congelada, semántica de canales/retardos y vectores.

#### Entregable y criterio de cierre

- [x] Los mismos vectores v2 producen el mismo estado observable en TypeScript y MicroPython.
- [x] MQTT y Watchdog continúan ejecutándose mientras hay retardos pendientes (escritorio, con `FakeTransport` y `WatchdogTask`; falta la Pico física).
- [x] Cada semáforo conserva su propio estado y sensor.
- [x] Ningún sentido pasa de verde directamente a rojo.
- [x] Nunca hay verdes simultáneos en movimientos incompatibles.

---

### Persona 4 — Topbar y aprovechamiento del canvas

**Responsable:** Juan David Romero

**Dependencias:** Personas 1, 2 y 3 únicamente mediante contratos ya congelados.

#### Lo existente que reutiliza

- [x] Canvas React Flow, paleta plegable, propiedades, simulación y panel MQTT.
- [x] CodeMirror para JavaScript/Python.
- [x] Estados visuales remotos aplicados a los nodos.

#### Control de avance nuevo

- [x] Crear una topbar compacta para proyecto, archivo, undo/redo, conexión y ejecución.
- [x] Mover controles dispersos del header y paneles a grupos claros sin duplicarlos.
- [x] Convertir paleta, propiedades, simulación y MQTT en paneles flotantes, desplegables o tabs.
- [x] Permitir cerrar paneles y recuperar el ancho completo del canvas.
- [x] Mantener visibles el modo Local/Pico, proyecto actual, conexión y estado de ejecución.
- [x] Añadir un contenedor visual reservado para presencia y colaboración que Persona 5 pueda montar sin editar estos archivos.
- [x] Mantener importación/exportación, autosave, undo/redo y edición de código.
- [x] Comprobar resoluciones de escritorio usadas en la demo sin superposición crítica (1366×768 y 1920×1080 verificadas el 19 de octubre).
- [x] Agregar estados de foco, tooltip y disabled para los controles principales.
- [x] Crear pruebas de interacción de apertura/cierre y regresión de acciones existentes.

#### Archivos propios

```text
frontend/src/features/editor/Editor.tsx
frontend/src/features/editor/TopBar.tsx
frontend/src/features/editor/PanelDock.tsx
frontend/src/features/editor/Palette.tsx
frontend/src/features/editor/PropertiesPanel.tsx
frontend/src/features/editor/editor.css
frontend/src/features/simulation/SimulationPanel.tsx
frontend/src/features/simulation/simulation.css
frontend/src/features/mqtt/MqttPanel.tsx
frontend/src/features/mqtt/mqtt.css
frontend/src/features/editor/*.test.tsx
```

#### Inputs recibidos

- [x] Persona 2: identidad y estado del proyecto.
- [x] Persona 3: estados observables que deben mostrarse.

#### Entregable y criterio de cierre

- [x] Con paneles cerrados, el canvas ocupa prácticamente toda el área debajo de la topbar.
- [x] Ninguna función ya entregada desaparece.
- [x] La UI reserva un punto estable para que Persona 5 muestre usuarios y cursores.

---

### Persona 5 — Colaboración, integración física, pruebas y demo

**Responsable:** Julián Romero

**Dependencias:** Personas 1, 2, 3 y 4.

#### Lo existente que reutiliza

- [x] Cliente remoto de ejecución y aplicación de snapshots de la Pico.
- [x] Script de cuatro clientes MQTT, guía física y empaquetado del firmware.
- [x] Archivo de demostración coordinada anterior para prueba de regresión.

#### Control de avance nuevo

- [x] Crear identidad efímera `clientId`, nombre y color por navegador.
- [x] Cargar el snapshot retenido al abrir `?project=<id>` antes de habilitar edición compartida.
- [x] Publicar operaciones locales de crear, borrar, mover y editar nodos/conexiones.
- [x] Aplicar operaciones remotas sin volver a publicarlas ni contaminar undo/redo local.
- [x] Implementar deduplicación por `operationId` y resolución determinista por reloj lógico (suite ProjectSyncClient aprobada).
- [x] Publicar presencia online/offline y expirar clientes desconectados (pruebas MQTT unitarias aprobadas).
- [x] Publicar cursores con limitación de frecuencia y dibujar cursores remotos sobre el canvas.
- [x] Mostrar lista compacta de participantes en el contenedor preparado por Persona 4.
- [x] Evitar ecos, bucles de publicación y mensajes cruzados entre proyectos.
- [x] Integrar IR v2, motor v2, Watchdog, sensores y firmware desde `main.py`.
- [x] Actualizar el paquete de despliegue de la Pico sin credenciales ni archivos generados innecesarios.
- [x] Ejecutar pruebas de dos proyectos simultáneos para demostrar aislamiento.
- [x] Ejecutar prueba E2E con cuatro navegadores editando el mismo proyecto.
- [ ] Ejecutar prueba física completa: navegador → broker → Pico → snapshot → cuatro navegadores.
- [x] Ejecutar el demo de sensores y comprobar las cuatro FSM y la matriz de conflictos en escritorio; falta repetirlo con GPIO reales.
- [x] Actualizar la guía de demo únicamente con pasos realmente comprobados.
- [x] Ejecutar firmware, frontend, tipos, lint y build finales.

#### Archivos propios

```text
frontend/src/stores/useEditorStore.ts
frontend/src/stores/useEditorStore.test.ts
frontend/src/stores/useProjectStore.ts
frontend/src/stores/useCollaborationStore.ts
frontend/src/stores/useRemoteExecutionStore.ts
frontend/src/features/collaboration/CollaborationOverlay.tsx
frontend/src/features/collaboration/RemoteCursors.tsx
frontend/src/features/collaboration/Participants.tsx
frontend/src/features/collaboration/collaboration.css
frontend/src/App.tsx
firmware/pico/main.py
firmware/pico/config_local.example.py
scripts/test-project-collaboration.mjs
scripts/test-mqtt-four-clients.mjs
scripts/prepare-pico-deployment.ps1
output/hiles-pico-w-deploy.zip
entregas/entrega-6-20-octubre/GUIA_DEMO.md
```

#### Inputs recibidos

- [x] Persona 1: ejecutor y Watchdog aprobados.
- [x] Persona 2: `ProjectSyncClient`, IR v2, topics y fixtures aprobados (suite frontend: 100 pruebas aprobadas).
- [x] Persona 3: motor remoto y demo distribuido aprobados (174 pruebas firmware aprobadas en escritorio).
- [x] Persona 4: shell visual y contenedor de colaboración aprobados (suite frontend y build aprobados).

#### Entregable y criterio de cierre

- [x] Un enlace `?project=<id>` reconstruye el mismo documento en un navegador nuevo.
- [ ] Cuatro navegadores muestran operaciones, presencia, cursores y estado oficial de la Pico.
- [ ] El Python del Functional Block se ejecuta realmente en la Pico, no en Pyodide.
- [ ] Los cuatro semáforos responden a sensores independientes y respetan amarillo y exclusión.
- [ ] La entrega puede repetirse desde la guía sin pasos implícitos.

## 6. Flujo de entregas entre personas

```text
Persona 1
  contrato Python + PythonExecutor + Watchdog + fixtures
        ↓
Persona 2
  IR v2 + compilador + semántica de canales + ProjectSyncClient
        ↓
Persona 3
  motor MicroPython v2 + Sample/Hold + retardos + semáforos
        ↓
Persona 4
  shell visual sobre contratos congelados
        ↓
Persona 5
  colaboración + composición final + hardware + E2E + demo
```

Handoff obligatorio de cada persona:

- [ ] Código integrado sin modificar archivos de otro dueño.
- [ ] Pruebas unitarias focales aprobadas.
- [ ] Contrato o API consumible documentada.
- [ ] Fixtures o ejemplo mínimo para la siguiente persona.
- [x] Limitaciones reales comunicadas antes de la integración y registradas para la prueba física.

## 7. Orden de trabajo hasta el día 20

### Domingo 18 — auditoría y contratos

- [x] Auditar entregas 3, 4 y 5 contra el código actual.
- [x] Confirmar que scheduler, MQTT, IR v1 y cliente remoto no se reimplementan.
- [ ] Confirmar nombres de Personas 2 a 5.
- [x] Congelar perfil Python, IR v2, errores y límites.
- [x] Congelar protocolo de proyecto y semántica de CCH/DCH/LCH/retardos.
- [x] Congelar propiedad de archivos.

### Lunes 19, mañana — unidades independientes

- [x] Persona 1 termina PythonExecutor, valores y Watchdog.
- [x] Persona 2 termina tipos/compilador IR v2 y protocolo de proyecto.
- [x] Persona 3 inicia desde los fixtures congelados, sin modificar contratos.
- [x] Persona 4 construye topbar y paneles sobre las APIs existentes.

### Lunes 19, tarde — motores e integración web

- [x] Persona 2 termina motor TypeScript de referencia y `ProjectSyncClient`.
- [x] Persona 3 termina motor MicroPython v2 y pruebas de paridad.
- [x] Persona 3 genera y prueba semáforos distribuidos.
- [x] Persona 5 conecta store, snapshot, operaciones, presencia y cursores.

### Lunes 19, noche — integración y regresión

- [x] Persona 5 compone firmware y frontend.
- [x] Ejecutar suites completas y corregir únicamente defectos de alcance P0.
- [x] Probar dos proyectos aislados y cuatro navegadores en uno.
- [x] Regenerar paquete de despliegue.

### Martes 20 — hardware y congelación

- [ ] Copiar firmware limpio a la Pico.
- [ ] Ejecutar FB Python y observar salida publicada por la placa.
- [ ] Ejecutar Sample/Hold, DCH y retardos sin bloquear MQTT.
- [ ] Ejecutar semáforos con sensores y matriz de conflictos.
- [x] Ejecutar flujo de cuatro navegadores (colaboración web y broker; falta añadir la Pico física al flujo).
- [x] Completar la guía demo con los resultados web reales y mantener pendientes las evidencias físicas.
- [x] Registrar cambios y evidencias solo después de obtener resultados.
- [ ] Congelar entrega; no agregar funciones durante el ensayo final.

## 8. Criterios globales de aceptación

### Runtime Pico

- [ ] El código Python del Functional Block se compila y ejecuta en MicroPython.
- [x] Código inválido no sustituye el modelo activo.
- [ ] `Service`, Functional Block, Sample, Hold, Place y Transition funcionan remotamente.
- [x] CCH, DCH, LCH y Petri mantienen semánticas diferenciadas.
- [x] Los retardos no contienen `sleep` ni bloquean MQTT/Watchdog.
- [x] Reset limpia entradas, salidas, colas, eventos, timers, valores retenidos y tokens.
- [x] Vectores compartidos producen estados equivalentes en los motores TypeScript y MicroPython ejecutado sobre CPython; falta confirmar recursos en placa.

### Proyecto y colaboración

- [x] `?project=<id>` carga el documento compartido.
- [x] Dos proyectos no reciben operaciones cruzadas.
- [x] Cuatro navegadores convergen al mismo documento.
- [x] Presencia y cursores aparecen y desaparecen correctamente.
- [x] Una reconexión recupera snapshot y continúa sin duplicar operaciones.

### Semáforos

- [x] Existen cuatro FSM y cuatro sensores independientes.
- [x] Toda salida de verde pasa por amarillo.
- [x] Existe intervalo seguro de todo-rojo antes de conceder un conflicto.
- [x] Nunca se observan verdes incompatibles (pruebas de escritorio con demanda aleatoria y sostenida).
- [x] Una demanda sostenida no causa inanición permanente de otro sentido.

### UI, calidad y entrega

- [x] La topbar y paneles liberan el canvas sin eliminar funciones.
- [ ] La Pico física es la fuente oficial del estado remoto.
- [x] Las pruebas de firmware existentes continúan aprobando junto con las nuevas (174 pruebas aprobadas).
- [x] Las pruebas frontend existentes continúan aprobando junto con las nuevas (103 pruebas aprobadas en 17 archivos).
- [x] TypeScript, lint y build aprueban.
- [x] No hay credenciales reales en el ZIP; `config_local.py` no se empaqueta y los archivos de ejemplo usan marcadores.
- [x] La guía demo coincide con el comportamiento observado y conserva las pruebas físicas como pendientes.

## 9. Exclusiones explícitas

- Python completamente arbitrario o preemptivo dentro de MicroPython.
- JavaScript ejecutado en la Pico.
- Broker en la nube, autenticación, permisos o persistencia de producción.
- CRDT general para edición offline prolongada.
- Varios proyectos ejecutándose simultáneamente en una única Pico; la placa mantiene un modelo activo.
- Reescritura de `Task`, `Scheduler`, `Node`, `MqttTransport`, React Flow o Pyodide.

Si una prueba demuestra un defecto en una pieza ya entregada, se corrige el defecto mínimo y se conserva su arquitectura; no se vuelve a asignar el módulo completo.
