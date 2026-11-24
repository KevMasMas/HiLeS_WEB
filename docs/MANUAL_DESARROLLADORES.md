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
| 5. Motor y modelos | Listo para revisión | Motor, documento JSON, IR v2, particionado y vectores |
| 6. Colaboración y MQTT | Listo para revisión | Cliente MQTT, colaboración v2 y ejecución distribuida v3 |
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

Los nombres técnicos se conservan en inglés tanto en la interfaz como en el
código y en este manual. Cada componente tiene una representación gráfica, una
función en el editor y, cuando corresponde, una semántica ejecutable.

| Componente | Representación gráfica | Función |
|---|---|---|
| **Structural Block** | Rectángulo grande de borde oscuro | Agrupa componentes, puede contener otros Structural Blocks y define una unidad de asignación. No se ejecuta: el compilador lo aplana conservando sus hijos. |
| **Functional Block** | Elipse horizontal | Transforma entradas en salidas mediante una expresión o código. Puede tener varios Input/Output Ports tipados. |
| **Service** | Cuadrado exterior con un segundo cuadrado azul interior | Representa la frontera con el exterior. Un Service de salida permite inyectar un valor; uno de entrada puede recibir y exponer resultados. |
| **Sample** | Triángulo orientable, por defecto hacia la derecha | Convierte una señal continua en un evento discreto: recibe CCH y captura el valor únicamente ante un pulso LCH; emite DCH. |
| **Hold** | Triángulo orientable, por defecto hacia la izquierda | Convierte eventos discretos en señal continua: consume DCH, conserva el último valor en CCH y emite un pulso LCH cuando lo actualiza. |
| **Place** | Círculo con un segundo círculo interior y tokens visibles | Almacena el marcado de la red de Petri. Sus propiedades principales son cantidad inicial de tokens y capacidad. |
| **Transition** | Barra vertical sólida | Comprueba una condición y los tokens de sus Places de entrada; si puede disparar, mueve tokens atómicamente y emite su acción lógica. |

Los Ports aparecen como handles en los bordes de los componentes y se editan
desde **Propiedades**. Tienen `id`, nombre, dirección, tipo de dato, naturaleza,
lado y offset. No se agregan como componentes independientes desde la Palette y
se aplanan al compilar.

`TOKEN` y `TOKEN_FLOW` solo existen para importar modelos antiguos. En el
modelo vigente los tokens se guardan como un número dentro de cada Place y los
arcos conectan Place con Transition. No se debe crear nueva lógica que dependa
de un nodo Token separado.

#### Functional Blocks

Un Functional Block puede operar de tres formas en el frontend:

- una expresión configurada en `expression`;
- código Python ejecutado de forma aislada mediante Pyodide;
- código JavaScript ejecutado en un Worker para simulación local.

La ejecución distribuida v3 usa IR v2. En esa representación solo se aceptan
una expresión pura o el perfil Python restringido. El compilador rechaza
JavaScript imperativo con `IR_CODIGO_NO_SOPORTADO`; que un bloque funcione en la
simulación local no garantiza que pueda desplegarse.

El perfil Python admite una expresión de una línea o una única función
`def calcular(...)`. Permite asignaciones, `if`/`elif`/`else`, `return`,
operadores, indexación, slicing, `inputs.get(...)` y builtins como `abs`,
`bool`, `float`, `int`, `len`, `max`, `min`, `round`, `str` y `sum`. Se
rechazan imports, bucles, clases, lambdas, async, excepciones, acceso a archivos,
red, hardware, `eval`, `exec`, atributos generales y nombres `__dunder__`.

Una sola salida puede devolverse directamente. Varias salidas deben devolverse
en un diccionario cuyas claves coincidan con las variables declaradas. `None`
significa que el bloque no publica una salida en ese paso. Este perfil reduce
errores y acceso accidental a la placa, pero no es un sandbox criptográfico
para código hostil.

### 5.2 Canales

El usuario elige el tipo de canal antes de unir dos Ports compatibles. El tipo
guardado en `hilesConnectionType` define la semántica; la línea es solo su
representación visual.

| Canal | Apariencia | Semántica |
|---|---|---|
| **Continuous Channel (CCH)** | Línea continua con punta cerrada/rellena | Conserva y propaga la última muestra disponible. Con delay, una nueva salida diferente reemplaza la entrega diferida pendiente de esa conexión. |
| **Discrete Event Channel (DCH)** | Línea continua con punta abierta | Cola FIFO de eventos. Consume como máximo un evento por Input Port y por paso. Capacidad predeterminada 8 y máxima 32; el overflow produce `DCH_COLA_DESBORDADA`. |
| **Logical Channel (LCH)** | Línea discontinua con punta tipo chevron | Pulso booleano de un solo paso. Se limpia automáticamente al cerrar el paso para no reutilizar el mismo evento lógico. |
| **Petri arc** | En el editor comparte el conector lógico entre Place y Transition; en IR se convierte en `arco` | Mueve tokens localmente, alterna Place ↔ Transition y tiene un peso entero mayor o igual a 1. |

CCH, DCH y LCH conectan Ports de salida y entrada. Un Petri arc conecta
directamente un Place con una Transition o viceversa. El compilador reconoce
esa pareja y genera `tipo: "arco"`; un `TOKEN_FLOW` antiguo también se normaliza
a arco.

Todos los canales de datos tienen origen y destino tipados. Los tipos IR v2 son
`boolean`, `integer`, `real`, `string`, `vector` y `custom`. Un Port `custom`
acepta una estructura JSON acotada; no acepta objetos de clase, funciones,
tuplas, sets, bytes, `NaN` ni infinitos.

Los delays de elementos y canales son no bloqueantes. Se expresan en
milisegundos, admiten valores entre 0 y 600 000 y se resuelven con el reloj
lógico. El motor no usa `sleep` para esperar una entrega.

### 5.3 Semántica de ejecución

`MotorSimulacion` es el motor TypeScript de referencia. Puede construirse desde
los nodes/edges del editor o desde una IR v2 validada. Mantiene instancias de
los elementos, bus de canales, colas DCH, valores, timers, marcado Petri,
errores y una secuencia de eventos observables.

Un paso sigue este orden determinista:

1. Avanza el reloj lógico según `avanceTiempoMs`. Si no se configura un avance
   predeterminado, un paso no altera el tiempo por sí mismo.
2. Entrega mensajes diferidos cuyo vencimiento ya alcanzó el reloj y prepara el
   consumo FIFO de DCH.
3. Evalúa Service, Functional Block, Sample y Hold en orden topológico.
4. Registra overflow, valores publicados y errores de los elementos.
5. Calcula las Transitions habilitadas según condición, tokens, pesos y
   capacidad de los Places de salida.
6. Procesa timers no bloqueantes de Transitions.
7. Si hay exactamente una Transition lista, consume y produce todos sus tokens
   de forma atómica y emite la acción. Si hay más de una, aplica la política de
   conflicto y no dispara ninguna.
8. Limpia los pulsos LCH consumidos durante el paso.
9. Compara el snapshot con el anterior y determina si el circuito cambió, se
   estabilizó o quedó con trabajo diferido.

La evaluación Petri nunca mueve tokens parcialmente. Primero calcula para cada
Place el resultado neto de consumo y producción. Solo si todos tienen tokens
suficientes y respetan su capacidad aplica el movimiento completo. Un peso 2,
por ejemplo, consume o produce dos tokens en una única operación.

Una Transition con delay arma su timer cuando queda habilitada. Si pierde la
condición o deja de tener tokens antes del vencimiento, el timer se cancela. Al
alcanzar el tiempo solo dispara si continúa habilitada.

**Paso** ejecuta exactamente un ciclo. La ejecución hasta estabilización repite
pasos hasta que no haya cambios ni trabajo pendiente, aparezca un error o se
alcance el límite; el motor local usa 50 pasos como tope predeterminado para
detectar una posible oscilación.

**Reiniciar** restaura el estado inicial completo:

- tokens y capacidad inicial de los Places;
- valores iniciales de Service y Hold;
- reloj lógico y contador de pasos;
- colas DCH y pulsos LCH;
- entregas diferidas y timers;
- entradas, salidas, errores y eventos de ejecución.

Reiniciar no modifica el documento del editor. Solo reinicia el runtime que fue
construido a partir de él.

### 5.4 Documento JSON del editor

El JSON exportado por el editor es un documento de diseño. Conserva información
visual y editable; no es la IR que ejecuta una Pico. Su estructura raíz es:

```json
{
  "schemaVersion": 2,
  "metadata": { "savedAt": "2026-11-23T12:00:00.000Z" },
  "network": {
    "topology": null,
    "protocol": null,
    "nodes": ["block-sensor"]
  },
  "allElements": [],
  "relationNode": [],
  "connections": []
}
```

Campos principales:

| Campo | Contenido |
|---|---|
| `schemaVersion` | Versión del documento. La exportación actual genera 2; se aceptan documentos antiguos compatibles de versión 1. |
| `metadata.savedAt` | Fecha ISO de serialización. Puede haber metadata descriptiva adicional. |
| `network.nodes` | IDs de Structural Blocks conocidos por el documento. `topology` y `protocol` quedan disponibles como metadata. |
| `allElements` | Componentes, jerarquía, layout, Ports y propiedades editables. |
| `relationNode` | Índice derivado de Structural Block → hijos directos. No reemplaza `parentId`. |
| `connections` | Aristas React Flow con extremos, handles y datos del canal. |

Un elemento tiene esta forma general:

```json
{
  "id": "sensor-humedad",
  "type": "SERVICE",
  "name": "Humidity sensor",
  "parentId": "block-sensor",
  "layout": { "x": 40, "y": 70, "width": 120, "height": 80 },
  "ports": [
    {
      "id": "humidity-out",
      "name": "humidity",
      "direction": "output",
      "dataType": "real",
      "nature": "continuous",
      "side": "right",
      "offset": 0.5
    }
  ],
  "properties": {
    "description": "External humidity input",
    "collapsed": false,
    "locked": false,
    "visible": true,
    "enabled": true,
    "executionDelay": 0,
    "rotation": 0
  }
}
```

`parentId` es la relación de pertenencia real. Si existe, `layout.x` y
`layout.y` son relativos al padre. El padre debe existir; al borrar un
Structural Block se eliminan recursivamente sus descendientes y las conexiones
afectadas.

Una conexión guarda, como mínimo, `id`, `source`, `target`, `sourceHandle`,
`targetHandle` y `data`. En `data` se conservan
`hilesConnectionType`, `routing`, `dataType`, `delay`, `weight`,
`propagationMode` y `waypoints`. Los waypoints pueden declarar el bloque al que
son relativos mediante `parentBlockId`.

Reglas de integridad aplicadas al importar:

- IDs de elementos únicos y no vacíos;
- nombre no vacío para cada elemento;
- todo `parentId` debe apuntar a un elemento existente;
- toda conexión necesita ID y extremos existentes;
- nodos y aristas reciben propiedades predeterminadas faltantes al normalizar;
- el runtime (`value`, tokens observados, errores, stale) no se importa ni se
  exporta como parte del documento.

Importar reemplaza el modelo editable y limpia selección e historial. Exportar
usa el estado actual normalizado. Para compatibilidad, nunca se debe cambiar el
significado de un campo existente sin incrementar la versión y añadir una
migración.

### 5.5 Compilación a IR v2

La IR v2 es el contrato ejecutable común entre Browser y MicroPython. El flujo
de transformación es:

```text
Documento JSON del editor
        │ validar estructura y referencias
        ▼
normalizar propiedades, Ports y conexiones antiguas
        │ aplanar Structural Blocks y Ports de frontera
        ▼
crear elementos y canales IR v2 tipados
        │ validar límites, expresiones y Python
        ▼
IrModeloV2 válido o lista de diagnósticos
```

La raíz IR contiene `ir_version`, identidad y versión del modelo, nombre,
metadata de compilación, entradas externas, elementos y conexiones. Los tipos
de elementos ejecutables son `service`, `functional_block`, `sample`, `hold`,
`place` y `transition`; las conexiones son `cch`, `dch`, `lch` y `arco`.

Durante el aplanamiento:

- Structural Blocks y Ports visuales no se convierten en elementos ejecutables;
- los IDs de los elementos hoja se conservan;
- las conexiones que atravesaban la frontera se resuelven hacia sus extremos
  ejecutables;
- Token/Token Flow antiguos se normalizan a tokens del Place y `arco`;
- la metadata registra bloques aplanados y normalizaciones legadas.

El compilador genera diagnósticos con código, severidad y mensaje. Si hay un
error, no devuelve un modelo parcialmente desplegable. Entre los fallos comunes
están una referencia inexistente, Port incompatible, ciclo CCH, expresión
inválida, JavaScript no soportado, delay fuera de rango o perfil Python
prohibido.

Límites principales de IR v2:

| Recurso | Límite |
|---|---:|
| Elementos | 64 |
| Conexiones | 128 |
| JSON IR útil | 31 744 bytes dentro del presupuesto MQTT de 32 768 |
| Profundidad de expresión AST | 16 |
| Delay | 600 000 ms |
| Capacidad DCH | 32 eventos; predeterminada 8 |
| Código Python | 2 048 bytes y 40 líneas |
| Inputs/Outputs de Python | 16 / 16 |
| Longitud de vector | 32 números |
| Profundidad `custom` | 6 |
| Elementos internos de un valor `custom` | 64 |
| String o clave | 256 caracteres |
| Valor serializado | 2 048 bytes |

Estos límites existen para mantener equivalencia con MicroPython y el tamaño de
payload MQTT. Aumentarlos solo en TypeScript rompe el contrato: cualquier
cambio debe aplicarse y probarse en ambos motores.

### 5.6 Particionado distribuido v3

Después de compilar una IR v2 válida, el frontend resuelve el propietario de
cada elemento ejecutable. La prioridad de asignación es:

1. override explícito de un Functional Block;
2. asignación directa del elemento;
3. asignación heredada del Structural Block ancestro más cercano.

Un elemento raíz sin asignación produce `DISTRIBUCION_DESTINO_FALTANTE`. El
nombre de un colaborador no interviene: los destinos son `executorId` como
`browser:<sessionId>` o `pico:<deviceId>`.

El particionador es determinista y no consulta UI, reloj ni broker:

1. valida proyecto, deployment, epoch, IR y ejecutores;
2. comprueba que cada elemento tenga exactamente un propietario disponible;
3. ordena elementos y conexiones por ID;
4. conserva dentro de un fragment las conexiones cuyos extremos comparten
   propietario;
5. convierte CCH, DCH o LCH que cruza propietarios en una ruta remota tipada;
6. crea un fragment por ejecutor con su IR local, inbound routes y outbound
   routes;
7. verifica lenguajes, cantidad de elementos y bytes contra las capacidades
   anunciadas por cada worker;
8. serializa canónicamente, calcula SHA-256 y genera el manifest.

El manifest identifica proyecto, deployment, epoch, propietarios, resumen de
fragments y rutas. Cada resumen lleva `fragmentId`, `executorId`, hash, tamaño y
elementos. El worker rechaza un fragment si no es su propietario, no soporta la
IR/lenguaje, excede su capacidad o no coincide el hash. El despliegue no puede
iniciar hasta recibir ACK positivo de todos los fragments requeridos.

Los Petri arcs nunca se convierten en rutas MQTT. Un Place y una Transition
conectados deben permanecer en el mismo fragment; separarlos produce
`DISTRIBUCION_ARCO_REMOTO`. LCH sí puede cruzar ejecutores como pulso booleano,
pero no comparte una instancia de Place ni mueve un token remoto directamente.

Las rutas remotas no usan retained y conservan tipo, delay y capacidad DCH. El
receptor valida proyecto, deployment, epoch, propietario, conexión, tipo,
secuencia y `messageId`. Un mensaje duplicado o atrasado se descarta sin volver
a ejecutar el componente.

### 5.7 Vectores de conformidad

Los vectores de `docs/mqtt/vectores_ir_v2/` son ejemplos ejecutables y la fuente
de verdad para comprobar que Browser y MicroPython producen el mismo estado.
Se organizan en:

| Carpeta | Propósito |
|---|---|
| `modelos/validos` | IR que ambos validadores deben aceptar |
| `modelos/invalidos` | IR que debe rechazarse con un diagnóstico estable |
| `python/validos` y `python/invalidos` | Perfil permitido y prohibido de Functional Blocks |
| `ejecucion` | Modelo, estado inicial, entradas por paso y snapshots esperados |

Un vector de ejecución tiene esta forma:

```json
{
  "descripcion": "Comportamiento que se congela",
  "modelo": { "ir_version": 2, "elementos": [], "conexiones": [] },
  "estado_inicial": {},
  "pasos": [
    {
      "avance_tiempo_ms": 0,
      "entradas": { "service-id": 5 },
      "elementos_esperados": {}
    }
  ]
}
```

Para agregar o cambiar semántica:

1. crear el caso mínimo que diferencie el comportamiento;
2. declarar todos los estados observables relevantes, no solo la salida final;
3. incluir varios pasos si intervienen FIFO, LCH, Hold, timers o Petri;
4. comprobar el estado inicial;
5. ejecutar el mismo archivo con `MotorSimulacion` y `HilesEngineV2`;
6. reiniciar ambos motores y repetir el vector para detectar estado residual;
7. agregar además un modelo inválido si se introduce una regla de rechazo;
8. actualizar la matriz de conformidad sin afirmar prueba física cuando solo se
   usaron motores o dobles de protocolo.

Comandos mínimos desde la raíz:

```powershell
Set-Location .\frontend
npm.cmd run test:run

Set-Location ..
python -m unittest discover -s firmware/tests -t . -v
```

En el frontend, `ConformidadIrV2.test.ts` descubre automáticamente todos los
JSON de `ejecucion/`. En firmware, `test_hiles_engine_v2.py` recorre la misma
carpeta. Por eso un nuevo archivo correctamente formado entra en las dos suites
sin mantener dos copias de las expectativas.

## 6. Colaboración y comunicación MQTT

### 6.1 Rol de Mosquitto

Mosquitto es el broker MQTT: recibe publicaciones y las entrega a todos los
clientes suscritos al topic correspondiente. No conoce la semántica de HiLeS,
no valida IR, no mueve tokens, no resuelve conflictos y no decide dónde se
ejecuta un bloque.

```text
Navegador ── MQTT sobre WebSocket :9001 ──┐
Navegador ── MQTT sobre WebSocket :9001 ──┼── Mosquitto
Pico ─────── MQTT sobre TCP :1883 ────────┘
```

Los navegadores usan MQTT.js porque la API del navegador no permite abrir un
socket MQTT TCP directo. Las Picos usan MQTT TCP. Ambos listeners llegan al
mismo broker y pueden intercambiar mensajes aunque el transporte de entrada sea
distinto.

Vite y Mosquitto cumplen tareas independientes:

- Vite entrega HTML, JavaScript, CSS y assets por HTTP en el puerto `5173`;
- Mosquitto transporta JSON MQTT por `1883` o `9001`;
- cerrar Vite no detiene el servicio Mosquitto;
- tener Vite activo no significa que MQTT esté conectado.

#### QoS y mensajes retained

HiLeS usa principalmente QoS 0 y QoS 1:

- **QoS 0:** entrega best effort. Es adecuado para cursores o telemetría que
  pronto será reemplazada por una muestra nueva.
- **QoS 1:** el mensaje llega al menos una vez. Puede duplicarse, por lo que una
  operación con efectos debe deduplicarse mediante `operationId`, `id_mensaje`
  o secuencia.
- **Retain:** Mosquitto conserva el último payload del topic y lo entrega a un
  cliente que se suscribe después. Se usa para estado recuperable, nunca para
  un comando que no deba repetirse.

Regla general del proyecto:

| Tipo de información | QoS habitual | Retain | Razón |
|---|---:|:---:|---|
| Snapshot de documento | 1 | Sí | Un colaborador tardío necesita hidratar el proyecto |
| Operación incremental | 1 | No | Es un evento; el checkpoint posterior la consolida |
| Presencia/estado de ejecutor | 1 | Sí | Debe conocerse el último estado y permitir Last Will |
| Cursor/telemetría/snapshot parcial frecuente | 0 | No | Una muestra posterior reemplaza la anterior |
| Manifest, fragment y ACK | 1 | Sí | Un worker que reconecta debe recuperar el despliegue activo |
| Canal remoto, comando o entrada | 1 | No | Retenerlos podría repetir una acción antigua |
| Error | 1 | No | Es evidencia puntual, no estado permanente |

El cliente web rechaza antes de publicar un payload mayor de 32 KiB y descarta
mensajes que no sean JSON válido. Los consumidores aplican después la validación
específica de cada protocolo.

La conexión Local/LAN normalmente usa `ws://`; un broker remoto debe usar
`wss://`, autenticación y control de acceso. Las credenciales permanecen en la
memoria de la pestaña o en archivos locales excluidos. Nunca forman parte del
documento, la URL ni un mensaje retained.

### 6.2 Identidad y proyectos

Una sesión tiene varias identidades con alcances diferentes:

| Identidad | Ejemplo | Alcance y propósito |
|---|---|---|
| `projectId` | `proyecto-parqueadero` | Espacio común de topics y documento compartido |
| Nombre visible | `Juan David Romero` | Texto que ven otros participantes junto al cursor y presencia |
| `clientId` colaborativo | `web-<uuid>` | Identifica una pestaña en operaciones, presencia y convergencia v2 |
| MQTT `clientId` | generado por la configuración MQTT | Identifica la conexión ante Mosquitto |
| `executorId` | `browser:abc123` o `pico:pico01` | Identifica un worker capaz de recibir y ejecutar un fragment v3 |
| `deploymentId` | `deploy-<uuid>` | Identifica una compilación distribuida completa |
| `epoch` | `4` | Invalida mensajes de una configuración anterior del mismo deployment |
| `fragmentId` | `<deploymentId>:<executorId>` | Identifica el fragment perteneciente a un worker |

El `projectId` viaja en la URL como `?project=<id>`. Debe tener entre 3 y 64
caracteres, comenzar por letra minúscula o dígito y continuar únicamente con
`a-z`, `0-9`, `_` o `-`. Al escribir un valor no válido, la aplicación lo
normaliza antes de construir topics.

Dos navegadores colaboran solamente si cumplen las dos condiciones:

1. apuntan al mismo broker MQTT;
2. usan exactamente el mismo `projectId`.

Compartir solo la URL no basta si un celular interpreta `localhost` como su
propio dispositivo. Para una LAN, el perfil MQTT debe usar la IP del PC que
ejecuta Mosquitto.

El nombre visible se normaliza, se limita a 40 caracteres y se conserva en
`sessionStorage`. La identidad colaborativa también pertenece a la pestaña.
Abrir otra ventana o navegador puede crear otro participante aunque la persona
escriba el mismo nombre.

Colaborar y ejecutar son capacidades separadas. `clientId` identifica quién
edita; `executorId` identifica dónde corre un fragment. Al activar **Ejecutar
aquí**, la pestaña crea una sesión de BrowserWorker independiente. Cambiar el
nombre visible no debe modificar `executorId` ni las asignaciones del modelo.

### 6.3 Sincronización entre navegadores

La colaboración usa el prefijo:

```text
udfjc/hiles/v2/projects/<projectId>/
```

Topics principales:

| Sufijo | Contenido | QoS / Retain |
|---|---|---|
| `document/snapshot` | Documento completo para hidratación y checkpoints | 1 / Sí |
| `document/ops` | `node.add`, `node.move`, `node.update`, `node.remove`, operaciones de connection y cambios del documento | 1 / No |
| `presence/<clientId>` | Nombre, color, conexión, vista activa y TTL del participante | 1 / Sí |
| `cursor` | Posición reciente del cursor en coordenadas del Canvas | 0 / No |

#### Entrada a un proyecto

El flujo al abrir una URL compartida es:

1. `Editor` obtiene o crea el `projectId` de la URL.
2. La persona confirma su nombre visible.
3. `useProjectStore` crea un `ProjectSyncClient` con una copia inicial del
   documento local.
4. El cliente configura su Last Will de presencia y se suscribe a snapshot,
   operaciones, presencia y cursor.
5. Si MQTT ya estaba conectado, la conexión se recrea para instalar el Will en
   el paquete CONNECT.
6. Mosquitto entrega el snapshot retained, si existe.
7. La aplicación espera 500 ms antes de comenzar a publicar cambios locales,
   para evitar sobrescribir el snapshot recién recibido.
8. Si no llegó snapshot, publica el documento local como snapshot inicial.
9. A partir de ese momento, cada cambio de nodes/edges se convierte en una o
   varias operaciones incrementales.

Si MQTT no conecta, un fallback habilita la interfaz para edición local. Ese
estado permite trabajar offline, pero no representa una sincronización válida.

#### Operaciones y checkpoints

`ProjectSyncClient` compara el documento confirmado con el nuevo documento y
produce operaciones atómicas. Agrupa cambios locales durante aproximadamente
150 ms para evitar publicar cada píxel de un arrastre. Después de operaciones
correctas programa, tras unos 2 segundos de inactividad, un snapshot retained
como checkpoint.

Las operaciones permiten que dos personas modifiquen entidades distintas sin
reemplazar el documento completo. El snapshot permite que una persona que entra
después no tenga que reproducir todo el historial.

#### Convergencia

Cada mensaje lleva proyecto, `clientId`, `operationId`, reloj Lamport y fecha.
Las reglas son:

1. descartar mensajes de otro `projectId`;
2. descartar el eco del propio `clientId`;
3. deduplicar los últimos 128 `operationId`, porque QoS 1 puede repetirlos;
4. al publicar, incrementar el reloj Lamport local;
5. al recibir, avanzar a `max(local, remoto) + 1`;
6. resolver cambios concurrentes sobre la misma entidad por Last Writer Wins
   usando `(clock, clientId)` como orden determinista;
7. conservar por separado la marca de cada node, connection y metadata;
8. activar una guardia mientras se aplica un cambio remoto para que el store no
   lo vuelva a publicar como cambio local.

Aplicar un documento remoto actualiza nodes/edges y limpia la selección, pero
conserva el historial local de undo/redo. El historial no se transmite a otros
participantes.

#### Presencia y cursores

Cada pestaña publica presencia en su topic exclusivo con TTL predeterminado de
30 segundos y heartbeat cercano a un tercio del TTL. Una desconexión limpia
publica `conectado: false`; una caída abrupta activa el Last Will. Si ninguno
llega, los demás clientes marcan inactivo al participante al vencer el TTL y
eliminan su cursor.

El Canvas limita la publicación de cursor a aproximadamente una muestra cada
60 ms. Los cursores no son retained: al reconectar se espera una nueva muestra,
en vez de mostrar una posición antigua como si fuera actual.

### 6.4 Ejecución distribuida

La ejecución distribuida usa un espacio diferente para no mezclar edición y
runtime:

```text
udfjc/hiles/v3/projects/<projectId>/
```

Topics principales:

| Topic relativo | Productor → consumidor | Función |
|---|---|---|
| `executors/<executorId>/status` | Worker → navegadores | Descubrimiento, capacidades y estado actual |
| `deployments/manifest` | Controlador → workers | Mapa de propietarios, fragments y rutas del despliegue activo |
| `deployments/<deploymentId>/fragments/<executorId>` | Controlador → worker | IR v2 local y rutas inbound/outbound del destino |
| `.../ack/<executorId>` | Worker → controlador | Aceptación o rechazo del fragment |
| `.../channels/<connectionId>` | Worker origen → worker destino | Valor CCH, evento DCH o pulso LCH entre ejecutores |
| `.../snapshot/<executorId>` | Worker → interfaz | Estado parcial de los elementos propietarios |
| `.../command` | Interfaz → workers | `start`, `step`, `stop` o `reset` |
| `.../input` | Interfaz → propietario | Valor inyectado a un Service del fragment correcto |
| `.../error` | Worker → interfaz | Diagnóstico estructurado del despliegue o runtime |

El ciclo completo es:

1. Cada BrowserWorker o Pico anuncia `executorId`, tipo, estado, versiones IR,
   lenguajes y límites.
2. El usuario asigna Structural Blocks y overrides permitidos.
3. El navegador compila, resuelve propietarios y genera manifest/fragments.
4. Publica manifest y fragment por ejecutor con QoS 1 y retain.
5. Cada worker verifica identidad, IR, capacidades, tamaño y SHA-256.
6. El worker publica un ACK de la misma epoch.
7. Solo cuando todos los ACK requeridos son positivos se habilitan **Iniciar**
   y **Paso**.
8. Un canal local se procesa dentro del fragment; uno remoto se publica en el
   topic de su connection.
9. Cada worker publica únicamente el estado de sus elementos propietarios.
10. El frontend valida epoch/propietario y agrega los snapshots para pintar un
    único estado sobre el Canvas.

Cada mensaje de canal declara proyecto, deployment, epoch, connection,
propietario, secuencia, `messageId` y valor. El receptor comprueba todo el
contexto antes de entregar el valor al motor. Duplicados, mensajes atrasados o
de otra epoch se descartan.

El broker no coordina este ciclo: `useDistributedExecutionStore`, el
particionador, BrowserWorker y el runtime MicroPython implementan las reglas.

### 6.5 Reconexión y recuperación

El cliente MQTT del navegador mantiene un registro con conteo de consumidores
por topic. Así, si dos features comparten una suscripción, cerrar una no
desuscribe accidentalmente a la otra. Tras reconectar restaura todos los topics
registrados. MQTT.js intenta reconectar cada 5 segundos y usa un timeout de
conexión de 30 segundos.

La recuperación colaborativa se apoya en cuatro mecanismos:

- snapshot retained para reconstruir el último documento consolidado;
- operaciones pendientes que vuelven a calcularse/publicarse al recuperar
  `CONNECTED`;
- presencia retained con Last Will y TTL;
- deduplicación y reloj Lamport para tolerar reentregas u orden diferente.

La recuperación distribuida usa:

- estado retained y Last Will `offline` de cada ejecutor;
- manifest, fragments y ACK retained de la epoch activa;
- SHA-256 para comprobar que el fragment recuperado sea exactamente el
  anunciado;
- secuencias por connection para rechazar canales repetidos;
- snapshots parciales no retained para evitar reconstruir runtime con
  telemetría vieja.

Cuando un worker vuelve, lee manifest y fragment retained, valida epoch/hash y
publica de nuevo su ACK. No debe aceptar canales hasta completar esa
resincronización.

Si un ejecutor pasa a `offline`, sus elementos se muestran como **stale** u
**Obsoleto**. Los snapshots de los demás fragmentos siguen siendo válidos. El
estado stale informa que el último valor ya no está respaldado por un ejecutor
activo; no debe borrarse silenciosamente ni presentarse como actual.

Antes de una epoch nueva, el controlador limpia los retained del despliegue
anterior mediante payload vacío. `epoch` evita que un mensaje tardío de la
configuración previa se aplique al nuevo runtime. Retirar un despliegue también
debe limpiar manifest, fragments y ACK retenidos; dejar retained antiguos puede
hacer que un worker reconectado intente recuperar un despliegue que ya no
existe.

### 6.6 Matrices verificables

La evidencia debe nombrar qué se probó realmente. Un broker real con ejecutores
simulados valida red y protocolo, pero no valida Wi-Fi, memoria ni MicroPython
de una placa.

| Matriz o nivel | Qué demuestra | Qué no demuestra |
|---|---|---|
| Dos navegadores en la interfaz | Nombre, presencia, snapshot, edición, cursor y Canvas compartido | Firmware o hardware Pico |
| Cuatro clientes MQTT reales | Fan-out, aislamiento entre projectIds, snapshot retained, presencia y cursor | Render de React o ejecución del motor |
| BrowserWorker tests | IR, canales y runtime TypeScript de un ejecutor Browser | Broker o red real si usa transporte en memoria |
| Runner distribuido `memory` | Manifest, fragments, ACK, canales, epoch, deduplicación y recuperación determinista | Mosquitto, sockets o hardware |
| Runner distribuido `mqtt` | Lo anterior atravesando Mosquitto real | Que los ejecutores `pico:*` sean placas físicas; el runner usa dobles Node.js |
| Pico física ↔ Browser | Transporte real, MicroPython, límites de placa y un navegador | Segunda Pico física |
| Pico física ↔ Pico física | Ejecución completa entre dos placas | Nada si se reemplazan las placas por dobles; debe declararse la sustitución |

Con `frontend/.env.local` configurado y Mosquitto activo, las comprobaciones de
software se ejecutan desde la raíz:

```powershell
node .\scripts\test-project-collaboration.mjs
node .\scripts\test-mqtt-four-clients.mjs
node .\scripts\test-distributed-mqtt.mjs --mode=memory
node .\scripts\test-distributed-mqtt.mjs --mode=mqtt --timeout=12000
```

Resultados esperados:

- `test-project-collaboration`: cuatro clientes del proyecto A reciben la
  operación, el proyecto B no la recibe, un cliente tardío recupera snapshot y
  se observan presencia y cursor;
- `test-mqtt-four-clients`: cuatro clientes reciben el mismo estado JSON;
- runner `memory`: completa registro, carga, ACK, entradas, pasos, snapshots,
  deduplicación, caída, recuperación y limpieza;
- runner `mqtt`: completa las mismas etapas posibles sobre Mosquitto y declara
  explícitamente que los ejecutores Pico son simulados.

La prueba visual mínima Browser ↔ Browser debe usar nombres distintos, el mismo
enlace `?project=...`, un cambio de componente, un movimiento y una recarga. La
prueba física solo se registra como aprobada cuando se identifican las placas,
firmware, configuración, comandos, snapshots y resultado observable. Un DryRun
o `-AllowNoDevice` comprueba el procedimiento, no la matriz física.

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
