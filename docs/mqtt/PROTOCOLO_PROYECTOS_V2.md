# Protocolo MQTT colaborativo por proyecto (v2)

Especificación de sincronización colaborativa y ejecución remota aislada por `projectId` (`?project=<projectId>`).  
Implementación de referencia: [`frontend/src/services/projects/`](../../frontend/src/services/projects/) (`projectUrl.ts`, `projectTopics.ts`, `projectMessages.ts`, `ProjectSyncClient.ts`).

---

## 1. Identificación de proyecto y enlace compartible (`?project=<projectId>`)

- **Parámetro de consulta:** `?project=<projectId>`
- **Patrón válido (`PATRON_ID_PROYECTO_V2`):** `^[a-z0-9][a-z0-9_-]{2,63}$` (longitud entre `3` y `64` caracteres, minúsculas ASCII, dígitos, `-` y `_`).
- **Funciones en `projectUrl.ts`:**
  - `esProjectIdValido(projectId)`
  - `normalizarProjectId(entrada, fallback?)`
  - `generarProjectId(prefijo?)`
  - `obtenerProjectIdDeSearch(search?)`
  - `construirUrlCompartibleProyecto(projectId, baseHref?)`
  - `asegurarProjectIdEnUrl(preferido?, entorno?)`

---

## 2. Jerarquía de tópicos por proyecto (`udfjc/hiles/v2/projects/<projectId>/...`)

Prefijo base por defecto (`PREFIJO_PROYECTOS_V2_POR_DEFECTO`): `udfjc/hiles/v2/projects`

| Propiedad en `TopicosProyectoV2` | Tópico completo | QoS | Retain | Propósito |
|---|---|---:|:---:|---|
| `documentSnapshot` (`edicionEstado`) | `udfjc/hiles/v2/projects/<projectId>/document/snapshot` | `1` | `true` | Snapshot retenido del documento (`HilesModelDocument`) para hidratación inmediata al abrir `?project=<id>`. |
| `documentOps` (`edicionOperacion`) | `udfjc/hiles/v2/projects/<projectId>/document/ops` | `1` | `false` | Operaciones incrementales (`node.add`, `node.move`, `node.update`, `node.remove`, `connection.add`, `connection.update`, `connection.remove`, `document.patch`) en tiempo real. |
| `presence` (`edicionPresencia`) | `udfjc/hiles/v2/projects/<projectId>/presence` | `1` | `true` | Presencia retenida de colaboradores (`conectado`, `usuario`, `color`, `vista_activa`, `ttl_ms`) con soporte de Last Will MQTT. |
| `cursor` (`edicionCursor`) | `udfjc/hiles/v2/projects/<projectId>/cursor` | `0` | `false` | Posición de cursor remoto en el canvas (`x`, `y`, `vista_activa`). |
| `simulacionModeloCargar` | `udfjc/hiles/v2/projects/<projectId>/simulacion/modelo/cargar` | `1` | `true` | Carga de modelo IR v1/v2 aislado por proyecto hacia la Pico. |
| `simulacionModeloConfirmacion` | `udfjc/hiles/v2/projects/<projectId>/simulacion/modelo/confirmacion` | `1` | `false` | Confirmación de carga o rechazo diagnóstico del modelo en la Pico. |
| `simulacionComando` | `udfjc/hiles/v2/projects/<projectId>/simulacion/comando` | `1` | `false` | Comandos de control (`iniciar`, `pausar`, `paso`, `reiniciar`). |
| `simulacionEntradaEstablecer` | `udfjc/hiles/v2/projects/<projectId>/simulacion/entrada/establecer` | `1` | `false` | Inyección de valores escalares, `vector` o `custom` hacia un `service`. |
| `simulacionEstado` | `udfjc/hiles/v2/projects/<projectId>/simulacion/estado` | `0` | `true` | Snapshot de simulación del proyecto. |
| `simulacionSalida` | `udfjc/hiles/v2/projects/<projectId>/simulacion/salida` | `0` | `false` | Emisión de salidas de servicios del proyecto. |
| `error` | `udfjc/hiles/v2/projects/<projectId>/error` | `1` | `false` | Diagnósticos de validación o runtime asociados al proyecto. |

---

## 3. Esquemas de mensajes colaborativos (`projectMessages.ts`)

### 3.1 `document/snapshot` (`MensajeProyectoEdicionEstado`)

```json
{
  "id_mensaje": "estado-nav-a-1",
  "operationId": "estado-nav-a-1",
  "proyecto_id": "cruce-compartido",
  "client_id": "nav-a",
  "clock": 4,
  "revision": 4,
  "actualizado_en": "2026-10-18T12:00:00.000Z",
  "resumen": "Snapshot inicial",
  "documento": {
    "version": "1.0",
    "id": "doc-cruce-01",
    "name": "Cruce semafórico",
    "description": "Proyecto compartido",
    "createdAt": "2026-10-18T12:00:00.000Z",
    "updatedAt": "2026-10-18T12:00:00.000Z",
    "activeSystemId": null,
    "elements": [],
    "connections": []
  }
}
```

### 3.2 `document/ops` (`MensajeProyectoEdicionOperacion`)

Transporta una operación incremental atómica (`operacion`) sobre un nodo, conexión o metadatos del documento sin publicar el documento completo dos veces:

```json
{
  "id_mensaje": "op-nav-a-5",
  "operationId": "op-nav-a-5",
  "proyecto_id": "cruce-compartido",
  "client_id": "nav-a",
  "clock": 5,
  "revision": 5,
  "actualizado_en": "2026-10-18T12:00:01.000Z",
  "tipo_operacion": "node.move",
  "operacion": {
    "kind": "node.move",
    "elementId": "place-norte",
    "x": 240,
    "y": 180
  },
  "resumen": "Mover nodo norte"
}
```

Tipos de `operacion.kind` soportados:
- `node.add`: `{ kind: "node.add", element: HilesElement }`
- `node.move`: `{ kind: "node.move", elementId: string, x: number, y: number }`
- `node.update`: `{ kind: "node.update", elementId: string, changes: Partial<HilesElement> }`
- `node.remove`: `{ kind: "node.remove", elementId: string }`
- `connection.add`: `{ kind: "connection.add", connection: HilesConnection }`
- `connection.update`: `{ kind: "connection.update", connectionId: string, changes: Partial<HilesConnection> }`
- `connection.remove`: `{ kind: "connection.remove", connectionId: string }`
- `document.patch`: `{ kind: "document.patch", changes: Partial<Pick<HilesModelDocument, "id" | "name" | "description" | "createdAt" | "updatedAt" | "activeSystemId">> }`

### 3.3 `presence` (`MensajeProyectoPresencia`)

```json
{
  "id_mensaje": "pres-nav-a-1",
  "operationId": "pres-nav-a-1",
  "proyecto_id": "cruce-compartido",
  "client_id": "nav-a",
  "usuario": "Navegador A",
  "color": "#38bdf8",
  "conectado": true,
  "clock": 1,
  "revision": 1,
  "actualizado_en": "2026-10-18T12:00:00.000Z",
  "ttl_ms": 30000,
  "vista_activa": null
}
```

- **Ciclo de vida y limpieza:**
  1. Se publica con `retain: true, qos: 1`.
  2. Al conectar, `ProjectSyncClient` registra un mensaje **Last Will** (`setWillMessage`) sobre `udfjc/hiles/v2/projects/<projectId>/presence` con `conectado: false`, `retain: true` y `qos: 1` para cubrir cierres abruptos del navegador.
  3. Incluye `ttl_ms` (por defecto `30000` ms) y `expirarColaboradoresInactivos(ahoraMs)` para expirar colaboradores cuya presencia haya vencido y limpiar sus cursores remotos.

### 3.4 `cursor` (`MensajeProyectoCursor`)

```json
{
  "id_mensaje": "cur-nav-a-2",
  "operationId": "cur-nav-a-2",
  "proyecto_id": "cruce-compartido",
  "client_id": "nav-a",
  "usuario": "Navegador A",
  "color": "#38bdf8",
  "x": 512,
  "y": 320,
  "vista_activa": null,
  "clock": 2,
  "actualizado_en": "2026-10-18T12:00:01.000Z"
}
```

---

## 4. Reglas de convergencia, reloj lógico Lamport y supresión de bucles

`ControlConvergenciaProyectoV2` y `ProjectSyncClient` garantizan convergencia determinista sin bucles de eco:

1. **Aislamiento por proyecto:** cualquier mensaje con `proyecto_id !== this.projectId` se descarta (`motivo: "proyecto_distinto"`).
2. **Supresión de eco propio:** todo mensaje con `client_id === localClientId` se descarta (`motivo: "eco_propio"`).
3. **Deduplicación acotada:** se conserva una ventana FIFO de los últimos `128` `operationId` (`id_mensaje`) vistos; cualquier reentrega QoS 1 se descarta (`motivo: "mensaje_duplicado"`).
4. **Reloj lógico Lamport (`clock`) y resolución LWW por entidad:**
   - En cada publicación local: `clock = clock + 1`.
   - En cada mensaje remoto recibido: `clock = Math.max(localClock, remoteClock) + 1`.
   - Cada entidad (`node:<id>`, `connection:<id>`, `document:meta`, `document`) conserva su última marca `(clock, client_id)`.
   - Un mensaje remoto sobre la misma entidad se acepta si y solo si:
     - `remote.clock > entidad.clock`, o
     - `remote.clock === entidad.clock` y `remote.client_id > entidad.client_id` (orden lexicográfico determinista).
   - Operaciones concurrentes sobre entidades distintas (`node:a` y `node:b`) se aplican incrementalmente mediante `aplicarOperacionIncrementalADocumento` sin sobrescribirse mutuamente.
5. **Guardia de cambio remoto (`ejecutarConGuardiaRemota`):** mientras `ProjectSyncClient` entrega un cambio remoto a los callbacks (`onRemoteDocument`), `estaAplicandoCambioRemoto()` permanece en `true` y bloquea cualquier re-publicación en `notificarCambioLocal`, `publicarOperacionIncremental` o `publicarSnapshotInmediato`.
