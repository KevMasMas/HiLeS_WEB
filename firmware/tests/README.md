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

Si `python` no está publicado en el `PATH`, se debe utilizar el ejecutable Python disponible en el entorno de desarrollo conservando los mismos argumentos.
