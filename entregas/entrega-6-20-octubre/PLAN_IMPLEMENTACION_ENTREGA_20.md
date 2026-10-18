# Plan de implementación — Python en Pico, proyectos compartidos y semáforos distribuidos

**Entrega:** martes 20 de octubre de 2026, hora por confirmar (Colombia)

**Equipo:** cinco personas. Los nombres definitivos deben escribirse en la sección de responsables antes de iniciar el desarrollo.

**Estado del documento:** plan aprobado para iniciar implementación. Todas las actividades nuevas permanecen pendientes hasta que exista código, prueba y evidencia registrada.

## 1. Objetivo de la entrega

Extender la base funcional actual sin reemplazar su arquitectura para demostrar cinco capacidades:

1. El código Python escrito por el usuario en un `Functional Block` se envía a la Raspberry Pi Pico W y se ejecuta con MicroPython dentro de la placa.
2. El runtime remoto alcanza paridad con los elementos ejecutables actuales del editor: `Service`, `Functional Block`, `Sample`, `Hold`, `Place`, `Transition`, CCH, DCH, Petri/LCH y retardos.
3. Un proyecto puede abrirse mediante un enlace `?project=<id>` y reconstruir su documento compartido.
4. Varios navegadores pueden ver presencia, cursores y cambios del canvas en tiempo real.
5. El caso de demostración contiene cuatro semáforos lógicos independientes, cada uno con sensor y FSM propia, coordinados para impedir estados inseguros.

La meta de compatibilidad completa significa que cualquier circuito construido con los elementos y tipos definidos en el perfil remoto debe ejecutar en la Pico con la misma semántica observable que en el motor TypeScript. No significa permitir imports, ciclos infinitos o acceso irrestricto al hardware desde código recibido.

## 2. Aclaración de arquitectura

No se pretende ejecutar Vite, React, Pyodide ni Mosquitto dentro de la Pico.

```text
PC
├── Vite + React + React Flow
├── Pyodide para simulación local
├── Mosquitto
└── Navegadores colaboradores
        │ MQTT sobre WebSockets
        ▼
Raspberry Pi Pico W
├── MicroPython
├── motor HiLeS
├── código Python de Functional Blocks
├── lógica de sensores y semáforos
└── publicación del estado oficial
```

En modo local, Pyodide continúa disponible. En modo remoto, el navegador no ejecuta el Functional Block: envía el modelo y espera la instantánea producida por la Pico.

## 3. Línea base confirmada

Antes de esta entrega ya existen:

- editor React/React Flow y almacenamiento local;
- motor local TypeScript;
- ejecución Python local mediante Pyodide;
- cliente MQTT web sobre WebSockets;
- transporte MQTT/TCP en MicroPython;
- IR v1 y validación compartida;
- motor MicroPython para `Service`, `Functional Block`, `Place` y `Transition`;
- comandos remotos, entradas e instantáneas oficiales;
- control de versión, secuencia y deduplicación;
- scheduler cooperativo;
- demo coordinado Norte–Sur / Este–Oeste;
- 70 pruebas frontend aprobadas y build de producción aprobado el 18 de octubre.

La ejecución de pruebas de firmware queda pendiente en la máquina actual porque Python no está disponible en `PATH`; esto no se registra como fallo funcional.

## 4. Diferencias frente a la entrega anterior

La entrega anterior sincroniza la ejecución de un modelo, pero:

- el código Python de un Functional Block se rechaza al compilar la IR remota;
- la Pico no implementa todavía `Sample`, `Hold`, CCH/DCH diferenciados ni retardos por elemento o conexión;
- los tipos `vector` y `custom` no forman parte del contrato remoto actual;
- `Structural Block` debe aplanarse de forma verificable antes de llegar al motor;
- los cuatro navegadores no comparten todavía la edición del documento;
- no hay presencia ni cursores remotos;
- el demo usa un controlador coordinado único;
- los sensores vehiculares y FSM independientes no forman parte del demo principal;
- la interfaz todavía reserva demasiado espacio para paneles laterales.

## 5. Alcance P0 obligatorio

### 5.1 Python de Functional Blocks ejecutado en la Pico

- [ ] Crear una evolución compatible de la IR que transporte `lenguaje`, `codigo`, entradas y salidas.
- [ ] Mantener lectura de modelos IR v1 existentes.
- [ ] Admitir código Python en forma de expresión o función `calcular(...)`.
- [ ] Compilar el código una sola vez durante la carga del modelo.
- [ ] Ejecutar la función con los valores actuales de los puertos.
- [ ] Admitir un valor simple para una salida y un diccionario para múltiples salidas.
- [ ] Validar tipos de entrada y salida.
- [ ] Publicar errores de carga y ejecución con elemento, código y mensaje.
- [ ] Evitar que un error de un bloque detenga el scheduler completo.
- [ ] Medir duración y memoria en la Pico física.

Perfil Python inicial permitido:

- aritmética, comparaciones y booleanos;
- `if`/`else` acotado;
- literales numéricos, booleanos y de texto;
- `min`, `max`, `abs` y `round`;
- variables correspondientes a los puertos;
- una función pública llamada `calcular`.

Se rechazan en P0:

- `import`;
- `while` y `for`;
- recursión;
- `eval`, `exec`, `open`, `globals` y `locals`;
- nombres `__dunder__`;
- acceso a `machine`, red o archivos;
- código por encima del límite definido en el contrato;
- llamadas a funciones no autorizadas.

Ejemplo esperado:

```python
def calcular(carros, emergencia):
    if emergencia:
        return False
    return carros >= 6
```

### 5.2 Paridad completa del motor remoto

#### Elementos

- [ ] Ejecutar `Service` como entrada, salida y valor inicial tipado.
- [ ] Ejecutar `Functional Block` Python con una o varias entradas y salidas.
- [ ] Ejecutar `Sample` con entrada CCH, activación LCH/control y emisión DCH de un solo evento.
- [ ] Ejecutar `Hold` consumiendo DCH, reteniendo el último valor y publicándolo por CCH.
- [ ] Ejecutar `Place` con tokens iniciales, capacidad y pesos.
- [ ] Ejecutar `Transition` con guarda, retardo, habilitación y disparo atómico.
- [ ] Aplanar `Structural Block` conservando hijos, IDs y conexiones externas e internas.
- [ ] Normalizar `TOKEN` y `TOKEN_FLOW` legados a Petri o rechazarlos con migración explícita.
- [ ] Tratar `PORT` como metadato/conector, no como tarea ejecutable independiente.

#### Canales y eventos

- [ ] Diferenciar explícitamente CCH, DCH y PETRI/LCH en la IR.
- [ ] Implementar CCH continuo con valor actual y propagación determinista.
- [ ] Implementar DCH como evento consumible que no se repite en pasos posteriores.
- [ ] Implementar cola DCH acotada, orden FIFO y política documentada ante desbordamiento.
- [ ] Implementar activación LCH/control para `Sample`, `Hold` y transiciones.
- [ ] Mantener arcos Petri con peso, capacidad, conflicto y movimiento atómico.
- [ ] Mantener orden topológico determinista para el flujo de datos.
- [ ] Detectar ciclos de datos y reportarlos igual que el motor local.
- [ ] Implementar los modos CCH expuestos por el editor (`push`, `pull` y `flag`) o bloquear antes de cargar cualquier modo no ejecutable.

#### Retardos y planificación

- [ ] Transportar `executionDelay` de elementos.
- [ ] Transportar `delay` de conexiones y transiciones.
- [ ] Representar todo retardo mediante tiempo objetivo y estado persistente.
- [ ] Prohibir `sleep` dentro de elementos y callbacks.
- [ ] Procesar una cantidad máxima de eventos y elementos por `update()`.
- [ ] Continuar atendiendo MQTT, LED y colaboración mientras un modelo espera un timer.
- [ ] Definir orden para eventos que vencen en el mismo instante.
- [ ] Cancelar timers pendientes al reiniciar o sustituir el modelo.

#### Tipos y estado

- [ ] Conservar `boolean`, `integer`, `real` y `string`.
- [ ] Agregar `vector` como lista JSON acotada y homogénea.
- [ ] Agregar `custom` como valor JSON acotado en tamaño, profundidad y cantidad de claves.
- [ ] Validar tipos en Services, puertos, bloques, Sample y Hold.
- [ ] Publicar en snapshots valores, salida, valor retenido, evento pendiente, tokens, timers y errores observables.
- [ ] Reiniciar valores, colas, tokens, estados retenidos, timers y errores al estado inicial exacto.

#### Equivalencia web/Pico

- [ ] Crear vectores compartidos para cada elemento y canal.
- [ ] Comparar paso a paso el motor TypeScript y el motor MicroPython.
- [ ] Verificar el mismo estado inicial, eventos, salidas, marcado y errores.
- [ ] Ejecutar automáticamente todos los modelos de `output/` que pertenezcan al perfil remoto.
- [ ] No cerrar la entrega con un elemento ejecutable actual sin una decisión y prueba explícitas.

### 5.3 Proyecto compartido por URL

- [ ] Leer y validar `?project=<id>` al iniciar la aplicación.
- [ ] Crear un ID compartible cuando no exista uno.
- [ ] Incorporar una acción visible para copiar el enlace.
- [ ] Separar el autoguardado local por proyecto.
- [ ] Publicar un snapshot retenido del documento.
- [ ] Reconstruir el proyecto al abrir el enlace desde otro navegador.
- [ ] Aislar estrictamente proyectos con IDs distintos.
- [ ] No incluir credenciales ni datos sensibles en la URL.

Formato inicial de ID:

```text
[A-Za-z0-9_-]{1,48}
```

### 5.4 Edición y presencia en tiempo real

- [ ] Generar un `clientId` único por pestaña.
- [ ] Publicar presencia con heartbeat y expiración.
- [ ] Mostrar nombre y color de cada participante.
- [ ] Publicar cursores del canvas con limitación de frecuencia.
- [ ] Sincronizar creación, movimiento, actualización y eliminación de nodos.
- [ ] Sincronizar creación, actualización y eliminación de conexiones.
- [ ] Incluir `operationId`, `clientId`, versión y reloj lógico.
- [ ] Evitar el eco de operaciones propias.
- [ ] Usar tombstones para eliminaciones.
- [ ] Resolver conflictos por última operación válida por elemento.
- [ ] Mostrar edición activa o bloqueo temporal en propiedades/código.
- [ ] Reconstruir estado después de una reconexión.

La entrega no promete un CRDT de texto completo. Si dos personas intentan modificar simultáneamente el mismo código, se usa bloqueo temporal o última escritura válida y se informa visualmente.

### 5.5 Cuatro semáforos inteligentes independientes

- [ ] Sustituir el controlador visual único por cuatro controladores lógicos.
- [ ] Crear nodos Norte, Sur, Este y Oeste con estado local.
- [ ] Asociar un sensor de presencia a cada nodo.
- [ ] Implementar la FSM `ROJO → VERDE → AMARILLO → ROJO`.
- [ ] Impedir cualquier transición directa `VERDE → ROJO` durante operación normal.
- [ ] Agregar tiempo mínimo y máximo de verde.
- [ ] Agregar tiempo fijo de amarillo.
- [ ] Incorporar intervalo seguro de todo rojo entre direcciones conflictivas.
- [ ] Definir matriz de conflictos.
- [ ] Implementar solicitud, permiso y liberación de paso.
- [ ] Resolver empates de manera determinista.
- [ ] Evitar inanición de una dirección con demanda continua.
- [ ] Volver a rojo ante entrada inválida, error o pérdida de coordinación.
- [ ] Mantener el modelo dentro de los límites de elementos, conexiones y payload.

Los cuatro controladores son independientes en estado, sensor y FSM, pero se comunican para conservar la seguridad del cruce. No se afirma que existan cuatro placas físicas.

### 5.6 Rediseño UI/UX

- [ ] Crear una TopBar compacta.
- [ ] Agrupar archivo, edición, simulación, conexión y compartir.
- [ ] Convertir paleta, inspector y simulación en docks colapsables.
- [ ] Convertir MQTT en popover o panel compacto.
- [ ] Mostrar proyecto, conexión, ejecución y participantes.
- [ ] Reservar la mayor parte de la ventana para el canvas.
- [ ] Mantener importación, exportación, undo/redo y nuevo proyecto.
- [ ] Validar layout en 1366 × 768.

### 5.7 Pruebas y documentación

- [ ] Ejecutar pruebas frontend, TypeScript, lint y build.
- [ ] Ejecutar pruebas de firmware en escritorio.
- [ ] Ejecutar vectores compartidos web/MicroPython.
- [ ] Ejecutar matriz de paridad de `Service`, `Functional Block`, `Sample`, `Hold`, `Place` y `Transition`.
- [ ] Ejecutar matriz de CCH, DCH, PETRI/LCH, timers, reset y errores.
- [ ] Probar `boolean`, `integer`, `real`, `string`, `vector` y `custom` dentro de sus límites.
- [ ] Probar cola DCH, orden FIFO y desbordamiento.
- [ ] Probar que los retardos no bloquean MQTT ni las demás tareas del scheduler.
- [ ] Probar el flujo con cuatro navegadores.
- [ ] Probar el flujo en la Pico W física.
- [ ] Medir memoria libre antes y después de cargar el demo.
- [ ] Medir tiempo máximo de ejecución de un Functional Block.
- [ ] Probar código Python inválido y bloqueante.
- [ ] Probar reconexión de un navegador.
- [ ] Probar aislamiento entre dos `projectId`.
- [ ] Registrar por integrante los cambios, pruebas y pendientes en `REGISTRO_CAMBIOS.md`.
- [ ] Realizar ensayo cronometrado de la presentación.

## 6. Fuera de alcance

- Ejecutar Vite, React, Pyodide o Mosquitto en la Pico.
- Ejecutar JavaScript dentro de la Pico.
- Permitir Python arbitrario sin restricciones.
- Permitir ciclos infinitos o tareas bloqueantes.
- Acceso directo desde Functional Blocks recibidos a `machine`, Wi-Fi, MQTT o archivos.
- CRDT completo para edición carácter por carácter.
- Persistencia histórica en una base de datos.
- Autenticación y permisos de usuarios finales.
- Acceso por Internet sin infraestructura adicional.
- Cuatro Picos físicas, salvo que el equipo consiga y configure las placas.

## 7. Contrato propuesto para Functional Block remoto

Ejemplo conceptual de IR:

```json
{
  "id": "fb-decision",
  "tipo": "functional_block",
  "nombre": "Decidir paso",
  "habilitado": true,
  "lenguaje": "python",
  "codigo": "def calcular(carros):\n    return carros >= 6",
  "entradas": [
    { "puerto": "carros-in", "variable": "carros", "tipo_dato": "integer" }
  ],
  "salidas": [
    { "puerto": "decision-out", "variable": "decision", "tipo_dato": "boolean" }
  ]
}
```

El contrato final debe definir:

- versión de IR;
- tamaño máximo de código por bloque;
- cantidad máxima de bloques con código;
- nombres válidos de variables;
- forma de retorno para una o varias salidas;
- códigos de error;
- comportamiento ante resultado `None`;
- momento de compilación y ejecución;
- límites de tiempo y memoria;
- compatibilidad con expresiones simples antiguas.
- representación de `Sample`, `Hold`, CCH, DCH y Petri/LCH;
- semántica de `executionDelay` y `delay`;
- límites de cola DCH;
- serialización acotada de `vector` y `custom`;
- campos observables de snapshot y reglas exactas de reinicio.

## 8. Topics conceptuales por proyecto

```text
udfjc/hiles/v2/projects/<projectId>/document/snapshot
udfjc/hiles/v2/projects/<projectId>/document/ops
udfjc/hiles/v2/projects/<projectId>/presence/<clientId>
udfjc/hiles/v2/projects/<projectId>/runtime/model/load
udfjc/hiles/v2/projects/<projectId>/runtime/model/confirmation
udfjc/hiles/v2/projects/<projectId>/runtime/command
udfjc/hiles/v2/projects/<projectId>/runtime/input
udfjc/hiles/v2/projects/<projectId>/runtime/state
udfjc/hiles/v2/projects/<projectId>/runtime/error
```

Política:

- snapshot y estado oficial: retenidos;
- operaciones, cursores y comandos: no retenidos;
- presencia: retained con mensaje vacío o estado offline al salir, más expiración local;
- todos los mensajes mutables incluyen proyecto y emisor;
- los comandos mantienen deduplicación mediante `id_mensaje`.

## 9. División estricta entre cinco personas

### Persona 1 — Core Pico, Scheduler/Task y ejecución Python

**Responsable nominal:** por confirmar.

**No depende de ninguna persona.**

Responsabilidades:

- cerrar el contrato IR para código Python;
- reforzar `Task` y `Scheduler` para cargas del motor, timers y presupuestos;
- definir colas acotadas, métricas, watchdog lógico y política de sobrepasos;
- implementar validador del perfil Python;
- compilar/cargar funciones durante `modelo/cargar`;
- ejecutar `calcular` en MicroPython;
- validar resultados y manejar errores;
- entregar una API de timers no bloqueantes para Persona 3;
- parametrizar topics en el firmware;
- mantener compatibilidad con la IR anterior.

Archivos propios que puede modificar:

```text
docs/mqtt/IR_V2.md
docs/mqtt/CONTRATO_MENSAJES_MQTT.md
docs/mqtt/vectores_ir_v2/**
firmware/pico/hiles/python_executor.py
firmware/pico/hiles/engine_task.py
firmware/pico/core/task.py
firmware/pico/core/scheduler.py
firmware/pico/core/clock.py
firmware/pico/pubsub/topics.py
firmware/tests/test_python_executor.py
firmware/tests/test_task_runtime_budget.py
firmware/tests/test_scheduler_timers.py
firmware/tests/test_engine_task_v2.py
```

Entregables:

- IR v2 congelada;
- ejecutor Python real en MicroPython;
- scheduler preparado para timers, colas y presupuestos del motor completo;
- códigos de error documentados;
- vectores válidos e inválidos;
- pruebas de compatibilidad y restricciones;
- entrada completa de Persona 1 en `REGISTRO_CAMBIOS.md`.

Criterio de terminación:

Un modelo enviado por MQTT con código Python válido cambia su salida únicamente después de ser ejecutado por la Pico. Código prohibido se rechaza sin reemplazar el modelo activo ni detener el scheduler, y una tarea lenta no impide que las demás tareas sigan siendo atendidas.

### Persona 2 — Protocolo web, URL y estado unificado

**Responsable nominal:** por confirmar.

**Solo depende de Persona 1.**

Responsabilidades:

- reflejar la IR v2 en TypeScript;
- dejar de descartar código Python remoto;
- compilar `Sample`, `Hold`, Services, Petri y Structural Blocks a la IR completa;
- conservar la naturaleza CCH, DCH y PETRI/LCH de cada conexión;
- transportar retardos de elementos, transiciones y conexiones;
- validar y serializar `vector` y `custom` con los límites acordados;
- ampliar el validador web y los mensajes MQTT para el estado completo;
- actualizar el motor TypeScript de referencia para tipos, colas DCH y retardos que todavía no estén materializados;
- conservar una única semántica local documentada contra la cual comparar MicroPython;
- crear topics parametrizados por proyecto;
- implementar lectura y creación de `projectId`;
- implementar snapshot y operaciones de documento;
- separar autoguardado por proyecto;
- administrar versión, reloj lógico y reconexión.

Archivos propios que puede modificar:

```text
frontend/src/services/ir/tiposIr.ts
frontend/src/services/ir/compiladorIr.ts
frontend/src/services/ir/validadorIr.ts
frontend/src/services/ir/expresiones.ts
frontend/src/services/ir/ir.test.ts
frontend/src/services/mqtt/config.ts
frontend/src/services/mqtt/messages.ts
frontend/src/services/mqtt/MqttClient.ts
frontend/src/services/mqtt/RemoteExecutionClient.ts
frontend/src/services/mqtt/*.test.ts
frontend/src/services/projects/projectUrl.ts
frontend/src/services/projects/projectTopics.ts
frontend/src/services/projects/ProjectSyncClient.ts
frontend/src/services/projects/*.test.ts
frontend/src/stores/useProjectStore.ts
frontend/src/stores/useEditorStore.ts
frontend/src/stores/useEditorStore.test.ts
frontend/src/engine/tipos.ts
frontend/src/engine/MotorSimulacion.ts
frontend/src/engine/GrafoDatos.ts
frontend/src/engine/BusObserver.ts
frontend/src/engine/elementos/interfaces.ts
frontend/src/engine/elementos/ElementoService.ts
frontend/src/engine/elementos/ElementoBloqueFuncional.ts
frontend/src/engine/elementos/ElementoMuestreo.ts
frontend/src/engine/elementos/ElementoRetencion.ts
frontend/src/engine/elementos/ElementoLugar.ts
frontend/src/engine/elementos/ElementoTransicion.ts
frontend/src/engine/__tests__/**
```

Inputs recibidos de Persona 1:

- IR v2 y vectores;
- lista de operaciones Python autorizadas;
- códigos de error;
- límites de payload;
- convención de topics.

Entregables:

- compilador web compatible con MicroPython;
- IR completa para todos los elementos ejecutables actuales;
- validación de canales, retardos y tipos antes de publicar;
- motor TypeScript de referencia con la semántica completa usada por los vectores;
- enlace compartible;
- carga inicial por snapshot;
- transporte de operaciones;
- aislamiento entre proyectos;
- entrada completa de Persona 2 en `REGISTRO_CAMBIOS.md`.

Criterio de terminación:

Dos navegadores con el mismo enlace cargan el mismo documento y pueden enviar a la Pico un modelo completo con Python, conversores, canales, Petri y retardos. Proyectos diferentes no reciben datos cruzados.

### Persona 3 — Motor remoto completo y dominio de semáforos

**Responsable nominal:** por confirmar.

**Solo puede depender de Personas 1 y 2.**

Responsabilidades:

- implementar en MicroPython todos los elementos de la IR v2;
- diferenciar CCH, DCH y PETRI/LCH durante la ejecución;
- implementar `Sample` y `Hold` con estado y eventos correctos;
- implementar retardos mediante la API no bloqueante de Persona 1;
- implementar colas DCH, reset completo y snapshots observables;
- integrar el ejecutor Python de Persona 1 dentro del Functional Block;
- soportar valores escalares, `vector` y `custom` acotados;
- reproducir los vectores de conformidad entregados por Personas 1 y 2;
- crear cuatro FSM independientes;
- modelar sensores, solicitudes y permisos;
- definir tiempos y matriz de conflictos;
- generar el nuevo JSON de demostración;
- integrar sensores simulados y adaptadores GPIO opcionales;
- probar seguridad, equidad y fail-safe.

Archivos propios que puede modificar:

```text
scripts/generate-distributed-traffic-demo.mjs
output/demo-4-semaforos-inteligentes.json
firmware/pico/hiles/model.py
firmware/pico/hiles/elements.py
firmware/pico/hiles/engine.py
firmware/pico/hiles/channels.py
firmware/pico/hiles/converters.py
firmware/pico/hiles/timers.py
firmware/pico/devices/traffic_controller.py
firmware/pico/devices/vehicle_sensor_task.py
firmware/pico/platform/hardware.py
firmware/pico/config_local.example.py
firmware/pico/main.py
firmware/tests/test_traffic_controller.py
firmware/tests/test_hiles_model_v2.py
firmware/tests/test_hiles_engine_v2.py
firmware/tests/test_hiles_channels.py
firmware/tests/test_hiles_converters.py
firmware/tests/test_hiles_delays.py
docs/traffic/PROTOCOLO_SEMAFOROS.md
docs/traffic/MATRIZ_CONFLICTOS.md
```

Inputs recibidos:

- executor Python, timers, Task y Scheduler de Persona 1;
- IR y topics de Personas 1 y 2;
- API de inyección y estado de Persona 2.

Entregables:

- motor MicroPython con paridad funcional del perfil remoto;
- `Sample`, `Hold`, CCH, DCH, Petri/LCH y retardos ejecutables;
- tipos y snapshots completos;
- demo generado, no editado manualmente;
- cuatro FSM;
- simulador de sensores;
- pruebas de invariantes;
- tabla de GPIO si se usa hardware;
- entrada completa de Persona 3 en `REGISTRO_CAMBIOS.md`.

Criterio de terminación:

Todos los vectores de paridad web/Pico aprueban y todos los modelos compatibles del editor ejecutan sin reglas específicas del ejemplo. Además, cada dirección responde a su propio sensor, siempre recorre verde, amarillo y rojo, y nunca comparte verde con una dirección conflictiva.

### Persona 4 — UI/UX y shell del editor

**Responsable nominal:** por confirmar.

**Solo puede depender de Personas 1, 2 y 3.**

Responsabilidades:

- crear TopBar y docks colapsables;
- liberar espacio del canvas;
- mostrar estado de proyecto, conexión y ejecución;
- exponer y validar propiedades remotas de `Sample`, `Hold`, retardos, tipos y canales;
- indicar antes de cargar si una propiedad no cumple el perfil remoto;
- preparar slots visuales para presencia;
- conservar todas las acciones actuales.

Archivos propios que puede modificar:

```text
frontend/src/features/editor/Editor.tsx
frontend/src/features/editor/editor.css
frontend/src/features/editor/Palette.tsx
frontend/src/features/editor/PropertiesPanel.tsx
frontend/src/features/simulation/SimulationPanel.tsx
frontend/src/features/simulation/simulation.css
frontend/src/features/mqtt/MqttPanel.tsx
frontend/src/features/mqtt/mqtt.css
frontend/src/features/shell/TopBar.tsx
frontend/src/features/shell/ToolDock.tsx
frontend/src/features/shell/InspectorDock.tsx
frontend/src/features/shell/StatusBar.tsx
frontend/src/features/shell/shell.css
```

Inputs recibidos:

- estados del runtime de Persona 1;
- API de proyecto de Persona 2;
- nombres y estados del demo de Persona 3.

Entregables:

- shell moderno y responsivo;
- paneles colapsables;
- acción de compartir visible;
- estados visuales de conexión y ejecución;
- edición completa de las propiedades requeridas por la IR v2;
- entrada completa de Persona 4 en `REGISTRO_CAMBIOS.md`.

Criterio de terminación:

En 1366 × 768 el canvas ocupa la mayor parte de la ventana y todas las acciones existentes siguen accesibles.

### Persona 5 — Colaboración, integración y cierre

**Responsable nominal:** por confirmar.

**Solo puede depender de Personas 1, 2, 3 y 4.**

Responsabilidades:

- integrar la sesión de proyecto con la aplicación;
- implementar presencia y cursores;
- aplicar operaciones remotas al canvas sin eco;
- integrar componentes visuales de Persona 4;
- probar cuatro navegadores y Pico física;
- ejecutar la matriz E2E de todos los elementos, canales, tipos y retardos;
- comprobar que en modo remoto no se produce cálculo paralelo en TypeScript/Pyodide;
- completar la integración, las pruebas y el registro final.

Archivos propios que puede modificar:

```text
frontend/src/App.tsx
frontend/src/features/editor/Canvas.tsx
frontend/src/features/collaboration/CollaborationController.tsx
frontend/src/features/collaboration/PresenceList.tsx
frontend/src/features/collaboration/RemoteCursors.tsx
frontend/src/features/collaboration/collaboration.css
frontend/src/features/collaboration/*.test.tsx
scripts/test-project-collaboration.mjs
scripts/test-mqtt-four-clients.mjs
scripts/test-remote-engine-parity.mjs
entregas/entrega-6-20-octubre/GUIA_DEMO.md
```

Inputs recibidos:

- runtime Pico validado;
- ProjectSyncClient y contrato web;
- demo distribuido;
- shell visual terminado;
- entradas verificables de las cuatro personas anteriores en el registro de cambios.

Entregables:

- colaboración integrada;
- evidencia multiinstancia;
- prueba E2E;
- matriz final de paridad local/remota;
- guía de demostración actualizada;
- resultados finales y evidencias registrados en `REGISTRO_CAMBIOS.md`.

Criterio de terminación:

Cuatro navegadores con el mismo enlace muestran presencia, cambios del documento y el mismo estado oficial calculado por la Pico.

## 10. Regla de archivos y merges

- Cada archivo tiene un único dueño durante la implementación.
- Nadie modifica archivos de una persona posterior para “adelantar integración”.
- Si un contrato debe cambiar, se registra primero en `REGISTRO_CAMBIOS.md`.
- Cada persona agrega su propia entrada al registro después de terminar y probar su unidad.
- Persona 5 agrega el cierre de integración sin reescribir las entradas ajenas.
- Cada merge debe contener una unidad comprobable.
- No se marcan casillas por código parcial o infraestructura preparatoria.

Orden de integración:

```text
Persona 1: contrato y runtime Pico
        ↓
Persona 2: espejo web, URL y transporte de documento
        ↓
Persona 3: dominio de semáforos
        ↓
Persona 4: shell visual
        ↓
Persona 5: colaboración, E2E y cierre
```

## 11. Cronograma

### Domingo 18 de octubre — contrato y esqueletos

- [ ] Confirmar nombres de responsables.
- [ ] Congelar IR v2, perfil Python y topics.
- [ ] Crear esqueletos sin lógica duplicada.
- [ ] Definir casos de aceptación y fixtures.
- [ ] Congelar propiedad de archivos.

### Lunes 19, mañana — implementación base

- [ ] Persona 1 completa ejecución Python y pruebas.
- [ ] Persona 2 completa compilador, URL y snapshot.
- [ ] Persona 3 prepara modelo y pruebas a partir del contrato congelado.
- [ ] Persona 4 desarrolla shell usando las interfaces congeladas.

### Lunes 19, tarde — integración funcional

- [ ] Integrar Personas 1 y 2.
- [ ] Ejecutar Functional Block Python en runtime MicroPython de escritorio.
- [ ] Integrar demo de Persona 3.
- [ ] Integrar shell de Persona 4.
- [ ] Persona 5 conecta presencia, cursores y operaciones.
- [ ] Ejecutar suites completas.

### Lunes 19, noche — validación física y congelación

- [ ] Copiar firmware a la Pico.
- [ ] Probar código Python real en la placa.
- [ ] Probar cuatro navegadores.
- [ ] Medir memoria, latencia y tiempos.
- [ ] Corregir únicamente defectos P0.
- [ ] Congelar funcionalidad.

### Martes 20 — entrega

- [ ] Repetir pruebas sin agregar funcionalidades.
- [ ] Verificar red, broker, IP, credenciales locales y Pico.
- [ ] Abrir enlace desde cuatro navegadores.
- [ ] Ejecutar guion completo.
- [ ] Completar el registro de cambios y resultados.
- [ ] Crear tag o commit final de entrega.

## 12. Criterios globales de aceptación

- [ ] El frontend compila y sus pruebas aprueban.
- [ ] Las pruebas del firmware aprueban.
- [ ] El código escrito en un Functional Block se ejecuta en la Pico, no en Pyodide, cuando el modo remoto está activo.
- [ ] `Service`, `Functional Block`, `Sample`, `Hold`, `Place` y `Transition` ejecutan en la Pico.
- [ ] CCH, DCH y PETRI/LCH conservan semánticas distintas y verificadas.
- [ ] `executionDelay` y `delay` se cumplen sin bloquear el scheduler.
- [ ] `Structural Block` se aplana sin perder conexiones ni IDs.
- [ ] Los eventos DCH se consumen una vez y mantienen orden FIFO.
- [ ] `boolean`, `integer`, `real`, `string`, `vector` y `custom` se validan según el contrato.
- [ ] Reiniciar limpia valores, colas, timers, estados retenidos, tokens y errores.
- [ ] Los vectores compartidos producen el mismo resultado en TypeScript y MicroPython.
- [ ] MQTT, LED y colaboración continúan funcionando mientras existen timers pendientes.
- [ ] Un código Python inválido se rechaza sin bloquear la placa.
- [ ] El navegador muestra el error remoto de manera legible.
- [ ] Un enlace de proyecto reconstruye el documento en otro navegador.
- [ ] Cuatro navegadores muestran participantes y cursores.
- [ ] Una edición válida aparece en los otros navegadores.
- [ ] La Pico continúa siendo la única fuente del estado de ejecución remota.
- [ ] Los cuatro semáforos tienen FSM y sensores independientes.
- [ ] No existe verde simultáneo en direcciones conflictivas.
- [ ] Toda transición normal cumple verde → amarillo → rojo.
- [ ] Un fallo lleva el sistema a rojo.
- [ ] No hay credenciales reales en Git.
- [ ] Cada integrante completó su entrada verificable en el registro.
- [ ] El cierre del registro contiene comandos, resultados y pendientes reales.

## 13. Riesgos y contingencias sin recortar P0

| Riesgo | Señal | Prevención | Acción de contingencia |
|---|---|---|---|
| Código Python bloqueante | Pico deja de publicar | Validación estricta, sin ciclos ni recursión | Rechazar el modelo y conservar el último modelo válido |
| Falta de RAM | reinicio o `MemoryError` | límites medidos por modelo, bloque y cola | Rechazar antes de activar y publicar memoria requerida/disponible |
| Cola DCH saturada | eventos descartados | capacidad y consumo acotados por `update()` | entrar en error seguro y reportar elemento/conexión responsable |
| Colisiones de edición | nodos saltan o reaparecen | operation ID, reloj lógico y tombstones | bloquear temporalmente el elemento en conflicto |
| Payload demasiado grande | carga rechazada | medir JSON antes de publicar | rechazar con diagnóstico; no truncar silenciosamente |
| Latencia de cursores | saturación MQTT | throttling y QoS 0 | bajar frecuencia conservando edición y presencia |
| FSM insegura | verdes conflictivos | matriz y pruebas de invariantes | detener ejecución y llevar los cuatro nodos a rojo |
| Integración tardía | conflictos de archivos | propiedad exclusiva y contratos congelados | posponer adornos visuales, nunca semántica del motor ni seguridad |
| Pico física no disponible | no hay evidencia hardware | reservar placa y ventana de ensayo desde el día 18 | registrar bloqueo; no afirmar validación física |

## 14. Guion resumido de la demostración

1. Mostrar el enlace con `projectId`.
2. Abrir el mismo enlace en cuatro navegadores.
3. Mostrar participantes y cursores.
4. Crear o mover un elemento y comprobar sincronización.
5. Abrir un Functional Block y mostrar su código Python.
6. Activar modo remoto y cargar el modelo.
7. Inyectar una entrada y demostrar que la respuesta llega desde la Pico.
8. Cambiar el código, recargar y observar un resultado diferente.
9. Ejecutar un ejemplo prohibido y mostrar el rechazo seguro.
10. Activar sensores de los cuatro semáforos.
11. Recorrer verde, amarillo y rojo.
12. Mostrar que direcciones conflictivas nunca quedan verdes simultáneamente.
13. Cerrar un navegador y comprobar expiración de presencia.
14. Mostrar pruebas y mediciones de memoria/latencia registradas.

