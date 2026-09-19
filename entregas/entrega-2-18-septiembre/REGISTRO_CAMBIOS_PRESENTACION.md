# Registro de cambios - presentación de mañana

Este archivo se debe actualizar cada vez que se agregue, corrija o pruebe algo fuera de la lista inicial del plan. El responsable debe enviarlo al encargado de pruebas junto con la evidencia.

## Plantilla

```md
### [AAAA-MM-DD HH:MM] - Responsable: Nombre

- Estado: [ ] Pendiente / [x] Hecho / [!] Bloqueado
- Tarea o problema:
- Qué se hizo:
- Archivos modificados:
- Rama: `presentacion-circuito`
- Commit/hash:
- Cómo se probó:
- Resultado:
- Evidencia: captura, video, comando o enlace local
- Riesgos, pendientes o reversión necesaria:
```

## Entradas

<!-- Agregar nuevas entradas debajo de esta línea. No eliminar las anteriores. -->

### [2026-09-18 16:35] - Responsable: Felipe Prado

- Estado: [x] Hecho
- Tarea o problema: Reproducción y corrección de la construcción manual de conexiones del circuito desde un lienzo vacío (P0).
- Qué se hizo:
  1. Reproducción documentada de tres bloqueos críticos al construir el circuito manualmente:
     - Bloqueo A: Conexión Place <-> Transition con conector Petri no se completaba si el conector activo era continuo o si el handle de 1px no capturaba el evento del cursor.
     - Bloqueo B: Conexión Entrada (Service) -> Transition (Condition) fallaba con incompatibilidad de tipos (`real` vs `boolean`) y falta de puertos por defecto en Service.
     - Bloqueo C: Conexión Transition -> Salida del circuito era imposible porque las transiciones carecían de puerto de salida de datos (`Action` en bottom).
  2. Se añadieron puertos por defecto completos en `defaultPorts()` para `TRANSITION` (`Condition` en top y `Action` en bottom, ambos booleanos) y para `SERVICE` (`In` y `Out` booleanos).
  3. Se flexibilizó y robusteció la validación de tipos en `getConnectionValidation()` para permitir compatibilidad continua booleano-numérico entre puertos de control/datos, y se unificó la validación lógica `PETRI`/`TOKEN_FLOW`.
  4. Se aseguró la instanciación de aristas como `hilesEdge` en `onConnect`.
  5. Se ajustaron los handles dedicados de Petri para permitir arrastre confiable con feedback visual claro sin desfases.
- Archivos modificados: `frontend/src/stores/useEditorStore.ts`, `frontend/src/features/editor/CustomNodes.tsx`, `frontend/src/features/editor/editor.css`, `entregas/entrega-2-18-septiembre/PLAN_PRESENTACION_MANANA.md`, `entregas/entrega-2-18-septiembre/REGISTRO_CAMBIOS_PRESENTACION.md`
- Rama: `presentacion-circuito`
- Commit/hash: Pendiente de commit
- Cómo se probó: Reconstrucción manual desde lienzo limpio en `http://localhost:5173/`: creación de Place (Espera, Activo), Transition (T1, T2), Entrada y Salida; trazado de arcos LCH entre Place y Transition en ambas direcciones; conexión de CCH desde Entrada hacia Condition de T1/T2; conexión de CCH desde Action de T1/T2 hacia Salida.
- Resultado: Todas las conexiones se crean sin errores, sin trucos ni edición de JSON, respetando la alternancia Place-Transition y los canales continuos.
- Evidencia: Diagrama manual construido y conectado con éxito en el lienzo.
- Riesgos, pendientes o reversión necesaria: Ninguno detectado; la compatibilidad con importación y exportación de esquemas v1 se preserva.

### [2026-09-18 18:11] - Responsable: Juan Romero

- Estado: [x] Hecho
- Tarea o problema: Movimiento, rutas, waypoints, handles y presentación visual del circuito (P0).
- Qué se hizo:
  1. Se dejó de propagar el objeto completo de `EdgeProps` hacia el SVG de `BaseEdge`; ahora sólo se entregan props válidos y se eliminan las advertencias de React por `selectable`, `deletable`, `sourceX`, `sourceY`, posiciones, handles y `pathOptions`.
  2. Se reemplazó el cálculo ortogonal que desplazaba el extremo de llegada por `getSmoothStepPath`, conservando siempre las coordenadas reales de ambos handles y usando los carriles únicamente para separar el centro de la ruta.
  3. Se unificó el uso del marker de React Flow para que la flecha mantenga dirección y estilo al mover cualquiera de los extremos.
  4. Las etiquetas se renderizan en una capa externa, con fondo y separación de la ruta; en rutas con waypoints se ubican según la mitad de la longitud total y no según un índice arbitrario.
  5. Los handles Petri de cada `Place` eligen de forma independiente el lado orientado hacia su conexión de entrada y su conexión de salida.
  6. La respuesta del backend actualiza únicamente el estado runtime del demo y ya no restaura las posiciones fijas de sus nodos.
  7. Se reorganizó el circuito demo, se diferenciaron visualmente las etiquetas `CCH1/CCH2` para `ON/OFF`, se cierra el menú al cargarlo y el canvas lo encuadra automáticamente una sola vez.
  8. Se actualizó el JSON de presentación con la misma disposición y etiquetas.
- Archivos modificados: `frontend/src/features/editor/HilesEdge.tsx`, `frontend/src/features/editor/CustomNodes.tsx`, `frontend/src/features/editor/Canvas.tsx`, `frontend/src/features/editor/Palette.tsx`, `frontend/src/features/editor/editor.css`, `frontend/src/stores/useEditorStore.ts`, `output/circuito-presentacion-demo.json`, `entregas/entrega-2-18-septiembre/PLAN_PRESENTACION_MANANA.md`, `entregas/entrega-2-18-septiembre/REGISTRO_CAMBIOS_PRESENTACION.md`.
- Rama: `presentacion-circuito`
- Commit/hash: `883c197` (`Correccion: estabilizar rutas y movimiento del circuito`).
- Cómo se probó:
  - `npm run lint` y `npm run build` en `frontend`.
  - Prueba manual del demo en navegador: arrastre de un nodo conectado y ejecución `1 -> 0`; la posición se conservó y las rutas siguieron unidas.
  - Prueba manual desde lienzo limpio: creación de `Structural Block`, `Place` y `Transition`; conexión `LCH1`; movimiento del bloque completo y movimiento individual del `Place`.
  - Creación y movimiento de un waypoint dentro del bloque; movimiento posterior del bloque y recarga del navegador.
  - Inspección de consola en dos sesiones limpias del navegador.
- Resultado: Las aristas mantienen origen, destino, dirección y handles al mover nodos o bloques. El waypoint se mueve con su bloque y se restaura tras autosave. El runtime no deshace el layout del usuario. Las sesiones limpias terminaron con cero warnings y cero errors en consola.
- Evidencia: build y lint exitosos; estado `ON` después de `Enviar 1`, estado `OFF` después de `Enviar 0`; comprobación visual interactiva en `http://127.0.0.1:5173/` y `http://localhost:5173/`.
- Riesgos, pendientes o reversión necesaria: En ventanas extremadamente estrechas el panel lateral reduce el espacio útil y puede requerir usar `Fit View`; no afecta la conexión ni la persistencia de rutas.

### [2026-09-18 18:55] - Responsable: Juan Ramos

- Estado: [x] Hecho
- Tarea o problema: Integración front-back y cierre técnico (P0): botones del panel contra el backend real, protección del documento guardado, proxy/API local con mensajes claros, build y lint de frontend.
- Qué se hizo:
  1. **Arranque desde cero bloqueado.** `npm run start` fallaba en un clon limpio con `TS2307: Cannot find module '../../generated/prisma/client.js'`, porque `nest start` compila `src/modules/prisma/prisma.service.ts` aunque `PrismaModule` ya no esté en `AppModule`. Se verificó que `npm run prisma:generate` basta para desbloquearlo y que **no** hace falta PostgreSQL encendido ni `npx prisma migrate deploy` para la demostración, porque el estado del circuito vive en memoria. Se documentó en el `README.md`.
  2. **Mensajes claros con el backend desconectado.** Se comprobó que el proxy de Vite responde `502 Bad Gateway` en `text/plain` cuando Nest no escucha; el front mostraba entonces `Backend request failed (502).`. Se centralizaron las peticiones en `request()` dentro de `simulationApi.ts`: el rechazo de `fetch` y los códigos `502/503/504` producen ahora un único mensaje, `BACKEND_OFFLINE_MESSAGE`, que indica la carpeta y el comando exactos; el resto de errores conserva el mensaje que envía Nest.
  3. **Mismo mensaje en carga y en botones.** `SimulationPanel` usaba un texto fijo al cargar y el texto crudo del error en los botones. Ahora ambos caminos pasan por `fail()`, y mientras haya error los valores de `Espera/Activo/Salida` se atenúan (`is-stale`) y se advierte que corresponden a la última respuesta recibida, para no dejar el panel en un estado engañoso.
  4. **Protección del documento del usuario.** `applyDemoState` reconstruía el array de nodos en cada respuesta del backend, incluso sin el circuito demo cargado, lo que despertaba la suscripción de autoguardado. Ahora compara el runtime anterior con el nuevo y devuelve el mismo array cuando nada cambió: una respuesta del backend no puede reescribir el documento guardado.
- Archivos modificados: `frontend/src/features/simulation/simulationApi.ts`, `frontend/src/features/simulation/SimulationPanel.tsx`, `frontend/src/features/simulation/simulation.css`, `frontend/src/stores/useEditorStore.ts`, `README.md`, `entregas/entrega-2-18-septiembre/PLAN_PRESENTACION_MANANA.md`, `entregas/entrega-2-18-septiembre/REGISTRO_CAMBIOS_PRESENTACION.md`.
- Rama: `presentacion-circuito`
- Commit/hash: Pendiente de commit. Los cambios están en el árbol de trabajo de `presentacion-circuito`, sin comitear.
- Cómo se probó:
  - `npm ci`-equivalente (`npm install`) en `backend` y `frontend` sobre un árbol sin `node_modules`.
  - `npm test` en `backend`: 2 archivos, 5 pruebas.
  - `npm run lint` y `npm run build` en `frontend`, antes y después de los cambios.
  - Ciclo completo contra el API real en `http://localhost:3000` y repetido a través del proxy en `http://localhost:5173/api`: `reset`, `Enviar 1`, `Enviar 1` repetido, `Enviar 0`, `Enviar 0` repetido, `reset`, `GET` de estado y un `POST` con `value` no booleano.
  - Backend detenido a propósito para observar la respuesta real del proxy (`502`, `text/plain`).
  - Comprobación del store con el módulo real (`applyDemoState`, `loadDemoCircuit`, `exportModel`) y de `serializeModel` con un nodo que lleva `runtime`.
- Resultado:
  - `Enviar 1`: `input=true output=true espera=0 activo=1 cola=0`. `Enviar 0`: `input=false output=false espera=1 activo=0 cola=0`. Repetir el mismo valor no duplica tokens y la cola termina vacía. `Reiniciar` deja entrada `0`, salida `OFF` y el token en `Espera`. Idénticos por el puerto 3000 y por el proxy 5173.
  - `value` no booleano responde `400` con `value must be a boolean`, y ese texto es el que ahora muestra el panel.
  - Store: sin circuito demo cargado, la respuesta del backend devuelve el **mismo** array de nodos; con el demo cargado, `demo-input`, `demo-output`, `demo-waiting` y `demo-active` reflejan la respuesta; una respuesta repetida no regenera el array.
  - Documento: `properties.tokens` de `Espera` sigue en `1` aunque el runtime muestre `0`, y el JSON exportado no contiene ninguna clave `runtime` en ningún nivel.
  - `npm run lint` sin hallazgos y `npm run build` correcto (`tsc -b` + `vite build`, 190 módulos).
- Evidencia: salidas de `curl` del ciclo `reset -> 1 -> 1 -> 0 -> 0 -> reset` por el puerto 3000 y por el proxy 5173; cabecera `HTTP/1.1 502 Bad Gateway` del proxy con Nest apagado; salida de la comprobación del store (`mismo array: true`, `clave "runtime" en el documento: false`, `tokens guardados 1 / 0`); `npm test` del backend con 5 pruebas en verde; `npm run build` del frontend.
- Riesgos, pendientes o reversión necesaria:
  - Falta la validación visual en navegador de este último cambio: la verificación de `applyDemoState` se hizo sobre el store real, no sobre el lienzo. El encargado de pruebas debe confirmar en pantalla el ciclo `0 -> 1 -> 0`.
  - `src/modules/prisma/prisma.service.ts` sigue compilándose aunque `PrismaModule` no esté activo; por eso `npm run prisma:generate` es obligatorio. Se documentó en lugar de tocar la configuración de compilación, para no alterar el backend a un día de la presentación.
  - Los mensajes de error que genera Nest (por ejemplo `value must be a boolean`) siguen en inglés; sólo se tradujeron los del frontend.
  - No se hizo merge a `main`: queda pendiente el visto bueno del encargado de pruebas, según la regla de Git del plan.

