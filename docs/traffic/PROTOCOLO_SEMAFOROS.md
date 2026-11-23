# Demo distribuida de cuatro semáforos

Este modelo demuestra ejecución distribuida sin un controlador central y sin
lógica vial en el firmware. Cuatro Structural Blocks autónomos comparten un
único token lógico en el orden Norte → Este → Sur → Oeste → Norte.

## Contenido de cada nodo

Cada semáforo contiene:

- un Service `sensor-<sentido>` para introducir manualmente los carros en fila;
- un Functional Block `decision-<sentido>` que publica `hay_demanda`,
  `sin_demanda` y el pulso genérico `ciclo_activo`;
- Places locales para rojo, verde, amarillo, token y recepción disponible;
- Transitions locales para tomar, ceder y recibir el token.

El Functional Block no elige un ganador global ni conoce las filas de los
otros accesos. El estado y la temporización se modelan explícitamente con Petri.

## Protocolo del token

1. El modelo inicia con los cuatro semáforos en rojo y un solo token en Norte.
2. Si el propietario tiene carros, consume rojo + token y pasa a verde.
3. Después de 3000 ms pasa obligatoriamente de verde a amarillo.
4. Después de 1000 ms pasa de amarillo a rojo y emite el token al siguiente.
5. Si no tiene carros, permanece rojo y cede el token inmediatamente.
6. El siguiente nodo recibe el pulso por una ruta LCH y crea su token local.

El permiso no existe como Place durante verde o amarillo: está representado por
la fase activa. Por eso la suma de Places `*-token` puede ser cero durante el
turno, pero nunca hay dos permisos ni dos verdes simultáneos.

Hay dos posibles mensajes de cesión por nodo —fin normal y salto sin demanda—,
para un total de ocho rutas remotas. Los arcos Petri permanecen dentro del mismo
Structural Block y cada bloque puede asignarse a una Pico o navegador distinto.

## Cómo demostrarlo

1. Importar `output/demo-4-semaforos-distribuidos.json`.
2. Activar cuatro ejecutores y asignar un Structural Block a cada uno.
3. Desplegar y comprobar los cuatro ACK.
4. Inyectar, por ejemplo, Norte `0`, Este `5`, Sur `0` y Oeste `0`.
5. Ejecutar pasos: Norte cede el token y Este entra en verde.
6. Avanzar 3000 ms: Este debe pasar a amarillo.
7. Avanzar 1000 ms: Este debe pasar a rojo y entregar el token a Sur.
8. Continuar los pasos y observar el recorrido completo del anillo.

La prueba automatizada equivalente vive en
`firmware/tests/test_hiles_engine_v2.py` y verifica la secuencia, los tiempos y
que el siguiente nodo reciba exactamente un token.

## Alcance de seguridad

La demo ya garantiza por construcción un único turno y la transición obligatoria
verde → amarillo → rojo. Sigue siendo una demostración académica, no un
controlador vial certificado:

- si un ejecutor cae mientras posee el turno, el token puede quedar perdido;
- todavía no hay lease, heartbeat ni elección distribuida para regenerarlo;
- una partición de red no fuerza por sí sola una salida GPIO a rojo;
- no reemplaza enclavamientos eléctricos ni normas de seguridad vial.

La siguiente mejora es un token identificado y con vencimiento, más un modo rojo
seguro ante pérdida de heartbeat. Esa recuperación debe conservar la propiedad
de que nunca se creen dos tokens.

## Regeneración

```powershell
node scripts/generate-distributed-traffic-demo.mjs
```

El comando regenera el documento del editor. La fixture
`docs/traffic/ir_demo_semaforos_distribuidos.json` se obtiene con el compilador
oficial y se ejecuta también en el runtime MicroPython.
