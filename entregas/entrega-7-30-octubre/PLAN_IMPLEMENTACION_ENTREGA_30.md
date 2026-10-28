# Plan de implementación — entrega del viernes 30 de octubre de 2026

**Equipo:** cinco personas  
**Rama base:** `mqtt-pico`  
**Commit base:** `baadff6`  
**Estado inicial:** runtime general, colaboración web y flujo físico con una Pico W aprobados  
**Objetivo principal:** ejecutar distintas partes de un mismo modelo en dispositivos diferentes sin introducir lógica de dominio en el firmware.

**Asignación propuesta, pendiente de confirmación del equipo:**

| Responsable | Frente |
|---|---|
| Persona 1 | Protocolo y particionador distribuido |
| Persona 2 | Worker MicroPython multi-Pico |
| Persona 3 (Juan Ramos) | Worker web, colaboración y UX |
| Persona 4 | Investigación Three.js |
| Persona 5 | Integración, automatización física y documentación |

## 1. Interpretación del requerimiento

La siguiente evolución debe permitir decidir dónde corre cada parte del modelo:

- una Raspberry Pi Pico W;
- otra Pico W;
- un navegador conectado al proyecto;
- una combinación de dispositivos y navegadores.

La unidad preferida de despliegue será el `Structural Block`. Los Functional Blocks internos heredan su destino, aunque el contrato dejará prevista una sobreescritura explícita por Functional Block cuando sea necesaria.

El sistema seguirá siendo colaborativo: todos los navegadores del mismo `projectId` deben ver el documento, los colaboradores, la asignación de ejecutores y el estado agregado de la ejecución.

En el ejemplo de los semáforos no habrá un controlador vial codificado en `main.py` ni un proceso central que decida todas las luces. Cada semáforo será un bloque independiente y se coordinará con los demás mediante mensajes del modelo. Para evitar verdes incompatibles se propone un token lógico distribuido: solamente el bloque que posee el token puede habilitar verde y, ante pérdida de comunicación, cada nodo entra en rojo seguro.

## 2. Resultado mínimo demostrable

Al cerrar la entrega debe ser posible:

1. Abrir un proyecto colaborativo desde dos o más navegadores.
2. Ver los ejecutores disponibles y su estado: navegadores y Pico W.
3. Asignar cada `Structural Block` a un ejecutor.
4. Compilar el documento en fragmentos por ejecutor.
5. Desplegar cada fragmento únicamente en su destino.
6. Transportar valores entre bloques ubicados en ejecutores diferentes.
7. Mostrar en todos los colaboradores el estado agregado del modelo.
8. Desconectar un ejecutor y mostrar el diagnóstico sin congelar el resto.
9. Reasignar o volver a desplegar un bloque de forma explícita.
10. Ejecutar una demostración vial sin lógica central de semáforos en el firmware.

La matriz ideal usa cuatro ejecutores para cuatro semáforos. Si no hay cuatro Pico W, se acepta una matriz mixta —por ejemplo dos Pico W y dos navegadores— siempre que cada semáforo sea una unidad independiente y se prueben conexiones entre tipos de ejecutor diferentes.

## 3. Principios no negociables

- El broker coordina mensajes, pero no ejecuta reglas del circuito.
- El navegador que despliega publica el manifiesto; no debe calcular permanentemente el estado de todos los bloques.
- `main.py`, `Scheduler`, `Node` y el motor no incorporan reglas de semáforos ni de otro ejemplo.
- Cada salida tiene un único propietario durante una época de despliegue.
- Todo mensaje distribuido incluye proyecto, despliegue, época, ejecutor, conexión, secuencia e identificador deduplicable.
- Un mensaje atrasado o perteneciente a otra época se descarta.
- La colaboración del documento y la ejecución distribuida son protocolos separados.
- Ninguna credencial, SSID o IP fija entra al repositorio.
- Three.js será un consumidor visual del estado, nunca la fuente oficial de simulación.
- Los cambios se integran solo con pruebas y evidencia registradas.

## 4. Alcance priorizado

### P0 — obligatorio

- [x] Contrato de ejecutores, manifiesto de despliegue y tópicos MQTT v3.
- [ ] Identidad dinámica y presencia de múltiples Pico/navegadores ejecutores.
- [x] Propiedad de despliegue en Structural Blocks y Functional Blocks.
- [x] Particionado determinista del modelo en fragmentos válidos.
- [ ] Ejecutor Pico capaz de cargar solamente su fragmento.
- [x] Ejecutor navegador compatible con el mismo contrato de fragmento.
- [ ] Puentes MQTT entre conexiones cuyos extremos viven en ejecutores distintos.
- [ ] Estado agregado y diagnóstico visible para todos los colaboradores.
- [ ] Prueba con al menos dos ejecutores reales y un enlace entre ellos.
- [ ] Automatización segura de la prueba física.
- [ ] Informe técnico y registro individual actualizados.

### P1 — debe entrar si P0 está estable

- [x] Selector visual de destino por Structural Block.
- [ ] Panel de ejecutores con conexión, memoria, RSSI, modelo y última actividad.
- [x] Mejoras de colaboración: selección remota, “seguir colaborador”, estados claros y enlace para invitar.
- [x] Tutorial guiado, ayuda contextual y estado vacío para usuarios nuevos.
- [x] Revisión visual general: logo, consistencia de idioma, espaciado, iconos, mensajes y accesibilidad (quedan textos en inglés en archivos de otros integrantes, listados en `docs/ux/REVISION_VISUAL_Y_ACCESIBILIDAD.md`).
- [ ] Demo distribuido de semáforos con token lógico y modo seguro.

### P2 — investigación aislada, no bloquea P0

- [ ] Prototipo Three.js con escena básica, un automóvil y un semáforo.
- [ ] Adaptador que consuma un snapshot HiLeS o datos simulados con la misma forma.
- [ ] Documento que explique para qué sirve: gemelo digital, visualización 3D y futura validación de modelos.
- [ ] Decisión explícita de integrar, aplazar o descartar el prototipo después de medir costo y utilidad.

## 5. Arquitectura propuesta

```text
Documento colaborativo (?project=id)
              │
              ▼
Compilador y particionador de despliegue
              │ publica manifiesto + fragmentos
              ▼
Mosquitto ───────────────────────────────────────────┐
   │                  │                 │             │
   ▼                  ▼                 ▼             ▼
Pico A             Pico B          Browser C      Browser D
Fragmento A        Fragmento B     Fragmento C    Fragmento D
   │ salida            │ salida        │ salida        │ salida
   └──────── mensajes de conexiones distribuidas ─────┘
              │
              ▼
Snapshots parciales → agregación visual por proyecto
```

No existe un “motor vial central”. Existe un plano de control para publicar el despliegue y un plano de datos en el que cada ejecutor calcula únicamente los elementos que posee.

### 5.1 Conceptos del protocolo

- `executorId`: identifica un worker `pico:<deviceId>` o `browser:<id>`.
- `deploymentId`: identifica una compilación distribuida completa.
- `epoch`: número creciente que invalida mensajes de despliegues anteriores.
- `fragmentId`: subconjunto IR dirigido a un ejecutor.
- `ownerExecutorId`: único propietario autorizado para publicar las salidas del fragmento.

El colaborador y el ejecutor son identidades diferentes: una persona puede editar sin ofrecer su navegador como worker.

### 5.2 Particionado

El compilador recibe el documento, las asignaciones y las capacidades disponibles. Produce:

- un fragmento IR v2 por ejecutor;
- conexiones locales incluidas en cada fragmento;
- rutas MQTT para conexiones remotas;
- manifiesto con hashes, tamaños y propietarios.

Reglas P0:

1. Todo elemento ejecutable tiene destino.
2. Un elemento pertenece a un solo fragmento.
3. Una conexión es local o remota, nunca ambas.
4. Los extremos conservan tipo compatible.
5. Places y Transitions conectados por Petri permanecen juntos durante P0.
6. Un ciclo remoto avanza por pasos; no se resuelve mediante recursión ilimitada de mensajes.
7. El tamaño del fragmento respeta las capacidades publicadas por el worker.

### 5.3 Jerarquía MQTT propuesta

Los nombres definitivos deben congelarse por Persona 1:

```text
udfjc/hiles/v3/projects/<projectId>/executors/<executorId>/status
udfjc/hiles/v3/projects/<projectId>/deployments/manifest
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/fragments/<executorId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/ack/<executorId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/channels/<connectionId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/snapshot/<executorId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/error
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/command
```

Estado, manifiesto y fragmentos activos pueden ser retenidos. DCH/LCH y errores no deben retenerse. Cada receptor valida proyecto, despliegue, época, propietario, conexión, tipo, secuencia e identificador deduplicable.

### 5.4 Estado agregado y recuperación

Cada worker publica su snapshot parcial. Los navegadores componen la vista por `elementId`, aceptando solamente datos del propietario y época activos. Si un worker desaparece, sus elementos se marcan `offline` o `stale`; los demás continúan cuando sus dependencias lo permiten.

| Fallo | Respuesta mínima |
|---|---|
| Worker desconectado | Marcar fragmento offline y bloquear sus nuevas salidas |
| Mensaje duplicado | Ignorar por `messageId` y secuencia |
| Mensaje de época anterior | Descartar |
| Fragmento inválido | Conservar el anterior y publicar rechazo |
| Despliegue parcial | No iniciar hasta recibir los ACK obligatorios |
| Pérdida del broker | Conservar estado local y suspender conexiones remotas |
| Regreso del broker | Resincronizar manifiesto y época antes de aceptar canales |
| Navegador de control cerrado | Workers continúan con el manifiesto retenido |

### 5.5 Semáforos descentralizados

Cada semáforo será un Structural Block con entradas, estado local, Places/Transitions y salidas propias. La propuesta P0 usa un token lógico distribuido:

- sin token no se habilita verde;
- el token tiene un único propietario por época;
- un token duplicado se rechaza por identidad y secuencia;
- al iniciar todos quedan en rojo;
- perder comunicación fuerza rojo seguro;
- la prueba verifica que nunca existan verdes incompatibles.

El token es una propuesta auditable, no una regla que deba codificarse en el firmware general.

## 6. División del trabajo

### Persona 1 — protocolo y compilador de ejecución distribuida

**Responsabilidad:** congelar la arquitectura que consumen los demás.

#### Tareas

- [x] Definir `executorId`, tipos `pico`/`browser`, capacidades y estados.
- [x] Definir `deploymentId`, `epoch`, manifiesto y reglas de propiedad.
- [x] Definir herencia de destino desde Structural Block y sobreescritura por Functional Block.
- [x] Diseñar tópicos de registro, manifiesto, fragmentos, canales, snapshots y errores.
- [x] Definir mensajes de conexión distribuida, secuencia, QoS, retención y deduplicación.
- [x] Implementar el particionador puro `modelo → fragmentos + rutas`.
- [x] Validar conexiones locales, remotas y destinos inexistentes.
- [x] Crear fixtures de dos, tres y cuatro ejecutores.
- [x] Documentar las decisiones y entregarlas antes de que Personas 2 y 3 integren.

#### Archivos propios previstos

```text
docs/mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md
frontend/src/services/distributed/**
frontend/src/services/ir/tiposIrDistribuida.ts
frontend/src/services/ir/particionarIr.ts
frontend/src/services/ir/*.test.ts
```

#### Criterios de cierre

- [x] El mismo documento siempre produce los mismos fragmentos.
- [x] Cada elemento ejecutable tiene un solo propietario.
- [x] Una conexión remota tiene ruta y contrato de dato verificables.
- [x] Un destino ausente impide desplegar y genera un error legible.

#### Resultado comprobado — 28 de octubre

- Contrato v3 congelado en `docs/mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md` y tipos compartidos en `frontend/src/services/ir/tiposIrDistribuida.ts`.
- Tópicos y mensajes reutilizables publicados desde `frontend/src/services/distributed/`.
- Resolución de herencia para Structural Blocks anidados, override de Functional Block y asignación directa de elementos raíz.
- Particionador sin stores, reloj, red ni broker: valida IR v2, propiedad única, workers disponibles, tipos remotos, arcos Petri, capacidades, tamaños y SHA-256.
- Fixtures exportables para dos, tres y cuatro ejecutores; 8 pruebas nuevas aprobadas.
- Regresión completa: 18 archivos y 112 pruebas frontend aprobadas; ESLint y build de producción aprobados.

---

### Persona 2 — worker MicroPython multi-Pico

**Dependencia:** contrato congelado por Persona 1.

**Responsabilidad:** convertir cada Pico en un ejecutor direccionable y general.

#### Tareas

- [x] Sustituir el prefijo fijo `pico01` por identidad derivada de configuración.
- [x] Publicar presencia, capacidades, versión, memoria y estado del worker.
- [x] Suscribirse solamente a manifiestos y fragmentos dirigidos al dispositivo.
- [x] Cargar y liberar fragmentos conservando el modelo anterior ante rechazo.
- [x] Publicar salidas de conexiones remotas y consumir entradas de otros ejecutores.
- [x] Descartar mensajes de otra época, proyecto o despliegue.
- [x] Recuperar suscripciones y fragmento después de una reconexión.
- [x] Mantener scheduler, Watchdog, LED y MQTT no bloqueantes.
- [ ] Probar dos Pico W si están disponibles; si no, una Pico y un doble de protocolo.

#### Archivos propios previstos

```text
firmware/pico/config_local.example.py
firmware/pico/main.py
firmware/pico/pubsub/topics.py
firmware/pico/pubsub/mqtt_transport.py
firmware/pico/hiles/distributed_worker.py
firmware/tests/test_distributed_worker.py
firmware/tests/test_mqtt_transport.py
```

#### Criterios de cierre

- [x] Dos workers no consumen fragmentos ajenos.
- [x] Un worker publica exactamente una vez cada salida lógica aunque MQTT repita el mensaje.
- [x] Reiniciar un worker no cambia la propiedad de los demás.
- [x] Perder el broker deja el runtime en un estado observable y recuperable.

#### Resultado comprobado — 28 de octubre

- Identidad dinámica multi-Pico (`DEVICE_ID` → `machine.unique_id()` → `MQTT_CLIENT_ID` → `"pico01"`), prefijo v1 parametrizado y `executorId` canónico `pico:<deviceId>` compuesto en `firmware/pico/main.py`.
- Transporte MQTT cooperativo (`firmware/pico/pubsub/mqtt_transport.py`) extendido con suscripciones/publicaciones absolutas v3, modo `raw=True` para verificar `SHA-256` sin duplicar el payload en RAM, Last Will retenido en `offline`, descarte limpio de retaineds vacíos (`b""`) y reconexión limpia síncrona al cambiar `deployment_id`.
- Puertos remotos de entrada y salida en `ChannelBus` y `HilesEngineV2` que preservan exactamente la semántica local `CCH`/`DCH`/`LCH`, `retardo_ms` y `capacidad_cola` sin acoplar `hiles/` con MQTT.
- Tarea cooperativa `DistributedWorker` (`firmware/pico/hiles/distributed_worker.py`) con carga/liberación atómica de fragmentos, paridad bit a bit de JSON canónico y SHA-256 contra TypeScript (`docs/mqtt/vectores_v3/01_fixtures_distribucion_v3.json`), validación de los 7 pasos en canales remotos, ventana de deduplicación acotada, outbox con reintento tras reconexión y resincronización desde mensajes retenidos.
- Regresión completa: 165 pruebas de firmware aprobadas (`test_distributed_worker.py` con 8 pruebas integrales multi-worker y `FakeBroker`, incluyendo pipeline de 3 Pico W) y 10 pruebas en `particionarIr.test.ts` aprobadas; queda pendiente únicamente la prueba física en placas reales cuando se conecten las Pico W.

---

### Persona 3 — worker web, colaboración y experiencia de usuario

**Responsable:** Juan Ramos.

**Dependencias:** contratos de Persona 1 y estados del worker de Persona 2.

**Responsabilidad:** permitir ejecución en navegador y hacer comprensible la distribución.

#### Tareas de ejecución

- [x] Implementar un worker de navegador con el mismo contrato que una Pico.
- [x] Registrar cada navegador ejecutor con identidad independiente del colaborador visual.
- [x] Cargar, ejecutar y liberar solamente el fragmento asignado.
- [x] Publicar/consumir conexiones remotas sin eco.
- [x] Agregar selector `Este navegador`, `Pico <id>` o `Sin asignar`.
- [x] Mostrar estado agregado sin ejecutar fragmentos ajenos.

#### Tareas de colaboración y frontend

- [x] Mostrar avatar, color, estado y selección actual de cada colaborador.
- [x] Añadir “seguir colaborador” y centrar la vista en su selección.
- [x] Mejorar diálogo para compartir enlace y copiar `projectId`.
- [x] Diseñar panel de ejecutores y mapa de asignaciones.
- [x] Crear tutorial inicial: canvas, elementos, conexiones, colaboración, despliegue y ejecución.
- [x] Añadir ayuda contextual, mensajes de error accionables y estados vacíos.
- [x] Revisar logo, paleta, tipografía, iconos, consistencia español/inglés y accesibilidad básica (textos en inglés pendientes en archivos ajenos, listados en `docs/ux/REVISION_VISUAL_Y_ACCESIBILIDAD.md`).

#### Archivos propios previstos

```text
frontend/src/services/distributed/BrowserWorker.ts
frontend/src/stores/useDistributedExecutionStore.ts
frontend/src/features/distributed/**
frontend/src/features/collaboration/**
frontend/src/features/onboarding/**
frontend/src/features/editor/TopBar.tsx
frontend/src/features/editor/editor.css
frontend/src/assets/brand/**
```

#### Criterios de cierre

- [x] Un bloque asignado a browser produce el mismo resultado observable que en la Pico para el fixture elegido (vector `docs/mqtt/vectores_v3/02_paridad_worker_navegador.json`, verificado en TypeScript y en Python).
- [x] Cambiar la asignación es colaborativo y no genera operaciones duplicadas (probado a nivel de operaciones del protocolo v2; falta ensayo con dos navegadores y broker real).
- [ ] Un usuario nuevo puede completar el tutorial sin conocer previamente HiLeS (tutorial y ejemplo implementados y probados; falta la prueba con un usuario real).
- [ ] Los estados desconectado, desplegando, ejecutando y error son distinguibles sin abrir la consola (lógica `describirFase` probada; falta verificación visual en navegador con broker).

#### Resultado comprobado — 28 de octubre

- `BrowserWorker` (`browser:<sessionId>`) cumple el contrato v3 de la Pico: estado retenido con Last Will, aceptación atómica con SHA-256 sobre los bytes recibidos, ACK, siete validaciones de canal, deduplicación, salidas sin eco, comandos, entradas propias, snapshots parciales, liberación y resincronización.
- Paridad: el vector 02, generado con el motor MicroPython, se reproduce paso a paso en el navegador (`BrowserWorker.test.ts`) y en la Pico (`test_paridad_worker_navegador.py`).
- Asignaciones en el documento compartido (`properties.deploymentTarget`), panel de ejecutores, mapa de asignaciones, despliegue con espera de ACK, estado agregado sobre el canvas y diagnóstico con recomendaciones.
- Colaboración: selección remota, estado de cada persona, «seguir colaborador» y diálogo para compartir. Además, tutorial de 7 pasos con ejemplo mínimo, ayuda contextual, estado vacío, logo, paleta y accesibilidad.
- Regresión: frontend con 23 archivos y 144 pruebas aprobadas; ESLint, TypeScript y build aprobados; firmware con 166 pruebas aprobadas.

---

### Persona 4 — investigación Three.js y visualización 3D

**Dependencias:** ninguna para el prototipo inicial; contrato de snapshot de Persona 1 para la conexión final.

**Responsabilidad:** explorar una futura vista 3D sin bloquear la entrega distribuida.

#### Propósito

Three.js puede convertir el estado de HiLeS en una visualización o gemelo digital. No reemplaza el canvas ni el motor: recibe snapshots y representa físicamente el resultado. El ejemplo mínimo será un carro que avanza o se detiene según el estado de un semáforo.

#### Tareas

- [ ] Crear un prototipo aislado con escena, cámara, luces, vía, carro y semáforo.
- [ ] Mover el carro con animación basada en tiempo, no ligada a FPS.
- [ ] Cambiar el semáforo mediante una interfaz `applySnapshot`.
- [ ] Usar primero datos simulados y luego un snapshot real si el contrato queda disponible.
- [ ] Liberar recursos Three.js al desmontar la vista.
- [ ] Medir tamaño del bundle, FPS aproximados y efecto sobre el editor.
- [ ] Documentar utilidad, riesgos, dependencias y recomendación.
- [ ] Mantener el prototipo detrás de una ruta o bandera experimental.

#### Archivos propios previstos

```text
frontend/src/experiments/three/**
docs/experiments/THREE_JS_GEMELO_DIGITAL.md
```

#### Criterios de cierre

- [ ] El prototipo no modifica el motor ni el estado oficial.
- [ ] Puede funcionar con datos simulados aunque P0 aún esté en desarrollo.
- [ ] El build principal sigue aprobando y la vista no deja listeners o animaciones activas al cerrarse.
- [ ] Existe una recomendación fundada de integración o aplazamiento.

---

### Persona 5 — integración, automatización física, demo y documentación

**Dependencias:** entregables de Personas 1 a 4.

**Responsabilidad:** integrar sin invadir módulos ajenos y producir evidencia repetible.

#### Tareas de integración y pruebas

- [ ] Crear un runner que inventarie Pico conectadas y nunca muestre credenciales.
- [ ] Respaldar cada placa antes de desplegar y conservar un manifiesto de hashes.
- [ ] Desplegar fragmentos de prueba sin sobrescribir `config_local.py`.
- [ ] Automatizar conexión, carga, entrada, paso, snapshot, telemetría y liberación.
- [ ] Registrar memoria antes/después, duración de tareas y recuperación de MQTT.
- [ ] Probar desconexión de un ejecutor y rechazo de mensajes de época anterior.
- [ ] Ejecutar matriz Pico↔Pico, Pico↔browser y browser↔browser según hardware disponible.
- [ ] Ejecutar suites completas, lint, tipos y build.
- [ ] Preparar y ensayar la guía de demostración.

#### Tareas documentales

- [ ] Mantener este plan como documento maestro técnico y de cierre.
- [ ] Recibir de cada persona objetivo, archivos, pruebas, decisiones, errores y capturas.
- [ ] Actualizar diagramas, estado, limitaciones y glosario.
- [ ] Completar el registro diario sin marcar trabajo no probado.
- [ ] Preparar una sección por integrante y una cronología de entregas.
- [ ] Dejar espacios claramente marcados para resultados posteriores.

#### Archivos propios previstos

```text
scripts/test-distributed-physical.ps1
scripts/test-distributed-mqtt.mjs
entregas/entrega-7-30-octubre/REGISTRO_CAMBIOS.md
entregas/entrega-7-30-octubre/PLAN_IMPLEMENTACION_ENTREGA_30.md
```

#### Criterios de cierre

- [ ] La prueba automatizada puede repetirse sin editar código ni revelar secretos.
- [ ] Cada fallo indica dispositivo, fragmento, conexión y etapa.
- [ ] El informe permite entender qué hizo cada integrante y cómo reproducirlo.
- [ ] La demo parte de un checkout limpio y sigue pasos explícitos.

## 7. Dependencias y trabajo paralelo

```text
Persona 1: contrato + particionador
      ├──────────────► Persona 2: worker Pico
      ├──────────────► Persona 3: worker browser + UX
      └──────────────► Persona 4: conexión opcional del prototipo 3D
Personas 1–4 ────────► Persona 5: integración, pruebas y documentación
```

Durante el primer día Personas 2 y 3 pueden trabajar con fixtures provisionales versionados por Persona 1. Persona 4 puede avanzar completamente con snapshots simulados. Persona 5 prepara el arnés físico y el informe desde el inicio, pero solo integra contratos congelados.

## 8. Cronograma

### Domingo 25 — definición

- [x] Cerrar documentalmente la entrega anterior.
- [x] Registrar la interpretación inicial y la arquitectura propuesta.
- [ ] Confirmar hardware disponible y responsables definitivos.
- [ ] Congelar alcance P0 y aplazamientos.

### Lunes 26 — contratos y esqueletos

- [x] Persona 1 congela protocolo, manifiesto y fixtures.
- [ ] Persona 2 prepara registro dinámico y worker Pico.
- [x] Persona 3 prepara store/panel y worker navegador.
- [ ] Persona 4 entrega escena Three.js con datos simulados.
- [ ] Persona 5 prepara runner, plantilla de evidencia e informe.

### Martes 27 — ejecución por fragmentos

- [x] Particionador y validadores aprobados.
- [ ] Fragmento local ejecuta en Pico.
- [x] Fragmento local ejecuta en navegador (pruebas de escritorio con broker simulado).
- [ ] Primera conexión remota atraviesa MQTT.
- [x] UI muestra ejecutores y asignación.

### Miércoles 28 — integración distribuida

- [ ] Estado agregado visible en colaboradores.
- [ ] Reconexión, deduplicación y cambio de época probados.
- [ ] Matriz de dos o más ejecutores aprobada.
- [x] Tutorial y colaboración mejorada integrados.
- [ ] Three.js consume el adapter acordado o queda documentado como aislado.

### Jueves 29 — hardware, regresión y documentación

- [ ] Ejecutar automatización física completa.
- [ ] Ejecutar demo vial distribuida.
- [ ] Corregir solamente defectos P0.
- [ ] Ejecutar todas las suites y build.
- [ ] Completar informe, registro y guía.

### Viernes 30 — congelación y entrega

- [ ] Ensayo completo desde checkout limpio.
- [ ] Registrar métricas, versiones, commit y checksum.
- [ ] Demostrar pérdida y recuperación de un ejecutor.
- [ ] Congelar código y documentos.
- [ ] Presentar límites reales y trabajo futuro.

## 9. Matriz de aceptación

| Área | Prueba | Criterio |
|---|---|---|
| Particionado | mismo modelo compilado dos veces | fragmentos y rutas idénticos |
| Propiedad | inspeccionar manifiesto | cada elemento ejecutable tiene un propietario |
| Pico | cargar fragmento dirigido | solo la Pico destino lo acepta |
| Browser | ejecutar fixture equivalente | salida coincide con el vector esperado |
| Canal remoto | A publica y B consume | tipo, secuencia y valor correctos, sin duplicado |
| Colaboración | cambiar destino en navegador A | navegador B muestra la misma asignación |
| Reconexión | reiniciar un worker | recupera sesión o exige redespliegue explícito, sin estado fantasma |
| Seguridad vial | cuatro pares y token | nunca hay verdes incompatibles; pérdida implica rojo seguro |
| Física | runner sobre hardware disponible | reporte reproducible sin secretos |
| UX | usuario nuevo sigue tutorial | crea, conecta, asigna y ejecuta un ejemplo mínimo |
| Three.js | abrir/cerrar prototipo | representa el snapshot y libera recursos |
| Calidad | suites, lint, tipos y build | todo aprobado |
| Documentación | revisar informe y registro | decisiones, autores, archivos, pruebas y límites trazables |

### 9.1 Guion de demostración

#### A. Colaboración y asignación

1. Abrir el mismo `?project=<id>` en dos navegadores.
2. Mostrar presencia, cursores y selección remota.
3. Abrir el panel de ejecutores.
4. Asignar Structural Blocks a destinos diferentes.
5. Confirmar que la asignación aparece en todos los colaboradores.

#### B. Despliegue distribuido mínimo

1. Crear dos Structural Blocks conectados.
2. Asignar uno a una Pico y otro a un navegador.
3. Mostrar manifiesto y dos fragmentos.
4. Esperar ACK de ambos workers.
5. Inyectar un valor y observarlo cruzar MQTT.
6. Mostrar el estado agregado sin doble ejecución.

#### C. Varios dispositivos y recuperación

1. Incluir Pico↔Pico si hay dos placas y Pico↔browser obligatoriamente.
2. Reiniciar un worker.
3. Mostrar diagnóstico y recuperación o redespliegue.
4. Publicar un mensaje de época anterior y demostrar su descarte.

#### D. Semáforos distribuidos

1. Mostrar cuatro Structural Blocks independientes.
2. Iniciar todos en rojo.
3. Circular el token y observar el cambio local.
4. Confirmar ausencia de verdes incompatibles.
5. Desconectar un ejecutor y mostrar rojo seguro.

#### E. Experiencia de usuario

1. Completar el tutorial desde un proyecto vacío.
2. Crear, conectar, asignar y ejecutar un ejemplo mínimo.
3. Compartir el enlace y seguir a un colaborador.
4. Provocar un error de destino y seguir la recomendación visual.

#### F. Three.js experimental

1. Abrir la vista experimental.
2. Aplicar un snapshot simulado o real.
3. Mostrar que el carro responde al semáforo.
4. Cerrar la vista y comprobar que libera la animación.

### 9.2 Evidencia requerida

| Evidencia | Responsable | Estado inicial |
|---|---|---|
| Protocolo y particionado | Persona 1 | Hecho: contrato v3, particionador, fixtures y 10 pruebas aprobadas |
| Worker Pico | Persona 2 | Hecho en software: `DistributedWorker`, canales remotos, paridad SHA-256 y 165 pruebas aprobadas (pendiente corrida en placas físicas) |
| Worker browser, colaboración y UX | Persona 3 | Hecho en software: `BrowserWorker`, paridad con la Pico (vector 02), panel de ejecutores, colaboración, tutorial y UX; pendiente ensayo con broker real y usuario nuevo |
| Prototipo Three.js | Persona 4 | Pendiente |
| Automatización física | Persona 5 | Pendiente |
| Pico↔Pico | Personas 2 y 5 | Pendiente según hardware |
| Pico↔browser | Personas 2, 3 y 5 | Pendiente |
| Semáforos distribuidos seguros | Personas 1, 2, 3 y 5 | Pendiente |
| Suites, lint, tipos y build | Persona 5 | Pendiente |
| Informe acumulado en este plan y registro | Persona 5 | En curso |

## 10. Exclusiones de esta entrega

- Broker público de producción.
- Autenticación de usuarios, roles empresariales o permisos persistentes.
- Ejecución distribuida tolerante a particiones de red complejas.
- Migración automática de estado interno de un bloque entre dispositivos activos.
- Elección automática óptima de ejecutor.
- CRDT completo para edición offline prolongada.
- Integración definitiva de Three.js en el producto.
- Soporte para tipos de elemento nuevos fuera del perfil IR v2 actual.

## 11. Riesgos principales

- **Alcance excesivo:** P0 tiene prioridad; Three.js y pulido avanzado no bloquean la demo distribuida.
- **Mensajes atrasados:** usar `deploymentId`, `epoch`, secuencia y deduplicación.
- **Doble ejecución:** propiedad única y rechazo si el fragmento no corresponde al ejecutor.
- **Pérdida de nodo vial:** estado seguro en rojo y token con expiración controlada.
- **Memoria Pico:** fragmentos pequeños, liberación explícita, telemetría y límites antes de aceptar.
- **Confusión colaboración/ejecución:** stores, tópicos y estados visuales separados.
- **Dependencia del navegador que despliega:** manifiesto retenido y workers autónomos durante la ejecución.
- **Cambios cruzados entre integrantes:** propiedad de archivos y handoff obligatorio.

## 12. Documento técnico acumulativo

Este mismo plan funciona como documento maestro de la entrega. Persona 5 debe mantenerlo y agregar resultados comprobados sin convertirlo en una transcripción diaria.

### Historia consolidada del proyecto

- **Entregas iniciales:** presentación visual, editor React Flow, modelo documental y operaciones de archivo.
- **Motor frontend:** propagación de datos, Functional Blocks, Sample/Hold, Petri, conflictos y pruebas TypeScript.
- **MQTT y Pico:** Mosquitto, cliente web, topics, LED remoto, reconexión y configuración local.
- **Runtime MicroPython:** Task, Scheduler, pub/sub, transporte, IR, motor y snapshots oficiales.
- **Entrega del 20 de octubre:** IR v2, Python remoto, canales, retardos, Watchdog, colaboración, presencia, cursores y frontend reorganizado.
- **Cierre físico del 25 de octubre:** flujo navegador → broker → Pico → navegadores confirmado; 153 pruebas firmware y 104 frontend aprobadas en `baadff6`.

### Aportes históricos y responsabilidad actual

| Persona | Aporte confirmado anterior | Responsabilidad del 30 de octubre |
|---|---|---|
| Persona 1 | PythonExecutor, validación, runtime values y Watchdog | Protocolo, manifiesto y particionador |
| Persona 2 | IR v2, compilador, canales y protocolo colaborativo | Worker MicroPython multi-Pico |
| Persona 3 | Motor MicroPython v2, Sample/Hold, retardos y demo general | Worker navegador, colaboración y UX |
| Persona 4 | Topbar, paneles y aprovechamiento del canvas | Prototipo Three.js |
| Persona 5 | Integración, colaboración, cuatro navegadores, empaquetado y guías | Automatización física, integración y documentación |

### Sección que se actualiza por cada persona

Al cerrar un handoff, Persona 5 agregará o actualizará aquí:

1. qué construyó;
2. cómo funciona;
3. archivos y commit;
4. decisiones y motivo;
5. pruebas exactas;
6. evidencia física o visual;
7. errores encontrados;
8. limitaciones y trabajo posterior.

### Glosario mínimo

- **Worker/ejecutor:** proceso Pico o navegador que ejecuta un fragmento.
- **Fragmento:** subconjunto IR propiedad de un ejecutor.
- **Manifiesto:** despliegue con fragmentos, rutas, propietarios y hashes.
- **Época:** versión monotónica que invalida mensajes anteriores.
- **Snapshot parcial:** estado observable de un solo fragmento.
- **Gemelo digital:** representación 3D consumidora del estado del sistema.

## 13. Decisiones pendientes antes de implementar

- [ ] Confirmar cuántas Pico W y computadores estarán disponibles.
- [ ] Confirmar responsables propuestos.
- [ ] Aprobar Structural Block como unidad principal y la sobreescritura por Functional Block.
- [ ] Aprobar token lógico o elegir otro protocolo vial distribuido.
- [ ] Decidir si el worker navegador corre en Web Worker desde P0.
- [ ] Congelar semántica de paso global y barreras entre fragmentos.
- [ ] Definir comportamiento de CCH/DCH durante una reconexión.
- [ ] Confirmar si la demostración será solo LAN o también entre redes distintas.
