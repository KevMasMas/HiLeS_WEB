# Guion de demostración — entrega 8

**Duración:** 10 minutos como máximo.
**Versión:** `multi-pico`, commit `d15d5a0`.
**Base:** plan §14 y guion técnico de Persona 4 (`docs/mqtt/vectores_ir_v2/MATRIZ_CONFORMIDAD_PERSONA_4.md` §8).
**Regla:** solo se presenta como funcionando lo que se ve en vivo. Lo que no tiene evidencia física se anuncia como pendiente (§5).

## 1. Preparación (antes de entrar a la sala)

| Elemento | Comprobación |
|---|---|
| PC servidor | `git rev-parse --short HEAD` → `d15d5a0`; árbol limpio |
| Broker | `Get-Service mosquitto` → `Running`; `Test-NetConnection localhost -Port 1883` y `-Port 9001` |
| IP | `ipconfig`; la IPv4 actual coincide con `frontend/.env.local` y con el `config_local.py` de cada Pico |
| Frontend | `cd frontend; npm run dev -- --host 0.0.0.0` |
| Proyecto | Elegir un `projectId` nuevo (por ejemplo `demo-entrega8`) y usarlo como `HILES_PROJECT_ID` en las dos Picos |
| Picos | Ambas con el paquete de SHA-256 `3e89069c…692921`, identidades distintas (`pico01w`, `pico02w`), encendidas y con `worker_v3` en la consola |
| Navegadores | Navegador A (presentador) y navegador B (segundo colaborador, otro PC o celular) |
| Respaldo | Si las Picos no están disponibles, usar el **plan B** (§4) y decirlo explícitamente |

No mostrar en pantalla `.env.local`, `config_local.py`, `passwords.txt` ni el panel **Conexión** con la contraseña escrita.

## 2. Guion

| Tiempo | Acción en pantalla | Qué decir | Resultado esperado |
|---|---|---|---|
| 0:00–1:00 | Abrir `http://IP:5173/?project=demo-entrega8` en A. Escribir el nombre (por ejemplo `Persona 5`). Pulsar el chip de conexión. | "La conexión (Local/LAN) es cómo llegamos al broker; no decide dónde corre cada bloque." | Panel **Conexión** en modo Local/LAN y conectado |
| 1:00–2:00 | Abrir **Ejecutores**. | "Cada Pico se anuncia con su identidad y el mismo proyecto." | `Pico pico01w` y `Pico pico02w` disponibles; «Proyecto de ejecución: demo-entrega8» |
| 2:00–3:00 | Con el lienzo vacío, **Cargar ejemplo multi-Pico**. En **Destino por bloque**: SB 1 → `pico01w`, SB 2 → `pico02w`, SB 3 → «Este navegador» (activar «Ejecutar aquí»). | "Asignamos por Structural Block; sus elementos heredan el destino." | Tres bloques asignados; **Desplegar** habilitado |
| 3:00–4:00 | **Desplegar**. | "Se compila, se divide en un fragmento por ejecutor y cada uno confirma con un ACK." | Tres fragmentos y tres ACK; la fase pasa a «Listo» |
| 4:00–5:30 | **Entradas** → Service «Número de entrada» = `6`. Pulsar **Paso** varias veces. | "El 6 sale de la Pico 1, se duplica en la Pico 2 y el navegador decide." | Estado agregado: `doble = 12`, `alerta = true`. Repetir con `4` → `8`, `false` |
| 5:30–6:30 | **Iniciar**, **Detener** y **Reiniciar** desde la barra superior. | "Hay un único juego de controles para toda la ejecución." | Fase «Ejecutando» → detenida → valores iniciales |
| 6:30–7:30 | Mostrar un Place con varios tokens: en **Propiedades**, poner `tokens = 3` con capacidad ≥ 3 en un Place de un modelo local. | "El marcado se ve como ×N; la conformidad de tokens, pesos y conflicto se probó con los mismos vectores en navegador y MicroPython." | El Place muestra `×3` |
| 7:30–8:30 | Abrir el mismo enlace en el navegador B (**Compartir** → copiar enlace). | "Colaborar no es ejecutar: B ve el mismo modelo y el mismo estado agregado." | B ve los dos avatares y el mismo estado |
| 8:30–9:15 | Desconectar la alimentación de `pico02w` y esperar unos 15 s. Reconectarla. | "Si un ejecutor cae, su parte se marca como obsoleta y la asignación se conserva." | Elementos de SB 2 «Obsoleto»; al volver, se resincroniza (si no, **Volver a desplegar**) |
| 9:15–10:00 | **Ejecutores** → **Configuración de placas** → **Preparar otra Raspberry Pi Pico** con identidad `pico03w` (sin escribir contraseñas reales en pantalla). | "Una tercera placa es el mismo firmware con otro `config_local.py`; no se escribe código." | Formulario válido; descarga de `config_local.py` |

## 3. Cierre (30 s)

Decir explícitamente:

- qué se vio en vivo;
- qué está probado solo en software (conformidad de elementos y canales; Browser ↔ Browser);
- qué sigue pendiente (§5).

## 4. Plan B sin placas

Si las Picos no aparecen en 2 minutos, no improvisar la configuración:

1. Decirlo: "La matriz física no está disponible; mostramos la misma ejecución con navegadores."
2. En el navegador A, activar «Ejecutar aquí». En el navegador B, abrir el enlace y activar también «Ejecutar aquí».
3. Asignar SB 1 al navegador B y SB 2 y SB 3 a «Este navegador»; desplegar y seguir el guion desde 4:00.
4. Como respaldo técnico, mostrar en terminal:

   ```powershell
   node .\scripts\test-distributed-mqtt.mjs --mode=mqtt --timeout=8000
   ```

   y aclarar que en ese runner los `pico:*` son **dobles en Node.js**, no placas.

## 5. Lo que no se debe afirmar

| Afirmación | Por qué no |
|---|---|
| "Pico ↔ Pico y Pico ↔ navegador están aprobadas" | Sin evidencia física al corte del 7 de noviembre, salvo que se vea en esta demostración |
| "Las dos placas tienen el runtime canónico" | Inventario y checksums de placas pendientes |
| "Funciona por Internet" | El perfil Remoto `wss://` no se probó con un broker seguro |
| "El semáforo es seguro ante fallos" | No hay lease ni fail-safe: el token puede perderse si cae su ejecutor |
| "Web Serial configura la placa" | Solo se descarga el archivo; la carga es con Thonny o `mpremote` |
| "Todas las pruebas pasan siempre" | `PanelDock.test.tsx:132` falla de forma intermitente por timeout |
