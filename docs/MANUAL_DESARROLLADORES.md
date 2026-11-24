# Manual para desarrolladores de HiLeS Web

> **Estado:** borrador estructural para revisión
> **Responsable inicial:** Juan David Romero
> **Rama de trabajo:** `multi-pico`
> **Última revisión estructural:** 23 de noviembre de 2026

## Propósito del manual

Este manual debe permitir que una persona nueva en el equipo pueda preparar el
entorno, comprender la arquitectura, localizar el código responsable de cada
función, realizar cambios seguros y demostrar que esos cambios funcionan.

El documento está dirigido a desarrolladores del frontend, del motor de
simulación, de la integración MQTT y del runtime MicroPython. No reemplaza el
manual de usuario ni los contratos técnicos especializados: los resume, explica
cómo se relacionan y enlaza su fuente de verdad.

## Estado editorial

| Capítulo | Estado | Evidencia principal |
|---|---|---|
| 1. Visión técnica | Listo para revisión | `README.md` y arquitectura |
| 2. Preparación del entorno | Listo para revisión | Guía de replicación y configuración actual |
| 3. Estructura del repositorio | Listo para revisión | Código y scripts actuales |
| 4. Frontend | Listo para revisión | Montaje, features, stores, services y estilos actuales |
| 5. Motor y modelos | Pendiente | `engine/`, IR v2 y vectores |
| 6. Colaboración y MQTT | Pendiente | Protocolos v2/v3 |
| 7. Firmware MicroPython | Pendiente | `firmware/pico/` |
| 8. Flujos de desarrollo | Pendiente | Casos reales del proyecto |
| 9. Pruebas y calidad | Pendiente | Suites actuales |
| 10. Git y contribución | Pendiente | Flujo de la rama compartida |
| 11. Seguridad | Pendiente | Configuración local y límites |
| 12. Diagnóstico | Pendiente | Problemas reproducidos |
| 13. Glosario | Pendiente | Terminología HiLeS |

## Fuentes de verdad existentes

| Tema | Documento principal |
|---|---|
| Estado del proyecto e inicio rápido | [`../README.md`](../README.md) |
| Arquitectura completa | [`architecture/ARQUITECTURA_SISTEMA.md`](architecture/ARQUITECTURA_SISTEMA.md) |
| Instalación reproducible en Windows | [`GUIA_REPLICACION_COMPLETA_WINDOWS.md`](GUIA_REPLICACION_COMPLETA_WINDOWS.md) |
| Instalación y preparación de una demostración | [`GUION_INSTALACION_PC_NUEVO_Y_VIDEO.md`](GUION_INSTALACION_PC_NUEVO_Y_VIDEO.md) |
| Incorporación de Picos y ejecutores | [`GUIA_AGREGAR_PICO_Y_EJECUTORES.md`](GUIA_AGREGAR_PICO_Y_EJECUTORES.md) |
| Contrato MQTT base | [`mqtt/CONTRATO_MENSAJES_MQTT.md`](mqtt/CONTRATO_MENSAJES_MQTT.md) |
| Modelo IR v2 | [`mqtt/IR_V2.md`](mqtt/IR_V2.md) |
| Python en IR v2 | [`mqtt/IR_V2_PYTHON.md`](mqtt/IR_V2_PYTHON.md) |
| Colaboración por proyecto | [`mqtt/PROTOCOLO_PROYECTOS_V2.md`](mqtt/PROTOCOLO_PROYECTOS_V2.md) |
| Ejecución distribuida | [`mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md`](mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md) |
| Arquitectura de la Pico | [`architecture/ARQUITECTURA_PICO.md`](architecture/ARQUITECTURA_PICO.md) |

---

## 1. Visión técnica del sistema

### 1.1 Problema que resuelve HiLeS Web

HiLeS Web es un editor colaborativo y un entorno de ejecución distribuida para
modelos HiLeS. Permite representar gráficamente la estructura, el flujo de
datos y la lógica de control de un sistema sin escribir manualmente toda su
implementación.

El modelo combina componentes estructurales y funcionales con redes de Petri:

- **Structural Block:** agrupa una parte del sistema y define una unidad natural
  de asignación a un ejecutor.
- **Functional Block:** transforma entradas mediante una expresión o código
  Python permitido por el motor.
- **Service:** representa una entrada o salida en la frontera del modelo.
- **Sample** y **Hold:** convierten información entre canales continuos y
  discretos.
- **Place** y **Transition:** expresan estado, tokens y reglas de disparo de una
  red de Petri.

Estos componentes se conectan mediante Continuous Channel (CCH), Discrete Event
Channel (DCH) y Logical / Petri Channel (LCH). El resultado se conserva como un
documento JSON que puede editarse, importarse, exportarse, simularse y
compilarse a una representación intermedia IR v2.

El problema técnico principal no es solo dibujar el circuito: el mismo modelo
debe producir una semántica equivalente cuando corre en un navegador o en el
runtime MicroPython, incluso si sus bloques se reparten entre varios
ejecutores. Por ello, el proyecto incluye validación, particionado, transporte
MQTT, confirmaciones de despliegue y pruebas de conformidad compartidas.

### 1.2 Capacidades principales

La aplicación reúne cinco capacidades relacionadas, pero separables:

1. **Modelado visual.** Permite crear componentes HiLeS, configurarlos desde el
   panel de propiedades, anidarlos en Structural Blocks y conectarlos mediante
   los tres tipos de canal admitidos.
2. **Simulación.** El motor TypeScript ejecuta pasos, retardos, transformaciones,
   Sample, Hold y redes de Petri. El usuario puede inyectar valores en Services,
   observar tokens y reiniciar el estado.
3. **Persistencia portable.** El modelo puede importarse y exportarse como JSON.
   Antes de ejecutarlo se valida y se compila a IR v2.
4. **Colaboración.** Varios navegadores con el mismo `projectId` comparten el
   documento, presencia, cursores y selección mediante MQTT. Cada participante
   conserva una identidad visual propia por pestaña.
5. **Ejecución distribuida.** Los Structural Blocks pueden asignarse a
   navegadores o Raspberry Pi Pico W / Pico 2 W. El frontend compila y divide el
   modelo, publica un fragment por ejecutor y agrega los snapshots parciales que
   recibe durante la ejecución.

El soporte funcional actual incluye ejecución Browser ↔ Browser sobre un broker
real y pruebas automatizadas del motor MicroPython. Las matrices Pico ↔ Browser
y Pico ↔ Pico todavía requieren evidencia final con placas físicas; una prueba
con dobles de protocolo no debe documentarse como si fuera hardware real.

### 1.3 Dos ejes independientes

La interfaz separa dos decisiones que anteriormente podían confundirse:

| Decisión | Dónde se configura | Opciones principales | Qué controla |
|---|---|---|---|
| **Modo de conexión** | Panel **Conexión** | Local/LAN (`ws://`) o Remoto (`wss://`) | Cómo se comunica el navegador con el broker MQTT |
| **Destino de ejecución** | Panel **Ejecutores** | Este navegador, otro navegador o una Pico | Dónde se ejecuta cada Structural Block y sus componentes internos |

Cambiar el modo de conexión no mueve la ejecución de un bloque. De la misma
forma, asignar un bloque a una Pico no cambia por sí solo la dirección del
broker.

También debe distinguirse entre **colaborador** y **ejecutor**:

- Un colaborador abre el mismo `projectId`, edita el documento y publica su
  presencia.
- Un ejecutor anuncia capacidades, acepta fragments y procesa comandos del
  despliegue.
- Un navegador puede ser solamente colaborador. Solo se convierte en ejecutor
  cuando la persona activa **Ejecutar aquí**.
- Una Pico funciona como ejecutor y no ofrece la interfaz de edición.

La identidad del participante tampoco es la identidad del ejecutor. El nombre
visible, el identificador de cliente MQTT y el `executorId` cumplen funciones
distintas y no deben reutilizarse como si fueran una única clave.

### 1.4 Arquitectura resumida

HiLeS Web no utiliza un backend HTTP tradicional con controladores, base de
datos o lógica de negocio centralizada. La aplicación React se ejecuta en cada
navegador y Mosquitto actúa únicamente como intermediario de mensajes.

```text
Vite HTTP :5173 ────────┬──▶ Navegador A: editor + colaborador + ejecutor opcional
                        └──▶ Navegador B: editor + colaborador + ejecutor opcional

Navegador A ── MQTT/WebSocket :9001 ──┐
Navegador B ── MQTT/WebSocket :9001 ──┼──▶ Mosquitto
Pico W / Pico 2 W ── MQTT/TCP :1883 ──┘
       ejecutor pico:<DEVICE_ID>
```

Responsabilidad de cada pieza:

| Pieza | Responsabilidad | Lo que no hace |
|---|---|---|
| **Vite** | Sirve los archivos del frontend durante desarrollo y los expone a la LAN | No sincroniza modelos ni ejecuta componentes HiLeS |
| **Frontend React** | Edita el documento, valida, compila, particiona, coordina el despliegue y muestra el estado agregado | No reemplaza el firmware de las placas |
| **Motor Browser** | Ejecuta localmente un modelo o un fragment usando TypeScript, Workers y Pyodide cuando corresponde | No almacena un estado global centralizado para todos los clientes |
| **Mosquitto** | Enruta mensajes MQTT, conserva mensajes retained y publica Last Will | No interpreta IR ni decide qué bloque corre en cada dispositivo |
| **Runtime MicroPython** | Valida y ejecuta fragments en una Pico, intercambia canales remotos y publica ACK, snapshots y errores | No contiene lógica específica de un ejemplo como parqueadero o semáforos |

El flujo distribuido, a alto nivel, es el siguiente:

1. Cada ejecutor anuncia sus capacidades bajo el `projectId` actual.
2. El usuario asigna los Structural Blocks a ejecutores compatibles.
3. El frontend valida el documento, lo compila a IR v2 y lo divide en fragments.
4. Cada ejecutor valida su fragment y responde con un ACK.
5. Los controles **Iniciar**, **Paso**, **Detener** y **Reiniciar** operan sobre
   el despliegue aceptado.
6. Los canales que cruzan ejecutores viajan por MQTT.
7. Cada ejecutor publica un snapshot parcial y el frontend compone la vista
   completa del sistema.

Esta arquitectura permite trabajar sin hardware usando ejecutores de navegador
y, cuando hay placas disponibles, conservar el mismo modelo y protocolo para
distribuirlo. La equivalencia funcional entre ambos motores se verifica con los
vectores documentados en
[`mqtt/vectores_ir_v2/MATRIZ_CONFORMIDAD_PERSONA_4.md`](mqtt/vectores_ir_v2/MATRIZ_CONFORMIDAD_PERSONA_4.md).

## 2. Preparación del entorno de desarrollo

### 2.1 Requisitos

El entorno mínimo depende del trabajo que se realizará. Para modificar y probar
el frontend no hace falta una Pico ni instalar MicroPython.

| Herramienta | Cuándo se necesita | Versión o condición recomendada |
|---|---|---|
| **Windows** | Entorno de referencia del equipo | Windows 10 u 11 de 64 bits |
| **PowerShell** | Comandos, scripts y automatización | Incluido con Windows; algunos comandos administrativos requieren abrirlo como administrador |
| **Git** | Clonar, actualizar y publicar cambios | Versión reciente con acceso al repositorio |
| **Node.js y npm** | Siempre que se trabaje en el frontend | Node.js 22 LTS o posterior; npm se instala con Node.js |
| **Python 3** | Pruebas del firmware y herramientas de flota | Versión de escritorio reciente disponible como `python` |
| **Eclipse Mosquitto** | Colaboración o ejecución distribuida real | Mosquitto 2.x; la configuración comprobada usa 2.1.2 |
| **Thonny o `mpremote`** | Copiar firmware y configuración a una Pico | Solo para pruebas con hardware |
| **MicroPython** | Ejecutar un fragment en una Pico W o Pico 2 W | Firmware compatible instalado en cada placa |

El frontend fija sus dependencias mediante
[`../frontend/package.json`](../frontend/package.json) y
[`../frontend/package-lock.json`](../frontend/package-lock.json). Entre las
tecnologías principales están React 19, TypeScript 6, Vite 8, Zustand 5,
MQTT.js 5, Pyodide 0.26 y Vitest 5. El archivo de bloqueo es la fuente de verdad
para las versiones exactas, por lo que se debe usar `npm ci` en instalaciones
reproducibles.

Para exponer el sistema a otros dispositivos de la LAN, el equipo debe estar en
una red privada y el firewall debe permitir los puertos utilizados. Crear o
modificar el servicio Mosquitto y sus reglas de firewall requiere permisos de
administrador.

### 2.2 Clonar e instalar

En un equipo nuevo, abrir PowerShell en la carpeta donde se guardará el proyecto
y ejecutar:

```powershell
git clone https://github.com/KevMasMas/HiLeS_WEB.git
Set-Location .\HiLeS_WEB
git fetch --all --prune
git switch multi-pico
git pull --ff-only
git status

Set-Location .\frontend
npm.cmd ci
```

Los comandos de npm deben ejecutarse desde `frontend/`, porque allí están el
`package.json` y el lockfile de la aplicación. El `package-lock.json` de la raíz
no describe las dependencias del frontend.

En PowerShell, Windows puede impedir la ejecución de `npm.ps1` por la política
de scripts. No es necesario cambiar la política del sistema: se puede invocar
`npm.cmd` como en los ejemplos de este manual.

Después de instalar, comprobar la base del proyecto:

```powershell
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build
```

Estos comandos deben terminar sin errores antes de asumir que el entorno está
preparado. Las advertencias o fallos preexistentes deben registrarse con su
salida exacta; no se deben atribuir automáticamente al cambio en desarrollo.

### 2.3 Configuración local

El frontend incluye
[`../frontend/.env.example`](../frontend/.env.example) como plantilla. Para una
configuración local persistente:

```powershell
Set-Location .\frontend
Copy-Item .env.example .env.local
```

Variables disponibles:

| Variable | Ejemplo local | Propósito |
|---|---|---|
| `VITE_MQTT_HOST` | `localhost` | Dirección del broker que usará el navegador |
| `VITE_MQTT_WS_PORT` | `9001` | Puerto MQTT sobre WebSocket |
| `VITE_MQTT_WS_PATH` | `/mqtt` | Ruta del listener WebSocket |
| `VITE_MQTT_WS_PROTOCOL` | `ws` | `ws` en LAN; `wss` con TLS en un despliegue remoto |
| `VITE_MQTT_USERNAME` | valor local | Usuario MQTT si el broker exige autenticación |
| `VITE_MQTT_PASSWORD` | valor local | Contraseña MQTT; nunca debe publicarse |

`.env.local` está excluido de Git. Se puede verificar antes de continuar:

```powershell
git check-ignore -v .env.local
```

La configuración del panel **Conexión** puede reemplazar estos valores durante
la sesión. El archivo local define valores predeterminados; no es una base de
datos compartida.

La configuración de referencia de Mosquitto utiliza dos listeners:

- `1883`: MQTT sobre TCP para Pico W / Pico 2 W y herramientas de prueba.
- `9001`: MQTT sobre WebSocket para los navegadores.

Vite sirve el frontend en `5173`. Vite y Mosquitto son procesos independientes:
el primero entrega la interfaz y el segundo transporta mensajes. La instalación
completa del broker, autenticación y firewall está documentada en
[`GUIA_REPLICACION_COMPLETA_WINDOWS.md`](GUIA_REPLICACION_COMPLETA_WINDOWS.md).
Los archivos de contraseñas, credenciales Wi-Fi, `.env.local` y
`config_local.py` son locales y nunca deben añadirse al repositorio.

### 2.4 Arranque diario

Si se necesita colaboración o ejecución distribuida, iniciar primero Mosquitto
desde una consola de PowerShell con permisos de administrador:

```powershell
Start-Service mosquitto
Get-Service mosquitto
```

Después, en otra consola, iniciar el frontend:

```powershell
Set-Location D:\Documentos\Hiles\frontend
npm.cmd run dev -- --host 0.0.0.0
```

La ruta anterior corresponde al entorno usado para elaborar este manual. En
otro equipo se debe sustituir por la ubicación real del clon. La opción
`--host 0.0.0.0` permite que Vite escuche tanto en el equipo como en su LAN.

- Desde el mismo PC: `http://localhost:5173/`.
- Desde otro dispositivo: `http://IP_DEL_PC:5173/`.

La dirección IPv4 del PC se obtiene con `ipconfig`. Ambos dispositivos deben
tener acceso a la misma red y el firewall debe permitir el tráfico entrante.
Para colaborar deben abrir el mismo enlace con el mismo parámetro, por ejemplo
`?project=prueba-equipo`.

`Ctrl+C` en la consola de Vite detiene solamente el frontend. Mosquitto, si está
instalado como servicio, continúa activo. Se detiene por separado y únicamente
cuando se desea apagar la comunicación MQTT:

```powershell
Stop-Service mosquitto
```

### 2.5 Comprobación mínima

Antes de desarrollar una función colaborativa o distribuida, comprobar la
infraestructura:

```powershell
Get-Service mosquitto
Test-NetConnection localhost -Port 1883
Test-NetConnection localhost -Port 9001
```

Luego realizar esta prueba sin hardware:

1. Abrir `http://localhost:5173/?project=manual-dev-test` en un navegador.
2. Abrir el mismo proyecto en una ventana privada, otro navegador o un equipo de
   la LAN.
3. Escribir un nombre diferente para cada participante y confirmar que ambos
   aparecen conectados.
4. Crear o renombrar un componente en una ventana y comprobar que el cambio
   aparece en la otra.
5. Mover el componente y verificar que su posición también se sincroniza.
6. Recargar una ventana y comprobar que recupera el snapshot retenido.

El entorno mínimo queda validado cuando:

- la página abre en el puerto `5173`;
- el panel **Conexión** muestra el broker conectado;
- los puertos `1883` y `9001` responden cuando se usarán Picos y navegadores;
- dos clientes con el mismo `projectId` comparten presencia y cambios;
- tests, lint y build terminan correctamente.

Sin Mosquitto se puede elegir **Continuar sin conexión** para modelar y probar
funciones locales, pero no se valida colaboración ni ejecución distribuida.

## 3. Estructura del repositorio

### 3.1 Mapa de carpetas

La raíz separa aplicación, runtime, infraestructura, automatización, artefactos
y evidencia académica:

```text
HiLeS_WEB/
├── frontend/        Aplicación React, motor Browser y pruebas del frontend
├── firmware/        Runtime MicroPython y pruebas ejecutables en escritorio
├── infrastructure/ Configuración y documentación de servicios como Mosquitto
├── scripts/         Generadores, preparación de Picos y pruebas integrales
├── docs/            Arquitectura, protocolos, guías y este manual
├── output/          Ejemplos JSON y paquetes generados para demostración
├── entregas/        Planes, informes, registros y evidencia por entrega
└── README.md        Estado vigente, inicio rápido y flujo principal
```

Dentro de `frontend/src/`, las responsabilidades se distribuyen así:

```text
frontend/src/
├── domain/    Documento del editor y tipos centrales del modelo
├── engine/    Motor TypeScript, grafo de datos y semántica Petri
├── features/  Interfaz organizada por capacidad del producto
├── services/  IR, MQTT, proyectos, criptografía y ejecución distribuida
├── stores/    Estado Zustand del editor, proyecto, simulación y despliegue
├── types/     Contratos TypeScript compartidos
├── utils/     Funciones auxiliares sin responsabilidad de interfaz
└── workers/   Ejecución aislada de JavaScript y Python/Pyodide
```

Las features actuales son `editor`, `collaboration`, `distributed`, `mqtt`,
`onboarding`, `setup` y `simulation`. Antes de crear una carpeta transversal
nueva, se debe comprobar si el comportamiento pertenece a una de ellas o a un
service/store existente.

El runtime de `firmware/pico/` conserva una separación equivalente: `core/`
coordina tareas base; `hiles/` contiene el modelo y el motor; `pubsub/` maneja
mensajería; `devices/` y `platform/` aíslan hardware y plataforma; `main.py` es
el punto de arranque. Sus pruebas de escritorio están en `firmware/tests/`.

### 3.2 Código fuente frente a artefactos generados

No todo archivo visible en el árbol tiene el mismo ciclo de vida:

| Categoría | Ejemplos | Regla de trabajo |
|---|---|---|
| **Código fuente** | `frontend/src/`, `firmware/pico/`, `scripts/` | Se modifica manualmente y debe acompañarse de pruebas proporcionales al cambio |
| **Contratos y documentación** | `docs/`, `README.md`, registros en `entregas/` | Se actualizan cuando cambia una interfaz, protocolo, instalación o evidencia |
| **Ejemplos versionados** | JSON de demostración en `output/` | Se regeneran con su script cuando exista; no se corrigen a mano sin revisar el generador |
| **Paquete de despliegue** | `output/hiles-pico-w-deploy*` | Se produce con `scripts/prepare-pico-deployment.ps1`; su contenido debe coincidir con firmware y manifiesto |
| **Resultados de compilación** | `frontend/dist/`, `*.tsbuildinfo`, cachés | Son reproducibles y están ignorados; no deben añadirse a un commit |
| **Dependencias descargadas** | `frontend/node_modules/` | Las reconstruye `npm ci`; nunca se versionan |
| **Configuración privada** | `.env.local`, `config_local.py`, claves y archivos de contraseñas MQTT | Se crea por equipo o placa y nunca se publica |

También deben excluirse logs, `__pycache__/`, respaldos de placas y credenciales
Wi-Fi/MQTT. Antes de preparar un commit se debe revisar `git status` y, ante un
archivo dudoso, consultar `.gitignore` y su origen en vez de añadirlo por
comodidad.

Los scripts de la raíz cumplen funciones diferentes:

| Grupo | Scripts principales |
|---|---|
| Generación de demostraciones | `generate-coordinated-traffic-demo.mjs`, `generate-distributed-traffic-demo.mjs` |
| Preparación y administración de Picos | `prepare-pico-deployment.ps1`, `manage-pico-fleet.py`, `test-pico-provisioning.ps1` |
| Pruebas con MQTT real | `test-project-collaboration.mjs`, `test-mqtt-four-clients.mjs`, `test-distributed-mqtt.mjs` |
| Prueba física | `test-distributed-physical.ps1` |

Una prueba que use clientes simulados o dobles de hardware puede validar el
protocolo, pero no reemplaza la evidencia de una ejecución física.

### 3.3 Dónde empezar según el tipo de cambio

La siguiente tabla orienta la primera inspección. No sustituye la búsqueda de
referencias ni la lectura de las pruebas existentes.

| Cambio | Código inicial | Verificación principal | Documento relacionado |
|---|---|---|---|
| Componente, conexión o interacción del Canvas | `frontend/src/features/editor/`, `domain/modelDocument.ts`, `stores/useEditorStore.ts` | Tests del store y prueba visual de edición/importación | Capítulos 4, 5 y formato del modelo |
| Propiedad o semántica de ejecución | `frontend/src/engine/`, `services/ir/` | Tests del motor, IR y vectores de conformidad | [`mqtt/IR_V2.md`](mqtt/IR_V2.md) |
| Functional Block con JavaScript o Python | `engine/`, `workers/`, `services/ir/` | Tests del ejecutor y paridad Browser/MicroPython | [`mqtt/IR_V2_PYTHON.md`](mqtt/IR_V2_PYTHON.md) |
| Sincronización de editores | `features/collaboration/`, `services/projects/`, `stores/useProjectStore.ts` | Tests del store y `scripts/test-project-collaboration.mjs` | [`mqtt/PROTOCOLO_PROYECTOS_V2.md`](mqtt/PROTOCOLO_PROYECTOS_V2.md) |
| Conexión o autenticación MQTT | `features/mqtt/`, `services/mqtt/`, `.env.example`, `infrastructure/mosquitto/` | Dos navegadores y broker real | [`mqtt/CONTRATO_MENSAJES_MQTT.md`](mqtt/CONTRATO_MENSAJES_MQTT.md) |
| Asignación y ejecución distribuida | `features/distributed/`, `services/distributed/`, `stores/useDistributedExecutionStore.ts` | Tests distribuidos y `scripts/test-distributed-mqtt.mjs` | [`mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md`](mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md) |
| Runtime de una Pico | `firmware/pico/` | `firmware/tests/`, conformidad y luego prueba física | [`architecture/ARQUITECTURA_PICO.md`](architecture/ARQUITECTURA_PICO.md) |
| Alta o preparación de placas | `scripts/manage-pico-fleet.py`, `scripts/prepare-pico-deployment.ps1` | Tests de flota/provisionamiento y revisión del manifiesto | [`GUIA_AGREGAR_PICO_Y_EJECUTORES.md`](GUIA_AGREGAR_PICO_Y_EJECUTORES.md) |
| Ejemplo de demostración | `scripts/generate-*.mjs`, `output/` | Importación, despliegue y comportamiento esperado | README o guía específica del ejemplo |
| Instalación o proceso del equipo | `docs/`, `README.md`, `entregas/` | Repetir comandos desde un entorno conocido | Guía y registro afectados |

Para cualquier cambio, el recorrido mínimo es: localizar la fuente de verdad,
buscar todas las referencias del símbolo o contrato, leer las pruebas cercanas,
implementar, ejecutar la verificación correspondiente y actualizar la
documentación. Un cambio de semántica del motor debe revisarse en Browser y
MicroPython; uno de protocolo debe comprobarse con un broker MQTT real.

## 4. Arquitectura del frontend

### 4.1 Punto de entrada y composición general

El frontend es una Single Page Application escrita en React y TypeScript. Vite
se encarga del servidor de desarrollo y del build, pero no contiene la lógica
de modelado ni sincronización. El punto de entrada es
[`../frontend/src/main.tsx`](../frontend/src/main.tsx): busca el elemento
HTML `root`, activa `StrictMode` y monta `App` dentro de un Error Boundary.

El Error Boundary evita que una excepción de render deje una pantalla vacía:
muestra el stack del error en una vista de diagnóstico. No recupera el estado ni
reemplaza el manejo normal de errores en stores y services.

[`../frontend/src/App.tsx`](../frontend/src/App.tsx) monta dos ramas:

```text
main.tsx
└── ErrorBoundary
    └── App
        ├── Editor
        │   ├── TopBar
        │   ├── Participants
        │   ├── DisplayNameDialog
        │   └── editor-workspace
        │       ├── Canvas
        │       ├── Palette
        │       └── PanelDock
        └── MqttPanel ── portal ──▶ pestaña Conexión de PanelDock
```

`MqttPanel` se monta junto al editor para conservar sus suscripciones aunque su
pestaña esté cerrada. Cuando `PanelDock` registra el destino del portal, React
traslada visualmente el panel a la pestaña **Conexión** sin desmontarlo.

`Editor.tsx` compone el espacio de trabajo y coordina únicamente estado de
presentación: panel abierto, nombre del archivo y `projectId`. Al iniciar:

1. restaura el autosave local;
2. asegura que la URL tenga un `projectId` válido;
3. solicita un nombre visible si la pestaña todavía no lo tiene;
4. inicia `useProjectStore` con proyecto e identidad;
5. espera el snapshot colaborativo o habilita el trabajo sin conexión;
6. monta el Canvas, la Palette y los paneles laterales.

El nombre del participante y la identidad del navegador viven en
`sessionStorage`: pertenecen a la pestaña, no al documento. El modelo se guarda
por separado mediante el store del editor.

### 4.2 Editor y Canvas

El Canvas usa React Flow (`@xyflow/react`). La librería resuelve viewport,
selección, arrastre, handles y eventos de conexión; HiLeS aporta sus propios
nodos, aristas y reglas mediante `HilesNode` y `HilesEdge`.

El estado canónico del dibujo es un par de arreglos:

- `nodes`: componentes con `id`, posición, tipo HiLeS, puertos y propiedades;
- `edges`: conexiones con extremos, handles, tipo de canal, ruta, peso y delay.

React Flow recibe una vista derivada de esos arreglos, pero los cambios vuelven
a `useEditorStore` mediante `onNodesChange`, `onEdgesChange` y `onConnect`. El
Canvas no conserva una segunda copia permanente del modelo.

#### Creación y selección

En escritorio, la Palette coloca un elemento mediante drag and drop. En
dispositivos donde arrastrar es incómodo, también puede emitir la acción
`hiles:add-element`, que agrega el componente en el centro del viewport o dentro
del Structural Block seleccionado. Al pulsar un nodo o una conexión, el store
guarda una sola selección activa y `PropertiesPanel` presenta sus campos.

Antes de crear una conexión, `getConnectionValidation` comprueba, entre otras
reglas:

- que origen y destino existan y sean distintos;
- que los canales de datos salgan de un Output Port y lleguen a un Input Port;
- que los tipos de datos sean compatibles;
- que LCH use puertos de control;
- que una red de Petri alterne Place y Transition;
- que la misma conexión no exista ya.

La apariencia de la arista no define su semántica. La fuente de verdad es
`hilesConnectionType`; color, trazo, punta y label se vuelven a normalizar al
importar el documento.

#### Structural Blocks y elementos internos

Un componente está realmente dentro de un Structural Block cuando su nodo tiene
`parentId` apuntando al bloque. No basta con dibujar el bloque detrás. En ese
caso:

- la posición del hijo es relativa a su padre;
- React Flow usa `extent: 'parent'` para limitarlo al bloque;
- `expandParent: true` permite ampliar el padre cuando haga falta;
- mover el padre mueve visualmente toda su descendencia;
- eliminar un padre elimina recursivamente sus hijos y conexiones afectadas;
- exportar JSON conserva `parentId` y las posiciones relativas;
- importar o sincronizar reconstruye la misma jerarquía.

Al soltar un componente, el Canvas busca el Structural Block abierto más
profundo que contenga el punto. Esto permite bloques anidados. Los cálculos de
posición absoluta recorren todos los `parentId`, mientras que lo almacenado en
el hijo continúa siendo relativo a su padre inmediato.

#### Zoom, colapso y detalle

El viewport admite un zoom entre `0.08` y `2.5`. A partir de `0.5` se muestra la
lógica interna; por debajo de ese valor los hijos se ocultan y cada Structural
Block cambia a una representación resumida. Un hijo también se oculta si él o
alguno de sus padres no es visible, o si un padre está colapsado. Las conexiones
con un extremo oculto se ocultan junto con él.

La vista resumida es estado de presentación (`summaryMode`) y no se serializa.
En cambio, `collapsed`, `visible` y `locked` son propiedades del documento. El
Canvas muestra una indicación para acercarse y permite alternar las etiquetas de
destino de los componentes internos sin modificar el modelo.

El Canvas incluye controles de zoom, MiniMap en pantallas amplias, paneo y
cursores remotos. Delete/Backspace elimina la selección siempre que el foco no
esté en un campo editable; Ctrl/Cmd+Z y Ctrl/Cmd+Y controlan el historial.

### 4.3 Features

`frontend/src/features/` organiza la interfaz por capacidad. Una feature puede
usar stores y services, pero no debe duplicar en un componente visual la lógica
de protocolo o del motor.

| Feature | Responsabilidad |
|---|---|
| `editor` | Shell, TopBar, Canvas, Palette, nodos, aristas, PropertiesPanel y coordinación de paneles |
| `collaboration` | Nombre visible, participantes, ShareDialog, cursor, seguimiento de otro colaborador y enfoque de elementos |
| `distributed` | Descubrimiento visible de ejecutores, asignaciones, despliegue, estado de ACK, errores y reglas de habilitación de controles |
| `simulation` | Lista de Services inyectables, formulario de entradas y resumen del estado agregado |
| `mqtt` | Perfil Local/LAN o Remoto, estado de conexión, reconexión y diagnóstico de mensajes |
| `onboarding` | EmptyCanvas, ejemplo mínimo, ayudas contextuales y tutorial guiado |
| `setup` | Formulario y descarga de `config_local.py` para preparar una Pico |

La TopBar es la entrada común a las capacidades principales:

| Grupo | Acciones |
|---|---|
| Modelado | **Elementos** y **Ejecutores** |
| Paneles auxiliares | **Entradas**, **Propiedades** y **Conexión** |
| Ejecución | **Iniciar**, **Paso**, **Detener** y **Reiniciar** |
| Equipo y ayuda | **Compartir** y **Ayuda** |
| Menú `⋯` | Deshacer, rehacer, nuevo proyecto, importar y exportar JSON; en móvil también accesos ocultos de la barra |

Solo existe un juego visible de controles de ejecución. Su habilitación viene de
`features/distributed/executionControl.ts`, que interpreta la fase del
despliegue, los ACK y la disponibilidad de ejecutores. Los botones no deben
habilitarse con condiciones paralelas escritas directamente en otra vista.

`panelState.ts` aplica exclusión mutua entre Palette, PanelDock y
DistributedPanel. En escritorio puede mantenerse la Palette mientras se abre
otro panel si no colisiona; en móvil solo permanece abierto un bottom sheet.

### 4.4 Stores y estado

Zustand concentra el estado compartido fuera del árbol de React. Los stores no
son una base de datos: viven en memoria y solo persisten las partes que cada uno
declara explícitamente.

| Store | Estado que gobierna | Persistencia o transporte |
|---|---|---|
| `useEditorStore` | Nodes, edges, selección, tipo de conexión, historial, mensajes e importación/exportación | Autosave en `localStorage`; documento colaborativo por `useProjectStore` |
| `useProjectStore` | `projectId`, identidad visual, colaboradores, cursores y estado de sincronización | Identidad en `sessionStorage`; documento y presencia mediante MQTT |
| `useDistributedExecutionStore` | Ejecutores, asignaciones, manifest, ACK, snapshots, errores y BrowserWorker | Protocolo MQTT v3; es la fuente oficial de la ejecución distribuida |
| `useSimulationStore` | Motor local, entradas y runtime de simulación | Memoria; conserva compatibilidad con ejecución local/remota anterior |
| `useRemoteExecutionStore` | Sesión remota de una sola Pico del contrato anterior | Compatibilidad; no gobierna el flujo distribuido v3 actual |
| `useFollowStore` | Colaborador al que se está siguiendo | Memoria de interfaz |

El flujo principal de una edición es:

```text
Interacción del usuario
        │
        ▼
useEditorStore ── actualiza nodes/edges ──▶ React vuelve a renderizar
        │
        ├── debounce 600 ms ──▶ autosave local
        ├── suscripción ──────▶ ProjectSyncClient publica operación/snapshot
        └── suscripción ──────▶ useSimulationStore reconstruye el grafo si cambió la semántica
```

`useEditorStore` normaliza nodos y aristas al importar, valida el documento,
mantiene hasta un número acotado de snapshots para undo/redo y agrupa un
arrastre o redimensionamiento en una sola transacción de historial. Aplicar un
documento remoto no debe borrar ni inventar el historial local.

Los valores de ejecución son transitorios. Los stores de simulación y
distribución escriben `data.runtime` para pintar valores, tokens, actividad,
errores u obsolescencia en el Canvas, pero `serializeModel` solo exporta nombre,
puertos, propiedades, layout y relaciones. De esta forma un snapshot de
ejecución no contamina el documento colaborativo.

`useProjectStore` espera brevemente un snapshot retained antes de publicar el
estado local. Cuando el broker no conecta, un fallback libera la interfaz para
trabajar offline. Esta liberación no equivale a una conexión exitosa y no debe
usarse como prueba de colaboración.

`useDistributedExecutionStore` compila el documento a IR v2, resuelve
asignaciones, particiona, publica fragments, recibe ACK y agrega snapshots. Un
BrowserWorker tiene una identidad de sesión distinta del nombre del
colaborador. Mantener esa separación evita que cambiar el nombre visible cambie
el destino de despliegue.

### 4.5 Services

Los services implementan lógica reutilizable que no depende de una vista
concreta. La dirección esperada de dependencias es:

```text
React feature ──▶ store ──▶ service ──▶ motor, Worker o MQTT
      │              │          │
      └─ presenta    └─ coordina └─ valida y transporta
```

| Service | Responsabilidad |
|---|---|
| `services/projects` | URL del proyecto, topics, mensajes y `ProjectSyncClient` para snapshot, operaciones, presencia y cursores |
| `services/mqtt` | Perfil activo, validación de URL, cliente MQTT WebSocket, mensajes base y puentes de ejecución remota |
| `services/ir` | Tipos, validadores y compiladores IR; expresiones y particionado distribuido |
| `services/distributed` | Contratos v3, topics y `BrowserWorker` que ejecuta un fragment asignado al navegador |
| `services/crypto` | SHA-256 usado para comprobar integridad de artefactos y fragments |

`domain/modelDocument.ts` define el documento del editor, su versión, migración,
serialización y validación estructural. No es un formato de ejecución: el
service de IR toma ese documento y produce el modelo normalizado que consumen
los motores.

Los Workers de `frontend/src/workers/` aíslan código de Functional Blocks:
`javascript.worker.ts` ejecuta JavaScript y `pyodide.worker.ts` ejecuta Python.
El aislamiento permite imponer límites de tiempo y evita bloquear directamente
el hilo visual; no convierte código arbitrario en confiable, por lo que los
validadores siguen siendo obligatorios.

Al añadir comportamiento nuevo:

- una regla del documento pertenece a `domain/`;
- una regla de ejecución pertenece a `engine/` o `services/ir/`;
- un contrato o transporte pertenece a `services/`;
- coordinación de estado compartido pertenece a un store;
- render, formularios e interacción pertenecen a una feature;
- una función pura pequeña y transversal puede pertenecer a `utils/`.

Esta separación evita que un botón publique directamente topics construidos a
mano o que un service dependa del DOM para decidir la semántica del sistema.

### 4.6 Interfaz responsive y accesibilidad

La interfaz usa CSS responsive y no una segunda aplicación móvil. Los puntos de
quiebre principales son:

| Ancho o capacidad | Adaptación |
|---|---|
| Más de `1460px` | Barra completa y panel lateral flotante |
| Hasta `1460px` | Se ocultan labels secundarios para conservar espacio |
| Hasta `1180px` | La TopBar se divide en filas y los controles táctiles aumentan |
| Hasta `760px` | Palette y paneles se convierten en bottom sheets; se oculta MiniMap y acciones secundarias pasan al menú `⋯` |
| Pointer coarse | Botones y ayudas usan objetivos táctiles de al menos 42 px |

Se usa `100dvh` para responder a las barras del navegador móvil y
`safe-area-inset-*` para no colocar acciones debajo de zonas reservadas del
dispositivo. Los paneles tienen scroll interno y una altura máxima; abrir uno en
móvil cierra los demás para no cubrir todo el Canvas.

Criterios de accesibilidad ya incorporados:

- controles con `aria-label`, `aria-pressed`, `aria-selected` o roles de tab;
- dialogs con título asociado y `aria-modal`;
- mensajes de conexión y guardado con `role="status"` o `aria-live`;
- errores importantes con `role="alert"`;
- estilo visible para navegación con teclado mediante `:focus-visible`;
- atajos que no interceptan teclas mientras se escribe en un input o editor;
- soporte de `prefers-reduced-motion` para reducir animaciones;
- nombre obligatorio antes de iniciar colaboración, con foco inicial y error
  textual además del cambio visual.

Una modificación responsive no se considera verificada solo porque compila.
Debe probarse, como mínimo, en estos escenarios:

1. escritorio amplio con Palette y PanelDock;
2. ancho intermedio cercano a `1180px`;
3. móvil cercano a `390 × 844` con teclado virtual;
4. tablet o emulación con pointer coarse;
5. navegación por Tab, Escape cuando aplique y foco visible;
6. apertura alternada de Palette, Propiedades, Entradas, Conexión y Ejecutores;
7. edición de un campo sin que el foco se pierda por un render o una
   actualización remota.

Las transiciones puras de paneles se prueban en `PanelDock.test.tsx`. Las
comprobaciones visuales y de teclado virtual siguen requiriendo una revisión en
navegador real o emulado.

## 5. Motor de simulación y modelos

### 5.1 Componentes soportados

_Pendiente: Structural Block, Functional Block, Service, Sample, Hold, Place y
Transition, conservando los nombres técnicos en inglés._

### 5.2 Canales

_Pendiente: Continuous Channel (CCH), Discrete Event Channel (DCH) y Logical /
Petri Channel (LCH)._

### 5.3 Semántica de ejecución

_Pendiente: reloj lógico, paso, ejecución continua, reinicio, retardos, tokens,
pesos, capacidad y conflictos._

### 5.4 Documento JSON del editor

_Pendiente: versión, metadata, nodes, edges, propiedades, padres y posiciones._

### 5.5 Compilación a IR v2

_Pendiente: validación, normalización, expresiones, Python y límites._

### 5.6 Particionado distribuido v3

_Pendiente: asignaciones, fragments, manifest, rutas remotas y restricciones
de Place/Transition entre fragmentos._

### 5.7 Vectores de conformidad

_Pendiente: cómo agregar un vector y comprobar paridad Browser/MicroPython._

## 6. Colaboración y comunicación MQTT

### 6.1 Rol de Mosquitto

_Pendiente: broker, MQTT TCP, MQTT WebSocket y ausencia de lógica de negocio en
el broker._

### 6.2 Identidad y proyectos

_Pendiente: `projectId`, nombre visible, identidad de cliente e identidad de
ejecutor._

### 6.3 Sincronización entre navegadores

_Pendiente: snapshot retenido, operaciones, presencia, cursores, selección,
deduplicación y aislamiento entre proyectos._

### 6.4 Ejecución distribuida

_Pendiente: descubrimiento de ejecutores, manifest, fragments, ACK, commands,
snapshots y errors._

### 6.5 Reconexión y recuperación

_Pendiente: retained, Last Will, expiración, redespliegue y estados obsoletos._

### 6.6 Matrices verificables

_Pendiente: Browser ↔ Browser, Pico ↔ Browser y Pico ↔ Pico, diferenciando
simulación de hardware físico._

## 7. Runtime MicroPython

### 7.1 Estructura del firmware

_Pendiente: módulos principales en `firmware/pico/` y ciclo de arranque._

### 7.2 Configuración por placa

_Pendiente: `config_local.py`, identidad estable, red, proyecto y broker._

### 7.3 Recepción y validación de fragmentos

_Pendiente: protocolo, límites, checksum, ACK y errores estructurados._

### 7.4 Motor MicroPython

_Pendiente: elementos, canales, Python permitido, memoria y tareas asíncronas._

### 7.5 Preparación y despliegue

_Pendiente: paquete canónico, manifiesto, backup, copia segura y preservación
de configuración local._

### 7.6 Agregar otra placa

_Pendiente: Pico W, Pico 2 W, inventario y validación posterior._

## 8. Flujos de desarrollo

### 8.1 Agregar un componente HiLeS de extremo a extremo

_Pendiente: tipo y representación gráfica → editor → propiedades → documento
JSON → compilador IR → motor Browser → motor MicroPython → pruebas → docs._

### 8.2 Modificar un canal

_Pendiente: contrato local, ruta remota, capacidad, orden y compatibilidad._

### 8.3 Agregar una propiedad al modelo

_Pendiente: defaults, migración, validación, importación/exportación y
compatibilidad hacia atrás._

### 8.4 Modificar la colaboración

_Pendiente: topics, mensajes, estado retenido, deduplicación y pruebas con dos
navegadores._

### 8.5 Modificar el firmware

_Pendiente: paridad, paquete generado, pruebas unitarias y prueba física._

## 9. Pruebas y control de calidad

### 9.1 Pirámide de pruebas

_Pendiente: unidades, integración, conformidad, MQTT real, visuales y físicas._

### 9.2 Comandos del frontend

```powershell
cd frontend
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build
```

### 9.3 Pruebas del firmware

_Pendiente: intérprete compatible, descubrimiento de tests y resultado esperado._

### 9.4 Pruebas distribuidas

_Pendiente: runners en memoria, broker real, colaboración y hardware._

### 9.5 Evidencia mínima antes de integrar

_Pendiente: comandos, resultados exactos, limitaciones, capturas cuando
apliquen y actualización del registro._

## 10. Git y flujo de contribución

### 10.1 Antes de empezar

_Pendiente: confirmar rama, revisar cambios locales, hacer fetch/pull y no
sobrescribir trabajo ajeno._

### 10.2 Durante el cambio

_Pendiente: alcance pequeño, nombres claros, pruebas y documentación._

### 10.3 Commit y push

_Pendiente: revisión del diff, mensajes descriptivos en español, rama correcta
y comprobación del remoto._

### 10.4 Registro de cambios

_Pendiente: responsable, archivos, pruebas, evidencia, pendientes y commit._

## 11. Seguridad y configuración sensible

### 11.1 Secretos excluidos

_Pendiente: Wi-Fi, credenciales MQTT, archivos `.env.local`,
`config_local.py` y respaldos de placas._

### 11.2 Límites de la LAN

_Pendiente: cuándo `ws://` es aceptable y cuándo se requiere `wss://`._

### 11.3 Código Python del modelo

_Pendiente: sintaxis permitida, operaciones bloqueadas, presupuestos y
validación Browser/MicroPython._

## 12. Diagnóstico y recuperación

### 12.1 El frontend no inicia

_Pendiente: Node.js, dependencias, `npm.ps1`, puertos y caché._

### 12.2 El navegador no conecta a MQTT

_Pendiente: host, WebSocket, credenciales, firewall y protocolo._

### 12.3 Dos navegadores no colaboran

_Pendiente: mismo `projectId`, snapshot, presencia y aislamiento._

### 12.4 La Pico no aparece

_Pendiente: red, identidad, proyecto, reloj, topics y Last Will._

### 12.5 El modelo no despliega

_Pendiente: asignaciones, compilación IR, manifest, ACK y errores visibles._

### 12.6 Recuperar un cambio de Git

_Pendiente: recuperación no destructiva, archivos sin seguimiento y conflictos._

## 13. Glosario técnico

_Pendiente: HiLeS, Structural Block, Functional Block, Service, Place,
Transition, CCH, DCH, LCH, IR, fragment, manifest, executor, worker, ACK,
snapshot, retained, Last Will, projectId y deploymentId._

## Apéndice A. Checklist para una contribución

- [ ] Confirmar la rama y el estado de Git.
- [ ] Identificar la fuente de verdad del comportamiento que se modificará.
- [ ] Implementar el cambio mínimo necesario.
- [ ] Añadir o actualizar pruebas.
- [ ] Ejecutar tests, lint y build.
- [ ] Verificar Browser/MicroPython si cambia semántica del motor.
- [ ] Verificar MQTT real si cambia colaboración o distribución.
- [ ] Actualizar documentación y registro.
- [ ] Revisar que no se incluyan secretos.
- [ ] Crear commit y confirmar el push en la rama correcta.

## Apéndice B. Criterio de terminado del manual

El manual podrá considerarse completo cuando una persona que no haya trabajado
en el proyecto pueda:

1. Ejecutar HiLeS Web en un PC limpio.
2. Conectar un segundo navegador por LAN.
3. Identificar el módulo responsable de un comportamiento.
4. Implementar un cambio pequeño con su prueba.
5. Entender cómo el modelo pasa de JSON a IR y a fragments.
6. Preparar una Pico sin publicar secretos.
7. Diagnosticar un fallo básico usando únicamente este manual y sus enlaces.
