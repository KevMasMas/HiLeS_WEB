# Ensayo remoto sin Pico física

Esta guía permite comprobar el broker, cuatro navegadores, la sesión compartida
y la actualización del canvas. El motor MicroPython se valida aparte mediante
las pruebas automatizadas del firmware.

## Preparación

1. Confirmar que Mosquitto escucha MQTT en `1883` y WebSockets en `9001`.
2. Iniciar el frontend y abrir cuatro ventanas o navegadores.
3. Importar en **cada navegador** `output/demo-4-semaforos-inteligentes.json`.
   El enlace de sesión comparte `modelo_id` y `version`, pero no contiene el
   diagrama visual.
4. En el primer navegador seleccionar `Pico / MQTT`, usar `cruce-01`, versión
   `1` y copiar el enlace a los otros tres. Seleccionar `Pico / MQTT` ya activa
   la sesión; el botón cambia a **Reintentar conexión** y puede usarse si el
   broker se inició después o la primera conexión falló.
5. En los otros navegadores abrir el enlace y pulsar **Pico / MQTT / Unirse**.

Después de unirse deben verse `Sesión: ACTIVA` y `MQTT: CONNECTED`. El canvas
no cambia todavía: unirse solo establece la sesión y la suscripción. El primer
cambio visual ocurre al recibir una publicación válida de
`simulacion/estado`, como las de la sección siguiente.

## Publicación manual de una instantánea oficial

Definir localmente las credenciales sin escribirlas en el repositorio:

```powershell
$usuario = "USUARIO_MQTT"
$clave = "CONTRASENA_MQTT"
```

Publicar el estado inicial retenido:

```powershell
$estado = '{"modelo_id":"cruce-01","version":1,"secuencia":0,"estado":"lista","elementos":{"norte-rojo":{"tokens":1},"norte-amarillo":{"tokens":0},"norte-verde":{"tokens":0},"sur-rojo":{"tokens":1},"sur-amarillo":{"tokens":0},"sur-verde":{"tokens":0},"este-rojo":{"tokens":1},"este-amarillo":{"tokens":0},"este-verde":{"tokens":0},"oeste-rojo":{"tokens":1},"oeste-amarillo":{"tokens":0},"oeste-verde":{"tokens":0}}}'
$estado | & "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -p 1883 -u $usuario -P $clave -q 1 -r -t "udfjc/hiles/v1/equipo1/pico01/simulacion/estado" -s
```

Después publicar la fase Norte–Sur verde con una secuencia mayor:

```powershell
$estado = '{"modelo_id":"cruce-01","version":1,"secuencia":1,"estado":"pausada","elementos":{"norte-rojo":{"tokens":0},"norte-amarillo":{"tokens":0},"norte-verde":{"tokens":1},"sur-rojo":{"tokens":0},"sur-amarillo":{"tokens":0},"sur-verde":{"tokens":1},"este-rojo":{"tokens":1},"este-amarillo":{"tokens":0},"este-verde":{"tokens":0},"oeste-rojo":{"tokens":1},"oeste-amarillo":{"tokens":0},"oeste-verde":{"tokens":0}}}'
$estado | & "C:\Program Files\mosquitto\mosquitto_pub.exe" -h localhost -p 1883 -u $usuario -P $clave -q 1 -r -t "udfjc/hiles/v1/equipo1/pico01/simulacion/estado" -s
```

Se usa `-s` para que `mosquitto_pub` lea el JSON desde la entrada estándar.
En PowerShell, pasarlo mediante `-m $estado` puede eliminar las comillas dobles
al invocar un ejecutable nativo y dejar retenido un contenido que no es JSON.

Los cuatro navegadores deben mostrar `PAUSADA`, secuencia `1`, Norte y Sur en
verde, y Este y Oeste en rojo. Recargar una ventana debe recuperar el mismo
estado retenido.

## Cobertura automatizada complementaria

```powershell
python -m unittest discover -s firmware/tests -t . -v
cd frontend
npm run test:run
npm run lint
npm run build
```

Las pruebas del firmware recorren `MqttTransport → Node → EngineTask → Node →
MqttTransport`; las del frontend verifican compilación, filtro de secuencia,
recepción remota y exclusión mutua del cruce.
