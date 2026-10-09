# Mosquitto local para HiLeS

Configuración comprobada con Eclipse Mosquitto 2.1.2 en Windows. Expone MQTT
en el puerto `1883` para la Pico y MQTT sobre WebSockets en el puerto `9001`
para la aplicación web.

## Preparar el broker

Abrir PowerShell como administrador y ejecutar:

```powershell
cd "C:\Program Files\mosquitto"
.\mosquitto_passwd.exe -c passwords.txt USUARIO_MQTT
icacls passwords.txt /inheritance:e
icacls passwords.txt /grant '*S-1-5-18:(R)'
Copy-Item `
  "RUTA_DEL_REPOSITORIO\entregas\entrega-4-9-octubre\mosquitto\mosquitto.conf.example" `
  "C:\Program Files\mosquitto\mosquitto.conf" -Force
Restart-Service mosquitto
```

La contraseña se escribe solamente en el indicador interactivo de
`mosquitto_passwd`. El archivo `passwords.txt` no se debe copiar al repositorio.
Para cambiar la contraseña posteriormente se ejecuta el mismo comando sin `-c`:

```powershell
.\mosquitto_passwd.exe passwords.txt USUARIO_MQTT
Restart-Service mosquitto
```

## Iniciar, detener y comprobar

Estos comandos requieren una terminal con permisos de administrador:

```powershell
Start-Service mosquitto
Stop-Service mosquitto
Restart-Service mosquitto
Get-Service mosquitto
```

Comprobar los listeners:

```powershell
netstat -ano | Select-String ':1883|:9001'
```

Diagnosticar un fallo de configuración con el servicio detenido:

```powershell
& "C:\Program Files\mosquitto\mosquitto.exe" `
  -c "C:\Program Files\mosquitto\mosquitto.conf" -v
```

## Prueba MQTT local en el puerto 1883

En una primera terminal:

```powershell
$clave = Read-Host "Contraseña MQTT" -MaskInput
$usuario = Read-Host "Usuario MQTT"
& "C:\Program Files\mosquitto\mosquitto_sub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba" -v
```

En una segunda terminal:

```powershell
$clave = Read-Host "Contraseña MQTT" -MaskInput
$usuario = Read-Host "Usuario MQTT"
& "C:\Program Files\mosquitto\mosquitto_pub.exe" `
  -h localhost -p 1883 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba" `
  -m '{"mensaje":"prueba persona 1"}'
```

## Prueba WebSocket local en el puerto 9001

Se repite la prueba anterior en dos terminales, agregando `--ws` y cambiando el
puerto a `9001`:

```powershell
$clave = Read-Host "Contraseña MQTT" -MaskInput
$usuario = Read-Host "Usuario MQTT"
& "C:\Program Files\mosquitto\mosquitto_sub.exe" `
  --ws -h localhost -p 9001 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba-websocket" -v
```

```powershell
$clave = Read-Host "Contraseña MQTT" -MaskInput
$usuario = Read-Host "Usuario MQTT"
& "C:\Program Files\mosquitto\mosquitto_pub.exe" `
  --ws -h localhost -p 9001 -u $usuario -P $clave `
  -t "udfjc/hiles/prueba-websocket" `
  -m '{"mensaje":"websocket funcionando"}'
```

## Pendiente para la red local

Antes de conectar la Pico se debe escoger la red de demostración, identificar
la IPv4 del PC, permitir los puertos TCP `1883` y `9001` en el Firewall de
Windows y comprobar el acceso desde un segundo dispositivo. La IP no se fija en
este documento porque cambia según la red utilizada.

