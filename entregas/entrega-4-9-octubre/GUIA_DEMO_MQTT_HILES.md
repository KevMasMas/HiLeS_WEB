# Guía de demostración y ensayo MQTT–HiLeS

Responsable del checklist: **Juan David Romero**

## 1. Preparación

- [ ] El PC y la Pico W están en la misma red.
- [ ] La IP vigente del PC se confirmó con `ipconfig`.
- [ ] Mosquitto está activo y escucha en `1883` y `9001`.
- [ ] Las credenciales se compartieron por privado y no aparecen en capturas ni archivos versionados.
- [ ] La Pico arranca `main.py`, se conecta y publica `estado/conexion`.
- [ ] En `frontend/.env.local` están `VITE_MQTT_HOST`, `VITE_MQTT_WS_PORT=9001`, `VITE_MQTT_WS_PATH=/mqtt`, usuario y contraseña.
- [ ] Se ejecutó `npm run test:run`, `npm run lint` y `npm run build`.
- [ ] Se abrió la web con `npm run dev` y se importó `output/demo-2-humedad-token.json`.

## 2. Demostración principal: web → Pico → web

1. Juan David explica la ruta: web por WebSockets `9001` → Mosquitto → Pico por MQTT `1883`.
2. En el panel **MQTT local**, pulsar **Conectar** y mostrar el estado **Conectado**.
3. Confirmar que aparece el mensaje de `estado/conexion` de `pico01`.
4. Pulsar **Encender**. Mostrar el LED físico y la confirmación `led/estado` con el mismo `id_mensaje`.
5. Repetir con **Apagar** y **Titilar**.
6. Reiniciar brevemente el broker o la Pico y mostrar la recuperación sin editar código.

Resultado esperado: el panel conserva el control, la Pico ejecuta la acción física y la respuesta JSON vuelve a la web.

## 3. Demostración del Service HiLeS

Con el modelo de humedad importado y la web conectada, publicar desde un cliente MQTT autorizado:

```powershell
mosquitto_pub -h HOST -p 1883 -u USUARIO -P CONTRASENA -t "udfjc/hiles/v1/equipo1/pico01/entrada/establecer" -m '{"servicio_id":"demo2-humidity","valor":70,"id_mensaje":"demo-service-001"}'
```

1. La web debe mostrar: `Entrada MQTT aplicada al Service Humedad: 70.`
2. En el panel de simulación pulsar **Ejecutar**.
3. Comprobar en el canvas que el valor entró por el Service y que el motor actualizó el flujo de tokens.
4. Repetir con un tipo incorrecto, por ejemplo `"valor":"setenta"`. La web debe rechazarlo, mantener el motor estable y publicar un error comprensible.

Esto demuestra que MQTT es la frontera externa del `Service`; el motor y `BusObserver` continúan siendo internos.

## 4. Mensaje inválido

Publicar un comando sin `id_mensaje`:

```powershell
mosquitto_pub -h HOST -p 1883 -u USUARIO -P CONTRASENA -t "udfjc/hiles/v1/equipo1/pico01/led/comando" -m '{"accion":"encender"}'
```

En la web se puede comprobar la validación usando un topic al que esté suscrita, por ejemplo `entrada/establecer`, con un objeto incompleto. El panel debe mostrar un error en español y no entregar el mensaje al motor. En la Pico, un comando inválido debe producir `error` sin detener el ciclo principal.

## 5. Evidencia que se debe guardar

| Evidencia | Responsable | Contenido mínimo |
|---|---|---|
| Captura 1 | Kevin Rincon | Mosquitto activo y listeners `1883`/`9001`. |
| Captura 2 | Julian Romero | Panel web en estado conectado y mensajes recibidos. |
| Video corto | Felipe Prado | Encender, apagar y titilar el LED desde la web. |
| Captura 3 | Juan David Romero | Entrada MQTT aceptada por el Service y cambio visible en el motor. |
| Captura 4 | Juan David Romero | Mensaje inválido rechazado con error en español. |
| Log | Juan David Romero | `39/39` pruebas, lint y build correctos. |

Nombre sugerido: `AAAA-MM-DD_tipo_responsable_descripcion.ext`. Antes de compartir, revisar que no aparezcan contraseñas, SSID ni tokens.

## 6. Ensayo final de 45–60 minutos

1. Kevin inicia y verifica Mosquitto desde cero.
2. Felipe energiza la Pico y confirma reconexión.
3. Julian inicia el frontend y demuestra los comandos del LED.
4. Juan David dirige el checklist, demuestra validación y el `Service`, y anota cada resultado.
5. El equipo repite todo sin ayuda de notas técnicas y graba una versión de respaldo.
6. Si todo P0 funciona, se congelan los cambios funcionales; después solo se corrigen bloqueadores.

### Registro del ensayo físico

- Fecha y hora: pendiente de acordar con las cuatro personas.
- Resultado: pendiente de ejecución con broker y Pico disponibles.
- Bloqueadores encontrados: pendiente.
- Ubicación del video/capturas: pendiente.

No se debe marcar el ensayo físico como terminado hasta completar estos cuatro campos.
