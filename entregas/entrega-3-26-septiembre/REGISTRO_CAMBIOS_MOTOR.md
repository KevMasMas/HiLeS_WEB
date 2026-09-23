# Registro de cambios — Motor HiLeS Frontend-Only

Este archivo se debe actualizar cada vez que se complete, corrija o pruebe una tarea del plan. El responsable debe enviarlo al encargado de pruebas (Persona 5) junto con la evidencia.

## Plantilla

```md
### [AAAA-MM-DD HH:MM] - Responsable: Persona N

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
- Riesgos, pendientes o reversión necesaria: Tareas de UI y simulador integradas y funcionando. Queda únicamente pendiente el paso a la Persona 5 para que escriba las pruebas en Vitest y valide los flujos E2E.

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
- Riesgos, pendientes o reversión necesaria: El `npm run build` global continúa bloqueado por referencias eliminadas del backend en `SimulationPanel.tsx` y `useEditorStore.ts`, fuera del alcance de esta tarea. Vitest será configurado por Persona 5; hasta entonces la prueba conductual se ejecutó con aserciones de Node. Las fábricas de Service, Functional Block, Sample, Hold y Structural Block deben registrarse cuando Persona 3 implemente esas clases.
