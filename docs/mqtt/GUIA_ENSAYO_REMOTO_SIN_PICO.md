# Ensayo de ejecución distribuida sin Pico física

**Vigente para:** rama `multi-pico` (entrega 8).
**Objetivo:** comprobar broker, colaboración, despliegue, canales remotos y controles usando solo navegadores. Sirve como regresión sin hardware y como plan B de la demostración.

> Hasta la entrega 7 esta guía describía el modo **Pico / MQTT** con publicación manual de instantáneas `v1`. Ese modo se retiró en la entrega 8. Hoy toda ejecución usa el panel **Ejecutores** y el protocolo v3.

## 1. Requisitos

- Mosquitto activo en `1883` y `9001` (ver [`../GUIA_REPLICACION_COMPLETA_WINDOWS.md`](../GUIA_REPLICACION_COMPLETA_WINDOWS.md) §5).
- `frontend/.env.local` con la IPv4 del PC y las credenciales del laboratorio.
- Frontend iniciado con `npm run dev -- --host 0.0.0.0`.
- Dos navegadores, perfiles o equipos (A y B).

## 2. Comprobación automática previa

Desde la raíz del repositorio:

```powershell
node .\scripts\test-mqtt-four-clients.mjs
node .\scripts\test-project-collaboration.mjs
node .\scripts\test-distributed-mqtt.mjs --mode=memory
node .\scripts\test-distributed-mqtt.mjs --mode=mqtt --timeout=8000
```

El modo `memory` no necesita broker. El modo `mqtt` usa Mosquitto real; en él los ejecutores `pico:*` son dobles en Node.js y **no** cuentan como placas.

## 3. Ensayo manual navegador ↔ navegador

1. En A, abrir `http://IP_DEL_PC:5173/?project=ensayo-sin-pico` y escribir un nombre.
2. Con el lienzo vacío, pulsar **Cargar ejemplo multi-Pico**.
3. **Compartir** → copiar el enlace y abrirlo en B. Ambos deben verse como colaboradores.
4. En A y en B, abrir **Ejecutores** y activar «Ejecutar aquí los bloques asignados a «Este navegador»».
5. En A, en **Destino por bloque**:
   - SB 1 → el navegador B;
   - SB 2 → «Este navegador»;
   - SB 3 → «Este navegador».
6. Pulsar **Desplegar** y esperar un ACK por fragmento.
7. En **Entradas**, enviar `6` a «Número de entrada» y pulsar **Paso** varias veces.
8. En el estado agregado deben verse `doble = 12` y `alerta = true`. Con `4`: `8` y `false`.
9. Probar **Iniciar**, **Detener** y **Reiniciar** de la barra superior; B debe ver el mismo estado.
10. Cerrar B: los elementos de SB 1 deben verse «Obsoleto» y la asignación se conserva. Reabrir B, activar «Ejecutar aquí» y, si hace falta, **Volver a desplegar**.

## 4. Qué no demuestra este ensayo

- Wi-Fi, memoria y temporización de una Pico real.
- Que el firmware de las placas sea el paquete canónico.
- Las matrices Pico ↔ Pico y Pico ↔ navegador.

Esos puntos se prueban con [`GUIA_PRUEBA_PICO_W.md`](GUIA_PRUEBA_PICO_W.md).
