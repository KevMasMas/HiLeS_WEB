# Especificación normativa de la Representación Intermedia (IR) versión 1

Versión de IR: `1` (`ir_version: 1`)  
Contrato MQTT asociado: [`CONTRATO_MENSAJES_MQTT.md`](CONTRATO_MENSAJES_MQTT.md) (`v1.2`)  
Implementación de referencia en TypeScript: [`frontend/src/services/ir/`](../../frontend/src/services/ir/)

Este documento congela la estructura JSON que el compilador de la aplicación web publica en `modelo/cargar` y que el motor MicroPython de la Raspberry Pi Pico W valida y ejecuta sin `eval`.

---

## 1. Principios de diseño

1. **Sin ejecución de código arbitrario (`eval`/`exec`):** Los `Functional Block` se compilan a un árbol de expresión declarativo (AST) con operadores acotados. Si un bloque del editor contiene código imperativo JavaScript o Python, el compilador web emite un aviso informativo (`IR_CODIGO_NO_SOPORTADO`) indicando que dicho bloque se simula únicamente en modo local.
2. **Conservación de identificadores:** Todos los `id` de elementos y puertos en la IR son idénticos a los del documento del editor (`HilesModelDocument`). De este modo, las instantáneas publicadas por la Pico en `simulacion/estado` se aplican directamente al canvas de los cuatro navegadores sin tablas de traducción.
3. **Aplanamiento estructural:** Los bloques visuales sin lógica propia (`STRUCTURAL_BLOCK`, `PORT`, `TOKEN`) se omiten durante la compilación. Sus elementos hijos se incluyen en la lista plana `elementos`.
4. **Determinismo entre motores:** El orden de `elementos` y `conexiones` se preserva y la semántica de cada paso es idéntica entre `MotorSimulacion` (TypeScript) y el motor MicroPython.

---

## 2. Estructura raíz del modelo (`IrModeloV1`)

Dentro del mensaje `modelo/cargar`, el campo `modelo` tiene la forma:

```json
{
  "elementos": [ ... ],
  "conexiones": [ ... ]
}
```

### Límites normativos de la versión 1

| Parámetro | Valor máximo | Código en caso de exceso |
|---|---:|---|
| Cantidad de elementos (`elementos.length`) | `64` | `IR_LIMITE_EXCEDIDO` |
| Cantidad de conexiones (`conexiones.length`) | `128` | `IR_LIMITE_EXCEDIDO` |
| Profundidad de árbol de expresión | `16` | `IR_LIMITE_EXCEDIDO` |
| Tamaño total del mensaje MQTT en UTF-8 | `32768` bytes | `IR_LIMITE_EXCEDIDO` |

---

## 3. Elementos soportados (`elementos`)

Cada elemento posee un `id` único (texto no vacío), `tipo` y `nombre`.

| Tipo en el editor (`HilesElementType`) | Tipo en la IR (`tipo`) | Comportamiento en el compilador |
|---|---|---|
| `SERVICE` | `"service"` | Soportado. Punto de entrada/salida del circuito. |
| `FUNCTIONAL_BLOCK` | `"functional_block"` | Soportado con expresión declarativa (`expression`). Si tiene `code` JS/Python, emite aviso `IR_CODIGO_NO_SOPORTADO`. |
| `PLACE` | `"place"` | Soportado. Almacena tokens enteros no negativos hasta `capacidad`. |
| `TRANSITION` | `"transition"` | Soportado. Recibe condición booleana por el puerto `"condicion"`. |
| `STRUCTURAL_BLOCK`, `PORT`, `TOKEN` | *(omitido)* | Se aplana; no viaja en la IR. |
| `SAMPLE`, `HOLD` u otro | *(rechazado)* | Emite aviso `IR_TIPO_NO_SOPORTADO`. |

### 3.1 `service`

```json
{
  "id": "sem1-sensor",
  "tipo": "service",
  "nombre": "Sensor carros S1",
  "tipo_dato": "real",
  "salidas": ["sem1-sensor-out"],
  "entradas": []
}
```

- `tipo_dato`: `"boolean" | "integer" | "real" | "string"`. Si el puerto usa `"vector"` o `"custom"`, se emite aviso `IR_TIPO_DATO_INVALIDO`.
- `salidas`: lista de identificadores de puertos de salida. Cuando se inyecta un valor mediante `entrada/establecer`, el `service` publica ese valor por todos sus puertos de salida en el siguiente paso.
- `entradas`: lista de puertos de entrada de datos (opcionalmente conectables dentro del circuito).
- `valor_inicial` *(opcional)*: valor inicial que coincide con `tipo_dato`.

### 3.2 `functional_block`

```json
{
  "id": "sem1-fb-verde",
  "tipo": "functional_block",
  "nombre": "Dar verde (≥ 6)",
  "habilitado": true,
  "entradas": [
    { "puerto": "sem1-verde-in", "variable": "carros" }
  ],
  "salidas": ["sem1-verde-out"],
  "expresion": {
    "op": ">=",
    "args": [
      { "var": "carros" },
      { "lit": 6 }
    ]
  }
}
```

- `habilitado`: booleano (`false` si el bloque está deshabilitado en el editor).
- `entradas`: lista de `{ "puerto": string, "variable": string }`. `variable` es el identificador normalizado en minúsculas sin tildes (p. ej. `"Condición"` → `"condicion"`).
- `salidas`: lista de identificadores de puertos de salida.
- `expresion`: árbol AST (`IrExpresion`) o `null` si la expresión está vacía. Toda variable `{ "var": "<nombre>" }` dentro de `expresion` debe existir en `entradas[].variable` (`IR_REFERENCIA_INVALIDA` en caso contrario).

### 3.3 `place`

```json
{
  "id": "sem1-rojo",
  "tipo": "place",
  "nombre": "Rojo",
  "tokens": 1,
  "capacidad": 1
}
```

- `tokens` y `capacidad`: enteros `>= 0` con `tokens <= capacidad`.

### 3.4 `transition`

```json
{
  "id": "sem1-t-verde",
  "tipo": "transition",
  "nombre": "T · Encender verde",
  "habilitada": true,
  "puerto_accion": "transition-action-out"
}
```

- `habilitada`: booleano de configuración.
- `puerto_accion`: identificador del puerto por el que la transición publica `true` en el paso posterior a su disparo, o `null`.
- Toda conexión de datos que llegue a una `transition` utiliza como `puerto_destino` el nombre normalizado `"condicion"`.

---

## 4. Conexiones (`conexiones`)

Existen únicamente dos tipos de conexión en la IR v1: `"dato"` y `"arco"`. Sus identificadores no pueden repetirse entre sí ni colisionar con identificadores de elementos (`IR_ID_DUPLICADO`).

### 4.1 Conexión de datos (`"dato"`)

Representa un canal continuo (`CONTINUOUS`) o discreto (`DISCRETE`) en modo *push*:

```json
{
  "id": "sem1-cch-2",
  "tipo": "dato",
  "origen": "sem1-fb-verde",
  "puerto_origen": "sem1-verde-out",
  "destino": "sem1-t-verde",
  "puerto_destino": "condicion"
}
```

- `puerto_origen` debe pertenecer a las salidas declaradas de `origen` (`IR_PUERTO_INVALIDO`).
- `puerto_destino` debe pertenecer a las entradas declaradas de `destino` (o ser `"condicion"` si `destino` es una `transition`).
- Ningún extremo puede ser un `place`.
- El subgrafo formado por todas las conexiones `"dato"` debe ser **acíclico** (`IR_CICLO_DATOS`).

### 4.2 Arco de red de Petri (`"arco"`)

Representa flujo de tokens (`TOKEN_FLOW` o `PETRI` con handles `petri-out` / `petri-in`):

```json
{
  "id": "sem1-lch-1",
  "tipo": "arco",
  "origen": "sem1-rojo",
  "destino": "sem1-t-verde",
  "peso": 1
}
```

- Debe unir estrictamente `place → transition` o `transition → place` (`IR_ARCO_INVALIDO`).
- `peso`: entero `>= 1`. Si existen varios arcos entre el mismo `place` y la misma `transition` en la misma dirección, sus pesos se suman.

---

## 5. Lenguaje de expresiones (AST sin `eval`)

### 5.1 Nodos del AST

| Nodo | Forma JSON | Descripción |
|---|---|---|
| Literal | `{ "lit": true \| 6 \| "texto" }` | Booleano, número finito o cadena. |
| Variable | `{ "var": "carros" }` | Valor actual recibido por el puerto asociado a `"carros"`. |
| Unario | `{ "op": "not" \| "-", "args": [ expr ] }` | Negación lógica o cambio de signo numérico. |
| Binario | `{ "op": "<op>", "args": [ izq, der ] }` | Comparación, aritmética o combinación lógica. |

### 5.2 Operadores y semántica de evaluación

Si una variable aún no ha recibido ningún valor desde el inicio o último reinicio, su valor es `ausente` (`undefined` en TypeScript, `None` en MicroPython).

- **Comparación de igualdad (`"=="`, `"!="`):**
  - Dos valores son iguales si y solo si ambos están presentes, tienen el mismo tipo lógico (`boolean`, `number` o `string`) y el mismo valor (`===` del editor se compila a `"=="`).
  - Si alguno está ausente, `"=="` evalúa a `false` y `"!="` evalúa a `true`.
- **Comparación de orden (`"<"`, `"<="`, `">"`, `">="`):**
  - Si ambos operandos son numéricos (`int` o `float`, excluyendo `bool`), retorna el booleano correspondiente.
  - Si alguno está ausente o no es numérico, retorna `false` (idéntico a `evaluateGuard` en el motor web).
- **Aritmética (`"+"`, `"-"`, `"*"`, `"/"`, `"%"`):**
  - Si ambos operandos son numéricos, calcula el resultado (`"/"` y `"%"` con divisor `0` retornan `ausente`). Si alguno no es numérico o está ausente, retorna `ausente`.
- **Lógicos (`"and"`, `"or"`, `"not"`):**
  - Operan sobre booleanos (`&&` → `"and"`, `||` → `"or"`, `!` → `"not"`). Un operando no booleano o ausente se trata como `false`.

---

## 6. Semántica normativa de ejecución

### 6.1 Carga y `reiniciar`

1. Al cargar un modelo válido en `modelo/cargar` (o al recibir `{"accion": "reiniciar"}` en `simulacion/comando`):
   - Cada `place` toma su cantidad inicial `tokens`.
   - Cada `service` toma `valor_inicial` si fue definido, o queda sin valor (`ausente`).
   - Cada `functional_block` limpia sus entradas recibidas y su última salida.
   - Cada `transition` pone su condición en `false`, `disparoPendiente = false` y `ultimoDisparo = false`.
2. Al aceptar la carga, la Pico publica `modelo/confirmacion` con `aceptado: true` y publica la instantánea inicial (`secuencia: 0`, `estado: "lista"`).

### 6.2 Inyección de entrada (`entrada/establecer`)

1. Busca el elemento con `id == servicio_id` y verifica que sea un `service`.
2. Comprueba que `valor` coincida con `tipo_dato`:
   - `"boolean"` → `bool`
   - `"integer"` → entero (no booleano)
   - `"real"` → número (`int` o `float`, no booleano)
   - `"string"` → `str`
3. Guarda el valor en el `service`. El valor se propagará en el siguiente `paso`.

### 6.3 Ejecución de un `paso`

El orden topológico se calcula sobre `elementos` usando las conexiones `"dato"` (algoritmo de Kahn preservando el orden de declaración en `elementos`).

1. **Fase 1 — Propagación de datos (push en orden topológico):**
   - Para cada elemento en el orden topológico:
     - `service`: si tiene un valor actual definido, lo emite por cada puerto de `salidas`.
     - `functional_block`: si `habilitado == true` y `expresion != null`, evalúa `expresion`. Si el resultado no es `ausente`, lo guarda como última `salida` y lo emite por cada puerto de `salidas`.
     - `transition`: si tenía `disparoPendiente == true` del paso anterior, pone `disparoPendiente = false` y emite `true` por `puerto_accion` (si no es `null`).
     - `place`: no emite datos.
   - Cada vez que un elemento emite un valor por `(origen, puerto_origen)`, se recorren en orden las conexiones `"dato"` que coincidan y se entrega el valor a `destino`:
     - Si `destino` es `functional_block`, actualiza la variable asociada a `puerto_destino`.
     - Si `destino` es `transition` (`puerto_destino == "condicion"`), actualiza su condición booleana y limpia `ultimoDisparo = false`.
     - Si `destino` es `service`, actualiza su valor actual.

2. **Fase 2 — Evaluación de la red de Petri:**
   - Una `transition` está **habilitada para disparar** si y solo si:
     1. `habilitada == true` y su condición recibida es `true`.
     2. Tiene al menos un arco de entrada (`place → transition`) y al menos un arco de salida (`transition → place`).
     3. Para todo `place` conectado (considerando consumo total `C` de entrada y producción total `P` de salida sobre ese mismo `place`), se cumple `tokens >= C` y `0 <= tokens - C + P <= capacidad`.
   - **Política de disparo y conflicto:**
     - Si hay **0** transiciones habilitadas para disparar: no se mueven tokens.
     - Si hay **exactamente 1** transición habilitada para disparar: se consumen `C` tokens de cada lugar de entrada, se producen `P` tokens en cada lugar de salida de forma atómica, y la transición marca `disparoPendiente = true` y `ultimoDisparo = true`.
     - Si hay **más de 1** transición habilitada para disparar (**conflicto**): no se mueve ningún token (los tokens se conservan).

3. **Fase 3 — Publicación de instantánea (`simulacion/estado`):**
   - Incrementa `secuencia` en `1`.
   - Construye el diccionario `elementos` con la siguiente representación exacta por tipo:

| Tipo de elemento | Campos en `simulacion/estado.elementos[id]` |
|---|---|
| `service` | `{ "valor": <valor> }` si tiene valor actual; `{}` si aún no tiene valor. |
| `functional_block` | `{ "salida": <resultado> }` si ha producido salida; `{}` en caso contrario. |
| `place` | `{ "tokens": <entero> }` (siempre presente). |
| `transition` | `{ "habilitada": <bool>, "disparada": <bool> }` donde `habilitada` es `habilitada_config && condicion == true` y `disparada` es `ultimoDisparo`. |

---

## 7. Códigos de aviso y rechazo (`CodigoIr`)

Cuando el compilador web detecta un elemento no compatible o cuando la Pico rechaza `modelo/cargar` mediante `modelo/confirmacion` (`aceptado: false`), se utiliza uno de los siguientes códigos:

| Código | Cuándo se produce |
|---|---|
| `IR_VERSION_NO_SOPORTADA` | `ir_version` es diferente de `1`. |
| `IR_LIMITE_EXCEDIDO` | Se superan 64 elementos, 128 conexiones, profundidad 16 o 32768 bytes. |
| `IR_TIPO_NO_SOPORTADO` | El elemento es `SAMPLE`, `HOLD` u otro tipo desconocido en v1. |
| `IR_CODIGO_NO_SOPORTADO` | Un `FUNCTIONAL_BLOCK` contiene código JS/Python en `properties.code`. |
| `IR_ID_DUPLICADO` | Dos elementos o conexiones comparten el mismo `id`. |
| `IR_REFERENCIA_INVALIDA` | Una conexión apunta a un elemento inexistente o una expresión usa una variable sin puerto de entrada. |
| `IR_PUERTO_INVALIDO` | `puerto_origen` o `puerto_destino` no pertenece al elemento conectado. |
| `IR_ARCO_INVALIDO` | Un `"arco"` no une `place ↔ transition` o su `peso` no es un entero `>= 1`. |
| `IR_CONEXION_NO_SOPORTADA` | Una conexión toca un bloque estructural/puerto, conecta datos a un `place` o usa un tipo no soportado. |
| `IR_CICLO_DATOS` | Las conexiones `"dato"` forman un ciclo dirigido. |
| `IR_EXPRESION_INVALIDA` | La expresión no respeta la gramática o el formato AST de la IR v1. |
| `IR_TIPO_DATO_INVALIDO` | `tipo_dato` no es `boolean`, `integer`, `real` ni `string`, o `valor_inicial` no coincide. |
| `IR_ESTRUCTURA_INVALIDA` | Falta un campo obligatorio o su tipo JSON primitivo es incorrecto (`tokens > capacidad`, etc.). |

---

## 8. Vectores de conformidad compartidos

La carpeta [`docs/mqtt/vectores_ir_v1/`](vectores_ir_v1/) contiene los casos JSON compartidos que deben pasar tanto en la suite de Vitest del frontend como en la suite `unittest` del firmware MicroPython:

- `validos/`: modelos `IrModeloV1` que `validarIrV1` y el cargador de la Pico deben aceptar.
- `invalidos/`: objetos `{ descripcion, codigo_esperado, modelo }` que ambos validadores deben rechazar con `codigo_esperado`.
- `ejecucion/`: objetos `{ descripcion, modelo_id, version, ir_version, modelo, estado_inicial, pasos }` generados con `MotorSimulacion` que el motor MicroPython de la Persona 3 debe reproducir paso a paso.
