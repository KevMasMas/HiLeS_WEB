# Matriz requisito → evidencia — entrega 8

**Responsable:** Persona 5
**Corte:** `d15d5a0` (`multi-pico`), 7 de noviembre de 2026.

## Leyenda de estado

| Estado | Significado |
|---|---|
| **Verificado** | Persona 5 lo reprodujo sobre `d15d5a0` o lo comprobó directamente en el código o archivo citado |
| **Declarado** | Existe commit y entrada de registro, pero Persona 5 no pudo reproducirlo (prueba visual, broker o hardware no disponibles) |
| **Pendiente** | No existe evidencia; no debe presentarse como terminado |
| **Inconsistente** | La casilla del plan está marcada, pero la evidencia la contradice o no la sostiene |

## 1. Alcance P0 (plan, sección 3)

| # | Requisito | Responsable | Estado | Evidencia |
|---|---|---|---|---|
| P0-1 | Auditar descubrimiento y validación de ejecutores | Persona 1 | Declarado | Registro 4 nov; `efab6eb` |
| P0-2 | Validación central de estados Pico/navegador con pruebas | Persona 1 | **Verificado** | `executorAvailability.ts` + `.test.ts`; 187 pruebas frontend |
| P0-3 | Ver `pico:pico01w` y `pico:pico02w` seleccionables en `proyecto-hl950c` | Persona 1 | Pendiente | Sin captura ni registro visual |
| P0-4 | Desplegar Pico ↔ Pico y registrar ambos ACK | Personas 1 y 4 | Pendiente | No se detectó hardware (registro 6 nov) |
| P0-5 | Eliminar la duplicación `Local/Pico`, `Pico/MQTT` y controles repetidos | Persona 3 | **Verificado** | `TopBar.tsx` contiene los únicos botones `Iniciar/Paso/Detener/Reiniciar`; `DistributedPanel.tsx:233` remite a la barra. `useSimulationStore.modoEjecucion` sigue en el código, pero ningún componente lo modifica (compatibilidad interna permitida por el plan) |
| P0-6 | Estado único de conexión y ejecución | Personas 1 y 3 | **Verificado** | `executionControl.ts` consumido por `TopBar.tsx` |
| P0-7 | Sin desbordamiento en escritorio, tablet y celular | Persona 3 | Declarado | Registro: auditoría CDP en 6 viewports; capturas no versionadas |
| P0-8 | Scroll interno solo donde hace falta | Persona 3 | Declarado | Igual que P0-7 |
| P0-9 | Tutorial con el flujo proyecto → conexión → ejecutores → asignación → despliegue → entrada → ejecución | Persona 3 | **Verificado** | `tutorialSteps.ts`: 12 pasos con esos títulos |
| P0-10 | Todos los elementos y los tres canales en browser y MicroPython | Persona 4 | **Verificado** (software) | `ConformidadIrV2.test.ts`, vectores 01–05; firmware 169/169 |
| P0-11 | Varios tokens y cantidad visible | Personas 3 y 4 | **Verificado** (software) | Vector 04; `PlaceTokenView.test.tsx` |
| P0-12 | Paquete canónico idéntico para Pico W y Pico 2 W | Persona 2 | Pendiente (placas) | El paquete existe y su hash coincide; falta comprobarlo en ambas placas |
| P0-13 | Inventariar, respaldar y sincronizar ambas placas | Persona 2 | Pendiente | Solo la prueba sobre filesystem simulado (`test-pico-provisioning.ps1`: PASS) |
| P0-14 | Configuración validada desde la aplicación sin escribir Python | Personas 1 y 2 | **Verificado** (software) | `PicoSetupPanel.tsx`, `picoConfig.test.ts` (`pico03w`) |
| P0-15 | Matriz mínima automática, visual y física con evidencia | Persona 4 | Parcial | Automática verificada; visual declarada; física pendiente |
| P0-16 | Documentación de instalación, configuración, uso, recuperación y demo | Persona 5 | **Verificado** | Ver sección 5 |

## 2. Matriz de pruebas obligatoria (plan, sección 13)

| Prueba | Browser ↔ Browser | Pico ↔ Browser | Pico ↔ Pico |
|---|---|---|---|
| Registro de ejecutores | Declarado (runner MQTT real, Persona 4) | Pendiente | Pendiente |
| Asignación colaborativa | Declarado | Pendiente | Pendiente |
| Fragmentos y ACK | Declarado (cuatro ACK) | Pendiente | Pendiente |
| CCH / DCH / LCH remoto | **Verificado** en software (`ConformidadCanalesDistribuidos.test.ts`) | Pendiente | Pendiente |
| Entrada por Service | Declarado (`5 → 6`) | Pendiente | Pendiente |
| Functional Block Python | **Verificado** en software (vectores) | Pendiente | Pendiente |
| Varios tokens | **Verificado** en software (vector 04) | Pendiente | Pendiente |
| Reinicio | **Verificado** en software (los vectores se repiten tras reiniciar) | Pendiente | Pendiente |
| Desconexión / reconexión | Declarado (caída de `browser:c`) | Pendiente | Pendiente |
| Estado agregado igual en dos colaboradores | Declarado (dos navegadores por LAN) | Pendiente | Pendiente |

> En el runner de red, los ejecutores `pico:*` son dobles en Node.js. No cuentan como Pico real (plan, sección 17).

### Verificaciones generales

| Verificación | Plan | Estado | Resultado de Persona 5 sobre `d15d5a0` |
|---|---|---|---|
| Suite frontend | [x] | **Verificado con observación** | De 11 corridas completas, 3 aprobaron 187/187 y 8 terminaron 186/187 por timeout (5 s) en `PanelDock.test.tsx:132`. El archivo aislado aprueba 7/7 |
| Suite firmware | [x] | **Verificado** | `Ran 169 tests … OK` |
| ESLint | [x] | **Verificado** | Código de salida 0 |
| TypeScript | [x] | **Verificado** | `tsc -b` sin errores |
| Build de producción | [x] | **Verificado** | `vite build` correcto; advertencia de chunk > 500 kB (no bloqueante) |
| `git diff --check` | [x] | **Verificado** | Sin errores |
| Paquete Pico por checksum | [x] | **Verificado** | SHA-256 `3e89069cc208124ca6e1abc310614dcf826c07002307c66336e4318166692921`, 33 archivos |
| Auditoría de secretos | [x] | **Inconsistente** | `output/hiles-pico-w-deploy/config_local.py` está versionado en Git (último cambio `19ef63c`). Persona 5 no abrió su contenido; debe confirmarlo el responsable del paquete |

## 3. Criterios de aceptación final (plan, sección 15)

| Criterio | Plan | Estado real | Evidencia o motivo |
|---|---|---|---|
| Dos Picos reales seleccionables en el proyecto correcto | [ ] | Pendiente | P0-3 |
| Pico ↔ Pico con un flujo de datos completo | [ ] | Pendiente | Sin hardware |
| Pico ↔ navegador con un flujo de datos completo | [ ] | Pendiente | Sin hardware |
| Sin dos sistemas de controles para la misma ejecución | [x] | **Verificado** | P0-5 |
| Modo de conexión distinto del destino de un bloque | [x] | **Verificado** | `MqttPanel.tsx` y `AssignmentSelector.tsx` |
| Conformidad de todos los elementos (software) | [x] | **Verificado** | P0-10; falta repetirla sobre Pico física |
| Varios tokens representados y ejecutados | [x] | **Verificado** (software) | P0-11 |
| Sin desbordamiento horizontal global | [x] | Declarado | Capturas no versionadas |
| Tutorial coincide con la interfaz | [x] | **Verificado** | Pasos y botones contrastados con `TopBar.tsx` y `DistributedPanel.tsx` |
| Ambas Picos con paquete canónico y configuración propia | [ ] | Pendiente | P0-12, P0-13 |
| Nueva Pico configurable sin escribir Python | [x] | **Verificado** (software) | P0-14 |
| Ningún secreto en Git, URL, retained ni capturas | [x] | **Inconsistente** | Ver auditoría de secretos |
| Pruebas, build y documentación aprobados y registrados | [ ] | Parcial | Pruebas y build verificados con la observación de la prueba intermitente; documentación reconciliada por Persona 5 |

## 4. Tareas de Persona 5 (plan, sección 10)

| Tarea | Estado | Evidencia |
|---|---|---|
| Leer planes y registros de todas las entregas | Terminada | Referencias en `CRONOLOGIA_PROYECTO.md` |
| Cronología por fecha, objetivo, persona y commit | Terminada | `CRONOLOGIA_PROYECTO.md` |
| Informe por persona | Terminada | `INFORMES_POR_PERSONA.md` |
| Diferenciar trabajo histórico, de esta entrega y pendiente | Terminada | `INFORMES_POR_PERSONA.md`, `INFORME_FINAL_ENTREGA_8.md` §4 |
| Contrastar afirmaciones con Git y pruebas | Terminada | Este documento |
| Mantener actualizado el registro | Terminada al corte | `REGISTRO_CAMBIOS.md` |
| Reconciliar documentación y eliminar instrucciones obsoletas | Terminada | `INFORME_FINAL_ENTREGA_8.md` §6 |
| Registrar hashes, versiones, resultados y limitaciones sin secretos | Terminada | `INFORME_FINAL_ENTREGA_8.md` §2–§3 |
| Arquitectura, instalación, uso y recuperación | Terminada | `docs/architecture/ARQUITECTURA_SISTEMA.md`, `README.md`, `docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md` |
| Flujo para agregar otra Pico, configurar la red y elegir ejecutores | Terminada | `docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md` |
| Informe final y guion de demostración | Terminada | `INFORME_FINAL_ENTREGA_8.md`, `GUION_DEMOSTRACION.md` |
| Tabla requisito → prueba → responsable | Terminada | Este documento |

## 5. Documentación del sistema

| Tema | Documento vigente |
|---|---|
| Visión general, inicio rápido y estado | `README.md` |
| Arquitectura completa | `docs/architecture/ARQUITECTURA_SISTEMA.md` |
| Arquitectura del firmware | `docs/architecture/ARQUITECTURA_PICO.md` |
| Instalación completa en Windows | `docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md` |
| Agregar otra Pico, red y ejecutores | `docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md` |
| Preparar y probar placas físicas | `docs/mqtt/GUIA_PRUEBA_PICO_W.md` |
| Ensayo sin Pico | `docs/mqtt/GUIA_ENSAYO_REMOTO_SIN_PICO.md` |
| Protocolo distribuido | `docs/mqtt/PROTOCOLO_EJECUCION_DISTRIBUIDA_V3.md` |
| Conexión al broker | `docs/mqtt/FICHA_CONEXION_MQTT.md` |
| Demostración | `entregas/entrega-8-6-noviembre/GUION_DEMOSTRACION.md` |
