# Guía de demostración — entrega del 20 de octubre

**Responsable del ensayo:** Julián Romero (Persona 5).

**Duración objetivo:** 8 a 12 minutos.

> Cierre actualizado el 25 de octubre de 2026: además de las suites, build, broker y cuatro navegadores, el usuario confirmó satisfactoriamente la prueba física completa con la Pico W como fuente del estado remoto. La validación usa entradas manuales mediante Services; no afirma integración de sensores GPIO.

## 1. Propósito

Demostrar que el editor y la colaboración funcionan en los navegadores del PC, mientras la Raspberry Pi Pico W ejecuta con MicroPython el código Python escrito en los Functional Blocks y conserva el estado oficial de la ejecución remota.

## 2. Preparación previa

### PC servidor

- [x] Confirmar la IPv4 actual del PC.
- [x] Confirmar que el firewall permite el puerto de Vite.
- [x] Iniciar Mosquitto con TCP y WebSockets.
- [x] Verificar credenciales locales sin mostrarlas ni registrarlas.
- [x] Iniciar Vite con `--host 0.0.0.0`.
- [x] Confirmar que la aplicación abre desde otro equipo.
- [x] Preparar el `projectId` de la demostración.

### Raspberry Pi Pico W

- [x] Copiar el firmware actualizado.
- [x] Copiar `config_local.py` únicamente a la placa.
- [x] Confirmar conexión Wi-Fi.
- [x] Confirmar conexión MQTT.
- [x] Confirmar publicación del estado de conexión.
- [ ] Registrar memoria libre inicial.

### Navegadores

- [x] Abrir cuatro navegadores o perfiles independientes.
- [x] Usar exactamente el mismo enlace `?project=<id>`.
- [x] Confirmar una identidad y color diferentes por cliente.
- [x] Confirmar conexión MQTT en los cuatro clientes.
- [ ] Cerrar procesos que puedan alterar el ensayo de red.

## 3. Secuencia de demostración

### Parte A — proyecto compartido

1. Mostrar la URL con `projectId`.
2. Abrir el enlace en el segundo navegador.
3. Comprobar que el modelo aparece sin importar manualmente un JSON.
4. Repetir en los otros dos navegadores.
5. Explicar que el ID selecciona el namespace MQTT del proyecto.

Resultado esperado:

- Los cuatro navegadores muestran el mismo documento.
- La URL no contiene credenciales.
- El snapshot inicial no crea nodos duplicados.

### Parte B — presencia y edición

1. Mover el cursor en un navegador.
2. Mostrar el cursor remoto en los otros tres.
3. Mover un nodo.
4. Editar una propiedad no crítica.
5. Crear o eliminar un elemento de prueba si el tiempo lo permite.
6. Cerrar una pestaña y esperar la expiración de presencia.

Resultado esperado:

- La operación aparece una sola vez en los demás navegadores.
- No existe eco o movimiento repetido.
- El participante desconectado desaparece.

### Parte C — Python ejecutado en la Pico

1. Abrir un Functional Block.
2. Crear o verificar un puerto de entrada `carros` (`integer`) y un puerto de salida `hay_fila` (`boolean`). Mostrar código Python tolerante al valor inicial:

```python
def calcular(**inputs):
    carros = inputs.get('carros')
    if carros is None:
        carros = 0
    return {'hay_fila': carros >= 6}
```

3. Activar ejecución remota.
4. Cargar el modelo en la Pico.
5. Esperar la confirmación de carga.
6. Inyectar `carros = 3` y ejecutar un paso.
7. Mostrar la salida `False` recibida desde la Pico.
8. Inyectar `carros = 8` y ejecutar un paso.
9. Mostrar la salida `True` recibida desde la Pico.
10. Cambiar el umbral a `10`, recargar y repetir.

Resultado esperado:

- En modo remoto Pyodide no calcula el estado.
- La salida cambia después de la instantánea oficial de la Pico.
- Los cuatro navegadores muestran la misma secuencia y resultado.

### Parte D — paridad completa del motor remoto

1. Cargar un modelo que contenga `Service → Sample → Hold → Functional Block` y una red de Petri.
2. Inyectar un valor CCH y comprobar que `Sample` no publica hasta recibir su activación.
3. Activar `Sample` y comprobar que produce un único evento DCH.
4. Comprobar que `Hold` consume el evento, conserva el valor y lo publica por CCH.
5. Ejecutar otro paso sin evento nuevo y comprobar que DCH no se repite.
6. Mostrar tokens, guarda y disparo de una transición Petri/LCH.
7. Ejecutar un elemento o conexión con retardo.
8. Mientras el timer está pendiente, enviar un mensaje MQTT o controlar el LED para demostrar que el scheduler no está bloqueado.
9. Reiniciar y comprobar que se limpian colas, valores retenidos, timers, tokens y errores.
10. Mostrar el resultado del vector equivalente en el motor TypeScript y en MicroPython.

Resultado esperado:

- CCH mantiene su valor continuo.
- DCH representa un evento de un solo consumo y respeta FIFO.
- `Sample` y `Hold` conservan la semántica del motor local.
- Petri/LCH mueve tokens atómicamente.
- Los retardos no usan esperas bloqueantes.
- El snapshot remoto permite representar todos los estados observables.

### Parte E — rechazo seguro

1. Intentar cargar un bloque de prueba con código prohibido:

```python
while True:
    pass
```

2. Mostrar el mensaje de rechazo.
3. Confirmar que la Pico continúa conectada.
4. Confirmar que el modelo válido anterior continúa activo o que el sistema queda en el estado seguro definido por el contrato.

Resultado esperado:

- El código no se ejecuta.
- El scheduler y MQTT no se bloquean.
- El error identifica el Functional Block.

### Parte F — demo manual con cuatro semáforos

1. Cargar el demo distribuido.
2. Explicar que el firmware sigue siendo general: cada dirección solo usa Services y un Functional Block.
3. Inyectar, por ejemplo, Norte = 3 y Este = 8. Cero significa que no hay cola.
4. Ejecutar un paso; las luces ya comienzan en `rojo`.
5. Mostrar `solicitud = true` donde la cantidad sea mayor que cero.
6. Como prueba opcional, inyectar manualmente `verde` en Norte y ejecutar otro paso.
7. Mostrar las salidas de lámparas calculadas por Python en la Pico.
8. Inyectar simultáneamente Norte=`verde` y Este=`verde`.
9. Mostrar que `Seguridad del cruce` reporta `seguro = false`.

Resultado esperado:

- Las entradas manuales enteras llegan a la Pico.
- El Functional Block calcula lámparas y solicitudes.
- El estado muestra la cantidad de vehículos y no solo presencia verdadera/falsa.
- El bloque de seguridad detecta una combinación manual incompatible.

## 4. Evidencias que deben registrarse

| Evidencia | Responsable | Resultado |
|---|---|---|
| Cuatro navegadores con el mismo proyecto | Persona 5 | Aprobado en navegador y broker el 19/10 |
| Presencia y cursores | Persona 5 | Aprobado: 4 → 1 participantes al cerrar clientes |
| Cambio de canvas sincronizado | Persona 5 | Aprobado: edición visible en el cuarto navegador y restaurada |
| Confirmación de modelo por la Pico | Personas 1 y 2 | Aprobado físicamente; confirmado por el usuario el 25/10 |
| Resultado Python remoto | Persona 1 | Aprobado físicamente; confirmado por el usuario el 25/10 |
| Rechazo de código bloqueante | Persona 1 | Aprobado físicamente; confirmado por el usuario el 25/10 |
| Sample/Hold, CCH y DCH | Personas 2 y 3 | Aprobado físicamente; confirmado por el usuario el 25/10 |
| Petri/LCH y retardos no bloqueantes | Personas 1 y 3 | Aprobado físicamente; confirmado por el usuario el 25/10 |
| Paridad TypeScript/MicroPython | Personas 2, 3 y 5 | Aprobado en suites y flujo físico representativo |
| Entradas manuales y cálculo del demo | Persona 3 | Aprobado en Pico física; confirmado por el usuario el 25/10 |
| Vista final de TopBar y canvas | Persona 4 | Aprobada a 1366×768 y 1920×1080 |
| Memoria y duración máxima | Personas 1 y 5 | Pendiente |
| Suites y build | Persona 5 | 153 firmware + 104 frontend; lint, tipos y build aprobados |

Los comandos, resultados, capturas disponibles y pendientes se registran en `REGISTRO_CAMBIOS.md`.

Comandos repetibles ya aprobados:

```powershell
# Desde la raíz: broker real, cuatro clientes, snapshot retenido y aislamiento A/B.
node scripts/test-project-collaboration.mjs
node scripts/test-mqtt-four-clients.mjs

# Firmware de escritorio.
python -m unittest discover -s firmware/tests -p 'test_*.py'

# Desde frontend/.
npm run test:run
npm run lint
npm run build
```

## 5. Plan de contingencia

### Si falla la red

- Verificar IPv4 y firewall.
- Confirmar que los clientes usan la IP del PC y no `localhost`.
- Conservar logs o capturas del último ensayo aprobado.

### Si falla la Pico

- Reiniciar la placa y comprobar `config_local.py`.
- Ejecutar primero un modelo mínimo con un Functional Block.
- No afirmar validación física si solo funciona el runtime de escritorio.

### Si falla la colaboración

- Conservar snapshot compartido y presencia como mínimo.
- Evitar editar simultáneamente el mismo nodo durante el ensayo.
- Registrar exactamente la operación que falla.

### Si el código Python consume demasiada memoria

- Reducir el modelo al Functional Block mínimo.
- Reiniciar la Pico antes del ensayo.
- Reducir tamaño y cantidad de bloques con código.
- Registrar la medición y la reducción aplicada.

## 6. Checklist final

- [x] La Pico es la fuente oficial de la ejecución remota.
- [x] La presentación diferencia Pyodide local de MicroPython remoto.
- [x] Los cuatro clientes abren el mismo proyecto.
- [x] La presencia se actualiza y expira correctamente.
- [x] El código Python válido produce la salida esperada.
- [x] El código prohibido se rechaza sin bloquear la Pico.
- [x] `Service`, Functional Block, `Sample`, `Hold`, `Place` y `Transition` ejecutan en la Pico.
- [x] CCH, DCH y Petri/LCH producen el resultado esperado.
- [x] Los eventos DCH no se repiten y mantienen FIFO.
- [x] Los retardos no bloquean MQTT ni otras tareas.
- [x] Reiniciar limpia todo el estado temporal.
- [x] Los vectores TypeScript y MicroPython coinciden.
- [x] Los Services manuales aceptan cantidades enteras y colores.
- [x] El bloque de seguridad detecta verdes conflictivos introducidos manualmente.
- [x] Las pruebas automáticas están registradas.
- [x] Las limitaciones reales se declaran sin presentar pendientes como terminados.

