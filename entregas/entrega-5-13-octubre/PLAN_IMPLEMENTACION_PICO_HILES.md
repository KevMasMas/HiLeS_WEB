# Plan de implementación — ejecución remota HiLeS con PicoROS y MQTT

**Entrega:** martes 13 de octubre de 2026, 10:00 a. m. (hora de Colombia)  
**Equipo:** cinco personas; asignación pendiente por el grupo  
**Estado inicial:** planificación; todas las actividades de esta entrega permanecen por comprobar.

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
│   ├── model.py
│   ├── elements.py
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

Todavía no existen el scheduler integrado a HiLeS, el compilador real a IR, el motor MicroPython, el modo remoto de la web ni la coordinación real de los cuatro semáforos.

## Alcance P0 obligatorio

### Organización y contrato

- [x] Crear la estructura modular mínima de `firmware/pico/`.
- [x] Actualizar todas las rutas documentales después de la reorganización.
- [ ] Cerrar la IR versión 1 antes de implementar el motor.
- [ ] Definir un identificador de sesión o ejecución compartido por los cuatro navegadores.
- [ ] Definir reglas de `modelo_id`, `version`, `secuencia` e `id_mensaje`.
- [ ] Mantener credenciales reales fuera de Git.

### Multitarea y pub/sub

- [x] Implementar `Task` con periodo, prioridad, nombre y próxima ejecución.
- [x] Implementar `Scheduler` usando `ticks_ms`, `ticks_add` y `ticks_diff`.
- [x] Garantizar que toda subclase concreta de `Task` implemente `update()`.
- [ ] Implementar `Node` con suscripción, desuscripción y publicación local.
- [ ] Implementar `MqttTransport` como tarea periódica no bloqueante.
- [ ] Enrutar mensajes externos hacia callbacks internos.
- [ ] Enrutar publicaciones internas hacia MQTT sin acoplar el motor al cliente.
- [ ] Evitar que un callback defectuoso elimine silenciosamente una suscripción válida.

### Demostrador de LED no bloqueante

- [x] Implementar los estados `APAGADO`, `ENCENDIDO` y `TITILANDO`.
- [x] Hacer que el callback solamente valide la orden y cambie el estado deseado.
- [x] Realizar el titilado mediante ejecuciones periódicas de `update()`.
- [ ] Confirmar que MQTT y las demás tareas continúan ejecutándose durante el titilado.
- [ ] Publicar estado y error mediante JSON válido.

### Motor HiLeS MicroPython

- [ ] Cargar y validar una IR sin usar `eval`.
- [ ] Implementar inicialmente `Service`, `Functional Block`, `Place` y `Transition`.
- [ ] Implementar conexiones continuas y flujo de tokens necesarios para el demo.
- [ ] Ejecutar un paso de manera acotada y no bloqueante.
- [ ] Respetar capacidad, peso y movimiento atómico de tokens.
- [ ] Implementar `reiniciar` a partir del estado inicial del modelo.
- [ ] Publicar instantáneas con modelo, versión y secuencia.
- [ ] Rechazar elementos u operaciones no soportados con un error legible.

### Web y cuatro navegadores

- [ ] Implementar el compilador `HilesModelDocument → IR v1`.
- [ ] Agregar selección entre ejecución local y ejecución en Pico.
- [ ] Publicar el modelo y esperar `modelo/confirmacion`.
- [ ] Enviar entradas y comandos con `id_mensaje` único.
- [ ] Aplicar `simulacion/estado` al canvas sin ejecutar el motor local.
- [ ] Ignorar instantáneas de otra sesión, versión o secuencia anterior.
- [ ] Confirmar que cuatro navegadores reciben el mismo estado oficial.
- [ ] Definir qué navegador carga el modelo y cómo los demás se incorporan a la sesión.
- [ ] Mostrar conexión, carga, error y última secuencia recibida.

### Semáforo coordinado

- [ ] Convertir los cuatro bloques independientes en sentidos Norte, Sur, Este y Oeste.
- [ ] Agrupar fases compatibles Norte–Sur y Este–Oeste.
- [ ] Garantizar que fases incompatibles nunca estén verdes simultáneamente.
- [ ] Representar rojo, amarillo y verde mediante estado del modelo, no mediante reglas especiales del motor.
- [ ] Preparar una entrada controlada, como presencia o cantidad de vehículos.
- [ ] Verificar que una acción iniciada en un navegador aparece en los otros tres después de la respuesta de la Pico.

### Pruebas sin la Pico

- [x] Crear `FakeClock` para avanzar el tiempo sin esperas reales.
- [x] Crear `FakeLed` para observar cambios de GPIO.
- [ ] Crear `FakeTransport` para publicar y recibir sin broker.
- [x] Probar periodos, prioridades y tareas vencidas del scheduler.
- [x] Probar que un titilado no bloquea otra tarea.
- [ ] Probar callbacks y aislamiento entre topics internos.
- [ ] Probar carga válida e inválida de la IR.
- [ ] Probar movimiento de tokens y límites de capacidad.
- [ ] Probar orden y descarte de instantáneas en la web.
- [ ] Ejecutar pruebas, lint y build del frontend.

## Alcance P1 si P0 queda estable

- [ ] Deduplicar al menos los últimos 32 `id_mensaje` recibidos.
- [ ] Agregar reconexión de Wi-Fi y MQTT como tarea o estado no bloqueante.
- [ ] Recuperar suscripciones después de reconectar.
- [ ] Añadir telemetría de memoria, tiempos de tareas y RSSI.
- [ ] Comparar automáticamente una ejecución del motor web con la ejecución MicroPython.
- [ ] Incorporar ejecución continua con iniciar, detener y pausar.

## Fuera de alcance para el martes

- Edición colaborativa del diagrama en tiempo real.
- Ejecutar código JavaScript o Python arbitrario recibido por MQTT.
- Compatibilidad completa con todos los circuitos posibles del editor.
- Alta disponibilidad del broker o infraestructura en la nube.
- Autenticación de usuarios finales y permisos por proyecto.
- Optimización definitiva de memoria sin mediciones en la Pico física.

## División entre cinco personas

### Persona 1 — Arquitectura, scheduler e integración

Responsable de que los módulos encajen y de mantener el alcance general.

- [x] Crear las clases base `Task`, `Scheduler` y reloj intercambiable.
- [x] Definir normas de duración y manejo de errores para `update()`.
- [x] Preparar `main.py` como composición de módulos, sin lógica de negocio extensa.
- [ ] Integrar los aportes de las otras cuatro personas según el flujo acordado por el equipo.
- [x] Revisar que no se introduzcan dependencias circulares.
- [x] Mantener actualizados el plan y el registro de cambios.
- [ ] Dirigir el ensayo de cuatro navegadores.

**Criterio de terminación:** el scheduler ejecuta varias tareas periódicas sin bloqueos y el sistema integrado inicia desde un único `main.py`.

### Persona 2 — Plataforma Pico, MQTT y LED

Responsable asignado: **Julian Romero**.

Responsable de adaptar el trabajo anterior a PicoROS y al modelo no bloqueante.

- [ ] Separar Wi-Fi, GPIO y cliente MQTT del ejemplo anterior.
- [x] Separar la lógica del LED en `devices/led_task.py` mediante una salida con `on()`/`off()`.
- [ ] Separar Wi-Fi y cliente MQTT; pendiente de `Node` y del contrato Python del transporte.
- [ ] Implementar `MqttTransport` como subclase de `Task`.
- [x] Implementar `LedTask` mediante máquina de estados; probado en escritorio.
- [x] Eliminar el ciclo de titilado con esperas bloqueantes; `update()` realiza como máximo un cambio.
- [x] Preparar `FakeLed` y reutilizar `FakeClock` para desarrollar sin la Pico; probado en escritorio.
- [x] Documentar los pasos de copia del firmware a la placa; copia no ejecutada.
- [ ] Ejecutar la validación física cuando la Pico esté disponible.

**Criterio de terminación:** durante el titilado se siguen procesando mensajes y tareas; el hardware real puede reemplazar los dobles sin modificar la lógica.

### Persona 3 — Motor HiLeS en MicroPython

Responsable del núcleo ejecutable que recibe la IR.

- [ ] Implementar carga y validación de la IR versión 1.
- [ ] Implementar elementos `Service`, `Functional Block`, `Place` y `Transition`.
- [ ] Implementar propagación mínima y movimiento atómico de tokens.
- [ ] Crear `EngineTask` con trabajo acotado por actualización.
- [ ] Implementar paso y reinicio.
- [ ] Serializar instantáneas generales del modelo.
- [ ] Cubrir el motor con pruebas de escritorio.

**Criterio de terminación:** un modelo válido produce instantáneas reproducibles sin reglas específicas del semáforo.

### Persona 4 — Contrato, compilador y conformidad

Responsable de que web y Pico interpreten exactamente el mismo modelo y mensajes.

- [ ] Congelar la IR versión 1 y actualizar el contrato MQTT vigente.
- [ ] Implementar el compilador del documento visual a IR.
- [ ] Rechazar conexiones, tipos u operaciones no soportados antes de publicar.
- [ ] Preparar vectores JSON compartidos entre TypeScript y MicroPython.
- [ ] Probar mensajes válidos, inválidos, repetidos y fuera de orden.
- [ ] Comparar instantáneas esperadas del motor web y MicroPython.
- [ ] Revisar límites de tamaño del contrato.

**Criterio de terminación:** un modelo soportado se genera desde el editor sin edición manual y pasa los mismos casos de conformidad en ambos lados.

### Persona 5 — Ejecución remota y sincronización visual

Responsable del modo Pico en la aplicación web y de la demostración multiusuario.

- [ ] Implementar el cliente de ejecución remota.
- [ ] Agregar controles para cargar, iniciar, avanzar, detener y reiniciar.
- [ ] Bloquear el motor local cuando el modo Pico esté activo.
- [ ] Aplicar instantáneas remotas a valores, tokens y estados visuales.
- [ ] Administrar sesión, versión y secuencia recibida.
- [ ] Preparar la apertura coordinada de cuatro navegadores.
- [ ] Convertir el demo visual en un cruce Norte–Sur / Este–Oeste seguro.

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
- [ ] Congelar IR, topics, mensajes y estado remoto.
- [ ] Crear esqueletos mínimos de scheduler, pub/sub y cliente remoto.
- [ ] Preparar fixtures y dobles para trabajar sin hardware.

### Lunes 12, mañana — implementación paralela

- [ ] Completar scheduler, pub/sub y LED no bloqueante.
- [ ] Completar el subconjunto inicial del motor MicroPython.
- [ ] Completar compilador a IR.
- [ ] Completar recepción y aplicación de instantáneas en la web.
- [ ] Convertir el modelo de semáforos en un cruce coordinado.

### Lunes 12, tarde — integración

- [ ] Integrar únicamente cambios con pruebas e informe.
- [ ] Ejecutar el flujo completo con transporte y hardware falsos.
- [ ] Abrir cuatro navegadores y comprobar sincronización por broker.
- [ ] Corregir errores del contrato sin ampliar el alcance.
- [ ] Ejecutar todas las pruebas del firmware y frontend.

### Lunes 12, noche — congelación

- [ ] Congelar funcionalidad y documentación.
- [ ] Completar el registro de cambios y resultados de las pruebas.
- Evidencia audiovisual opcional: preparar capturas, logs o video de respaldo solo si el equipo lo considera útil.
- [ ] Ejecutar un ensayo cronometrado.
- [ ] Dejar identificados los pasos que requieren la Pico física.

### Martes 13, antes de las 9:00 a. m.

- [ ] Repetir pruebas automáticas sin introducir funcionalidades nuevas.
- [ ] Comprobar broker, red, cuatro navegadores y archivos del demo.
- [ ] Validar físicamente con la Pico si está disponible.
- [ ] Confirmar que no existen credenciales en Git.
- [ ] Preparar la versión final de entrega.

## Criterios de aceptación

- [ ] El proyecto compila y las pruebas anteriores continúan aprobando.
- [ ] Todas las tareas concretas heredan de `Task` e implementan `update()`.
- [ ] Ninguna acción periódica usa una espera que bloquee las demás tareas.
- [ ] MQTT externo y pub/sub interno permanecen separados.
- [ ] El LED titila sin impedir que se procese otro mensaje.
- [ ] La web genera una IR desde un documento real del editor.
- [ ] La Pico o su runtime simulado carga y ejecuta el modelo.
- [ ] El motor no contiene reglas codificadas exclusivamente para el semáforo.
- [ ] La Pico es la fuente oficial del estado remoto.
- [ ] Cuatro navegadores muestran la misma secuencia y estado.
- [ ] Norte–Sur y Este–Oeste nunca están verdes simultáneamente.
- [ ] Un JSON inválido produce un error y no detiene el scheduler.
- [ ] Las credenciales permanecen fuera del repositorio.
- [ ] El procedimiento de demostración puede ser repetido por otra persona.

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
