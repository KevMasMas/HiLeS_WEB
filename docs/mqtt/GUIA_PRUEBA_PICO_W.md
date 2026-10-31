# Guía física: preparar, actualizar y probar varias Raspberry Pi Pico W

Esta es la guía operativa para la ejecución distribuida HiLeS v3. Sirve tanto
para una Pico nueva como para actualizar una placa que ya tiene HiLeS.

El firmware continúa siendo general: las Pico ejecutan fragmentos del modelo,
pero no contienen código específico de semáforos. En la demo actual los carros
se introducen manualmente desde los Services y los colores se observan en el
editor. El único GPIO utilizado es el LED integrado para la prueba básica.

## 1. Resultado esperado

Cada placa debe aparecer en **Ejecutores y despliegue** con una identidad única:

| Placa | `DEVICE_ID` | `MQTT_CLIENT_ID` | Ejecutor visible |
|---|---|---|---|
| Pico 1 | `pico-norte` | `hiles-pico-norte` | `pico:pico-norte` |
| Pico 2 | `pico-este` | `hiles-pico-este` | `pico:pico-este` |
| Pico 3 | `pico-sur` | `hiles-pico-sur` | `pico:pico-sur` |
| Pico 4 | `pico-oeste` | `hiles-pico-oeste` | `pico:pico-oeste` |

Los nombres indican la asignación prevista para la demostración, pero una placa
puede ejecutar cualquier Structural Block después de reasignar y desplegar.
Todas deben usar el mismo `HILES_PROJECT_ID` y credenciales de broker.

## 2. Preparar el PC, la red y Mosquitto

1. Conectar el PC y las Pico a la misma red. Evitar redes que aíslen clientes.
2. Ejecutar `ipconfig` y anotar la IPv4 del adaptador compartido. Esa dirección,
   no `localhost` ni `127.0.0.1`, será `MQTT_HOST` en las placas.
3. Comprobar los listeners del broker:

   ```powershell
   Test-NetConnection localhost -Port 1883
   Test-NetConnection localhost -Port 9001
   ```

   La Pico usa MQTT TCP en `1883`; el navegador usa MQTT WebSocket en `9001`.
4. Permitir ambos puertos en el Firewall de Windows para redes privadas.
5. Configurar `frontend/.env.local` con el mismo broker, usuario y contraseña.
   No subir ese archivo ni `config_local.py` a Git.
6. Antes del hardware, validar el broker desde la raíz del repositorio:

   ```powershell
   node .\scripts\test-mqtt-four-clients.mjs
   node .\scripts\test-project-collaboration.mjs
   node .\scripts\test-distributed-mqtt.mjs --mode=mqtt --timeout=8000
   ```

La instalación completa de Mosquitto y del frontend está en
`docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md`.

## 3. Generar y verificar el paquete que se subirá

Desde la raíz del repositorio:

```powershell
& .\scripts\prepare-pico-deployment.ps1
Get-FileHash .\output\hiles-pico-w-deploy.zip -Algorithm SHA256
Get-Content .\output\hiles-pico-w-deploy.sha256
```

Los hashes deben coincidir. Extraer el ZIP en una carpeta nueva. El paquete no
incluye credenciales, `config_local.py`, ejemplos, tests, bytecode ni `umqtt`.

Archivos críticos que deben estar dentro del ZIP:

```text
main.py
config_local.example.py
devices/watchdog_task.py
hiles/distributed_worker.py
hiles/engine_task_v2.py
hiles/engine_v2.py
hiles/python_executor.py
pubsub/mqtt_transport.py
pubsub/topics.py
```

## 4. Preparar una Pico W nueva

1. Descargar MicroPython estable para **Raspberry Pi Pico W**, no para Pico sin
   Wi-Fi: <https://micropython.org/download/RPI_PICO_W/>.
2. Con la placa desconectada, mantener `BOOTSEL`, conectar el cable USB de datos
   y copiar el UF2 a la unidad `RPI-RP2`.
3. En Thonny elegir `MicroPython (Raspberry Pi Pico)` y el COM de la placa.
4. Confirmar el prompt `>>>` y la versión:

   ```python
   import sys
   print(sys.implementation)
   ```

5. Instalar `umqtt.simple` desde el gestor de paquetes de Thonny o en el REPL:

   ```python
   import mip
   mip.install("umqtt.simple")
   from umqtt.simple import MQTTClient
   print("UMQTT_OK")
   ```

Alternativa desde PowerShell, con Thonny cerrado y reemplazando `COM5`:

```powershell
$thonnyPython = Join-Path $env:LOCALAPPDATA 'Programs\Thonny\python.exe'
& $thonnyPython -m mpremote connect COM5 mip install umqtt.simple
& $thonnyPython -m mpremote connect COM5 exec "from umqtt.simple import MQTTClient; print('UMQTT_OK')"
```

## 5. Actualizar una Pico que ya tiene HiLeS

No formatear ni borrar la placa completa. Primero:

1. Presionar `Ctrl+C` en Thonny para detener `main.py` y dejar `>>>`.
2. Descargar todos los archivos de la placa a una carpeta de respaldo con el
   panel **Raspberry Pi Pico** de Thonny. Incluir especialmente
   `config_local.py` y `lib/umqtt/`.
3. Conservar `config_local.py`; no reemplazarlo con la plantilla.
4. Eliminar solamente, si existen, estos módulos de la antigua demo vial:

   ```text
   /devices/traffic_controller.py
   /devices/vehicle_sensor_task.py
   /platform/traffic_io.py
   ```

5. No eliminar `/lib/umqtt/` ni otros paquetes instalados.
6. Subir y sobrescribir como una unidad `main.py`, `core/`, `devices/`,
   `hiles/`, `platform/` y `pubsub/`. Mezclar módulos nuevos y antiguos puede
   producir errores de protocolo difíciles de diagnosticar.
7. Comparar el `config_local.py` conservado con la plantilla actual y agregar
   los campos nuevos de identidad/distribución sin cambiar las credenciales.

Respaldo alternativo con `mpremote`, cerrando Thonny primero:

```powershell
$thonnyPython = Join-Path $env:LOCALAPPDATA 'Programs\Thonny\python.exe'
$respaldo = Join-Path $env:TEMP ("hiles-pico-backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $respaldo | Out-Null
& $thonnyPython -m mpremote connect COM5 fs cp -r : $respaldo
```

Abrir el respaldo y comprobar que contiene `config_local.py` antes de copiar.

## 6. Configurar cada placa

### Pico nueva

Copiar `config_local.example.py` como `config_local.py` fuera del repositorio y
editar la copia.

### Pico existente

Editar el `config_local.py` respaldado y agregar cualquier campo ausente.

Ejemplo para la placa Norte:

```python
WIFI_SSID = "NOMBRE_DE_LA_RED"
WIFI_PASSWORD = "CLAVE_DE_LA_RED"

MQTT_HOST = "IPV4_DEL_PC"
MQTT_PORT = 1883
MQTT_USERNAME = "USUARIO_MQTT"
MQTT_PASSWORD = "CLAVE_MQTT"
MQTT_CLIENT_ID = "hiles-pico-norte"
MQTT_CONNECT_TIMEOUT_SECONDS = 2

DEVICE_ID = "pico-norte"
HILES_TEAM_ID = "equipo1"
HILES_PROJECT_ID = "semaforos-fisico"

WORKER_MAX_FRAGMENT_BYTES = 30000
WORKER_MAX_ELEMENTS = 64
WORKER_STATUS_PERIOD_MS = 5000
ENGINE_PERIOD_MS = 20
ENGINE_STEP_INTERVAL_MS = 1000
ENGINE_QUEUE_SIZE = 32
WATCHDOG_PERIOD_MS = 5000
```

Para las otras placas cambiar únicamente los dos identificadores únicos:

```python
DEVICE_ID = "pico-este"       # o pico-sur / pico-oeste
MQTT_CLIENT_ID = "hiles-pico-este"
```

Reglas:

- `DEVICE_ID` y `MQTT_CLIENT_ID` no se repiten entre placas.
- `HILES_PROJECT_ID` debe coincidir exactamente con `?project=` en la URL.
- `MQTT_HOST` es la IPv4 del PC del broker.
- no poner reglas de semáforos, GPIO ni IP diferentes por Structural Block.

## 7. Archivos que deben quedar en cada Pico

Subir el contenido del ZIP, excepto `LEEME_PRIMERO.md` y la plantilla. Subir
aparte el `config_local.py` propio de esa placa. La raíz debe quedar así:

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
│   ├── led_task.py
│   └── watchdog_task.py
├── hiles/
│   ├── __init__.py
│   ├── channels.py
│   ├── distributed_worker.py
│   ├── elements.py
│   ├── elements_v2.py
│   ├── engine.py
│   ├── engine_task.py
│   ├── engine_task_v2.py
│   ├── engine_v2.py
│   ├── expressions.py
│   ├── model.py
│   ├── model_v2.py
│   ├── python_executor.py
│   └── runtime_values.py
├── platform/
│   ├── __init__.py
│   ├── hardware.py
│   ├── mqtt_client.py
│   └── wifi.py
├── pubsub/
│   ├── __init__.py
│   ├── mqtt_transport.py
│   ├── node.py
│   └── topics.py
└── lib/
    └── umqtt/
        ├── __init__.py
        └── simple.py
```

No subir `examples/`, `tests/`, `__pycache__/`, `.pyc`, el ZIP ni archivos del
PC. En Thonny se pueden seleccionar las cinco carpetas y usar **Upload to /**.

Alternativa reproducible con `mpremote`, desde la carpeta extraída:

```powershell
& $thonnyPython -m mpremote connect COM5 fs cp main.py :main.py
& $thonnyPython -m mpremote connect COM5 fs cp -r core devices hiles platform pubsub :
& $thonnyPython -m mpremote connect COM5 fs cp .\config_local.py :config_local.py
```

No ejecutar el último comando sobre una placa existente hasta haber confirmado
que el archivo local es su configuración preservada.

## 8. Validación antes de conectarse a la red

En el REPL de Thonny, con `main.py` interrumpido:

```python
import sys, gc, main
from hiles.distributed_worker import DistributedWorker
from hiles.engine_task_v2 import EngineTaskV2
from hiles.python_executor import PythonExecutor
from devices.watchdog_task import WatchdogTask
from umqtt.simple import MQTTClient

app = main.build_default_application()
print("RUNTIME_IMPORT_OK")
print("TASKS", tuple(t.name for t in app.tasks))
print("COMPONENTS", tuple(sorted(app.components.keys())))
print("EXECUTOR", app.components["executor_id"])
print("PROJECT", app.components["project_id"])
print("MEM_FREE", gc.mem_free())
print("VERSION", sys.implementation.version)
```

Debe aparecer `RUNTIME_IMPORT_OK`. Las tareas esperadas son `mqtt`, `led`,
`motor`, `watchdog` y `worker_v3`. El ejecutor y proyecto deben coincidir con
la configuración de esa placa. Esta construcción no inicia el bucle infinito.

## 9. Primera conexión de cada Pico

Abrir dos monitores MQTT en el PC:

```powershell
$usuario = Read-Host 'Usuario MQTT'
$clave = Read-Host 'Contraseña MQTT' -MaskInput

& 'C:\Program Files\mosquitto\mosquitto_sub.exe' `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t 'udfjc/hiles/v3/projects/semaforos-fisico/executors/#' -v
```

En otro terminal, para mensajes del runtime clásico de todas las placas:

```powershell
& 'C:\Program Files\mosquitto\mosquitto_sub.exe' `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t 'udfjc/hiles/v1/equipo1/+/estado/#' -v
```

Reiniciar una placa a la vez con `Ctrl+D`. La consola debe mostrar las tareas y
`[MQTT] Conectado a <IP>:1883`. El monitor v3 debe mostrar su ejecutor `online`
o disponible. Repetir para cada Pico y comprobar que no desaparece la anterior;
si desaparece, probablemente se repitió `MQTT_CLIENT_ID`.

## 10. Prueba rápida del LED de cada placa

Para Norte:

```powershell
$mensaje = '{"accion":"titilar","id_mensaje":"led-norte-1"}'
$mensaje | & 'C:\Program Files\mosquitto\mosquitto_pub.exe' `
  -h localhost -p 1883 -u $usuario -P $clave -q 1 `
  -t 'udfjc/hiles/v1/equipo1/pico-norte/led/comando' -s
```

Repetir cambiando `pico-norte`. El LED integrado debe titilar sin detener el
watchdog ni la presencia v3.

## 11. Iniciar frontend y preparar la demo

```powershell
cd frontend
node .\node_modules\vite\bin\vite.js --host 0.0.0.0
```

Abrir:

```text
http://IP_DEL_PC:5173/?project=semaforos-fisico
```

1. Importar `output/demo-4-semaforos-distribuidos.json` una sola vez.
2. Abrir **Ejecutores**.
3. Confirmar que aparecen todas las Pico configuradas para el proyecto.
4. Si faltan placas, activar **Ejecutar aquí** en uno o más navegadores para
   completar cuatro ejecutores.
5. Asignar Norte, Este, Sur y Oeste a cuatro ejecutores distintos.
6. Pulsar **Desplegar** y esperar cuatro `ACK recibido`.

Matrices válidas:

- una Pico + tres navegadores;
- dos Pico + dos navegadores;
- cuatro Pico;
- cualquier mezcla equivalente con cuatro ejecutores disponibles.

## 12. Prueba física del anillo de token

1. Pulsar **Reiniciar** para recuperar el marcado inicial: todos rojos y token
   en Norte.
2. En **Inyectar una entrada**, enviar:
   - `sensor-norte = 0`;
   - `sensor-este = 5`;
   - `sensor-sur = 0`;
   - `sensor-oeste = 0`.
3. Pulsar **Iniciar** o avanzar con **Paso**.
4. Comprobar en **Estado agregado**:
   - Norte cede desde rojo;
   - Este pasa a verde;
   - tras 3000 ms pasa a amarillo;
   - tras 1000 ms vuelve a rojo;
   - Sur recibe un único token.
5. Continuar y comprobar la circulación Sur → Oeste → Norte.
6. Cambiar la demanda mientras corre para demostrar que cada nodo decide con
   su entrada local y no existe un ganador central.

Nunca deben existir dos Places verdes con token al mismo tiempo. Durante verde
o amarillo el permiso está representado por esa fase, por lo que los Places
`*-token` pueden sumar cero hasta la cesión.

## 13. Pruebas de recuperación

Ejecutarlas después de aprobar el recorrido normal:

1. Desconectar una Pico que no tenga el turno: debe aparecer `offline`/obsoleta.
2. Reconectarla: debe resincronizar manifiesto y fragmento retenidos antes de
   volver a `running`.
3. Volver a desplegar y comprobar cuatro ACK.
4. Desconectar la placa que posee el turno y registrar el resultado.

Limitación actual: si cae el ejecutor que posee verde, amarillo o token, el
permiso puede perderse. Todavía no existe lease/heartbeat que lo regenere sin
riesgo de duplicarlo. Esta prueba debe registrarse, pero no se debe afirmar
fail-safe vial físico.

## 14. Diagnóstico rápido

| Síntoma | Revisión |
|---|---|
| `ImportError: distributed_worker` | El ZIP era antiguo; regenerarlo y reemplazar `hiles/` completo |
| `ImportError: umqtt` | Instalar `umqtt.simple`; no viene dentro del ZIP |
| No conecta Wi-Fi | SSID/clave, Pico **W**, red 2.4 GHz y aislamiento de clientes |
| MQTT rechazado | IP del PC, 1883, usuario, contraseña y Firewall |
| Una Pico expulsa a otra | `MQTT_CLIENT_ID` duplicado |
| Pico no aparece en Ejecutores | `HILES_PROJECT_ID` distinto de `?project=` o worker antiguo |
| Fragmento rechazado | Revisar ACK, memoria libre, tamaño y que todo el runtime sea de la misma versión |
| No hay ACK | Ejecutores online, asignaciones completas y broker WebSocket/TCP común |
| Colores no avanzan | Enviar entradas, iniciar/paso y verificar que las cuatro fases estén en ejecutores activos |
| Reinicios o `MemoryError` | Registrar `gc.mem_free()`, reducir fragmento y reiniciar antes de redesplegar |

## 15. Evidencia que se debe guardar

Por cada placa registrar, sin contraseñas:

- nombre/COM, `DEVICE_ID`, `MQTT_CLIENT_ID` y versión de MicroPython;
- método y resultado de instalación de `umqtt.simple`;
- ruta y fecha del respaldo;
- SHA-256 del ZIP usado;
- `RUNTIME_IMPORT_OK`, tareas, componentes y memoria libre;
- presencia v3, ACK del fragmento y memoria reportada;
- matriz probada: Pico↔Pico, Pico↔browser o browser↔browser;
- secuencia observada verde → amarillo → rojo → siguiente token;
- desconexión/reconexión y cualquier error exacto.

No guardar ni pegar SSID, contraseñas Wi-Fi o credenciales MQTT.
