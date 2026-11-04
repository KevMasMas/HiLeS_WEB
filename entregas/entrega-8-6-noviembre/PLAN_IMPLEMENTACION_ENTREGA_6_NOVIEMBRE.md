# Plan de implementación — entrega del viernes 6 de noviembre de 2026

**Equipo:** cinco personas  
**Rama base:** `mqtt-pico`  
**Commit base:** `f7cc9b6`  
**Ventana de trabajo:** miércoles 4 a viernes 6 de noviembre de 2026  
**Estado inicial:** ejecución distribuida v3, colaboración web, dos Picos identificadas y runtime general implementados; la interfaz todavía mezcla el flujo legado Local/Pico con el flujo nuevo por ejecutores y requiere cierre físico y visual.  
**Objetivo principal:** convertir la base multi-Pico existente en una experiencia coherente, repetible y demostrable, donde se pueda construir un modelo general, elegir dónde corre cada bloque, configurar nuevas placas sin editar código fuente y operar el circuito desde una única interfaz comprensible.

## 1. Resultado que se presentará

Al cerrar la entrega debe poder demostrarse, de principio a fin:

1. Abrir un proyecto colaborativo desde uno o varios navegadores.
2. Ver las Picos y navegadores conectados al `projectId` actual con identidad y estado correctos.
3. Elegir por bloque estructural el destino de ejecución: Pico o navegador.
4. Distinguir el modo de conexión del proyecto —local/LAN o remoto— del destino donde corre cada bloque.
5. Asignar bloques a dos Picos diferentes y, opcionalmente, a uno o más navegadores.
6. Desplegar el modelo solo cuando todos los destinos sean válidos y recibir los ACK correspondientes.
7. Usar una sola familia de controles para iniciar, detener, reiniciar y avanzar un paso.
8. Inyectar entradas desde Services y observar el estado agregado sin abrir herramientas técnicas.
9. Mostrar Places con cero, uno o varios tokens y ejecutar correctamente todos los elementos generales soportados.
10. Repetir la demostración desde escritorio, tablet y celular sin desbordamientos ni controles inaccesibles.
11. Preparar una Pico nueva con el mismo firmware canónico y una identidad diferente, preservando sus secretos locales.
12. Seguir un tutorial y una guía que expliquen el flujo real actual, sin botones ni conceptos obsoletos.

La demostración principal será la matriz **Pico ↔ Pico**. La matriz **Pico ↔ navegador** será la segunda evidencia. La matriz **navegador ↔ navegador** se conserva como regresión sin hardware.

## 2. Decisiones de producto para evitar otra interfaz duplicada

### 2.1 Dos decisiones diferentes

La interfaz manejará dos ejes explícitos:

| Eje | Opciones | Alcance |
|---|---|---|
| Modo de conexión del proyecto | Local/LAN, Remoto | Define cómo el navegador alcanza el broker y comparte el proyecto. No decide dónde se ejecuta un bloque. |
| Destino de ejecución | Pico, este navegador, otro navegador | Se selecciona por Structural Block; un Functional Block puede sobreescribirlo cuando sea necesario. |

La palabra **Local** dejará de significar simultáneamente “motor del navegador”, “broker del mismo PC” y “simulación sin MQTT”. Los textos deben indicar exactamente cuál de esos conceptos representan.

### 2.2 Un único plano de ejecución

- El panel de **Ejecutores** será la fuente oficial para asignar, desplegar y diagnosticar.
- La barra superior conservará un único conjunto de controles globales: `Iniciar`, `Paso`, `Detener` y `Reiniciar`.
- El panel de simulación se concentrará en entradas, inspección y estado, sin repetir los mismos controles.
- El selector legado global `Local / Pico` y la sesión antigua `Pico / MQTT` se retirarán después de migrar las funciones que todavía consumen.
- El motor local continuará existiendo como worker de navegador, no como una segunda arquitectura paralela.
- Colaborar y ejecutar seguirán siendo capacidades distintas: un navegador puede editar sin ofrecerse como worker.

### 2.3 Internet remoto

La entrega dejará el estado y la interfaz preparados para un broker remoto, pero no presentará como “Internet listo para producción” una conexión sin TLS, autenticación y control de acceso.

- **P0:** perfil Local/LAN funcional y perfil Remoto configurable mediante `wss://`, puerto, ruta y credenciales locales.
- **P0:** ningún secreto se guarda en el documento colaborativo, URL, MQTT retenido ni Git.
- **P1:** probar un broker remoto seguro si el equipo dispone de uno.
- **Fuera de alcance:** crear cuentas, autorización por usuario, ACL multi-tenant o exponer Mosquitto doméstico directamente a Internet.

## 3. Alcance priorizado

### P0 — obligatorio para el viernes

- [x] Auditar el flujo de descubrimiento y validación de ejecutores.
- [x] Implementar en software una validación central para estados Pico/navegador y cubrirla con pruebas.
- [ ] Verificar visualmente que `pico:pico01w` y `pico:pico02w` aparecen y pueden seleccionarse en `proyecto-hl950c`.
- [ ] Desplegar un modelo real Pico ↔ Pico y registrar ambos ACK.
- [ ] Eliminar la duplicación funcional entre `Local/Pico`, `Pico/MQTT`, controles de la barra y controles del panel distribuido.
- [ ] Definir un estado único de conexión y ejecución consumido por toda la interfaz.
- [ ] Corregir desbordamientos y barras de desplazamiento innecesarias en escritorio, tablet y celular.
- [ ] Mantener scroll interno únicamente en listas o paneles cuyo contenido realmente lo requiera.
- [ ] Actualizar el tutorial para el flujo proyecto → conexión → ejecutores → asignación → despliegue → entrada → ejecución.
- [ ] Probar todos los tipos de elemento soportados y los tres tipos de canal en browser y MicroPython.
- [ ] Añadir casos con varios tokens y una representación visual legible de la cantidad.
- [ ] Generar y validar un paquete de firmware canónico idéntico para Pico W y Pico 2 W.
- [ ] Inventariar ambas placas, respaldarlas, sincronizar el runtime y comprobar checksums sin reemplazar `config_local.py` ni `umqtt/`.
- [ ] Permitir preparar desde la aplicación una configuración validada sin escribir Python manualmente.
- [ ] Ejecutar la matriz mínima de pruebas automáticas, visuales y físicas y registrar evidencia.
- [ ] Actualizar la documentación de instalación, configuración, uso, recuperación y demostración.

### P1 — entra si P0 permanece estable

- [ ] Asistente Web Serial para escribir `config_local.py` desde Chromium de escritorio, con confirmación explícita y sin persistir contraseñas.
- [ ] Detectar desde el asistente si una placa usa firmware incompleto o versión diferente y recomendar sincronización.
- [ ] Probar Pico ↔ navegador con pérdida y recuperación de uno de los ejecutores.
- [ ] Mostrar versión de firmware, modelo de placa, memoria libre, última actividad y despliegue activo.
- [ ] Incorporar un menú de desbordamiento compacto en la barra superior para pantallas pequeñas.
- [ ] Probar un perfil remoto `wss://` real si existe infraestructura segura disponible.

### P2 — no bloquea la entrega

- [ ] Aprovisionamiento completo del firmware por Web Serial sin Thonny ni herramienta auxiliar.
- [ ] Administración remota de credenciales Wi-Fi de una Pico que aún no está en red.
- [ ] Actualización OTA del runtime.
- [ ] Autenticación de usuarios, permisos por proyecto y ACL por ejecutor.
- [ ] Lease y regeneración distribuida del token de semáforos ante fallos de red.
- [ ] Integración Three.js como gemelo digital.

## 4. Arquitectura objetivo de la interfaz

```text
Proyecto colaborativo
        │
        ├── Perfil de conexión
        │      ├── Local/LAN
        │      └── Remoto seguro
        │
        ├── Registro de ejecutores
        │      ├── Pico pico01w
        │      ├── Pico pico02w
        │      ├── Este navegador
        │      └── Otros navegadores
        │
        ├── Asignación por Structural Block
        │      └── override opcional por Functional Block
        │
        ├── Despliegue distribuido
        │      └── manifiesto + fragmentos + ACK
        │
        └── Operación única
               ├── Iniciar / Paso / Detener / Reiniciar
               ├── Entradas por Services
               └── Estado agregado y diagnóstico
```

No se creará un tercer store para resolver la duplicación. Se migrarán consumidores hacia el store distribuido o hacia una fachada pequeña que derive el estado oficial.

## 5. Contrato de disponibilidad de ejecutores

La interfaz y el despliegue deben utilizar la misma evaluación:

| Estado o condición | Visible | Seleccionable | Desplegable |
|---|---:|---:|---:|
| `online`, reciente y compatible | Sí | Sí | Sí |
| `ready` o `running`, reciente y compatible | Sí | Sí | Sí |
| `deploying` | Sí | Sí | No hasta terminar |
| `degraded` | Sí | No | No |
| `offline` | Sí | No | No |
| Sin latido reciente | Sí | No | No |
| IR o lenguaje incompatible | Sí | No | No |
| Otro `projectId` | No se mezcla con el selector actual | No | No |

Reglas:

1. La actividad se calcula con la hora en que el navegador recibió el mensaje, no con el uptime de la Pico.
2. El payload debe coincidir con el `projectId`, `executorId` y versión declarados por el tópico.
3. Una asignación anterior no se borra si el ejecutor cae; se muestra como no disponible para facilitar recuperación.
4. `Desplegar` permanece deshabilitado mientras falte un destino o exista un destino no desplegable.
5. Todo rechazo deja una explicación visible, no solo un error de consola.

## 6. Flota de Picos y configuración sin editar código

### 6.1 Estado canónico de una placa

Cada Pico debe quedar con:

```text
/
├── main.py
├── config_local.py              # único por placa; nunca entra a Git
├── config_local.example.py
├── core/
├── devices/
├── hiles/
├── platform/
├── pubsub/
└── umqtt/                       # se conserva
```

Los archivos antiguos de nivel superior se inventarían y respaldarán. Solo se eliminarán los declarados obsoletos por el manifiesto canónico; nunca se hará una limpieza indiscriminada.

### 6.2 Identidad de cada placa

Todas las placas compartirán runtime y proyecto, pero tendrán identidad única:

| Campo | Igual entre placas | Ejemplo |
|---|---:|---|
| `HILES_PROJECT_ID` | Sí | `proyecto-hl950c` |
| `MQTT_HOST`, puerto y usuario | Sí para la misma red | IP del broker, `1883` |
| `DEVICE_ID` | No | `pico01w`, `pico02w`, `pico03w` |
| `MQTT_CLIENT_ID` | No | mismo identificador único o derivado |
| `EXECUTOR_ID` | No | `pico:<deviceId>` derivado |

Agregar una tercera o cuarta Pico no debe exigir código nuevo: se repite el paquete y se cambia únicamente la configuración local y la identidad.

### 6.3 Asistente de configuración en la aplicación

El alcance P0 será un formulario local que permita:

- elegir Local/LAN o Remoto;
- introducir SSID, contraseña Wi-Fi, host, puerto, usuario y contraseña MQTT;
- definir `DEVICE_ID`, `MQTT_CLIENT_ID`, equipo y `HILES_PROJECT_ID`;
- validar campos, duplicados e IP/host antes de generar el resultado;
- mostrar advertencias de red 2.4 GHz y uso incorrecto de `localhost`;
- descargar o copiar un `config_local.py` válido;
- no guardar secretos en `localStorage`, URL, proyecto compartido o broker;
- limpiar los campos sensibles al cerrar el diálogo.

Si Web Serial no llega estable a P0, la aplicación entregará el archivo listo y un flujo de carga guiado por Thonny/`mpremote`. No se esconderá esta limitación.

### 6.4 Web Serial opcional

Antes de implementarlo se hará una prueba corta de viabilidad:

- solo Chromium de escritorio;
- permiso serial solicitado por acción directa del usuario;
- Thonny cerrado sobre el mismo puerto;
- respaldo de `config_local.py` antes de sobrescribirlo;
- vista previa sin revelar la contraseña después de confirmar;
- validación de REPL y reinicio controlado;
- fallback visible para Firefox, Safari, móvil o puerto ocupado.

## 7. Conformidad funcional general

La entrega no se cerrará únicamente con el ejemplo de semáforos. Se probará la matriz siguiente:

| Componente | Browser | Pico | Distribuido | Evidencia mínima |
|---|---:|---:|---:|---|
| Service booleano, numérico y texto | Sí | Sí | Sí | Entrada manual y snapshot |
| Functional Block expresión | Sí | Sí | Sí | Resultado equivalente |
| Functional Block Python | Sí | Sí | Sí | Una y varias salidas |
| Sample | Sí | Sí | Sí | Captura por evento |
| Hold | Sí | Sí | Sí | Retención y reinicio |
| Place | Sí | Sí | Sí dentro de su fragmento | 0, 1 y varios tokens |
| Transition | Sí | Sí | Sí dentro de su fragmento | Condición y retardo |
| Structural Block | Sí | Sí | Sí | Herencia del destino |
| CCH | Sí | Sí | Sí | Último valor y retardo |
| DCH | Sí | Sí | Sí | FIFO y capacidad |
| LCH/Petri | Sí | Sí | Sí con restricción documentada | Pulso y consumo único |

Casos obligatorios de tokens:

- Place con `tokens = 0`;
- Place con `tokens = 1`;
- Place con `tokens > 1` y capacidad suficiente;
- consumo y producción con peso mayor que uno;
- dos transiciones en conflicto sin pérdida de tokens;
- reinicio que recupera el marcado inicial;
- token remoto que no se reutiliza sin un mensaje nuevo;
- interfaz que muestra cantidad `×N` en vez de representar siempre un solo punto.

## 8. Responsive y eliminación de scrollbars

### Criterios visuales

- El documento no tendrá scroll horizontal global.
- La barra superior no mostrará una barra de scroll invasiva.
- Ningún panel quedará cortado detrás de la barra, safe area o teclado móvil.
- Los controles táctiles tendrán al menos 42 px de área interactiva.
- Las hojas móviles tendrán encabezado fijo, contenido desplazable y cierre accesible.
- El canvas conservará paneo, zoom y selección con mouse y tacto.
- Los textos largos usarán elipsis o salto controlado sin ensanchar el viewport.
- La cantidad de tokens será legible con zoom normal.

### Viewports obligatorios

| Perfil | Tamaño mínimo de prueba |
|---|---|
| Móvil estrecho | 360 × 800 |
| Móvil de referencia | 390 × 844 |
| Tablet vertical | 768 × 1024 |
| Tablet grande | 820 × 1180 |
| Portátil | 1280 × 720 |
| Escritorio | 1440 × 900 |

Se comprobarán topbar, paleta, canvas, propiedades, simulación, MQTT, ejecutores, colaboradores, tutorial y diálogos.

## 9. Tutorial y documentación

El tutorial dejará de describir el flujo legado. Debe cubrir:

1. Qué es un proyecto y cómo compartir su enlace.
2. Diferencia entre colaborador y ejecutor.
3. Modo de conexión Local/LAN frente a Remoto.
4. Cómo registrar este navegador como ejecutor.
5. Cómo reconocer una Pico y verificar que usa el mismo `projectId`.
6. Cómo asignar un Structural Block y cuándo sobreescribir un Functional Block.
7. Qué significan `Desplegar`, fragmentos y ACK.
8. Cómo introducir valores mediante Services.
9. Cómo usar los controles globales únicos.
10. Cómo interpretar `offline`, `obsoleto`, `degradado` y errores de capacidad.
11. Cómo configurar una Pico nueva y proteger credenciales.
12. Cómo cargar un ejemplo mínimo sin hardware y el ejemplo multi-Pico.

Documentos que deberán reconciliarse durante la implementación:

- README principal;
- guía completa de réplica en Windows;
- guía de prueba Pico W;
- ficha de conexión MQTT;
- arquitectura Pico;
- protocolo distribuido v3;
- guía sin Pico;
- plan y registro de esta entrega.

La documentación no incluirá nombres propios, contraseñas reales ni una IP presentada como permanente.

### Método de documentación de esta entrega

Una persona quedará dedicada únicamente a reconstruir y documentar el proyecto. No desarrollará funcionalidades ni será responsable de ejecutar la integración técnica. Su fuente de verdad será:

1. planes y registros de las entregas anteriores;
2. historial y diffs de Git;
3. informes entregados por cada persona;
4. comandos y resultados de pruebas;
5. guías técnicas y contratos existentes;
6. evidencia física o visual validada.

Cada una de las otras cuatro personas deberá entregar al finalizar su jornada un resumen con objetivo, archivos, decisiones, pruebas, resultados, errores, limitaciones y commit. La persona de documentación contrastará ese resumen con el repositorio antes de incorporarlo; no documentará afirmaciones sin evidencia.

## 10. División del trabajo

### Persona 1 — estado único de ejecución y validación multi-Pico

**Responsabilidad:** cerrar la arquitectura funcional del frontend antes de que se eliminen controles.

#### Tareas

- [x] Auditar recepción, validación, selección y despliegue de ejecutores.
- [x] Crear validación central de payload, proyecto, actividad, estado y capacidades.
- [x] Hacer que selector y despliegue compartan el mismo criterio.
- [x] Añadir pruebas de Pico válida, otro proyecto, protocolo inválido, offline, degradado y obsoleto.
- [ ] Verificar las dos Picos reales en el panel y completar despliegue Pico ↔ Pico.
- [ ] Definir la fachada de estado oficial que reemplazará el modo global `local/pico`.
- [ ] Migrar comandos globales hacia el despliegue distribuido.
- [ ] Entregar a Persona 3 el contrato exacto de controles y estados visibles.

#### Archivos bajo su control

```text
frontend/src/services/distributed/messages.ts
frontend/src/features/distributed/AssignmentSelector.tsx
frontend/src/features/distributed/assignments.ts
frontend/src/features/distributed/executorAvailability.ts
frontend/src/stores/useDistributedExecutionStore.ts
frontend/src/features/distributed/*.test.ts
```

#### Criterio de cierre

- Dos Pico online aparecen como destinos válidos.
- Un `projectId` distinto explica por qué no aparecen.
- Ningún destino inválido permite desplegar.
- Los comandos de la interfaz operan el despliegue activo sin depender del store legado.

---

### Persona 2 — flota, firmware canónico y aprovisionamiento

**Responsabilidad:** hacer repetible la preparación de dos o más Picos sin divergencias.

#### Tareas

- [ ] Inventariar Pico 1 y Pico 2 sin mostrar secretos.
- [ ] Comparar ambas contra el manifiesto del paquete canónico.
- [ ] Respaldar cada placa antes de cambiar archivos.
- [ ] Sincronizar módulos faltantes y retirar solo obsoletos explícitos.
- [ ] Preservar `config_local.py` y `umqtt/`.
- [ ] Verificar Pico W RP2040 y Pico 2 W RP2350 con el mismo runtime general.
- [ ] Añadir versión de firmware y modelo de placa al estado publicado si falta.
- [ ] Preparar el formulario/generador seguro de `config_local.py`.
- [ ] Investigar Web Serial y entregar resultado funcional o fallback documentado.
- [ ] Probar incorporación de una identidad `pico03w` simulada o física sin código nuevo.

#### Archivos bajo su control

```text
firmware/pico/**
firmware/tests/**
scripts/prepare-pico-deployment.ps1
scripts/test-distributed-physical.ps1
frontend/src/features/setup/**
```

#### Criterio de cierre

- Las dos placas tienen los mismos archivos de runtime y configuraciones locales distintas.
- El paquete generado se compara por checksum con las fuentes.
- Una Pico nueva se prepara cambiando datos, no código.
- Las credenciales no aparecen en logs, Git ni mensajes MQTT.

---

### Persona 3 — frontend unificado, responsive y tutorial

**Dependencia:** contrato de estado y comandos entregado por Persona 1.

**Responsabilidad:** convertir la arquitectura existente en una experiencia única y comprensible.

#### Tareas

- [ ] Inventariar todos los botones y marcar mantener, fusionar o retirar.
- [ ] Eliminar los controles duplicados después de migrar sus funciones.
- [ ] Rediseñar la información visible alrededor de conexión, destino, despliegue y ejecución.
- [ ] Corregir scrollbars globales y desbordamientos por panel.
- [ ] Crear comportamiento compacto de topbar para móvil y tablet.
- [ ] Mantener accesibilidad por teclado, foco visible, etiquetas y áreas táctiles.
- [ ] Actualizar tutorial y ayudas contextuales al flujo real.
- [ ] Mostrar cantidad de tokens y estados remotos de forma legible.
- [ ] Ejecutar revisión visual en todos los viewports definidos.

#### Archivos bajo su control

```text
frontend/src/features/editor/**
frontend/src/features/simulation/**
frontend/src/features/onboarding/**
frontend/src/features/distributed/DistributedPanel.tsx
frontend/src/features/distributed/distributed.css
frontend/src/index.css
```

#### Criterio de cierre

- Existe un solo conjunto de controles de ejecución.
- El usuario distingue conexión y destino sin conocer MQTT.
- No hay scroll horizontal global en los seis viewports.
- El tutorial permite completar una ejecución sin explicación externa.

---

### Persona 4 — conformidad, integración y pruebas físicas

**Dependencias:** recibe las piezas aprobadas de Personas 1 a 3.

**Responsabilidad:** demostrar que multi-Pico es general, integrar los cuatro frentes técnicos y evitar que piezas correctas por separado fallen en la demostración completa.

#### Tareas

- [ ] Construir la matriz de elementos y canales de la sección 7.
- [ ] Comparar browser y MicroPython con los mismos vectores IR v2.
- [ ] Añadir pruebas de varios tokens, pesos, capacidad y conflicto.
- [ ] Confirmar reinicio, retardos, Sample, Hold y varias salidas Python.
- [ ] Probar rutas CCH, DCH y LCH entre ejecutores compatibles.
- [ ] Documentar restricciones reales de Places/Transitions entre fragmentos.
- [ ] Corregir únicamente defectos reproducidos por un vector mínimo.
- [ ] Congelar un commit de integración y ejecutar las suites completas.
- [ ] Probar browser ↔ browser, Pico ↔ browser y Pico ↔ Pico.
- [ ] Probar desconexión, reconexión, retained, Last Will y redespliegue.
- [ ] Verificar el ejemplo general y el anillo de semáforos.
- [ ] Coordinar la matriz responsive con Persona 3 y registrar el resultado técnico.
- [ ] Probar el tutorial con una persona que no haya implementado el flujo.
- [ ] Preparar y ensayar una demostración de máximo diez minutos.

#### Archivos bajo su control

```text
frontend/src/engine/**
frontend/src/services/ir/**
firmware/pico/hiles/**
docs/mqtt/vectores_ir_v2/**
scripts/test-distributed-mqtt.mjs
scripts/test-project-collaboration.mjs
scripts/test-distributed-physical.ps1
```

Los cambios compartidos con Persona 2 en `firmware/pico/hiles/**` requieren coordinación previa y una sola persona editando cada archivo.

#### Criterio de cierre

- Los mismos vectores producen resultados equivalentes en browser y Pico.
- Los tokens nunca se pierden ni duplican en los casos aprobados.
- Los límites no soportados se rechazan con mensajes claros.
- Las tres matrices de ejecutores cuentan con resultado verificable.
- La demostración completa se ejecuta desde el commit congelado.

---

### Persona 5 — documentación histórica, informes y trazabilidad

**Dependencias:** recibe informes diarios y evidencia de Personas 1 a 4, y consulta todas las entregas anteriores.

**Responsabilidad exclusiva:** documentar qué ha hecho cada persona, cómo funciona el proyecto, cómo se reproduce y cuál es su estado real. No modifica código de producción ni asume pruebas técnicas que correspondan a las otras cuatro personas.

#### Tareas

- [ ] Leer los planes y registros de todas las entregas anteriores.
- [ ] Reconstruir una cronología del proyecto por fecha, objetivo, persona y commit.
- [ ] Preparar un informe por persona con responsabilidades, aportes, archivos, decisiones, pruebas y resultados.
- [ ] Diferenciar claramente trabajo histórico, trabajo de esta entrega y pendientes.
- [ ] Contrastar cada afirmación con Git, pruebas o evidencia antes de marcarla como terminada.
- [ ] Mantener actualizado este registro mientras Personas 1 a 4 trabajan.
- [ ] Reconciliar documentación y eliminar instrucciones obsoletas.
- [ ] Registrar hashes, versiones, resultados y limitaciones sin secretos.
- [ ] Actualizar la explicación completa de arquitectura, instalación, uso y recuperación.
- [ ] Documentar el flujo para agregar otra Pico, configurar red y elegir ejecutores.
- [ ] Preparar el informe final de la entrega y el guion escrito de demostración.
- [ ] Mantener una tabla de evidencia que enlace cada requisito con su prueba y responsable.

#### Archivos bajo su control

```text
docs/**
README.md
entregas/entrega-8-6-noviembre/**
```

Persona 5 puede proponer correcciones documentales en archivos mantenidos por otras personas, pero no editará sus módulos de producción.

#### Criterio de cierre

- Cada persona cuenta con un informe verificable de lo realizado desde el inicio del proyecto.
- La documentación explica arquitectura, instalación, configuración, operación, pruebas y recuperación sin depender del chat.
- Toda casilla marcada enlaza o cita una prueba, commit, archivo o evidencia concreta.
- Las limitaciones y trabajos pendientes se distinguen de lo realmente terminado.
- Una persona externa puede comprender el estado del proyecto y repetir la demostración siguiendo los documentos.

## 11. Dependencias y orden de integración

```text
Persona 1: contrato de estado/comandos ───────┐
                                              ├── Persona 3: interfaz única
Persona 2: firmware y aprovisionamiento ──────┤
                                              ├── Persona 4: integración y pruebas
Persona 4: motor y conformidad ───────────────┤
                                              │
Persona 3: responsive y tutorial ─────────────┘

Personas 1, 2, 3 y 4 ── informes + evidencia ──► Persona 5: documentación
```

Reglas de integración:

- Un archivo tiene una sola persona editora a la vez.
- No se eliminan controles hasta que su función tenga reemplazo aprobado.
- No se cambian contratos MQTT durante la prueba física sin actualizar ambos workers y sus fixtures.
- Todo cambio de firmware preserva `config_local.py`.
- Los documentos se actualizan después de aprobar el comportamiento, no para describir una intención como terminada.
- Personas 1 a 4 entregan a Persona 5 un informe al cerrar cada bloque de trabajo.
- Persona 5 verifica el informe contra Git y las pruebas; no completa casillas por comunicación verbal.
- Persona 5 no corrige código de producción: devuelve inconsistencias a la persona responsable.

## 12. Cronograma de cierre

### Miércoles 4 de noviembre

- [x] Auditoría de validaciones de Pico.
- [x] Corrección de software del Paso 1 y 161 pruebas frontend aprobadas.
- [ ] Congelar contrato único de estado y comandos.
- [ ] Inventariar duplicados de UI y causas de overflow.
- [ ] Inventariar las dos Picos y producir comparación segura.
- [ ] Congelar matriz de conformidad general.
- [ ] Persona 5 inicia la cronología histórica y el índice de aportes por persona.

### Jueves 5 de noviembre

- [ ] Integrar controles únicos y primera pasada responsive.
- [ ] Sincronizar firmware canónico en ambas Picos.
- [ ] Completar generador seguro de configuración.
- [ ] Ejecutar pruebas de elementos, canales y múltiples tokens.
- [ ] Completar tutorial actualizado.
- [ ] Ejecutar Pico ↔ Pico y Pico ↔ navegador.
- [ ] Personas 1 a 4 entregan sus primeros informes verificables a Persona 5.
- [ ] Persona 5 reconcilia arquitectura, instalación y guías de Pico con el código actual.

### Viernes 6 de noviembre — mañana

- [ ] Corregir solo defectos P0 reproducibles.
- [ ] Ejecutar suites completas, lint, TypeScript y build.
- [ ] Ejecutar matriz responsive y accesibilidad básica.
- [ ] Probar guía con una persona nueva.
- [ ] Congelar firmware, frontend y documentación.
- [ ] Persona 5 completa informes por persona y matriz requisito → evidencia.

### Viernes 6 de noviembre — cierre

- [ ] Ensayo completo sin improvisar configuración.
- [ ] Confirmar que no existen credenciales en Git o evidencias.
- [ ] Registrar hashes de commit y paquete de firmware.
- [ ] Etiquetar limitaciones P1/P2 sin presentarlas como terminadas.
- [ ] Preparar commit final y push únicamente después de aprobar la matriz.
- [ ] Persona 5 publica el informe final únicamente con resultados confirmados por Persona 4.

## 13. Matriz de pruebas obligatoria

| Prueba | Browser ↔ Browser | Pico ↔ Browser | Pico ↔ Pico |
|---|---:|---:|---:|
| Registro de ejecutores | [ ] | [ ] | [ ] |
| Asignación colaborativa | [ ] | [ ] | [ ] |
| Fragmentos y ACK | [ ] | [ ] | [ ] |
| CCH remoto | [ ] | [ ] | [ ] |
| DCH remoto | [ ] | [ ] | [ ] |
| LCH/token remoto | [ ] | [ ] | [ ] |
| Entrada por Service | [ ] | [ ] | [ ] |
| Functional Block Python | [ ] | [ ] | [ ] |
| Varios tokens | [ ] | [ ] | [ ] |
| Reinicio | [ ] | [ ] | [ ] |
| Desconexión/reconexión | [ ] | [ ] | [ ] |
| Estado agregado igual en dos colaboradores | [ ] | [ ] | [ ] |

Además:

- [ ] Suite completa de frontend.
- [ ] Suite completa de firmware.
- [ ] ESLint.
- [ ] TypeScript.
- [ ] Build de producción.
- [ ] `git diff --check`.
- [ ] Paquete Pico comparado por checksum.
- [ ] Auditoría de secretos.

## 14. Secuencia de demostración

1. Abrir `proyecto-hl950c` y mostrar el perfil Local/LAN.
2. Abrir Ejecutores y mostrar dos Picos online con identidades distintas.
3. Cargar un ejemplo general pequeño y asignar dos Structural Blocks a placas diferentes.
4. Desplegar y mostrar dos fragmentos y dos ACK.
5. Introducir un valor desde un Service y mostrar el cálculo cruzando MQTT.
6. Ejecutar `Paso`, `Iniciar`, `Detener` y `Reiniciar` desde los controles únicos.
7. Mostrar un Place con varios tokens y su consumo correcto.
8. Abrir un segundo navegador y mostrar colaboración y estado agregado.
9. Desconectar temporalmente un ejecutor y mostrar diagnóstico/reconexión.
10. Mostrar el asistente de configuración y cómo se agregaría `pico03w` sin editar código fuente.

## 15. Criterios de aceptación final

La entrega se considera aprobada solamente si:

- [ ] Las dos Picos reales aparecen seleccionables en el proyecto correcto.
- [ ] Pico ↔ Pico ejecuta al menos un flujo de datos completo.
- [ ] Pico ↔ navegador ejecuta al menos un flujo de datos completo.
- [ ] No existen dos sistemas de controles visibles para la misma ejecución.
- [ ] El modo de conexión no se confunde con el destino de un bloque.
- [ ] Todos los elementos generales cuentan con evidencia de conformidad.
- [ ] Varios tokens se representan y ejecutan correctamente.
- [ ] No hay desbordamiento horizontal global en los viewports obligatorios.
- [ ] El tutorial coincide con la interfaz entregada.
- [ ] Las dos Picos usan el paquete canónico y conservan configuración individual.
- [ ] Una nueva Pico puede configurarse sin escribir código Python manualmente.
- [ ] Ningún secreto aparece en Git, URLs, retaineds o capturas.
- [ ] Pruebas, build y documentación se encuentran aprobados y registrados.

## 16. Riesgos y recortes autorizados

| Riesgo | Respuesta | Recorte permitido |
|---|---|---|
| Web Serial no es estable | Entregar generador de configuración y carga guiada | Pasa a P1 sin bloquear P0 |
| No existe broker remoto seguro | Mantener perfil y validación, demostrar LAN | No afirmar Internet productivo |
| Una Pico falla físicamente | Diagnosticar y conservar evidencia de la otra | No sustituir Pico ↔ Pico con dobles sin declararlo |
| Refactor de controles rompe motor legado | Migrar por adaptador y retirar al final | Conservar internamente compatibilidad, no duplicación visible |
| Responsive consume demasiado tiempo | Priorizar topbar, paneles y diálogos P0 | Animaciones y refinamientos pasan a P1 |
| Semáforos fail-safe exceden plazo | Demostrar flujo general y documentar límite | Lease distribuido permanece P2 |

No se recortan: detección de ambas Picos, controles únicos, prueba Pico ↔ Pico, secretos fuera del repositorio, conformidad básica de elementos y ausencia de overflow global.

## 17. Regla de evidencia

Una casilla solo cambia a `[x]` cuando el registro incluye:

- fecha y persona;
- archivos afectados;
- prueba o pasos reproducibles;
- resultado exacto;
- evidencia física o visual cuando corresponda;
- limitaciones pendientes;
- commit o estado local claramente indicado.

Una prueba de software no sustituye una prueba física. Un doble de protocolo no se registrará como Pico real.
