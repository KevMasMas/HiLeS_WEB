# Contrato estable — Python de Functional Blocks en la Pico

**Responsable:** Persona 1  
**Consumidores:** Persona 2 (IR/compilador web) y Persona 3 (motor MicroPython)  
**Estado:** interfaz congelada para la entrega del 20 de octubre

Este documento define únicamente la extensión Python que debe incluir la IR v2. No redefine `Task`, `Scheduler`, canales ni el resto del modelo. Los consumidores deben importar `PythonExecutor` y las funciones de `runtime_values.py`; no deben copiar, modificar ni mantener validadores alternos.

## 1. Forma del elemento IR

Persona 2 debe serializar un Functional Block Python con estos campos:

```json
{
  "id": "fb-cupo",
  "tipo": "functional_block",
  "nombre": "Hay cupo",
  "habilitado": true,
  "lenguaje": "python",
  "codigo": "def calcular(**inputs):\n    return inputs.get('vehiculos') < 10",
  "entradas": [
    { "puerto": "vehiculos-in", "variable": "vehiculos", "tipo_dato": "integer" }
  ],
  "salidas": [
    { "puerto": "cupo-out", "variable": "hay_cupo", "tipo_dato": "boolean" }
  ]
}
```

Reglas:

- `lenguaje` debe ser `python` para usar este ejecutor.
- `codigo` tiene máximo 2048 bytes y 40 líneas.
- Las variables de entrada y salida son identificadores Python únicos.
- Se admiten máximo 16 entradas y 16 salidas.
- El motor crea una instancia de `PythonExecutor` durante `modelo/cargar` y conserva esa instancia mientras el modelo esté activo.
- Si cualquier bloque falla al validar o compilar, se rechaza toda la carga y se conserva el modelo activo anterior.

## 2. Formas de código

### Expresión

```python
temperatura > 30 and humedad < 70
```

El ejecutor la convierte internamente en una función `calcular` con los nombres de entrada declarados. Debe ocupar una sola línea lógica.

### Función

```python
def calcular(temperatura, humedad):
    if temperatura > 30:
        return humedad < 70
    return False
```

También se admite la forma ya usada por los modelos del editor:

```python
def calcular(**inputs):
    vehiculos = inputs.get('vehiculos')
    return vehiculos is not None and vehiculos < 10
```

La firma de `def calcular(...)` debe estar en una sola línea. No puede existir código de nivel superior ni otra función.

## 3. Perfil permitido

- literales booleanos, numéricos y de texto;
- listas y diccionarios dentro de los límites de valores;
- asignaciones y variables locales;
- `if`, `elif`, `else` y `return`;
- operadores aritméticos, booleanos, comparación, indexación y slicing;
- `inputs.get(...)` como único acceso mediante atributo;
- builtins: `abs`, `bool`, `float`, `int`, `len`, `max`, `min`, `round`, `str` y `sum`.

Se rechazan antes de compilar:

- `import`/`from`, `while`, `for` y comprensiones;
- recursión y funciones adicionales;
- `class`, `lambda`, generadores, async, excepciones y context managers;
- `eval`, `exec`, `compile`, `open`, introspección y modificación dinámica de atributos;
- cualquier atributo distinto de `inputs.get`;
- nombres `__dunder__`;
- acceso a `machine`, red, sistema de archivos o módulos globales.

Este perfil reduce bloqueos accidentales y acceso a capacidades de la placa, pero **no es un sandbox criptográfico para ejecutar código hostil**. La aplicación debe aceptar código únicamente de los participantes autorizados de la demostración.

## 4. Entradas y salidas

API estable:

```python
executor = PythonExecutor(
    element_id="fb-cupo",
    source=codigo,
    input_names=["vehiculos"],
    output_names=["hay_cupo"],
    input_types={"vehiculos": "integer"},
    output_types={"hay_cupo": "boolean"},
)

salidas = executor.execute({"vehiculos": 7})
# {"hay_cupo": True}
```

- Una salida declarada puede retornar directamente un escalar.
- Varias salidas deben retornar `{nombre_salida: valor}`.
- `None` significa “no publicar salida en este paso”.
- Un único puerto `custom` puede retornar un diccionario completo como su valor.
- Puertos desconocidos o tipos incorrectos producen error.
- Entradas y salidas se copian mediante JSON para impedir mutación compartida con el motor.

## 5. Tipos y límites de valores

| Tipo | Representación Python |
|---|---|
| `boolean` | `bool` |
| `integer` | `int`, excluye `bool` |
| `real` | `int` o `float` finito, excluye `bool` |
| `string` | `str` |
| `vector` | `list` |
| `custom` | `dict` con claves de texto |

Límites congelados:

| Límite | Valor |
|---|---:|
| Profundidad JSON | 6 |
| Elementos internos totales | 64 |
| Longitud de vector | 32 |
| Longitud de texto o clave | 256 caracteres |
| Tamaño serializado por mapping de entradas/salidas | 2048 bytes |

No se admiten `NaN`, infinitos, tuplas, sets, bytes, objetos, funciones ni claves no textuales.

## 6. Errores estables

| Código | Momento |
|---|---|
| `PYTHON_CODIGO_INVALIDO` | Código vacío o supera límites físicos |
| `PYTHON_PERFIL_PROHIBIDO` | Usa una construcción fuera del perfil |
| `PYTHON_COMPILACION_ERROR` | MicroPython no puede compilar la fuente |
| `PYTHON_EJECUCION_ERROR` | `calcular` falla durante un paso |
| `PYTHON_SALIDA_INVALIDA` | Forma o nombre de salida incorrecto |
| `PYTHON_TIEMPO_EXCEDIDO` | La medición posterior supera el presupuesto |
| `VALOR_TIPO_INVALIDO` | Tipo o puerto incorrecto |
| `VALOR_LIMITE_EXCEDIDO` | Profundidad, longitud, cantidad o bytes excedidos |
| `VALOR_NO_SERIALIZABLE` | Valor no representable como JSON seguro |

`PythonExecutorError` siempre expone `codigo`, `mensaje` y `element_id`. Persona 3 debe publicar esos campos sin analizar el texto del error.

La medición temporal detecta sobrepasos después del retorno; MicroPython cooperativo no puede interrumpir con seguridad una función en ejecución. Por eso ciclos y recursión se rechazan antes de compilar.

## 7. Contrato de integración para Persona 3

1. Validar primero toda la IR v2.
2. Construir todos los `PythonExecutor` en una colección temporal.
3. Activar el nuevo modelo solamente si todos compilaron.
4. En cada paso, construir el mapping por nombre normalizado de entrada.
5. Llamar `execute` una sola vez por evaluación del bloque.
6. Enrutar el mapping retornado a los puertos declarados.
7. Capturar `PythonExecutorError`, asociarlo al snapshot del bloque y continuar con las demás tareas.
8. Al reiniciar, limpiar las entradas/salidas retenidas del elemento; no recompilar el código.

## 8. Contrato de telemetría

`WatchdogTask` publica en el topic interno `telemetria`:

```json
{
  "tiempo_ms": 1000,
  "memoria": { "mem_free": 12345, "mem_alloc": 6789 },
  "rssi_dbm": -51,
  "temperatura_c": 27.5,
  "tareas": {
    "motor": {
      "run_count": 10,
      "error_count": 0,
      "overrun_count": 0,
      "last_duration_us": 250,
      "max_duration_us": 480
    }
  }
}
```

Memoria, RSSI y temperatura son opcionales según la plataforma. Un sensor de telemetría defectuoso agrega `diagnosticos` pero no detiene la publicación.

## 9. Archivos que las siguientes personas no deben modificar

```text
firmware/pico/hiles/python_executor.py
firmware/pico/hiles/runtime_values.py
firmware/pico/devices/watchdog_task.py
firmware/tests/test_python_executor.py
firmware/tests/test_runtime_values.py
firmware/tests/test_watchdog_task.py
docs/mqtt/IR_V2_PYTHON.md
docs/mqtt/vectores_ir_v2/python/**
```

Si aparece un defecto, se entrega a Persona 1 un caso mínimo que falle. No se duplica la lógica en el compilador ni en el motor.
