# Agregar otra Pico, configurar la red y elegir ejecutores

**Vigente para:** rama `multi-pico`, commit `d15d5a0` (entrega 8).
**Público:** quien opera el proyecto y necesita sumar una Raspberry Pi Pico W o Pico 2 W, o repartir un modelo entre Picos y navegadores.

Para instalar el PC, Mosquitto y el frontend desde cero, usar primero [`GUIA_REPLICACION_COMPLETA_WINDOWS.md`](GUIA_REPLICACION_COMPLETA_WINDOWS.md). Para el detalle de respaldo y carga física, usar [`mqtt/GUIA_PRUEBA_PICO_W.md`](mqtt/GUIA_PRUEBA_PICO_W.md).

## 1. Idea clave

Todas las Picos ejecutan **el mismo firmware**. Agregar una tercera o cuarta placa no requiere código nuevo: solo cambia su `config_local.py`.

| Campo | ¿Igual en todas las placas? | Ejemplo |
|---|---|---|
| `HILES_PROJECT_ID` | Sí, y debe coincidir con `?project=` de la URL | `proyecto-demo` |
| `MQTT_HOST`, `MQTT_PORT`, usuario y contraseña | Sí, en la misma red | IPv4 del PC del broker, `1883` |
| `HILES_TEAM_ID` | Sí | `equipo1` |
| `DEVICE_ID` | **No** | `pico01w`, `pico02w`, `pico03w` |
| `MQTT_CLIENT_ID` | **No** | igual a `DEVICE_ID` |
| Ejecutor visible | Derivado | `pico:pico03w` |

## 2. Antes de empezar: la red

1. El PC del broker y las Picos deben estar en la **misma red Wi-Fi de 2.4 GHz**; la Pico W no usa 5 GHz. Evitar redes de invitados o universitarias que aíslan clientes.
2. En el PC, ejecutar `ipconfig` y anotar la IPv4 del adaptador conectado a esa red (no la de VPN, WSL, Hyper-V ni VirtualBox).
3. Esa IPv4 es `MQTT_HOST`. **Nunca** usar `localhost` ni `127.0.0.1` en una Pico: para la placa, `localhost` es ella misma.
4. Comprobar el broker en el PC:

   ```powershell
   Get-Service mosquitto
   Test-NetConnection localhost -Port 1883
   Test-NetConnection localhost -Port 9001
   ```

5. La IP puede cambiar al reconectar el PC. Confirmarla antes de cada sesión; si cambió, regenerar el `config_local.py` de cada placa.

## 3. Generar el `config_local.py` desde la aplicación

1. Abrir el proyecto: `http://IP_DEL_PC:5173/?project=<projectId>`.
2. Pulsar **Ejecutores** en la barra superior.
3. En la sección **Configuración de placas**, abrir **Preparar otra Raspberry Pi Pico**.
4. Completar:
   - **Red Wi-Fi** y **Contraseña Wi-Fi**;
   - **IP o host MQTT** (la IPv4 del paso 2) y **Puerto MQTT** (`1883`);
   - **Usuario MQTT** y **Contraseña MQTT**;
   - **Identidad de placa**, por ejemplo `pico03w` (también se usa como `MQTT_CLIENT_ID`);
   - **Proyecto**, que viene precargado con el `projectId` actual.
5. Pulsar **Descargar config_local.py**. El botón queda deshabilitado mientras haya un error. El formulario rechaza campos vacíos, puertos fuera de rango e identificadores con espacios, `/`, `+` o `#`.

Garantías y límites del generador:

- No guarda los valores en el proyecto, en MQTT ni en `localStorage`; el archivo solo se descarga.
- **No** detecta identidades repetidas: comprobar a mano que `pico03w` no exista ya en la lista de ejecutores.
- **No** avisa si se escribe `localhost` ni si la red es de 5 GHz.
- Web Serial no está habilitado para escribir en la placa. La carga se hace con Thonny o `mpremote`.

Alternativa sin la aplicación: copiar `firmware/pico/config_local.example.py` como `config_local.py` **fuera del repositorio** y editar la copia.

## 4. Cargar el firmware en la placa nueva

1. Generar y verificar el paquete canónico desde la raíz del repositorio:

   ```powershell
   & .\scripts\prepare-pico-deployment.ps1
   Get-FileHash .\output\hiles-pico-w-deploy.zip -Algorithm SHA256
   Get-Content .\output\hiles-pico-w-deploy.sha256
   ```

   Los dos hashes deben coincidir.
2. Instalar MicroPython (UF2 de Pico W o Pico 2 W según la placa) y `umqtt.simple`. Ver [`mqtt/GUIA_PRUEBA_PICO_W.md`](mqtt/GUIA_PRUEBA_PICO_W.md) §4.
3. Copiar a la raíz de la placa `main.py`, `core/`, `devices/`, `hiles/`, `platform/` y `pubsub/` del ZIP extraído, y el `config_local.py` descargado.
4. Si la placa **ya tenía HiLeS**, respaldar primero, conservar su `config_local.py` y `umqtt/`, y reemplazar el runtime como una unidad (ver la misma guía §5).

## 5. Comprobar que la placa aparece

1. En Thonny, reiniciar con `Ctrl+D`. Deben aparecer las tareas `mqtt`, `led`, `motor`, `watchdog` y `worker_v3`, y `[MQTT] Conectado a <IP>:1883`.
2. En la aplicación, abrir **Ejecutores**. El panel muestra el «Proyecto de ejecución»: las Picos deben usar exactamente ese `HILES_PROJECT_ID`.
3. La placa aparece como `Pico pico03w`. Si aparece pero no se puede elegir, el panel muestra la causa:

| Causa mostrada | Significado | Solución |
|---|---|---|
| Pertenece al proyecto `X` | `HILES_PROJECT_ID` distinto | Corregir el proyecto y regenerar `config_local.py` |
| No usa el protocolo distribuido v3 | Firmware antiguo | Reinstalar el paquete canónico |
| No ha actualizado su estado durante más de 15 segundos | Obsoleta: sin latido reciente | Revisar Wi-Fi, broker y alimentación |
| Está desconectado | Estado `offline` (Last Will) | Reiniciar la placa; revisar `MQTT_CLIENT_ID` duplicado |
| Está degradado y requiere revisión | Estado `degraded` | Revisar la consola serie |
| No declara soporte para IR v2 / No soporta Python ni expresiones | Runtime incompleto | Reinstalar `hiles/` completo |
| Está procesando otro despliegue | Estado `deploying` | Esperar a que termine |

Si al encender una placa desaparece otra, ambas comparten `MQTT_CLIENT_ID`.

## 6. Elegir dónde corre cada bloque

1. **Este navegador como ejecutor (opcional):** en **Ejecutores**, activar «Ejecutar aquí los bloques asignados a «Este navegador»». Sin esa casilla, el navegador solo colabora.
2. **Asignar:** en la sección **Destino por bloque**, elegir para cada Structural Block una Pico, «Este navegador» u otro navegador. Los elementos internos heredan el destino («Heredar (…)»).
3. **Sobreescribir:** en la misma lista, un Functional Block puede tener un destino propio cuando deba correr en otro ejecutor. Los Places y Transitions unidos por arcos deben quedar en el mismo ejecutor; solo los canales CCH, DCH y LCH cruzan entre ejecutores.
4. **Desplegar:** el botón se habilita solo si todos los bloques tienen un destino disponible. Si no, aparece «No se puede desplegar todavía» con la lista de problemas.
5. Esperar un **ACK** por fragmento. Después se opera con **Iniciar**, **Paso**, **Detener** y **Reiniciar** de la barra superior, y se introducen valores desde **Entradas**.

Combinaciones válidas para un modelo de dos bloques: Pico ↔ Pico, Pico ↔ navegador y navegador ↔ navegador.

## 7. Modo de conexión del navegador

El botón **Conexión** de la barra superior elige cómo llega el navegador al broker. No decide dónde se ejecuta cada bloque.

| Modo | Protocolo | Uso |
|---|---|---|
| Local / LAN | `ws://` al puerto 9001 | Laboratorio o red de confianza |
| Remoto | `wss://` con TLS | Broker remoto seguro. **No probado en esta entrega**; no exponer el Mosquitto del laboratorio a Internet |

Las Picos siempre usan MQTT/TCP (`1883`) contra la IP configurada en su `config_local.py`.

## 8. Lista de verificación de una placa nueva

- [ ] Hash del ZIP verificado.
- [ ] `config_local.py` con `DEVICE_ID`/`MQTT_CLIENT_ID` únicos y el `HILES_PROJECT_ID` de la URL.
- [ ] `MQTT_HOST` es la IPv4 actual del PC, no `localhost`.
- [ ] La consola muestra `worker_v3` y la conexión MQTT.
- [ ] La placa aparece como `Pico <id>` y se puede seleccionar.
- [ ] Un despliegue con un bloque asignado a ella recibe ACK.
- [ ] `config_local.py` no se agregó al repositorio.
