# Especificación normativa de la Representación Intermedia (IR) versión 2

Versión de IR: `2` (`ir_version: 2`)  
Compatibilidad hacia atrás: modelos `ir_version: 1` son aceptados y migrados automáticamente a `IrModeloV2` mediante `migrarIrV1AV2`.  
Contrato de proyectos asociado: [`PROTOCOLO_PROYECTOS_V2.md`](PROTOCOLO_PROYECTOS_V2.md)  
Implementaciones de referencia:
- TypeScript (Web): [`frontend/src/services/ir/`](../../frontend/src/services/ir/) (`tiposIrV2.ts`, `validadorIrV2.ts`, `compiladorIrV2.ts`)
- Python / MicroPython (Pico): [`firmware/pico/hiles/`](../../firmware/pico/hiles/) (`runtime_values.py`, `python_executor.py`)

---

## 1. Alcance y novedades frente a IR v1

La **IR v2** amplía la IR v1 para soportar en ambos motores (`MotorSimulacion` web y motor remoto en Pico):

1. **Bloques ejecutables completos:** `service`, `functional_block` (en modo `"python"` restringido o `"expresion"` AST), `sample`, `hold`, `place` y `transition`.
2. **Tipos de datos extendidos (`IrTipoDatoV2`):** `"boolean"`, `"integer"`, `"real"`, `"string"`, `"vector"` (lista finita de números) y `"custom"` (estructura JSON anidada acotada).
3. **Canales diferenciados:**
   - `"cch"` (Continuous Channel): retiene la última muestra disponible; cuando tiene `retardo_ms > 0`, solo programa o reemplaza una entrega diferida cuando el valor emitido cambia respecto al último valor publicado en esa conexión.
   - `"dch"` (Discrete Channel): cola FIFO con capacidad acotada (`DEFAULT_DCH_QUEUE_CAPACITY = 8`, `MAX_DCH_QUEUE_CAPACITY = 32`), consumo de **1 evento por paso por puerto** y reporte explícito de desbordamiento (`DCH_COLA_DESBORDADA`). Un `service` conectado a un canal `dch` solo emite eventos discretos cuando recibe una nueva muestra inyectada (`inyectarEntrada`), sin re-encolar su valor retenido en pasos posteriores sin inyección.
   - `"lch"` (Logical Channel): pulso booleano de **un solo paso** (`true` en el paso de emisión, limpiado automáticamente al finalizar el paso).
   - `"arco"`: arco de red de Petri (`place → transition` o `transition → place`) con `peso >= 1`.
4. **Retardos no bloqueantes (`retardo_ms`):** soportados en elementos (`service`, `functional_block`, `sample`, `hold`, `transition`) y en conexiones de canal (`cch`, `dch`, `lch`), gobernados por reloj lógico monotónico sin bloquear el bucle principal (`sleep`).
5. **Aplanamiento determinista de jerarquía:** `STRUCTURAL_BLOCK` y `PORT` se aplanan preservando los identificadores de los elementos hoja, y los nodos legados `TOKEN` / `TOKEN_FLOW` se normalizan a `place.tokens` y `arco`.

---

## 2. Límites normativos de la IR v2

| Categoría | Parámetro | Valor máximo | Código de diagnóstico |
|---|---|---:|---|
| Modelo | `elementos.length` | `64` | `IR_LIMITE_EXCEDIDO` |
| Modelo | `conexiones.length` | `128` | `IR_LIMITE_EXCEDIDO` |
| Modelo | Tamaño total JSON serializado (`IR_MAX_MODELO_BYTES_V2`) | `31744` bytes (presupuesto MQTT `32768` bytes) | `IR_LIMITE_EXCEDIDO` |
| Expresión AST | Profundidad máxima (`IR_MAX_PROFUNDIDAD_AST_V2`) | `16` | `IR_LIMITE_EXCEDIDO` |
| Valores runtime | `MAX_VALUE_DEPTH` (`custom`) | `6` | `VALOR_LIMITE_EXCEDIDO` |
| Valores runtime | `MAX_CONTAINER_ITEMS` (`custom`) | `64` | `VALOR_LIMITE_EXCEDIDO` |
| Valores runtime | `MAX_VECTOR_LENGTH` (`vector`) | `32` | `VALOR_LIMITE_EXCEDIDO` |
| Valores runtime | `MAX_STRING_LENGTH` (`string`) | `256` | `VALOR_LIMITE_EXCEDIDO` |
| Valores runtime | `MAX_SERIALIZED_BYTES` | `2048` bytes | `VALOR_LIMITE_EXCEDIDO` |
| Perfil Python | `MAX_CODE_BYTES` | `2048` bytes | `PYTHON_CODIGO_INVALIDO` |
| Perfil Python | `MAX_CODE_LINES` | `40` líneas | `PYTHON_CODIGO_INVALIDO` |
| Perfil Python | `MAX_INPUTS` / `MAX_OUTPUTS` | `16` / `16` | `PYTHON_CODIGO_INVALIDO` |
| Canales y retardos | `DEFAULT_DCH_QUEUE_CAPACITY` | `8` | — |
| Canales y retardos | `MAX_DCH_QUEUE_CAPACITY` | `32` | `IR_CAPACIDAD_INVALIDA` |
| Canales y retardos | `MAX_DELAY_MS` (`retardo_ms`) | `600000` ms | `IR_RETARDO_INVALIDO` |

---

## 3. Estructura raíz (`IrModeloV2`)

```json
{
  "ir_version": 2,
  "modelo_id": "parqueadero-hibrido-v2",
  "version": 1,
  "nombre": "Parqueadero híbrido con Sample/Hold",
  "metadata": {
    "documento_schema_version": 2,
    "compilado_en": "2026-10-18T12:00:00.000Z",
    "bloque_raiz_id": "root-block",
    "structural_blocks_aplanados": ["sub-bloque-1"],
    "normalizaciones_legadas": ["structural_block_aplanado"]
  },
  "entradas_externas": [
    {
      "elemento_id": "sensor-flujo",
      "nombre": "Sensor flujo",
      "puerto_salida": "sensor-out",
      "tipo_dato": "vector",
      "valor_inicial": [2, 3, 5]
    }
  ],
  "elementos": [ ... ],
  "conexiones": [ ... ]
}
```

---

## 4. Especificación de elementos (`elementos`)

### 4.1 `service`

```json
{
  "id": "sensor-flujo",
  "tipo": "service",
  "nombre": "Sensor flujo",
  "tipo_dato": "vector",
  "salidas": ["sensor-out"],
  "entradas": [],
  "valor_inicial": [2, 3, 5],
  "retardo_ms": 0
}
```

### 4.2 `functional_block` (modo `"python"` y modo `"expresion"`)

```json
{
  "id": "fb-estadisticas",
  "tipo": "functional_block",
  "nombre": "Totalizador Python",
  "habilitado": true,
  "lenguaje": "python",
  "codigo": "def calcular( lecturas ):\n    total = sum(lecturas)\n    alerta = total >= 10\n    return {'total': total, 'alerta': alerta}",
  "entradas": [
    { "puerto": "in-lecturas", "variable": "lecturas", "tipo_dato": "vector" }
  ],
  "salidas": [
    { "puerto": "out-total", "variable": "total", "tipo_dato": "real" },
    { "puerto": "out-alerta", "variable": "alerta", "tipo_dato": "boolean" }
  ],
  "retardo_ms": 0
}
```

#### Perfil Python restringido permitido en `functional_block`
- **Modos soportados:**
  - Expresión pura de una sola línea (ej. `sum(lecturas) >= 10`).
  - Función pura `def calcular(...):` con parámetros explícitos coincidentes con `entradas[].variable` o `**inputs` (`inputs.get('clave', defecto)`).
- **Builtins permitidos:** `abs`, `bool`, `float`, `int`, `len`, `max`, `min`, `round`, `str`, `sum`.
- **Construcciones prohibidas (`PYTHON_PERFIL_PROHIBIDO`):** `import`, `from`, `while`, `for`, `class`, `lambda`, `try`, `except`, `finally`, `with`, `async`, `await`, `yield`, `global`, `nonlocal`, `del`, `raise`, `eval`, `exec`, `open`, identificadores `__dunder__`, f-strings, recursión sobre `calcular()` y acceso a atributos distintos de `inputs.get(...)`.
- **Retorno:** si el bloque declara 1 salida, puede retornar el valor directo o un `dict` con la clave de salida; si declara múltiples salidas, debe retornar un `dict` con todas las salidas declaradas (`PYTHON_SALIDA_INVALIDA` en caso contrario).

### 4.3 `sample` (conversor continuo → discreto)

```json
{
  "id": "muestreador-1",
  "tipo": "sample",
  "nombre": "Sample flujo",
  "habilitado": true,
  "tipo_dato": "real",
  "puerto_dato": "sample-data-in",
  "puerto_control": "sample-control-in",
  "puerto_salida": "sample-out"
}
```

- Cuando recibe `true` en `puerto_control` (canal `lch`), captura el valor continuo presente en `puerto_dato` y emite un evento discreto por `puerto_salida` (`dch`).

### 4.4 `hold` (conversor discreto → continuo + pulso lógico)

```json
{
  "id": "retenedor-1",
  "tipo": "hold",
  "nombre": "Hold flujo",
  "habilitado": true,
  "tipo_dato": "real",
  "puerto_entrada": "hold-in",
  "puerto_cch": "hold-cch-out",
  "puerto_lch": "hold-lch-out",
  "valor_inicial": 0
}
```

- Consume como máximo **1 evento por paso** desde su cola `dch` en `puerto_entrada`.
- Al consumir un evento:
  - Actualiza `valor_retenido` y lo expone continuamente en `puerto_cch` (`cch`).
  - Emite un pulso `true` durante ese único paso en `puerto_lch` (`lch`) con `evento_pendiente: true`; en el paso siguiente sin nuevo evento, `puerto_lch` vuelve a `false` y `evento_pendiente: false` mientras `puerto_cch` conserva `valor_retenido`.

### 4.5 `place` y `transition`

- `place`: `{ id, tipo: "place", nombre, tokens, capacidad }` donde `capacidad` es entero `>= 1` o `null` (sin cota superior).
- `transition`: `{ id, tipo: "transition", nombre, habilitada, puerto_condicion, puerto_accion, retardo_ms? }`. Si `retardo_ms > 0`, al habilitarse inicia un temporizador no bloqueante (`timer_pendiente: true`) y solo dispara cuando el reloj lógico alcanza el vencimiento y la condición/tokens siguen habilitados.

---

## 5. Especificación de conexiones (`conexiones`)

1. **`cch`**: `{ id, tipo: "cch", origen, puerto_origen, destino, puerto_destino, retardo_ms? }`
2. **`dch`**: `{ id, tipo: "dch", origen, puerto_origen, destino, puerto_destino, capacidad_cola?, retardo_ms? }`
3. **`lch`**: `{ id, tipo: "lch", origen, puerto_origen, destino, puerto_destino, retardo_ms? }`
4. **`arco`**: `{ id, tipo: "arco", origen, destino, peso }`

---

## 6. Orden determinista de ejecución por paso (`paso(avanceTiempoMs)`)

En cada paso de simulación:
1. Avanza el reloj lógico monotónico `reloj_ms += avance_tiempo_ms`.
2. Se entregan en el bus las emisiones de conexión cuyo `retardo_ms` haya vencido en `<= reloj_ms`.
3. Se evalúan los elementos de datos (`service`, `functional_block`, `sample`, `hold`) en orden topológico determinista:
   - Los puertos `dch` desencolan como máximo **1 evento FIFO por puerto y por paso**.
   - Si un elemento tiene `retardo_ms > 0`, programa su salida para `reloj_ms + retardo_ms` (`timer_pendiente: true`).
4. Se evalúan las transiciones de la red de Petri (`EvaluadorPetri`):
   - Las transiciones con `retardo_ms > 0` arman su temporizador al habilitarse, lo cancelan si pierden habilitación antes del vencimiento y disparan cuando `reloj_ms >= vencimiento`.
   - Toda transición disparada en el paso actual emite un pulso `lch` (`true`) por `puerto_accion`.
5. Al cierre del paso, los pulsos `lch` consumidos en el paso se limpian para garantizar duración exacta de un paso.
