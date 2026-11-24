# Universidad Distrital Francisco José de Caldas

## Proyecto HiLeS Web

# Informe técnico de aportes individuales

**Evolución, módulos, contribuciones y resultados**

**Corte documental:** 7 de noviembre de 2026

**Actualización puntual de autoría y documentación:** 24 de noviembre de 2026

**Área:** Ingeniería de software

---

## Contenido

1. [Introducción](#introducción)
2. [Objetivos](#objetivos)
3. [Resumen ejecutivo](#resumen-ejecutivo)
4. [Alcance y método de atribución](#alcance-y-método-de-atribución)
5. [Matrices de seguimiento de aportes](#matrices-de-seguimiento-de-aportes)
6. [Evolución técnica del proyecto](#evolución-técnica-del-proyecto)
7. [Aportes individuales](#aportes-individuales)
8. [Resultados de equipo y límites de evidencia](#resultados-de-equipo-y-límites-de-evidencia)
9. [Conclusiones](#conclusiones)
10. [Documentación principal consultada](#documentación-principal-consultada)

## Introducción

HiLeS Web es un entorno para construir, compartir y ejecutar modelos HiLeS mediante un editor gráfico. Su desarrollo documentado integró redes de Petri, bloques funcionales, simulación en navegador, comunicación MQTT y ejecución sobre Raspberry Pi Pico. Este informe organiza la contribución de cada integrante a lo largo de esa evolución y permite consultar responsabilidades, módulos, decisiones técnicas y resultados con sus referencias documentales.

El propósito es ofrecer una lectura técnica transversal del trabajo del equipo: cada contribución se entiende dentro de la arquitectura común y se acompaña de la evidencia disponible. Las matrices resumen relaciones y resultados; las secciones individuales explican los mecanismos de implementación para que las tablas no se lean como listas aisladas.

## Objetivos

### Objetivo general

Documentar de forma trazable las responsabilidades, actividades, desarrollos técnicos, verificaciones y resultados atribuidos a cada integrante durante la evolución de HiLeS Web.

### Objetivos específicos

- Reconstruir la secuencia técnica a partir de planes, registros, informes y evidencia de código disponible.
- Relacionar integrantes con responsabilidades, módulos, decisiones de implementación y pruebas.
- Diferenciar resultados verificados, resultados declarados y actividades con atribución indirecta.
- Presentar matrices de consulta rápida que complementen la explicación técnica individual.

## Resumen ejecutivo

Este informe reconstruye la evolución completa del proyecto HiLeS Web desde su inicio hasta el corte documental final disponible. Explica las responsabilidades asumidas, el funcionamiento técnico de los módulos atribuidos a cada integrante, las comprobaciones registradas y los resultados o asuntos abiertos. Se combinan commits, registros, planes y documentos de cierre, distinguiendo evidencia de código, resultados declarados y tareas pendientes.

El proyecto evolucionó desde un editor de diagramas HiLeS con una demostración basada en Places y Transitions hacia un motor ejecutable en navegador, comunicación MQTT, runtime MicroPython para Raspberry Pi Pico y coordinación distribuida entre ejecutores. En paralelo se ampliaron la colaboración entre navegadores, la interfaz responsive y el aprovisionamiento de placas. Al corte se informaron 187 pruebas frontend y 169 de firmware, con lint, tipos y build aprobados; la demostración física distribuida todavía tenía pendientes.

## Alcance y método de atribución

Se revisaron los planes, registros y documentos históricos disponibles en las carpetas de entregas: planes de presentación e implementación, guías, cronología, matriz requisito-evidencia, informe final e informes por persona. Se utilizó el mapeo entre alias de Git, nombres y numeración temporal de `INFORMES_POR_PERSONA.md`. La numeración “Persona 1” a “Persona 5” cambia a lo largo del proyecto y no representa identidades permanentes. El informe organiza el trabajo por integrante y evolución técnica, no por número de entrega.

El corte técnico base permanece en el 7 de noviembre. La actualización puntual del 24 de noviembre incorpora únicamente el manual para desarrolladores de Juan David Romero, normaliza el conteo de commits y registra la autoría real del commit publicado con la cuenta `valeld`; no modifica los demás estados técnicos o límites de evidencia del corte base.

Una tarea propuesta en un plan no se trata como realizada sin registro o evidencia. Cuando falta commit, captura, confirmación o prueba reproducible, se indica expresamente. Los resultados colectivos de integración no se asignan exclusivamente a quien registró el último cambio. Las actividades relacionadas con Raspberry Pi Pico sin autor se asignan a Kevin Rincón según la instrucción del encargo y su trayectoria documentada; esta regla no convierte pendientes en tareas completadas.

Para las subsecciones de commits se contrastó el autor, el identificador abreviado, la fecha y el asunto del historial Git local con las atribuciones del informe consolidado y los registros. Se incluyen commits representativos y funcionalmente relacionados con los aportes descritos; se excluyen checkpoints y commits automáticos de sesiones de agente. Para normalizar las cifras, el conteo cuantitativo considera únicamente commits sin merge; los merges se conservan como evidencia histórica, pero no incrementan el total personal. Un commit acredita autoría registrada en Git, mientras que la relación entre ese cambio y el módulo se establece con su asunto y la documentación técnica.

La cuenta `valeld` conserva en Git la autoría formal del commit `a8baa7f`, que agregó la base inicial del frontend React/TypeScript/Vite y una referencia inicial del backend. Por confirmación del equipo, el trabajo contenido en ese commit fue realizado conjuntamente por Juan David Romero y Kevin Rincón. Se registra como aporte compartido y no se suma dos veces a los totales personales.

### Identidades y perfil documentado

| Integrante | Alias o nombre en fuentes | Eje de contribución recurrente |
|---|---|---|
| Kevin Rincón | `KevMasMas`; Kevin Rincon | Broker/red, firmware, distribución, validación de ejecutores y despliegue Pico. |
| Julián Romero | `JulianRomero17`; Julian Romero | Elementos y motor del editor, cliente MQTT web, firmware y aprovisionamiento. |
| Iván Prado | `IvanPrado23`; Ivan Felipe Prado Blanco | Conexiones/validaciones, UI, responsive, tutorial y aportes tempranos a Pico/protocolos. |
| Juan David Romero | `juandav08`/`Juandav08` | Editor visual, Petri, integración MQTT y conformidad de motores. |
| Juan Ramos | `jusraome` | Integración del demo, motor/orquestación, runtime MicroPython y documentación técnica. |
| Cuenta compartida | `valeld` | Base inicial del frontend y referencia del backend; trabajo realizado conjuntamente por Juan David Romero y Kevin Rincón. |

### Conteo normalizado de commits

El conteo usa el mismo criterio para todas las cuentas: commits sin merge. Los cambios posteriores al corte base se muestran por separado para conservar la lectura histórica del informe.

| Integrante o cuenta | Hasta el 7 nov. | Posteriores | Total al 24 nov. |
|---|---:|---:|---:|
| Kevin Rincón (`KevMasMas`) | 44 | 2 | 46 |
| Julián Romero (`JulianRomero17`) | 12 | 0 | 12 |
| Iván Prado (`IvanPrado23`) | 10 | 0 | 10 |
| Juan David Romero (`juandav08`/`Juandav08`) | 17 | 11 | 28 |
| Juan Ramos (`jusraome`) | 11 | 0 | 11 |
| Cuenta compartida `valeld` | 1 | 0 | 1 |

El commit de `valeld` se mantiene como una fila separada para que el total del repositorio sea auditable. Su contenido se atribuye conjuntamente a Juan David Romero y Kevin Rincón, sin duplicarlo en las cifras de sus alias personales.

## Matrices de seguimiento de aportes

Las siguientes matrices ofrecen una vista comparativa del trabajo registrado. Las asignaciones directas proceden de registros, informes individuales o commits enlazados en la documentación. Cuando el autor no está nombrado y la actividad se relaciona con Raspberry Pi Pico, Kevin Rincón figura como atribución documental indirecta de acuerdo con el criterio del informe. Las matrices resumen; el detalle técnico y las condiciones de evidencia aparecen en la evolución y en las secciones individuales.

### Integrantes y responsabilidades

Esta matriz resume el eje de responsabilidad más consistente a lo largo del historial. Las funciones se superponen en las integraciones: desarrollar un módulo y verificar su interacción con otros componentes son aportes diferentes y complementarios.

| Integrante | Responsabilidad principal | Alcance técnico documentado |
|---|---|---|
| Kevin Rincón | Red, firmware y distribución | Broker MQTT, scheduler/runtime Pico, particionamiento y disponibilidad de ejecutores, despliegue y configuración de placas. |
| Julián Romero | Elementos ejecutables y aprovisionamiento | Tipos de nodo y evaluación de código, cliente MQTT web, transporte/abstracciones de firmware e inventario/despliegue de placas. |
| Iván Prado | Conexiones e interfaz | Validación de puertos y canales, CodeMirror/panel de simulación, representación intermedia, controles unificados, responsive y tutorial. |
| Juan David Romero | Editor visual y conformidad | Canvas/aristas, Places/Transitions y evaluador Petri, puente MQTT-Service, vectores y pruebas cruzadas browser/MicroPython. |
| Juan Ramos | Motor y orquestación | Simulación frontend, sincronización del canvas, motor MicroPython/worker distribuido y documentación técnica final. |

### Actividades y responsables

La asignación se presenta por actividad concreta, no solo por rol general. La descripción de cada fila distingue la atribución directa de la indirecta y permite interpretar los resultados asociados.

| Actividad | Responsable | Implementación y resultado registrado |
|---|---|---|
| Validación de conexiones manuales | Iván Prado | Puertos predeterminados, compatibilidad booleana-numérica y unificación PETRI/TOKEN_FLOW; reconstrucción manual del circuito desde lienzo vacío. |
| Estabilidad visual del canvas | Juan David Romero | Rutas que respetan handles, etiquetas y waypoints estables; revisión de movimiento y persistencia del layout. |
| Motor de simulación y orquestador | Juan Ramos | Orden topológico, ciclos, propagación, estabilización y sincronización de tokens/valores; suite con 99 aserciones. |
| Elementos y ejecución aislada | Julián Romero | Service, Functional Block, Sample, Hold, Structural Block y Worker con límite temporal; pruebas de entradas y APIs restringidas. |
| Broker, runtime y estado distribuido | Kevin Rincón | Mosquitto, tareas cooperativas, deduplicación y reglas de disponibilidad; demo MQTT con LED y validación de mensajes. |
| IR, canales y conformidad | Iván Prado / Juan David Romero | Contrato, compilación, vectores y pruebas de semántica común entre navegador y MicroPython. |
| Documentación y trazabilidad | Juan Ramos | Cronología, matriz de evidencia, informes, guías reconciliadas y reverificación del corte de pruebas. |
| Actividades Pico sin autor nominal | Kevin Rincón (indirecto) | Asignación conforme al criterio solicitado y a su historial de firmware; se integra a su aporte y no acredita por sí misma pruebas físicas. |
| Cliente remoto sin autor ni commit | Julián Romero (indirecto) | Se vincula por afinidad funcional con el cliente MQTT web que sí tiene commit suyo; la documentación no permite tratar el trabajo remoto como autoría confirmada. |
| Prototipo Three.js sin commit | Julián Romero (indirecto, por descarte) | El informe histórico lo relaciona con él por descarte al mapear responsabilidades; se registra como atribución documental indirecta, sin presentarlo como desarrollo confirmado. |

### Módulos y funcionalidades desarrolladas

La tabla relaciona los módulos de producto con su función y los responsables documentados. La división refleja el código y los registros, mientras que la integración entre módulos fue transversal.

| Módulo | Responsable(s) | Función e implementación |
|---|---|---|
| Editor y aristas | Juan David Romero; Iván Prado | Canvas, conexiones tipadas, handles, rutas, etiquetas, waypoints, edición de código y panel de simulación. |
| Motor frontend | Juan Ramos; Julián Romero | Orquestación de nodos y canales, propagación, evaluación de elementos y ejecución aislada de JavaScript/Python. |
| Red de Petri | Juan David Romero; Iván Prado | Places con capacidad y tokens, Transitions y validación de arcos/condiciones; movimientos atómicos. |
| Cliente y puente MQTT | Julián Romero; Juan David Romero; Kevin Rincón | Transporte web y broker, contrato de mensajes, inyección de Service y comunicación navegador-Pico. |
| Runtime MicroPython | Kevin Rincón; Julián Romero; Iván Prado; Juan Ramos | Scheduler y tareas, transporte/plataforma, motor y worker, IR, canales y control de hardware. |
| Ejecución distribuida | Kevin Rincón; Juan David Romero; Juan Ramos | Asignación por bloque, fragmentación, ACK, canales remotos, estado agregado y ejecutores navegador/Pico. |
| Interfaz multi-ejecutor | Iván Prado; Kevin Rincón | Controles de ejecución, disponibilidad y diagnóstico, destinos por bloque, responsive y tutorial. |
| Aprovisionamiento y documentación | Julián Romero; Juan Ramos; Kevin Rincón; Juan David Romero | Manifiesto/checksum, inventario/respaldo/despliegue simulado, guías, configuración local de placas y manual para desarrolladores. |

### Fases, evidencias y resultados

Esta matriz organiza la historia por etapas técnicas, sin convertir el informe general en una lista de entregas. “Resultado” resume lo que consta en registros o informes; “evidencia” aclara si fue contrastado en código, pruebas automatizadas, ejecución declarada o hardware.

| Etapa técnica | Evidencia y responsables | Resultado documentado |
|---|---|---|
| Editor y circuito manual | Registros de conexiones, rutas y demo; Iván Prado y Juan David Romero | Place/Transition y canales de datos conectables; rutas y movimiento estabilizados; circuito reconstruido manualmente. |
| Motor frontend | Registros de motor, pruebas y revisiones; Juan Ramos, Julián Romero, Iván Prado | Propagación y evaluación Petri; ejecución de bloques; demos importables y pruebas de lógica. |
| MQTT y Pico | Contrato, logs y guía de demo; Kevin Rincón, Julián Romero, Iván Prado, Juan David Romero | Conexión WebSocket y mensajes válidos; acciones físicas LED y entrada al Service registradas. |
| Runtime y representación común | Registros de firmware, IR, vectores y suites; los cinco integrantes según submódulo | Motor MicroPython, tareas y canales; pruebas de escritorio y conformidad entre runtimes. |
| Distribución multi-ejecutor | Protocolo, commits y runners; Kevin Rincón, Juan David Romero, Juan Ramos | Ejecución distribuida en software y colaboración entre navegadores; pruebas físicas Pico-Pico y Pico-browser aún sin cierre documentado. |
| Consolidación y preparación | Plan/matriz final, paquete y guías; los cinco integrantes según módulo | UI unificada, tutorial, checksum y aprovisionamiento simulado; ciertas capturas responsive no están versionadas. |

### Pruebas e implementaciones

Las pruebas se interpretan según su alcance: un test unitario verifica una regla aislada; una suite de integración comprueba la comunicación entre módulos; una prueba visual/hardware depende de evidencia reproducible. Las cifras globales son resultados del equipo y no se presentan como producción exclusiva de una sola persona.

| Implementación o prueba | Responsable(s) | Cobertura y resultado |
|---|---|---|
| Conexiones y circuito manual | Iván Prado | Place/Transition, canales LCH/CCH y puertos; reconstrucción desde lienzo vacío registrada como exitosa. |
| Evaluador Petri | Juan David Romero | Seis escenarios: disparo normal, falta de token, salida llena, ciclo, conflicto y peso de arcos. |
| Motor y orquestación | Juan Ramos | 99 aserciones sobre grafo, ciclos, propagación, conflicto, estabilización, reset y sincronización con canvas. |
| Ejecución de bloques | Julián Romero | Expresiones, mapeo de entradas, APIs bloqueadas y timeout de Worker; ejecución JavaScript/Python aislada. |
| Integración MQTT | Juan David Romero; Kevin Rincón; Julián Romero | 8 pruebas MQTT focalizadas y 39 totales registradas; demo de LED, retorno de estado y validación de humedad. |
| Firmware y aprovisionamiento | Kevin Rincón; Julián Romero; Juan Ramos | Suites de firmware, dobles de hardware/reloj, deduplicación y filesystem simulado para proteger configuración local. |
| Verificación global final | Equipo; consolidación de Juan David Romero y Juan Ramos | 187 pruebas frontend y 169 firmware; lint, TypeScript y build aprobados, con una prueba frontend intermitente por timeout. |
| Ejecución distribuida física | Equipo de integración; coordinación de Juan David Romero | La documentación registra preparación de placas, pero Pico-Pico y Pico-browser no quedaron demostrados físicamente al corte. |

## Evolución técnica del proyecto

### Editor y simulación en navegador

La fase inicial se enfocó en el canvas, los elementos HiLeS, sus puertos y conexiones, importación/exportación, movimiento de nodos y una demostración de token. En septiembre se priorizó reconstruir manualmente el circuito desde un lienzo vacío: Places de espera/activo, Transitions de activar/desactivar, una entrada y una salida. El objetivo era ejecutar las transiciones de token y reflejar la salida en el circuito.

Durante septiembre se consolidó el motor frontend, reduciendo la dependencia del backend para simular. El motor propagaba señales entre elementos y resolvía la red de Petri, mientras el store sincronizaba tokens y valores con el canvas. Functional Blocks comenzaron con ejecución JavaScript aislada; luego se añadió Python en Pyodide dentro de un Web Worker terminable. La UI incorporó editor de código, pruebas de expresión y panel de simulación conectado al estado local.

### MQTT y runtime Pico

En octubre se añadió Mosquitto con MQTT/TCP y WebSocket, cliente MQTT en navegador y firmware MicroPython para Pico con conexión Wi-Fi. El flujo de demostración encendía, apagaba y hacía titilar el LED físico desde la web, y mostraba estado de retorno. Un segundo flujo inyectaba valores en un Service HiLeS y comprobaba su efecto en el circuito. El contrato MQTT validaba topics, JSON y tipos, rechazando entradas inválidas de forma comprensible.

La etapa siguiente hizo avanzar el runtime: scheduler cooperativo, tareas, transporte MQTT y motor MicroPython que consume modelos. Los dobles de hardware y de reloj permitieron probar lógica desde escritorio. La representación intermedia, los compiladores y vectores de conformidad fueron evolucionando para que el motor web y MicroPython interpretaran los mismos elementos y canales.

### Ejecución distribuida y consolidación del sistema

La fase posterior agregó colaboración por proyecto, presencia e identidad de participantes, asignación de bloques estructurales a ejecutores, fragmentación, ACK, canales remotos y estado agregado. Los runners de navegador permitieron probar distribución sin hardware; se prepararon modelos de semáforos distribuidos.

En la etapa de consolidación se unificaron los controles de ejecución, se separó el modo de conexión del destino de cómputo, se mejoró la disponibilidad y diagnóstico de ejecutores, se preparó el aprovisionamiento de nuevas placas y se añadió responsive y tutorial. La evidencia es desigual: varias funciones están verificadas en código y pruebas, algunas capturas visuales no están versionadas y Pico-Pico/Pico-navegador seguían pendientes como demostraciones distribuidas físicas. Un registro refiere preparación/inventario de dos placas en puertos COM5/COM8; se interpreta como avance de aprovisionamiento, no como cierre de la ejecución distribuida física.

## Aportes individuales

### Kevin Rincón (`KevMasMas`)

#### Responsabilidades

Su trayectoria pasa de la organización de demos y revisiones a broker/red, runtime Pico, empaquetado y ejecución distribuida. En la fase de consolidación fue responsable del estado único de ejecución y de las reglas para validar disponibilidad y compatibilidad de los ejecutores.

#### Desarrollos e implementación

- **Motor frontend y demos.** El informe individual le atribuye la eliminación del backend heredado durante el cambio a frontend-only, el cierre del motor web, el aislamiento de código entre bloques y el demo de parqueadero. Este modelo combina Service de vehículos/captura, Sample para tomar lecturas, Hold para retener el último valor y Functional Blocks que operan barreras mediante Places y Transitions.
- **Broker y conectividad.** Preparó Mosquitto para TCP y WebSocket, documentó puertos y configuración sin publicar secretos, y verificó pub/sub de terminal. En el registro de demo conectó la aplicación al broker, operó encender/apagar/titilar sobre la Pico y observó el retorno de estado.
- **Runtime MicroPython.** Kevin implementó el scheduler cooperativo (`Task`, `Scheduler`, `FakeClock`) y posteriormente trabajó en la integración de `EngineTask` en `main.py`, deduplicación, empaquetado, ejecución Python, watchdog y generalización del runtime. La implementación original del motor HiLeS MicroPython y de `EngineTask` corresponde a Juan Ramos en `1739c9a`; por tanto, esta parte se reconoce como una evolución compartida y no como autoría exclusiva de Kevin. El scheduler permite avanzar tareas de motor y red sin esperas bloqueantes largas; los dobles hacen reproducibles pruebas sin placa; la deduplicación evita repetir efectos ante retransmisiones QoS 1.
- **Distribución.** Trabajó en protocolo y particionador v3, integración de fragmentos y demos de semáforos. La arquitectura asigna bloques a ejecutores y coordina intercambio por canales remotos y acknowledgements.
- **Validación de ejecutores.** El commit `efab6eb` incorpora validación central de payload, proyecto, actividad, estado y capacidades, además de selector/despliegue y causas legibles de indisponibilidad. La actividad se mide con hora de recepción del navegador; las asignaciones se conservan si un ejecutor cae. El commit `6aac632` incluye fachada de control y generador/panel de configuración Pico.

#### Pruebas y resultados

Los registros MQTT informan operaciones físicas del LED, retorno de estado y entrada numérica 70 al Service de humedad; el texto “setenta” fue rechazado por tipo incompatible. Tras un ajuste del panel se reportaron 39 pruebas, lint y build aprobados. En la fase de consolidación se informaron 161 pruebas frontend al 4 de noviembre y pruebas de disponibilidad de ejecutores. La matriz todavía marcaba sin evidencia capturada la selección de dos Picos y la ejecución distribuida con ACK físicos.

#### Commits vinculados

Los siguientes commits del alias `KevMasMas` se relacionan con los cambios de producto y firmware descritos; se omiten actualizaciones administrativas y checkpoints:

- `8bbac7b`: importación y exportación JSON; `ef4b493` y `444ae4c`: primera versión del backend de demostración y circuito de movimiento de token.
- `cf9ee38`, `5362451`, `c632fcb`, `17a6bbb` y `1eda202`: refactor frontend-only, motor web y pruebas, aislamiento de código y demo de parqueadero/Python.
- `dd38309`, `7af5c98`, `5b86d90` y `f7a8ebf`: integración Mosquitto/Pico, cierre de comunicación, núcleo multitarea y reconexión MQTT.
- `dec6c68`, `8ce4e06`, `baadff6`, `d2b8e81` y `19ef63c`: preparación del despliegue físico, generalización del runtime, semáforos, protocolo/compilador distribuido y ensayo de integración.
- `f7cc9b6`, `efab6eb`, `6aac632` y `ae9ac32`: preparación multi-Pico, validación de ejecutores, gestión de dispositivos y visualización de destinos.

#### Integración del aporte y atribución indirecta

Su trabajo conecta las capas de comunicación, ejecución y hardware: el broker MQTT habilita el intercambio con las placas, el runtime procesa las tareas del modelo y las reglas de disponibilidad permiten coordinar ejecutores distribuidos. La validación del estado y el generador de configuración completan el recorrido desde la selección del dispositivo hasta su preparación. Los cambios del generador se atribuyen a Kevin de acuerdo con el commit correspondiente.

Los registros contienen actividades relacionadas con Raspberry Pi Pico que no identifican responsable. Conforme al criterio de asignación y a la trayectoria de Kevin en broker, firmware, scheduler y despliegue, se integran aquí en su contribución. Esta relación es indirecta: no se les asigna un commit personal ni se toma como prueba de una ejecución física no documentada.

*Base documental: informe por persona; registros históricos del proyecto; matriz requisito-evidencia e informe final.*

### Julián Romero (`JulianRomero17`)

#### Responsabilidades

Comenzó con el backend de demo; luego desarrolló elementos funcionales y ejecución de código, cliente MQTT web, componentes del runtime Pico y aprovisionamiento de placas.

#### Desarrollos e implementación

- **Backend de demostración.** Verificó endpoints de estado/entrada/reinicio, cola FIFO, movimiento de token y publicación de salida. El plan le asignó confirmar que entradas repetidas no generaran tokens duplicados.
- **Elementos del modelo y ejecución segura.** Implementó Service, Functional Block, Sample, Hold y Structural Block. El ejecutor mapea valores por nombre de puerto, evalúa expresiones, reporta errores y bloquea APIs restringidas. Para código de mayor complejidad creó un Web Worker terminable con límite de tiempo; se preserva evaluación síncrona para expresiones simples y vía asíncrona para código aislado.
- **Cliente MQTT web.** El cliente del navegador desacopla el editor del transporte y aporta publicación/suscripción con pruebas; el informe individual registra 31/31 tests.
- **Firmware.** Desarrolló tarea LED no bloqueante, doble de prueba, abstracción de plataforma y transporte MQTT. La tarea no bloqueante permite que red y control físico progresen juntos; el doble permite ensayar comportamiento sin dispositivo.
- **Identidad y aprovisionamiento.** En `c61dbad` se agregó modelo de placa y versión de firmware al estado publicado, manifiesto SHA-256 por archivo y modos Inventory/Backup/Deploy que preservan `config_local.py` y `umqtt/`. Se añadió prueba con filesystem simulado y documentación del procedimiento.

#### Pruebas y resultados

Los registros de elementos describen pruebas de expresiones, humedad, bloqueo de `fetch`, `window`, `document`, `eval`/`Function` y timeout del worker. El cliente MQTT obtuvo 31 pruebas aprobadas. En la etapa de cierre se reportó PASS para aprovisionamiento simulado y coincidencia del checksum del paquete.

#### Commits vinculados

El historial de `JulianRomero17` relaciona los siguientes cambios con su trabajo funcional:

- `05bc9f9`, `eaf6bcb` y `0efa003`: ajustes a figuras, alineación de conectores, conexiones a componentes y menú de navegación.
- `4bc57c8`: elementos de modelo y ejecución de bloques; `04291f8`: cliente MQTT web.
- `8173811`: tareas de firmware; `9417dea`: avance de colaboración/documentación asociado a su responsabilidad de ese período.
- `c61dbad`: identidad de placa, versión de firmware, manifiesto y aprovisionamiento.

#### Integración del aporte y atribuciones indirectas

Sus implementaciones enlazan la semántica del modelo con las interfaces de usuario y el hardware: los elementos HiLeS y los workers ejecutan lógica aislada, el cliente MQTT comunica navegador y broker, y las herramientas de aprovisionamiento identifican y preparan placas preservando su configuración local. Las pruebas de expresiones, transporte y filesystem simulado ofrecen comprobaciones diferenciadas de esas capas.

La documentación también menciona un cliente remoto desarrollado sin responsable nominal ni commit. Por afinidad funcional con el cliente MQTT web que sí aparece en sus contribuciones, esta actividad se vincula indirectamente con Julián, sin presentarla como autoría confirmada. El informe histórico asigna por descarte a Julián un prototipo Three.js sin commit asociado; se consigna como atribución indirecta, no como desarrollo verificable en Git.

*Base documental: informe por persona; registro del motor; registros históricos; plan y matriz de requisitos.*

### Iván Prado (`IvanPrado23`)

#### Responsabilidades

Sus responsabilidades documentadas abarcan validación de conexiones, UI del editor de código y panel de simulación, trabajo Pico temprano y, durante la consolidación, controles unificados, responsive y tutorial.

#### Desarrollos e implementación

- **Validación de conexiones.** En la fase inicial reprodujo fallos de Place-Transition, entrada booleana a condición y salida de Transition. El registro describe puertos por defecto Condition/Action para Transition e In/Out para Service, compatibilidad booleana-numérica y unificación de validación PETRI/TOKEN_FLOW. Se verificó reconstruyendo desde lienzo vacío y trazando arcos LCH y CCH.
- **Editor y panel de simulación.** Durante la consolidación del motor instaló CodeMirror 6, integró el editor en propiedades, reescribió SimulationPanel para consumir el store local, añadió badges de errores/valores/lenguaje y ErrorBoundary, eliminó importaciones backend obsoletas y resolvió errores de tipado para el build integral.
- **Pico y representación intermedia.** El informe histórico le atribuye implementación Pico W con MicroPython, Wi-Fi, `umqtt.simple`, control del LED y reconexión (evidencia solo de registro). Después le relaciona con contrato/IR v1, compilador, vectores y bus Node; posteriormente con IR v2, canales, protocolo de proyecto y worker MicroPython multi-Pico.
- **Interfaz unificada.** El commit `ba76303` incluye botones globales únicos Iniciar/Paso/Detener/Reiniciar, separación entre configuración de conexión y destino de ejecución, tokens múltiples en Places, estado obsoleto de nodos, menú compacto y responsive.
- **Tutorial.** Implementó recorrido guiado de 12 pasos desde proyecto/conexión hasta ejecutores, asignación, despliegue, entradas y operación.

#### Pruebas y resultados

La reconstrucción manual de conexiones se registró como exitosa. Para la UI del motor se informó build completo de TypeScript y revisión interactiva. En la fase final se declararon 180 pruebas y seis viewports sin desbordamiento global. La matriz precisa que las capturas visuales no estaban versionadas; controles y títulos del tutorial sí se verificaron en código.

#### Commits vinculados

Los commits del alias `IvanPrado23` muestran la progresión desde conexiones y UI hasta representación intermedia y responsive:

- `b4184fe`: ajuste de espacio en los componentes; `62073ba` y `846135f`: conexiones manuales y sus validaciones.
- `0ce01f1`: alternancia JS/Python, clase PUB/SUB y dependencias del editor.
- `723a7d6`: contrato, compilador, vectores y especificación normativa.
- `20227da` y `89ccefc`: pruebas y cambios funcionales del IR/canales; `f0ccc39`: worker MicroPython multi-Pico y verificación.
- `ba76303`: interfaz unificada, responsive y tutorial actualizado.

#### Integración del aporte

Su trabajo contribuye tanto a la construcción del modelo como a su operación: la validación de puertos permite formar circuitos coherentes; CodeMirror y el panel conectado al store exponen código y estado; la representación intermedia y el worker llevan esa lógica a MicroPython; y los controles unificados y el tutorial ordenan el flujo de ejecución para el usuario. Las pruebas de construcción manual, compilación y suites respaldan estos componentes. En la demostración MQTT, la implementación Pico y el registro audiovisual fueron contribuciones complementarias de integrantes distintos.

*Base documental: informe por persona; registros históricos de presentación, motor y MQTT; matriz de requisitos.*

### Juan David Romero (`juandav08`/`Juandav08`)

#### Responsabilidades

Editor visual y modelo, estabilidad de rutas, semántica Petri, integración MQTT y conformidad entre runtimes. En la etapa de cierre asumió conformidad browser/MicroPython e integración distribuida.

#### Desarrollos e implementación

- **Canvas y aristas.** El historial le atribuye modelo, componentes, conexiones, zoom, undo/redo y figura de referencia. En la fase de estabilización visual reemplazó rutas que alteraban extremos por smooth-step respetando coordenadas de handles, corrigió dirección de flechas y evitó pasar props internos de React Flow al SVG. Etiquetas se separaron visualmente de las rutas y los waypoints se conservaron al mover/guardar. También se protegió el layout frente a respuestas runtime.
- **Red de Petri.** Implementó Places con capacidad, consumo, producción y reset; Transitions con condición booleana y disparo; evaluador con comprobación de habilitación, pesos y capacidad antes de mover tokens atómicamente. Conflictos y salidas llenas conservan el marcado y evitan desbordamiento. La fábrica mantiene extensibilidad.
- **MQTT y Service.** Definió tipos/ejemplos para topics, descartó JSON/topics/campos inválidos y mostró diagnósticos en español. `MqttHilesBridge` inyecta mensajes mediante API pública de Service sin reemplazar BusObserver y puede publicar salidas del motor.
- **Conformidad distribuida.** En `d15d5a0` se añadieron pruebas de IR v2 entre navegador y MicroPython y pruebas de CCH/DCH/LCH entre motores de fragmento. Vectores 04/05 cubren tokens, pesos, capacidad, conflictos, Services y tipos; la matriz de conformidad asocia expectativas con suites.
- **Integración de interfaz.** Se corrigió el ciclo de visibilidad del tutorial durante la solicitud de nombre y el estado de paneles para evitar bucles de renderizado. También se documentó colaboración LAN con dos navegadores, presencia y sincronización de nombres.
- **Manual para desarrolladores, posterior al corte base.** Entre el 23 y el 24 de noviembre desarrolló y auditó `docs/MANUAL_DESARROLLADORES.md`: visión técnica, entorno, estructura, arquitectura frontend, motor y modelos HiLeS, colaboración, MQTT, firmware, flujos de desarrollo, alcance local, validación física y revisión profesional final. Esta contribución está respaldada por 11 commits propios posteriores al 7 de noviembre.

#### Pruebas y resultados

El evaluador Petri se probó en seis casos: disparo, falta de token, salida llena, ciclo, conflicto y arcos ponderados. MQTT reportó 8/8 pruebas focalizadas y 39/39 totales, lint y build; una prueba integrada movió el token con humedad 70. Al corte final se reportaron 187 pruebas frontend y 169 firmware, lint, TypeScript y build. La matriz considera conformidad de software verificada, mientras runners sobre broker real y colaboración LAN quedan declarados en algunos apartados. Pico-browser y Pico-Pico físicos seguían pendientes.

#### Commits vinculados

El historial de `juandav08`/`Juandav08` documenta cambios en el editor, simulación Petri, puente MQTT y conformidad:

- `79cc495`, `868cc3b`, `74ce822`, `a4204c8` y `3a59368`: componentes/conexiones iniciales, correcciones visuales, figura 29, controles de edición, persistencia y zoom.
- `883c197`: rutas y movimiento; `8340cb6`: Places, Transitions y lógica Petri.
- `069ad92` y `831b79c`: integración de mensajes MQTT con Services y alineación del contrato web con la Pico.
- `44baa29`: reorganización de la barra superior y paneles; `25b5dd7` y `a3302a9`: integración de pruebas distribuidas y colaboración adaptable a móvil.
- `d15d5a0`: conformidad distribuida y correcciones al tutorial colaborativo.
- `fb56495`, `f6bdefe`, `ce895a8`, `463e9e7`, `5ff96ba`, `3a421de`, `3a9a7db`, `0b832f4`, `a419d33`, `c953eb2` y `2f3f773`: creación, ampliación, auditoría y cierre profesional del manual para desarrolladores.

#### Integración del aporte

Su trabajo enlaza la interacción gráfica con la semántica de ejecución: los cambios de rutas y waypoints mantienen legibles las conexiones, el evaluador Petri aplica reglas de capacidad y conflicto, y el puente MQTT permite que señales externas entren y salgan por Services. Los vectores y pruebas de conformidad llevan esas reglas a los motores de navegador y MicroPython, facilitando la integración por fragmentos. La atribución se mantiene según la correspondencia entre alias y nombre establecida en los informes consolidados.

*Base documental: informe por persona; registros de motor, MQTT y presentación; matriz e informe final.*

### Juan Ramos (`jusraome`)

#### Responsabilidades

Integración front-back del demo inicial, motor/orquestación frontend, motor MicroPython y, más adelante, worker de navegador distribuido. En la etapa final su responsabilidad fue documentación y trazabilidad, sin código de producción.

#### Desarrollos e implementación

- **Integración inicial.** En la primera etapa conectó los botones de entrada y reinicio con el backend real, protegió el documento guardado frente a cambios runtime y centralizó errores de backend desconectado para no presentar estado antiguo como vigente.
- **Motor frontend.** Definió tipos y cola auditable de eventos; ordenamiento topológico (Kahn), detección DFS de ciclos y propagación push por canales. El orquestador crea instancias lógicas por nodo, inyecta entradas en Services, ejecuta ciclos de datos/Petri, detecta estabilización con snapshots, restaura el estado inicial y vuelca valores/tokens sobre canvas. Se dejó un ejecutor inyectable para futura ejecución asíncrona.
- **Cobertura y limitaciones.** Registró pruebas de orden determinista, ciclos/autociclos, entradas inválidas, circuito integral, guarda falsa, ida/vuelta, conflicto, oscilación y límite de pasos, reinicio y sincronización sin loop. Se reportaron 99 aserciones Node, TypeScript y ESLint. También se anotó que el motor era síncrono y no propagaba código que requiriera Web Worker; el build global estaba bloqueado entonces por integración UI fuera de su alcance.
- **Runtime Pico y ejecución distribuida.** Juan Ramos implementó originalmente el motor HiLeS MicroPython y `EngineTask` en `1739c9a`. Kevin Rincón realizó después su integración en `main.py`, empaquetado y generalización junto con otras piezas del runtime. Juan Ramos continuó con el motor v2, canales, retardos y demo de cuatro semáforos; más adelante desarrolló worker de navegador v3, panel de ejecutores, colaboración y tutorial, conectando ejecución local de navegador con el protocolo distribuido.
- **Documentación.** En la fase final produjo cronología, informes individuales, matriz de requisitos, informe final y guion; actualizó guías de instalación/configuración/arquitectura, reconcilió README y verificó suites, checksum y aprovisionamiento. Su responsabilidad en esa fase era documental, sin asumir módulos de producción.

#### Pruebas y resultados

El motor registra 99 aserciones y revisión de tipos/lint, con limitaciones identificadas sin ocultarlas. En la fase final se registró documentación reconciliada y reverificación del corte de pruebas: 187 frontend y 169 firmware; una prueba frontend tenía timeout intermitente. Las cifras globales no se presentan como autoría individual.

#### Commits vinculados

El historial de `jusraome` vincula a Juan Ramos con el motor, el firmware y la documentación técnica:

- `818ad45`: integración front-back, mensajes y protección del documento; `6fa3dac`: motor de simulación y orquestación.
- `1739c9a`: motor HiLeS MicroPython, `EngineTask` y pruebas de escritorio; `d0ed8fb`: motor IR v2, canales, retardos y semáforos.
- `9135cf0`: worker de navegador v3, panel de ejecutores, colaboración y tutorial.
- `e8c6a09`: cronología, informes, matriz de evidencia y guías reconciliadas.

#### Integración del aporte

Su contribución enlaza el motor de simulación con la experiencia del editor y, posteriormente, con los runtimes distribuidos. La cola auditable, el ordenamiento del grafo y la detección de estabilización estructuran la ejecución; las pruebas cubren transiciones, conflictos, ciclos y sincronización del canvas. El runtime MicroPython y los workers de navegador extienden ese trabajo a distintos ejecutores, mientras la cronología, matriz e informes consolidan la evolución técnica del equipo. La responsabilidad documental se atribuye a Juan Ramos; la autoría de los commits se conserva según el historial registrado.

*Base documental: informe por persona; registro del motor; planes e informes históricos del proyecto.*

## Resultados de equipo y límites de evidencia

El producto al corte incluye editor, colaboración por proyecto, ejecución distribuida en software, firmware MicroPython general y herramientas de configuración/despliegue. Se reportaron 187 pruebas frontend y 169 firmware, lint, TypeScript y build aprobados, con una prueba frontend intermitente. Las pruebas de conformidad software aparecen verificadas; la auditoría visual responsive se apoya en capturas no versionadas; aprovisionamiento fue probado sobre filesystem simulado; y la ejecución física Pico-browser/Pico-Pico seguía pendiente. El registro de placas en COM5/COM8 prueba preparación/inventario, no una demostración distribuida completa.

La matriz también advierte que `output/hiles-pico-w-deploy/config_local.py` estaba versionado, por lo que no podía darse por cerrada la auditoría de secretos sin confirmación responsable. Se registra esta limitación sin reproducir ningún valor de configuración.

## Conclusiones

La evolución documentada va del editor y demo de tokens al motor frontend, ejecución segura de código, integración MQTT, runtime MicroPython, representación intermedia y ejecución distribuida multi-ejecutor. Los perfiles individuales son complementarios: Kevin Rincón en broker/red, firmware y distribución; Julián Romero en elementos ejecutables, MQTT y aprovisionamiento; Iván Prado en conexiones, UI, responsive y tutorial; Juan David Romero en editor visual, Petri, puente MQTT, conformidad y el manual para desarrolladores incorporado después del corte base; y Juan Ramos en motor/orquestación, runtime y documentación de consolidación hasta la entrega 8. La base inicial publicada mediante `valeld` se reconoce como trabajo conjunto de Juan David Romero y Kevin Rincón.

Las actividades sin autor explícito relacionadas con Raspberry Pi Pico se integran en la contribución de Kevin Rincón como atribución documental indirecta. El cliente remoto sin responsable nominal y el prototipo Three.js sin commit se consignan dentro del aporte de Julián Romero como atribuciones indirectas basadas en la afinidad funcional y en la asignación histórica por descarte, respectivamente. Ninguna de estas atribuciones se presenta como autoría confirmada por commit.

Las reservas sobre commits, registros faltantes, capturas ausentes y pruebas físicas se mantienen para no sobredimensionar el resultado. El equipo alcanzó una base de software ampliamente probada y herramientas de preparación de placas; la evidencia disponible no permite afirmar que la ejecución distribuida multi-Pico estuviera físicamente demostrada al corte.

## Documentación principal consultada

- Planes de presentación, planes de implementación y registros históricos del proyecto (agosto-noviembre de 2026).
- Registros técnicos del motor frontend, Petri, MQTT y firmware MicroPython.
- Cronología, matriz requisito-evidencia, informes por persona e informe final de cierre.
- Historial Git local del proyecto HiLeS Web, consultado para verificar autor, fecha, hash abreviado y asunto de los commits citados.
