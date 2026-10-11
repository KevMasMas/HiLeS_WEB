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

## Copiar el firmware a una Pico W

La validacion fisica sigue pendiente. Cuando la placa este disponible:

1. Instalar MicroPython en la Pico W y abrir Thonny o `mpremote`.
2. Copiar `firmware/pico/core/`, `firmware/pico/devices/` y los `__init__.py` al dispositivo.
3. Copiar `firmware/pico/main.py` y crear en la placa `config_local.py` a partir de `config_local.example.py`, sin guardar credenciales en Git.
4. Instalar en la placa el cliente `umqtt.simple` usado por el transporte cuando ese modulo sea integrado.
5. Ejecutar primero las pruebas de escritorio; despues reiniciar la Pico y observar la consola serie.

La copia no se ha ejecutado porque no hay una Pico conectada y el transporte MQTT modular aun depende de `Node` y su contrato Python.

Si `python` no está publicado en el `PATH`, se debe utilizar el ejecutable Python disponible en el entorno de desarrollo conservando los mismos argumentos.
