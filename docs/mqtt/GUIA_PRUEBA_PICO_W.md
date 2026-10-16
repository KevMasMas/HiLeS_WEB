# Guía de despliegue y prueba en Raspberry Pi Pico W

Esta guía parte del paquete `output/hiles-pico-w-deploy.zip`. El ZIP contiene
el runtime general HiLeS; no contiene contraseñas ni un `config_local.py` real.

## 1. Antes de conectar la Pico

1. Encender Mosquitto en el PC y comprobar los puertos `1883` y `9001`:

   ```powershell
   Test-NetConnection localhost -Port 1883
   Test-NetConnection localhost -Port 9001
   ```

2. Conectar el PC y la Pico a una red en la que ambos dispositivos puedan
   comunicarse. Una red institucional puede aislar clientes; para la
   demostración suele ser más predecible usar un router o punto de acceso
   conocido.
3. Ejecutar `ipconfig` y anotar la IPv4 del adaptador que comparte red con la
   Pico. No usar `localhost`, `127.0.0.1` ni la dirección de un adaptador
   virtual.
4. Permitir conexiones TCP entrantes al broker en el Firewall de Windows,
   especialmente al puerto `1883` usado por la Pico. El navegador utiliza
   `9001` por WebSockets.

Con `frontend/.env.local` configurado, se puede comprobar el reparto real del
broker a cuatro clientes WebSocket antes de conectar la placa:

```powershell
node .\scripts\test-mqtt-four-clients.mjs
```

Debe informar `MQTT_CUATRO_CLIENTES_OK`. La publicación de esta prueba no es
retenida y no reemplaza el estado oficial guardado en Mosquitto.

## 2. Preparar MicroPython

1. Conectar la Pico W mediante un cable USB de datos manteniendo presionado
   `BOOTSEL` si todavía no tiene MicroPython.
2. Instalar el firmware estable de MicroPython para **Raspberry Pi Pico W**.
3. Abrir Thonny y seleccionar el intérprete `MicroPython (Raspberry Pi Pico)`.
4. Instalar `umqtt.simple`. Se puede hacer desde el administrador de paquetes
   de Thonny o, con la placa conectada a Internet, desde su consola:

   ```python
   import mip
   mip.install("umqtt.simple")
   ```

5. Confirmar en la consola de la Pico:

   ```python
   from umqtt.simple import MQTTClient
   print("umqtt.simple disponible")
   ```

## 3. Configurar y copiar los archivos

1. Extraer `output/hiles-pico-w-deploy.zip` en el PC.
2. Copiar `config_local.example.py` como `config_local.py` en la carpeta
   extraída.
3. Editar únicamente `config_local.py`:

   ```python
   WIFI_SSID = "NOMBRE_DE_LA_RED"
   WIFI_PASSWORD = "CLAVE_DE_LA_RED"
   MQTT_HOST = "IPV4_DEL_PC"
   MQTT_PORT = 1883
   MQTT_USERNAME = "USUARIO_MQTT"
   MQTT_PASSWORD = "CLAVE_MQTT"
   MQTT_CLIENT_ID = "pico01"
   MQTT_CONNECT_TIMEOUT_SECONDS = 2
   ENGINE_PERIOD_MS = 20
   ENGINE_STEP_INTERVAL_MS = 1000
   ```

4. En Thonny, crear en la raíz de la Pico la siguiente estructura y subir los
   archivos conservando exactamente sus nombres:

   ```text
   /
   ├── main.py
   ├── config_local.py
   ├── core/
   │   ├── __init__.py
   │   ├── clock.py
   │   ├── scheduler.py
   │   └── task.py
   ├── devices/
   │   ├── __init__.py
   │   └── led_task.py
   ├── hiles/
   │   ├── __init__.py
   │   ├── elements.py
   │   ├── engine.py
   │   ├── engine_task.py
   │   ├── expressions.py
   │   └── model.py
   ├── platform/
   │   ├── __init__.py
   │   ├── hardware.py
   │   ├── mqtt_client.py
   │   └── wifi.py
   └── pubsub/
       ├── __init__.py
       ├── mqtt_transport.py
       ├── node.py
       └── topics.py
   ```

No subir `config_local.example.py`, `examples/`, `__pycache__/` ni archivos
`.pyc` a la placa. No guardar `config_local.py` en Git.

## 4. Primera ejecución y diagnóstico

Abrir primero un monitor MQTT en el PC:

```powershell
$usuario = Read-Host "Usuario MQTT"
$clave = Read-Host "Contraseña MQTT" -MaskInput
& "C:\Program Files\mosquitto\mosquitto_sub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/v1/equipo1/pico01/#" -v
```

Reiniciar la Pico con `Ctrl+D` en Thonny. Su consola debe mostrar:

```text
[HiLeS] Construyendo runtime cooperativo...
[HiLeS] Tareas activas: mqtt, led, motor
[HiLeS] Esperando Wi-Fi y MQTT; el scheduler sigue atendiendo tareas.
```

En el monitor MQTT debe aparecer un mensaje equivalente a:

```text
udfjc/hiles/v1/equipo1/pico01/estado/conexion {"conectado":true,"dispositivo":"pico01"}
```

Si no aparece en aproximadamente 15 segundos:

- `ImportError: no module named umqtt`: instalar `umqtt.simple`;
- errores Wi-Fi: revisar SSID, contraseña y que sea una Pico **W**;
- `MQTT_DESCONECTADO`: revisar `MQTT_HOST`, usuario, contraseña, puerto y
  Firewall;
- los intentos fallidos están limitados a dos segundos y se reintentan cada
  cinco segundos, para que el scheduler no quede bloqueado durante 30 segundos;
- usar la IPv4 del PC, nunca `localhost`;
- comprobar que PC y Pico estén en la misma red y que la red no aísle clientes.

## 5. Prueba rápida del LED y del scheduler

Conservar `$usuario` y `$clave` en la terminal. Publicar el JSON mediante
entrada estándar para que PowerShell no elimine sus comillas:

```powershell
$mensaje = '{"accion":"titilar","id_mensaje":"prueba-led-1"}'
$mensaje | & "C:\Program Files\mosquitto\mosquitto_pub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave -q 1 `
  -t "udfjc/hiles/v1/equipo1/pico01/led/comando" -s
```

El LED debe alternar seis veces sin impedir que MQTT siga respondiendo. El
monitor debe recibir `led/estado`. Repetir exactamente el mismo mensaje permite
comprobar el comportamiento idempotente esperado por QoS 1.

## 6. Prueba completa con los cuatro navegadores

1. Iniciar el frontend y abrir cuatro ventanas o navegadores.
2. Importar en los cuatro `output/demo-4-semaforos-inteligentes.json`.
3. En todos seleccionar `Pico / MQTT`, modelo `cruce-01`, versión `1`, y
   verificar `Sesión: ACTIVA` y `MQTT: CONNECTED`.
4. En un solo navegador pulsar **Compilar y cargar circuito en la Pico**.
5. Esperar `Modelo: Aceptado`, `Secuencia: 0` y `Estado: LISTA` en los cuatro.
6. Pulsar **Enviar 1** en el Service `Habilitar ciclo`.
7. Pulsar **Paso**. Los cuatro navegadores deben mostrar la misma secuencia y
   la fase Norte–Sur verde / Este–Oeste roja.
8. Pulsar más veces **Paso** para recorrer amarillo, verde Este–Oeste,
   amarillo y todos en rojo. Nunca deben quedar verdes ambos ejes.
9. Como alternativa, pulsar **Ejecutar** para avanzar automáticamente cada
   segundo y **Detener** para finalizar la ejecución continua.
10. Probar un comando desde otro navegador: la respuesta de la Pico debe
    actualizar los cuatro canvas, porque todos observan la misma sesión.

Mover, crear o borrar bloques no se sincroniza. Si se modifica el diagrama,
hay que exportar/importar el mismo JSON en los cuatro navegadores antes de
volver a compilar y cargar.

## 7. Evidencia mínima de la prueba

Registrar en `entregas/entrega-5-13-octubre/REGISTRO_CAMBIOS.md`:

- versión de MicroPython y método usado para instalar `umqtt.simple`;
- red e IPv4 utilizadas, sin contraseñas;
- confirmación de conexión Pico → broker;
- resultado del LED no bloqueante;
- aceptación del modelo y secuencias observadas;
- resultado de los cuatro navegadores;
- memoria libre y cualquier error de consola, si se mide;
- fotos, capturas, logs o video únicamente si el equipo desea conservarlos.

## 8. Regenerar el ZIP

Después de cambiar el firmware, ejecutar desde la raíz:

```powershell
& .\scripts\prepare-pico-deployment.ps1
```

El script incluye solo los módulos necesarios, valida la estructura y excluye
credenciales, ejemplos y bytecode de escritorio.
