# Arquitectura del sistema HiLeS Web

**Estado descrito:** rama `multi-pico`, commit `d15d5a0` (entrega 8, 6 de noviembre de 2026).
**Complementa:** [`ARQUITECTURA_PICO.md`](ARQUITECTURA_PICO.md) (detalle del firmware) y [`PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md`](../mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md) (contrato normativo).

## 1. Qué es

HiLeS Web es un editor colaborativo de modelos HiLeS: Services, Functional Blocks, Sample, Hold, Places, Transitions y Structural Blocks unidos por canales CCH, DCH y LCH/Petri. El usuario puede ejecutar un mismo modelo repartido entre varios **ejecutores**: navegadores y Raspberry Pi Pico W / Pico 2 W.

No existe un servidor de aplicación. Las piezas son:

```text
                ┌──────────────────────────── PC servidor ────────────────────────────┐
                │  Vite (HTTP :5173)               Mosquitto                          │
                │  sirve la aplicación             MQTT/TCP :1883  ◄── Pico W         │
                │                                  MQTT/WS  :9001  ◄── navegadores    │
                └─────────────────────────────────────────────────────────────────────┘
   Navegador A ── editor + colaborador + (opcional) ejecutor browser:<sesión>
   Navegador B ── editor + colaborador + (opcional) ejecutor browser:<sesión>
   Pico 1      ── ejecutor pico:<DEVICE_ID>
   Pico 2      ── ejecutor pico:<DEVICE_ID>
```

El broker solo transporta mensajes; nunca ejecuta el circuito.

## 2. Dos ejes independientes

| Eje | Dónde se elige | Opciones | Qué decide |
|---|---|---|---|
| **Modo de conexión** del proyecto | Botón **Conexión** de la barra superior | Local/LAN (`ws://`) o Remoto (`wss://`) | Cómo alcanza el navegador al broker |
| **Destino de ejecución** de cada bloque | Panel **Ejecutores** | Una Pico, «Este navegador» u otro navegador | Dónde corre cada Structural Block (y, si se sobreescribe, un Functional Block) |

Colaborar y ejecutar también son capacidades separadas: un navegador puede editar el proyecto sin ofrecerse como ejecutor.

## 3. Frontend (`frontend/`)

React 19, TypeScript 6, Vite 8, React Flow, Zustand, CodeMirror, MQTT.js y Pyodide 0.26.3, servido localmente desde `public/pyodide`.

| Capa | Ruta | Responsabilidad |
|---|---|---|
| Dominio | `src/domain/` | Documento del modelo y migración de versiones |
| Motor | `src/engine/` | Motor TypeScript de referencia: elementos, grafo de datos, Petri y bus |
| IR | `src/services/ir/` | Compiladores y validadores IR v1/v2, particionador distribuido (`particionarIr.ts`) |
| Ejecución distribuida | `src/services/distributed/` | Tópicos v3, validación de mensajes y `BrowserWorker` |
| Proyecto colaborativo | `src/services/projects/` | `ProjectSyncClient`: snapshot, operaciones, presencia y cursores |
| MQTT | `src/services/mqtt/` | Cliente WebSocket, perfiles Local/LAN y Remoto, puente MQTT → Service |
| Estado | `src/stores/` | `useEditorStore`, `useProjectStore`, `useDistributedExecutionStore` (fuente oficial de ejecución); `useSimulationStore` conserva `modoEjecucion` solo por compatibilidad interna, sin control visible |
| Interfaz | `src/features/` | `editor` (barra, lienzo, paleta, propiedades), `distributed` (Ejecutores), `simulation` (Entradas), `mqtt` (Conexión), `setup` (configuración de placas), `onboarding` (tutorial), `collaboration` |
| Aislamiento | `src/workers/` | Workers de JavaScript y Pyodide con límite de tiempo |

### Barra superior

| Grupo | Botones |
|---|---|
| Modelado y despliegue | **Elementos**, **Ejecutores** |
| Paneles auxiliares | **Entradas** (Services y estado agregado), **Propiedades**, **Conexión** |
| Ejecución (único juego de controles) | **Iniciar**, **Paso**, **Detener**, **Reiniciar** |
| Equipo y ayuda | **Compartir**, **Ayuda** (tutorial) |
| Menú **⋯** | Deshacer, Rehacer, Nuevo proyecto, Importar JSON, Exportar JSON; en pantallas pequeñas también los paneles |
| Estado | Fase de ejecución distribuida, modo de conexión y colaboradores |

La habilitación de los controles proviene de `features/distributed/executionControl.ts`; operan sobre el despliegue activo.

## 4. Firmware (`firmware/pico/`)

MicroPython, monolito modular con scheduler cooperativo. Detalle completo en [`ARQUITECTURA_PICO.md`](ARQUITECTURA_PICO.md).

| Módulo | Contenido |
|---|---|
| `core/` | Reloj, `Task`, `Scheduler` |
| `pubsub/` | `Node`, tópicos y `MqttTransport` |
| `hiles/` | Modelos y motores IR v1/v2, `PythonExecutor` acotado, `DistributedWorker` v3 (`FIRMWARE_WORKER_VERSION = "3.0.0"`) |
| `devices/` | `LedTask` (diagnóstico) y `WatchdogTask` |
| `platform/` | Wi-Fi, cliente `umqtt`, GPIO, `resolve_device_id` y `resolve_board_model` |
| `main.py` | Composición; tareas `mqtt`, `led`, `motor`, `watchdog` y `worker_v3` |

El firmware es general: no contiene lógica de semáforos ni de ningún ejemplo. Cada placa difiere solo en `config_local.py`.

## 5. Espacios MQTT

| Prefijo | Uso |
|---|---|
| `udfjc/hiles/v1/<equipo>/<DEVICE_ID>/…` | Diagnóstico por placa: LED, estado de conexión, telemetría y errores |
| `udfjc/hiles/v2/projects/<projectId>/…` | Colaboración: `document/snapshot`, `document/ops`, `presence`, `cursor` |
| `udfjc/hiles/v3/projects/<projectId>/…` | Ejecución distribuida: `executors/<id>/status`, `deployments/manifest`, `fragments`, `ack`, `channels`, `snapshot`, `command`, `input`, `error` |

## 6. Ciclo de una ejecución distribuida

1. **Descubrimiento:** cada ejecutor publica un estado retenido en `executors/<executorId>/status`. El navegador lo valida con `evaluarDisponibilidadEjecutor`: proyecto, protocolo v3, actividad reciente (15 s según la hora de recepción), estado, IR v2, lenguajes y capacidades.
2. **Asignación:** cada Structural Block recibe un destino; sus elementos lo heredan y un Functional Block puede sobreescribirlo. La asignación se guarda en el documento colaborativo.
3. **Despliegue:** **Desplegar** compila el modelo a IR v2, lo divide en un fragmento por ejecutor, limpia los retained de la época anterior y publica el manifiesto y los fragmentos con SHA-256.
4. **Aceptación:** cada ejecutor verifica proyecto, propietario, época, hash, tamaño e IR, y responde con un ACK. Un rechazo conserva el fragmento anterior.
5. **Operación:** con todos los ACK, la barra superior habilita **Iniciar** y **Paso**. Las entradas se inyectan desde **Entradas** hacia el Service propietario.
6. **Canales remotos:** los canales que cruzan ejecutores viajan por MQTT. CCH entrega el último valor, DCH es FIFO con capacidad y LCH es un pulso que se consume una vez. Los arcos Petri nunca cruzan fragmentos.
7. **Estado agregado:** cada ejecutor publica un snapshot parcial; el navegador los compone y marca como «Obsoleto» los elementos de un ejecutor que dejó de reportar.

## 7. Seguridad y límites

- Las credenciales viven en `frontend/.env.local`, `config_local.py` de cada placa o los campos de sesión del panel Conexión. Nunca viajan en el documento colaborativo, la URL ni los mensajes retenidos.
- El generador de `config_local.py` no guarda contraseñas en `localStorage`.
- Mosquitto exige autenticación. La configuración es para una LAN de confianza; un despliegue en Internet requiere `wss://`, TLS, ACL y cuentas que este proyecto todavía no implementa.
- Límites de la Pico: fragmento de 30 000 bytes, 64 elementos y mensajes de hasta 32 KiB.
- El Python remoto es un subconjunto acotado: sin imports ni recursión, con presupuesto de líneas y tamaño.
- La demo de semáforos no tiene lease ni fail-safe: si cae el ejecutor que posee el turno, el token puede perderse.

## 8. Recuperación ante fallos

| Situación | Comportamiento esperado | Acción del operador |
|---|---|---|
| El broker no responde al abrir el proyecto | Tras 1 s aparece **Continuar sin conexión**; se sincroniza después | Revisar Mosquitto y la IP; reconectar desde **Conexión** |
| Un ejecutor se desconecta | Su Last Will publica `offline`; sus elementos se ven «Obsoleto»; la asignación se conserva | Reconectar el ejecutor; se resincroniza con el manifiesto y el fragmento retenidos |
| Un fragmento se rechaza | ACK negativo con código y recomendación; sigue activo el fragmento anterior | Corregir el modelo o la capacidad y **Volver a desplegar** |
| Una Pico expulsa a otra | Dos placas comparten `MQTT_CLIENT_ID` | Asignar identidades únicas |
| Una Pico no aparece | `HILES_PROJECT_ID` distinto de `?project=`, firmware antiguo o sin actividad | Ver [`GUIA_AGREGAR_PICO_Y_EJECUTORES.md`](../GUIA_AGREGAR_PICO_Y_EJECUTORES.md) |
| Firmware mezclado o incompleto | `ImportError` o rechazo de protocolo | Respaldar, reinstalar el paquete canónico completo y conservar `config_local.py` y `umqtt/` |
| Estado inconsistente tras pruebas | Retained de épocas anteriores | **Reiniciar**; si persiste, redesplegar o usar un `projectId` nuevo |

## 9. Pruebas que sostienen esta arquitectura

| Suite | Comando | Resultado en `d15d5a0` |
|---|---|---|
| Frontend | `cd frontend; npm run test:run` | 187 pruebas; una prueba de UI es intermitente por timeout |
| Firmware | `python -m unittest discover -s firmware/tests -p "test_*.py"` | 169 OK |
| Lint, tipos y build | `npm run lint`, `npm run build` | Aprobados |
| Aprovisionamiento | `scripts/test-pico-provisioning.ps1` | PASS (filesystem simulado) |
| Distribuido en memoria y sobre broker real | `node scripts/test-distributed-mqtt.mjs --mode=memory` y `--mode=mqtt` | Aprobados por Persona 4 (6 nov); en modo `mqtt` los `pico:*` son dobles en Node.js |
