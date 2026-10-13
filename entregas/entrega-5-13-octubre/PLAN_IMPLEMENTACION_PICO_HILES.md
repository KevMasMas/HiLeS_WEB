# Plan de implementación — ejecución remota HiLeS con PicoROS y MQTT

**Entrega:** martes 13 de octubre de 2026, 10:00 a. m. (hora de Colombia)

**Equipo:** cinco personas; responsables registrados para Personas 1, 2, 3 y 4; asignación de Persona 5 pendiente por el grupo

**Estado actual:** núcleo cooperativo, LED no bloqueante, pub/sub interno, transporte MQTT modular, reconexión, contrato, IR, motor HiLeS MicroPython, `EngineTask`, composición en `main.py`, cliente remoto web y cruce coordinado implementados y probados en escritorio; la prueba física y la demostración manual de cuatro navegadores todavía están pendientes.

## Objetivo no negociable

Implementar una primera ejecución remota y general de circuitos HiLeS en MicroPython. La aplicación web continuará siendo el editor y la interfaz visual, pero la Raspberry Pi Pico W será la fuente oficial del estado cuando se seleccione la ejecución remota.

La demostración utilizará un cruce con cuatro semáforos dentro de un mismo proyecto HiLeS. Cuatro navegadores cargarán ese proyecto, se conectarán al mismo broker y reflejarán las instantáneas publicadas por la Pico. Una acción enviada desde cualquiera de ellos deberá producir, después de ser procesada por la Pico, la misma actualización en los cuatro canvas.

La solución debe ser general: el semáforo es el caso de demostración, no una regla fija dentro del motor.

## Resultado mínimo de la demostración

```text
Navegador 1 ─┐
Navegador 2 ─┼── MQTT/WebSockets ── Mosquitto ── MQTT/TCP ── Pico W
Navegador 3 ─┤                                            │
Navegador 4 ─┘                                            ▼
                                            Scheduler + tareas + motor HiLeS
```

Flujo esperado:

1. Los cuatro navegadores cargan el mismo documento HiLeS.
2. Un navegador compila el documento a una representación intermedia, o IR, y lo publica en `modelo/cargar`.
3. La Pico valida y carga el modelo sin depender de nombres propios del ejemplo.
4. Un navegador envía una entrada o un comando.
5. La tarea MQTT entrega el JSON al pub/sub interno.
6. La tarea del motor ejecuta un paso breve y no bloqueante.
7. La Pico publica una instantánea oficial en `simulacion/estado`.
8. Los cuatro navegadores aplican esa instantánea al canvas sin recalcularla localmente.

## Decisiones de arquitectura

### Monolito modular en la Pico

La Pico ejecutará un solo programa MicroPython dividido en módulos pequeños. No se usarán microservicios dentro de la placa.

```text
firmware/pico/
├── main.py
├── config_local.example.py
├── core/
│   ├── task.py
│   ├── scheduler.py
│   └── clock.py
├── pubsub/
│   ├── node.py
│   ├── mqtt_transport.py
│   └── topics.py
├── hiles/
│   ├── expressions.py
│   ├── model.py
│   ├── elements.py
│   ├── engine.py
│   └── engine_task.py
├── devices/
│   ├── led_task.py
│   └── traffic_light_task.py
├── platform/
│   ├── hardware.py
│   ├── wifi.py
│   └── mqtt_client.py
└── examples/
```

Las carpetas se crearán únicamente cuando aparezca su primer módulo real. Todos los paquetes MicroPython deberán incluir su `__init__.py`.

### Multitarea cooperativa

- Toda tarea periódica hereda de `Task` e implementa `update()`.
- `Scheduler` ejecuta solamente las tareas cuyo periodo haya vencido.
- Un `update()` debe terminar rápidamente.
- No se permiten esperas largas ni ciclos de titilado con `sleep` dentro de una tarea.
- Los retardos se representan mediante estado, contador y siguiente instante de ejecución.
- Si una tarea falla, el error se informa sin detener las demás tareas siempre que sea seguro continuar.

Ejemplo del LED:

```text
callback MQTT: cambia estado a TITILANDO y retorna
LedTask.update(): cada 300 ms invierte el LED
después de 6 cambios: apaga el LED y pasa a APAGADO
```

### Pub/sub interno y externo

- `Node` administra topics y callbacks internos.
- `MqttTransport`, que también es una tarea, conecta `Node` con Mosquitto.
- Un mensaje MQTT entrante se valida, se convierte desde JSON y se publica dentro de `Node`.
- Un componente interno publica mediante `Node`; el transporte decide cómo enviarlo al broker.
- La lógica del LED y del motor no importa directamente `MQTTClient`.

### Fuente oficial del estado

- Los navegadores pueden enviar comandos.
- La Pico decide el resultado de una ejecución remota.
- Los cuatro navegadores se suscriben al mismo `simulacion/estado`.
- Los navegadores no ejecutan paralelamente el motor TypeScript cuando el modo Pico está activo.
- Esta entrega sincroniza la ejecución, no la edición colaborativa del diagrama.

## Organización permanente del repositorio

```text
frontend/                 aplicación web y compilador a IR
firmware/                 programa MicroPython y pruebas sin hardware
infrastructure/mosquitto/ configuración del broker
docs/mqtt/                contrato MQTT y ficha vigentes
output/                   modelos HiLeS exportados
entregas/                 planes, registros e informes por fecha
```

El código reutilizable no debe volver a guardarse dentro de `entregas/`.

## Línea base disponible

Antes de esta entrega ya existen:

- cliente MQTT web sobre WebSockets;
- conexión de la Pico por MQTT/TCP en el ejemplo anterior;
- control físico del LED y publicación de su estado;
- puente entre MQTT y un `Service` del motor local;
- contrato preliminar de carga, comandos e instantáneas;
- motor HiLeS local en TypeScript;
- modelo visual con cuatro bloques de semáforo independientes.

El scheduler integra LED, transporte MQTT y `EngineTask`; la web cuenta con compilador a IR y modo remoto integrado; y el modelo visual coordina los cuatro sentidos sin reglas de semáforo dentro del motor. Falta validar el conjunto en la Pico física y ejecutar el ensayo manual de cuatro navegadores.

> Actualización del 12 de octubre: el compilador a IR (Persona 4), el motor MicroPython con `EngineTask` (Persona 3) y su integración en `main.py` están implementados y probados en escritorio.

## Alcance P0 obligatorio

### Organización y contrato

- [x] Crear la estructura modular mínima de `firmware/pico/`.
- [x] Actualizar todas las rutas documentales después de la reorganización.
- [x] Cerrar la IR versión 1 antes de implementar el motor.
- [x] Definir un identificador de sesión o ejecución compartido por los cuatro navegadores (`modelo_id` + `version`, compartidos también mediante la URL).
- [x] Definir reglas de `modelo_id`, `version`, `secuencia` e `id_mensaje`.
- [x] Mantener credenciales reales fuera de Git; `.env.local` y `config_local.py` están ignorados y no hay credenciales rastreadas.

### Multitarea y pub/sub

- [x] Implementar `Task` con periodo, prioridad, nombre y próxima ejecución.
- [x] Implementar `Scheduler` usando `ticks_ms`, `ticks_add` y `ticks_diff`.
- [x] Garantizar que toda subclase concreta de `Task` implemente `update()`.
- [x] Implementar `Node` con suscripción, desuscripción y publicación local.
- [x] Implementar `MqttTransport` como tarea periódica no bloqueante.
- [x] Enrutar mensajes externos hacia callbacks internos.
- [x] Enrutar publicaciones internas hacia MQTT sin acoplar el motor al cliente.
- [x] Evitar que un callback defectuoso elimine silenciosamente una suscripción válida.

### Demostrador de LED no bloqueante

- [x] Implementar los estados `APAGADO`, `ENCENDIDO` y `TITILANDO`.
- [x] Hacer que el callback solamente valide la orden y cambie el estado deseado.
- [x] Realizar el titilado mediante ejecuciones periódicas de `update()`.
- [x] Confirmar que MQTT y las demás tareas continúan ejecutándose durante el titilado.
- [x] Publicar estado y error mediante JSON válido.

### Motor HiLeS MicroPython

- [x] Cargar y validar una IR sin usar `eval`.
- [x] Implementar inicialmente `Service`, `Functional Block`, `Place` y `Transition`.
- [x] Implementar conexiones continuas y flujo de tokens necesarios para el demo.
- [x] Ejecutar un paso de manera acotada y no bloqueante.
- [x] Respetar capacidad, peso y movimiento atómico de tokens.
- [x] Implementar `reiniciar` a partir del estado inicial del modelo.
- [x] Publicar instantáneas con modelo, versión y secuencia (en `Node`; el envío al broker depende de `MqttTransport`).
- [x] Rechazar elementos u operaciones no soportados con un error legible.

### Web y cuatro navegadores

- [x] Implementar el compilador `HilesModelDocument → IR v1`.
- [x] Agregar selección entre ejecución local y ejecución en Pico.
- [x] Publicar el modelo y esperar `modelo/confirmacion`.
- [x] Enviar entradas y comandos con `id_mensaje` único.
- [x] Aplicar `simulacion/estado` al canvas sin ejecutar el motor local.
- [x] Integrar en el cliente remoto el descarte de instantáneas de otra sesión, versión o secuencia anterior.
- [ ] Confirmar que cuatro navegadores reciben el mismo estado oficial.
- [x] Definir qué navegador carga el modelo y cómo los demás se incorporan a la sesión: uno pulsa «Compilar y cargar» y los demás abren el enlace y pulsan «Unirse».
- [x] Mostrar conexión, carga, error y última secuencia recibida.

### Semáforo coordinado

- [x] Convertir los cuatro bloques independientes en sentidos Norte, Sur, Este y Oeste.
- [x] Agrupar fases compatibles Norte–Sur y Este–Oeste.
- [x] Garantizar mediante prueba automática que fases incompatibles nunca estén verdes simultáneamente.
- [x] Representar rojo, amarillo y verde mediante Places del modelo, no mediante reglas especiales del motor.
- [x] Preparar una entrada booleana controlada que habilita el ciclo.
- [ ] Verificar que una acción iniciada en un navegador aparece en los otros tres después de la respuesta de la Pico.

### Pruebas sin la Pico

- [x] Crear `FakeClock` para avanzar el tiempo sin esperas reales.
- [x] Crear `FakeLed` para observar cambios de GPIO.
- [x] Crear `FakeTransport` para publicar y recibir sin broker.
- [x] Probar periodos, prioridades y tareas vencidas del scheduler.
- [x] Probar que un titilado no bloquea otra tarea.
- [x] Probar callbacks y aislamiento entre topics internos.
- [x] Probar carga válida e inválida de la IR.
- [x] Probar movimiento de tokens y límites de capacidad.
- [x] Probar orden y descarte de instantáneas en la web.
- [x] Ejecutar pruebas, lint y build del frontend.

## Alcance P1 si P0 queda estable

- [x] Deduplicar en la Pico los últimos 32 `id_mensaje` recibidos, sin repetir efectos y reenviando la respuesta asociada.
- [x] Agregar reconexión de Wi-Fi y MQTT como estado no bloqueante con intervalo entre intentos.
- [x] Recuperar suscripciones después de reconectar.
- [ ] Añadir telemetría de memoria, tiempos de tareas y RSSI.
- [x] Comparar automáticamente una ejecución del motor web con la ejecución MicroPython mediante los vectores compartidos.
- [x] Incorporar ejecución continua con `iniciar` y `detener`; `paso` deja el motor en estado `pausada`.

## Fuera de alcance para el martes

- Edición colaborativa del diagrama en tiempo real.
- Ejecutar código JavaScript o Python arbitrario recibido por MQTT.
- Compatibilidad completa con todos los circuitos posibles del editor.
- Alta disponibilidad del broker o infraestructura en la nube.
- Autenticación de usuarios finales y permisos por proyecto.
- Optimización definitiva de memoria sin mediciones en la Pico física.

## División entre cinco personas

### Persona 1 — Arquitectura, scheduler e integración

Responsable asignado: **Kevin Rincón**.

Responsable de que los módulos encajen y de mantener el alcance general.

- [x] Crear las clases base `Task`, `Scheduler` y reloj intercambiable.
- [x] Definir normas de duración y manejo de errores para `update()`.
- [x] Preparar `main.py` como composición de módulos, sin lógica de negocio extensa.
- [x] Integrar los aportes de las otras cuatro personas según el flujo acordado por el equipo.
- [x] Revisar que no se introduzcan dependencias circulares.
- [x] Mantener actualizados el plan y el registro de cambios.
- [ ] Dirigir el ensayo de cuatro navegadores.

**Criterio de terminación:** el scheduler ejecuta varias tareas periódicas sin bloqueos y el sistema integrado inicia desde un único `main.py`.

### Persona 2 — Plataforma Pico, MQTT y LED

Responsable asignado: **Julian Romero**.

Responsable de adaptar el trabajo anterior a PicoROS y al modelo no bloqueante.

- [x] Separar Wi-Fi, GPIO y cliente MQTT del ejemplo anterior.
- [x] Separar la lógica del LED en `devices/led_task.py` mediante una salida con `on()`/`off()`.
- [x] Separar Wi-Fi y cliente MQTT; conectar el transporte a `Node` y al contrato Python.
- [x] Implementar `MqttTransport` como subclase de `Task`.
- [x] Implementar `LedTask` mediante máquina de estados; probado en escritorio.
- [x] Eliminar el ciclo de titilado con esperas bloqueantes; `update()` realiza como máximo un cambio.
- [x] Preparar `FakeLed` y reutilizar `FakeClock` para desarrollar sin la Pico; probado en escritorio.
- [x] Documentar los pasos de copia del firmware a la placa; copia no ejecutada.
- [ ] Ejecutar la validación física cuando la Pico esté disponible.

**Criterio de terminación:** durante el titilado se siguen procesando mensajes y tareas; el hardware real puede reemplazar los dobles sin modificar la lógica.

### Persona 3 — Motor HiLeS en MicroPython

Responsable asignado: **Juan Ramos**.

Responsable del núcleo ejecutable que recibe la IR.

- [x] Implementar carga y validación de la IR versión 1.
- [x] Implementar elementos `Service`, `Functional Block`, `Place` y `Transition`.
- [x] Implementar propagación mínima y movimiento atómico de tokens.
- [x] Crear `EngineTask` con trabajo acotado por actualización.
- [x] Implementar paso y reinicio.
- [x] Serializar instantáneas generales del modelo.
- [x] Cubrir el motor con pruebas de escritorio.
- [ ] Validar memoria y tiempos del motor en la Pico física.

**Criterio de terminación:** un modelo válido produce instantáneas reproducibles sin reglas específicas del semáforo.

### Persona 4 — Contrato, compilador y conformidad

Responsable asignado: **Felipe**.

Responsable de que web y Pico interpreten exactamente el mismo modelo y mensajes.

- [x] Congelar la IR versión 1 y actualizar el contrato MQTT vigente.
- [x] Implementar el compilador del documento visual a IR.
- [x] Rechazar conexiones, tipos u operaciones no soportados antes de publicar.
- [x] Preparar vectores JSON compartidos entre TypeScript y MicroPython.
- [x] Probar mensajes válidos, inválidos, repetidos y fuera de orden.
- [x] Comparar instantáneas esperadas del motor web y MicroPython (los vectores de `docs/mqtt/vectores_ir_v1/ejecucion/` se reproducen paso a paso en `firmware/tests/test_hiles_engine.py`; casilla cerrada por Juan Ramos, Persona 3, el 12 de octubre).
- [x] Revisar límites de tamaño del contrato.

**Criterio de terminación:** un modelo soportado se genera desde el editor sin edición manual y pasa los mismos casos de conformidad en ambos lados.

### Persona 5 — Ejecución remota y sincronización visual

Responsable del modo Pico en la aplicación web y de la demostración multiusuario.

- [x] Implementar el cliente de ejecución remota.
- [x] Agregar controles para cargar, iniciar, avanzar, detener y reiniciar.
- [x] Bloquear el motor local cuando el modo Pico esté activo.
- [x] Aplicar instantáneas remotas a valores, tokens y estados visuales.
- [x] Administrar sesión, versión y secuencia recibida.
- [x] Preparar la apertura coordinada de cuatro navegadores mediante un enlace de sesión compartible.
- [x] Convertir el demo visual en un cruce Norte–Sur / Este–Oeste seguro.

**Criterio de terminación:** una acción enviada desde un navegador produce una instantánea de la Pico que se representa de igual manera en los cuatro canvas.

## Dependencias entre responsables

```text
Contrato e IR (Persona 4)
        ├── Motor MicroPython (Persona 3)
        └── Cliente remoto web (Persona 5)

Scheduler (Persona 1)
        ├── Transporte MQTT y LED (Persona 2)
        └── EngineTask (Persona 3)

Todos ── integración, pruebas y demostración
```

El contrato y las interfaces deben congelarse primero. Los cambios posteriores requieren avisar a quienes consumen esa interfaz y actualizar los casos de prueba.

## Orden de trabajo

### Domingo 11 — interfaces y estructura

- [ ] Aprobar alcance P0 y reparto.
- [x] Congelar IR, topics, mensajes y estado remoto.
- [x] Crear esqueletos mínimos de scheduler, pub/sub y cliente remoto.
- [x] Preparar fixtures y dobles para trabajar sin hardware.

### Lunes 12, mañana — implementación paralela

- [x] Completar scheduler, pub/sub interno y LED no bloqueante.
- [x] Completar el subconjunto inicial del motor MicroPython.
- [x] Completar compilador a IR.
- [x] Completar recepción y aplicación de instantáneas en la web.
- [x] Convertir el modelo de semáforos en un cruce coordinado.

### Lunes 12, tarde — integración

- [x] Integrar únicamente cambios con pruebas y registro técnico.
- [x] Ejecutar el flujo completo con transporte y hardware falsos.
- [ ] Abrir cuatro navegadores y comprobar sincronización por broker.
- [x] Corregir errores del contrato sin ampliar el alcance.
- [x] Ejecutar todas las pruebas disponibles del firmware y frontend.

### Lunes 12, noche — congelación

- [ ] Congelar funcionalidad y documentación.
- [x] Completar el registro de cambios y resultados de las pruebas disponibles sin hardware.
- Evidencia audiovisual opcional: preparar capturas, logs o video de respaldo solo si el equipo lo considera útil.
- [ ] Ejecutar un ensayo cronometrado.
- [x] Dejar identificados los pasos que requieren la Pico física.

### Martes 13, antes de las 9:00 a. m.

- [x] Repetir pruebas automáticas sin introducir funcionalidades nuevas.
- [ ] Comprobar broker, red, cuatro navegadores y archivos del demo.
- [ ] Validar físicamente con la Pico si está disponible.
- [x] Confirmar que no existen credenciales en Git.
- [ ] Preparar la versión final de entrega.

## Criterios de aceptación

- [x] El proyecto compila y las pruebas anteriores continúan aprobando.
- [x] Todas las tareas concretas actuales (`LedTask`, `MqttTransport` y `EngineTask`) heredan de `Task` e implementan `update()`.
- [x] Ninguna acción periódica del runtime modular actual usa una espera que bloquee las demás tareas.
- [x] MQTT externo y pub/sub interno permanecen separados.
- [x] El LED titila sin impedir que se procese otro mensaje MQTT.
- [x] La web genera una IR desde documentos reales del editor.
- [x] La Pico o su runtime simulado carga y ejecuta el modelo (runtime simulado con `Scheduler`, `FakeClock`, `Node` y `FakeTransport`; falta la Pico física).
- [x] El motor no contiene reglas codificadas exclusivamente para el semáforo.
- [ ] La Pico es la fuente oficial del estado remoto.
- [ ] Cuatro navegadores muestran la misma secuencia y estado.
- [x] Norte–Sur y Este–Oeste nunca están verdes simultáneamente en la prueba automática del modelo coordinado.
- [x] Un JSON inválido produce un error y no detiene el scheduler.
- [x] Las credenciales permanecen fuera del repositorio.
- [x] El procedimiento de demostración sin Pico está documentado para que otra persona pueda repetirlo.

## Guion de demostración

1. Explicar el monolito modular y la multitarea cooperativa.
2. Mostrar `Task`, `Scheduler` y varias tareas con periodos distintos.
3. Enviar `titilar` y demostrar que MQTT sigue respondiendo durante el parpadeo.
4. Mostrar el mismo proyecto de cuatro semáforos en cuatro navegadores.
5. Cargar el modelo en la Pico mediante MQTT.
6. Enviar una entrada o comando desde un navegador.
7. Mostrar la instantánea publicada por la Pico.
8. Confirmar que los cuatro canvas muestran la misma actualización.
9. Mostrar que las fases incompatibles no quedan verdes simultáneamente.
10. Aclarar qué fue validado con hardware y qué fue validado con dobles.

## Registro obligatorio y evidencia adicional opcional

Cada responsable debe registrar:

1. tarea realizada;
2. archivos modificados;
3. explicación breve de la solución;
4. comandos o pasos de prueba;
5. resultado esperado y obtenido;
6. captura, log o video, de manera opcional;
7. hash del commit;
8. riesgos y pendientes.

Una casilla solo se marca con `[x]` cuando se documentan los pasos de prueba y el resultado obtenido. Las fotos, capturas, logs y videos pueden complementar el registro, pero no son obligatorios ni bloquean la entrega.
