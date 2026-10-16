# HiLeS Web

Editor y simulador web de modelos HiLeS con integración MQTT para Raspberry Pi Pico W.

El proyecto permite construir circuitos gráficamente, configurar sus elementos y conexiones, ejecutar el motor de simulación en el navegador e intercambiar entradas y estados con dispositivos externos mediante Mosquitto. La aplicación actual es un frontend autónomo: **este repositorio ya no contiene ni requiere un backend NestJS, Prisma o PostgreSQL**.

## Estado actual

Actualmente están implementados:

- editor visual de diagramas HiLeS;
- motor local de simulación escrito en TypeScript;
- redes de Petri con `Place`, `Transition`, pesos, capacidades y detección de conflictos;
- propagación de datos por canales continuos y eventos discretos;
- elementos `Structural Block`, `Functional Block`, `Service`, `Sample` y `Hold`;
- código JavaScript y Python en `Functional Block` con ejecución aislada;
- importación, exportación, migración y autoguardado de modelos JSON;
- cliente MQTT sobre WebSockets en la aplicación;
- integración de entradas MQTT con elementos `Service`;
- comunicación física web → Mosquitto → Pico W → web;
- control y confirmación del LED integrado de la Pico W;
- reconexión básica de la web, Wi-Fi y MQTT;
- contrato e IR v1 compartidos entre TypeScript y MicroPython;
- motor HiLeS MicroPython con ejecución cooperativa y deduplicación QoS 1;
- modo remoto web que aplica las instantáneas oficiales al canvas;
- modelo de cruce coordinado Norte–Sur / Este–Oeste.

El runtime MicroPython ya ejecuta el subconjunto IR v1 formado por `Service`, `Functional Block`, `Place` y `Transition`. En modo remoto, la web no recalcula el circuito: publica el modelo y los comandos, y representa las instantáneas emitidas por `EngineTask`. Esta integración está validada con dobles de escritorio; aún falta medirla y ensayarla en una Pico W física.

## Arquitectura

### Simulación local

```text
Editor React
    │
    ▼
MotorSimulacion TypeScript
    ├── propagación CCH/DCH
    ├── BusObserver
    ├── evaluación de Functional Blocks
    └── red de Petri y movimiento de tokens
```

### Integración física MQTT

```text
Aplicación HiLeS
    │ MQTT sobre WebSockets · puerto 9001
    ▼
Mosquitto local
    │ MQTT sobre TCP · puerto 1883
    ▼
Raspberry Pi Pico W + MicroPython
```

La web y la Pico no se conectan directamente. Ambas son clientes de Mosquitto y se comunican mediante topics y objetos JSON validados.

## Tecnologías

- React 19 y TypeScript 6.
- Vite 8.
- React Flow para el editor gráfico.
- Zustand para el estado del editor y la simulación.
- Vitest y ESLint.
- CodeMirror para editar código de los bloques funcionales.
- Web Workers para aislar la ejecución de código.
- Pyodide incluido localmente para ejecutar Python en el navegador.
- MQTT.js para MQTT sobre WebSockets.
- Eclipse Mosquitto como broker.
- MicroPython y `umqtt.simple` para Raspberry Pi Pico W.

## Estructura del repositorio

```text
HiLeS_WEB/
├── frontend/                       Aplicación React y motor local
│   ├── public/pyodide/             Runtime Python servido localmente
│   └── src/
│       ├── domain/                 Documento y migración del modelo
│       ├── engine/                 Motor, elementos, Petri y propagación
│       ├── features/editor/        Canvas, paleta y propiedades
│       ├── features/simulation/    Panel del motor local
│       ├── features/mqtt/          Panel de conexión MQTT
│       ├── services/mqtt/          Cliente, contrato y puente con Services
│       ├── stores/                 Estado del editor y la simulación
│       └── workers/                Ejecución aislada de JavaScript/Python
├── firmware/                       Código reutilizable de la Raspberry Pi Pico W
│   ├── pico/                       Programa y ejemplos MicroPython
│   └── tests/                      Pruebas de escritorio y dobles de hardware
├── infrastructure/
│   └── mosquitto/                  Configuración y guía del broker
├── docs/
│   ├── architecture/               Arquitectura permanente del proyecto
│   └── mqtt/                       Contrato y ficha de conexión vigentes
├── output/                         Modelos JSON de ejemplo
├── entregas/
│   ├── entrega-2-18-septiembre/    Documentación histórica del editor
│   ├── entrega-3-26-septiembre/    Documentación histórica del motor
│   ├── entrega-4-9-octubre/        Planes e informes históricos de MQTT
│   └── entrega-5-13-octubre/       Plan e informes de la ejecución en Pico
└── README.md
```

## Requisitos

Para utilizar solamente el editor y el motor local:

- Git 2.40 o superior.
- Node.js 22 LTS.
- npm.
- Un navegador moderno con soporte para Web Workers.

Para la integración física también se necesita:

- Eclipse Mosquitto 2.x.
- Raspberry Pi Pico W con MicroPython.
- Thonny u otra herramienta para copiar archivos a la placa.
- La librería `umqtt.simple` instalada en la Pico.
- Todos los equipos en una red que permita comunicación directa, o un broker MQTT accesible desde sus redes.

No se necesita PostgreSQL, Prisma ni un servidor backend.

## Inicio rápido

Clonar el repositorio e instalar las dependencias del frontend:

```powershell
git clone https://github.com/KevMasMas/HiLeS_WEB.git
cd HiLeS_WEB\frontend
npm ci
npm run dev
```

Vite mostrará la dirección local, normalmente:

```text
http://localhost:5173/
```

No es necesario iniciar Mosquitto ni conectar la Pico para editar modelos o utilizar el motor local.

Para permitir que otros computadores de la misma red abran la aplicación:

```powershell
npm run dev -- --host 0.0.0.0
```

Después pueden visitar `http://IP_DEL_PC:5173/`, siempre que el firewall permita el puerto utilizado por Vite.

## Uso del editor

### Crear un modelo

1. Abrir la paleta con el botón de menú.
2. Arrastrar elementos al canvas.
3. Seleccionar el tipo de conexión.
4. Unir un puerto de salida con un puerto compatible de entrada.
5. Seleccionar un nodo o conexión para editar sus propiedades.

Elementos disponibles:

| Grupo | Elementos |
|---|---|
| Bloques | `Structural Block`, `Functional Block` |
| Red de Petri | `Place`, `Transition` |
| Interfaz | `Service` |
| Conversores | `Sample`, `Hold` |

Canales disponibles:

| Canal | Uso visual y lógico |
|---|---|
| `CONTINUOUS` / CCH | Datos continuos, flecha cerrada |
| `DISCRETE` / DCH | Evento discreto, punta abierta |
| `PETRI` / LCH | Flujo lógico o de tokens, línea discontinua |

Semántica de los conversores:

```text
CCH + LCH → Sample → DCH → Hold → CCH + LCH
```

- `Sample` recibe el dato CCH y la activación LCH por el lado ancho; produce DCH por la punta.
- `Hold` recibe DCH por la punta; mantiene el dato y produce CCH + LCH por el lado ancho.

### Navegación

- Botón izquierdo: seleccionar, mover, redimensionar y conectar elementos.
- Arrastre con botón derecho: desplazar el canvas, incluso cuando se inicia dentro de un `Structural Block` o sobre un nodo.
- Rueda del ratón: zoom.
- `Ctrl + Z`: deshacer.
- `Ctrl + Shift + Z` o `Ctrl + Y`: rehacer.
- Doble clic sobre una conexión: insertar un punto manual de ruta.
- Arrastrar un punto de ruta: modificar el recorrido; mantener `Alt` evita el ajuste magnético.

Los `Structural Block` pueden redimensionarse, bloquearse y colapsarse. Al alejar suficientemente el zoom se muestran en modo resumen y se oculta su lógica interna.

### Guardado

- El editor guarda automáticamente el proyecto en `localStorage`.
- **Export JSON** descarga el modelo con `schemaVersion: 2`.
- **Import JSON** acepta documentos versión 1 o 2 y migra los campos anteriores cuando es necesario.
- **New Project** limpia el canvas después de solicitar confirmación.

El estado temporal de ejecución no se serializa dentro del modelo.

## Motor local de simulación

El panel **Motor local** se sincroniza automáticamente con el circuito del editor.

Flujo recomendado:

1. Importar o construir un modelo.
2. Elegir un `Service` en el panel.
3. Inyectar un valor booleano, numérico o textual compatible.
4. Pulsar **Paso** para ejecutar un ciclo.
5. Pulsar **Ejecutar** para avanzar hasta estabilización o hasta el límite de seguridad.
6. Consultar los eventos recientes y el estado mostrado sobre los nodos.
7. Pulsar **Reiniciar** para restaurar tokens y valores iniciales.

Cada paso primero propaga CCH/DCH en orden topológico y después evalúa la red de Petri. Si dos transiciones compiten por los mismos tokens, el motor registra el conflicto y conserva el marcado. Los ciclos en el flujo de datos y las ejecuciones que no se estabilizan se reportan como error.

### Functional Blocks

Un `Functional Block` puede utilizar JavaScript o Python:

- JavaScript sencillo se evalúa directamente; código no trivial se ejecuta en un Worker con límite de tiempo.
- Python se ejecuta en un Worker mediante Pyodide incluido en `frontend/public/pyodide`.
- La opción **Probar** utiliza los valores actuales del circuito o valores neutros para comprobar el resultado.
- Los nombres de los puertos de entrada se normalizan como variables disponibles para el código.

No se requiere una instalación local de Python.

## Modelos de ejemplo

Los ejemplos se importan desde el botón **Import JSON**:

| Archivo | Propósito |
|---|---|
| `output/circuito-presentacion-demo.json` | Circuito básico de presentación con Services, Places y Transitions |
| `output/demo-2-humedad-token.json` | Control de humedad con umbrales y movimiento de tokens |
| `output/demo-parqueadero-converters.json` | Ejemplo de parqueadero con `Sample` y `Hold` |
| `output/figure-29-hiles-wsn.json` | Modelo HiLeS basado en una red de sensores |
| `output/demo-4-semaforos-inteligentes.json` | Cruce coordinado Norte–Sur / Este–Oeste con cuatro semáforos |

El ejemplo de cuatro semáforos representa un solo cruce coordinado. Agrupa las fases Norte–Sur y Este–Oeste y sus transiciones atómicas impiden que ambos ejes queden verdes simultáneamente. Los cuatro navegadores de la demostración son cuatro vistas de este mismo proyecto y estado oficial; no son cuatro procesos independientes.

`output/Ejemplo_pico.json` está reservado y actualmente no contiene un modelo utilizable.

## Configuración MQTT de la web

MQTT es opcional para el editor local. Para activarlo, copiar la plantilla y completar los valores sin subir el archivo resultante a Git:

```powershell
cd frontend
Copy-Item .env.example .env.local
notepad .env.local
```

Variables disponibles:

```env
VITE_MQTT_HOST=localhost
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=usuario_local
VITE_MQTT_PASSWORD=contraseña_local
```

Después de modificar `.env.local`, reiniciar `npm run dev`. El panel **MQTT local** permite conectar, desconectar, controlar el LED y consultar los mensajes recientes.

## Mosquitto local

La configuración de desarrollo utiliza:

- MQTT TCP en `1883` para la Pico y clientes de terminal.
- MQTT sobre WebSockets en `9001` para el navegador.
- autenticación obligatoria;
- estados importantes retenidos y comandos no retenidos.

Las instrucciones de instalación, autenticación, servicio de Windows y pruebas PUB/SUB están en:

- [`infrastructure/mosquitto/README.md`](infrastructure/mosquitto/README.md)
- [`infrastructure/mosquitto/mosquitto.conf.example`](infrastructure/mosquitto/mosquitto.conf.example)

La IP incluida en la ficha de la entrega fue la utilizada durante esa demostración y puede cambiar. Siempre se debe confirmar la IPv4 vigente con `ipconfig`.

## Raspberry Pi Pico W

Archivos disponibles:

| Archivo | Uso |
|---|---|
| `config_local.example.py` | Plantilla de Wi-Fi, broker y credenciales |
| `examples/wifi_test.py` | Prueba independiente de Wi-Fi con timeout |
| `examples/led_mqtt.py` | Cliente MQTT, LED, estado y reconexión de la entrega anterior |

Ruta base: `firmware/pico/`.

Preparación general de la placa:

1. Instalar MicroPython en la Pico W.
2. Instalar `umqtt.simple`.
3. Copiar `config_local.example.py` como `config_local.py` en la placa.
4. Completar SSID, contraseña Wi-Fi, host y credenciales MQTT.
5. Para repetir la demostración anterior, copiar `examples/led_mqtt.py` a la placa con el nombre `main.py`.
6. Reiniciar la Pico.

`config_local.py` no debe agregarse al repositorio.

La implementación actual de la placa:

- se conecta al Wi-Fi con timeout;
- se conecta a Mosquitto por `1883`;
- se suscribe a `led/comando`;
- ejecuta `encender`, `apagar` y `titilar`;
- publica `led/estado`, `estado/conexion` y `error`;
- utiliza Last Will, keepalive, ping periódico y reintentos.

## Topics MQTT

Prefijo actual:

```text
udfjc/hiles/v1/equipo1/pico01/
```

Topics principales:

| Dirección | Sufijo | Estado |
|---|---|---|
| Web → Pico | `led/comando` | Implementado en web y Pico |
| Pico → web | `led/estado` | Implementado en web y Pico |
| Pico → web | `estado/conexion` | Implementado en web y Pico |
| Pico → web | `telemetria` | Contrato preparado |
| MQTT → Service local | `entrada/establecer` | Implementado en la web |
| Motor → MQTT | `salida` | API preparada en el puente |
| Ambos | `error` | Implementado |
| Web → Pico | `modelo/cargar` | Implementado en web y runtime Pico |
| Pico → web | `modelo/confirmacion` | Implementado en web y runtime Pico |
| Web → Pico | `simulacion/comando` | Implementado en web y runtime Pico |
| Pico → web | `simulacion/estado` | Implementado en web y runtime Pico |

El contrato completo, límites de tamaño, QoS, retención, secuencia y tratamiento de duplicados está documentado en [`CONTRATO_MENSAJES_MQTT.md`](docs/mqtt/CONTRATO_MENSAJES_MQTT.md).

## Pruebas y validación

Desde `frontend/`:

```powershell
npm run test:run
npm run lint
npm run build
```

En la última revisión se aprobaron 70 pruebas de frontend y 82 de firmware, además de TypeScript, lint y build. La suite cubre el motor, elementos, red de Petri, grafo de datos, editor, contrato MQTT, ejecución remota, aplicación de instantáneas al canvas y composición completa del runtime Pico con dobles.

Para ejecutar Vitest en modo interactivo:

```powershell
npm test
```

## Seguridad y configuración local

No se deben versionar:

- `.env.local`;
- `config_local.py`;
- SSID o contraseña Wi-Fi;
- usuarios y contraseñas MQTT reales;
- `passwords.txt` de Mosquitto;
- tokens, certificados o claves privadas;
- `node_modules` ni `dist`.

Los mensajes MQTT tienen un límite inicial de 32 KiB. El contrato remoto admite inicialmente hasta 64 elementos y 128 conexiones para proteger la memoria de la Pico.

## Documentación relevante

- [Guía completa para replicar el proyecto en otro PC](docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md)
- [Plan general MQTT y Pico W](entregas/entrega-4-9-octubre/PLAN_MQTT_PICO.md)
- [Plan de implementación de la ejecución en Pico](entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md)
- [Contrato de mensajes MQTT](docs/mqtt/CONTRATO_MENSAJES_MQTT.md)
- [Ficha de conexión de la demostración](docs/mqtt/FICHA_CONEXION_MQTT.md)
- [Guía de demostración](entregas/entrega-4-9-octubre/GUIA_DEMO_MQTT_HILES.md)
- [Guía de ensayo remoto sin Pico](docs/mqtt/GUIA_ENSAYO_REMOTO_SIN_PICO.md)
- [Guía para copiar y probar la Pico W](docs/mqtt/GUIA_PRUEBA_PICO_W.md)
- [Plan del motor frontend](entregas/entrega-3-26-septiembre/PLAN_MOTOR_FRONTEND.md)

## Trabajo pendiente

Las siguientes tareas forman parte de la evolución planificada, no del alcance ya completado:

- portar CCH, DCH, `Sample`, `Hold` y retardos al runtime MicroPython;
- hacer dinámico el identificador MQTT para múltiples dispositivos;
- validar tiempos y memoria en una Pico física;
- ejecutar el ensayo conjunto con cuatro navegadores y el broker;
- ejecutar instancias distribuidas en varios computadores.

## Flujo de contribución

Antes de trabajar:

```powershell
git status
git branch --show-current
git pull --ff-only
```

No se deben eliminar ni restaurar cambios ajenos. Los commits deben contener una unidad comprobable y únicamente los archivos relacionados:

```powershell
git add ruta\del\archivo
git commit -m "tipo: descripción breve"
git push
```

Antes de integrar un cambio funcional, ejecutar pruebas, lint y build.
