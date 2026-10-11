# Arquitectura del runtime HiLeS para la Pico W

## Decisión

El firmware se implementa como un monolito modular en MicroPython. Existe un solo proceso y un solo scheduler cooperativo, pero el código se divide en módulos con responsabilidades explícitas.

## Límites

- `core`: tiempo, `Task` y `Scheduler`; no conoce MQTT, GPIO ni HiLeS.
- `pubsub`: topics, callbacks internos y transporte MQTT; no contiene reglas del circuito.
- `hiles`: carga, validación y ejecución de la IR; no accede directamente a Wi-Fi ni GPIO.
- `devices`: tareas de dispositivos y demostradores físicos.
- `platform`: adaptadores exclusivos de MicroPython como `machine`, `network` y el cliente MQTT.
- `main.py`: crea y conecta objetos; no concentra lógica de negocio.

## Regla de dependencias

```text
main → core + pubsub + hiles + devices + platform
pubsub → core
hiles → core + pubsub
devices → core + pubsub
platform → APIs de MicroPython
```

El núcleo no debe importar los adaptadores de plataforma. Para ejecutar pruebas en un computador se sustituyen reloj, GPIO y transporte por dobles controlables.

## Ejecución remota

Los navegadores editan, compilan y representan el circuito. En modo remoto envían modelo, entradas y comandos, pero no calculan el siguiente estado. La Pico publica la instantánea oficial y cada navegador la aplica solamente si coinciden la sesión, el modelo y la versión, y si su secuencia es posterior a la última recibida.

## Multitarea

Toda tarea concreta implementa `update()` y debe retornar rápidamente. Las esperas se representan mediante tiempo objetivo y estado persistente. Un ciclo con `sleep` dentro de `update()` bloquea todas las tareas y no es aceptable.

El plan y los criterios comprobables de la entrega actual están en [`PLAN_IMPLEMENTACION_PICO_HILES.md`](../../entregas/entrega-5-13-octubre/PLAN_IMPLEMENTACION_PICO_HILES.md).
