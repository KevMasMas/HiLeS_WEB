# Guía completa para replicar y probar HiLeS en otro PC

Esta guía reproduce la entrega del 20 de octubre en Windows 10/11 y valida:

- React/Vite accesible en la red local;
- Mosquitto por TCP para la Pico y WebSockets para los navegadores;
- proyecto compartido por `?project=<id>`, snapshot, edición, presencia y cursores;
- ejecución local en Pyodide y ejecución remota de Functional Blocks Python en MicroPython;
- scheduler, CCH, DCH, `Sample`, `Hold`, Petri/LCH, retardos y watchdog;
- cuatro semáforos y, opcionalmente, sensores y luces GPIO reales.

```text
Navegadores ── MQTT/WebSocket :9001 ──┐
                                      ├── Mosquitto en el PC
Pico W ────── MQTT/TCP :1883 ─────────┘

Vite en el PC ── HTTP :5173 ── navegadores de la LAN
```

> Vite, React, lo visual, Pyodide local y el broker corren en el PC. En modo
> **Pico / MQTT**, el código de los Functional Blocks se ejecuta en la Pico W.
> La Pico no aloja la interfaz web.

> Esta configuración es para una LAN de confianza. No publicar 1883, 9001 o
> 5173 en Internet sin TLS, ACL y una configuración de producción.

## 1. Requisitos y datos de la prueba

PC servidor:

- Windows 10/11 de 64 bits, PowerShell, Git, Node.js 22 LTS, Python 3;
- Eclipse Mosquitto 2.x y Thonny;
- acceso de administrador para servicio y firewall.

Hardware:

- Raspberry Pi **Pico W**, cable USB de datos y red Wi-Fi común;
- opcional: cuatro sensores digitales, doce LED, resistencias y protoboard.

Definir antes de empezar:

| Dato | Ejemplo | Nota |
|---|---|---|
| SSID | `LAB_HILES` | Misma red para PC y Pico |
| IPv4 del PC | `192.168.1.50` | Obtener con `ipconfig` |
| Usuario MQTT | `hiles_demo` | Cuenta exclusiva del laboratorio |
| ID de Pico | `pico01` | Mantenerlo en esta entrega |
| Proyecto | `entrega20-equipo1` | 3–64 caracteres `[a-z0-9_-]` |
| Modelo | `entrega20-equipo1` | Puede coincidir con el proyecto |

`localhost` identifica el equipo donde se usa. La Pico y otros PCs deben usar
la IPv4 real del PC servidor. `0.0.0.0` solo sirve para escuchar.

Los sensores deben ser compatibles con 3,3 V. No aplicar 5 V a un GPIO. Para
cargas reales se requieren drivers; los GPIO son para prototipos de bajo
consumo.

## 2. Instalar herramientas

- Git: <https://git-scm.com/download/win>
- Node.js LTS: <https://nodejs.org/en/download>
- Python: <https://www.python.org/downloads/windows/>
- Thonny: <https://thonny.org/>
- Mosquitto: <https://mosquitto.org/download/>

Instalar Mosquitto en `C:\Program Files\mosquitto` y permitir que registre el
servicio. Abrir una terminal nueva y comprobar:

```powershell
git --version
node --version
npm --version
python --version
```

## 3. Descargar la versión correcta

```powershell
git clone https://github.com/KevMasMas/HiLeS_WEB.git
Set-Location .\HiLeS_WEB
git fetch --all --prune
git switch mqtt-pico
git pull --ff-only
git status
```

La entrega está en `mqtt-pico` mientras no se fusione a la rama principal. En
una instalación nueva, `git status` debe estar limpio. Nunca versionar
`.env.local`, `config_local.py`, `passwords.txt` ni contraseñas.

## 4. Validar el software antes del hardware

Frontend:

```powershell
Set-Location .\frontend
npm ci
npm run test:run
npm run lint
npm run build
Set-Location ..
```

Firmware con dobles de hardware:

```powershell
python -m unittest discover -s firmware/tests -p 'test_*.py'
```

Referencia de la revisión: 103 pruebas frontend y 174 de firmware, además de
lint y build aprobados. Un número mayor es válido; ninguna prueba puede fallar.
Estas suites no sustituyen la medición física de Wi-Fi, GPIO y memoria.

## 5. Preparar la red y Mosquitto

Conectar el PC a la red de la Pico y ejecutar `ipconfig`. Anotar la IPv4 del
adaptador activo, no la de VPN, WSL, Hyper-V o VirtualBox. Una red universitaria
o de invitados puede aislar clientes; para la demo es preferible un router o
punto de acceso conocido.

### 5.1 Usuario y configuración

En PowerShell como administrador:

```powershell
Set-Location "C:\Program Files\mosquitto"
.\mosquitto_passwd.exe -c passwords.txt hiles_demo
icacls .\passwords.txt /inheritance:e
icacls .\passwords.txt /grant '*S-1-5-18:(R)'

Copy-Item `
  "RUTA_DEL_REPOSITORIO\infrastructure\mosquitto\mosquitto.conf.example" `
  "C:\Program Files\mosquitto\mosquitto.conf" -Force
```

La contraseña se solicita interactivamente. `-c` sobrescribe el archivo; para
actualizar o agregar otro usuario después, omitir `-c`.

La configuración debe contener:

```conf
listener 1883 0.0.0.0
protocol mqtt
allow_anonymous false
password_file C:\Program Files\mosquitto\passwords.txt

listener 9001 0.0.0.0
protocol websockets
allow_anonymous false
password_file C:\Program Files\mosquitto\passwords.txt
```

### 5.2 Validar servicio y firewall

```powershell
Stop-Service mosquitto
& "C:\Program Files\mosquitto\mosquitto.exe" `
  -c "C:\Program Files\mosquitto\mosquitto.conf" -v
```

Si aparecen ambos listeners, detener con `Ctrl+C` y ejecutar:

```powershell
Start-Service mosquitto
Get-Service mosquitto
Test-NetConnection localhost -Port 1883
Test-NetConnection localhost -Port 9001
netstat -ano | Select-String ':1883|:9001'

New-NetFirewallRule -DisplayName "HiLeS MQTT 1883 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 1883 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow
New-NetFirewallRule -DisplayName "HiLeS MQTT WS 9001 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 9001 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow
New-NetFirewallRule -DisplayName "HiLeS Vite 5173 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 5173 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow
```

No abrir reglas en perfil público sin controlar la red.

### 5.3 Probar PUB/SUB TCP

Terminal 1:

```powershell
$usuario = Read-Host "Usuario MQTT"
$clave = Read-Host "Contraseña MQTT" -MaskInput
& "C:\Program Files\mosquitto\mosquitto_sub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba" -v
```

Terminal 2:

```powershell
$usuario = Read-Host "Usuario MQTT"
$clave = Read-Host "Contraseña MQTT" -MaskInput
& "C:\Program Files\mosquitto\mosquitto_pub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba" -m "mensaje-de-prueba"
```

La primera terminal debe recibir el mensaje.

## 6. Configurar y servir el frontend

```powershell
Set-Location RUTA_DEL_REPOSITORIO\frontend
Copy-Item .env.example .env.local
notepad .env.local
```

Usar la IPv4 del servidor para permitir otros equipos:

```env
VITE_MQTT_HOST=192.168.1.50
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=hiles_demo
VITE_MQTT_PASSWORD=CONTRASENA_MQTT
```

Las variables `VITE_` llegan al navegador: usar credenciales exclusivas de
laboratorio. Verificar que el archivo local está ignorado e iniciar Vite:

```powershell
git check-ignore -v .env.local
npm run dev -- --host 0.0.0.0
```

- Servidor: `http://localhost:5173/`.
- Otro PC: `http://192.168.1.50:5173/`.

Desde el segundo PC:

```powershell
Test-NetConnection 192.168.1.50 -Port 5173
Test-NetConnection 192.168.1.50 -Port 9001
```

Si 5173 responde y 9001 no, revisar broker/firewall. Si ninguno responde,
revisar IPv4, perfil de red y aislamiento de clientes.

## 7. Probar colaboración sin Pico

Con `.env.local` y Mosquitto listos, desde la raíz:

```powershell
node .\scripts\test-mqtt-four-clients.mjs
node .\scripts\test-project-collaboration.mjs
```

Se espera:

```text
MQTT_CUATRO_CLIENTES_OK: 4 de 4 recibieron el mismo estado JSON.
PROJECT_COLLABORATION_OK: 4 clientes, snapshot retenido, presencia, cursor y aislamiento A/B aprobados.
```

Los scripts no imprimen la contraseña.

Prueba visual:

1. Abrir `http://IP_DEL_PC:5173/?project=entrega20-equipo1`.
2. En el primer navegador importar
   `output/demo-4-semaforos-distribuidos.json`.
3. Esperar el autoguardado y abrir la misma URL en otros tres navegadores,
   perfiles o PCs.
4. Confirmar cuatro identidades/colores en la TopBar.
5. Mover cursor y bloque, y editar una propiedad.
6. Confirmar una sola aplicación del cambio en los otros clientes.
7. Cerrar una pestaña y confirmar que su presencia expira.
8. Abrir `?project=entrega20-aislado` y comprobar el aislamiento.

El snapshot retenido carga el diagrama en clientes nuevos. Usar un `projectId`
nuevo para cada ensayo limpio evita recuperar un snapshot anterior.

## 8. Preparar MicroPython en la Pico W

Descargar el firmware estable para **Pico W** desde
<https://micropython.org/download/RPI_PICO_W/>.

1. Desconectar la placa y mantener `BOOTSEL`.
2. Conectar el cable USB de datos.
3. Al aparecer `RPI-RP2`, copiar el UF2 de Pico W.
4. En Thonny seleccionar `MicroPython (Raspberry Pi Pico)` y su puerto.
5. Confirmar el prompt `>>>` y que la consola identifica una Pico W.

Instalar `umqtt.simple` desde el gestor de paquetes de Thonny o:

```python
import mip
mip.install("umqtt.simple")
from umqtt.simple import MQTTClient
print("umqtt.simple disponible")
```

## 9. Generar y configurar el paquete de firmware

Desde la raíz:

```powershell
& .\scripts\prepare-pico-deployment.ps1
Get-FileHash .\output\hiles-pico-w-deploy.zip -Algorithm SHA256
Get-Content .\output\hiles-pico-w-deploy.sha256
```

Los hashes deben coincidir. Extraer el ZIP, copiar
`config_local.example.py` como `config_local.py` y editar solo la copia:

```python
WIFI_SSID = "LAB_HILES"
WIFI_PASSWORD = "CONTRASENA_WIFI"
MQTT_HOST = "192.168.1.50"
MQTT_PORT = 1883
MQTT_USERNAME = "hiles_demo"
MQTT_PASSWORD = "CONTRASENA_MQTT"
MQTT_CLIENT_ID = "pico01"
MQTT_CONNECT_TIMEOUT_SECONDS = 2

ENGINE_PERIOD_MS = 20
ENGINE_STEP_INTERVAL_MS = 1000
ENGINE_QUEUE_SIZE = 32
WATCHDOG_PERIOD_MS = 5000
SENSOR_PERIOD_MS = 50
TRAFFIC_PERIOD_MS = 100
```

`MQTT_HOST` nunca debe ser `localhost`. Los topics físicos de esta entrega
conservan `pico01`, así que mantener ese `MQTT_CLIENT_ID`.

### GPIO opcional de semáforos

Después de revisar el cableado, descomentar y ajustar:

```python
TRAFFIC_SENSOR_PINS = {"norte": 2, "sur": 3, "este": 4, "oeste": 5}
TRAFFIC_LIGHT_PINS = {
    "norte": {"rojo": 6, "amarillo": 7, "verde": 8},
    "sur": {"rojo": 9, "amarillo": 10, "verde": 11},
    "este": {"rojo": 12, "amarillo": 13, "verde": 14},
    "oeste": {"rojo": 15, "amarillo": 16, "verde": 17},
}
```

Los sensores son activos en bajo con `PULL_UP`; un pulsador de prueba puede
unir la entrada a GND. Las cuatro claves son obligatorias para crear el
controlador vial. Si se omiten, el runtime HiLeS general funciona sin GPIO.

## 10. Copiar el runtime completo

La raíz de la Pico debe quedar así:

```text
/
├── main.py
├── config_local.py
├── core/{__init__.py,clock.py,scheduler.py,task.py}
├── devices/{__init__.py,led_task.py,traffic_controller.py,
│            vehicle_sensor_task.py,watchdog_task.py}
├── hiles/{__init__.py,channels.py,elements.py,elements_v2.py,engine.py,
│          engine_task.py,engine_task_v2.py,engine_v2.py,expressions.py,
│          model.py,model_v2.py,python_executor.py,runtime_values.py}
├── platform/{__init__.py,hardware.py,mqtt_client.py,traffic_io.py,wifi.py}
└── pubsub/{__init__.py,mqtt_transport.py,node.py,topics.py}
```

En Thonny, activar `View > Files`, crear las cinco carpetas remotas y subir
todos los `.py` respetando las rutas. Subir `config_local.py`, no la plantilla.
No copiar tests, examples, `__pycache__`, `.pyc` ni el ZIP.

Si existía una versión anterior, respaldarla y reemplazar todos los módulos
como una unidad. No mezclar el runtime V1 antiguo con el V2 actual.

## 11. Primera ejecución física

Abrir un monitor antes de reiniciar:

```powershell
$usuario = Read-Host "Usuario MQTT"
$clave = Read-Host "Contraseña MQTT" -MaskInput
& "C:\Program Files\mosquitto\mosquitto_sub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/v1/equipo1/pico01/#" -v
```

Pulsar `Ctrl+D` en Thonny. Se espera:

```text
[HiLeS] Construyendo runtime cooperativo...
[HiLeS] Tareas activas: ...
[HiLeS] Esperando Wi-Fi y MQTT; el scheduler sigue atendiendo tareas.
[MQTT] Conectado a 192.168.1.50:1883
```

El monitor debe recibir `estado/conexion` con `"conectado":true` y luego
telemetría del watchdog.

Probar LED y scheduler:

```powershell
$mensaje = '{"accion":"titilar","id_mensaje":"prueba-led-1"}'
$mensaje | & "C:\Program Files\mosquitto\mosquitto_pub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave -q 1 `
  -t "udfjc/hiles/v1/equipo1/pico01/led/comando" -s
```

El LED debe alternar sin detener MQTT o telemetría. Repetir el mismo mensaje
permite comprobar deduplicación/idempotencia de QoS 1.

## 12. Ejecutar un modelo desde la interfaz

`project` identifica el documento colaborativo; `modelo` y `version`
identifican la sesión de la Pico. Pueden usar el mismo texto, pero no son el
mismo concepto.

1. Abrir cuatro veces
   `http://IP_DEL_PC:5173/?project=entrega20-equipo1`.
2. Importar el JSON solo en el primer navegador y esperar su sincronización.
3. Abrir **Simulation** y seleccionar **Pico / MQTT**.
4. Usar modelo `entrega20-equipo1`, versión `1` y pulsar **Unirse**.
5. Esperar `MQTT CONNECTED`.
6. En un navegador pulsar **Compilar y cargar circuito en la Pico**.
7. Esperar `Modelo: Aceptado`, secuencia `0` y estado `LISTA`.
8. Seleccionar un Service, enviar una entrada y pulsar **Step/Paso**.
9. Confirmar la misma instantánea oficial en los cuatro navegadores.
10. Probar **Run**, **Stop** y **Reset**.

El enlace copiado puede contener `project`, `modelo` y `version`, pero nunca
credenciales.

## 13. Matriz obligatoria del motor físico

| Prueba | Procedimiento | Resultado esperado |
|---|---|---|
| Functional Block | `def calcular(carros): return carros >= 6` | `3 → False`, `8 → True` calculados en la Pico |
| Rechazo seguro | Intentar `while True: pass` | Rechazo; MQTT y modelo válido siguen activos |
| Firma | Entradas distintas de `calcular(...)` | Rechazo antes de activar el modelo |
| CCH | Enviar valor continuo | El valor permanece disponible |
| DCH | Generar varios eventos | Consumo único y FIFO |
| Sample | Activar muestreo | Un evento solo al activarse |
| Hold | Consumir evento | Conserva y publica el último valor por CCH |
| Petri/LCH | Habilitar transición | Tokens atómicos con guarda/capacidad |
| Retardos | Usar delay | No bloquea LED, MQTT ni watchdog |
| Reinicio | Pulsar Reset | Limpia colas, eventos, timers, tokens y errores |
| Watchdog | Observar telemetría | Métricas y memoria periódicas |
| 4 clientes | Ejecutar desde uno | Misma secuencia oficial en todos |

El Python remoto es deliberadamente **acotado**: admite funciones de cálculo
deterministas y tipos soportados; rechaza imports, acceso al sistema, recursión
y construcciones peligrosas. Ejecuta la lógica HiLeS soportada, no cualquier
programa Python irrestricto.

## 14. Cuatro semáforos

Prueba visual/lógica:

1. Importar `output/demo-4-semaforos-distribuidos.json`.
2. Confirmar Norte, Sur, Este y Oeste con sensores propios.
3. Cargar el modelo en la Pico e inyectar demandas.
4. Verificar verde → amarillo → rojo.
5. Verificar que direcciones conflictivas nunca estén verdes juntas.
6. Confirmar que una demanda pendiente termina atendida.
7. Simular un fallo y verificar retorno seguro a rojo.

Prueba GPIO, si se configuraron los pines:

1. Reiniciar: todas las luces deben iniciar en rojo.
2. Activar Norte llevando su sensor a GND.
3. Observar verde, amarillo y rojo.
4. Activar Este durante Norte y confirmar que espera el intervalo seguro.
5. Repetir para Sur y Oeste.
6. Probar la condición segura ante un fallo controlado.

No cambiar cableado con la placa energizada. Comprobar primero una salida y el
GND común.

## 15. Diagnóstico rápido

- **Mosquitto no inicia:** ejecutar `mosquitto.exe -c mosquitto.conf -v` con el
  servicio detenido; revisar sintaxis, rutas, permisos y puertos ocupados.
- **Otro PC no conecta:** probar 5173 y 9001 por separado, IPv4, firewall,
  perfil privado y aislamiento de clientes.
- **Thonny no detecta la Pico:** usar cable de datos, cerrar el puerto serie en
  otras apps, reiniciar backend o reinstalar con `BOOTSEL`.
- **Wi-Fi sí, MQTT no:** usar IP del PC y puerto 1883; revisar usuario,
  contraseña, firewall y subred.
- **Falta `umqtt`:** instalar `umqtt.simple` en la placa y reiniciar.
- **La Pico no recibe el modelo:** observar
  `udfjc/hiles/v1/equipo1/pico01/#`, verificar modo Pico y sesión activa.
- **Modelo rechazado:** revisar `modelo/confirmacion` y `error`: tamaño, tipos,
  puertos, firma `calcular`, conexiones y Python prohibido. El modelo válido
  anterior debe conservarse.
- **Reinicio o poca memoria:** reducir el modelo, registrar `gc.mem_free()`,
  verificar que todo el runtime V2 fue copiado y observar el watchdog.

## 16. Evidencia de replicación

Guardar, sin secretos:

- rama y commit; versiones de Windows, Node, Mosquitto, Thonny y MicroPython;
- IPv4/tipo de red; suites, lint, build y scripts MQTT;
- salida serie, conexión Pico y aceptación/rechazo de modelos;
- resultados de Python, Sample/Hold, canales, Petri y retardos;
- memoria inicial/mínima y duración del ensayo;
- ciclo e interbloqueo de semáforos; capturas o video necesarios.

No mostrar `.env.local`, `config_local.py`, `passwords.txt` ni contraseñas.

## 17. Checklist final

PC y red:

- [ ] Rama correcta y árbol inicialmente limpio.
- [ ] Frontend: tests, lint y build aprobados.
- [ ] Firmware de escritorio aprobado.
- [ ] Mosquitto `Running`; 1883/9001 y PUB/SUB aprobados.
- [ ] Otro PC alcanza 5173/9001.
- [ ] `.env.local` usa la IPv4 actual y está ignorado.
- [ ] Ambos scripts de cuatro clientes aprobados.
- [ ] URL compartida sincroniza snapshot, edición, presencia y cursores.
- [ ] Otro proyecto permanece aislado.

Pico:

- [ ] Pico W, MicroPython y `umqtt.simple` listos.
- [ ] Hash del ZIP verificado y runtime V2 completo copiado.
- [ ] `config_local.py` correcto y fuera de Git.
- [ ] Conexión, telemetría, LED y deduplicación aprobados.
- [ ] Functional Block válido corre en MicroPython.
- [ ] Código/firma inválidos se rechazan sin bloquear.
- [ ] CCH, DCH, Sample, Hold, Petri/LCH y retardos aprobados.
- [ ] Reset limpia estado temporal; cuatro navegadores convergen.
- [ ] Memoria y duración registradas.

Semáforos:

- [ ] Pines revisados antes de energizar.
- [ ] Cuatro sensores detectados.
- [ ] Cuatro FSM cumplen verde → amarillo → rojo.
- [ ] No existen verdes conflictivos y no hay inanición.
- [ ] Un fallo conduce a rojo.

## 18. Documentos relacionados

- `entregas/entrega-6-20-octubre/GUIA_DEMO.md`: presentación corta.
- `entregas/entrega-6-20-octubre/PLAN_IMPLEMENTACION_ENTREGA_20.md`: alcance.
- `entregas/entrega-6-20-octubre/REGISTRO_CAMBIOS.md`: resultados registrados.
- `docs/mqtt/GUIA_PRUEBA_PICO_W.md`: despliegue resumido incluido como
  `LEEME_PRIMERO.md` en el ZIP.
- `docs/mqtt/CONTRATO_MENSAJES_MQTT.md`: contrato de mensajes.
- `infrastructure/mosquitto/README.md`: operación del broker.
