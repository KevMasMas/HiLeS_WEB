# Plan de trabajo - presentación de mañana

## Objetivo no negociable

Demostrar un circuito HiLeS que se pueda construir desde un proyecto/lienzo limpio, conectar visualmente, mover sin romperse y ejecutar contra el backend:

```text
Entrada 1 -> T1 -> token pasa de Espera a Activo -> salida ON
Entrada 0 -> T2 -> token vuelve de Activo a Espera -> salida OFF
```

La prueba no se considera terminada sólo porque el circuito de demostración cargue. Debe poder recrearse manualmente con los elementos y conectores del editor, porque hoy ese flujo es el riesgo principal.

## Regla obligatoria de Git

- [ ] Nadie trabaja ni hace commits directamente sobre `main`.
- [ ] Crear una rama local única para esta entrega desde el estado actual de `main`:

  ```powershell
  git switch main
  git pull
  git switch -c presentacion-circuito
  ```

- [ ] Todos los cambios de esta entrega se hacen, se comitean y se suben a `presentacion-circuito`.
- [ ] Cada commit debe describir una unidad verificable: por ejemplo, `fix: conectar Place con Transition` o `test: validar circuito manual`.
- [ ] No hacer merge a `main` hasta que el encargado de pruebas haya recibido evidencia, haya marcado los criterios de aceptación y haya dado el visto bueno.
- [ ] Si se crea una tarea adicional, registrarla en `REGISTRO_CAMBIOS_PRESENTACION.md`, indicar responsable, archivos modificados, prueba realizada y resultado; después enviarla al encargado de pruebas.

## Prioridad P0 - bloqueador de la presentación

### Reconstrucción manual del circuito

- [ ] Abrir un proyecto vacío, sin cargar el circuito demo.
- [ ] Crear dos Place: `Espera` con un token inicial y `Activo` sin token.
- [ ] Crear dos Transition: `T1 Activar` y `T2 Desactivar`.
- [ ] Crear una entrada y una salida booleana.
- [ ] Conectar Place -> Transition -> Place mediante canales lógicos/Petri (`LCH`).
- [ ] Conectar la entrada a las condiciones de las dos transiciones mediante canales continuos (`CCH`).
- [ ] Conectar las salidas de las transiciones hacia la salida del circuito.
- [ ] Confirmar que no hay que usar trucos, editar JSON ni cargar el demo para conseguir las conexiones.
- [ ] Guardar evidencia del circuito manual armado y de su ejecución 0 -> 1 -> 0.

## Problemas que se deben revisar o arreglar

### Conexiones y validación

- [ ] Reproducir y documentar exactamente por qué no se puede volver a crear el circuito del proyecto actual.
- [ ] Revisar que el tipo de conector seleccionado sea el que valida la conexión: `CONTINUOUS`, `DISCRETE` o `PETRI`.
- [ ] Verificar que los puertos de salida sólo conecten con puertos de entrada compatibles.
- [ ] Verificar específicamente las conexiones Place <-> Transition: deben aceptar sus handles Petri dedicados y alternar Place/Transition.
- [ ] Resolver o documentar la inconsistencia entre `PETRI` y `TOKEN_FLOW`; para mañana debe haber una única ruta clara para crear arcos lógicos.
- [ ] Verificar que no se creen conexiones duplicadas ni conexiones a un mismo elemento.
- [ ] Verificar borrar conexión, deshacer, rehacer, importar y exportar sin perder `source`, `target`, handles, tipo ni waypoints.
- [ ] Eliminar los errores de consola que aparecen al renderizar aristas, especialmente los props de React Flow que llegan al DOM.

### Visual, movimiento y jerarquía

- [ ] Mover cada nodo del circuito y confirmar que las aristas conservan el origen, destino y dirección correctos.
- [ ] Probar mover nodos conectados dentro y fuera de un bloque estructural.
- [ ] Probar los waypoints: agregar, mover y conservar el punto después de guardar/cargar.
- [ ] Revisar que las etiquetas `CCH` y `LCH` sean legibles, no se oculten sobre el nodo y sigan la ruta correcta.
- [ ] Revisar zoom, paneo y minimapa sin que desaparezcan nodos o conexiones.
- [ ] Revisar que los handles visibles coincidan con los puertos seleccionables; no debe haber un puerto visual que no permita conectar ni una conexión que aparezca desde un lugar equivocado.

### Ejecución del circuito y backend

- [ ] Arrancar backend y frontend desde cero y confirmar que el panel indica conexión con el backend.
- [ ] Confirmar `0 -> 1`: llega `tCCH1/send`, dispara `T1`, pasa el token a `Activo`, llega `tCCH2/send` y la salida queda `ON`.
- [ ] Confirmar `1 -> 0`: dispara `T2`, devuelve el token a `Espera` y la salida queda `OFF`.
- [ ] Confirmar que la cola termina vacía después de cada ejecución y que el historial muestra los tópicos en orden.
- [ ] Confirmar que reiniciar restaura: entrada `0`, salida `OFF`, token en `Espera`.
- [ ] Confirmar que los errores del backend se muestran claramente en el front y no dejan el editor en un estado engañoso.

## Distribución propuesta

### Felipe Prado - conexiones y reproducción del fallo (P0)

- [ ] Reproducir el fallo de construcción manual desde un lienzo vacío.
- [ ] Escribir pasos exactos de reproducción en el registro: elemento, conector, handle y mensaje obtenido.
- [ ] Corregir la validación o los handles necesarios para que Place/Transition y puertos de datos se conecten correctamente.
- [ ] Probar las tres familias de conexión: continua, discreta y lógica/Petri.
- [ ] Entregar captura o video corto del circuito recreado manualmente y el hash del commit.

### Juan Romero - movimiento, rutas y presentación visual (P0)

- [ ] Revisar arrastre de nodos, aristas y bloques estructurales con el circuito manual armado.
- [ ] Corregir rutas que se desprendan, se inviertan, se oculten o crucen de forma ilegible al mover un nodo.
- [ ] Revisar waypoints, etiquetas y handles visuales.
- [ ] Corregir advertencias/errores de consola de las aristas sin cambiar su semántica.
- [ ] Preparar una disposición limpia y legible del circuito para la demostración.

### Julián Romero - backend y motor del demo (P0)

- [ ] Revisar que el servidor Nest inicie sin depender de telemetría de ejemplo ni errores externos.
- [ ] Verificar endpoints del demo: estado, entrada y reinicio.
- [ ] Verificar la cola FIFO, movimiento atómico de token y publicación de la salida.
- [ ] Ejecutar pruebas automáticas del servicio y registrar el resultado.
- [ ] Confirmar que enviar dos veces el mismo valor no duplica tokens.

### Juan Ramos - integración front-back y cierre técnico (P0)

- [ ] Verificar que los botones `Enviar 0`, `Enviar 1` y `Reiniciar` actualicen el canvas con la respuesta real del backend.
- [ ] Verificar que los valores runtime no dañen el documento guardado del usuario.
- [ ] Verificar el proxy/API local y mensajes claros cuando el backend esté desconectado.
- [ ] Ejecutar build y lint de frontend antes de entregar.
- [ ] Integrar únicamente cambios revisados de la rama de presentación y dejar el circuito listo para probar.

### Encargado de pruebas - propietario de la presentación

- [ ] Recibir de cada responsable el registro de cambios, evidencia y hash de commit.
- [ ] Probar el checklist P0 completo en una sesión limpia.
- [ ] Validar que el circuito se construye manualmente y que también ejecuta 0 -> 1 -> 0.
- [ ] Autorizar o rechazar el merge de `presentacion-circuito` a `main`.

## Criterios de aceptación antes del merge

- [ ] Circuito manual construido desde cero sin editar JSON.
- [ ] Conexiones visibles y correctas después de mover todos los nodos relevantes.
- [ ] Entrada `1` activa el token y salida; entrada `0` lo revierte.
- [ ] Sin errores bloqueantes en consola ni en terminal.
- [ ] Pruebas del backend pasan.
- [ ] Build de frontend pasa.
- [ ] Registro de cambios completo y revisado por el encargado de pruebas.

## Fuera de alcance para mañana

No abrir trabajo nuevo si el P0 no está terminado. Se puede registrar como pendiente, pero no debe retrasar la demostración:

- Motor genérico que compile y ejecute cualquier diagrama arbitrario, no sólo el circuito demo.
- Semántica completa de `CCH/read`, cálculo lazy de funciones, Sample y Hold.
- Persistencia de sesiones de simulación en la base de datos.
- Distribución entre dispositivos, alias de señales y detección de ciclos cerrados.
- Mejoras estéticas que no afecten creación, movimiento, conexión o ejecución del circuito.

## Entrega obligatoria por cada tarea

Antes de marcar una tarea con `x`, el responsable debe dejar en `REGISTRO_CAMBIOS_PRESENTACION.md`:

1. Qué hizo y por qué.
2. Archivos modificados.
3. Cómo se probó.
4. Resultado y evidencia.
5. Commit/hash en `presentacion-circuito`.
6. Pendientes o riesgos conocidos.

