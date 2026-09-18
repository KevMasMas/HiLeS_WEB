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

