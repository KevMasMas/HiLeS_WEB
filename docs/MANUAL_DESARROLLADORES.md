# Manual para desarrolladores de HiLeS Web

> **Estado:** borrador completo para revisión técnica
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
| 7. Firmware MicroPython | Listo para revisión | Runtime, configuración, worker v3 y despliegue seguro |
| 8. Flujos de desarrollo | Listo para revisión | Casos reales y puntos de extensión del proyecto |
| 9. Pruebas y calidad | Listo para revisión | Suites de frontend, firmware, MQTT y hardware |
| 10. Git y contribución | Listo para revisión | Flujo seguro de la rama compartida |
| 11. Seguridad | Listo para revisión | Secretos, red y perfil Python |
| 12. Diagnóstico | Listo para revisión | Árboles de comprobación y recuperación |
| 13. Glosario | Listo para revisión | Terminología HiLeS, MQTT y distribución |

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

El firmware es un monolito modular: en la placa existe un solo proceso y un
scheduler cooperativo, pero las responsabilidades están separadas por paquetes.

```text
firmware/pico/
├── main.py       Composición del runtime y punto de arranque
├── core/         Clock, Task y Scheduler
├── pubsub/       Bus interno Node, topics y transporte MQTT
├── hiles/        Validación, canales, motores IR y DistributedWorker
├── devices/      LED de diagnóstico y Watchdog
├── platform/     Adaptadores de Wi-Fi, machine, GPIO y umqtt
└── examples/     Pruebas manuales pequeñas; no forman parte del paquete canónico
```

La regla de dependencias es:

```text
main ──▶ core + pubsub + hiles + devices + platform
pubsub ──▶ core
hiles ──▶ core + pubsub
devices ──▶ core + pubsub
platform ──▶ APIs específicas de MicroPython
```

`core/` y `hiles/` no deben importar directamente `machine`, `network` ni
`umqtt`. Esa separación permite ejecutar el motor y las pruebas en un PC
inyectando reloj, transporte y hardware falsos.

#### Scheduler cooperativo

Una `Task` tiene periodo, prioridad, próximo vencimiento, estado habilitado y
métricas. `Scheduler.run_pending()` recorre las tareas por prioridad y orden de
registro, ejecuta una vez las que vencieron y vuelve a programarlas desde la
hora real de terminación. No intenta recuperar en ráfaga iteraciones perdidas.

Cada implementación de `update()` debe:

- realizar una cantidad acotada de trabajo y retornar rápidamente;
- conservar en atributos el trabajo que continuará en otro ciclo;
- evitar `while True`, espera activa o `sleep` para completar una secuencia;
- encolar trabajo costoso desde callbacks MQTT, no ejecutarlo dentro del
  callback;
- declarar `max_update_ms` cuando necesite presupuesto de tiempo.

El scheduler mide duración, número de ejecuciones, errores y overruns. Una
excepción se informa al manejador, pero no elimina automáticamente la tarea ni
impide que las demás se ejecuten.

#### Ciclo de arranque

MicroPython ejecuta `main.py`. `build_default_application()`:

1. carga `config_local.py`;
2. resuelve `DEVICE_ID`, `MQTT_CLIENT_ID`, `executorId`, proyecto y topics;
3. crea `Scheduler` y el bus interno `Node`;
4. crea el LED de la placa y `LedTask`;
5. crea `EngineTaskV2`, que conserva soporte IR v1 por compatibilidad;
6. crea el adaptador Wi-Fi y `MqttTransport`;
7. crea `WatchdogTask` para telemetría y métricas;
8. crea `DistributedWorker` para el protocolo v3;
9. registra los componentes en `scheduler.components`;
10. entra en `scheduler.run_forever()`.

Las tareas visibles son `mqtt`, `led`, `motor`, `watchdog` y `worker_v3`.
`main.py` solo las conecta: la lógica de IR, MQTT o dispositivos permanece en
sus módulos.

`Node` es un bus publish/subscribe interno. Recibe objetos Python ya
decodificados y desacopla motor, LED, watchdog y transporte. Si un callback
falla, registra el error y continúa entregando a los demás suscriptores.

`MqttTransport` comprueba Wi-Fi, conecta, procesa como máximo una lectura breve
por actualización, aplica keepalive, valida el límite de 32 KiB y programa la
reconexión. No ejecuta el circuito dentro del callback del socket.

### 7.2 Configuración por placa

Cada placa usa el mismo código fuente y un `config_local.py` distinto. La
plantilla versionada es `firmware/pico/config_local.example.py`; la copia real
está ignorada por Git y contiene secretos.

| Campo | Regla |
|---|---|
| `WIFI_SSID` / `WIFI_PASSWORD` | Red de 2.4 GHz accesible por la Pico; no se publican |
| `MQTT_HOST` | IPv4 o host del PC/broker; nunca `localhost` ni `127.0.0.1` en la placa |
| `MQTT_PORT` | Normalmente `1883`, listener MQTT TCP |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | Credenciales del broker, locales a la placa |
| `DEVICE_ID` | Identidad estable y única de la placa, sin espacios ni `/`, `+`, `#` |
| `MQTT_CLIENT_ID` | Único por conexión; normalmente igual a `DEVICE_ID` |
| `HILES_TEAM_ID` | Segmento v1 conservado por compatibilidad; normalmente `equipo1` |
| `HILES_PROJECT_ID` | Debe coincidir exactamente con `?project=` de la aplicación |
| `WORKER_MAX_FRAGMENT_BYTES` | Capacidad anunciada; valor de referencia 30 000 |
| `WORKER_MAX_ELEMENTS` | Capacidad anunciada; valor de referencia 64 |
| `WORKER_STATUS_PERIOD_MS` | Heartbeat de estado; valor de referencia 5 000 ms |
| `ENGINE_PERIOD_MS` | Frecuencia con que la tarea del motor revisa su cola; referencia 20 ms |
| `ENGINE_STEP_INTERVAL_MS` | Intervalo de ejecución continua; referencia 1 000 ms |
| `ENGINE_QUEUE_SIZE` | Capacidad de comandos/entradas pendientes; referencia 32 |
| `WATCHDOG_PERIOD_MS` | Periodo de telemetría; referencia 5 000 ms |

`resolve_device_id()` usa, en orden, `DEVICE_ID`, el identificador físico de
`machine.unique_id()`, `MQTT_CLIENT_ID` y finalmente `pico01`. Conviene definir
`DEVICE_ID` explícitamente para que la identidad no cambie entre instalaciones.
El ejecutor visible se deriva como `pico:<DEVICE_ID>`.

Todas las placas de un mismo modelo comparten broker y `HILES_PROJECT_ID`, pero
cada una necesita `DEVICE_ID` y `MQTT_CLIENT_ID` propios. Si al encender una
placa desaparece otra, la causa probable es un `MQTT_CLIENT_ID` duplicado.

La aplicación puede generar el archivo desde **Ejecutores → Preparar otra
Raspberry Pi Pico**. El generador:

- valida campos obligatorios, puerto e identificadores MQTT;
- escapa los textos como literales Python;
- descarga el archivo sin guardar las credenciales en el proyecto,
  `localStorage` ni MQTT;
- no detecta IDs repetidos, banda Wi-Fi incorrecta ni una IP del broker
  equivocada;
- no escribe en la placa mediante Web Serial.

Antes de una sesión física, comprobar que PC y Picos están en la misma red de
2.4 GHz, que no existe aislamiento entre clientes y que la IPv4 configurada
sigue siendo la del PC. Las IP de VPN, WSL, Hyper-V o VirtualBox no son el host
del broker para la Pico.

### 7.3 Recepción y validación de fragmentos

`DistributedWorker` es una Task del protocolo v3. Al arrancar:

- configura un Last Will retained con estado `offline`;
- se suscribe al manifest del `HILES_PROJECT_ID`;
- se suscribe solo al filtro de fragments dirigido a su `executorId`;
- publica estado y capacidades con firmware `3.0.0`;
- procesa una cantidad acotada de eventos y publicaciones en cada `update()`.

Manifest y fragment pueden llegar en cualquier orden porque ambos son
retained. Si llega primero el fragment, el worker lo conserva temporalmente
hasta recibir el manifest de la misma combinación `(deploymentId, epoch)`.

Antes de activar un fragment comprueba:

1. versión de protocolo, proyecto, deployment y epoch válidos;
2. `executor_id` y `owner_executor_id` iguales a su propio `executorId`;
3. existencia de un resumen para ese ejecutor en el manifest;
4. SHA-256 del payload recibido o de su serialización canónica;
5. tamaño menor o igual a `WORKER_MAX_FRAGMENT_BYTES`;
6. objeto de modelo con IR v2 soportada;
7. cantidad de elementos dentro de la capacidad anunciada;
8. lenguaje de cada Functional Block soportado;
9. ownership de todos los elementos según el manifest;
10. estructura, referencias, tipos, canales, límites y perfil Python de IR v2;
11. compilación correcta de todos los Functional Blocks Python;
12. validez de inbound/outbound routes.

La carga es atómica: primero construye un `HilesEngineV2` temporal. Solo si
todo es válido reemplaza el motor activo, reinicia secuencias/deduplicación,
suscribe las rutas del nuevo deployment y publica ACK positivo, estado `ready`
y snapshot inicial.

Un rechazo publica ACK negativo y error estructurado con código, etapa y, si
aplica, elemento o conexión. El fragmento y motor activos anteriores se
conservan; una entrega inválida no debe dejar la placa a medio actualizar.

El worker acepta canales únicamente después de resincronizar manifest y
fragment. Valida proyecto, deployment, epoch, connection, propietario, tipo de
valor, secuencia y `messageId`. Mantiene una ventana acotada de deduplicación,
por lo que una reentrega QoS 1 no vuelve a alimentar el motor.

Al recibir payload vacío en el manifest o fragment retained activo, libera el
fragmento, desuscribe sus topics dinámicos, limpia motor y vuelve al estado
`online`. Una epoch antigua se ignora.

### 7.4 Motor MicroPython

`HilesEngineV2` implementa en MicroPython la misma semántica observable del
motor TypeScript:

- Service, Functional Block, Sample, Hold, Place y Transition;
- tipos `boolean`, `integer`, `real`, `string`, `vector` y `custom`;
- CCH retenido, DCH FIFO, LCH de un paso y Petri arcs;
- delays no bloqueantes de elementos, canales y Transitions;
- tokens, pesos, capacidad y política de conflicto;
- snapshot, errores, reinicio y detección de trabajo pendiente.

El constructor recibe una IR ya validada, crea elementos y canales, calcula el
orden topológico y compila los Functional Blocks antes de quedar activo. Puede
registrar inbound routes para recibir valores remotos y outbound routes para
publicarlos mediante el worker.

`EngineTaskV2` separa el motor de MQTT. Su cola contiene cargas, comandos,
entradas externas o entradas locales de dispositivos. Cada `update()` procesa
trabajo acotado. La ejecución continua usa el reloj del scheduler y
`ENGINE_STEP_INTERVAL_MS`; no bloquea el resto de tareas.

El runtime conserva el motor v1 y los topics históricos para compatibilidad y
diagnóstico, pero la interfaz actual distribuye fragments v3 con IR v2. No se
debe añadir lógica nueva únicamente al motor v1.

#### Python en la placa

`PythonExecutor` valida el perfil restringido, compila una vez por carga y
ejecuta repetidamente la función. Expone métricas de compilaciones, ejecuciones,
errores, duración y overruns. Las entradas y salidas se validan y copian como
valores JSON acotados para evitar mutación compartida.

El perfil bloquea imports, bucles, acceso a hardware, red, sistema de archivos,
introspección y builtins peligrosos. Aun así no debe aceptarse código de una
persona no autorizada: las restricciones protegen el runtime, pero no
constituyen aislamiento criptográfico.

#### Memoria y recuperación

La Pico tiene memoria limitada. Antes de construir un fragment se ejecuta
garbage collection y el límite útil de fragment se mantiene por debajo del
payload MQTT máximo. El motor evita copias innecesarias durante propagación,
pero clona los valores al cruzar la frontera de entrada.

Si se pierde el broker, el estado pasa a `degraded`; el motor local puede
conservarse. Las salidas remotas producidas durante la interrupción se guardan
en un outbox acotado y se intentan publicar al reconectar. Antes de volver a
aceptar canales, el worker recupera manifest y fragment retained y confirma la
epoch activa.

`WatchdogTask` publica tiempo activo, memoria, métricas por Task y sensores
opcionales. Un error de telemetría no debe detener el motor. `LedTask` es un
diagnóstico genérico de placa y no contiene reglas del modelo HiLeS.

### 7.5 Preparación y despliegue

El paquete canónico se genera desde la raíz:

```powershell
& .\scripts\prepare-pico-deployment.ps1
Get-FileHash .\output\hiles-pico-w-deploy.zip -Algorithm SHA256
Get-Content .\output\hiles-pico-w-deploy.sha256
```

El script incluye `main.py`, `config_local.example.py`, `core/`, `devices/`,
`hiles/`, `platform/`, `pubsub/`, la guía de instalación y
`MANIFEST.sha256.json`. Excluye deliberadamente:

- `config_local.py` y cualquier credencial;
- `umqtt/` y `lib/umqtt/`, porque son dependencias instaladas en la placa;
- `examples/`, `__pycache__/` y archivos `.pyc`;
- cualquier archivo no declarado por el manifiesto.

El generador calcula SHA-256 de cada fuente, verifica el ZIP contra el
manifiesto y crea un checksum del archivo final. Si encuentra
`output/hiles-pico-w-deploy/config_local.py`, se detiene antes de limpiar o
regenerar para no borrar una configuración que alguien dejó allí.

Antes de usar hardware deben pasar:

```powershell
python -m unittest discover -s firmware/tests -t . -v
& .\scripts\prepare-pico-deployment.ps1
& .\scripts\test-pico-provisioning.ps1
```

Las pruebas de escritorio sustituyen reloj, Wi-Fi, GPIO, MQTT y broker por
dobles deterministas. Verifican arquitectura, motor, channels, fragments,
deduplicación, reconexión y aprovisionamiento, pero no prueban radio, memoria
real ni filesystem físico.

#### Instalación inicial

1. Instalar en la placa la versión de MicroPython correspondiente a Pico W o
   Pico 2 W.
2. Instalar `umqtt.simple`.
3. Copiar `main.py`, `core/`, `devices/`, `hiles/`, `platform/` y `pubsub/` del
   paquete, conservando los `__init__.py`.
4. Crear y copiar `config_local.py` con la identidad de esa placa.
5. Reiniciar y observar en consola las tareas activas, Wi-Fi, MQTT y estado del
   worker.

La copia real se hace con Thonny o `mpremote`. Un puerto `COMx` no es una
carpeta y no debe pasarse como `DevicePath`. El volumen `RPI-RP2` con
`INFO_UF2.TXT` es el bootloader para instalar MicroPython, no el filesystem
donde se copia el runtime.

#### Actualización de una placa existente

`scripts/test-distributed-physical.ps1` ofrece `DryRun`, `Inventory`, `Backup`
y `Deploy` para un filesystem accesible. En `Backup` o `Deploy`:

1. crea un respaldo en una ruta nueva;
2. calcula y verifica hashes del respaldo;
3. copia el runtime canónico como una unidad;
4. conserva `config_local.py`, `umqtt/` y `lib/umqtt/`;
5. compara el resultado con las fuentes;
6. elimina solo rutas pasadas explícitamente mediante `-ObsoletePath` y rechaza
   borrar configuración, dependencias o rutas canónicas.

Nunca se debe actualizar una placa sin respaldo ni asumir que
`-AllowNoDevice` constituye una prueba física. Esa opción permite registrar el
pendiente cuando no hay hardware.

#### Verificación después de copiar

- la consola muestra `mqtt`, `led`, `motor`, `watchdog` y `worker_v3`;
- aparece conexión a la IP correcta del broker en `1883`;
- **Ejecutores** muestra `Pico <DEVICE_ID>` dentro del proyecto correcto;
- la placa anuncia IR v2, Python/expresión y capacidades esperadas;
- un bloque asignado recibe ACK positivo;
- **Paso** produce snapshot y, si existe, salida de canal remoto;
- reiniciar restaura el estado inicial;
- desconectar la placa publica `offline` por Last Will o expira su estado;
- `config_local.py` permanece fuera de Git y de cualquier evidencia pública.

### 7.6 Agregar otra placa

Cada placa es un executor independiente. Para agregar una Pico W o Pico 2 W no
se duplica el proyecto ni se crea otro broker: se instala el mismo runtime y se
le entrega una identidad única mediante `config_local.py`.

1. Preparar la placa con MicroPython y `umqtt.simple`.
2. Copiar el mismo paquete canónico descrito en 7.5.
3. Crear un `config_local.py` propio. `DEVICE_ID` no puede repetirse; Wi-Fi,
   broker y `PROJECT_ID` deben apuntar al entorno compartido.
4. Reiniciar la placa y confirmar que aparece como un executor distinto en
   **Ejecutores**.
5. Asignarle elementos desde el frontend, desplegar una nueva epoch y esperar
   su ACK antes de ejecutar.
6. Comprobar que el inventario muestra todas las placas previstas y que cada
   fragment contiene únicamente los elementos asignados a su executor.
7. Ejecutar un modelo con al menos un channel remoto entre dos executors para
   validar ruta, orden, deduplicación y snapshots.

Cambiar una placa física no debe cambiar la semántica del modelo. La Pico W y
la Pico 2 W comparten contrato; cualquier diferencia de hardware se encapsula
en `platform/` o `devices/`. Si una placa no anuncia las capacidades requeridas
por un fragment, el despliegue debe rechazarse en vez de ejecutar parcialmente.

## 8. Flujos de desarrollo

Este capítulo reúne las rutas que se siguen al cambiar el producto. No todos
los cambios atraviesan todas las capas, pero sí deben empezar por una decisión
explícita sobre su alcance:

| Cambio | Capas mínimas |
|---|---|
| Solo presentación | tipos de interfaz, glyph, renderer, estilos y prueba visual |
| Dato persistente del diagrama | tipos, defaults, editor, documento, migración y pruebas de importación |
| Semántica ejecutable | documento, compilador/validador IR, Browser, MicroPython y vectores de conformidad |
| Distribución | particionado, contrato MQTT, frontend, firmware y prueba con más de un executor |
| Colaboración | documento, operaciones, topics, convergencia y prueba con dos navegadores |

La regla principal es mantener una sola fuente de verdad. Una forma visual no
define por sí sola el comportamiento; el documento JSON no contiene estado de
ejecución; y el firmware no debe inventar una semántica diferente a la del
motor Browser.

Antes de editar:

1. escribir el comportamiento observable y los casos de error;
2. decidir si afecta compatibilidad del documento o de la IR;
3. preparar una prueba que falle con el comportamiento actual;
4. implementar desde el contrato compartido hacia cada consumidor;
5. ejecutar las pruebas de las capas tocadas y registrar las limitaciones.

### 8.1 Agregar un componente HiLeS de extremo a extremo

Un componente completo debe poder crearse, verse, configurarse, guardarse,
importarse y —si es ejecutable— producir el mismo resultado en Browser y
MicroPython. Agregarlo solo a la paleta crea un componente aparente, no un
componente HiLeS funcional.

#### Paso 1: definir el contrato

Antes del código se documentan:

- nombre técnico en inglés y categoría;
- puertos de entrada y salida, dirección y cardinalidad;
- propiedades persistentes, valores por defecto y validaciones;
- glyph con el que se reconoce en paleta y canvas;
- regla de ejecución, errores y comportamiento ante entradas ausentes;
- soporte esperado: visual, Browser, MicroPython y distribución.

El identificador técnico debe ser estable. Cambiar después un `type` guardado
en JSON exige una migración; cambiar solamente su etiqueta visible no.

#### Paso 2: incorporarlo al editor

El recorrido actual es:

1. declarar el tipo y sus propiedades en `frontend/src/types/hiles.ts`;
2. agregar el nombre visible en inglés en
   `frontend/src/types/translations.ts`;
3. dibujar el símbolo reutilizable en
   `frontend/src/features/editor/HilesGlyph.tsx`;
4. ubicarlo en su grupo de `Palette.tsx`;
5. renderizar el nodo y sus handles en `CustomNodes.tsx`;
6. definir puertos, tamaño, propiedades y defaults en
   `frontend/src/stores/useEditorStore.ts`;
7. exponer únicamente propiedades editables en `PropertiesPanel.tsx`.

El glyph de la paleta y la figura del canvas deben comunicar la misma forma.
Los handles visibles deben corresponder exactamente con los puertos que guarda
el modelo; un handle decorativo produce conexiones imposibles de compilar.
Si el componente puede vivir dentro de un Structural Block, debe conservar la
relación padre-hijo y coordenadas relativas para que se mueva con el bloque y
se oculte o muestre con su nivel de detalle.

#### Paso 3: persistirlo sin perder modelos anteriores

`frontend/src/domain/modelDocument.ts` normaliza, valida, serializa y migra el
documento. El nuevo componente debe sobrevivir este ciclo:

```text
crear → exportar JSON → cerrar/restaurar → importar JSON → exportar otra vez
```

La segunda exportación debe conservar tipo, ID, posición, parent, puertos y
propiedades relevantes. No se guardan selección, panel abierto, conexión MQTT,
tokens de ejecución ni otros datos transitorios.

Si el componente es opcional y los documentos viejos siguen siendo válidos,
puede conservarse la versión del esquema y aplicarse un default durante la
normalización. Si cambia el significado de datos existentes, se incrementa la
versión y se agrega una migración determinista. Nunca se corrige un documento
silenciosamente perdiendo información.

#### Paso 4: agregar la semántica ejecutable

Para ejecución Browser se implementa o amplía un elemento de
`frontend/src/engine/elementos/` y se registra en el punto de construcción de
`elementos/index.ts`. El elemento debe cumplir el contrato del scheduler:
actualizaciones acotadas, sin esperas bloqueantes y con salidas reproducibles
para la misma entrada y reloj lógico.

Después se actualizan, según corresponda:

- `frontend/src/services/ir/tiposIrV2.ts`, para representar el contrato;
- `compiladorIrV2.ts`, para traducir el documento;
- `validadorIrV2.ts`, para rechazar combinaciones inválidas;
- `particionarIr.ts`, si el componente tiene propietario o canales remotos;
- `firmware/pico/hiles/`, para ejecutar la misma regla en MicroPython.

Si todavía no existe soporte de runtime, el compilador debe emitir un error
claro. No debe convertirlo en otro componente ni omitirlo para que el deploy
parezca exitoso.

#### Paso 5: probar la integración

La evidencia mínima es:

- prueba de defaults y puertos en `useEditorStore.test.ts`;
- prueba de importación/exportación y migración;
- prueba de compilación y validación IR;
- prueba unitaria del elemento Browser;
- prueba equivalente en `firmware/tests`;
- vector compartido cuando el resultado deba ser idéntico entre motores;
- prueba visual de palette, canvas, propiedades y zoom;
- prueba de particionado si cruza executors.

Finalmente se documenta el componente, su forma gráfica y sus restricciones.
La tarea está terminada cuando el componente recorre el flujo completo, no
cuando solamente aparece en pantalla.

### 8.2 Modificar un canal

Un channel lleva valores entre puertos. Puede ser local —productor y consumidor
en el mismo executor— o remoto —cada extremo pertenece a un executor distinto—.
La regla lógica debe ser la misma; MQTT solo reemplaza el transporte interno.

Antes de cambiarlo se especifica:

- qué valores admite y si se copian al entrar o salir;
- capacidad de la cola y política cuando se llena;
- orden garantizado;
- comportamiento sin consumidor, al reconectar y al reiniciar;
- identidad estable de la ruta;
- efecto sobre modelos ya exportados y fragments desplegados.

#### Ruta local

El motor Browser y el runtime MicroPython deben aplicar la misma política de
enqueue/dequeue. Un cambio de capacidad o descarte afecta el resultado del
modelo, por lo que requiere pruebas en ambos motores. No se debe usar una cola
sin límite: en navegador oculta el problema y en una Pico termina agotando
memoria.

#### Ruta remota

`particionarIr.ts` determina qué channels cruzan executors. El compilador debe
asignar una identidad de ruta estable a cada cruce y los fragments deben
coincidir en tipo, productor, consumidor y epoch. El transporte remoto añade
metadatos de secuencia y deduplicación, pero no modifica el valor HiLeS.

Al tocar el protocolo se revisan en conjunto:

- tipos y validador IR v2;
- particionado y manifiesto de despliegue;
- publicación/recepción MQTT en Browser;
- channel y worker en `firmware/pico/hiles/`;
- recuperación después de desconexión;
- mensajes de error y métricas.

Los comandos y valores de channel no se publican retained. Un retained viejo
podría ejecutarse de nuevo tras reconectar. Manifest y fragments sí usan
retained porque describen la versión activa, no una acción efímera.

#### Compatibilidad y prueba

Si cambia la forma del mensaje o la semántica de la cola, se versiona el
contrato. Un receptor debe rechazar una versión desconocida antes de aplicar
el valor. La prueba mínima conecta dos elementos localmente y luego la misma
topología en dos executors; ambas ejecuciones deben producir la misma secuencia
observable. También se prueban duplicado, desorden, cola llena, desconexión,
reconexión y cambio de epoch.

### 8.3 Agregar una propiedad al modelo

Primero se clasifica la propiedad:

| Clase | Ejemplo | ¿Se guarda en el documento? |
|---|---|---|
| Semántica | expresión, valor inicial, capacidad | Sí |
| Presentación estable | etiqueta, color elegido, posición | Sí |
| Interfaz transitoria | selección, hover, panel abierto | No |
| Ejecución | token actual, cola, contador de pasos | No; va en snapshot |
| Conexión o secreto | password, sesión MQTT | No |

Para una propiedad persistente:

1. agregar el campo al tipo correspondiente en `types/hiles.ts`;
2. definir un default explícito en `useEditorStore.ts`;
3. agregar control, ayuda y validación en `PropertiesPanel.tsx`;
4. normalizar y serializar el valor en `modelDocument.ts`;
5. decidir compatibilidad y migración;
6. incluirlo en IR si altera la ejecución;
7. implementarlo en Browser y MicroPython si llega al runtime;
8. probar creación, edición, undo/redo, autosave, exportación e importación.

Un campo opcional no significa “comportamiento indefinido”. Si falta en un
JSON antiguo, la normalización debe producir siempre el mismo default. Para
números se validan finitud y rango; para strings, longitud y formato; para
enumeraciones, únicamente valores conocidos. Un valor inválido genera un
diagnóstico con el elemento y la propiedad afectados.

Se incrementa `schemaVersion` cuando cambia el significado del documento o se
necesita transformar información existente. Agregar un dato opcional con un
default compatible normalmente no lo requiere. La migración debe ser pura,
determinista, repetible y conservar IDs y conexiones.

Como la colaboración transmite cambios del documento, una propiedad
persistente también viajará entre navegadores. Debe verificarse que editarla
remotamente converge y no crea un ciclo de eco. Si el dato es secreto o local,
no debe entrar al documento para empezar.

### 8.4 Modificar la colaboración

La colaboración sincroniza el documento editable, no la pantalla completa de
otro usuario. Antes de introducir un mensaje nuevo se intenta expresar el
cambio con las operaciones existentes sobre nodos, conexiones o metadatos.
Agregar un contrato MQTT es necesario solamente cuando aparece una entidad o
garantía nueva.

#### Diseñar el contrato

1. Definir quién publica y quién consume.
2. Elegir el topic en `projectTopics.ts`, siempre bajo el `projectId`.
3. Declarar el payload y su versión en `projectMessages.ts`.
4. Decidir QoS, retained y expiración.
5. Establecer clave de entidad, orden, deduplicación y regla de conflicto.
6. Definir validación y diagnóstico para mensajes inválidos.

Solo el snapshot/base que permite incorporarse al proyecto se conserva
retained. Presencia, cursor, operaciones y comandos son efímeros. Nunca se
publican credenciales ni estado privado de la interfaz.

#### Aplicar sin crear ecos

`ProjectSyncClient.ts` valida y convierte mensajes MQTT en eventos del dominio.
`useProjectStore.ts` decide cómo incorporarlos al documento. Una operación
remota debe marcarse como remota mientras actualiza el store; de lo contrario,
el subscriber local vuelve a publicarla y crea un eco.

La operación incluye identificadores suficientes para reconocer duplicados.
El orden lógico no debe depender de la hora del computador. Cuando dos usuarios
editan la misma entidad, la regla de resolución debe ser determinista; cuando
editan entidades distintas, ambos cambios deben conservarse.

Todo payload se valida antes de tocar Zustand. Un mensaje con versión, tipo,
ID o estructura desconocidos se ignora y se registra; no se aplica a medias.

#### Verificar con dos navegadores

Primero se agregan pruebas unitarias de serialización, validación,
deduplicación, orden y conflicto. Después se ejecuta la prueba de colaboración
con broker real:

```powershell
node .\scripts\test-project-collaboration.mjs
```

La revisión manual usa dos sesiones o navegadores con nombres diferentes:

1. abrir la misma URL con `?project=<id>`;
2. esperar presencia de ambos participantes;
3. crear, mover, editar y eliminar entidades alternando navegadores;
4. hacer ediciones simultáneas en entidades distintas y luego en la misma;
5. desconectar uno, editar con el otro y reconectarlo;
6. recargar ambos y comparar documento exportado.

El resultado correcto no es solo “se ve igual”: ambos clientes deben terminar
con el mismo documento canónico, sin IDs duplicados, conexiones huérfanas ni
operaciones repetidas. Los topics retained de proyectos de prueba se limpian
al terminar para no contaminar ejecuciones posteriores.

### 8.5 Modificar el firmware

El firmware es una implementación del contrato compartido bajo restricciones
de MicroPython. No es un segundo producto con reglas propias. Un cambio que
afecta semántica ejecutable comienza con un caso observable común y termina
cuando Browser y MicroPython pasan la misma expectativa.

#### Implementación segura

- conservar dependencias entre módulos en una sola dirección;
- encapsular reloj, Wi-Fi, MQTT, GPIO y filesystem detrás de adaptadores;
- evitar threads y esperas largas; cada Task debe devolver el control;
- acotar colas, buffers, fragments y reintentos;
- no capturar excepciones sin publicar un diagnóstico útil;
- mantener `config_local.py` fuera del repositorio y del paquete;
- no usar APIs de CPython que MicroPython no proporciona.

Cuando se agrega un elemento o mensaje, primero se actualiza el contrato IR o
MQTT y el validador. El runtime debe rechazar versiones y capacidades que no
entiende antes de reemplazar el fragment activo. La instalación de una nueva
epoch sigue siendo atómica: validar, verificar hash, construir, reemplazar y
enviar ACK.

#### Pruebas sin placa

La mayor parte se valida en el computador con los dobles de `firmware/tests`:

```powershell
python -m unittest discover -s firmware/tests -t . -v
& .\scripts\prepare-pico-deployment.ps1
& .\scripts\test-pico-provisioning.ps1
```

Las pruebas deben cubrir camino correcto, payload inválido, duplicado,
reconexión, memoria/cola al límite y recuperación tras error. Si el cambio toca
un elemento HiLeS, se añade o actualiza su vector compartido y se ejecuta en
ambos motores.

El paquete generado, no una carpeta armada manualmente, es el artefacto que se
entrega. Se verifica su manifiesto y SHA-256. Los cambios de código no se copian
directamente sobre una placa sin regenerar el paquete, porque eso impide saber
qué versión quedó instalada.

#### Prueba física

La prueba de escritorio no sustituye hardware. Cuando haya una Pico disponible:

1. respaldar su filesystem y verificar hashes;
2. desplegar el paquete conservando `config_local.py` y `umqtt`;
3. comprobar arranque, Wi-Fi, broker, inventario y capacidades;
4. desplegar un fragment y confirmar ACK, step y snapshot;
5. probar desconexión y reconexión;
6. observar memoria y estabilidad durante varios ciclos;
7. registrar placa, versión, comandos, resultado y limitaciones.

Si no hay hardware, el cambio puede quedar validado en escritorio, pero se
documenta explícitamente que la prueba física está pendiente. No se declara
compatibilidad física basándose únicamente en mocks.

### 8.6 Lista de cierre para cualquier cambio

Antes de solicitar integración se confirma:

- [ ] El comportamiento y los errores están descritos.
- [ ] Los nombres técnicos permanecen en inglés y son estables.
- [ ] El documento JSON anterior sigue abriendo o tiene migración.
- [ ] Browser y MicroPython conservan paridad cuando aplica.
- [ ] La IR y los mensajes rechazan versiones desconocidas.
- [ ] No se persisten secretos ni estado transitorio.
- [ ] Las colas, payloads y reintentos tienen límites.
- [ ] Las pruebas de las capas modificadas pasan.
- [ ] Se verificó importación/exportación y colaboración cuando aplica.
- [ ] Se actualizó documentación y registro de cambios.
- [ ] Se anotó cualquier prueba física pendiente.

## 9. Pruebas y control de calidad

### 9.1 Pirámide de pruebas

Las pruebas se organizan por costo y por cantidad de dependencias externas. Una
prueba de nivel superior complementa a las inferiores; no las reemplaza.

| Nivel | Qué demuestra | Ejemplos del repositorio |
|---|---|---|
| Unidad | Una función, elemento o store cumple su contrato | Vitest en `frontend/src/**/*.test.ts`; unittest en `firmware/tests/` |
| Integración local | Varias capas trabajan juntas sin red física | motor + IR, store + documento, scheduler + transporte falso |
| Conformidad | Browser y MicroPython interpretan igual un contrato | vectores de `docs/mqtt/vectores_ir_v2/` |
| Distribuida en memoria | Particionado, fragments y workers sin broker | `test-distributed-mqtt.mjs --mode=memory` |
| MQTT real | Topics, retained, QoS, credenciales y reconexión reales | scripts de colaboración, cuatro clientes y distribución MQTT |
| Visual/manual | Interacción, responsive, zoom, paneles y accesibilidad | dos navegadores, PC, tablet o móvil |
| Física | Radio, memoria, filesystem y hardware reales | Pico W/Pico 2 W y `test-distributed-physical.ps1` |

La mayor parte de los casos debe quedar en unidad e integración porque son
rápidos y deterministas. La red real se reserva para contratos MQTT y la placa
para aquello que no puede simularse: Wi-Fi, memoria efectiva, GPIO, reinicio y
filesystem de MicroPython.

Al corregir un defecto se agrega primero el caso mínimo que lo reproduce. Si
el fallo cruzó capas —por ejemplo, JSON → IR → firmware— se conserva además
una prueba en la frontera donde debió detectarse.

### 9.2 Comandos del frontend

Desde la raíz del repositorio:

```powershell
cd frontend
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build
```

`test:run` ejecuta Vitest una vez y devuelve un código de salida. `lint` revisa
reglas de TypeScript, React y Hooks. `build` ejecuta TypeScript y produce el
bundle de Vite; detecta imports, tipos o recursos que una prueba aislada puede
no alcanzar.

Durante el desarrollo se puede ejecutar un archivo concreto:

```powershell
cd frontend
npm.cmd run test:run -- src/stores/useEditorStore.test.ts
```

Antes de integrar se ejecuta siempre la suite completa, lint y build. Que Vite
arranque no demuestra que el build de producción compile, y que compile no
demuestra que la semántica sea correcta.

Para una revisión visual:

```powershell
cd frontend
npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Se comprueban al menos creación y conexión de componentes, propiedades,
importación/exportación, undo/redo, zoom, Structural Blocks, paneles, tamaño
móvil y recarga. Si el cambio afecta colaboración, se usan dos sesiones con la
misma URL de proyecto.

### 9.3 Pruebas del firmware

Las pruebas del firmware están escritas para ejecutarse desde un Python de
escritorio. Sustituyen reloj, GPIO, Wi-Fi, cliente MQTT y transporte por fakes,
pero importan el código real de `firmware/pico/`.

Desde la raíz:

```powershell
python -m unittest discover -s firmware/tests -t . -v
```

`-s` indica dónde descubrir archivos `test_*.py`; `-t .` mantiene la raíz como
directorio superior de imports; `-v` muestra cada caso. El resultado aprobado
termina con `OK` y código de salida cero. Si `python` no está en `PATH`, se usa
el ejecutable instalado conservando los mismos argumentos.

La suite cubre scheduler, bus interno, LED, watchdog, MQTT, valores runtime,
channels, expresiones, Python restringido, motores IR v1/v2, worker distribuido,
paridad y herramientas de flota. Un módulo nuevo debe traer su prueba; no se
crean archivos vacíos para aparentar cobertura.

Después de cambiar el runtime o el empaquetado se ejecuta también:

```powershell
& .\scripts\prepare-pico-deployment.ps1
& .\scripts\test-pico-provisioning.ps1
```

El primer script genera el ZIP y sus hashes. El segundo despliega sobre un
filesystem temporal y demuestra que se preservan configuración y dependencias.
Ninguno demuestra todavía que el cambio funcione sobre radio o memoria física.

### 9.4 Pruebas distribuidas

Las pruebas se ejecutan en orden creciente de costo.

#### Sin broker

```powershell
node .\scripts\test-distributed-mqtt.mjs --mode=memory
```

El modo `memory` valida compilación, particionado, manifest, fragments, workers
y channels remotos con transporte en memoria. Es la primera comprobación para
un cambio distribuido.

#### Con Mosquitto real

Requiere broker activo y `frontend/.env.local` válido:

```powershell
node .\scripts\test-mqtt-four-clients.mjs
node .\scripts\test-project-collaboration.mjs
node .\scripts\test-distributed-mqtt.mjs --mode=mqtt --timeout=12000
```

Estas pruebas validan respectivamente entrega a cuatro clientes, convergencia
de colaboración y ejecución distribuida sobre topics reales. Los executors
`pico:*` del runner MQTT son dobles en Node.js; el broker es real, la placa no.

Cada ejecución debe usar un proyecto de prueba aislado y limpiar retained al
terminar. Si una prueba falla, se conserva el primer error y se revisan logs del
broker antes de repetir; aumentar el timeout no corrige credenciales, topics o
un listener incorrectos.

#### Procedimiento físico

Sin una placa se puede validar el flujo sin escribir un dispositivo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\test-distributed-physical.ps1 -Mode DryRun -AllowNoDevice
```

Con hardware se ejecutan `Inventory`, `Backup` y luego `Deploy` sobre un
filesystem válido, nunca sobre `COMx` ni sobre el volumen bootloader `RPI-RP2`.
Después se repite el escenario desde la interfaz y se recopilan ACK, snapshots,
estado de executors y consola serie.

### 9.5 Evidencia mínima antes de integrar

La evidencia debe permitir a otra persona repetir la comprobación. El registro
incluye:

1. rama y commit o estado local probado;
2. entorno relevante: Windows, Node, navegador, Python, broker y placa;
3. comandos exactos ejecutados;
4. resultado: cantidad de tests, `OK`, build completado o error observado;
5. escenario manual y comportamiento esperado/obtenido;
6. capturas únicamente cuando el resultado sea visual;
7. pruebas omitidas y motivo, por ejemplo “sin Pico física”;
8. riesgos o limitaciones restantes.

No se aceptan como evidencia “funciona” o una captura sin pasos. Tampoco se
pegan `.env.local`, contraseñas, `config_local.py`, tokens ni contenido de
respaldos. Los resultados se registran en el archivo de cambios de la entrega
siguiendo su estructura existente.

Un cambio puede integrarse con una prueba física pendiente si el alcance y la
limitación quedan explícitos y las capas simulables pasaron. No puede marcarse
como físicamente validado.

## 10. Git y flujo de contribución

### 10.1 Antes de empezar

El repositorio suele trabajarse sobre una rama compartida de entrega. Antes de
editar se identifica la rama y se separa lo propio de lo ajeno:

```powershell
git branch --show-current
git status --short --branch
git remote -v
git fetch origin
```

Después de `fetch`, se revisa qué llegó antes de incorporarlo:

```powershell
git log --oneline HEAD..origin/<rama>
git diff --stat HEAD..origin/<rama>
```

Si el working tree está limpio y la rama remota solo avanzó linealmente:

```powershell
git pull --ff-only origin <rama>
```

`--ff-only` evita crear un merge accidental. Si hay cambios locales, primero
se inspeccionan; no se usa `reset --hard`, `clean`, `checkout -- .` ni se
sobrescriben archivos para “igualar Git”. Los archivos sin seguimiento también
pueden pertenecer a otra persona y no deben agregarse al commit por comodidad.

Si se necesita apartar trabajo propio, se puede crear un commit temporal o un
stash con mensaje después de revisar exactamente qué incluirá. Un stash con
`-u` incorpora archivos sin seguimiento, así que se usa solo si se conocen.

### 10.2 Durante el cambio

Cada cambio debe tener un objetivo reconocible. Antes de editar se buscan las
referencias y pruebas del contrato con `rg`; luego se modifica la fuente de
verdad y sus consumidores, no copias aisladas.

Reglas de trabajo:

- mantener nombres técnicos en inglés y textos explicativos en español;
- no reformatear archivos ajenos sin necesidad;
- no mezclar una funcionalidad, una limpieza general y documentación no
  relacionada en el mismo commit;
- agregar pruebas cerca de la capa que cambia;
- conservar compatibilidad o incluir migración/versionado;
- revisar `git status` con frecuencia para detectar archivos generados;
- no añadir `node_modules`, `dist`, `.env.local`, secretos ni outputs locales;
- actualizar manual y registro cuando cambie un contrato o procedimiento.

En una rama compartida se vuelve a hacer `fetch` antes de cerrar el cambio. Si
el remoto avanzó, se integra de forma consciente y se repiten las pruebas sobre
el resultado combinado.

### 10.3 Commit y push

Antes del commit:

```powershell
git status --short
git diff --check
git diff --stat
git diff -- <archivo>
```

Se agregan rutas explícitas. Evitar `git add .` cuando existen archivos ajenos
o sin seguimiento:

```powershell
git add -- ruta/al/archivo1 ruta/al/archivo2
git diff --cached --check
git diff --cached --stat
git diff --cached
```

El mensaje se escribe en español, en imperativo o infinitivo descriptivo y sin
frases genéricas como “cambios”:

```powershell
git commit -m "Documentar pruebas y diagnóstico del proyecto"
```

Antes de publicar se confirma otra vez la rama. El push siempre la nombra para
evitar enviar a `main` por error:

```powershell
git branch --show-current
git push origin <rama>
```

Finalmente:

```powershell
git status --short --branch
git log -1 --oneline
git rev-parse HEAD
git rev-parse origin/<rama>
```

Los dos últimos hashes deben coincidir si el push quedó actualizado. Si el
remoto rechaza por avance de otra persona, no se fuerza: se hace `fetch`, se
revisa la diferencia, se integra y se vuelve a validar.

### 10.4 Registro de cambios

Cada entrega conserva su propio plan y registro bajo `entregas/`. Se sigue la
estructura ya usada por el equipo para que todos los aportes sean comparables.
Una entrada debe indicar:

- responsable con nombre completo;
- tarea o persona del plan reemplazada por el nombre cuando corresponda;
- objetivo y comportamiento entregado;
- archivos principales modificados;
- decisiones técnicas y compatibilidad;
- comandos de prueba y resultados;
- prueba manual o física realizada;
- limitaciones y pendientes reales;
- hash y mensaje del commit después de crearlo.

El registro no sustituye el historial Git ni el manual. Git responde qué línea
cambió; el registro explica por qué, cómo se verificó y qué quedó fuera. Si el
commit todavía no existe, se deja el campo por completar y se actualiza luego,
sin inventar un hash.

## 11. Seguridad y configuración sensible

### 11.1 Secretos excluidos

Los siguientes datos nunca entran al repositorio, documento JSON colaborativo,
topics retained, URL, capturas ni registros:

- SSID y contraseña Wi-Fi;
- usuario y contraseña MQTT;
- certificados y claves privadas;
- `frontend/.env.local`;
- `config_local.py` de cada placa;
- archivos de contraseñas de Mosquitto;
- respaldos de filesystem de las Picos;
- tokens, cookies o datos personales de una sesión.

Se versionan únicamente plantillas como `.env.example` y
`config_local.example.py`, con valores ficticios. Antes de un commit:

```powershell
git status --short
git check-ignore -v frontend/.env.local
git check-ignore -v firmware/pico/config_local.py
git diff --cached
```

Si un secreto llegó a un commit o remoto, borrarlo en otro commit no lo elimina
del historial. Se revoca o cambia inmediatamente la credencial, se avisa al
equipo y después se coordina la limpieza del historial si hace falta.

El generador de `config_local.py` produce una descarga local y no guarda la
contraseña en Zustand, localStorage ni MQTT. Un respaldo de placa se trata como
secreto porque puede contener el mismo archivo.

### 11.2 Límites de la LAN

El perfil Local/LAN usa:

- Vite por HTTP, normalmente puerto `5173`;
- MQTT/TCP para Picos, normalmente `1883`;
- MQTT sobre WebSocket para navegadores, normalmente `ws://<ip>:9001`.

Este perfil solo es aceptable en una red de laboratorio confiable, con
autenticación y firewall limitado a la LAN. `ws://` no cifra usuario,
contraseña ni mensajes. No se deben abrir `1883`, `9001` o `5173` hacia
Internet mediante port forwarding.

Para acceso remoto se requiere un broker configurado con TLS, cuentas por rol,
ACL por topics, certificados válidos y WebSocket seguro `wss://`. La interfaz
permite configurar ese perfil, pero el despliegue remoto seguro no ha sido
certificado por esta entrega. Una VPN administrada puede extender la LAN, pero
no reemplaza autenticación ni ACL.

Las credenciales usadas en el frontend son visibles para quien controla ese
navegador; por eso deben ser cuentas de aplicación con privilegios mínimos, no
credenciales administrativas del broker.

### 11.3 Código Python del modelo

Un Functional Block puede usar el perfil Python acotado de IR v2. Se admite una
expresión de una línea o una única función `def calcular(...)` con:

- asignaciones y variables locales;
- `if`, `elif`, `else` y `return`;
- operadores aritméticos, booleanos y comparaciones;
- indexación y slicing;
- `inputs.get(...)`;
- builtins permitidos como `abs`, `bool`, `float`, `int`, `len`, `max`, `min`,
  `round`, `str` y `sum`.

Se rechazan imports, bucles, clases, lambdas, async, excepciones, atributos
generales, nombres `__dunder__`, archivos, red, hardware, `eval` y `exec`.
El código se limita a 2 048 bytes y 40 líneas, con hasta 16 inputs y 16 outputs.
Los valores también respetan los límites de IR v2 descritos en 5.5.

Una salida puede devolverse directamente. Varias salidas usan un diccionario
con las claves declaradas. `None` significa no publicar en ese paso.

La misma validación sintáctica y de valores se ejecuta antes del despliegue y
en MicroPython. Los vectores de conformidad comprueban errores y resultados en
ambos motores. Este perfil reduce superficie de fallo, pero no es un sandbox
criptográfico para ejecutar código hostil. Solo se aceptan modelos de usuarios
autorizados y el runtime mantiene presupuestos de tamaño y tiempo.

## 12. Diagnóstico y recuperación

### 12.1 El frontend no inicia

Comprobar en este orden:

1. estar en `frontend/` y verificar `node --version` y `npm.cmd --version`;
2. instalar exactamente el lockfile con `npm.cmd ci`;
3. iniciar con `npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort`;
4. leer el primer error completo de terminal;
5. comprobar si el puerto está ocupado:

   ```powershell
   Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
   ```

En PowerShell, el error “`npm.ps1` no se puede cargar” proviene de la política
de scripts, no del proyecto. Usar `npm.cmd` evita modificar la política del
sistema.

Si falla un import, no se borra `package-lock.json`: `npm.cmd ci` debe restaurar
la combinación versionada. Si la página abre en blanco, revisar consola del
navegador y el Error Boundary. Borrar datos del sitio elimina autosave y nombre
local, por lo que antes se exporta el modelo si es recuperable.

### 12.2 El navegador no conecta a MQTT

Separar primero Vite de MQTT: que cargue la interfaz solo demuestra HTTP. En el
panel **Conexión** revisar modo, host, puerto WebSocket, ruta, usuario y
contraseña. El navegador usa WebSocket, no el puerto MQTT/TCP de las Picos.

Comprobaciones:

1. confirmar que Mosquitto está ejecutándose;
2. verificar que escucha WebSocket en el puerto configurado, normalmente 9001;
3. usar la IPv4 LAN del PC, no `localhost`, desde otro dispositivo;
4. probar alcance del puerto:

   ```powershell
   Test-NetConnection <ip-del-pc> -Port 9001
   ```

5. revisar firewall de Windows y logs del broker;
6. confirmar usuario/contraseña y que el listener permite esa cuenta;
7. usar `ws://` para LAN HTTP o `wss://` cuando la página/broker sean seguros.

Un error de “mixed content” aparece si una página HTTPS intenta abrir `ws://`;
en ese caso se necesita `wss://`. Si cambió la IPv4 del PC, actualizar
`.env.local`, el panel y los `config_local.py` de las placas.

### 12.3 Dos navegadores no colaboran

Ambos deben abrir exactamente el mismo `projectId` en la URL y conectarse al
mismo broker con permisos sobre los mismos topics. El nombre visible identifica
al participante, pero no selecciona el proyecto.

1. comparar el valor de `?project=` en ambas URLs;
2. comprobar estado MQTT conectado y presencia de ambos nombres;
3. abrir DevTools y buscar rechazo de mensajes o desconexión;
4. crear una entidad pequeña y observar si aparece en la otra sesión;
5. recargar el segundo navegador para comprobar el snapshot retained;
6. ejecutar `node .\scripts\test-project-collaboration.mjs`.

Si una sesión nueva recibe un modelo viejo, puede existir un retained de una
prueba anterior con el mismo `projectId`. Usar un ID nuevo o limpiar los topics
de prueba. No se corrige borrando localStorage de todos los usuarios sin
exportar antes: podría eliminar la única copia local de un modelo.

Si los participantes aparecen pero los cambios no convergen, revisar versión
del protocolo, IDs duplicados, deduplicación y regla de conflicto, no la red.

### 12.4 La Pico no aparece

La Pico necesita Wi-Fi de 2.4 GHz, acceso MQTT/TCP y coincidencia exacta de
proyecto. Revisar la consola serie desde el arranque y luego:

1. validar SSID y contraseña en su `config_local.py`;
2. comprobar que `MQTT_HOST` es la IPv4 LAN del PC, nunca `localhost`;
3. comprobar puerto TCP, normalmente 1883, usuario y contraseña;
4. comparar `HILES_PROJECT_ID` con `?project=`;
5. confirmar `DEVICE_ID` y `MQTT_CLIENT_ID` únicos;
6. revisar en Mosquitto conexión, suscripciones y publicación de estado;
7. esperar más de un periodo de heartbeat y refrescar **Ejecutores**.

Si encender una placa hace desaparecer otra, ambas usan el mismo client ID. Si
aparece `offline`, el Last Will se publicó o el heartbeat expiró: revisar
reinicios, alimentación, Wi-Fi y keepalive. Si no aparece ni online ni offline,
la conexión o el topic/proyecto son incorrectos.

Una Pico puede estar conectada al broker y no ser compatible con un fragment.
En ese caso sí aparece en inventario, pero sus capacidades o versión impedirán
el despliegue.

### 12.5 El modelo no despliega

El despliegue tiene cuatro fronteras; se diagnostican en orden:

1. **Documento:** no debe tener referencias, Ports o conexiones inválidas.
2. **Compilación IR:** revisar diagnósticos por ciclo CCH, código no soportado,
   tipo, delay, capacidad o límites.
3. **Particionado:** cada elemento ejecutable necesita exactamente un executor
   disponible; revisar herencia y overrides de Structural Blocks.
4. **Entrega:** manifest y fragments deben publicarse y cada executor debe
   responder ACK para la misma `deploymentId` y epoch.

Un ACK negativo debe mostrar código y etapa. Revisar tamaño/hash, ownership,
capacidad, versión IR, perfil Python y rutas remotas. La ausencia de ACK indica
conectividad, topic, executor desconectado o timeout; no es equivalente a un
rechazo.

No se pulsa ejecutar si faltan ACK. Si una nueva epoch falla, los workers deben
conservar el fragmento anterior; revisar su snapshot permite confirmar que no
se activó una mezcla. Para aislar la red, ejecutar primero:

```powershell
node .\scripts\test-distributed-mqtt.mjs --mode=memory
```

Si pasa en memoria y falla en MQTT, concentrarse en broker, retained,
credenciales, tamaño de payload y tiempos, no en la semántica del motor.

### 12.6 Recuperar un cambio de Git

Primero detener ediciones y capturar el estado:

```powershell
git status --short --branch
git diff
git diff --cached
git log -5 --oneline
git reflog -10
```

No ejecutar limpieza o reset mientras no se identifique qué se quiere
recuperar. Opciones seguras:

- **Archivo modificado sin commit:** copiarlo fuera del repositorio o crear un
  patch con `git diff -- ruta > cambio.patch` antes de restaurar.
- **Commit perdido al cambiar de rama:** localizarlo en `git reflog` y crear
  una rama de rescate: `git branch rescate/<nombre> <hash>`.
- **Archivo de otro commit:** inspeccionarlo con
  `git show <hash>:ruta/al/archivo` antes de usar
  `git restore --source=<hash> -- ruta/al/archivo`.
- **Cambios propios que bloquean un pull:** crear un commit temporal o
  `git stash push -m "respaldo antes de actualizar"` después de revisar el
  contenido. Usar `-u` solo si también se quieren guardar archivos nuevos.
- **Conflicto:** abrir cada archivo, conservar la combinación correcta, quitar
  marcadores, ejecutar pruebas y luego marcarlo resuelto con `git add`.

`git reset --hard` y `git clean -fd` pueden borrar trabajo sin seguimiento o
no publicado. No forman parte del procedimiento normal. Un commit ya subido a
una rama compartida se corrige con un nuevo commit; no se fuerza ni reescribe
sin coordinación explícita del equipo.

## 13. Glosario técnico

| Término | Significado en este proyecto |
|---|---|
| **HiLeS** | Formalismo híbrido usado para modelar estructura, procesamiento, flujo de datos y comportamiento Petri. |
| **Canvas** | Área de edición visual basada en React Flow donde se ubican componentes y conexiones. |
| **Structural Block** | Contenedor jerárquico que agrupa lógica interna, mueve a sus hijos y controla su nivel de detalle. No ejecuta una transformación por sí solo. |
| **Functional Block** | Elemento ejecutable que transforma inputs en outputs mediante expresión o código Python restringido; JavaScript solo tiene soporte local heredado. |
| **Service** | Elemento de interfaz del modelo con Ports de entrada o salida que representa interacción con el entorno. |
| **Place** | Nodo de Petri que contiene tokens y puede limitar su capacidad. |
| **Transition** | Nodo de Petri que consume y produce tokens atómicamente cuando arcos y condición la habilitan. |
| **Port** | Punto tipado de entrada o salida de Service o Functional Block. Tiene identidad estable dentro del elemento. |
| **CCH** | Continuous Channel. Conserva y propaga la última muestra disponible. |
| **DCH** | Discrete Event Channel. Cola FIFO acotada de eventos discretos. |
| **LCH** | Logical Channel. Pulso booleano válido durante un solo paso. |
| **Petri arc** | Conexión dirigida Place ↔ Transition con peso entero para flujo de tokens. |
| **Sample** | Elemento que captura el valor de entrada cuando recibe la señal de muestreo. |
| **Hold** | Elemento que conserva el último valor capturado hasta una actualización válida. |
| **Documento de modelo** | JSON persistente y colaborativo con esquema, elementos, conexiones y metadata; no contiene estado runtime ni secretos. |
| **IR** | Intermediate Representation. Contrato ejecutable validado que resulta de compilar el documento. La distribución usa IR v2. |
| **Compiler** | Convierte documento a IR, normaliza detalles visuales y produce diagnósticos; no ejecuta el modelo. |
| **Validator** | Rechaza estructuras, tipos, límites o referencias inválidas antes de ejecutar o desplegar. |
| **Logical clock** | Tiempo controlado por el motor para delays reproducibles sin bloquear el proceso. |
| **Runtime snapshot** | Vista serializable del estado de ejecución: valores, tokens, colas, reloj y errores observables. |
| **Executor** | Destino que posee y ejecuta elementos: una sesión Browser o una Pico identificada de forma única. |
| **BrowserWorker** | Executor dentro de una pestaña del navegador para un fragment asignado a esa sesión. |
| **DistributedWorker** | Task del firmware que recibe manifest/fragments, valida, ejecuta y publica estado, ACK y snapshots. |
| **Assignment** | Decisión persistente que relaciona un elemento o Structural Block con un executor. |
| **Partitioning** | División determinista de una IR en fragments por propietario y rutas remotas. |
| **Manifest** | Mensaje retained que describe deployment, epoch, executors y hashes esperados de sus fragments. |
| **Fragment** | Parte de la IR destinada a un executor, con modelo local y rutas inbound/outbound. |
| **Remote route** | Contrato de un channel que cruza dos executors e incluye identidad, tipo, secuencia y epoch. |
| **ACK** | Acknowledgement. Respuesta positiva o negativa de un executor al validar y activar un fragment. |
| **Epoch** | Número de versión monotónico dentro de un deployment; evita mezclar mensajes de despliegues distintos. |
| **deploymentId** | Identificador de una publicación coordinada de manifest y fragments. |
| **projectId** | Identificador compartido en URL y topics que aísla modelo, presencia y ejecución de un proyecto. |
| **sessionId** | Identificador temporal de una pestaña o participante; no reemplaza `projectId`. |
| **MQTT topic** | Ruta jerárquica usada para publicar y suscribirse a mensajes. |
| **QoS** | Nivel de entrega MQTT. QoS 1 puede duplicar mensajes y exige deduplicación. |
| **Retained** | Mensaje que el broker conserva como último estado del topic y entrega a nuevos suscriptores. No se usa para comandos. |
| **Last Will** | Mensaje configurado al conectar que el broker publica si el cliente desaparece inesperadamente. |
| **Heartbeat** | Publicación periódica de presencia/estado que permite detectar expiración. |
| **Deduplication** | Rechazo de una operación o mensaje ya aplicado mediante su identidad y ventana acotada. |
| **Lamport clock** | Contador lógico usado para ordenar operaciones colaborativas sin depender de la hora del PC. |
| **Broker** | Servidor MQTT —Mosquitto en el entorno local— que enruta mensajes; no ejecuta HiLeS. |
| **Vite** | Herramienta que sirve y construye el frontend; no reemplaza al broker MQTT. |
| **MicroPython** | Implementación ligera de Python usada por la Pico; no ofrece toda la API de CPython. |
| **Pico W / Pico 2 W** | Placas soportadas por el mismo runtime, diferenciadas por configuración e identidad. |

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

Este borrador cubre el recorrido completo del sistema y queda listo para
revisión técnica. Se considerará aprobado cuando una persona que no haya
trabajado en el proyecto pueda:

1. Ejecutar HiLeS Web en un PC limpio.
2. Conectar un segundo navegador por LAN.
3. Identificar el módulo responsable de un comportamiento.
4. Implementar un cambio pequeño con su prueba.
5. Entender cómo el modelo pasa de JSON a IR y a fragments.
6. Preparar una Pico sin publicar secretos.
7. Diagnosticar un fallo básico usando únicamente este manual y sus enlaces.

La revisión debe anotar comandos o pantallas que hayan cambiado y corregir la
fuente de verdad además del manual. Cada cambio futuro de arquitectura,
protocolo, instalación o seguridad debe actualizar la sección correspondiente
en el mismo commit.
