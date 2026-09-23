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
