# Guía completa para replicar HiLeS en otro PC

Esta guía permite preparar desde cero un equipo con Windows 10 u 11 para:

- descargar el repositorio;
- ejecutar el editor y simulador web;
- instalar y configurar Eclipse Mosquitto;
- comunicar varios navegadores dentro de una red local;
- instalar Thonny y MicroPython en una Raspberry Pi Pico W;
- copiar a la Pico únicamente los archivos necesarios;
- comprobar por etapas dónde falla una conexión.

La guía describe la arquitectura actual del proyecto:

```text
Navegador web
  │ MQTT sobre WebSockets: puerto 9001
  ▼
Mosquitto en el PC
  ▲ MQTT sobre TCP: puerto 1883
  │
Raspberry Pi Pico W
```

> Esta configuración está pensada para una red local de confianza. No se deben
> publicar los puertos 1883, 9001 o 5173 directamente en Internet. Para conectar
> redes diferentes será necesario desplegar un broker público con TLS (`wss://`),
> certificados y permisos por topic.

## 1. Datos que se deben decidir antes de comenzar

En los ejemplos se usan estos valores ficticios:

| Dato | Ejemplo | Cómo obtenerlo |
|---|---|---|
| Red Wi-Fi | `LAB_HILES` | Nombre de la red a la que se conectarán PC y Pico |
| IPv4 del PC broker | `192.168.1.50` | `ipconfig` en el PC que ejecutará Mosquitto |
| Usuario MQTT | `hiles_demo` | Se crea durante la instalación de Mosquitto |
| Contraseña MQTT | No se documenta | Se introduce de forma interactiva |
| Identificador de la Pico | `pico01` | Debe ser único si se conectan varias placas |

Reglas importantes:

- `localhost` y `127.0.0.1` significan “este mismo dispositivo”. Solo sirven
  cuando el navegador y Mosquitto están en el mismo PC.
- La Pico y los otros computadores deben usar la IPv4 real del PC broker, por
  ejemplo `192.168.1.50`.
- `0.0.0.0` se usa en la configuración del broker para escuchar por todas las
  interfaces; nunca se utiliza como dirección de conexión.
- La red debe permitir comunicación entre clientes. Algunas redes públicas,
  universitarias o de invitados aplican aislamiento de dispositivos.
- Para una demostración es preferible un router o punto de acceso conocido.

## 2. Instalar las herramientas del PC

### 2.1 Git

Instalar Git desde <https://git-scm.com/download/win>. Durante la instalación
se pueden conservar las opciones predeterminadas.

Cerrar y volver a abrir PowerShell, y comprobar:

```powershell
git --version
```

### 2.2 Node.js

El proyecto se desarrolló con Node.js 22 LTS. Instalar una versión LTS desde
<https://nodejs.org/en/download> y comprobar:

```powershell
node --version
npm --version
```

Si `npm` apunta a una instalación antigua o inexistente, cerrar todas las
terminales y abrir una nueva. Si continúa fallando, eliminar la instalación
antigua de Node.js antes de reinstalar la versión LTS.

### 2.3 Thonny

Instalar Thonny desde <https://thonny.org/>. El instalador oficial para Windows
incluye su propio Python; no hace falta instalar Python por separado para usar
la Pico.

### 2.4 Eclipse Mosquitto

Descargar el instalador de 64 bits desde <https://mosquitto.org/download/>.
Instalarlo en la ruta predeterminada:

```text
C:\Program Files\mosquitto
```

Durante la instalación, permitir que se registre como servicio de Windows. El
instalador incluye el broker y los clientes `mosquitto_pub` y `mosquitto_sub`.

## 3. Descargar el repositorio

Abrir PowerShell en la carpeta donde se guardará el proyecto:

```powershell
git clone https://github.com/KevMasMas/HiLeS_WEB.git
Set-Location .\HiLeS_WEB
git switch mqtt-pico
git status
```

La implementación MQTT/Pico revisada está actualmente en la rama `mqtt-pico`.
Cuando esta rama sea integrada a la rama principal, el comando `git switch
mqtt-pico` dejará de ser necesario.

El resultado esperado de `git status` en una instalación nueva es un árbol de
trabajo limpio.

## 4. Instalar y probar el frontend

Desde la raíz del repositorio:

```powershell
Set-Location .\frontend
npm ci
npm run test:run
npm run build
```

`npm ci` usa exactamente las versiones registradas en `package-lock.json`.
No se necesita PostgreSQL, Prisma ni un backend.

Para probar solamente el editor y el motor local:

```powershell
npm run dev
```

Abrir la dirección que imprime Vite, normalmente
<http://localhost:5173/>. En este modo todavía no se necesita Mosquitto ni la
Pico.

Detener Vite con `Ctrl+C` antes de continuar.

## 5. Identificar la IPv4 correcta del PC broker

El PC que ejecuta Mosquitto será el **PC broker**. Conectarlo a la misma red que
usará la Pico y ejecutar:

```powershell
ipconfig
```

Buscar el adaptador Wi-Fi o Ethernet realmente conectado. Anotar su `Dirección
IPv4`, por ejemplo:

```text
Dirección IPv4 . . . . . . . . . . : 192.168.1.50
```

No elegir direcciones de adaptadores desconectados, VPN, Hyper-V, VirtualBox o
WSL. La dirección puede cambiar al reconectar el PC; se debe verificar antes de
cada demostración.

## 6. Configurar Mosquitto con usuario y WebSockets

Los comandos de esta sección que administran el servicio y el Firewall deben
ejecutarse en **PowerShell como administrador**.

### 6.1 Crear el usuario MQTT

```powershell
Set-Location "C:\Program Files\mosquitto"
.\mosquitto_passwd.exe -c passwords.txt hiles_demo
```

El programa solicitará la contraseña dos veces. No escribir la contraseña en
un archivo del repositorio ni en una captura de pantalla.

La opción `-c` crea un archivo nuevo y sobrescribe uno existente. Para agregar
o actualizar otro usuario posteriormente, omitir `-c`:

```powershell
.\mosquitto_passwd.exe passwords.txt otro_usuario
```

Permitir que el servicio pueda leer el archivo:

```powershell
icacls .\passwords.txt /inheritance:e
icacls .\passwords.txt /grant '*S-1-5-18:(R)'
```

### 6.2 Instalar la configuración de HiLeS

Desde la raíz del repositorio, reemplazando la ruta si el proyecto está en otra
carpeta:

```powershell
Copy-Item `
  ".\infrastructure\mosquitto\mosquitto.conf.example" `
  "C:\Program Files\mosquitto\mosquitto.conf" -Force
```

El archivo debe contener dos listeners:

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

- `1883`: conexión TCP utilizada por la Pico y las herramientas de terminal.
- `9001`: MQTT sobre WebSockets utilizado por los navegadores.
- `allow_anonymous false`: obliga a usar usuario y contraseña.

### 6.3 Validar la configuración antes de reiniciar el servicio

Detener temporalmente el servicio y ejecutar Mosquitto en primer plano:

```powershell
Stop-Service mosquitto
& "C:\Program Files\mosquitto\mosquitto.exe" `
  -c "C:\Program Files\mosquitto\mosquitto.conf" -v
```

Si aparecen los listeners 1883 y 9001 sin errores, detener el proceso con
`Ctrl+C` y arrancar el servicio:

```powershell
Start-Service mosquitto
Get-Service mosquitto
```

El estado esperado es `Running`.

### 6.4 Abrir solamente los puertos necesarios en el Firewall

Estas reglas restringen el acceso a la subred local y al perfil privado:

```powershell
New-NetFirewallRule `
  -DisplayName "HiLeS MQTT TCP 1883 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 1883 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow

New-NetFirewallRule `
  -DisplayName "HiLeS MQTT WebSocket 9001 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 9001 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow
```

El puerto 5173 solo es necesario si otros computadores abrirán el frontend
servido por este PC:

```powershell
New-NetFirewallRule `
  -DisplayName "HiLeS Vite 5173 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 5173 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow
```

No crear reglas para el perfil público salvo que la red y sus riesgos estén
claramente controlados.

### 6.5 Comprobar listeners y publicación local

```powershell
Test-NetConnection localhost -Port 1883
Test-NetConnection localhost -Port 9001
netstat -ano | Select-String ':1883|:9001'
```

Abrir una primera terminal:

```powershell
$usuario = Read-Host "Usuario MQTT"
$clave = Read-Host "Contraseña MQTT" -MaskInput
& "C:\Program Files\mosquitto\mosquitto_sub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba" -v
```

Abrir una segunda terminal:

```powershell
$usuario = Read-Host "Usuario MQTT"
$clave = Read-Host "Contraseña MQTT" -MaskInput
& "C:\Program Files\mosquitto\mosquitto_pub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba" -m "mensaje-de-prueba"
```

La primera terminal debe recibir:

```text
udfjc/hiles/prueba mensaje-de-prueba
```

## 7. Configurar el frontend para MQTT

En `frontend`, crear el archivo local a partir de la plantilla:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Si el frontend, Mosquitto y el navegador están en el mismo PC se puede usar
`localhost`. Para que la misma configuración funcione desde otros equipos de
la LAN, usar la IPv4 del PC broker:

```env
VITE_MQTT_HOST=192.168.1.50
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=hiles_demo
VITE_MQTT_PASSWORD=CONTRASENA_MQTT
```

No agregar `.env.local` a Git. Las variables `VITE_` se incorporan al código
que recibe el navegador, por lo que este usuario debe ser exclusivo del
laboratorio y no debe reutilizar una contraseña personal.

Reiniciar Vite después de cambiar el archivo:

```powershell
npm run dev -- --host 0.0.0.0
```

- En el PC broker: <http://localhost:5173/>.
- En otro PC de la LAN: `http://192.168.1.50:5173/`.

Desde un segundo PC se pueden comprobar primero los puertos:

```powershell
Test-NetConnection 192.168.1.50 -Port 5173
Test-NetConnection 192.168.1.50 -Port 9001
```

Si 5173 funciona pero 9001 no, el problema está en Mosquitto o el Firewall. Si
ninguno funciona, revisar la IPv4, el perfil de red y el aislamiento de
clientes.

## 8. Preparar la Raspberry Pi Pico W

### 8.1 Confirmar el modelo de placa

Debe ser una **Raspberry Pi Pico W**. La Pico sin la letra W no tiene Wi-Fi y no
puede conectarse directamente al broker.

### 8.2 Instalar MicroPython

Para reproducir exactamente el entorno actualmente observado puede instalarse
MicroPython 1.28.0. También se puede utilizar la versión estable más reciente,
pero debe repetirse el ensayo completo después de actualizar.

El firmware oficial de la Pico W está en:
<https://micropython.org/download/RPI_PICO_W/>.

Método con archivo UF2:

1. Desconectar la Pico.
2. Mantener presionado `BOOTSEL`.
3. Conectar el cable USB de datos sin soltar `BOOTSEL`.
4. Soltar el botón cuando aparezca la unidad `RPI-RP2`.
5. Copiar el archivo `.uf2` de **Pico W**, no el de Pico normal.
6. Esperar el reinicio automático de la placa.

También se puede usar en Thonny `Run > Select interpreter` o `Tools > Options
> Interpreter`, seleccionar `MicroPython (Raspberry Pi Pico)` y utilizar la
opción de instalar o actualizar MicroPython.

### 8.3 Seleccionar la Pico en Thonny

1. Conectar la placa mediante un cable USB de datos.
2. Abrir Thonny.
3. Seleccionar `MicroPython (Raspberry Pi Pico)` como intérprete.
4. Elegir el puerto USB detectado o dejar detección automática.
5. Pulsar **Stop/Restart backend** si la consola no muestra el prompt `>>>`.

La consola debe mostrar una línea semejante a:

```text
MicroPython v1.28.0 ...; Raspberry Pi Pico W with RP2040
```

Si Windows no detecta la placa, probar otro cable: muchos cables USB solo
cargan y no transportan datos.

### 8.4 Instalar `umqtt.simple`

En Thonny se puede usar `Tools > Manage packages`, buscar `umqtt.simple` e
instalarlo en la Pico. Alternativamente, con la placa conectada a Internet,
ejecutar en su consola:

```python
import mip
mip.install("umqtt.simple")
```

Después verificar:

```python
from umqtt.simple import MQTTClient
print("umqtt.simple disponible")
```

## 9. Preparar exactamente los archivos que se subirán

Desde la raíz del repositorio ejecutar:

```powershell
& .\scripts\prepare-pico-deployment.ps1
```

El script genera:

```text
output\hiles-pico-w-deploy.zip
output\hiles-pico-w-deploy.sha256
```

El ZIP excluye credenciales, ejemplos, cachés y bytecode. Extraerlo en una
carpeta temporal del PC.

Copiar `config_local.example.py` como `config_local.py` en la carpeta extraída
y completar únicamente el nuevo archivo:

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
```

`MQTT_HOST` debe ser la IPv4 del PC broker. Nunca usar `localhost` en la Pico.

Si se conectan varias placas, cada una debe usar un identificador MQTT único.
La versión actual de los topics todavía está fijada a `pico01`, por lo que el
soporte completo de varias Pico requiere el cambio de topics dinámicos previsto
en la arquitectura futura.

## 10. Archivos exactos que se deben subir a la Pico

En la raíz de la Pico debe quedar esta estructura:

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

La carpeta `umqtt` instalada en el paso anterior también aparecerá en la
placa, pero no forma parte del ZIP del proyecto.

No subir:

- `config_local.example.py`;
- `examples/`;
- `firmware/tests/`;
- `__pycache__/`;
- archivos `.pyc`;
- scripts experimentales o versiones antiguas del runtime.

La placa observada durante el desarrollo contiene algunos programas
experimentales antiguos. No son necesarios para HiLeS. Antes de borrar algo,
hacer una copia de seguridad desde Thonny. Para una réplica limpia basta con
asegurar que `main.py`, los cinco paquetes del proyecto y `config_local.py`
coincidan con la estructura anterior.

### Cómo subirlos con Thonny

1. Activar `View > Files` si no aparece el panel de archivos.
2. En **This computer**, abrir la carpeta extraída.
3. En **Raspberry Pi Pico**, crear las carpetas `core`, `devices`, `hiles`,
   `platform` y `pubsub`.
4. Seleccionar cada archivo local, hacer clic derecho y elegir **Upload to /**
   o la carpeta remota correspondiente.
5. Subir `config_local.py` solamente después de editarlo.
6. Abrir `/main.py` desde el panel de la Pico y comprobar que comienza con
   “Punto de composición del firmware HiLeS”.

No abrir ni mostrar `config_local.py` durante una grabación o presentación,
porque contiene las dos contraseñas.

## 11. Primera ejecución de la Pico

Antes de reiniciar la placa, abrir en el PC broker un monitor de todos sus
topics:

```powershell
$usuario = Read-Host "Usuario MQTT"
$clave = Read-Host "Contraseña MQTT" -MaskInput
& "C:\Program Files\mosquitto\mosquitto_sub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/v1/equipo1/pico01/#" -v
```

En Thonny pulsar `Ctrl+D` dentro de la consola o usar **Stop/Restart backend**.
La salida esperada es:

```text
[HiLeS] Construyendo runtime cooperativo...
[HiLeS] Tareas activas: mqtt, led, motor
[HiLeS] Esperando Wi-Fi y MQTT; el scheduler sigue atendiendo tareas.
[MQTT] Conectado a 192.168.1.50:1883
```

El monitor del PC debe recibir:

```text
udfjc/hiles/v1/equipo1/pico01/estado/conexion {"conectado":true,"dispositivo":"pico01"}
```

## 12. Prueba del LED antes de probar un modelo HiLeS

Conservar `$usuario` y `$clave` en PowerShell:

```powershell
$mensaje = '{"accion":"titilar","id_mensaje":"prueba-led-1"}'
$mensaje | & "C:\Program Files\mosquitto\mosquitto_pub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave -q 1 `
  -t "udfjc/hiles/v1/equipo1/pico01/led/comando" -s
```

El LED integrado debe cambiar y el monitor debe recibir `led/estado`. Se usa
`-s` para conservar correctamente las comillas del JSON al invocar un
ejecutable desde PowerShell.

Si esta prueba funciona, quedan validados Wi-Fi, autenticación, puerto 1883,
topics, suscripción y publicación de la Pico.

## 13. Prueba completa desde el navegador

1. Confirmar que Vite está ejecutándose con `npm run dev -- --host 0.0.0.0`.
2. Abrir el frontend.
3. Importar `output/demo-4-semaforos-inteligentes.json`.
4. Seleccionar **Pico / MQTT**.
5. Usar modelo `cruce-01` y versión `1`.
6. Pulsar **Unirse** y esperar `MQTT: CONNECTED`.
7. Pulsar **Compilar y cargar circuito en la Pico**.
8. Esperar `Modelo: Aceptado`, secuencia `0` y estado `LISTA`.
9. Enviar `1` al Service `Habilitar ciclo`.
10. Pulsar **Paso** y comprobar que cambia el estado del canvas.

Para varios navegadores, todos deben importar el mismo JSON y unirse al mismo
modelo y versión. El enlace comparte la identificación de sesión, pero no
transfiere el diagrama visual.

## 14. Diagnóstico por capas

No cambiar varias cosas a la vez. Comprobar en este orden:

### A. Mosquitto no inicia

```powershell
Get-Service mosquitto
& "C:\Program Files\mosquitto\mosquitto.exe" `
  -c "C:\Program Files\mosquitto\mosquitto.conf" -v
```

Revisar rutas, sintaxis, existencia de `passwords.txt` y permisos de lectura.

### B. La publicación local falla

Revisar usuario y contraseña. Si aparece `Connection Refused: not authorised`,
regenerar el usuario y reiniciar Mosquitto.

### C. Otro PC no llega al broker

Desde el otro PC:

```powershell
Test-NetConnection 192.168.1.50 -Port 9001
```

Revisar IPv4, perfil privado del Firewall y aislamiento de clientes de la red.

### D. El navegador no conecta

- confirmar que `.env.local` usa la IPv4 correcta;
- confirmar `VITE_MQTT_WS_PROTOCOL=ws` para el frontend HTTP local;
- reiniciar Vite después de modificar `.env.local`;
- revisar la consola del navegador;
- comprobar el puerto 9001 independientemente.

### E. Thonny no detecta la Pico

- usar un cable USB de datos;
- cerrar otra aplicación que esté usando el puerto serie;
- pulsar **Stop/Restart backend**;
- reconectar manteniendo `BOOTSEL` si es necesario reinstalar MicroPython.

### F. La Pico se conecta al Wi-Fi pero no a MQTT

- `MQTT_HOST` debe ser la IPv4 del PC, no `localhost`;
- comprobar `MQTT_PORT = 1883`;
- verificar usuario y contraseña MQTT;
- comprobar que el PC y la Pico estén en la misma subred;
- revisar el Firewall y el monitor verbose de Mosquitto.

### G. La Pico muestra `ImportError: no module named umqtt`

Instalar `umqtt.simple` en la memoria de la placa y reiniciarla.

### H. El modelo es rechazado

El runtime MicroPython actual soporta en IR v1 `Service`, `Functional Block`,
`Place` y `Transition`. Aún no ejecuta en la Pico todos los elementos admitidos
por el motor web, como `Sample` y `Hold`.

## 15. Lista final de verificación

- [ ] `git status` no muestra archivos locales con contraseñas.
- [ ] `npm ci`, pruebas y build terminan correctamente.
- [ ] Mosquitto está `Running`.
- [ ] Los puertos 1883 y 9001 escuchan.
- [ ] PUB/SUB local funciona con autenticación.
- [ ] Un segundo PC puede llegar a 5173 y 9001 si se necesita acceso LAN.
- [ ] `.env.local` usa la IPv4 actual del broker.
- [ ] La placa es Pico W y Thonny muestra el prompt `>>>`.
- [ ] `umqtt.simple` se puede importar.
- [ ] La estructura de archivos de la Pico coincide con esta guía.
- [ ] `config_local.py` usa la misma red, IPv4 y credenciales MQTT.
- [ ] El monitor recibe `estado/conexion` con `conectado: true`.
- [ ] El comando del LED funciona.
- [ ] La web muestra `MQTT: CONNECTED` y `Modelo: Aceptado`.

## 16. Archivos relacionados del repositorio

- `infrastructure/mosquitto/mosquitto.conf.example`: configuración del broker.
- `infrastructure/mosquitto/README.md`: operaciones del servicio Mosquitto.
- `frontend/.env.example`: plantilla de conexión del navegador.
- `firmware/pico/config_local.example.py`: plantilla local de la Pico.
- `scripts/prepare-pico-deployment.ps1`: genera y valida el paquete de firmware.
- `docs/mqtt/GUIA_PRUEBA_PICO_W.md`: ensayo específico de la placa.
- `docs/mqtt/CONTRATO_MENSAJES_MQTT.md`: topics y mensajes del protocolo.

