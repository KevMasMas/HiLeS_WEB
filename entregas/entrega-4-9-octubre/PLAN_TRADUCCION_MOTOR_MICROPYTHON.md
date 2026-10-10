# Plan de traducción progresiva del motor HiLeS a MicroPython

**Fecha:** 9 de octubre de 2026  
**Responsables:** Kevin Rincon, Felipe Prado, Julian Romero y Juan David Romero  
**Estado:** plan aprobado para iniciar; la migración completa no forma parte de lo terminado en esta entrega.

## Objetivo

Mover progresivamente la lógica de ejecución del motor HiLeS desde TypeScript hacia la Raspberry Pi Pico W. La aplicación web seguirá siendo el editor y la interfaz gráfica, pero cuando esté en modo remoto no decidirá el resultado de la simulación: enviará el modelo y los comandos a la Pico, y dibujará el estado que la Pico publique por MQTT.

El trabajo no se amarrará al ejemplo de humedad ni a nombres específicos de nodos. La Pico recibirá una representación genérica del circuito y la interpretará según los tipos de elementos, conexiones, propiedades y valores de entrada.

## Qué se mostrará en la entrega de hoy

Se implementará primero un subconjunto pequeño, pero real, del motor:

```text
Service de confirmación ──CCH──> Functional Block booleano
                                      │ condición
                                      ▼
Place "Espera" (1 token) ──LCH──> Transition ──LCH──> Place "Confirmado" (0 tokens)
```

Flujo esperado:

1. La web convierte el circuito actual a un modelo ejecutable compacto y lo publica en `modelo/cargar`.
2. La Pico valida el identificador, la versión y los elementos soportados.
3. La Pico responde por `modelo/confirmacion` indicando si puede ejecutarlo.
4. La web establece el valor booleano del `Service` mediante `entrada/establecer`.
5. La web solicita un paso mediante `simulacion/comando`.
6. La Pico evalúa el `Functional Block`.
7. Si el resultado es verdadero, la Pico habilita la `Transition`, consume el token de `Espera` y produce uno en `Confirmado`.
8. La Pico publica una instantánea del estado y la web actualiza el dibujo sin recalcular el resultado localmente.

Esta demostración permite afirmar lo siguiente:

> La Pico ya ejecuta un subconjunto genérico de HiLeS compuesto por entradas de Service, una operación booleana, Places, Transitions y movimiento de tokens. La traducción de los demás elementos y reglas continúa según este plan.

No se debe afirmar todavía que cualquier diagrama HiLeS se ejecuta en la Pico.

## Arquitectura objetivo

```text
┌──────────────────────── Aplicación web ────────────────────────┐
│ Editor + validación visual + compilador a IR + representación  │
└───────────────┬───────────────────────────────────────▲─────────┘
                │ modelo, entradas y comandos           │ estado
                ▼                                       │
                         Mosquitto MQTT
                │                                       ▲
                ▼                                       │
┌──────────────────────── Raspberry Pi Pico W ───────────────────┐
│ carga del modelo + motor MicroPython + estado de la simulación │
└─────────────────────────────────────────────────────────────────┘
```

### División de responsabilidades entre web y Pico

| Responsabilidad | Web | Pico |
|---|---:|---:|
| Editar y dibujar el circuito | Sí | No |
| Revisar conexiones antes de enviar | Sí | Sí, validación defensiva |
| Traducir el documento del editor a una representación compacta | Sí | No |
| Mantener el estado oficial de una ejecución remota | No | Sí |
| Evaluar Functional Blocks | No, en modo remoto | Sí |
| Habilitar y disparar Transitions | No, en modo remoto | Sí |
| Consumir y producir tokens | No, en modo remoto | Sí |
| Publicar resultados y errores | Presenta | Produce |

## Representación ejecutable intermedia

No conviene enviar código JavaScript para intentar ejecutarlo en MicroPython. La web debe compilar el documento de edición `schemaVersion: 2` a una representación intermedia, o **IR**, formada solamente por datos y operaciones conocidas.

Ejemplo conceptual del circuito mínimo:

```json
{
  "modelo_id": "paso-token-01",
  "version": 1,
  "ir_version": 1,
  "elementos": [
    { "id": "confirmacion", "tipo": "SERVICE", "valor_inicial": false },
    {
      "id": "validar",
      "tipo": "FUNCTIONAL_BLOCK",
      "operacion": { "op": "igual", "entrada": "confirmacion", "valor": true }
    },
    { "id": "espera", "tipo": "PLACE", "tokens": 1, "capacidad": 1 },
    { "id": "avanzar", "tipo": "TRANSITION", "condicion": "validar" },
    { "id": "confirmado", "tipo": "PLACE", "tokens": 0, "capacidad": 1 }
  ],
  "conexiones": [
    { "origen": "confirmacion", "destino": "validar", "tipo": "CONTINUOUS" },
    { "origen": "validar", "destino": "avanzar", "tipo": "CONTINUOUS" },
    { "origen": "espera", "destino": "avanzar", "tipo": "TOKEN_FLOW", "peso": 1 },
    { "origen": "avanzar", "destino": "confirmado", "tipo": "TOKEN_FLOW", "peso": 1 }
  ]
}
```

El formato definitivo debe conservar los identificadores del editor para que la web pueda aplicar cada actualización al nodo correcto.

### Operaciones iniciales permitidas

Para el primer intérprete se admitirá una lista explícita y segura:

- constantes booleanas y numéricas;
- comparación: `igual`, `diferente`, `mayor`, `mayor_igual`, `menor`, `menor_igual`;
- lógica: `y`, `o`, `no`;
- posteriormente, aritmética básica: `sumar`, `restar`, `multiplicar` y `dividir`.

No se usará `eval` en la Pico ni se ejecutarán expresiones JavaScript o Python arbitrarias recibidas por MQTT.

## Contrato MQTT que necesita el motor remoto

Se mantienen los topics existentes y se añade una instantánea específica de ejecución:

| Dirección | Sufijo del topic | Uso |
|---|---|---|
| Web → Pico | `modelo/cargar` | Cargar la IR del circuito |
| Pico → web | `modelo/confirmacion` | Aceptar o rechazar el modelo |
| Web → Pico | `entrada/establecer` | Cambiar el valor de un Service |
| Web → Pico | `simulacion/comando` | `paso`, `iniciar`, `detener` o `reiniciar` |
| Pico → web | `simulacion/estado` | Publicar la instantánea oficial del motor |
| Pico → web | `salida` | Publicar una salida externa de un Service |
| Pico → web | `error` | Informar fallos de validación o ejecución |

Todos los mensajes de solicitud deben llevar `id_mensaje`. Las respuestas deben repetirlo cuando correspondan y agregar `modelo_id`, `version` y un número incremental `secuencia` para que la web no aplique estados antiguos.

Ejemplo de estado remoto:

```json
{
  "modelo_id": "paso-token-01",
  "version": 1,
  "secuencia": 3,
  "estado": "pausada",
  "elementos": {
    "confirmacion": { "valor": true },
    "validar": { "salida": true },
    "espera": { "tokens": 0 },
    "avanzar": { "habilitada": true, "disparada": true },
    "confirmado": { "tokens": 1 }
  },
  "id_mensaje": "paso-001"
}
```

## Reparto del trabajo entre las cuatro personas

### Persona 1 — Kevin Rincon: protocolo MQTT y confiabilidad de transporte

Responsable de que web y Pico puedan intercambiar modelos y estados sin ambigüedad.

Estado al 9 de octubre:

- [x] Topic `simulacion/estado` centralizado en el frontend.
- [x] Contratos y validadores de carga, confirmación, entrada, comando, estado y error.
- [x] Correlación mediante `id_mensaje`, identidad de modelo, versión y secuencia.
- [x] Límites iniciales de mensaje, elementos y conexiones.
- [x] Política QoS/retención aplicada por el cliente web.
- [x] Reglas de reconexión, orden y duplicados documentadas.
- [ ] Verificar los mensajes nuevos contra Mosquitto y la Pico después de integrar el motor de Felipe.
- [ ] Implementar en la Pico el registro de los últimos 32 `id_mensaje` junto con Felipe.

Tareas para el demostrador:

- agregar `simulacion/estado` a la lista central de topics;
- cerrar los JSON de carga, confirmación, entrada, comando, estado y error;
- definir `id_mensaje`, `modelo_id`, `version` y `secuencia`;
- fijar límites de tamaño y rechazar cargas incompletas;
- comprobar publicación y suscripción en Mosquitto con los mensajes genéricos.

Tareas de migración completa:

- definir confirmaciones para cada comando;
- decidir QoS y mensajes retenidos por tipo de topic;
- diseñar fragmentación solamente si un modelo supera el tamaño práctico aceptado;
- documentar reconexión, repetición segura y descarte de mensajes duplicados;
- mantener actualizados `CONTRATO_MENSAJES_MQTT.md` y la configuración del broker.

Criterio de terminación: una misma solicitud no se ejecuta dos veces por reconexión y la web puede asociar cada respuesta con su comando.

### Persona 2 — Felipe Prado: núcleo del motor en MicroPython

Responsable de la implementación que se ejecuta físicamente en la Pico.

Tareas para el demostrador:

- crear los módulos `hiles_modelo.py`, `hiles_elementos.py`, `hiles_petri.py` y `hiles_motor.py`;
- cargar y validar la IR versión 1;
- implementar `Service`, `Functional Block` booleano, `Place` y `Transition`;
- implementar `paso` y `reiniciar`;
- mover tokens de forma atómica, respetando peso y capacidad;
- integrar el motor con el ciclo MQTT existente de `main.py`;
- publicar `simulacion/estado` y errores sin detener el bucle de la Pico.

Tareas de migración completa:

- agregar propagación CCH y eventos DCH;
- implementar `Sample` y `Hold` con la semántica actual del editor;
- agregar cola de eventos, retardos y estabilización por paso;
- implementar inicio, pausa, ejecución continua y límites de iteración;
- controlar memoria, watchdog y recuperación tras desconexión.

Criterio de terminación: ante el mismo modelo, entradas y comandos, la Pico produce el estado esperado sin depender de nombres concretos del ejemplo.

### Persona 3 — Julian Romero: cliente de ejecución remota en la web

Responsable de conectar el editor con el nuevo motor sin duplicar decisiones.

Tareas para el demostrador:

- agregar la selección `Ejecución local` / `Ejecución en Pico`;
- publicar el modelo compilado en `modelo/cargar`;
- enviar entradas y comandos con identificadores únicos;
- mostrar carga mientras se espera confirmación o estado;
- suscribirse a `modelo/confirmacion`, `simulacion/estado` y `error`;
- aplicar tokens, valores y estados recibidos a los nodos del canvas;
- impedir que el motor TypeScript ejecute paralelamente cuando se elige la Pico.

Tareas de migración completa:

- representar ejecución continua, pausa, reinicio y desconexión;
- conservar el último estado confirmado sin inventar avances durante una caída;
- mostrar elementos no soportados antes de enviar el modelo;
- separar el estado editable del modelo del estado temporal de ejecución;
- cubrir la interfaz remota con pruebas unitarias.

Criterio de terminación: todo cambio visible durante el modo remoto proviene de una instantánea publicada por la Pico.

### Persona 4 — Juan David Romero: compilador de modelo, compatibilidad y pruebas

Responsable de traducir el modelo general del editor a la IR y comprobar que ambos motores coincidan.

Tareas para el demostrador:

- implementar el traductor de `HilesModelDocument` a IR versión 1;
- validar tipos, puertos, conexiones y operaciones antes de publicar;
- construir el circuito genérico de confirmación y paso de token;
- preparar casos de conformidad con entrada falsa, entrada verdadera, capacidad llena y mensaje inválido;
- coordinar la integración de protocolo, Pico y web;
- actualizar la documentación con el alcance real conseguido.

Tareas de migración completa:

- ampliar la traducción para todos los tipos de elementos y canales;
- normalizar expresiones del `Functional Block` a operaciones seguras;
- crear vectores de prueba compartidos por TypeScript y MicroPython;
- comparar instantáneas de ambos motores paso a paso;
- mantener la matriz de compatibilidad por versión de IR.

Criterio de terminación: un modelo soportado no depende de edición manual del JSON y produce resultados equivalentes en TypeScript y MicroPython.

## Orden de integración

### Fase 0 — Congelar interfaces

- contrato MQTT del motor remoto;
- IR versión 1;
- formato de estado y errores;
- lista exacta de elementos admitidos.

Nadie debe programar contra nombres de campos provisionales después de cerrar esta fase.

### Fase 1 — Demostrador genérico

- `Service` booleano;
- `Functional Block` con comparación segura;
- `Place` y `Transition`;
- comando `paso`;
- movimiento de un token;
- estado remoto reflejado en la web.

Esta es la única fase que se propone enseñar hoy como ejecución del modelo en la Pico.

### Fase 2 — Núcleo Petri completo

- múltiples Places y Transitions;
- pesos, capacidades, conflictos y disparo atómico;
- condiciones de transición;
- reinicio y ejecución de varios pasos.

### Fase 3 — Flujo de datos

- propagación CCH;
- eventos DCH;
- orden topológico;
- múltiples entradas y salidas de Functional Blocks;
- publicación de Services de salida.

### Fase 4 — Conversores y tiempo

- `Sample`: entradas CCH + LCH y salida DCH;
- `Hold`: entrada DCH y salidas CCH + LCH;
- retardos, cola de eventos y estabilización;
- tratamiento explícito de ciclos.

### Fase 5 — Compatibilidad y endurecimiento

- todos los elementos soportados por el editor;
- pruebas de conformidad TypeScript/MicroPython;
- modelos más grandes y límites de memoria;
- reconexión durante una simulación;
- versionado y migración de la IR.

## Archivos previstos

```text
entregas/entrega-4-9-octubre/pico/
├── main.py
├── hiles_modelo.py
├── hiles_expresiones.py
├── hiles_elementos.py
├── hiles_petri.py
├── hiles_grafo.py
├── hiles_motor.py
└── hiles_protocolo.py

frontend/src/
├── engine/remote/compilarModeloPico.ts
├── services/mqtt/MqttRemoteSimulation.ts
├── services/mqtt/config.ts
├── services/mqtt/messages.ts
└── stores/useRemoteSimulationStore.ts
```

Los nombres pueden ajustarse al integrar, pero deben mantenerse separados el protocolo, la carga del modelo, los elementos y el controlador de simulación.

## Reglas de aceptación

- Ninguna regla del demostrador depende de `humedad`, `parqueadero` u otro ejemplo concreto.
- La Pico rechaza tipos u operaciones no soportadas con un error legible.
- Un paso es atómico: no puede consumir tokens sin producir los correspondientes.
- La capacidad de los Places nunca se supera.
- La web no ejecuta el motor local mientras el modo Pico está activo.
- Toda instantánea identifica modelo, versión y secuencia.
- Las credenciales Wi-Fi y MQTT permanecen fuera del repositorio.
- La ampliación de la IR exige aumentar su versión o conservar compatibilidad.

## Pendientes concretos después del demostrador

1. Traducir operaciones aritméticas y Functional Blocks con varias entradas.
2. Completar reglas de conflicto y prioridades Petri.
3. Portar propagación CCH, DCH y cola de eventos.
4. Portar `Sample` y `Hold` con sus puertos corregidos.
5. Añadir ejecución continua y temporización.
6. Ejecutar los mismos modelos de conformidad en web y Pico.
7. Medir el límite real de elementos y conexiones que soporta la memoria de la Pico.
