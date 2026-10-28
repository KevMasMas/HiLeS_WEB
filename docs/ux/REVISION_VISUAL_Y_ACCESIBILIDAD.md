# Revisión visual, idioma y accesibilidad — entrega del 30 de octubre

**Responsable:** Juan Ramos (Persona 3)
**Alcance:** worker de navegador, colaboración y experiencia de usuario del frontend.

## 1. Marca

| Elemento | Decisión | Archivo |
|---|---|---|
| Logo | Marca cuadrada con degradado cian → azul y una «H» formada por dos bloques unidos por una conexión con un nodo central (un modelo repartido entre ejecutores). Reemplaza la letra «H» en CSS. | `frontend/src/assets/brand/hiles-mark.svg` |
| Nombre y subtítulo | `HiLeS · Modelado y ejecución distribuida` | `frontend/src/assets/brand/brand.ts` |
| Paleta | Tinta `#0f172a`, superficie `#ffffff`, fondo `#f8fafc`, primario `#2563eb`, acento `#22d3ee`, éxito `#16a34a`, advertencia `#b45309`, error `#dc2626`. | Variables `--hiles-*` en `features/editor/editor.css` |
| Tipografía | Pila del sistema (`Inter, system-ui, …`). Escala mínima: 10 px en etiquetas de la barra, 11–12 px en controles y 14 px en textos de diálogo. Antes había etiquetas de 8 px. | `editor.css` |
| Iconos | Se conservan los glifos Unicode existentes (sin dependencia nueva). Cada botón con icono tiene texto visible o `aria-label`. | `TopBar.tsx` |

## 2. Estados visibles sin abrir la consola

La etiqueta de la barra superior y el panel **Ejecutores** usan la misma función `describirFase` (`features/distributed/assignments.ts`):

| Fase | Color | Cuándo |
|---|---|---|
| Desconectado | gris | sin conexión con el broker de ejecución |
| Sin despliegue | gris claro | conectado y sin manifiesto |
| Desplegando | ámbar con pulso | falta el ACK de algún fragmento de la época activa |
| Listo | celeste | todos los fragmentos aceptados |
| Ejecutando | verde | todos los ejecutores del despliegue informan `running` |
| Error | rojo | ACK rechazado, ejecutor desconectado o error local de despliegue |

Cada error se muestra con su código, el mensaje del ejecutor y una recomendación concreta (`recomendacionError`), además de un botón «Ir a…» cuando el error apunta a un elemento.

## 3. Idioma

**Decisión:** la interfaz se escribe en español, porque los paneles de simulación y MQTT, los validadores, los errores del protocolo y la documentación ya están en español.

Aplicado en esta entrega: barra superior, panel de ejecutores, colaboración, compartir, tutorial, estado vacío y pista de zoom del lienzo.

**Pendiente en archivos de otros integrantes** (no se modificaron para respetar la propiedad de archivos; unos 45 textos):

| Archivo | Ejemplos |
|---|---|
| `features/editor/Editor.tsx` | «Clear this project? This cannot be undone.», «Connecting to project and loading its retained snapshot…» |
| `features/editor/PanelDock.tsx` | pestañas «Properties», «Simulation», «Close panel» |
| `features/editor/Palette.tsx` | «HiLeS Elements», «Connectors», texto de ayuda de la paleta |
| `features/editor/PropertiesPanel.tsx` | «Ports», «Input», «Output», «Remove port»… |
| `features/editor/CustomNodes.tsx`, `CodeEditor.tsx` | etiquetas puntuales |
| `stores/useEditorStore.ts` | «Port data types are incompatible.», «JSON model imported», «Autosaved model restored»… |
| `types/translations.ts` | nombres por defecto «New …» |

Recomendación: traducirlos en un solo cambio acordado por sus responsables y ajustar las pruebas que comparen esos textos.

## 4. Accesibilidad básica

- Foco visible (`--hiles-focus`) en botones, selectores, campos, ayuda contextual y tarjetas del tutorial.
- Diálogos (`Compartir`, tutorial y lista de colaboradores) con `role="dialog"`, título asociado y cierre con Escape. El tutorial también se navega con ← y →.
- Mensajes de estado con `role="status"` y `aria-live="polite"`; errores de despliegue con `role="alert"`.
- Ningún estado depende solo del color: cada indicador tiene texto («Listo», «Obsoleto», «Esperando ACK»…).
- `prefers-reduced-motion` desactiva el pulso de «Desplegando» y la animación del tutorial.
- Avatares con iniciales y estado textual en la lista: Activo, Inactivo o Desconectado.

## 5. Prueba manual sugerida

1. Abrir `?project=<id>` en una ventana nueva. El tutorial aparece la primera vez; recorrer los 7 pasos con «Cargar ejemplo mínimo».
2. Abrir el mismo enlace en otra pestaña («Compartir» → «Copiar enlace»). Comprobar los avatares, seleccionar un bloque en una pestaña y usar «Seguir» en la otra.
3. En «Ejecutores», activar «Ejecutar aquí» en ambas pestañas y asignar *Sensor* a una pestaña (o a una Pico) y *Proceso* a la otra. El cambio aparece en las dos.
4. Pulsar «Desplegar»: la etiqueta pasa por «Desplegando» y luego «Listo». Iniciar e inyectar un valor en *Entrada*; observar el resultado en «Estado agregado».
5. Cerrar una pestaña ejecutora: la otra muestra «Error» y los elementos del ejecutor cerrado aparecen como «Obsoleto».

Esta guía todavía no se ha ejecutado con un broker real en esta entrega (ver el registro de cambios).
