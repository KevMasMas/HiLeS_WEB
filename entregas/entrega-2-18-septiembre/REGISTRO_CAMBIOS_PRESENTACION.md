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

### [2026-09-18 12:52] - Responsable: Julián Romero

- Estado: [x] Hecho
- Tarea o problema: El demo debía arrancar y comprobar su flujo backend sin depender de Prisma/PostgreSQL ni telemetría externa.
- Qué se hizo: Se retiró `PrismaModule` del `AppModule` para aislar el demo, se generó el cliente Prisma requerido por el build y se verificaron arranque, endpoints, FIFO, movimiento de token, publicación de salida y no duplicación.
- Archivos modificados: `backend/src/app.module.ts`, `entregas/entrega-2-18-septiembre/PLAN_PRESENTACION_MANANA.md`, `entregas/entrega-2-18-septiembre/REGISTRO_CAMBIOS_PRESENTACION.md`
- Rama: `presentacion-circuito`
- Commit/hash: Pendiente de commit
- Cómo se probó: `npm.cmd run build`; `npm.cmd test`; `npm.cmd run test:e2e`; `npm.cmd start`; solicitudes HTTP reales a `GET /api/simulations/demo`, `POST /api/simulations/demo/input` y `POST /api/simulations/demo/reset`.
- Resultado: Build correcto; 5 pruebas unitarias y 1 e2e exitosas; Nest inició correctamente; el flujo 0 -> 1 -> 0 mantuvo la cola en 0, movió el token correctamente y publicó las salidas esperadas; repetir `true` dejó `{ waiting: 0, active: 1 }` sin publicación duplicada.
- Evidencia: Salida de los comandos anteriores y respuestas JSON de los endpoints HTTP en `http://localhost:3000/api/simulations/demo`.
- Riesgos, pendientes o reversión necesaria: Prisma queda disponible para módulos futuros, pero no se inicializa mientras el demo no use persistencia; no se realizó commit ni push.
