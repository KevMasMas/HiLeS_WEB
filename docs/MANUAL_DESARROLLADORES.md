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
| 1. Visión técnica | Pendiente | `README.md` y arquitectura |
| 2. Preparación del entorno | Pendiente | Guía de replicación |
| 3. Estructura del repositorio | Pendiente | Código actual |
| 4. Frontend | Pendiente | `frontend/src/` |
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

_Pendiente: explicar el objetivo del producto y el tipo de sistemas que permite
modelar sin asumir conocimientos previos del repositorio._

### 1.2 Capacidades principales

_Pendiente: modelado jerárquico, simulación, colaboración, distribución entre
navegadores y Raspberry Pi Pico W, importación y exportación JSON._

### 1.3 Dos ejes independientes

_Pendiente: diferenciar colaboración de edición y destino de ejecución._

### 1.4 Arquitectura resumida

_Pendiente: incluir un diagrama navegador ↔ Mosquitto ↔ navegadores/Picos y
explicar por qué no existe un backend HTTP tradicional._

## 2. Preparación del entorno de desarrollo

### 2.1 Requisitos

_Pendiente: versiones verificadas de Git, Node.js, npm, Python, Mosquitto,
MicroPython y herramientas opcionales para Pico._

### 2.2 Clonar e instalar

_Pendiente: comandos desde un PC limpio, ubicación correcta de `frontend/` y
uso de `npm ci`._

### 2.3 Configuración local

_Pendiente: `.env.local`, puertos `5173`, `1883` y `9001`, y reglas para no
publicar credenciales._

### 2.4 Arranque diario

_Pendiente: orden de inicio de Mosquitto y Vite, acceso local y acceso desde
otro dispositivo de la LAN._

### 2.5 Comprobación mínima

_Pendiente: checklist de página accesible, broker conectado y prueba entre dos
navegadores sin hardware._

## 3. Estructura del repositorio

### 3.1 Mapa de carpetas

_Pendiente: describir `frontend/`, `firmware/`, `infrastructure/`, `scripts/`,
`docs/`, `output/` y `entregas/`._

### 3.2 Código fuente frente a artefactos generados

_Pendiente: explicar qué se edita manualmente, qué se genera y qué archivos
locales nunca deben subirse._

### 3.3 Dónde empezar según el tipo de cambio

_Pendiente: tabla problema → carpeta → pruebas → documentación relacionada._

## 4. Arquitectura del frontend

### 4.1 Punto de entrada y composición general

_Pendiente: Vite, React y montaje del editor._

### 4.2 Editor y Canvas

_Pendiente: nodos, conexiones, selección, zoom, Structural Blocks y relación
padre/hijo._

### 4.3 Features

_Pendiente: responsabilidades de `editor`, `collaboration`, `distributed`,
`simulation`, `mqtt`, `onboarding` y `setup`._

### 4.4 Stores y estado

_Pendiente: Zustand, estado del documento, simulación, proyecto compartido y
ejecución distribuida._

### 4.5 Services

_Pendiente: MQTT, proyectos, IR, criptografía y transporte distribuido._

### 4.6 Interfaz responsive y accesibilidad

_Pendiente: viewports admitidos, paneles mutuamente excluyentes, teclado,
foco, tutorial y criterios visuales._

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
