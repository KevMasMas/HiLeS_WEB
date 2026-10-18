# Guía de demostración — entrega del 20 de octubre

**Responsable del ensayo:** Persona 5, nombre por confirmar.

**Duración objetivo:** 8 a 12 minutos.

## 1. Propósito

Demostrar que el editor y la colaboración funcionan en los navegadores del PC, mientras la Raspberry Pi Pico W ejecuta con MicroPython el código Python escrito en los Functional Blocks y conserva el estado oficial de la ejecución remota.

## 2. Preparación previa

### PC servidor

- [ ] Confirmar la IPv4 actual del PC.
- [ ] Confirmar que el firewall permite el puerto de Vite.
- [ ] Iniciar Mosquitto con TCP y WebSockets.
- [ ] Verificar credenciales locales sin mostrarlas ni registrarlas.
- [ ] Iniciar Vite con `--host 0.0.0.0`.
- [ ] Confirmar que la aplicación abre desde otro equipo.
- [ ] Preparar el `projectId` de la demostración.

### Raspberry Pi Pico W

- [ ] Copiar el firmware actualizado.
- [ ] Copiar `config_local.py` únicamente a la placa.
- [ ] Confirmar conexión Wi-Fi.
- [ ] Confirmar conexión MQTT.
- [ ] Confirmar publicación del estado de conexión.
- [ ] Registrar memoria libre inicial.

### Navegadores

- [ ] Abrir cuatro navegadores o perfiles independientes.
- [ ] Usar exactamente el mismo enlace `?project=<id>`.
- [ ] Confirmar una identidad y color diferentes por cliente.
- [ ] Confirmar conexión MQTT en los cuatro clientes.
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
2. Mostrar código Python sencillo:

```python
def calcular(carros):
    return carros >= 6
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

### Parte F — cuatro semáforos inteligentes

1. Cargar el demo distribuido.
2. Mostrar que cada dirección tiene sensor y FSM propios.
3. Activar demanda Norte.
4. Recorrer Norte verde, amarillo y rojo.
5. Activar demanda Este durante el ciclo Norte.
6. Mostrar que Este espera hasta el intervalo seguro.
7. Recorrer Este verde, amarillo y rojo.
8. Activar varias demandas y explicar el desempate.
9. Forzar o simular un fallo y mostrar el retorno a rojo.

Resultado esperado:

- No existe salto normal de verde a rojo.
- Direcciones conflictivas nunca aparecen verdes simultáneamente.
- Una demanda en espera termina siendo atendida.
- Un fallo conduce a rojo.

## 4. Evidencias que deben registrarse

| Evidencia | Responsable | Resultado |
|---|---|---|
| Cuatro navegadores con el mismo proyecto | Persona 5 | Pendiente |
| Presencia y cursores | Persona 5 | Pendiente |
| Cambio de canvas sincronizado | Persona 5 | Pendiente |
| Confirmación de modelo por la Pico | Personas 1 y 2 | Pendiente |
| Resultado Python remoto | Persona 1 | Pendiente |
| Rechazo de código bloqueante | Persona 1 | Pendiente |
| Sample/Hold, CCH y DCH | Personas 2 y 3 | Pendiente |
| Petri/LCH y retardos no bloqueantes | Personas 1 y 3 | Pendiente |
| Paridad TypeScript/MicroPython | Personas 2, 3 y 5 | Pendiente |
| Ciclo de cuatro semáforos | Persona 3 | Pendiente |
| Vista final de TopBar y canvas | Persona 4 | Pendiente |
| Memoria y duración máxima | Personas 1 y 5 | Pendiente |
| Suites y build | Persona 5 | Pendiente |

Los comandos, resultados, capturas disponibles y pendientes se registran en `REGISTRO_CAMBIOS.md`.

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

- [ ] La Pico es la fuente oficial de la ejecución remota.
- [ ] La presentación diferencia Pyodide local de MicroPython remoto.
- [ ] Los cuatro clientes abren el mismo proyecto.
- [ ] La presencia se actualiza y expira correctamente.
- [ ] El código Python válido produce la salida esperada.
- [ ] El código prohibido se rechaza sin bloquear la Pico.
- [ ] `Service`, Functional Block, `Sample`, `Hold`, `Place` y `Transition` ejecutan en la Pico.
- [ ] CCH, DCH y Petri/LCH producen el resultado esperado.
- [ ] Los eventos DCH no se repiten y mantienen FIFO.
- [ ] Los retardos no bloquean MQTT ni otras tareas.
- [ ] Reiniciar limpia todo el estado temporal.
- [ ] Los vectores TypeScript y MicroPython coinciden.
- [ ] Los semáforos cumplen verde → amarillo → rojo.
- [ ] No aparecen verdes conflictivos.
- [ ] Las pruebas automáticas están registradas.
- [ ] Las limitaciones reales se declaran sin presentar pendientes como terminados.

