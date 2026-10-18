# Pruebas del firmware

Esta carpeta contiene pruebas ejecutables sin una Pico física. Los módulos de prueba sustituyen el reloj, GPIO, Wi-Fi, cliente MQTT y transporte por dobles deterministas.

Casos cubiertos:

- planificación por periodo y prioridad;
- titilado sin esperas bloqueantes;
- entrega de topics y callbacks internos;
- validación y ejecución de la IR;
- movimiento atómico de tokens;
- serialización de instantáneas;
- reconexión Wi-Fi/MQTT y recuperación de suscripciones;
- límite de mensajes, composición completa de `main.py` y enrutamiento del modelo;
- deduplicación de comandos QoS 1 con ventana de 32 identificadores.
- perfil Python acotado, compilación única y ejecución de Functional Blocks;
- validación y copia segura de valores escalares, `vector` y `custom`;
- Watchdog cooperativo con memoria, sensores opcionales y métricas de tareas.

Los archivos de prueba se agregan junto con cada módulo implementado; no se crean esqueletos vacíos que aparenten funcionalidad inexistente.

Desde la raíz del repositorio se ejecutan con:

```powershell
python -m unittest discover -s firmware/tests -t . -v
```

Pruebas del motor HiLeS (Persona 3, Juan Ramos):

- `test_hiles_expressions.py`: gramática y semántica del AST sin `eval`.
- `test_hiles_model.py`: vectores `validos/` e `invalidos/` compartidos con la web y reglas adicionales de la IR v1.
- `test_hiles_engine.py`: vectores `ejecucion/` paso a paso, tokens, pesos, capacidad, conflicto, reinicio y generalidad.
- `test_engine_task.py`: flujo completo `FakeTransport → Node → EngineTask → Node` con `Scheduler` y `FakeClock`.
- `hiles_vectors.py`: lectura de `docs/mqtt/vectores_ir_v1/` y constructores de modelos pequeños.
- `test_python_executor.py`: perfil permitido/prohibido, errores estables, una o varias salidas, aislamiento del scheduler y vectores compartidos de Persona 1.
- `test_runtime_values.py`: tipos y límites JSON del contrato IR v2 Python.
- `test_watchdog_task.py`: publicación periódica y tolerancia a fallos de sensores de telemetría.

## Copiar el firmware a una Pico W

La validación física sigue pendiente. Cuando la placa esté disponible:

1. Instalar MicroPython en la Pico W y abrir Thonny o `mpremote`.
2. Copiar `firmware/pico/core/`, `firmware/pico/devices/`, `firmware/pico/platform/`, `firmware/pico/pubsub/` y `firmware/pico/hiles/`, conservando todos sus `__init__.py`.
3. Copiar `firmware/pico/main.py` y crear en la placa `config_local.py` a partir de `config_local.example.py`, sin guardar credenciales en Git.
4. Instalar `umqtt.simple` en la placa y confirmar que la dirección configurada en `MQTT_HOST` corresponde al PC que ejecuta Mosquitto.
5. Ejecutar primero las pruebas de escritorio; después reiniciar la Pico y observar en la consola serie la conexión Wi-Fi, las suscripciones MQTT y cualquier reintento.
6. Enviar órdenes `encender`, `apagar` y `titilar` desde un navegador o `mosquitto_pub`, y verificar `led/estado` con `mosquitto_sub`.
7. Importar el demo coordinado en la web, cargarlo en modo Pico y recorrer sus fases siguiendo `docs/mqtt/GUIA_ENSAYO_REMOTO_SIN_PICO.md`, sustituyendo las publicaciones manuales por las respuestas reales de la placa.

La copia no se ha ejecutado porque no hay una Pico conectada. El transporte modular y su composición desde `main.py` sí están cubiertos con dobles de escritorio. El procedimiento completo y el ZIP preparado están descritos en `docs/mqtt/GUIA_PRUEBA_PICO_W.md`.

Si `python` no está publicado en el `PATH`, se debe utilizar el ejecutable Python disponible en el entorno de desarrollo conservando los mismos argumentos.
