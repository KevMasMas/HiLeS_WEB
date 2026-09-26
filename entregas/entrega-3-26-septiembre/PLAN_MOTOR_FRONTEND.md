# Plan de trabajo — Motor HiLeS Frontend-Only con lógica por elemento

## Objetivo no negociable

Demostrar un circuito HiLeS **construido desde cero por el usuario** que ejecute correctamente en el navegador sin backend:

1. El usuario crea Places, Transitions, Functional Blocks y Services desde la paleta.
2. El usuario escribe código (JS o Python) en un Functional Block que evalúe una condición.
3. Al inyectar un valor de entrada, el motor propaga el dato automáticamente (modo Push/Observer) a través de los Functional Blocks, evalúa las Transitions, y mueve tokens según la semántica de Petri.
4. Todo corre 100% en el navegador. No hay backend, no hay servidor, no hay base de datos.

```text
Service(Humedad=70)
    → CCH(push) → FunctionalBlock("humedad < 76" → true)
        → CCH(push) → Transition(guarda=true + token disponible → DISPARA)
            → LCH → Place(token movido)
```

La prueba no se considera terminada sólo porque un demo importado funcione. Debe poder recrearse manualmente con los elementos del editor, ejecutar código del usuario en un Functional Block, y mover tokens correctamente.

**Entrega: Viernes 26 de septiembre, 8:00 PM.**

---

## Decisiones técnicas confirmadas

| Decisión | Resultado |
|----------|-----------|
| Código en Functional Blocks | **Híbrido**: JavaScript por defecto + Python (Pyodide) opcional |
| Backend | **Eliminado por completo** (lo hace el líder del equipo aparte) |
| Modo de propagación CCH | **Push (Observer)** como primera implementación |
| Editor de código embebido | **CodeMirror 6** (~150KB, ligero) |
| Configuración del modo CCH | En la **arista** (edge data) |
| Demos existentes | Migrados como **JSON importables**, no hardcodeados |

---

## Git

- La rama principal de esta entrega ya estará creada por el líder del equipo.
- Cada persona **crea su rama local** a partir de esa rama y hace push desde ahí.
- Convención de rama: `motor/persona-N-descripcion` (ej: `motor/persona-1-engine`).
- Commits en español con prefijo semántico: `feat:`, `fix:`, `refactor:`, `test:`.
- **No hacer merge** hasta que Juan Romero, Julian Romero y Kevin Rincon validen el checklist completo.
- Cada commit debe describir una unidad verificable: por ejemplo, `feat: implementar ElementoLugar con consumo y producción de tokens`.

---

## Arquitectura: Un archivo por elemento

Cada elemento HiLeS tiene su propio módulo con su lógica autocontenida. Todos implementan la misma interfaz:

```typescript
/**
 * Interfaz común para la lógica de cada elemento HiLeS.
 * Cada elemento sabe recibir datos, evaluarse y producir salidas.
 */
export interface IElementoHiLeS {
  /** Tipo del elemento */
  readonly tipo: HilesElementType;

  /** Recibe un valor en un puerto de entrada específico */
  recibirEntrada(puertoId: string, valor: ValorRuntime): void;

  /** Evalúa el estado actual y retorna los valores de salida por puerto */
  evaluar(): Map<string, ValorRuntime>;

  /** Reinicia al estado inicial (tokens originales, sin valores) */
  reiniciar(): void;

  /** Retorna el estado actual para mostrar en el canvas */
  obtenerEstado(): EstadoElemento;
}
```

### Estructura de archivos del motor

```text
src/engine/
├── elementos/
│   ├── ElementoService.ts         ← Lógica del Service
│   ├── ElementoBloqueFuncional.ts ← Lógica del Functional Block
│   ├── ElementoLugar.ts           ← Lógica del Place
│   ├── ElementoTransicion.ts      ← Lógica de la Transition
│   ├── ElementoMuestreo.ts        ← Lógica del Sample
│   ├── ElementoRetencion.ts       ← Lógica del Hold
│   ├── ElementoBloqueEstructural.ts ← Lógica del Structural Block
│   ├── interfaces.ts              ← IElementoHiLeS y tipos compartidos
│   └── index.ts                   ← Fábrica: dado un tipo, retorna la instancia
├── MotorSimulacion.ts             ← Orquestador principal
├── GrafoDatos.ts                  ← Ordenamiento topológico
├── EvaluadorPetri.ts              ← Lógica de red de Petri
├── EjecutorCodigo.ts              ← Sandbox JS + Pyodide
└── tipos.ts                       ← Tipos del motor
```

---

## Lógica de CADA elemento HiLeS

---

### 1. Service — Interfaz con el mundo exterior

El **Service** es el punto de entrada/salida del circuito. Representa sensores, actuadores, entradas del usuario o salidas del sistema.

**Comportamiento:**
- **Entrada externa**: El usuario inyecta un valor desde el panel de simulación. El Service lo almacena y lo publica por su puerto de salida.
- **Entrada interna**: Recibe un valor de otro elemento por un CCH conectado a su puerto de entrada. Lo almacena y lo muestra en el canvas.
- **No transforma datos**: solo los pasa tal cual. Es un "cable" entre el mundo externo y el circuito.
- Si tiene puerto de SALIDA: es un sensor/entrada (el usuario inyecta valores).
- Si tiene puerto de ENTRADA: es un actuador/salida (muestra el resultado).

---

### 2. Functional Block — Ejecuta código del usuario

El **Functional Block** es el corazón computacional. Recibe datos por sus puertos de entrada, ejecuta una función definida por el usuario (JS o Python), y produce un resultado en su puerto de salida.

**Comportamiento:**
- Recibe valores en sus puertos de entrada.
- Ejecuta el código del usuario pasándole los valores como variables (los **nombres de los puertos** son las variables).
- **Si el destino es una Transition**: retorna `boolean` (condición de guarda).
- **Si el destino es otro bloque**: puede retornar cualquier tipo (`number`, `string`, `boolean`).
- Si no tiene código, usa la expresión legacy (`expression`) como fallback con `evaluateGuard`.
- Si el código falla, almacena el error y lo muestra en el canvas.

**Ejemplo JS (expresión simple):**
```javascript
// El usuario escribe solo esto:
humedad < 76
// El motor lo envuelve automáticamente en: return (humedad < 76);
```

**Ejemplo JS (función completa):**
```javascript
function calcular({ humedad, temperatura }) {
  if (humedad < 76 && temperatura > 30) return true;
  return false;
}
```

**Ejemplo Python:**
```python
def calcular(humedad):
    return humedad < 76
```

**Seguridad del sandbox JS:**
- `new Function()` con scope restringido.
- Bloqueo de: `window`, `document`, `fetch`, `XMLHttpRequest`, `eval`, `import`.
- Timeout de 1 segundo.

---

### 3. Place — Contenedor de tokens

El **Place** es un estado en la red de Petri. Su única responsabilidad es almacenar tokens.

**Comportamiento:**
- Almacena un número entero de tokens (≥ 0).
- Tiene una capacidad máxima (`maxTokens`).
- **Agregar token**: solo si `tokens < maxTokens`.
- **Quitar token**: solo si `tokens > 0`.
- No recibe datos por CCH, solo interactúa por LCH (canales Petri) con Transitions.
- El EvaluadorPetri es quien le dice cuándo agregar o quitar tokens.

---

### 4. Transition — Disparo condicional

La **Transition** es el evento de la red de Petri. Dispara cuando se cumplen **dos condiciones simultáneas**:

1. **Todos los Places de entrada** tienen tokens disponibles.
2. **La condición de guarda** (dato booleano del Functional Block vía CCH) es `true`.

**Comportamiento:**
- Puerto de entrada "Condición" (arriba): recibe un `boolean` del Functional Block vía CCH.
- Puerto de salida "Acción" (abajo): cuando dispara, envía `true` por este puerto.
- Arcos Petri de entrada (LCH): conectados a Places de donde consume tokens.
- Arcos Petri de salida (LCH): conectados a Places donde produce tokens.
- El EvaluadorPetri verifica ambas condiciones y ejecuta el disparo atómicamente.
- Si hay más de 1 Transition habilitada simultáneamente: se conservan tokens y se reporta conflicto.

---

### 5. Sample — Convertidor continuo → discreto

El **Sample** captura el valor de una señal continua en el instante en que recibe una señal de control.

**Comportamiento:**
- Puerto "Data" (entrada): recibe el valor continuo actual.
- Puerto "Control" (entrada): recibe la señal de disparo (cuando llega `true`, captura).
- Puerto "Sampled" (salida): retorna el último valor capturado.
- Solo actualiza su salida cuando la señal de control es `true`. Mientras tanto, mantiene el último valor capturado.

---

### 6. Hold — Convertidor discreto → continuo

El **Hold** mantiene un valor discreto como señal continua hasta que llega uno nuevo.

**Comportamiento:**
- Puerto "Data" (entrada): recibe valores discretos (eventos).
- Puerto "Held" (salida): siempre retorna el último valor recibido.
- No necesita señal de control. Actualiza cada vez que llega un nuevo dato.
- Funciona como un "Zero-Order Hold": mantiene el valor constante entre eventos.

---

### 7. Structural Block — Contenedor jerárquico

El **Structural Block** no tiene lógica de ejecución propia. Es un contenedor visual y lógico que agrupa elementos hijos.

**Comportamiento:**
- No procesa datos. Solo agrupa elementos visualmente.
- Los elementos hijos (`parentId`) se ejecutan normalmente por el motor.
- Se puede colapsar/expandir en la UI sin afectar la ejecución.
- Sus puertos propios actúan como "túneles" para conectar el interior con el exterior.

---

## Distribución de trabajo — 5 personas

---

### Juan Ramos — Motor de Simulación y Orquestación

**Archivos a crear:**
- `src/engine/tipos.ts`
- `src/engine/GrafoDatos.ts`
- `src/engine/MotorSimulacion.ts`
- `src/stores/useSimulationStore.ts`

**Tareas:**
- [x] Crear `tipos.ts` con interfaces del motor: `EventoSimulacion`, `EstadoElemento`, `EstadoSimulacion`, `ValorRuntime`.
- [x] Crear `GrafoDatos.ts`:
  - [x] `construirOrdenTopologico(nodos, aristas)`: ordena nodos de datos para evaluación secuencial.
  - [x] `detectarCiclos(nodos, aristas)`: detecta ciclos en flujo de datos y reporta error.
  - [x] `propagarValores(orden, estadoRuntime, ejecutor)`: recorre nodos en orden topológico, evalúa cada uno, propaga resultados.
- [x] Crear `MotorSimulacion.ts`:
  - [x] `construirGrafo(nodos, aristas)`: construye instancias `IElementoHiLeS` para cada nodo.
  - [x] `inyectarEntrada(servicioId, valor)`: punto de entrada del usuario.
  - [x] `paso()`: un ciclo completo (propagar datos → evaluar transitions → mover tokens).
  - [x] `ejecutar()`: pasos hasta estabilización.
  - [x] `reiniciar()`: restaurar estado inicial.
  - [x] Cola de `EventoSimulacion[]` para auditoría.
- [x] Crear `useSimulationStore.ts`:
  - [x] Estado: `estado`, `eventos[]`, `valoresRuntime`, `contadorPasos`.
  - [x] Acciones que invocan al `MotorSimulacion`.
  - [x] Suscripción a `useEditorStore` para sincronizar runtime con el canvas.
- [x] Documentar todo el código con comentarios en español.

**Plazo:** Martes + Miércoles mañana.

**Criterios de aceptación:**
- [x] Un circuito con 2 Places, 2 Transitions y 1 Functional Block ejecuta correctamente.
- [x] La cola de eventos registra cada paso en orden.
- [x] `reiniciar()` restaura el estado exacto del inicio.
- [x] Sin dependencia de IDs hardcodeados.

---

### Juan David Romero — Lógica de Place, Transition y EvaluadorPetri

**Archivos a crear:**
- `src/engine/elementos/interfaces.ts`
- `src/engine/elementos/ElementoLugar.ts`
- `src/engine/elementos/ElementoTransicion.ts`
- `src/engine/EvaluadorPetri.ts`
- `src/engine/elementos/index.ts`

**Tareas:**
- [x] Crear `interfaces.ts` con `IElementoHiLeS` y tipos compartidos (`EstadoElemento`, `PuertoInfo`).
- [x] Implementar `ElementoLugar.ts` (Place):
  - [x] `tieneTokens()`, `tieneEspacio()`, `consumirToken()`, `producirToken()`.
  - [x] Respetar `maxTokens`, no permitir tokens negativos.
  - [x] `reiniciar()` restaura `tokensIniciales`.
- [x] Implementar `ElementoTransicion.ts` (Transition):
  - [x] `recibirEntrada()` para el puerto de condición.
  - [x] `estaHabilitada()` retorna si la condición es `true`.
  - [x] `marcarDisparo()` y `evaluar()` para enviar la acción.
- [x] Crear `EvaluadorPetri.ts`:
  - [x] `obtenerTransicionesHabilitadas(elementos, aristas)`: filtra Transitions con condición + tokens.
  - [x] `dispararTransicion(transicionId, elementos, aristas)`: consume y produce tokens atómicamente.
  - [x] Manejo de conflicto: más de 1 Transition habilitada → conservar tokens, registrar evento.
- [x] Crear `index.ts` con fábrica `crearElemento(tipo, config)`.
- [x] Documentar todo el código con comentarios en español.

**Plazo:** Martes + Miércoles mañana.

**Criterios de aceptación:**
- [x] Place con 1 token + Transition habilitada → token consumido y producido.
- [x] Place con 0 tokens → Transition NO dispara.
- [x] Place de salida con maxTokens alcanzado → Transition NO dispara.
- [x] Ciclo P1→T1→P2→T2→P1 funciona ida y vuelta.
- [x] Conflicto con 2 transitions → tokens conservados.

---

### Julian Dario Romero Buitrago — Lógica de Service, Functional Block, Sample, Hold y EjecutorCodigo

**Archivos a crear:**
- `src/engine/elementos/ElementoService.ts`
- `src/engine/elementos/ElementoBloqueFuncional.ts`
- `src/engine/elementos/ElementoMuestreo.ts`
- `src/engine/elementos/ElementoRetencion.ts`
- `src/engine/elementos/ElementoBloqueEstructural.ts`
- `src/engine/EjecutorCodigo.ts`
- `src/workers/javascript.worker.ts`
- `src/workers/pyodide.worker.ts` (si da tiempo)

**Tareas:**
- [x] Implementar `ElementoService.ts`: recibir y publicar valores sin transformar.
- [x] Implementar `ElementoBloqueFuncional.ts`:
  - [x] Recibir entradas, mapear nombres de puertos a variables, llamar al `EjecutorCodigo`.
  - [x] Manejar errores de ejecución y almacenarlos.
  - [x] Retrocompatibilidad: si no hay `code`, usar `expression` con `evaluateGuard`.
- [x] Crear `EjecutorCodigo.ts` (sandbox JS):
- [x] `ejecutarJS(codigo, entradas)`: sandbox con `new Function()`, scope restringido.
- [x] Auto-detección de expresión simple vs función completa.
- [x] Bloqueo de `window`, `document`, `fetch`, etc.
  - [x] Timeout real de 1 segundo mediante Web Worker y terminación del Worker.
- [x] Captura de errores con mensaje claro.
- [x] Implementar `ElementoMuestreo.ts` (Sample): capturar valor de Data cuando Control es `true`.
- [x] Implementar `ElementoRetencion.ts` (Hold): retener último valor discreto recibido.
- [x] Implementar `ElementoBloqueEstructural.ts`: solo gestión de hijos.
- [x] Worker de Pyodide para código Python, aislado y con tiempo máximo de ejecución.
- [x] Documentar todo el código con comentarios en español.

**Plazo:** Martes + Miércoles.

**Criterios de aceptación:**
- [x] `ejecutarJS('return inputs.x < 76', { x: 70 })` retorna `true`.
- [x] `ejecutarJS('return inputs.x < 76', { x: 80 })` retorna `false`.
- [x] Bucle infinito `while(true){}` → timeout sin congelar la UI.
- [x] Código malicioso `fetch("http://evil.com")` → error capturado.
- [x] Expresión simple `humedad < 76` se auto-detecta y se envuelve en `return`.
- [x] Un FB sin código usa la retrocompatibilidad con `expression`.
- [x] Sample captura solo con señal de control activa.
- [x] Hold mantiene último valor entre eventos.

---

### Persona 4 Ivan Felipe Prado Blanco UI: Editor de Código + Panel de Simulación Refactorizado

**Archivos a crear o modificar:**
- [NUEVO] `src/features/editor/CodeEditor.tsx`
- [MODIFICAR] `src/features/editor/PropertiesPanel.tsx`
- [MODIFICAR] `src/features/simulation/SimulationPanel.tsx`
- [ELIMINAR] `src/features/simulation/simulationApi.ts`
- [MODIFICAR] `src/features/editor/CustomNodes.tsx`
- [MODIFICAR] `src/features/editor/editor.css`

**Dependencia nueva:** `codemirror`, `@codemirror/lang-javascript`, `@codemirror/lang-python`, `@codemirror/theme-one-dark`.

**Tareas:**
- [x] Instalar dependencias de CodeMirror 6: `npm install codemirror @codemirror/lang-javascript @codemirror/lang-python @codemirror/theme-one-dark`.
- [x] Crear `CodeEditor.tsx`:
  - [x] Wrapper React para CodeMirror 6.
  - [x] Props: `codigo`, `lenguaje`, `onChange`, `onProbar`.
  - [x] Resaltado de sintaxis JS y Python.
  - [x] Tema oscuro.
  - [x] Altura auto-ajustable (3-15 líneas).
  - [x] Indicador de error si el ejecutor reportó fallo.
  - [x] Toggle para cambiar entre JS y Python.
- [x] Modificar `PropertiesPanel.tsx`:
  - [x] Para `FUNCTIONAL_BLOCK`: mostrar `CodeEditor` en lugar del campo `expression`.
  - [x] Toggle de lenguaje: JavaScript / Python.
  - [x] Lista de variables disponibles (nombres de puertos de entrada).
  - [x] Botón "Probar código" → ejecutar con valores de prueba y mostrar resultado.
- [x] Refactorizar `SimulationPanel.tsx`:
  - [x] Eliminar **toda** referencia al backend (`getDemoState`, `publishDemoInput`, `resetDemo`, `DemoSimulationState`, `DEMO_NODE_IDS`, `usesDemoBackend`).
  - [x] Usar `useSimulationStore` para todo.
  - [x] Controles: Inyectar valor, Paso a paso, Ejecutar, Reiniciar.
  - [x] Lista de eventos de simulación.
  - [x] Indicador de estado (inactivo/ejecutando/error).
- [x] Eliminar `simulationApi.ts`.
- [x] Modificar `CustomNodes.tsx`:
  - [x] Badge de último valor calculado en Functional Blocks.
  - [x] Badge de error (rojo) si hay error de código.
  - [x] Ícono de lenguaje (JS/Python) en la esquina del bloque.
- [x] Actualizar `editor.css`.

**Plazo:** Miércoles + Jueves.

> Persona 4 depende de que Juan Ramos (store de simulación) y Julian Dario Romero Buitrago (ejecutor de código) estén al menos parcialmente funcionales para el miércoles.

**Criterios de aceptación:**
- [x] Se puede escribir código JS en un Functional Block con syntax highlighting.
- [x] Se puede cambiar a Python y el highlighting cambia.
- [x] El botón "Probar código" ejecuta y muestra resultado.
- [x] El panel de simulación funciona sin backend.
- [x] Se puede inyectar un valor, ver eventos, paso a paso, y reiniciar.
- [x] Ninguna referencia al backend queda en el código.

---

### Revisión — Juan Romero, Julian Romero y Kevin Rincon

**Archivos a crear:**
- `src/engine/__tests__/MotorSimulacion.test.ts`
- `src/engine/__tests__/EvaluadorPetri.test.ts`
- `src/engine/__tests__/EjecutorCodigo.test.ts`
- `src/engine/__tests__/GrafoDatos.test.ts`
- `src/engine/__tests__/Elementos.test.ts`

**Tareas martes-miércoles (en paralelo):**
- [x] Configurar Vitest para el frontend (si no está).
- [x] Tests para `ElementoLugar`: token inicial, consumir, producir, maxTokens, no bajar de 0.
- [x] Tests para `ElementoTransicion`: condición false → no habilitada, condición true → habilitada, disparo genera acción.
- [x] Tests para `EjecutorCodigo`: expresión simple, función completa, código malicioso, bucle infinito.
- [x] Tests para `EvaluadorPetri`: disparo con tokens, sin tokens, conflicto.
- [x] Tests para `GrafoDatos`: orden topológico, detección de ciclos.

**Tareas jueves-viernes (integración):**
- [x] Test end-to-end: circuito humedad completo (Service → FB → Transition → Place).
- [x] Integrar ramas de todas las personas.
- [x] Resolver conflictos de merge.
- [x] `npm run build` sin errores.
- [x] `npm run lint` sin errores.
- [x] Verificar que la UI muestra código, ejecuta simulación, y mueve tokens.
- [x] Preparar demo para la presentación.

**Plazo:** Martes a viernes.

**Criterios de aceptación (globales):**
- [x] Todos los tests pasan.
- [x] `npm run build` y `npm run lint` sin errores.
- [x] Un circuito creado de cero ejecuta correctamente.
- [x] Los demos existentes se importan y ejecutan correctamente.
- [x] No hay ninguna referencia al backend en todo el proyecto.
- [x] El código está documentado con comentarios en español.

---

## Cronograma

```text
              Martes 23          Miércoles 24        Jueves 25          Viernes 26
              ─────────          ────────────        ──────────         ──────────
Juan Ramos │ tipos.ts            │ MotorSimulacion   │ Ajustes          │
           │ GrafoDatos.ts       │ useSimulationStore│ por feedback     │ BUFFER
           │                     │                   │                  │
Juan David Romero │ interfaces.ts       │ EvaluadorPetri    │ Ajustes          │
                  │ ElementoLugar       │ index.ts          │ por feedback     │ BUFFER
                  │ ElementoTransicion  │                   │                  │
                  │                     │                   │                  │
Julian Dario Romero Buitrago │ ElementoService     │ EjecutorCodigo    │ Pyodide Worker   │
          │ ElementoBloqueFun.  │ (sandbox completo)│ (si da tiempo)   │ BUFFER
          │ ElementoMuestreo    │                   │                  │
          │ ElementoRetencion   │                   │                  │
          │                     │                   │                  │
Persona 4 │ Instalar CodeMirror │ CodeEditor.tsx    │ SimulationPanel  │
          │ Investigar API CM6  │ PropertiesPanel   │ CustomNodes      │ BUFFER
          │                     │                   │ CSS              │
          │                     │                   │                  │
Revisión │ Config Vitest       │ Tests Petri       │ Integración      │ Tests e2e
          │ Tests Elementos     │ Tests Ejecutor    │ Merge ramas      │ Build final
          │ Tests GrafoDatos    │                   │ Resolver conflictos│ DEMO
```

**Dependencias entre personas:**

- Persona 4 (UI) depende de Juan Ramos (store) y Julian Dario Romero Buitrago (ejecutor) para miércoles.
- La revisión e integración de Juan Romero, Julian Romero y Kevin Rincon depende de todas las demás para jueves.
- Juan Ramos, Juan David Romero y Julian Dario Romero Buitrago pueden trabajar en paralelo desde el martes.

---

## Fuera de alcance para esta entrega

No abrir trabajo nuevo si lo P0 no está terminado:

- Modos Pull y Flag del CCH (solo se implementa Push/Observer).
- Dashboard de variables y estados.
- Simulador 3D / Three.js.
- Ejecución distribuida entre dispositivos.
- Persistencia en servidor / base de datos.
- Sensores y actuadores simulados.

---

## Entrega obligatoria por cada tarea

Antes de marcar una tarea con `[x]`, el responsable debe dejar en `REGISTRO_CAMBIOS_MOTOR.md`:

1. Qué hizo y por qué.
2. Archivos creados o modificados.
3. Cómo se probó.
4. Resultado y evidencia.
5. Commit/hash en su rama.
6. Pendientes o riesgos conocidos.
