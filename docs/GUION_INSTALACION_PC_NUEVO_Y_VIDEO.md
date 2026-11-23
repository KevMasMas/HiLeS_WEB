# HiLeS: instalación en un PC nuevo y guion de video

Fecha de preparación: 20 de noviembre de 2026.

Este documento sirve primero como procedimiento de ensayo y después como guion de grabación. La instalación en un PC nuevo y las pruebas físicas completas deben ejecutarse antes de presentarlas como aprobadas en el video.

Referencia del repositorio al preparar esta guía: rama `multi-pico`, commit local `ae9ac32`. Registrar el commit realmente descargado en el equipo nuevo. Las cantidades de pruebas y versiones pueden cambiar; registrar los resultados reales.

## 1. Objetivo y materiales

Preparar un servidor Windows que aloje HiLeS y Mosquitto, conectar dos Pico y permitir que otros navegadores colaboren y ejecuten partes del circuito.

Necesitamos:

- PC servidor Windows con permisos de administrador.
- Internet para descargar herramientas y dependencias.
- Red Wi-Fi de 2,4 GHz accesible para PC y Pico, sin aislamiento entre clientes.
- Dos Raspberry Pi Pico W o Pico 2 W.
- Dos cables USB de datos.
- Un segundo PC con navegador para las pruebas de colaboración y ejecución.

El PC servidor sirve la aplicación y ejecuta el broker. Los bloques se calculan en la Pico o pestaña de navegador que el usuario seleccione.

| Dato | Ejemplo usado en esta guía |
|---|---|
| Repositorio local | `C:\HiLeS\HiLeS_WEB` |
| Proyecto compartido | `proyecto-video` |
| Usuario MQTT | `hiles_demo` |
| Primera placa | `pico01w` |
| Segunda placa | `pico02w` |
| IP del servidor | Obtenerla en el equipo nuevo |

No reutilizar automáticamente la IP del PC anterior. En todos los ejemplos, sustituir `IP_REAL_DEL_PC` por la IPv4 obtenida en la red del ensayo.

**Narración:**

> Vamos a instalar HiLeS desde cero. Este computador alojará la aplicación y el broker de comunicación. Las Pico y los navegadores se conectarán al mismo proyecto para ejecutar las partes que les asignemos.

## 2. Instalar las herramientas

Descargar e instalar:

- [Git para Windows](https://git-scm.com/download/win).
- [Node.js](https://nodejs.org/en/download), versión LTS compatible.
- [Python para Windows](https://www.python.org/downloads/windows/).
- [Thonny](https://thonny.org/).
- [Mosquitto para Windows](https://mosquitto.org/download/).

Usar Node 22.12 o superior dentro de una versión compatible. Atender cualquier aviso `EBADENGINE` al instalar dependencias. Consultar los [requisitos oficiales de Vite](https://vite.dev/guide/).

Durante la instalación:

1. Permitir que Git quede disponible desde la terminal.
2. Agregar Python al PATH si el instalador ofrece esa opción.
3. Instalar Mosquitto en `C:\Program Files\mosquitto`.
4. Seleccionar la instalación del servicio de Mosquitto si se ofrece.
5. Cerrar las terminales anteriores y abrir una nueva PowerShell.

Comprobar, un comando a la vez:

```powershell
git --version
node --version
npm.cmd --version
python --version
```

Se usa `npm.cmd` para evitar el bloqueo de `npm.ps1` que puede aparecer en PowerShell.

**Resultado esperado:** todos muestran una versión. Si alguno no se reconoce, corregir su instalación antes de continuar.

**Narración:**

> Git descarga el proyecto; Node ejecuta las herramientas del frontend; Python permite probar y administrar el firmware; Thonny da acceso a la consola de las Pico; Mosquitto intercambia mensajes entre los ejecutores.

## 3. Descargar el repositorio

En PowerShell normal:

```powershell
New-Item -ItemType Directory -Path C:\HiLeS -Force
Set-Location C:\HiLeS
git clone --branch multi-pico https://github.com/KevMasMas/HiLeS_WEB.git
Set-Location C:\HiLeS\HiLeS_WEB
```

Comprobar:

```powershell
git branch --show-current
git status
git log -1 --oneline
```

**Resultado esperado:** rama `multi-pico`, árbol limpio y commit identificado. Anotar el hash. Si falta el cambio de etiquetas del canvas, comprobar que el commit correspondiente esté publicado antes de grabar.

Si el repositorio ya existe, no clonarlo de nuevo:

```powershell
Set-Location C:\HiLeS\HiLeS_WEB
git status
git fetch origin
git switch multi-pico
git pull --ff-only
```

Si hay cambios locales o falla el pull, revisar antes de continuar. No forzar ni borrar archivos.

**Narración:**

> Trabajamos con la rama multi-pico. Registramos el commit para saber exactamente qué versión instalamos y poder reproducir los resultados.

## 4. Instalar dependencias y comprobar el software

```powershell
Set-Location C:\HiLeS\HiLeS_WEB\frontend
npm.cmd ci
```

`npm ci` instala las versiones fijadas por el repositorio. Continuar solamente si termina correctamente.

```powershell
npm.cmd run test:run -- --maxWorkers=1
npm.cmd run lint
npm.cmd run build
```

Desde la raíz, probar el firmware con dobles de hardware:

```powershell
Set-Location C:\HiLeS\HiLeS_WEB
python -m unittest discover -s firmware/tests -p "test_*.py"
```

Comprobar el aprovisionamiento simulado:

```powershell
.\scripts\test-pico-provisioning.ps1
```

Si Windows bloquea específicamente ese script por política de ejecución, ejecutarlo solo para ese proceso:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-pico-provisioning.ps1
```

**Resultado esperado:** pruebas aprobadas, lint sin errores, build finalizado y `Pruebas de aprovisionamiento Pico: PASS`. Registrar cantidades y salidas reales. Las pruebas simuladas no certifican la conexión física.

**Narración:**

> Antes de conectar hardware comprobamos que el código descargado compila y pasa sus pruebas. Esto ayuda a distinguir problemas del proyecto de problemas de red o de una placa.

## 5. Conectar la red e identificar la IP

Conectar el PC a la red de las Pico y ejecutar:

```powershell
ipconfig
```

Anotar la dirección IPv4 del adaptador conectado a esa red. No usar direcciones de VPN, Hyper-V o WSL. No usar `0.0.0.0` como destino. En las Pico y otros PCs, `localhost` apunta a ellos mismos, no al servidor.

Por ejemplo, si el servidor tiene `192.168.1.50`, usar esa IP en `MQTT_HOST`, en el host WebSocket de los navegadores y en la URL compartida.

Reservar la IP en el router cuando sea posible. Si cambia, actualizar las configuraciones. Evitar redes de invitados que impidan comunicarse entre dispositivos.

**Narración:**

> Esta es la dirección del servidor dentro de nuestra red. Las Pico la usan para encontrar Mosquitto y los otros computadores para abrir HiLeS.

## 6. Configurar Mosquitto

Abrir PowerShell **como administrador** para administrar el servicio y el firewall.

```powershell
Get-Service mosquitto
```

Si el servicio no existe, revisar la instalación.

### 6.1 Crear un usuario MQTT

En una instalación nueva:

```powershell
Set-Location "C:\Program Files\mosquitto"
.\mosquitto_passwd.exe -c passwords.txt hiles_demo
```

Introducir la contraseña dos veces y conservarla para el frontend y las Pico.

**El parámetro `-c` crea o reemplaza el archivo de contraseñas.** Si ya hay usuarios configurados, agregar o actualizar sin `-c`:

```powershell
.\mosquitto_passwd.exe passwords.txt hiles_demo
```

### 6.2 Configurar MQTT y WebSocket

```powershell
notepad "C:\Program Files\mosquitto\mosquitto.conf"
```

Para la instalación nueva, guardar:

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

El puerto 1883 atiende a las Pico; 9001 atiende a los navegadores.

```powershell
Restart-Service mosquitto
Get-Service mosquitto
Test-NetConnection localhost -Port 1883
Test-NetConnection localhost -Port 9001
```

**Resultado esperado:** servicio `Running` y `TcpTestSucceeded : True` en ambos puertos.

Si falla el servicio, observar el error directamente:

```powershell
Stop-Service mosquitto
& "C:\Program Files\mosquitto\mosquitto.exe" -c "C:\Program Files\mosquitto\mosquitto.conf" -v
```

Revisar sintaxis, rutas, permisos de lectura del archivo de contraseñas y puertos ocupados. Al terminar, pulsar `Ctrl+C` y ejecutar:

```powershell
Start-Service mosquitto
```

No dejar el servicio y un Mosquitto manual intentando ocupar los mismos puertos.

**Narración:**

> Mosquitto intercambia mensajes. Tener el broker en este PC no significa que el circuito se calcule aquí: cada bloque se ejecuta en la Pico o navegador asignado.

## 7. Permitir conexiones de la red local

Usar una red de laboratorio de confianza y comprobar que Windows la tenga clasificada como **Privada**.

En PowerShell administrador, crear una vez:

```powershell
New-NetFirewallRule -DisplayName "HiLeS MQTT 1883 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 1883 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow

New-NetFirewallRule -DisplayName "HiLeS WebSocket 9001 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 9001 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow

New-NetFirewallRule -DisplayName "HiLeS Web 5173 LAN" `
  -Direction Inbound -Protocol TCP -LocalPort 5173 `
  -RemoteAddress LocalSubnet -Profile Private -Action Allow
```

No repetir las reglas cada vez que se inicia el proyecto. Esta instalación es para una LAN; publicar por Internet requiere HTTPS/WSS y controles de acceso adecuados.

## 8. Configurar e iniciar HiLeS

En PowerShell normal:

```powershell
Set-Location C:\HiLeS\HiLeS_WEB\frontend
Copy-Item .env.example .env.local
notepad .env.local
```

Si ya existe `.env.local`, abrirlo directamente para conservar su configuración. Completar:

```env
VITE_MQTT_HOST=IP_REAL_DEL_PC
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=hiles_demo
VITE_MQTT_PASSWORD=CONTRASENA_QUE_CREASTE
```

Reemplazar los marcadores por los valores del ensayo. Comprobar que el archivo está ignorado:

```powershell
git check-ignore .env.local
```

Iniciar:

```powershell
npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Mantener la terminal abierta. `--strictPort` evita que cambie silenciosamente a 5174 si 5173 está ocupado. Si falla por puerto ocupado, comprobar si ya existe una instancia de HiLeS antes de iniciar otra.

Abrir:

```text
http://localhost:5173/?project=proyecto-video
```

Introducir el nombre y comprobar MQTT. Si el panel pide configuración, usar los mismos datos. Después de modificar `.env.local`, recargar la página; si fuera necesario, reiniciar Vite.

Las variables `VITE_` llegan al navegador: utilizar una cuenta exclusiva del laboratorio y ocultar su contraseña durante la grabación.

**Narración:**

> El parámetro project identifica el circuito compartido. Los participantes y las Pico deben utilizar exactamente el mismo identificador.

## 9. Comprobar un segundo PC

En otro PC de la red abrir:

```text
http://IP_REAL_DEL_PC:5173/?project=proyecto-video
```

El segundo PC no necesita clonar el repositorio ni ejecutar npm.

Comprobar:

1. Abre la página e introduce un nombre.
2. Ambos usuarios aparecen como participantes.
3. Un cambio en un elemento aparece en ambos navegadores.
4. Ambos usan el mismo proyecto.

Diagnóstico desde el segundo PC:

```powershell
Test-NetConnection IP_REAL_DEL_PC -Port 5173
Test-NetConnection IP_REAL_DEL_PC -Port 9001
```

Si falla 5173, revisar Vite, IP y firewall. Si falla solo 9001, revisar broker y firewall. Si ambos responden pero no sincroniza, comprobar credenciales y proyecto.

**Narración:**

> El segundo computador recibe la aplicación desde el servidor. Además de editar, su pestaña puede ejecutar bloques cuando habilitamos su worker.

## 10. Preparar MicroPython según la placa

**Placa existente:** respaldar antes de actualizar. Cambiar de PC o proyecto no requiere reinstalar MicroPython si el runtime ya funciona.

**Placa nueva:** descargar el UF2 estable para el modelo exacto:

- [Pico W](https://micropython.org/download/RPI_PICO_W/).
- [Pico 2 W](https://micropython.org/download/RPI_PICO2_W/).

Mantener BOOTSEL al conectar USB y copiar el UF2 correspondiente a la unidad que aparezca. La placa se reinicia al terminar. No reinstalar a ciegas una placa que contiene archivos sin respaldar.

En Thonny:

1. Herramientas → Opciones → Intérprete.
2. MicroPython (Raspberry Pi Pico).
3. Seleccionar explícitamente el puerto de la placa.
4. Esperar `>>>` y comprobar:

```python
import sys
print(sys.implementation)
```

Registrar modelo y versión. Las pruebas anteriores del proyecto usaron Pico W con MicroPython 1.28.0 y Pico 2 W con 1.29.0. Validar otras versiones antes de afirmar compatibilidad.

## 11. Instalar mpremote y comprobar umqtt

En PowerShell normal:

```powershell
python -m pip install mpremote
python -m mpremote connect list
```

Identificar el puerto real. COM5 y COM8 son ejemplos y pueden cambiar en el PC nuevo.

Cerrar todas las ventanas de Thonny antes de usar mpremote: cada puerto admite un único programa a la vez. Detener el backend no garantiza liberar el puerto.

En una placa nueva:

```powershell
python -m mpremote connect COM5 mip install umqtt.simple
python -m mpremote connect COM5 exec "from umqtt.simple import MQTTClient; print('UMQTT_OK')"
```

**Resultado esperado:** `UMQTT_OK`. Si ya existe la dependencia, comprobar el import antes de reinstalarla. La instalación de paquetes necesita acceso a Internet desde el PC.

## 12. Crear una configuración diferente por Pico

En HiLeS abrir Ejecutores → Configuración de placas → Preparar otra Raspberry Pi Pico.

Completar para Pico 1:

- Red y contraseña Wi-Fi.
- IP actual del servidor en host MQTT.
- Puerto MQTT 1883.
- Usuario y contraseña de Mosquitto.
- Identidad `pico01w`.
- Proyecto `proyecto-video`.

Descargar `config_local.py` y guardarlo fuera del repositorio:

```text
C:\HiLeS-config\pico01w\config_local.py
```

Repetir para Pico 2 con identidad `pico02w`:

```text
C:\HiLeS-config\pico02w\config_local.py
```

| Campo | Pico 1 | Pico 2 |
|---|---|---|
| HILES_PROJECT_ID | proyecto-video | proyecto-video |
| MQTT_HOST y credenciales | Mismo broker | Mismo broker |
| DEVICE_ID | pico01w | pico02w |
| MQTT_CLIENT_ID | Único para Pico 1 | Único para Pico 2 |

Si una configuración anterior define `EXECUTOR_ID` explícitamente, comprobar que también sea único. La plantilla actual lo deriva de la identidad de la placa.

No copiar el archivo de la primera Pico a la segunda sin cambiar sus identidades.

**Narración:**

> Todas las Pico utilizan el mismo runtime. Su configuración individual indica la red, el broker, el proyecto y su identidad. Las identidades distintas evitan que una placa expulse a otra del broker.

## 13. Respaldar y desplegar el runtime

Conectar una placa a la vez durante la preparación.

Para una placa existente, respaldar **antes de cambiar la configuración**:

```powershell
Set-Location C:\HiLeS\HiLeS_WEB
python .\scripts\manage-pico-fleet.py `
  --ports COM5 `
  --mode backup `
  --backup-root C:\HiLeS-respaldos `
  --report .\output\respaldo-pico01w.json
```

Exigir `"ok": true` antes de continuar. Los respaldos contienen credenciales y deben mantenerse fuera de Git.

Cargar la configuración propia:

```powershell
python -m mpremote connect COM5 fs cp `
  "C:\HiLeS-config\pico01w\config_local.py" `
  :/config_local.py
```

En una placa nueva cargar esa configuración antes de usar el despliegue de la herramienta. Después:

```powershell
python .\scripts\manage-pico-fleet.py `
  --ports COM5 `
  --mode deploy `
  --backup-root C:\HiLeS-respaldos `
  --report .\output\despliegue-pico01w.json
```

La herramienta respalda, sincroniza los módulos del runtime, compara hashes, conserva configuración y umqtt, y reinicia la placa.

**Resultado esperado:**

```text
"matches": true
"config_local_preserved": true
"umqtt_preserved": true
"runtime_restarted": true
"ok": true
```

Repetir para Pico 2 con su puerto y archivo propios. No continuar si falla un comando.

El ZIP también puede generarse y comprobarse desde la raíz para la distribución manual:

```powershell
.\scripts\prepare-pico-deployment.ps1
Get-FileHash .\output\hiles-pico-w-deploy.zip -Algorithm SHA256
Get-Content .\output\hiles-pico-w-deploy.sha256
```

Los hashes deben coincidir. La herramienta de flota anterior copia directamente desde `firmware/pico`; no necesita extraer el ZIP.

## 14. Confirmar las dos Pico

Dejar ambas alimentadas y Thonny cerrado. Esperar aproximadamente 15–30 segundos y abrir:

```text
http://IP_REAL_DEL_PC:5173/?project=proyecto-video
```

En Ejecutores deben aparecer disponibles `pico:pico01w` y `pico:pico02w`.

Si falta una:

1. Comparar HILES_PROJECT_ID en ambas configuraciones con el valor de la URL.
2. Confirmar identidades MQTT distintas.
3. Comparar MQTT_HOST con la IPv4 actual del servidor.
4. Comprobar alimentación, Wi-Fi y broker.

Un fallo real anterior fue que ambas Pico estaban online, pero en proyectos diferentes. Un estado online en otro proyecto no hace que aparezcan en este circuito.

## 15. Ensayar el circuito distribuido

1. Importar en el primer navegador `output/demo-4-semaforos-distribuidos.json`.
2. Comprobar que el segundo navegador recibe el mismo circuito.
3. Habilitar el worker en cada pestaña que ejecutará bloques.
4. Asignar, por ejemplo:

| Bloque | Destino |
|---|---|
| Norte | Pico 1 |
| Este | Pico 2 |
| Sur | Navegador del servidor |
| Oeste | Navegador del segundo PC |

5. Pulsar Desplegar.
6. Esperar ACK aceptados de los ejecutores participantes.
7. Comprobar etiquetas del canvas y el botón Mostrar/Ocultar destinos internos.
8. Introducir valores desde Entradas.
9. Ejecutar primero con Paso y después en ejecución continua.

Para el ejemplo de semáforos, la guía existente propone Norte 0, Este 5, Sur 0 y Oeste 0. Comprobar en vivo la cesión del token, la transición verde → amarillo → rojo y la recepción del token en el siguiente bloque. Determinar los clics y tiempos reales durante el ensayo antes de fijarlos en la grabación.

Registrar:

- Destino seleccionado de cada bloque.
- ACK recibidos y aceptados.
- Resultado visible en los dos navegadores.
- Recorrido y conservación del token previsto.
- Paso transitorio por amarillo.
- Detención y reinicio del circuito.
- Recepción de estados actuales por elemento.

El ACK confirma recepción y aceptación del fragmento; no demuestra por sí solo que el circuito haya ejecutado correctamente.

La marca Obsoleto puede indicar falta de un snapshot del despliegue actual aunque la placa esté online. Si persiste después de los ACK y un paso, investigar la recepción del estado antes de aprobar la prueba.

**Narración:**

> Desplegar envía a cada ejecutor su parte del circuito. El ACK confirma que la recibió y aceptó. Después iniciamos la ejecución y observamos los resultados reunidos en el canvas.

## 16. Ensayar recuperación

1. Detener la ejecución.
2. Desconectar una Pico.
3. Observar disponibilidad y estado de sus elementos.
4. Volver a conectarla.
5. Esperar que aparezca disponible.
6. Si hace falta, desplegar otra vez y comprobar los ACK antes de continuar.

Registrar el comportamiento real. No afirmar recuperación automática de todos los casos sin comprobarla físicamente.

## 17. Problemas conocidos y diagnóstico

| Síntoma | Qué comprobar |
|---|---|
| COM ocupado | Cerrar Thonny, otras consolas serie y otras sesiones mpremote; volver a listar dispositivos |
| Backend terminated en Thonny | Leer backend.log; puede ser un error interno o falta de memoria, no asumir fallo del firmware |
| TclError al abrir un archivo | Reiniciar Thonny y cerrar pestañas remotas restauradas; usar mpremote con respaldo si persiste |
| MemoryError al abrir config_local.py | Evitar cargar el editor remoto mientras el runtime ocupa memoria; descargar, editar localmente y volver a subir |
| Solo aparece una Pico | Proyecto distinto, identidad duplicada o una placa sin conexión |
| Wi-Fi funciona pero MQTT no | IP del broker, puerto 1883, credenciales, firewall y aislamiento de clientes |
| Otro PC ve la página pero no el proyecto | Puerto 9001, credenciales WebSocket y project ID |
| Vite intenta usar 5174 | Ya hay un proceso en 5173; usar strictPort e identificarlo |
| Fragmento rechazado | Leer ACK/error: memoria, tamaño, hash, época o perfil Python |
| Sin resultados actuales | Revisar snapshot del despliegue activo y estado de su ejecutor |

No abrir archivos de configuración en pantalla durante la grabación. No crear archivos vacíos si falló una descarga. No subir una configuración vacía a la placa.

## 18. Checklist para autorizar la grabación

- [ ] Herramientas y versiones registradas.
- [ ] Rama y commit registrados.
- [ ] Dependencias instaladas con npm ci.
- [ ] Pruebas frontend y firmware aprobadas.
- [ ] Lint y build aprobados.
- [ ] Mosquitto Running y puertos 1883/9001 disponibles.
- [ ] IP del servidor registrada y configurada en todos los dispositivos.
- [ ] Segundo PC abre 5173 y conecta a 9001.
- [ ] Colaboración sincronizada.
- [ ] Dos Pico con mismo proyecto e identidades únicas.
- [ ] Runtime completo y hashes coincidentes.
- [ ] Configuración y umqtt preservados en actualizaciones.
- [ ] Ambas Pico seleccionables en el editor.
- [ ] ACK aceptados del despliegue.
- [ ] Ejecución repartida entre Pico y navegador verificada.
- [ ] Token y colores verificados.
- [ ] Reinicio y recuperación registrados.
- [ ] Evidencias sin contraseñas ni archivos de configuración reales.

## 19. Orden de grabación

Usar los capítulos anteriores como escenas:

1. Presentar objetivo, equipos y arquitectura.
2. Instalar herramientas y mostrar versiones.
3. Clonar rama y registrar commit.
4. Instalar dependencias y mostrar verificaciones.
5. Identificar red e IP del servidor.
6. Preparar Mosquitto y comprobar puertos.
7. Configurar e iniciar HiLeS.
8. Abrir el mismo proyecto desde otro PC.
9. Preparar cada placa y su configuración única.
10. Respaldar y desplegar runtime.
11. Confirmar ambos ejecutores.
12. Repartir bloques, desplegar y observar ACK.
13. Ejecutar y demostrar token, colores y resultados compartidos.
14. Mostrar reinicio y la recuperación realmente comprobada.

Se pueden acelerar descargas e instalaciones, pero mostrar las verificaciones y resultados completos. Ocultar contraseñas Wi-Fi/MQTT y contenidos de .env.local, config_local.py y respaldos. Usar una cuenta exclusiva de demostración.

## 20. Arranque cotidiano después de instalar

1. Conectar el servidor y las Pico a la red del ensayo.
2. Confirmar que la IP del servidor no cambió.
3. Comprobar `Get-Service mosquitto` y arrancarlo si está detenido.
4. Iniciar Vite en una sola terminal con el comando del capítulo 8.
5. Alimentar ambas Pico; main.py arranca automáticamente.
6. Abrir la URL del mismo proyecto en los navegadores.
7. Habilitar solo los workers que ejecutarán bloques.
8. Revisar disponibilidad, asignaciones y despliegue antes de ejecutar.

No hace falta mantener Thonny abierto para ejecutar las Pico.

## 21. Registro del ensayo

| Dato | Resultado real |
|---|---|
| Fecha | Por completar |
| PC y Windows | Por completar |
| Rama y commit | Por completar |
| Node / npm / Python | Por completar |
| Mosquitto / Thonny | Por completar |
| IP del servidor | Por completar |
| Proyecto | Por completar |
| Pico 1: modelo, versión, puerto | Por completar |
| Pico 2: modelo, versión, puerto | Por completar |
| Pruebas, lint y build | Por completar |
| ACK y ejecución física | Por completar |
| Token y colores | Por completar |
| Recuperación | Por completar |
| Fallos encontrados y solución | Por completar |
| Listo para grabar | Pendiente |

## 22. Documentos complementarios

- [Guía de replicación Windows](GUIA_REPLICACION_COMPLETA_WINDOWS.md).
- [Agregar Pico y ejecutores](GUIA_AGREGAR_PICO_Y_EJECUTORES.md).
- [Prueba física Pico](mqtt/GUIA_PRUEBA_PICO_W.md).
- [Arquitectura del sistema](architecture/ARQUITECTURA_SISTEMA.md).
- [Guion de demostración de la entrega 8](../entregas/entrega-8-6-noviembre/GUION_DEMOSTRACION.md).

Las guías antiguas pueden citar commits y resultados históricos; el registro de este ensayo es el que determina lo validado para la grabación.
