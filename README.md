# HiLeS Web

Editor colaborativo y entorno de ejecución distribuida de modelos HiLeS para navegadores y Raspberry Pi Pico W / Pico 2 W.

Con HiLeS Web se puede:

- construir un circuito gráficamente;
- compartirlo con otras personas mediante un enlace;
- repartir su ejecución entre varias Picos y navegadores conectados al mismo broker MQTT (Mosquitto).

**No hay backend:** el repositorio no requiere NestJS, Prisma ni PostgreSQL.

> **Versión vigente:** rama `multi-pico` (entrega 8, 6 de noviembre de 2026).
> Estado detallado y evidencia: [`entregas/entrega-8-6-noviembre/INFORME_FINAL_ENTREGA_8.md`](entregas/entrega-8-6-noviembre/INFORME_FINAL_ENTREGA_8.md).

## Estado actual

| Capacidad | Estado |
|---|---|
| Editor visual (Structural/Functional Block, Service, Sample, Hold, Place, Transition; canales CCH, DCH y LCH) | Funcional |
| Colaboración por proyecto (`?project=<id>`): snapshot, operaciones, presencia, cursores y nombre por participante | Funcional; probado en LAN |
| Functional Blocks en Python (Pyodide en el navegador; subconjunto acotado en MicroPython) y expresiones | Funcional |
| Ejecución distribuida v3: asignación por bloque, fragmentos, ACK, canales remotos y estado agregado | Funcional en software; Browser ↔ Browser probado sobre broker real |
| Interfaz única: controles **Iniciar / Paso / Detener / Reiniciar** en la barra superior; modo de conexión separado del destino | Funcional |
| Places con varios tokens (`×N`), estados «Obsoleto», tutorial de 12 pasos, diseño responsive | Funcional |
| Generador de `config_local.py` para nuevas Picos | Funcional (descarga; la carga es con Thonny o `mpremote`) |
| Firmware MicroPython general y paquete con SHA-256 | Funcional en escritorio (169 pruebas) |
| **Pico ↔ Pico y Pico ↔ navegador en hardware** | **Pendiente de evidencia física** |
| Perfil remoto `wss://` por Internet | Configurable; no probado con un broker seguro |

## Arquitectura en una imagen

```text
Navegadores (editor + colaborador + ejecutor opcional)
        │ MQTT sobre WebSocket :9001
        ▼
Mosquitto en el PC ◄──── MQTT/TCP :1883 ──── Raspberry Pi Pico W (ejecutor pico:<DEVICE_ID>)
        ▲
Vite (HTTP :5173) sirve la aplicación a la LAN
```

- **Modo de conexión** (botón **Conexión**): Local/LAN o Remoto. Define cómo llega el navegador al broker.
- **Destino de ejecución** (panel **Ejecutores**): una Pico o un navegador por cada Structural Block.

Explicación completa: [`docs/architecture/ARQUITECTURA_SISTEMA.md`](docs/architecture/ARQUITECTURA_SISTEMA.md).

## Inicio rápido sin hardware

Requisitos: Git, Node.js 22 LTS o posterior y npm.

```powershell
git clone https://github.com/KevMasMas/HiLeS_WEB.git
cd HiLeS_WEB
git switch multi-pico
cd frontend
npm ci
npm run dev
```

Abrir `http://localhost:5173/`. Si el lienzo está vacío, pulsar **Cargar ejemplo sin hardware** y seguir el tutorial (**Ayuda**).

Sin broker, la aplicación ofrece **Continuar sin conexión** y permite editar. Para colaborar o ejecutar se necesita Mosquitto: ver [`docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md`](docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md).

## Uso

### Barra superior

| Botón | Función |
|---|---|
| **Elementos** | Paleta para arrastrar elementos al lienzo |
| **Ejecutores** | Ejecutar en este navegador, ver Picos, asignar bloques, **Desplegar** y preparar placas |
| **Entradas** | Inyectar valores en Services y ver el estado agregado |
| **Propiedades** | Editar nombre, puertos, tokens, capacidad y código del elemento seleccionado |
| **Conexión** | Modo Local/LAN o Remoto, host, puerto, ruta y credenciales de la sesión |
| **Iniciar / Paso / Detener / Reiniciar** | Único juego de controles del despliegue activo |
| **Compartir** | Copiar el enlace del proyecto |
| **Ayuda** | Tutorial guiado |
| **⋯** | Deshacer, rehacer, nuevo proyecto, importar y exportar JSON |

### Flujo de una ejecución

1. Abrir o compartir `http://IP_DEL_PC:5173/?project=<projectId>`.
2. Comprobar el modo de conexión en **Conexión**.
3. En **Ejecutores**, activar «Ejecutar aquí» si este navegador debe ejecutar, y confirmar las Picos disponibles.
4. Asignar cada Structural Block a un ejecutor (un Functional Block puede sobreescribirlo).
5. **Desplegar** y esperar un ACK por fragmento.
6. Inyectar valores en **Entradas**.
7. Operar con **Iniciar**, **Paso**, **Detener** y **Reiniciar**.

### Navegación del lienzo

- Botón izquierdo: seleccionar, mover, redimensionar y conectar.
- Arrastre con botón derecho: desplazar el lienzo.
- Rueda: zoom.
- `Ctrl + Z` / `Ctrl + Y`: deshacer y rehacer.
- Doble clic en una conexión: agregar un punto de ruta (`Alt` desactiva el ajuste magnético).

### Semántica de canales

| Canal | Uso |
|---|---|
| CCH (continuo) | Último valor; flecha cerrada |
| DCH (discreto) | Eventos FIFO con capacidad; punta abierta |
| LCH / Petri | Pulso o token que se consume una vez; línea discontinua |

`CCH + LCH → Sample → DCH → Hold → CCH + LCH`. Los arcos Petri (Place ↔ Transition) deben quedar en el mismo ejecutor; los canales CCH, DCH y LCH sí pueden cruzar entre ejecutores.

## Ejemplos

| Origen | Contenido |
|---|---|
| Lienzo vacío → **Cargar ejemplo sin hardware** | Dos bloques: Entrada → `x + 1` → Resultado |
| Lienzo vacío → **Cargar ejemplo multi-Pico** | Tres Structural Blocks: Pico 1 → Pico 2 → navegador supervisor |
| `output/demo-minimo-3-structural-blocks.json`, `demo-minimo-3-bloques-distribuidos.json` | Variantes del ejemplo de tres bloques |
| `output/demo-4-semaforos-distribuidos.json` | Cuatro semáforos en anillo con un único token ([protocolo](docs/traffic/PROTOCOLO_SEMAFOROS.md)) |
| `output/demo-2-humedad-token.json`, `demo-parqueadero-converters.json`, `circuito-presentacion-demo.json`, `figure-29-hiles-wsn.json` | Modelos locales de entregas anteriores |
| `output/demo-4-semaforos-inteligentes.json` | Ejemplo legado de una sola red de Petri |

`output/Ejemplo_pico.json` está reservado y no contiene un modelo utilizable.

## Raspberry Pi Pico

Todas las placas usan el mismo firmware (`firmware/pico/`) y se diferencian solo por su `config_local.py`, que nunca entra a Git:

```powershell
& .\scripts\prepare-pico-deployment.ps1
Get-FileHash .\output\hiles-pico-w-deploy.zip -Algorithm SHA256
Get-Content .\output\hiles-pico-w-deploy.sha256
```

- Agregar una Pico, configurar la red y elegir ejecutores: [`docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md`](docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md).
- Instalar MicroPython, respaldar y actualizar placas: [`docs/mqtt/GUIA_PRUEBA_PICO_W.md`](docs/mqtt/GUIA_PRUEBA_PICO_W.md).

## Configuración MQTT del navegador

```powershell
cd frontend
Copy-Item .env.example .env.local
notepad .env.local
```

```env
VITE_MQTT_HOST=IPV4_DEL_PC
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=usuario_local
VITE_MQTT_PASSWORD=contraseña_local
```

Las variables `VITE_` llegan al navegador: usar credenciales exclusivas del laboratorio. El panel **Conexión** permite cambiarlas durante la sesión sin guardarlas en el proyecto. Broker: [`infrastructure/mosquitto/README.md`](infrastructure/mosquitto/README.md).

## Pruebas

```powershell
# Desde frontend/
npm run test:run
npm run lint
npm run build

# Desde la raíz
python -m unittest discover -s firmware/tests -p "test_*.py"
& .\scripts\test-pico-provisioning.ps1
node .\scripts\test-distributed-mqtt.mjs --mode=memory
```

Resultado en `d15d5a0` (7 de noviembre de 2026):

- 187 pruebas frontend; `PanelDock.test.tsx` puede fallar de forma intermitente por timeout;
- 169 pruebas de firmware;
- lint, TypeScript y build aprobados.

Las pruebas sobre broker real (`--mode=mqtt`, `test-project-collaboration.mjs`) requieren Mosquitto y `.env.local`.

## Estructura del repositorio

```text
HiLeS_WEB/
├── frontend/                  Aplicación React
│   ├── public/pyodide/        Python local para el navegador
│   └── src/
│       ├── domain/            Documento y migración del modelo
│       ├── engine/            Motor TypeScript y pruebas de conformidad
│       ├── features/          editor, distributed, simulation, mqtt, setup, onboarding, collaboration
│       ├── services/          ir, distributed, projects, mqtt, crypto
│       ├── stores/            Estado (Zustand)
│       └── workers/           JavaScript y Pyodide aislados
├── firmware/
│   ├── pico/                  Runtime MicroPython: core, pubsub, hiles, devices, platform
│   └── tests/                 Pruebas de escritorio con dobles
├── scripts/                   Empaquetado, aprovisionamiento y pruebas MQTT/distribuidas
├── infrastructure/mosquitto/  Configuración de ejemplo del broker
├── docs/                      Arquitectura, guías, protocolos y vectores
├── output/                    Modelos de ejemplo y paquete de firmware
└── entregas/                  Planes y registros de cada entrega (2 a 8)
```

## Documentación

| Tema | Documento |
|---|---|
| Arquitectura completa y recuperación ante fallos | [`docs/architecture/ARQUITECTURA_SISTEMA.md`](docs/architecture/ARQUITECTURA_SISTEMA.md) |
| Firmware | [`docs/architecture/ARQUITECTURA_PICO.md`](docs/architecture/ARQUITECTURA_PICO.md) |
| Instalación completa en Windows | [`docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md`](docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md) |
| Agregar Picos y elegir ejecutores | [`docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md`](docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md) |
| Placas físicas | [`docs/mqtt/GUIA_PRUEBA_PICO_W.md`](docs/mqtt/GUIA_PRUEBA_PICO_W.md) |
| Ensayo sin Pico | [`docs/mqtt/GUIA_ENSAYO_REMOTO_SIN_PICO.md`](docs/mqtt/GUIA_ENSAYO_REMOTO_SIN_PICO.md) |
| Protocolo distribuido v3 | [`docs/mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md`](docs/mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md) |
| Protocolo de proyectos v2 | [`docs/mqtt/PROTOCOLO_PROYECTOS_V2.md`](docs/mqtt/PROTOCOLO_PROYECTOS_V2.md) |
| IR v2 y Python | [`docs/mqtt/IR_V2.md`](docs/mqtt/IR_V2.md), [`docs/mqtt/IR_V2_PYTHON.md`](docs/mqtt/IR_V2_PYTHON.md) |
| Conformidad Browser ↔ MicroPython | [`docs/mqtt/vectores_ir_v2/MATRIZ_CONFORMIDAD_PERSONA_4.md`](docs/mqtt/vectores_ir_v2/MATRIZ_CONFORMIDAD_PERSONA_4.md) |
| Ficha de conexión | [`docs/mqtt/FICHA_CONEXION_MQTT.md`](docs/mqtt/FICHA_CONEXION_MQTT.md) |
| Entrega 8: plan, registro, informe, cronología, informes por persona, evidencia y demostración | [`entregas/entrega-8-6-noviembre/`](entregas/entrega-8-6-noviembre/) |
| Historia de entregas anteriores | [`entregas/`](entregas/) |

## Seguridad

No versionar `.env.local`, `config_local.py`, SSID, contraseñas, `passwords.txt`, certificados, `node_modules` ni `dist`. La configuración de Mosquitto es para una LAN de confianza: no publicar 1883, 9001 ni 5173 en Internet sin TLS, autenticación y ACL.

## Trabajo pendiente

- Evidencia física de Pico ↔ Pico y Pico ↔ navegador, e inventario de las placas.
- Prueba del tutorial con una persona nueva y ensayo completo con hardware.
- Perfil remoto `wss://` sobre un broker seguro.
- Carga de configuración por Web Serial, actualización OTA, autenticación y ACL.
- Lease y fail-safe del token en la demo de semáforos.

## Flujo de contribución

```powershell
git status
git branch --show-current     # multi-pico
git pull --ff-only
```

Cada commit debe contener una unidad comprobable. Antes de integrar, ejecutar pruebas, lint y build, y registrar el resultado en el registro de la entrega vigente.
