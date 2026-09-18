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

