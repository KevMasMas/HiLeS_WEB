# Protocolo MQTT por Proyecto v2 y Enlaces Compartibles

Versión del protocolo: `2` (`hiles/v2/proyectos/<project_id>/...`)  
Compatibilidad con tópicos legados: los tópicos globales v1 (`hiles/ed1/2026/...`) se mantienen activos en paralelo para compatibilidad con pruebas y flujos legados.  
Implementación de referencia en TypeScript: [`frontend/src/services/projects/`](../../frontend/src/services/projects/) (`projectUrl.ts`, `projectTopics.ts`, `projectMessages.ts`, `ProjectSyncClient.ts`)

---

## 1. Identificación de proyecto y enlaces compartibles (`?project=<project_id>`)

Cada sesión colaborativa del editor y cada ejecución remota se aísla mediante un identificador `project_id`:

- **Expresión regular normativa:** `^[a-z0-9][a-z0-9_-]{2,47}$` (longitud entre 3 y 48 caracteres, minúsculas ASCII, dígitos, `-` y `_`).
- **Parámetro de URL:** `?project=<project_id>` (ej. `https://hiles.local/?project=semaforo-cruce-01`).
- **Normalización (`normalizarProjectId`):** convierte a minúsculas, reemplaza secuencias de caracteres no permitidos por `-`, recorta guiones extremos y garantiza longitud mínima de 3 caracteres.
- **Generación automática:** si el usuario abre la aplicación sin `?project=` o pulsa «Crear proyecto / Compartir enlace», se genera un `project_id` válido (`generarProjectId`) y se sincroniza en la barra de direcciones con `history.replaceState` sin recargar la página.

---

## 2. Espacio de nombres de tópicos MQTT por proyecto

Todos los mensajes de un proyecto viajan bajo el prefijo `hiles/v2/proyectos/<project_id>`:

| Sufijo del tópico | Dirección | QoS | Retain | Propósito |
|---|---|---:|---|---|
| `edicion/estado` | Web ↔ Broker | `1` | `true` | Snapshot retenido del documento (`HilesModelDocument`) para hidratar nuevos navegadores al abrir el enlace. |
| `edicion/operacion` | Web ↔ Web | `1` | `false` | Publicación incremental de cambios del diagrama con control de secuencia y autor (`client_id`). |
| `edicion/presencia` | Web ↔ Web | `0` | `false` | Presencia ligera de colaboradores conectados al proyecto (`conectado`, `rol`, `marca_tiempo`). |
| `simulacion/modelo/cargar` | Web → Pico | `1` | `true` | Carga del modelo compilado (`ir_version: 2` o `1`) en la sesión del proyecto. |
| `simulacion/modelo/confirmacion` | Pico → Web | `1` | `false` | Confirmación o rechazo de carga con código diagnóstico. |
| `simulacion/comando` | Web → Pico | `1` | `false` | Comandos `iniciar`, `detener`, `reiniciar`, `paso`. |
| `simulacion/entrada/establecer` | Web → Pico | `1` | `false` | Inyección de entradas externas (`boolean`, `integer`, `real`, `string`, `vector`, `custom`). |
| `simulacion/estado` | Pico → Web | `0` | `true` | Instantánea oficial del estado de simulación del proyecto. |
| `simulacion/salida` | Pico → Web | `0` | `false` | Eventos de salida hacia servicios externos. |
| `error` | Pico/Web → Web | `1` | `false` | Reporte de errores de validación o ejecución en el proyecto. |

---

## 3. Contratos de mensajes de sincronización de proyecto

### 3.1 `edicion/estado` (`MensajeProyectoEdicionEstado`)

```json
{
  "project_id": "semaforo-cruce-01",
  "client_id": "web-a1b2c3d4",
  "revision": 4,
  "id_mensaje": "sync-001",
  "actualizado_en": "2026-10-18T12:00:00.000Z",
  "documento": {
    "schemaVersion": 2,
    "meta": { "name": "Cruce inteligente" },
    "elements": [ ... ],
    "connections": [ ... ]
  }
}
```

### 3.2 `edicion/operacion` (`MensajeProyectoEdicionOperacion`)

```json
{
  "project_id": "semaforo-cruce-01",
  "client_id": "web-a1b2c3d4",
  "revision": 5,
  "base_revision": 4,
  "id_mensaje": "op-005",
  "resumen": "Agregar bloque Sample",
  "actualizado_en": "2026-10-18T12:00:05.000Z",
  "documento": { ... }
}
```

### 3.3 `edicion/presencia` (`MensajeProyectoPresencia`)

```json
{
  "project_id": "semaforo-cruce-01",
  "client_id": "web-a1b2c3d4",
  "alias": "Navegador 1",
  "conectado": true,
  "rol": "editor",
  "actualizado_en": "2026-10-18T12:00:05.000Z"
}
```

---

## 4. Reglas de convergencia, deduplicación y anti-bucle

1. **Filtro de eco propio (`own_echo`):** todo mensaje cuyo `client_id` coincida con el `clientId` local del `ProjectSyncClient` se descarta sin re-aplicarse al store del editor.
2. **Deduplicación por `id_mensaje`:** ventana deslizante de los últimos 64 `id_mensaje` procesados (`duplicate_message`).
3. **Resolución determinista de revisiones:**
   - Si `mensaje.revision > revisionLocal`, el cambio remoto se acepta y actualiza `revisionLocal`.
   - Si `mensaje.revision < revisionLocal`, se descarta por `stale_revision`.
   - En caso de empate (`mensaje.revision === revisionLocal`) entre dos clientes concurrentes, gana determinísticamente el mensaje con mayor tupla lexicográfica `(actualizado_en, client_id)`.
4. **Publicación con *debounce* (`300 ms`):** los cambios locales del lienzo se agrupan antes de publicar en `edicion/operacion` y actualizar el snapshot retenido en `edicion/estado`, evitando tormentas de mensajes durante el arrastre de nodos.
