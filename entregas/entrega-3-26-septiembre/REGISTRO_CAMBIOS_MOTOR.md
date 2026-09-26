# Registro de cambios — Motor HiLeS Frontend-Only

Este archivo se debe actualizar cada vez que se complete, corrija o pruebe una tarea del plan. La revisión, integración y cierre están a cargo de **Juan Romero, Julian Romero y Kevin Rincon**, junto con la evidencia.

## Plantilla

```md
### [AAAA-MM-DD HH:MM] - Responsable(s): Nombre(s)

- Estado: [ ] Pendiente / [x] Hecho / [!] Bloqueado
- Tarea o problema:
- Qué se hizo:
- Archivos creados o modificados:
- Rama: `motor/persona-N-descripcion`
- Commit/hash:
- Cómo se probó:
- Resultado:
- Evidencia: captura, video, comando o enlace local
- Riesgos, pendientes o reversión necesaria:
```

## Entradas

<!-- Agregar nuevas entradas debajo de esta línea. No eliminar las anteriores. -->

## Revisión consolidada — Juan Romero, Julian Romero y Kevin Rincon

- Estado: [x] Completada
- Alcance: Revisión integral de las tareas, integración, pruebas, correcciones y preparación de los demos del motor frontend.
- Correcciones verificadas: se aisló el editor de cada Functional Block para evitar que el código de un bloque reemplazara al de otro; se corrigió la propagación de los canales Petri y de datos; se normalizaron los nombres de puertos para usar variables en el código; se añadió el demo de parqueadero con `Sample` y `Hold`; y Pyodide pasó a recursos locales para que Python ejecute sin depender de un CDN.
- Verificación final: 28 pruebas automatizadas aprobadas, `npm run lint` correcto, `npm run build` correcto y prueba real del parqueadero: `Sample` y `Hold` publicaron 5, el bloque Python habilitó `Abrir barrera` y el token se movió a `Barrera abierta` en el paso 3.
- Evidencia: eventos `Sample de ocupación publicó 5`, `Hold de ocupación publicó 5` y `Abrir barrera disparó y movió los tokens`.
- Nota: las entradas cronológicas siguientes conservan el detalle técnico e histórico de cada corrección.

### [2026-09-25 18:50] - Revisión: Juan Romero, Julian Romero y Kevin Rincon

- Estado: [x] Hecho
- Tarea o problema: Los Functional Blocks Python fallaban con `El Worker de Python no pudo ejecutar el código`, por lo que no se habilitaba la Transition ni cambiaba el token.
- Qué se hizo: Pyodide se añadió como dependencia local y se incorporaron sus recursos WASM, librería estándar y manifiesto en `public/pyodide`. El Worker ahora carga esos recursos desde la propia aplicación, sin depender de un CDN. El mensaje de error del Worker también conserva el detalle técnico cuando exista.
- Archivos creados o modificados: `frontend/package.json`, `frontend/package-lock.json`, `frontend/public/pyodide/*`, `frontend/src/workers/pyodide.worker.ts`, `frontend/src/engine/EjecutorCodigo.ts` y este registro.
- Rama: `motor-frontend`
- Commit/hash: Pendiente de commit.
- Cómo se probó: `npm run test:run`, `npm run lint`, `npm run build` y prueba visual en la versión de producción local.
- Resultado: 5 suites y 28 pruebas aprobadas; compilación correcta. Con el demo de parqueadero se inyectó `5` y captura `true`: `Sample` publicó 5, `Hold` publicó 5, `¿Hay cupo?` publicó true y `Abrir barrera` disparó, moviendo el token a `Barrera abierta`; el circuito se estabilizó en el paso 3.
- Evidencia: Panel de eventos con `Sample de ocupación publicó 5`, `Hold de ocupación publicó 5` y `Abrir barrera disparó y movió los tokens`.
- Riesgos, pendientes o reversión necesaria: La primera carga de Pyodide incluye aproximadamente 13 MB de recursos locales, por lo que puede tardar unos segundos la primera vez. Las siguientes ejecuciones reutilizan el runtime del Worker.

### [2026-09-25 17:52] - Revisión: Juan Romero, Julian Romero y Kevin Rincon

- Estado: [x] Hecho
- Tarea o problema: Crear un circuito demostrable, diferente al riego, que muestre el comportamiento de los conversores `Sample` y `Hold` junto con Services, Functional Blocks Python y una red de Petri.
- Qué se hizo: Se añadió el demo importable **Control de Parqueadero**. El Service de vehículos alimenta `Sample`; el Service de captura decide cuándo `Sample` toma una lectura; `Hold` mantiene la última lectura capturada y la entrega a dos Functional Blocks Python que abren o cierran una barrera mediante dos Transitions y dos Places.
- Archivos creados o modificados: `output/demo-parqueadero-converters.json`, `frontend/src/engine/__tests__/MotorSimulacion.test.ts` y este registro.
- Rama: `motor-frontend`
- Commit/hash: Pendiente de commit.
- Cómo se probó: Se validó el JSON, se incorporó al recorrido de importación/construcción/ejecución de los demos y se ejecutaron `npm run test:run`, `npm run lint` y `npm run build`.
- Resultado: JSON válido; 5 suites y 28 pruebas aprobadas; ESLint y compilación de TypeScript/Vite finalizan correctamente. La prueba usa un Worker simulado para comprobar el flujo Python en el entorno de Vitest, donde Pyodide no está disponible.
- Evidencia: `Test Files 5 passed`, `Tests 28 passed`, `✓ built`.
- Riesgos, pendientes o reversión necesaria: La comprobación visual en navegador quedó pendiente por una denegación de autorización de la automatización local; el archivo es autónomo e importable desde la interfaz.

### [2026-09-24 11:41] - Revisión: Juan Romero, Julian Romero y Kevin Rincon

- Estado: [x] Hecho
- Tarea o problema: El editor del Functional Block `>84%` podía reemplazar su código por `humedad < 76` después de cambiar de bloque y ejecutar el demo de humedad.
- Qué se hizo: Se corrigió el ciclo de vida de CodeMirror. Cada nodo seleccionado monta una instancia aislada; el listener usa siempre el callback vigente; las sincronizaciones programáticas ya no se interpretan como escritura del usuario; y una carga asíncrona del lenguaje toma el código más reciente. El resultado de `Probar código` también quedó asociado al nodo que lo produjo.
- Archivos creados o modificados: `frontend/src/features/editor/CodeEditor.tsx`, `frontend/src/features/editor/PropertiesPanel.tsx` y este registro.
- Rama: `motor-frontend`
- Commit/hash: Registrado en el commit posterior a esta entrada.
- Cómo se probó: Se ejecutaron `npm run test:run`, `npm run lint` y `npm run build`. En navegador se importó `demo-2-humedad-token.json`, se alternó varias veces entre `<76%` y `>84%`, se inyectó humedad `90`, se ejecutó el motor y se volvió a alternar la selección.
- Resultado: 5 suites y 28 pruebas aprobadas; lint y build correctos. `>84%` conservó `humedad > 84`, publicó `true` y disparó T2; `<76%` conservó `humedad < 76` y publicó `false`. El circuito se estabilizó en tres pasos y la consola quedó sin errores ni advertencias.
- Riesgos, pendientes o reversión necesaria: Ninguno conocido. Si un autosave antiguo ya había quedado modificado antes de esta corrección, debe reimportarse el JSON original o restaurarse manualmente la expresión correcta una sola vez.

### [2026-09-24 11:25] - Revisión: Juan Romero, Julian Romero y Kevin Rincon

- Estado: [x] Hecho
- Tarea o problema: Completar los pendientes detectados al revisar las tareas de todas las personas y dejar evidencia reproducible de su funcionamiento.
- Qué se hizo: Se habilitó Python real con Pyodide 0.26.3 dentro de un Web Worker terminable y con límite de 15 segundos; se conectó al motor y al botón `Probar código`; se añadieron entradas de prueba tipadas y nombres de variables normalizados. Se eliminó el circuito demo codificado dentro del store, se preservó `propagationMode` al importar y editar canales, se amplió la prueba de túneles del Structural Block y se ejecutan los tres JSON mediante el motor. La ejecución completa reveló y corrigió la compatibilidad del puerto histórico `petri-in` en Transitions. También se tradujeron los comentarios restantes y se verificó desde un lienzo vacío el flujo manual Service → Functional Block con `input * 2`.
- Archivos creados o modificados: `frontend/src/workers/pyodide.worker.ts`, `frontend/src/engine/EjecutorCodigo.ts`, `frontend/src/engine/elementos/ElementoBloqueFuncional.ts`, `frontend/src/engine/elementos/ElementoTransicion.ts`, `frontend/src/features/editor/PropertiesPanel.tsx`, `frontend/src/stores/useEditorStore.ts`, `frontend/src/features/editor/Canvas.tsx`, pruebas en `frontend/src/engine/__tests__/` y documentación del plan.
- Rama: `motor-frontend`
- Commit/hash de implementación: `5362451`
- Cómo se probó: `npm run test:run`, `npm run build`, `npm run lint`, `git diff --check`; prueba interactiva de Pyodide con `humedad < 76`; construcción manual Service → Functional Block, conexión CCH, código `input * 2`, inyección y ejecución.
- Resultado: 5 suites y 28 pruebas aprobadas; 226 módulos compilados; ESLint y comprobación de diff sin errores. Python devolvió `true`; el circuito manual publicó `2` y se estabilizó en dos pasos. La consola del navegador quedó sin errores ni advertencias.
- Evidencia: `Test Files 5 passed`, `Tests 28 passed`, `✓ 226 modules transformed`, `✓ built`; interfaz local abierta en `http://127.0.0.1:5173/` con estado `ESTABILIZADA` y evento `New Functional Block publicó 2`.
- Riesgos, pendientes o reversión necesaria: Pyodide se descarga desde el CDN oficial fijado a la versión 0.26.3 en el primer uso, por lo que la ejecución Python requiere conexión a Internet. No quedan tareas sin marcar en el plan.

### [2026-09-24 11:05] - Revisión: Juan Romero, Julian Romero y Kevin Rincon

- Estado: [x] Hecho
- Tarea o problema: Completar pruebas, integración y cierre técnico del motor frontend-only; verificar el circuito de humedad, los demos JSON, la interfaz en ejecución y los comandos finales del proyecto.
- Qué se hizo: Se instaló y configuró Vitest; se crearon las cinco suites exigidas con 27 pruebas reproducibles; se cubrieron elementos, red de Petri, grafo, sandbox JavaScript, timeout, reinicio, autociclos y el flujo integral Service → Functional Block → Transition → Place. Se validaron los tres demos JSON existentes y el demo de humedad en ambos sentidos. Durante la integración se corrigió la validación de conexiones para separar canales Petri de canales de datos/control y se normalizaron los nombres visuales de puertos a identificadores de código, permitiendo que el puerto `Humedad` alimente la expresión `humedad < 76`. Se añadió carga diferida de CodeMirror y sus lenguajes para mantener todos los chunks por debajo de 500 kB. Se levantó el proyecto y se verificó en navegador la importación del demo, la inyección de humedad 90, el disparo de T2, el movimiento del token y la estabilización en tres pasos sin errores de consola.
- Archivos creados o modificados:
  - `frontend/vitest.config.ts`
  - `frontend/package.json`
  - `frontend/package-lock.json`
  - `frontend/tsconfig.app.json`
  - `frontend/tsconfig.node.json`
  - `frontend/src/engine/__tests__/fixtures.ts`
  - `frontend/src/engine/__tests__/MotorSimulacion.test.ts`
  - `frontend/src/engine/__tests__/EvaluadorPetri.test.ts`
  - `frontend/src/engine/__tests__/EjecutorCodigo.test.ts`
  - `frontend/src/engine/__tests__/GrafoDatos.test.ts`
  - `frontend/src/engine/__tests__/Elementos.test.ts`
  - `frontend/src/engine/elementos/ElementoBloqueFuncional.ts`
  - `frontend/src/stores/useEditorStore.ts`
  - `entregas/entrega-3-26-septiembre/PLAN_MOTOR_FRONTEND.md`
  - `entregas/entrega-3-26-septiembre/REGISTRO_CAMBIOS_MOTOR.md`
- Rama: `motor-frontend`
- Commit/hash: Pendiente de commit; cambios verificados en el árbol de trabajo de `motor-frontend`.
- Cómo se probó: `npm run test:run`, `npm run build`, `npm run lint`, búsqueda con `rg` de referencias legacy al backend y validación interactiva en `http://127.0.0.1:5173/` importando `output/demo-2-humedad-token.json`.
- Resultado: 5 suites y 27 pruebas aprobadas; TypeScript y Vite compilan; ESLint termina con código 0; los tres JSON se validan y construyen sin error; el demo de humedad mueve el token en ambos sentidos; la UI muestra eventos, valores y estabilización; consola del navegador sin errores ni advertencias.
- Evidencia: Salidas `Test Files 5 passed`, `Tests 27 passed`, `✓ 226 modules transformed`, `✓ built`; navegador con evento `T2 · Desactivar disparó y movió los tokens` y `El circuito se estabilizó en el paso 3`.
- Riesgos, pendientes o reversión necesaria: Python/Pyodide continúa fuera del alcance opcional y se mantiene deshabilitado explícitamente en la UI. No se requiere reversión técnica. El servidor local de desarrollo quedó ejecutándose para la entrega.

### [2026-09-23 16:11] - Responsable: Juan Ramos

- Estado: [x] Hecho
- Tarea o problema: Construir el motor de simulación y la orquestación del circuito: tipos del motor, grafo de flujo de datos, ciclo de ejecución y store de simulación conectado al canvas.
- Qué se hizo: Se definieron los tipos del motor con una cola de eventos auditable; se implementó el ordenamiento topológico con Kahn, la detección de ciclos por DFS y la propagación push de valores por CCH/DCH; se creó el orquestador que construye una instancia lógica por nodo, inyecta entradas en los Services, ejecuta ciclos completos de datos más red de Petri, detecta estabilización comparando instantáneas y restaura el estado inicial; y se creó el store de simulación que se suscribe al editor para reconstruir el grafo cuando cambia la topología y volcar tokens y valores sobre el canvas.
- Archivos creados o modificados:
  - `frontend/src/engine/tipos.ts`
  - `frontend/src/engine/GrafoDatos.ts`
  - `frontend/src/engine/MotorSimulacion.ts`
  - `frontend/src/stores/useSimulationStore.ts`
  - `entregas/entrega-3-26-septiembre/PLAN_MOTOR_FRONTEND.md`
  - `entregas/entrega-3-26-septiembre/REGISTRO_CAMBIOS_MOTOR.md`
- Rama: `motor-frontend`
- Commit/hash de implementación: `6fa3dac`
- Cómo se probó: ESLint sobre los cuatro archivos; comprobación de tipos con TypeScript 6; y 99 aserciones ejecutadas con Node sobre el motor real y el store, transpilando el código con `tsc` y cargando el store del editor con shims de `window` y `localStorage`. Se cubrió cada tarea y cada criterio de aceptación: orden topológico determinista, detección de ciclos y autociclos, propagación con ejecutor inyectado, rechazo de inyecciones inválidas, circuito de 2 Places con 2 Transitions y 1 Functional Block, guarda falsa que conserva el token, ciclo de ida y vuelta, conflicto entre dos Transitions habilitadas, circuito oscilante que agota el límite de pasos, reinicio exacto y sincronización con el canvas sin bucle de actualización.
- Resultado: ESLint sin errores en los cuatro archivos y las 99 verificaciones en verde. El circuito de humedad estabiliza en 3 pasos moviendo el token, la cola de eventos queda con índices consecutivos y pasos que no retroceden, y `reiniciar()` devuelve una instantánea idéntica a la del arranque.
- Evidencia: `npx eslint src/engine/tipos.ts src/engine/GrafoDatos.ts src/engine/MotorSimulacion.ts src/stores/useSimulationStore.ts`; salida local `TODAS LAS VERIFICACIONES PASAN (99)`.
- Riesgos, pendientes o reversión necesaria: El `npm run build` global sigue bloqueado por `SimulationPanel.tsx` y `useEditorStore.ts`, que importan el `simulationApi.ts` ya eliminado; corresponde a Persona 4 y ya venía reportado. El motor es síncrono, así que el Functional Block solo propaga valor con expresiones simples: el código que requiere Web Worker devuelve vacío. Se dejó el hook `ejecutor` en `OpcionesMotor` para enchufar la vía asíncrona (`evaluarAsync`) sin reescribir el motor.


### [2026-09-23 08:32] - Responsable: Julian Dario Romero Buitrago

- Estado: [x] Hecho
- Tarea o problema: Completar la responsabilidad de Persona 3: lógica de Service, Functional Block, Sample, Hold, Structural Block y ejecución segura de código JavaScript.
- Qué se hizo: Se implementaron los cinco elementos asignados, el ejecutor JavaScript con expresiones legacy, mapeo de entradas por nombre de puerto, manejo de errores y bloqueo de APIs restringidas. Se incorporó un Web Worker para aislar código con control de flujo y terminarlo después de un segundo sin bloquear la interfaz. `ElementoBloqueFuncional` conserva la evaluación síncrona de expresiones simples y ofrece `evaluarAsync()` para el camino aislado. También se registraron las fábricas y se actualizó el plan con el estado real de las tareas.
- Archivos creados o modificados:
  - `frontend/src/engine/EjecutorCodigo.ts`
  - `frontend/src/workers/javascript.worker.ts`
  - `frontend/src/engine/elementos/ElementoService.ts`
  - `frontend/src/engine/elementos/ElementoBloqueFuncional.ts`
  - `frontend/src/engine/elementos/ElementoMuestreo.ts`
  - `frontend/src/engine/elementos/ElementoRetencion.ts`
  - `frontend/src/engine/elementos/ElementoBloqueEstructural.ts`
  - `frontend/src/engine/elementos/index.ts`
  - `entregas/entrega-3-26-septiembre/PLAN_MOTOR_FRONTEND.md`
  - `entregas/entrega-3-26-septiembre/REGISTRO_CAMBIOS_MOTOR.md`
- Rama: `motor-frontend`
- Commit/hash: Pendiente de commit en la rama de trabajo.
- Cómo se probó: TypeScript aislado del alcance de Persona 3 con `npm.cmd exec tsc -- --ignoreConfig --noEmit ...`; ESLint sobre los archivos del motor y el Worker; prueba controlada de Node para expresiones simples, expresión `humedad < 76`, bloqueo de `fetch`, `window`, `document`, `eval` y `Function`, y timeout de un segundo mediante terminación del Worker simulado; además, `git diff --check`.
- Resultado: Las validaciones aisladas de TypeScript y ESLint finalizaron sin errores. Las expresiones devolvieron los valores esperados, el código restringido fue capturado y el timeout finalizó aproximadamente a los 1000 ms sin ejecutar el bucle en el hilo principal. Sample, Hold, Service, Functional Block y Structural Block quedaron implementados y registrados en la fábrica.
- Evidencia: Salida local `OK: expresiones, sandbox y timeout de 1 segundo verificados`; `npm.cmd exec tsc -- --ignoreConfig --noEmit ...`; `npm.cmd exec eslint -- src/engine/...`; `git diff --check`.
- Riesgos, pendientes o reversión necesaria: El `npm.cmd run build` global continúa bloqueado por errores preexistentes fuera de Persona 3 en `frontend/src/features/simulation/SimulationPanel.tsx` y `frontend/src/stores/useEditorStore.ts` (`DemoSimulationState`, `getDemoState`, `resetDemo`, `publishDemoInput` y `simulateServiceInput`). El Worker opcional de Pyodide permanece pendiente porque no forma parte del alcance principal y no hay dependencias configuradas. No se modificó código de otras personas.

### [2026-09-23 17:34] - Responsable: Ivan Felipe Prado Blanco

- Estado: [x] Hecho
- Tarea o problema: Completar responsabilidades de Persona 4: UI del editor de código, integración del panel de simulación sin llamadas al backend, actualización de nodos visuales con badges e implementación del patrón Observer.
- Qué se hizo: Se instalaron las dependencias de CodeMirror 6 y se creó el componente React `CodeEditor`. Se refactorizó `PropertiesPanel` para incluir el editor interactivo y probar la lógica mediante `ejecutarJS`. Se reescribió `SimulationPanel` para conectarlo íntegramente a `useSimulationStore`. Se agregaron los badges visuales de errores, valores y lenguajes en `CustomNodes`. Se eliminaron las importaciones legacy y se borró `simulationApi.ts`. Se envolvió la app en un `ErrorBoundary` en `main.tsx` y se repararon todos los errores de tipado de la transición (ej. en `useEditorStore.ts`) permitiendo compilar exitosamente la aplicación completa.
- Archivos creados o modificados:
  - `frontend/src/features/editor/CodeEditor.tsx` (Creado)
  - `frontend/src/engine/BusObserver.ts` (Creado)
  - `frontend/src/features/editor/PropertiesPanel.tsx`
  - `frontend/src/features/simulation/SimulationPanel.tsx`
  - `frontend/src/features/editor/CustomNodes.tsx`
  - `frontend/src/features/editor/editor.css`
  - `frontend/src/main.tsx`
  - `frontend/src/stores/useEditorStore.ts`
  - `frontend/src/features/simulation/simulationApi.ts` (Eliminado)
  - `entregas/entrega-3-26-septiembre/PLAN_MOTOR_FRONTEND.md`
  - `entregas/entrega-3-26-septiembre/REGISTRO_CAMBIOS_MOTOR.md`
- Rama: `motor-frontend`
- Commit/hash: Pendiente de commit en la rama de trabajo.
- Cómo se probó: Compilación integral con `npm run build` validando el esquema estricto de TypeScript en todo el proyecto. Comprobación interactiva en el navegador visualizando dinámicamente los componentes de UI y el CodeEditor. Uso de ErrorBoundary para diagnosticar errores de React en la renderización local.
- Resultado: El frontend se empaquetó e inicializó con código 0 (sin warnings ni errores bloqueantes del Linter/Typescript de UI). La aplicación 100% frontend carga satisfactoriamente y renderiza la interfaz que envuelve CodeMirror, comunicándose en tiempo real con la lógica reactiva sin fallas al inicio.
- Evidencia: Salida del comando de build marcando `✓ built in...` exitosamente, sin el cuelgue anterior. Pantalla sin crash ni renders en blanco en el puerto local 4173.
- Riesgos, pendientes o reversión necesaria: Tareas de UI y simulador integradas y funcionando. La revisión conjunta quedó registrada en la sección de revisión consolidada.

### [2026-09-23 00:13] - Responsable: Juan David Romero

- Estado: [x] Hecho
- Tarea o problema: Implementar la lógica autocontenida de Place, Transition y evaluación de red de Petri asignada a Juan David Romero.
- Qué se hizo: Se definieron los tipos compartidos del motor; se implementaron Places con capacidad, consumo, producción y reinicio de tokens; se implementaron Transitions con entrada booleana, habilitación y salida de disparo de un solo uso; se creó un evaluador que valida y mueve tokens atómicamente, respeta pesos de arcos, evita desbordamientos y conserva el marcado cuando hay conflicto; y se creó una fábrica extensible para no acoplarla a los elementos pendientes de otros responsables.
- Archivos creados o modificados:
  - `frontend/src/engine/elementos/interfaces.ts`
  - `frontend/src/engine/elementos/ElementoLugar.ts`
  - `frontend/src/engine/elementos/ElementoTransicion.ts`
  - `frontend/src/engine/EvaluadorPetri.ts`
  - `frontend/src/engine/elementos/index.ts`
  - `entregas/entrega-3-26-septiembre/PLAN_MOTOR_FRONTEND.md`
  - `entregas/entrega-3-26-septiembre/REGISTRO_CAMBIOS_MOTOR.md`
- Rama: `motor/persona-2-petri`
- Commit/hash de implementación: `8340cb6`
- Cómo se probó: Comprobación aislada con TypeScript 6, ESLint sobre los cinco archivos y seis escenarios ejecutados con aserciones de Node 24: disparo normal, ausencia de token, salida llena, ciclo de ida y vuelta, conflicto y arcos con peso.
- Resultado: TypeScript y ESLint finalizaron sin errores en el alcance de Juan David Romero. Los seis escenarios mostraron `OK: 6 escenarios Petri verificados` y conservaron correctamente los tokens en caso de conflicto.
- Evidencia: `npm exec tsc -- --ignoreConfig --noEmit ...`; `npm exec eslint -- src/engine/...`; salida local `OK: 6 escenarios Petri verificados`.
- Riesgos, pendientes o reversión necesaria: Nota histórica: en ese momento Vitest y la integración estaban pendientes; posteriormente quedaron resueltos y verificados en la revisión consolidada.
