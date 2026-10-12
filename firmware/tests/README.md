# Pruebas del firmware

Esta carpeta alojará pruebas ejecutables sin una Pico física. Los módulos de prueba sustituirán el reloj, GPIO y transporte MQTT por dobles deterministas.

Casos mínimos previstos:

- planificación por periodo y prioridad;
- titilado sin esperas bloqueantes;
- entrega de topics y callbacks internos;
- validación y ejecución de la IR;
- movimiento atómico de tokens;
- serialización de instantáneas.

Los archivos de prueba se agregarán junto con cada módulo implementado; no se crearán esqueletos vacíos que aparenten funcionalidad inexistente.

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

## Copiar el firmware a una Pico W

La validación física sigue pendiente. Cuando la placa esté disponible:

1. Instalar MicroPython en la Pico W y abrir Thonny o `mpremote`.
2. Copiar `firmware/pico/core/`, `firmware/pico/devices/`, `firmware/pico/platform/`, `firmware/pico/pubsub/` y `firmware/pico/hiles/`, conservando todos sus `__init__.py`.
3. Copiar `firmware/pico/main.py` y crear en la placa `config_local.py` a partir de `config_local.example.py`, sin guardar credenciales en Git.
4. Instalar `umqtt.simple` en la placa y confirmar que la dirección configurada en `MQTT_HOST` corresponde al PC que ejecuta Mosquitto.
5. Ejecutar primero las pruebas de escritorio; después reiniciar la Pico y observar en la consola serie la conexión Wi-Fi, las suscripciones MQTT y cualquier reintento.
6. Enviar órdenes `encender`, `apagar` y `titilar` desde un navegador o `mosquitto_pub`, y verificar `led/estado` con `mosquitto_sub`.

La copia no se ha ejecutado porque no hay una Pico conectada. El transporte modular y su composición desde `main.py` sí están cubiertos con dobles de escritorio.

Si `python` no está publicado en el `PATH`, se debe utilizar el ejecutable Python disponible en el entorno de desarrollo conservando los mismos argumentos.
