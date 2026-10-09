# Registro de cambios — Integración HiLeS, MQTT y Pico W

Este archivo reúne los informes de trabajo de la entrega. Se debe actualizar cada vez que una persona complete, corrija o pruebe una tarea definida en [`PLAN_MQTT_PICO.md`](PLAN_MQTT_PICO.md).

No se deben eliminar entradas anteriores. Si una prueba cambia de resultado, se agrega una entrada nueva que explique la corrección.

## Reglas del registro

- Usar los nombres definidos para cada responsable: `Kevin Rincon`, `Felipe Prado`, `Julian Romero` o `Juan David Romero`.
- Registrar fecha y hora de Colombia.
- No incluir SSID, contraseña Wi-Fi, usuario MQTT, contraseña MQTT ni otros secretos.
- Los logs y capturas deben ocultar credenciales antes de adjuntarse.
- Una tarea solo se marca como hecha cuando tiene una prueba reproducible.
- Si una tarea depende de la Pico, indicar cuánto duró el bloque físico y quién conserva la evidencia.
- Si una tarea queda bloqueada, registrar la causa exacta y lo necesario para desbloquearla.
- Cada entrada debe incluir rama y commit, o indicar claramente `Pendiente de commit`.

---

## Plantilla de informe individual

Copiar esta plantilla debajo de `Entradas cronológicas` por cada avance verificable:

```md
### [AAAA-MM-DD HH:MM] — Responsable: Persona N

- Estado: Pendiente / Hecho / Bloqueado
- Área: broker / Pico / MicroPython / web MQTT / HiLeS / pruebas / documentación
- Tarea o problema:
- Qué se hizo:
- Topics involucrados:
- Archivos creados o modificados:
- Configuración utilizada, sin secretos:
- Rama: `mqtt/persona-N-descripcion`
- Commit/hash:
- Cómo se probó:
- Resultado esperado:
- Resultado obtenido:
- Evidencia: captura, video, log, comando o enlace local
- Uso de la Pico: no requerido / bloque de __ minutos
- Riesgos, pendientes o reversión necesaria:
- Entrega a la siguiente persona:
```

---

## Plantilla de incidencia o bloqueo

Usar esta plantilla cuando el problema impida continuar:

```md
### [AAAA-MM-DD HH:MM] — Bloqueo reportado por Persona N

- Estado: Bloqueado
- Componente:
- Paso exacto que falla:
- Mensaje de error completo, sin secretos:
- Última prueba que sí funcionó:
- Entorno: sistema operativo, versión de MicroPython, host y puertos sin credenciales
- Evidencia:
- Posible causa:
- Acción necesaria para desbloquear:
- Persona o tarea dependiente afectada:
```

---

## Entradas cronológicas

<!-- Agregar las entradas nuevas debajo de esta línea. No eliminar ni reescribir las anteriores. -->

### [2026-10-09 16:23] — Responsable: Kevin Rincon

- Estado: Hecho; ensayo formal pendiente.
- Área: auditoría de cierre / documentación / seguridad de configuración.
- Tarea o problema: Revisar todos los archivos y checklists de la entrega para alinear las casillas con los resultados realmente comprobados.
- Qué se hizo: Se revisaron los documentos, archivos de Mosquitto y MicroPython, servicios MQTT del frontend, estado de Git, ramas y configuración local ignorada. Se completó el checklist de preparación de la guía y se confirmó el trabajo sobre la rama común `mqtt-pico` sin intervenir `main`. Las tareas P1 y el ensayo formal permanecen sin marcar. Las evidencias audiovisuales son gestionadas por el equipo fuera del repositorio.
- Topics involucrados: todos los topics del contrato; no se publicaron mensajes adicionales durante esta auditoría.
- Archivos creados o modificados: `GUIA_DEMO_MQTT_HILES.md`, `PLAN_MQTT_PICO.md` y este registro.
- Configuración utilizada, sin secretos: se verificó únicamente la presencia de las variables requeridas en `frontend/.env.local`; sus valores sensibles no se imprimieron y el archivo continúa ignorado por Git.
- Rama: `mqtt-pico`.
- Commit/hash: Pendiente de commit del cierre de Kevin Rincon.
- Cómo se probó: Revisión de todas las casillas con `rg`, inventario de archivos, `git status`, ramas locales/remotas, búsqueda de referencias de configuración versionadas, `git check-ignore` y `git diff --check`.
- Resultado esperado: Las casillas deben reflejar únicamente trabajo implementado o evidencia documentada, sin marcar P1 ni acciones futuras.
- Resultado obtenido: Checklist de preparación completo y P0 funcional completo; únicamente permanece pendiente el ensayo formal. No se encontraron credenciales reales versionadas.
- Evidencia: Registro de pruebas físicas de la sesión, salida de 39/39 pruebas, lint y build, historial Git y documentos operativos de la entrega. Las capturas y videos se conservan por separado.
- Uso de la Pico: No requerido para la auditoría; las pruebas físicas ya fueron confirmadas durante esta sesión.
- Riesgos, pendientes o reversión necesaria: Ejecutar y registrar el ensayo formal, congelar la versión y crear el commit final.
- Entrega a la siguiente persona: Kevin Rincon debe dirigir o registrar el ensayo final.

---

### [2026-10-09 15:59] — Responsable: Kevin Rincon

- Estado: Hecho; evidencia final y ensayo formal pendientes.
- Área: web MQTT / Mosquitto / Pico W / prueba física.
- Tarea o problema: Completar el recorrido bidireccional real desde la aplicación HiLeS hasta el LED físico y devolver la confirmación a la web.
- Qué se hizo: Se inició el frontend con la configuración local excluida de Git, se conectó el panel MQTT a Mosquitto por WebSockets y se probaron desde la web las acciones de encender, apagar y titilar sobre la Pico W. Después se importó el modelo de humedad, se publicó una entrada MQTT con valor `70` para comprobar la frontera con un `Service` HiLeS y se envió el texto inválido `"setenta"` para verificar el rechazo seguro. Al detectar que el aviso podía quedar fuera del área visible, se ajustó el panel para mantener los diagnósticos de integración visibles y limitar el desplazamiento a las listas de avisos y mensajes.
- Topics involucrados: `udfjc/hiles/v1/equipo1/pico01/led/comando`, `led/estado`, `estado/conexion` y `entrada/establecer`.
- Archivos creados o modificados: `frontend/.env.local` únicamente como configuración local no versionada; `frontend/src/features/mqtt/MqttPanel.tsx` para mantener visibles los avisos de integración; `PLAN_MQTT_PICO.md` y este registro para documentar el resultado.
- Configuración utilizada, sin secretos: frontend servido localmente en el puerto `5174`; Mosquitto en `localhost:9001` para WebSockets y `192.168.137.106:1883` para la Pico; usuario MQTT configurado localmente.
- Rama: `mqtt-pico`.
- Commit/hash: Pendiente de commit del cierre documental.
- Cómo se probó: En el panel MQTT de HiLeS se confirmó la conexión y se ejecutaron consecutivamente las acciones `encender`, `apagar` y `titilar`, observando la respuesta física del LED y el retorno de estado en la aplicación. Luego se publicó `{"servicio_id":"demo2-humidity","valor":70,"id_mensaje":"demo-service-001"}` en `entrada/establecer` y la web confirmó la recepción del valor. Finalmente se publicó el mismo mensaje con `"valor":"setenta"`; la aplicación mostró el rechazo por incompatibilidad con el tipo `real`. Después del ajuste visual se volvieron a ejecutar las 39 pruebas, lint y build correctamente.
- Resultado esperado: La web publica el comando JSON, la Pico ejecuta la acción y la confirmación vuelve al panel a través de Mosquitto; una entrada externa válida también alcanza el `Service` correspondiente.
- Resultado obtenido: Conexión WebSocket correcta y las tres acciones físicas ejecutadas correctamente; la aplicación mostró la comunicación de retorno de la Pico, el `Service` Humedad recibió el valor `70` esperado y rechazó el texto `"setenta"` mediante una alerta roja comprensible sin bloquear el motor.
- Evidencia: Confirmación visual durante la prueba; capturas y video gestionados por el equipo fuera del repositorio.
- Uso de la Pico: Prueba física integral completada.
- Riesgos, pendientes o reversión necesaria: Registrar el ensayo final y congelar la versión entregable.
- Entrega a la siguiente persona: Continuar con la evidencia reproducible y el ensayo formal siguiendo `GUIA_DEMO_MQTT_HILES.md`.

---

### [2026-10-08 22:08] — Responsable: Juan David Romero

- Estado: Hecho, excepto ensayo físico pendiente.
- Área: contrato JSON / web MQTT / HiLeS / pruebas / documentación.
- Tarea o problema: Completar la parte 4: cerrar el contrato de mensajes, validar entradas, crear la frontera MQTT–Service, probar la integración y preparar el cierre de la demostración.
- Qué se hizo: Se crearon tipos y ejemplos para los diez topics; el cliente descarta JSON mal formado, topics desconocidos y campos inválidos; el panel muestra diagnósticos en español; `MqttHilesBridge` inyecta `entrada/establecer` por la API pública de un `Service` sin reemplazar `BusObserver` y puede publicar una salida del motor; se añadieron pruebas unitarias y una prueba integral que mueve el token del circuito de humedad; se revisaron los cambios ya integrados de broker, Pico y cliente web; se prepararon contrato, guion, checklist y matriz de evidencias.
- Topics involucrados: todos los topics bajo `udfjc/hiles/v1/equipo1/pico01/`, con prueba integral sobre `entrada/establecer`, `salida` y `error`.
- Archivos creados o modificados: `frontend/src/services/mqtt/messages.ts`, `messages.test.ts`, `MqttClient.ts`, `MqttHilesBridge.ts`, `MqttHilesBridge.test.ts`, `setupMqttHilesBridge.ts`, `config.ts`, `frontend/src/features/mqtt/MqttPanel.tsx`, `frontend/src/stores/useSimulationStore.ts`, `CONTRATO_MENSAJES_MQTT.md`, `GUIA_DEMO_MQTT_HILES.md`, `PLAN_MQTT_PICO.md` y este registro.
- Configuración utilizada, sin secretos: pruebas locales de Vitest; configuración MQTT por variables `VITE_MQTT_*`; no se almacenaron credenciales.
- Rama: `mqtt-pico`.
- Commit/hash: implementación `069ad92`; compatibilidad con mensajes reales de la Pico `831b79c`; documentación incluida en el commit de cierre que contiene esta entrada.
- Cómo se probó: `npm run test:run -- src/services/mqtt/messages.test.ts src/services/mqtt/MqttHilesBridge.test.ts`, `npm run test:run`, `npm run lint`, `npm run build` y `git diff --check`.
- Resultado esperado: aceptar solo mensajes del contrato, proteger el motor ante entradas inválidas y demostrar que una entrada MQTT alcanza un `Service` y produce un cambio en el motor.
- Resultado obtenido: 8/8 pruebas MQTT y 39/39 pruebas totales aprobadas; lint sin errores; build de producción correcto; la prueba integral inyectó humedad `70`, vació el Place inicial y colocó el token en el Place activo. También se comprobaron los mensajes reales de arranque y error publicados por MicroPython.
- Evidencia: salida de Vitest, ESLint y Vite; prueba automatizada `MqttHilesBridge.test.ts`; documentos de contrato y demo.
- Uso de la Pico: no requerido para el desarrollo ni la prueba automatizada. El ensayo físico web → broker → Pico → web sigue pendiente con el equipo.
- Riesgos, pendientes o reversión necesaria: `npm ci` informa dos vulnerabilidades altas en dependencias transitivas; no se ejecutó `npm audit fix` para evitar cambios de versiones fuera de alcance. Falta realizar y registrar el ensayo físico con las cuatro personas y guardar sus capturas/video.
- Entrega a la siguiente persona: El código y el material de cierre están listos; el equipo debe seguir `GUIA_DEMO_MQTT_HILES.md` y completar el registro del ensayo físico.

---

### [2026-10-08 20:30] — Responsable: Felipe Prado

- Estado: Hecho
- Área: Pico / pruebas / evidencia
- Tarea o problema: Completar la evidencia física de la integración MQTT con la Pico W.
- Qué se hizo: Se guardaron los logs de la prueba y un video corto donde se observa la ejecución física de los comandos MQTT sobre el LED de la placa.
- Topics involucrados: `udfjc/hiles/v1/equipo1/pico01/led/comando`, `led/estado` y `estado/conexion`.
- Archivos creados o modificados: evidencia audiovisual externa; actualización de `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: broker MQTT local en `1883`, Pico W ejecutando `main.py` y autenticación habilitada.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se enviaron acciones MQTT y se registraron tanto las respuestas de consola como el comportamiento visible del LED.
- Resultado esperado: Contar con evidencia reproducible del flujo MQTT y de la acción física ejecutada por la Pico.
- Resultado obtenido: Logs y video corto disponibles.
- Evidencia: video físico y registros de terminal conservados por Felipe Prado.
- Uso de la Pico: bloque físico completado.
- Riesgos, pendientes o reversión necesaria: Falta incorporar o referenciar la evidencia en el paquete final según decida Juan David Romero.
- Entrega a la siguiente persona: Juan David Romero puede utilizar la evidencia en el guion y respaldo de la demostración.

---

### [2026-10-08 19:35] — Responsable: Kevin Rincon

- Estado: Hecho
- Área: broker / red / configuración / documentación
- Tarea o problema: Definir el endpoint local de la demostración y entregar una configuración reproducible al equipo.
- Qué se hizo: Se definió la IPv4 Wi-Fi actual del broker, se documentaron MQTT `1883` y WebSocket `9001`, se incluyeron formatos para MicroPython y `frontend/.env.local`, y se documentó la verificación obligatoria de IP antes de cada demostración.
- Topics involucrados: prefijo `udfjc/hiles/v1/equipo1/pico01/` y topics principales de comando, estado, conexión, telemetría y error.
- Archivos creados o modificados: `FICHA_CONEXION_MQTT.md`, `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: host `192.168.137.106`, MQTT `1883`, WebSocket `ws://192.168.137.106:9001/mqtt`; credenciales excluidas del repositorio y reservadas para entrega privada.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se verificaron listeners, PUB/SUB MQTT, PUB/SUB WebSocket, conexión real de la Pico y formatos compatibles con las variables existentes del frontend.
- Resultado esperado: Otro integrante puede configurar su cliente con la ficha y las credenciales recibidas por privado.
- Resultado obtenido: Ficha de conexión preparada y disponible en el repositorio sin exponer secretos.
- Evidencia: `FICHA_CONEXION_MQTT.md` y registros previos de `CONNACK`, `SUBACK`, publicación, recepción y control físico del LED.
- Uso de la Pico: conexión real validada junto con Felipe Prado.
- Riesgos, pendientes o reversión necesaria: La IP es asignada por el hotspot y debe confirmarse con `ipconfig` antes de la demostración; si cambia, actualizar la configuración local de los clientes. Las credenciales expuestas durante las pruebas deben rotarse.
- Entrega a la siguiente persona: Broker y ficha listos para la integración de la aplicación web.

---

### [2026-10-08 19:20] — Responsable: Kevin Rincon

- Estado: Hecho
- Área: broker / web MQTT / pruebas
- Tarea o problema: Verificar el listener MQTT sobre WebSockets del broker local.
- Qué se hizo: Se conectaron dos clientes de terminal al listener WebSocket `9001`; uno se suscribió y el otro publicó un mensaje JSON de prueba.
- Topics involucrados: `udfjc/hiles/prueba-websocket`.
- Archivos creados o modificados: `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: broker local `192.168.137.106`, puerto `9001`, protocolo WebSocket y autenticación habilitada.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: `mosquitto_sub --ws` recibió `CONNACK (0)`, `SUBACK`, el mensaje JSON publicado por `mosquitto_pub --ws` y posteriormente intercambió `PINGREQ/PINGRESP`.
- Resultado esperado: Un cliente WebSocket autenticado publica y otro recibe el mensaje por el puerto `9001`.
- Resultado obtenido: Se recibió `{"mensaje":"websocket funcionando"}` y la conexión permaneció activa.
- Evidencia: salida de diagnóstico completa compartida durante la prueba.
- Uso de la Pico: no requerido para esta prueba.
- Riesgos, pendientes o reversión necesaria: Rotar las credenciales expuestas, confirmar la IPv4 del PC antes de la demostración y entregar la ficha privada al equipo.
- Entrega a la siguiente persona: El listener WebSocket queda listo para la aplicación web.

---

### [2026-10-08 19:05] — Responsable: Felipe Prado

- Estado: Hecho
- Área: Pico / Wi-Fi / MQTT / pruebas
- Tarea o problema: Verificar estabilidad, reconexión automática y arranque autónomo de la Pico W.
- Qué se hizo: Se agregó un `PING` MQTT periódico para conservar la sesión, se reinició Mosquitto durante la ejecución y se desconectó y volvió a alimentar la Pico con el programa guardado como `main.py`.
- Topics involucrados: `udfjc/hiles/v1/equipo1/pico01/led/comando`, `led/estado` y `estado/conexion`.
- Archivos creados o modificados: `pico/mqtt_led.py`, `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`; `main.py` actualizado en la placa.
- Configuración utilizada, sin secretos: keepalive MQTT de 30 segundos, `PING` cada 15 segundos y reintento después de 3 segundos.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se mantuvo la sesión sin caídas periódicas, se reinició el servicio Mosquitto y la Pico recuperó la conexión; después se retiró y restableció la alimentación USB y se envió un nuevo comando sin ejecutar manualmente el archivo desde Thonny.
- Resultado esperado: La Pico recupera Wi-Fi y MQTT automáticamente y vuelve a procesar comandos después de una caída o reinicio.
- Resultado obtenido: Reconexión automática, arranque de `main.py` y control posterior del LED verificados correctamente.
- Evidencia: observación de los mensajes de reconexión, respuesta MQTT posterior y funcionamiento visual del LED.
- Uso de la Pico: bloque físico completado.
- Riesgos, pendientes o reversión necesaria: Guardar y referenciar la captura y el video final si todavía no se han almacenado.
- Entrega a la siguiente persona: La Pico queda lista para la prueba completa con la aplicación web.

---

### [2026-10-08 18:45] — Responsable: Felipe Prado

- Estado: Hecho
- Área: Pico / MQTT / pruebas
- Tarea o problema: Verificar desde un segundo cliente que la Pico publique su estado de conexión y la confirmación física del LED.
- Qué se hizo: Un cliente `mosquitto_sub` del PC escuchó `led/estado`, `estado/conexion` y `error` mientras la Pico ejecutaba `main.py`; después se envió el comando de encendido con `id_mensaje`.
- Topics involucrados: `udfjc/hiles/v1/equipo1/pico01/led/estado` y `udfjc/hiles/v1/equipo1/pico01/estado/conexion`.
- Archivos creados o modificados: `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: broker local en MQTT `1883`, cliente de la placa `pico01` y autenticación habilitada.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se observaron los mensajes retenidos de inicio y conexión, y después la respuesta al comando `cmd-001` desde una terminal independiente.
- Resultado esperado: La Pico publica disponibilidad y confirma el estado real del LED conservando el identificador del comando.
- Resultado obtenido: Se recibió `{"conectado":true,"dispositivo":"pico01"}` y `{"encendido":true,"accion_aplicada":"encender","id_mensaje":"cmd-001"}`.
- Evidencia: salida completa de `mosquitto_sub` compartida durante la prueba.
- Uso de la Pico: bloque físico en curso.
- Riesgos, pendientes o reversión necesaria: Falta ejecutar una prueba controlada de reconexión reiniciando el broker y verificar el arranque autónomo después de retirar la alimentación.
- Entrega a la siguiente persona: Continuar con reconexión controlada y evidencia de arranque automático.

---

### [2026-10-08 18:31] — Responsable: Felipe Prado, apoyo Kevin Rincon

- Estado: Hecho
- Área: broker / Pico / MicroPython / MQTT / pruebas
- Tarea o problema: Conectar la Pico W al broker, recibir comandos JSON y controlar físicamente el LED.
- Qué se hizo: Se instaló `micropython-umqtt.simple` 1.3.4, se conectó la Pico autenticada a Mosquitto, se suscribió a `led/comando` y se ejecutaron las acciones `encender`, `apagar` y `titilar`. El programa funcional se guardó como `main.py` para arrancar automáticamente.
- Topics involucrados: `udfjc/hiles/v1/equipo1/pico01/led/comando`; el programa también implementa `led/estado`, `estado/conexion` y `error`, pendientes de evidencia de recepción en el PC.
- Archivos creados o modificados: `pico/mqtt_led.py`, `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`; en la placa, `main.py` y `config_local.py`.
- Configuración utilizada, sin secretos: broker `192.168.137.106:1883`, Pico conectada en la red `192.168.137.0/24`, cliente `pico01` y autenticación local.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Desde `mosquitto_pub` se enviaron mensajes JSON válidos con identificadores distintos. Thonny mostró cada mensaje recibido y el LED integrado encendió, apagó y titiló visiblemente. También se comprobó que un JSON mal formado se rechaza con diagnóstico.
- Resultado esperado: La Pico interpreta el campo `accion` y controla el LED sin intervención manual en Thonny.
- Resultado obtenido: Las tres acciones se ejecutaron correctamente y el programa quedó guardado como `main.py`.
- Evidencia: salida de Thonny y observación visual del LED durante las tres acciones.
- Uso de la Pico: bloque físico realizado durante la integración local.
- Riesgos, pendientes o reversión necesaria: Falta capturar la recepción de `led/estado` y `estado/conexion`, probar la reconexión reiniciando Mosquitto, verificar el arranque tras desconectar la placa y guardar video/capturas finales.
- Entrega a la siguiente persona: Kevin Rincon debe cerrar WebSockets y la ficha de conexión; Felipe Prado debe completar evidencia de publicaciones, reconexión y arranque autónomo.

---

### [2026-10-08 17:15] — Responsable: Felipe Prado, apoyo Kevin Rincon

- Estado: Hecho
- Área: broker / Pico / red / pruebas
- Tarea o problema: Verificar que la Pico alcance por red el listener MQTT del PC antes de instalar el cliente MQTT.
- Qué se hizo: Se inició Mosquitto, se habilitó en el Firewall de Windows el acceso desde la subred local y se abrió una conexión TCP desde la Pico hacia el puerto `1883` del broker.
- Topics involucrados: no aplica; prueba de transporte TCP previa a MQTT.
- Archivos creados o modificados: `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: broker `192.168.137.106:1883`, Pico `192.168.137.216/24`, reglas restringidas a `192.168.137.0/24`.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se comprobó `Running` con `Get-Service`, `LISTENING` en `1883` y `9001` con `netstat`, y se abrió un socket TCP desde MicroPython hacia `192.168.137.106:1883` con timeout de cinco segundos.
- Resultado esperado: La Pico debe poder establecer una conexión TCP con Mosquitto sin timeout ni rechazo del firewall.
- Resultado obtenido: La Pico mostró `La Pico puede llegar a Mosquitto por el puerto 1883`.
- Evidencia: captura del servicio y listeners en Windows, más salida del Shell de Thonny.
- Uso de la Pico: bloque físico en curso.
- Riesgos, pendientes o reversión necesaria: La IPv4 del PC depende del hotspot y debe verificarse después de cada reconexión. Falta instalar `umqtt.simple` y autenticar una sesión MQTT real.
- Entrega a la siguiente persona: Continuar con la instalación y prueba de `umqtt.simple` en la Pico.

---

### [2026-10-08 17:05] — Responsable: Felipe Prado

- Estado: Hecho
- Área: Pico / MicroPython / Wi-Fi / pruebas
- Tarea o problema: Crear la configuración local sin publicar secretos y conectar la Pico W al Wi-Fi con timeout y diagnóstico.
- Qué se hizo: Se guardó `config_local.py` únicamente en la Pico y se ejecutó una prueba independiente que activa la interfaz Wi-Fi, informa el estado durante la conexión y cancela el intento después de 20 segundos si no obtiene red.
- Topics involucrados: no aplica.
- Archivos creados o modificados: `pico/.gitignore`, `pico/config_local.example.py`, `pico/wifi_test.py`, `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: Pico `192.168.137.216/24`, puerta de enlace `192.168.137.1` y configuración MQTT local excluida de Git.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se ejecutó `wifi_test.py` desde Thonny y se observó la transición de los estados `1` y `2` hasta obtener una dirección IPv4.
- Resultado esperado: La Pico se conecta antes del timeout y muestra su configuración de red sin imprimir credenciales.
- Resultado obtenido: Conexión Wi-Fi exitosa; la Pico recibió `192.168.137.216` con máscara `255.255.255.0`.
- Evidencia: salida de Thonny compartida durante la prueba.
- Uso de la Pico: bloque físico en curso.
- Riesgos, pendientes o reversión necesaria: La dirección del PC puede cambiar al reconectarse al hotspot; se debe confirmar antes de cada demostración. Mosquitto está detenido y faltan reglas de firewall para aceptar conexiones desde la Pico.
- Entrega a la siguiente persona: Kevin Rincon debe iniciar Mosquitto, permitir `1883` y `9001` desde `192.168.137.0/24` y comunicar la IPv4 vigente del PC.

---

### [2026-10-08 16:47] — Responsable: Felipe Prado

- Estado: Hecho
- Área: Pico / MicroPython / pruebas
- Tarea o problema: Comprobar el LED integrado de forma independiente antes de agregar Wi-Fi o MQTT.
- Qué se hizo: Desde el REPL de Thonny se creó el pin `LED` como salida y se ejecutaron las operaciones de encendido y apagado.
- Topics involucrados: no aplica.
- Archivos creados o modificados: `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: Raspberry Pi Pico W con MicroPython `v1.28.0`; LED integrado mediante `machine.Pin("LED", machine.Pin.OUT)`.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se ejecutaron `led.on()` y `led.off()` desde el prompt interactivo de MicroPython.
- Resultado esperado: El LED integrado debe encenderse y apagarse según la instrucción enviada desde Thonny.
- Resultado obtenido: El LED respondió correctamente a ambas instrucciones.
- Evidencia: confirmación visual del usuario durante la prueba.
- Uso de la Pico: bloque físico en curso.
- Riesgos, pendientes o reversión necesaria: Ninguno para el LED; falta configurar las credenciales locales y conectar la Pico al Wi-Fi.
- Entrega a la siguiente persona: Continuar con una configuración local de Wi-Fi y MQTT excluida de Git.

---

### [2026-10-08 16:35] — Responsable: Felipe Prado

- Estado: Hecho
- Área: Pico / MicroPython
- Tarea o problema: Confirmar el modelo físico de la placa y verificar la instalación de MicroPython.
- Qué se hizo: Se confirmó visualmente que la placa disponible es una Raspberry Pi Pico W, no una Pico 2 W. Thonny estableció comunicación con la placa y el REPL inició correctamente.
- Topics involucrados: no aplica.
- Archivos creados o modificados: `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: MicroPython `v1.28.0` del 2026-04-06 para Raspberry Pi Pico W con RP2040.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: La consola de Thonny mostró `MPY: soft reboot`, la versión de MicroPython, la identificación `Raspberry Pi Pico W with RP2040` y el prompt interactivo `>>>`.
- Resultado esperado: La placa debe arrancar MicroPython y responder mediante el REPL USB.
- Resultado obtenido: Firmware correcto y REPL operativo.
- Evidencia: salida de la consola de Thonny compartida durante la prueba.
- Uso de la Pico: bloque físico en curso.
- Riesgos, pendientes o reversión necesaria: Falta comprobar el LED integrado, Wi-Fi, librería MQTT y flujo con el broker.
- Entrega a la siguiente persona: Continuar con la prueba independiente del LED integrado.

---

### [2026-10-08 16:17] — Responsable: Kevin Rincon

- Estado: Hecho
- Área: broker / pruebas / documentación
- Tarea o problema: Instalar y dejar reproducible el broker local con autenticación y los listeners requeridos por la Pico y la web.
- Qué se hizo: Se instaló Eclipse Mosquitto 2.1.2, se configuraron los listeners MQTT `1883` y WebSocket `9001`, se creó una cuenta local de desarrollo y se corrigieron los permisos de lectura del archivo de contraseñas para el servicio de Windows. También se agregaron al repositorio una configuración de ejemplo y las instrucciones operativas sin secretos.
- Topics involucrados: `udfjc/hiles/prueba`; queda documentado `udfjc/hiles/prueba-websocket` para la comprobación WebSocket.
- Archivos creados o modificados: `mosquitto/.gitignore`, `mosquitto/mosquitto.conf.example`, `mosquitto/README.md`, `PLAN_MQTT_PICO.md` y `REGISTRO_CAMBIOS_MQTT_PICO.md`.
- Configuración utilizada, sin secretos: host local `localhost`, MQTT `1883`, WebSocket `9001`, acceso anónimo deshabilitado y credenciales almacenadas exclusivamente fuera del repositorio.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se verificó que el servicio estuviera en estado `Running`, que ambos puertos estuvieran escuchando en `0.0.0.0` y que un cliente `mosquitto_pub` entregara un mensaje JSON a un cliente `mosquitto_sub` autenticado por el puerto `1883`.
- Resultado esperado: El broker inicia automáticamente, exige autenticación, acepta MQTT en `1883` y queda preparado para MQTT sobre WebSockets en `9001`.
- Resultado obtenido: Servicio activo, listeners `1883` y `9001` activos y prueba PUB/SUB autenticada en `1883` exitosa.
- Evidencia: salida de `Get-Service mosquitto`, `netstat` y mensaje JSON recibido en la terminal suscriptora.
- Uso de la Pico: no requerido.
- Riesgos, pendientes o reversión necesaria: Falta probar PUB/SUB real por WebSockets en `9001`, escoger la red de demostración, definir la IPv4 del broker, configurar el Firewall de Windows y validar la conexión desde otro equipo y desde la Pico.
- Entrega a la siguiente persona: La configuración local queda documentada; host definitivo y acceso desde la Pico se entregarán cuando se acuerde la red de demostración.

---

### [2026-10-08 13:40] — Responsable: Julian Romero

- Estado: Pendiente
- Área: web MQTT / pruebas / documentación
- Tarea o problema: Verificar la implementación del cliente MQTT de la aplicación web antes de marcar sus tareas como completadas.
- Qué se hizo: Se auditó la capa MQTT del frontend. El cliente usa MQTT sobre WebSockets, mantiene una instancia centralizada, expone los estados `DISCONNECTED`, `CONNECTING`, `CONNECTED` y `ERROR`, permite conectar y desconectar, reintenta la conexión, vuelve a suscribirse al reconectar, publica comandos JSON para el LED y muestra mensajes recibidos en una interfaz mínima. La configuración se mantiene fuera del código mediante variables `VITE_MQTT_*`.
- Topics involucrados: `udfjc/hiles/v1/equipo1/pico01/led/comando`, `led/estado`, `estado/conexion`, `telemetria`, `error`; los topics restantes del contrato también están centralizados en `MQTT_TOPICS`.
- Archivos creados o modificados: `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/App.tsx`, `frontend/src/features/mqtt/MqttPanel.tsx`, `frontend/src/services/mqtt/MqttClient.ts`, `frontend/src/services/mqtt/config.ts`, `frontend/src/services/mqtt/config.test.ts`, `frontend/vitest.config.ts`, `frontend/.env.example`.
- Configuración utilizada, sin secretos: host `localhost`, WebSocket `9001`, ruta `/mqtt`, protocolo `ws`; usuario y contraseña únicamente mediante variables de entorno ficticias.
- Rama: `mqtt-pico`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se ejecutaron `npm run`, `npm run test:run`, `npm run lint`, `npm run build` y `git diff --check`. Se revisó la separación entre MQTT, MotorSimulacion, EjecutorCodigo y BusObserver. También se comprobó que no existe `.env` real versionado ni una IP personal hardcodeada.
- Resultado esperado: El frontend debe compilar, pasar sus pruebas y quedar preparado para conectarse al broker local por WebSockets en el puerto `9001`, sin alterar la semántica del motor HiLeS.
- Resultado obtenido: `31/31` pruebas aprobadas, lint correcto, build correcto y separación arquitectónica confirmada. Mosquitto no está disponible en el entorno, por lo que no se pudo ejecutar la prueba real de publicación/suscripción.
- Evidencia: logs de `npm run test:run`, `npm run lint` y `npm run build`; no hay captura ni video de la prueba física todavía.
- Uso de la Pico: no requerido para la auditoría de código; bloque físico pendiente.
- Riesgos, pendientes o reversión necesaria: Falta validar Web → Mosquitto → Pico → Mosquitto → Web, la reconexión contra un broker real y la evidencia visual. La validación estricta de esquemas JSON y la integración con un `Service` corresponden posteriormente a Juan David Romero.
- Entrega a la siguiente persona: Kevin Rincon debe proporcionar Mosquitto con listeners `1883` y `9001`; Felipe Prado debe proporcionar la Pico conectada; Juan David Romero debe completar la validación JSON, la integración con `Service` y el cierre de evidencias.

