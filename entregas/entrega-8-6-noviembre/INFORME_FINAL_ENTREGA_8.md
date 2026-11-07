# Informe final — entrega 8 (6 de noviembre de 2026)

**Redacta:** Persona 5 (documentación y trazabilidad).
**Rama y commit evaluados:** `multi-pico` @ `d15d5a0`, igual a `origin/multi-pico`. Base de la entrega: `f7cc9b6`.
**Fecha de verificación:** 7 de noviembre de 2026.
**Regla aplicada:** solo se da por terminado lo que tiene commit y prueba o evidencia. Una prueba de software no sustituye una física, y un doble de protocolo no cuenta como Pico real.

## 1. Resumen

La entrega convirtió la base multi-Pico en una interfaz única:

- un solo juego de controles en la barra superior;
- el modo de conexión, separado del destino de cada bloque;
- validación central de ejecutores;
- tokens `×N`;
- tutorial de 12 pasos;
- generador de `config_local.py`.

También se demostró en software la paridad Browser ↔ MicroPython para todos los elementos y canales.

**No se alcanzó** la parte física: ninguna Pico real fue seleccionada ni desplegada durante la entrega, y Pico ↔ Pico y Pico ↔ navegador siguen pendientes. Según el plan (§15), la entrega **no cumple todavía los criterios de aceptación final** que exigen hardware.

| Bloque | Estado |
|---|---|
| Interfaz única, conexión frente a destino, tutorial | Terminado (software y código verificados) |
| Validación de ejecutores y controles únicos | Terminado (software) |
| Conformidad de elementos, canales y tokens | Terminado en software |
| Browser ↔ Browser | Declarado aprobado por Persona 4 sobre broker real |
| Generador de configuración y paquete canónico | Terminado en software; placas pendientes |
| Pico ↔ Pico y Pico ↔ navegador | **Pendiente** |
| Responsive en seis viewports | Declarado; capturas no versionadas |
| Documentación | Reconciliada por Persona 5 |

## 2. Versiones y hashes

| Elemento | Valor |
|---|---|
| Commit de la entrega | `d15d5a0f86e7a1c2718547164a09ba41b2e23722` |
| Commits de la entrega | `efab6eb`, `6aac632` (Persona 1), `ba76303` (Persona 3), `c61dbad` (Persona 2), `d15d5a0` (Persona 4) |
| Paquete Pico | `output/hiles-pico-w-deploy.zip`, 33 archivos, 310 001 bytes sin comprimir |
| SHA-256 del paquete | `3e89069cc208124ca6e1abc310614dcf826c07002307c66336e4318166692921`, igual a `output/hiles-pico-w-deploy.sha256`; último cambio en `c61dbad` |
| Versión del worker de firmware | `FIRMWARE_WORKER_VERSION = "3.0.0"` |
| Protocolos | Ejecución distribuida v3, proyecto colaborativo v2, IR v2 |
| Dependencias principales | React ^19.2.8, Vite ^8.2.2, TypeScript ~6.0.2, Vitest ^5.0.1, ESLint ^10.9.0, MQTT.js ^5.16.0, Pyodide ^0.26.3 |
| Entorno de verificación | Windows 11, Node.js v26.2.0, Python 3.13.2 |

## 3. Resultados verificados por Persona 5 sobre `d15d5a0`

| Verificación | Comando | Resultado |
|---|---|---|
| Firmware | `python -m unittest discover -s firmware/tests -p "test_*.py"` | `Ran 169 tests … OK` |
| Frontend | `npx vitest run` (en `frontend/`) | 32 archivos, 187 pruebas. **Intermitente:** de 11 corridas completas, 3 aprobaron 187/187 y 8 terminaron 186/187 por timeout de 5 s en `PanelDock.test.tsx:132`. Aislado, el archivo aprueba 7/7 |
| TypeScript | `npx tsc -b` | Sin errores |
| ESLint | `npx eslint .` | Código de salida 0 |
| Build | `npm run build` | Correcto; advertencia de chunk > 500 kB (no bloqueante) |
| Espacios | `git diff --check` | Sin errores |
| Checksum del paquete | `sha256sum output/hiles-pico-w-deploy.zip` | Coincide |
| Aprovisionamiento | `scripts/test-pico-provisioning.ps1` | `Pruebas de aprovisionamiento Pico: PASS` (filesystem simulado) |

No se repitieron, porque requieren broker o hardware y corresponden a Persona 4:

- `test-distributed-mqtt.mjs --mode=mqtt`;
- `test-project-collaboration.mjs`;
- la colaboración LAN entre dos navegadores;
- la auditoría visual de seis viewports.

Quedan como **declaradas**.

## 4. Histórico, esta entrega y pendientes

### 4.1 Trabajo histórico (antes de `f7cc9b6`)

Editor visual, motor TypeScript, MQTT con Pico W, runtime MicroPython cooperativo, IR v1/v2, Python remoto acotado, colaboración por proyecto, ejecución distribuida v3 con workers Pico y navegador, y demo de semáforos en anillo. Detalle en [`CRONOLOGIA_PROYECTO.md`](CRONOLOGIA_PROYECTO.md).

### 4.2 Trabajo de esta entrega

Ver [`INFORMES_POR_PERSONA.md`](INFORMES_POR_PERSONA.md) y la matriz [`MATRIZ_REQUISITO_EVIDENCIA.md`](MATRIZ_REQUISITO_EVIDENCIA.md).

### 4.3 Pendientes P0 (bloquean la aceptación final)

| Pendiente | Responsable |
|---|---|
| Ver `pico01w` y `pico02w` seleccionables en la interfaz | Persona 1 |
| Despliegue Pico ↔ Pico con ambos ACK | Personas 1 y 4 |
| Pico ↔ navegador con flujo completo | Persona 4 |
| Inventario, respaldo y sincronización de las dos placas; mismo runtime en RP2040 y RP2350 | Persona 2 |
| Matriz física completa (plan §13, columnas Pico) | Persona 4 |
| Tutorial probado con una persona que no lo implementó | Persona 4 |
| Ensayo completo con placas | Persona 4 |
| Confirmación de la auditoría de secretos (§5) | Responsable del paquete `output/` |

### 4.4 P1 y P2 no iniciados

Asistente Web Serial, detección de firmware incompleto, panel con memoria y versión de cada placa, perfil remoto `wss://` real, OTA, autenticación y ACL, lease del token y Three.js.

## 5. Inconsistencias encontradas y devueltas a su responsable

Persona 5 no corrige código de producción ni archivos de otras personas. Estas observaciones se entregan a quien corresponde.

| # | Hallazgo | Evidencia | Responsable sugerido | Acción propuesta |
|---|---|---|---|---|
| 1 | `output/hiles-pico-w-deploy/config_local.py` **está versionado en Git**. La auditoría de secretos está marcada `[x]` en el plan. | `git ls-files` lo lista. Cambió en `dd38309`, `cc78187`, `b0bdade`, `86a78a4` y `19ef63c`. No está dentro del ZIP. Persona 5 no abrió su contenido. | KevMasMas (autor de esos commits) y Persona 2 (paquete) | Revisar el contenido. Si tiene credenciales reales: rotarlas, retirar el archivo del índice y agregarlo a `.gitignore`. Si es una plantilla, documentarlo |
| 2 | Prueba intermitente por timeout | `PanelDock.test.tsx:132` (`renders a single global set of …`) | Personas 3 y 4 (autores del archivo en `ba76303` y `d15d5a0`) | Aumentar el timeout de esa prueba o evitar los `import()` dinámicos dentro del test |
| 3 | Persona 2 no tenía entrada en el registro | Commit `c61dbad` sin entrada | Persona 2 | Confirmar o corregir la entrada reconstruida por Persona 5 |
| 4 | Casillas de Persona 2 apoyadas en un commit de Persona 1 | `PicoSetupPanel.tsx`, `picoConfig*` creados en `6aac632` | Personas 1 y 2 | Aclarar la autoría en el registro |
| 5 | Evidencia visual de Persona 3 fuera del repositorio | Capturas `audit_*.png`, `step*_tutorial_highlight.png` e informe citados, pero ausentes | Persona 3 | Agregar las capturas a `entregas/entrega-8-6-noviembre/evidencia/` |
| 6 | Nombres propios en el registro y la matriz de Persona 4 | "Juan David Romero", "Juan Romero" frente a la regla "solo Persona N" | Persona 4 | Decidir en equipo si se mantiene la regla |
| 7 | El generador no cumple todo el plan §6.3 | No hay aviso de `localhost` ni de 2.4 GHz, no detecta duplicados, no ofrece copiar y no elige Local/LAN o Remoto | Persona 2 | Completar o reclasificar como P1 |
| 8 | El registro y el plan dicen rama `mqtt-pico` | El trabajo está en `multi-pico` | Persona 5 | Corregido en el encabezado del registro |
| 9 | Persona 4 de la entrega 7 (Three.js) sin evidencia | Ningún commit | Equipo | Registrar el resultado o cerrarlo como no realizado |

## 6. Reconciliación documental

| Documento | Problema | Cambio |
|---|---|---|
| `README.md` | Hablaba de "Motor local", "MQTT local" y "Ejecutar"; cifras 70/82; lista de entregas hasta la 5; pendientes ya resueltos | Reescrito con el flujo actual, la estructura completa, cifras verificadas y enlaces vigentes |
| `docs/GUIA_REPLICACION_COMPLETA_WINDOWS.md` | Rama `mqtt-pico`; cifras 103/174; flujo legado "Pico / MQTT"; controles dentro del panel | Rama `multi-pico`; cifras actuales; flujo de la barra superior; sin modo legado |
| `docs/mqtt/GUIA_ENSAYO_REMOTO_SIN_PICO.md` | Describía el modo "Pico / MQTT", que ya no existe | Reescrita como ensayo navegador ↔ navegador con el flujo v3 |
| `docs/mqtt/FICHA_CONEXION_MQTT.md` | Presentaba una IP real como dato fijo | Convertida en plantilla sin IP |
| `docs/mqtt/GUIA_PRUEBA_PICO_W.md` | Ubicaba los controles en el panel; no mencionaba el generador | Controles en la barra superior, **Entradas** y el generador |
| `docs/architecture/ARQUITECTURA_PICO.md` | Remitía al plan de la entrega 5 | Remite a la arquitectura general vigente |
| `docs/ux/REVISION_VISUAL_Y_ACCESIBILIDAD.md` | Tutorial de 7 pasos y barra antigua | Marcado como histórico (entrega 7), con remisión al estado actual |
| Nuevos | — | `docs/architecture/ARQUITECTURA_SISTEMA.md`, `docs/GUIA_AGREGAR_PICO_Y_EJECUTORES.md` |

Los documentos de entregas anteriores (`entregas/entrega-2…7`) no se modifican: son registro histórico.

## 7. Limitaciones conocidas

- Sin evidencia de ejecución en placas físicas durante esta entrega.
- En los runners de red, los ejecutores `pico:*` son dobles en Node.js.
- El perfil Remoto `wss://` no se probó con un broker seguro.
- El Mosquitto del laboratorio es solo para LAN; no hay autenticación de usuarios ni ACL por proyecto.
- La demo de semáforos no tiene lease ni fail-safe.
- El build emite un chunk mayor de 500 kB, por Pyodide y el editor.

## 8. Cómo reproducir esta verificación

```powershell
git switch multi-pico
git pull --ff-only
git rev-parse --short HEAD          # d15d5a0
python -m unittest discover -s firmware/tests -p "test_*.py"
cd frontend
npm ci
npm run test:run
npm run lint
npm run build
cd ..
git diff --check
Get-FileHash .\output\hiles-pico-w-deploy.zip -Algorithm SHA256
Get-Content .\output\hiles-pico-w-deploy.sha256
& .\scripts\test-pico-provisioning.ps1
```

La demostración se sigue con [`GUION_DEMOSTRACION.md`](GUION_DEMOSTRACION.md).
