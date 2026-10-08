# Registro de cambios — Integración HiLeS, MQTT y Pico 2 W

Este archivo reúne los informes de trabajo de la entrega. Se debe actualizar cada vez que una persona complete, corrija o pruebe una tarea definida en [`PLAN_MQTT_PICO.md`](PLAN_MQTT_PICO.md).

No se deben eliminar entradas anteriores. Si una prueba cambia de resultado, se agrega una entrada nueva que explique la corrección.

## Reglas del registro

- Usar únicamente `Persona 1`, `Persona 2`, `Persona 3` o `Persona 4` como responsable.
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

- Estado: [ ] Pendiente / [x] Hecho / [!] Bloqueado
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

- Estado: [!] Bloqueado
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

---

## Seguimiento por persona

Esta sección resume el avance. El detalle y la evidencia deben permanecer en las entradas cronológicas.

### Persona 1 — Mosquitto, red y configuración

- Estado general: [ ] Pendiente / [ ] En progreso / [ ] Terminado
- [ ] Broker Mosquitto instalado o verificado.
- [ ] Listener MQTT `1883` funcionando.
- [ ] Listener WebSocket `9001` funcionando.
- [ ] Autenticación local configurada sin publicar secretos.
- [ ] Prueba PUB/SUB entre clientes de escritorio.
- [ ] Dirección local y puertos comunicados al equipo.
- [ ] Instrucciones de inicio, detención y diagnóstico documentadas.
- [ ] Conexión real de la Pico validada junto con Persona 2.
- Último commit/hash:
- Evidencia principal:
- Pendiente principal:

### Persona 2 — Pico 2 W, MicroPython, Wi-Fi y MQTT

- Estado general: [ ] Pendiente / [ ] En progreso / [ ] Terminado
- [ ] Versión de MicroPython registrada.
- [ ] Blink independiente comprobado.
- [ ] Wi-Fi conectado con timeout y diagnóstico.
- [ ] Cliente `umqtt` conectado a Mosquitto.
- [ ] Suscripción a `led/comando` funcionando.
- [ ] JSON recibido y validado.
- [ ] Acciones encender, apagar y titilar implementadas.
- [ ] Confirmación publicada por `led/estado`.
- [ ] Estado publicado por `estado/conexion`.
- [ ] Reconexión básica de Wi-Fi y MQTT probada.
- [ ] Video o evidencia de la Pico física guardado.
- Último commit/hash:
- Evidencia principal:
- Pendiente principal:

### Persona 3 — Cliente MQTT de la aplicación web

- Estado general: [ ] Pendiente / [ ] En progreso / [ ] Terminado
- [ ] Dependencia MQTT del navegador agregada.
- [ ] Configuración del broker separada del código fuente.
- [ ] Conexión WebSocket al puerto `9001`.
- [ ] Estados de conexión visibles en español.
- [ ] Publicación de `led/comando`.
- [ ] Suscripción a `led/estado`.
- [ ] Suscripción a `estado/conexion`, `telemetria` y `error`.
- [ ] Reconexión y resuscripción comprobadas.
- [ ] Control mínimo del LED en la interfaz.
- [ ] Mensajes simulados probados sin requerir la Pico.
- Último commit/hash:
- Evidencia principal:
- Pendiente principal:

### Persona 4 — Contrato JSON, integración HiLeS, pruebas y cierre

- Estado general: [ ] Pendiente / [ ] En progreso / [ ] Terminado
- [ ] Topics centralizados.
- [ ] Tipos y validación de mensajes JSON implementados.
- [ ] Errores MQTT mostrados de manera comprensible.
- [ ] Integración de al menos un `Service` con MQTT.
- [ ] Prueba MQTT → `Service` o `Service` → MQTT.
- [ ] Cambios de las otras personas revisados antes de integrar.
- [ ] Pruebas automatizadas ejecutadas.
- [ ] Lint ejecutado.
- [ ] Build ejecutado.
- [ ] Guion y evidencia final preparados.
- [ ] Ensayo completo coordinado.
- Último commit/hash:
- Evidencia principal:
- Pendiente principal:

---

## Registro de uso de la Pico 2 W

| Fecha | Hora inicial | Hora final | Responsable del bloque | Objetivo | Resultado | Evidencia |
|---|---|---|---|---|---|---|
| 2026-10-08 | Pendiente | Pendiente | Persona 2, apoyo Persona 1 | MicroPython, Wi-Fi, Mosquitto y LED | Pendiente | Pendiente |
| 2026-10-09 | Pendiente | Pendiente | Persona 2, apoyo Persona 3 | Integración completa con la web | Pendiente | Pendiente |

---

## Matriz de pruebas de integración

| Prueba | Responsable | Estado | Resultado y evidencia |
|---|---|---|---|
| Mosquitto inicia con listeners `1883` y `9001` | Persona 1 | [ ] | Pendiente |
| Cliente A publica y cliente B recibe | Persona 1 | [ ] | Pendiente |
| Pico se conecta al Wi-Fi | Persona 2 | [ ] | Pendiente |
| Pico se conecta a MQTT | Persona 2 | [ ] | Pendiente |
| JSON en `led/comando` enciende el LED | Persona 2 | [ ] | Pendiente |
| Pico confirma por `led/estado` | Persona 2 | [ ] | Pendiente |
| Web se conecta por WebSockets | Persona 3 | [ ] | Pendiente |
| Web recibe un mensaje MQTT simulado | Persona 3 | [ ] | Pendiente |
| Web controla el LED físico | Personas 2 y 3 | [ ] | Pendiente |
| Pico apagada se muestra como desconectada | Personas 2 y 3 | [ ] | Pendiente |
| Recuperación después de reiniciar Mosquitto | Personas 1, 2 y 3 | [ ] | Pendiente |
| MQTT se integra con un `Service` HiLeS | Persona 4 | [ ] | Pendiente |
| Mensaje JSON inválido no detiene el sistema | Personas 2, 3 y 4 | [ ] | Pendiente |
| Pruebas del frontend | Persona 4 | [ ] | Pendiente |
| Lint del frontend | Persona 4 | [ ] | Pendiente |
| Build del frontend | Persona 4 | [ ] | Pendiente |
| Demostración grabada de respaldo | Persona 4 | [ ] | Pendiente |

---

## Revisión consolidada de la entrega

Completar esta sección el viernes después del ensayo final.

- Estado: [ ] Pendiente / [ ] Aprobada / [ ] Rechazada
- Fecha y hora de revisión:
- Rama integrada:
- Commit final:
- Alcance P0 completado:
- Funcionalidades P1 incluidas:
- Pruebas ejecutadas:
- Resultado de pruebas:
- Resultado de lint:
- Resultado de build:
- Flujo físico verificado:
- Evidencia final:
- Riesgos conocidos aceptados:
- Pendientes para la siguiente entrega:
- Responsable del envío final: Persona N
- Hora de envío:

### Checklist de aprobación

- [ ] La aplicación web se conecta a Mosquitto.
- [ ] La Pico se conecta a Mosquitto.
- [ ] La web controla el LED mediante un mensaje JSON.
- [ ] La Pico publica la confirmación y la web la muestra.
- [ ] Existe integración con al menos un `Service` HiLeS.
- [ ] No hay credenciales ni secretos en Git.
- [ ] Los errores están manejados sin detener el sistema.
- [ ] Pruebas, lint y build no presentan errores nuevos.
- [ ] Los cuatro informes tienen evidencia y commit/hash.
- [ ] Existe video de respaldo de la demostración.
- [ ] El plan y este registro reflejan el estado real de la entrega.

