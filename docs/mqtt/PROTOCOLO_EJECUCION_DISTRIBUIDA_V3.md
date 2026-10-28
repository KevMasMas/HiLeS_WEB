# Protocolo de ejecución distribuida HiLeS v3

## 1. Alcance

Este contrato distribuye una IR v2 entre workers `pico` y `browser`. La edición colaborativa sigue usando el protocolo de proyecto v2; sus identidades y tópicos no se mezclan con los de ejecución. El broker transporta control y datos, pero no ejecuta el circuito.

La unidad de asignación preferida es el `Structural Block`. Sus elementos ejecutables heredan el destino del bloque ancestro más cercano. Un `Functional Block` puede sobreescribirlo de forma explícita. Un elemento ejecutable de nivel raíz necesita asignación directa.

Las definiciones TypeScript canónicas están en:

- `frontend/src/services/ir/tiposIrDistribuida.ts`;
- `frontend/src/services/ir/particionarIr.ts`;
- `frontend/src/services/distributed/`.

## 2. Identidades y estados

- `executorId`: `pico:<deviceId>` o `browser:<sessionId>`. Identifica un worker, no una persona.
- `deploymentId`: identifica una compilación distribuida completa.
- `epoch`: entero creciente desde 1. Invalida mensajes de una configuración anterior.
- `fragmentId`: `<deploymentId>:<executorId>`.
- `ownerExecutorId`: único worker autorizado para publicar salidas de un fragmento.

Los segmentos MQTT no pueden estar vacíos ni contener `/`, `+`, `#` o NUL. Los estados son `online`, `deploying`, `ready`, `running`, `degraded` y `offline`.

Cada worker anuncia:

- versiones IR aceptadas;
- lenguajes `python` y/o `expresion`;
- bytes y elementos máximos por fragmento;
- memoria libre opcional.

## 3. Tópicos congelados

```text
udfjc/hiles/v3/projects/<projectId>/executors/<executorId>/status
udfjc/hiles/v3/projects/<projectId>/deployments/manifest
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/fragments/<executorId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/ack/<executorId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/channels/<connectionId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/snapshot/<executorId>
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/error
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/command
udfjc/hiles/v3/projects/<projectId>/deployments/<deploymentId>/input
```

| Mensaje | QoS | Retain | Motivo |
|---|---:|---:|---|
| Estado de ejecutor | 1 | sí | descubrir el último estado; el Last Will publica `offline` |
| Manifiesto activo | 1 | sí | permitir resincronización sin navegador de control |
| Fragmento activo | 1 | sí | permitir reconexión del worker destino |
| ACK | 1 | sí | conservar aceptación/rechazo de cada destino |
| Canal CCH/DCH/LCH | 1 | no | un evento anterior nunca debe convertirse en estado inicial fantasma |
| Snapshot parcial | 0 | no | telemetría reemplazable; la pérdida de uno no detiene el motor |
| Error | 1 | no | evidencia puntual, no estado permanente |
| Comando | 1 | no | `start`, `stop`, `reset` o `step` pertenece a una época concreta |
| Entrada externa | 1 | no | inyección hacia un `service` propietario en la época activa |

Antes de publicar una época nueva, el controlador limpia los retained del despliegue anterior o publica payload vacío (`b""`) en sus tópicos retenidos. Todo worker trata un payload vacío como limpieza de mensaje retenido y lo descarta sin error.

## 4. Manifiesto y fragmentos

El manifiesto contiene versión de protocolo, proyecto, despliegue, época, modelo, mapa `elementId → ownerExecutorId`, resumen de fragmentos y rutas remotas. Cada resumen incluye SHA-256, tamaño canónico UTF-8 y elementos propietarios. Cada ruta remota preserva `retardo_ms` (cuando es mayor a `0`) y `capacidad_cola` (para canales `dch`) de la conexión original para mantener la misma semántica que una conexión local.

El fragmento contiene:

- la IR v2 únicamente con elementos del propietario;
- conexiones cuyos dos extremos viven en ese mismo worker;
- rutas remotas de entrada y salida;
- proyecto, despliegue, época, fragmento y propietario.

El JSON canónico ordena claves de objetos, omite propiedades `undefined` y conserva arreglos previamente ordenados por ID. El publicador transmite exactamente esos bytes UTF-8 canónicos como payload del fragmento; cada worker verifica `SHA-256(raw_payload)` directamente sobre los bytes recibidos (y soporta también el cálculo canónico en memoria cuando el fragmento se construye localmente). Un worker solo acepta el fragmento si coinciden `executor_id` y `owner_executor_id`, soporta IR v2, el hash anunciado es correcto y el tamaño cabe en sus capacidades (la Pico W anuncia `max_fragment_bytes = 30000` y `max_elementos = 64`). Un rechazo conserva el fragmento activo anterior.

No se envía `start` hasta recibir ACK positivo de todos los fragmentos obligatorios de la misma época. Tras `start`, cada worker avanza su reloj cooperativo local según su intervalo configurado (o un único paso ante `step`) y aplica las entradas remotas recibidas al inicio del paso siguiente.

## 5. Particionado determinista

1. Resolver la herencia sobre el documento sin aplanar.
2. Comprobar que cada elemento IR tenga exactamente un propietario disponible.
3. Ordenar elementos y conexiones por ID.
4. Incluir una conexión en un fragmento únicamente si ambos extremos tienen el mismo propietario.
5. Convertir una conexión entre propietarios distintos en una sola ruta remota.
6. Verificar que tipo de origen y destino sean iguales.
7. Rechazar arcos Petri remotos en P0: Places y Transitions conectados permanecen juntos.
8. Comprobar límites publicados por el worker.
9. Calcular SHA-256 y construir el manifiesto.

La función `particionarIrV2Distribuida` no consulta stores, reloj, red ni broker. Por ello la misma entrada produce fragmentos, rutas y hashes idénticos.

## 6. Canal remoto

Un payload de canal contiene:

```json
{
  "protocol_version": 3,
  "project_id": "demo",
  "deployment_id": "deploy-1",
  "epoch": 4,
  "message_id": "pico:a:conn-1:42",
  "connection_id": "conn-1",
  "owner_executor_id": "pico:a",
  "sequence": 42,
  "value": 17
}
```

El receptor valida en este orden:

1. protocolo, proyecto y despliegue activos;
2. época exacta;
3. conexión declarada en sus `inbound_routes`;
4. propietario igual al `source_executor_id` del manifiesto;
5. valor compatible con `tipo_dato` y límites IR v2;
6. `sequence` estrictamente mayor que la última aceptada por conexión y época;
7. `message_id` no visto en la ventana de deduplicación.

Los duplicados y mensajes atrasados se descartan sin volver a ejecutar el bloque. Al cambiar de época se reinician las secuencias y la ventana de deduplicación. CCH, DCH y LCH conservan su semántica IR v2; MQTT solo sustituye el tramo entre workers.

## 7. Presencia, recuperación y estado agregado

El status usa Last Will retenido con estado `offline`. Al reconectar, el worker lee manifiesto y fragmento retenidos, valida época/hash y publica ACK. No acepta canales hasta completar esa resincronización.

Cada worker publica snapshots únicamente de sus elementos propietarios. El navegador agrega por `elementId` y acepta solo el propietario y época del manifiesto. Si el status queda `offline`, esos elementos se muestran `stale`; los otros fragmentos siguen ejecutándose cuando sus dependencias lo permiten.

## 8. Errores de particionado

| Código | Significado |
|---|---|
| `DISTRIBUCION_IDENTIFICADOR_INVALIDO` | segmento MQTT o época inválidos |
| `DISTRIBUCION_MODELO_INVALIDO` | la IR v2 base no es válida |
| `DISTRIBUCION_DESTINO_FALTANTE` | elemento sin asignación efectiva |
| `DISTRIBUCION_DESTINO_INEXISTENTE` | worker asignado no está registrado |
| `DISTRIBUCION_CAPACIDAD_EXCEDIDA` | IR, elementos o bytes fuera de capacidad |
| `DISTRIBUCION_ARCO_REMOTO` | componente Petri dividido entre workers |
| `DISTRIBUCION_TIPO_NO_RESUELTO` | conexión remota sin tipo compatible verificable |
| `DISTRIBUCION_ASIGNACION_INVALIDA` | asignación duplicada o referencia incorrecta |

Ante cualquier error el resultado no contiene manifiesto ni fragmentos parciales.

## 9. Fixtures y handoff

`fixturesDistribucionV3` congela tres escenarios sobre el mismo modelo de prueba:

- dos ejecutores: Pico y navegador, una ruta remota;
- tres ejecutores: Pico y dos navegadores, dos rutas remotas;
- cuatro ejecutores: dos Pico y dos navegadores, tres rutas remotas y override de Functional Block.

La prueba `particionarIr.test.ts` demuestra determinismo, propiedad única, rutas tipadas, SHA-256, destino ausente, capacidades/lenguajes y restricción Petri. Personas 2 y 3 pueden importar los tipos, tópicos y fixtures desde `services/distributed` y `services/ir` sin depender de stores de interfaz.
