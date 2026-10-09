# Plan de trabajo — Integración HiLeS, MQTT y Raspberry Pi Pico W

## Explicación general

En esta entrega vamos a agregar comunicación real entre HiLeS y una Raspberry Pi Pico W. La aplicación web y la Pico no se conectarán directamente: ambas serán clientes de un broker MQTT Mosquitto ejecutado en un computador de la red local.

La web enviará comandos y mensajes JSON por topics MQTT. La Pico, programada con MicroPython, recibirá esos mensajes, ejecutará una acción sencilla —inicialmente controlar el LED— y publicará de vuelta su estado, telemetría o errores. El LED también servirá como evidencia física de que la Pico está recibiendo o transmitiendo información.

```text
Aplicación HiLeS
       │ MQTT sobre WebSockets (puerto 9001)
       ▼
Mosquitto local
       ▲
       │ MQTT (puerto 1883)
Raspberry Pi Pico W + MicroPython
```

Mosquitto local es un broker MQTT real, no una simulación. Para esta entrega funcionará dentro de la misma red Wi-Fi. Dejar la solución preparada para cambiar posteriormente a un broker en línea será parte del diseño, pero no se debe bloquear la entrega intentando desplegar infraestructura cloud antes de validar el flujo local.

**Prueba intermedia: jueves 8 de octubre de 2026.**

**Entrega final: viernes 9 de octubre de 2026, 8:00 p. m. (hora de Colombia).**

Cada avance, prueba, bloqueo y commit debe registrarse en [`REGISTRO_CAMBIOS_MQTT_PICO.md`](REGISTRO_CAMBIOS_MQTT_PICO.md). Una tarea no se marca como terminada en este plan hasta que tenga su informe y evidencia.

---

## Objetivo no negociable

Demostrar un flujo bidireccional real:

```text
Web HiLeS publica comando JSON
    → Mosquitto
        → Pico recibe el comando
            → cambia el LED
            → publica confirmación JSON
                → Mosquitto
                    → Web HiLeS muestra el nuevo estado
```

La entrega no se considera terminada si solamente funciona Mosquitto desde dos terminales. Deben conectarse tanto la aplicación web como la Pico física.

---

## Alcance P0 de la entrega

- [x] Mosquitto ejecutándose localmente con listener MQTT en `1883` y WebSockets en `9001`.
- [x] Topics y mensajes JSON documentados en español.
- [x] Pico W con MicroPython, conexión Wi-Fi y conexión MQTT.
- [x] Reconexión básica de Wi-Fi y MQTT sin tener que reiniciar manualmente la placa.
- [ ] Web HiLeS conectada a Mosquitto mediante MQTT sobre WebSockets.
- [ ] Comando web → Pico para encender, apagar o hacer titilar el LED.
- [ ] Confirmación Pico → web con el estado real del LED.
- [ ] Estado de conexión de la Pico visible en la web.
- [x] Un punto de integración con HiLeS mediante un `Service`, sin sustituir el bus interno del motor.
- [ ] Evidencia reproducible: capturas, consola/log, video corto y pasos para ejecutar.
- [x] Build, lint y pruebas existentes del frontend sin errores nuevos.

## Alcance P1 si P0 queda estable

- [ ] Publicar desde la web un modelo HiLeS pequeño en JSON.
- [ ] Hacer que la Pico valide el identificador y la versión del modelo.
- [ ] Responder con aceptación o error mediante `modelo/confirmacion`.
- [ ] Ejecutar en MicroPython una regla sencilla del modelo, no el motor HiLeS completo.

## Fuera de alcance para este viernes

- Portar todo el motor HiLeS TypeScript a MicroPython.
- Ejecutar cualquier diagrama arbitrario en la Pico.
- Broker cloud definitivo, certificados de producción y dominio propio.
- Base de datos, históricos y panel completo de administración IoT.
- Sensores adicionales si el flujo con el LED todavía no es estable.

---

## Contrato inicial de topics

Los nombres están en español, pero se escriben sin tildes, espacios ni mayúsculas para evitar incompatibilidades.

Prefijo común:

```text
udfjc/hiles/v1/equipo1/pico01/
```

### Web → Pico

| Topic | Propósito |
|---|---|
| `led/comando` | Encender, apagar o hacer titilar el LED |
| `simulacion/comando` | Iniciar, detener, reiniciar o ejecutar un paso |
| `entrada/establecer` | Enviar una entrada externa de HiLeS |
| `modelo/cargar` | Enviar un modelo pequeño en JSON, solo si se alcanza P1 |

### Pico → web

| Topic | Propósito |
|---|---|
| `led/estado` | Confirmar el estado físico del LED |
| `estado/conexion` | Informar si la Pico está disponible |
| `telemetria` | Informar RSSI, memoria o tiempo activo |
| `salida` | Publicar una salida de la ejecución HiLeS |
| `error` | Reportar errores de Wi-Fi, MQTT, JSON o ejecución |
| `modelo/confirmacion` | Confirmar o rechazar el modelo recibido, solo P1 |

Ejemplo de comando:

```json
{
  "accion": "encender",
  "id_mensaje": "cmd-001"
}
```

Ejemplo de respuesta:

```json
{
  "encendido": true,
  "accion_aplicada": "encender",
  "id_mensaje": "cmd-001"
}
```

---

## Hito de mañana — jueves 8 de octubre

Antes de terminar el jueves debe existir esta prueba mínima:

1. Mosquitto inicia sin errores.
2. Dos clientes de escritorio pueden publicar y suscribirse.
3. La Pico se conecta al Wi-Fi.
4. La Pico se conecta a Mosquitto.
5. Al publicar un JSON en `led/comando`, la Pico cambia el LED.
6. La Pico responde por `led/estado`.
7. Se guarda evidencia del flujo completo.

La interfaz HiLeS puede continuar en desarrollo durante esta prueba. Para el hito del jueves se permite publicar el comando desde un cliente MQTT de escritorio o terminal.

---

## Distribución del trabajo — 4 personas

### Kevin Rincon — Mosquitto, red y configuración compartida

**Trabajo sin Pico:** casi todo. Solo requiere un bloque corto con la Pico para validar la conexión real.

**Responsabilidades:**

- [x] Instalar o verificar Mosquitto en el computador que actuará como broker.
- [x] Crear una configuración reproducible con listeners `1883` y `9001`.
- [x] Definir la IP local que utilizarán los clientes durante la demostración y documentar su verificación previa.
- [x] Configurar usuario y contraseña de desarrollo sin subir secretos al repositorio.
- [x] Probar publicación y suscripción desde dos clientes de escritorio.
- [x] Entregar a las otras personas host, puertos y formatos de configuración local; las credenciales se comparten por privado.
- [x] Documentar cómo iniciar, detener y comprobar Mosquitto.
- [x] Apoyar a Felipe Prado durante la primera conexión real de la Pico.

**Entrega del jueves:** broker local operativo y prueba PUB/SUB desde escritorio.

**Criterio de aceptación:** otro integrante puede iniciar el broker siguiendo únicamente la documentación.

---

### Felipe Prado — Pico W, MicroPython, Wi-Fi y MQTT

**Trabajo con Pico:** responsable principal de los bloques físicos reservados.

**Responsabilidades:**

- [x] Verificar o instalar el firmware MicroPython compatible con Pico W.
- [x] Ejecutar una prueba independiente de blink antes de agregar red.
- [x] Crear la configuración local de Wi-Fi y MQTT sin subir credenciales.
- [x] Conectar la Pico al Wi-Fi con timeout y mensajes de diagnóstico.
- [x] Conectar la Pico a Mosquitto usando `umqtt`.
- [x] Suscribirse a `led/comando` e interpretar el JSON.
- [x] Encender, apagar o hacer titilar el LED según `accion`.
- [x] Publicar la confirmación en `led/estado`.
- [x] Publicar `estado/conexion` al conectarse.
- [x] Implementar reconexión básica de Wi-Fi y MQTT.
- [x] Entregar logs y video corto de la prueba física.

**Entrega del jueves:** Pico conectada al broker y comando JSON controlando el LED.

**Criterio de aceptación:** desconectar y volver a encender la Pico no exige editar código para recuperar la comunicación.

---

### Julian Romero — Cliente MQTT de la aplicación web

**Trabajo sin Pico:** completo hasta la integración final. Puede usar clientes MQTT de escritorio y mensajes simulados.

**Responsabilidades:**

- [x] Agregar el cliente MQTT del navegador como dependencia del frontend.
- [x] Crear una capa de conexión MQTT separada del motor HiLeS.
- [x] Permitir configurar host, puerto WebSocket, usuario y contraseña fuera del código fuente.
- [x] Conectar mediante `ws://` al listener local `9001`.
- [x] Mostrar estados: desconectado, conectando, conectado y error.
- [x] Publicar comandos JSON en `led/comando`.
- [x] Suscribirse a `led/estado`, `estado/conexion`, `telemetria` y `error`.
- [x] Reintentar la conexión y volver a suscribirse cuando regrese el broker.
- [x] Crear una interfaz mínima para controlar el LED y ver la respuesta.
- [x] Mantener el bus `BusObserver` actual funcionando sin cambios de semántica.

**Entrega del jueves:** cliente web capaz de conectarse al broker, aunque todavía use mensajes generados desde escritorio.

**Criterio de aceptación:** la web refleja correctamente un mensaje JSON publicado externamente en `led/estado`.

---

### Juan David Romero — Contrato JSON, integración HiLeS, pruebas y cierre

**Trabajo sin Pico:** casi todo. Coordina los bloques finales de validación física.

**Responsabilidades:**

- [x] Centralizar los topics para que no queden textos MQTT repetidos por toda la aplicación.
- [x] Definir tipos TypeScript y ejemplos para cada mensaje JSON.
- [x] Validar mensajes entrantes y mostrar errores comprensibles en español.
- [x] Integrar MQTT con un `Service` de HiLeS como frontera con el mundo exterior.
- [x] Preparar una prueba en la que una entrada MQTT llegue al motor o una salida del motor se publique por MQTT.
- [x] Preparar mensajes de prueba independientes de la Pico para no bloquear el desarrollo web.
- [x] Integrar únicamente cambios revisados de las otras tres personas.
- [x] Ejecutar pruebas, lint y build.
- [x] Preparar el guion de demostración, checklist y matriz de evidencias.
- [ ] Coordinar el ensayo completo del viernes.

Contrato y ejemplos: [`CONTRATO_MENSAJES_MQTT.md`](CONTRATO_MENSAJES_MQTT.md). Guion, checklist y matriz de evidencia: [`GUIA_DEMO_MQTT_HILES.md`](GUIA_DEMO_MQTT_HILES.md). El ensayo físico permanece pendiente hasta ejecutarlo con las cuatro personas, el broker y la Pico disponibles.

**Entrega del jueves:** contrato de topics/JSON cerrado y pruebas simuladas disponibles para el frontend.

**Criterio de aceptación:** los cuatro integrantes usan exactamente los mismos topics y estructura JSON.

---

## Uso coordinado de la única Pico W

La Pico no debe circular entre responsables durante todo el día. Se reserva por bloques con un propietario claro.

### Jueves — Bloque físico 1, aproximadamente 2 horas

**Participan:** Felipe Prado como responsable y Kevin Rincon como apoyo.

- Instalar/verificar MicroPython.
- Probar blink.
- Conectar al Wi-Fi.
- Conectar a Mosquitto.
- Ejecutar comando y respuesta con un cliente de escritorio.
- Grabar evidencia antes de terminar el bloque.

Mientras tanto, Julian Romero y Juan David Romero trabajan sin Pico usando mensajes MQTT simulados.

### Viernes — Bloque físico 2, aproximadamente 2 horas

**Participan:** Felipe Prado y Julian Romero; Juan David Romero dirige el checklist.

- Sustituir el cliente de escritorio por la aplicación HiLeS.
- Probar web → broker → Pico → broker → web.
- Probar apagar y encender la Pico.
- Probar una caída breve del broker y recuperación.
- Corregir solamente bloqueadores P0.
- Grabar la evidencia final.

### Viernes — Bloque de ensayo, 45 a 60 minutos

**Participan:** las cuatro personas.

- Ejecutar la demostración desde cero.
- Confirmar quién explica cada parte.
- Guardar una demostración grabada como respaldo.
- Congelar cambios funcionales después del ensayo, salvo errores bloqueantes.

Si los horarios físicos cambian, se conservan los tres bloques y sus objetivos; solo se mueve la hora acordada.

---

## Cronograma de integración

### Miércoles 7 de octubre

- [x] Acordar topics y contrato JSON.
- [ ] Crear ramas de trabajo.
- [x] Preparar configuración Mosquitto.
- [x] Preparar estructura MicroPython sin depender todavía de la Pico.
- [x] Preparar capa MQTT web y mensajes simulados.

### Jueves 8 de octubre — prueba intermedia

- [x] Completar Mosquitto local.
- [x] Completar bloque físico 1.
- [x] Confirmar comando JSON → LED → respuesta JSON.
- [ ] Confirmar conexión web al broker con mensajes simulados.
- [x] Registrar fallos y decidir el alcance real de P1 antes de terminar el día.

### Viernes 9 de octubre — entrega

- [ ] Integrar web y Pico durante el bloque físico 2.
- [x] Conectar al menos un `Service` HiLeS con MQTT.
- [x] Ejecutar pruebas de desconexión y recuperación.
- [x] Ejecutar `npm run test:run`, `npm run lint` y `npm run build` en frontend.
- [ ] Completar documentación y evidencia.
- [ ] Realizar ensayo final.
- [ ] Tener versión entregable congelada a más tardar a las 6:30 p. m.
- [ ] Reservar de 6:30 p. m. a 8:00 p. m. únicamente para empaquetado, revisión y envío.

---

## Reglas de Git

- [ ] Nadie trabaja directamente sobre `main`.
- [ ] El líder crea una rama común de entrega, por ejemplo `entrega-mqtt-pico`.
- [ ] Cada persona crea su rama desde la rama común:

```text
mqtt/persona-1-mosquitto
mqtt/persona-2-pico
mqtt/persona-3-web
mqtt/persona-4-integracion
```

- [x] No subir SSID, contraseña Wi-Fi, usuario MQTT ni contraseña MQTT.
- [ ] No usar `git add .` si existen cambios de otra persona en el directorio.
- [ ] Cada commit representa una unidad comprobable.
- [x] Juan David Romero integra solo commits con evidencia y pasos de prueba.
- [ ] No hacer cambios grandes después del ensayo final.

---

## Criterios de aceptación antes de entregar

- [x] Mosquitto inicia con MQTT y WebSockets.
- [x] La Pico se conecta sin modificar el código en cada ejecución.
- [ ] La web muestra que está conectada al broker.
- [ ] La web enciende y apaga el LED físico mediante JSON.
- [ ] La web recibe la confirmación real publicada por la Pico.
- [x] Los mensajes inválidos no detienen la Pico ni bloquean la web.
- [x] La pérdida temporal del broker o Wi-Fi produce un error comprensible y permite recuperación básica.
- [x] Existe al menos una integración demostrable entre MQTT y un `Service` HiLeS.
- [x] No hay credenciales en Git.
- [x] Pruebas, lint y build no presentan errores nuevos.
- [ ] Existe evidencia grabada de respaldo.
- [x] La documentación permite repetir la prueba en otro computador de la misma red.

---

## Guion corto de demostración

1. Mostrar Mosquitto ejecutándose y explicar los dos puertos.
2. Abrir HiLeS y mostrar el estado conectado.
3. Mostrar que la Pico está encendida y conectada.
4. Publicar `{"accion":"encender"}` desde HiLeS.
5. Mostrar el LED físico encendido.
6. Mostrar en HiLeS la confirmación recibida por `led/estado`.
7. Repetir con apagar o titilar.
8. Mostrar el `Service` conectado con una entrada o salida MQTT.
9. Explicar que el mismo contrato podrá apuntar después a un broker en línea cambiando configuración.

---

## Evidencia obligatoria por persona

Antes de marcar una tarea con `[x]`, cada responsable entrega:

1. Qué implementó y por qué.
2. Archivos creados o modificados.
3. Pasos exactos de prueba.
4. Resultado esperado y resultado obtenido.
5. Captura, log o video cuando corresponda.
6. Hash del commit.
7. Riesgos o pendientes conocidos.

