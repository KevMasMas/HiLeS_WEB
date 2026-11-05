export type TemaTutorial = 'bienvenida' | 'canvas' | 'elementos' | 'conexiones' | 'colaboracion' | 'despliegue' | 'ejecucion';

export type ContextoPanelTutorial = 'distributed' | 'simulation' | 'mqtt' | 'none';

export interface PasoTutorial {
  tema: TemaTutorial;
  titulo: string;
  /** Explicación sin suponer conocimiento previo de HiLeS. */
  explicacion: string;
  /** Qué debe hacer la persona en este paso. */
  accion: string;
  /** Selector CSS del control que se resalta; `null` centra la tarjeta. */
  objetivo: string | null;
  /** Panel que conviene abrir automáticamente para mostrar el control real. */
  panel?: ContextoPanelTutorial;
}

export const CLAVE_TUTORIAL_COMPLETADO = 'hiles_tutorial_completado_v2';

export const pasosTutorial: PasoTutorial[] = [
  {
    tema: 'bienvenida',
    titulo: 'Bienvenido a HiLeS Web distribuido',
    explicacion: 'HiLeS permite diseñar sistemas jerárquicos con Structural Blocks, Functional Blocks, Services y redes de Petri, y ejecutarlos repartidos entre varias Raspberry Pi Pico W y navegadores conectados al mismo proyecto.',
    accion: 'Usa los botones de abajo para cargar el ejemplo mínimo sin hardware (todo en el navegador) o el ejemplo multi-Pico de tres bloques.',
    objetivo: null,
    panel: 'none',
  },
  {
    tema: 'colaboracion',
    titulo: 'Proyecto compartido: colaborador frente a ejecutor',
    explicacion: 'El identificador «Proyecto» agrupa a quienes editan el mismo lienzo mediante «Compartir». Ser colaborador significa ver cursores y editar el modelo; ser ejecutor es distinto y opcional: solo ejecuta fragmentos quien registra su navegador o una Pico con este mismo projectId.',
    accion: 'Revisa el campo «Proyecto» o usa «Compartir» (en pantallas estrechas dentro de «⋯») para copiar el enlace colaborativo.',
    objetivo: '[data-tour="proyecto"]',
    panel: 'none',
  },
  {
    tema: 'colaboracion',
    titulo: 'Modo de conexión: Local / LAN frente a Remoto',
    explicacion: 'El modo de conexión define cómo hablas con el broker MQTT: «Local / LAN» para un broker en tu equipo o red Wi-Fi local, y «Remoto (Internet)» con WebSockets cifrados (wss://) para trabajar desde distintas redes. Las credenciales viven solo en memoria de sesión.',
    accion: 'Pulsa el indicador de modo de conexión o revisa el panel «Conexión» para elegir entre Local / LAN y Remoto.',
    objetivo: '[data-tour="modo-conexion"]',
    panel: 'mqtt',
  },
  {
    tema: 'canvas',
    titulo: 'El lienzo, marcaje ×N y estados vivos',
    explicacion: 'Al alejar el zoom los Structural Blocks muestran una vista resumida; al acercarte aparecen sus elementos internos, los valores en tiempo real y el conteo exacto de tokens (×N) en cada Place.',
    accion: 'Acércate con la rueda del ratón o pellizco táctil para inspeccionar los bloques internos del modelo.',
    objetivo: '.react-flow',
    panel: 'none',
  },
  {
    tema: 'elementos',
    titulo: 'Paleta de elementos HiLeS',
    explicacion: 'Desde «Elementos» añades Structural Blocks, Functional Blocks (con código Python o expresiones), Services de entrada/salida, conversores Sample/Hold y redes de Petri (Place y Transition).',
    accion: 'Abre «Elementos» y arrastra o toca un componente para colocarlo dentro de un Structural Block.',
    objetivo: '[data-tour="elementos"]',
    panel: 'none',
  },
  {
    tema: 'conexiones',
    titulo: 'Canales locales y entre ejecutores',
    explicacion: 'Une puertos compatibles con Continuous Channel (datos continuos), Discrete Event (eventos) o Logical / Petri Channel. Si dos bloques se asignan a placas o navegadores distintos, HiLeS enruta el canal automáticamente por MQTT.',
    accion: 'Selecciona el tipo de conector en la paleta antes de arrastrar desde una salida (›) hacia una entrada (‹).',
    objetivo: '.react-flow',
    panel: 'none',
  },
  {
    tema: 'despliegue',
    titulo: 'Registrar este navegador y reconocer Picos',
    explicacion: 'En «Ejecutores» puedes activar «Ejecutar aquí» para ofrecer esta pestaña como worker sin hardware físico. Las Raspberry Pi Pico W encendidas aparecen automáticamente si su HILES_PROJECT_ID coincide con el proyecto actual.',
    accion: 'Activa «Ejecutar aquí» si quieres correr bloques en tu navegador y verifica en la lista las Picos conectadas y su memoria libre.',
    objetivo: '[data-tour="ejecutar-aqui"]',
    panel: 'distributed',
  },
  {
    tema: 'despliegue',
    titulo: 'Asignar Structural Blocks y sobreescribir Functional Blocks',
    explicacion: 'Cada Structural Block se asigna a una Pico W o navegador y todos sus elementos internos heredan ese destino. Cuando un cálculo puntual requiera correr en otro nodo, puedes sobreescribir el destino de ese Functional Block individual.',
    accion: 'En «Destino por bloque», elige el ejecutor de cada Structural Block (por ejemplo, dos Picos distintas o «Este navegador»).',
    objetivo: '[data-tour="mapa-asignaciones"]',
    panel: 'distributed',
  },
  {
    tema: 'despliegue',
    titulo: 'Configurar una Pico nueva y proteger credenciales',
    explicacion: 'El asistente «Preparar otra Raspberry Pi Pico» genera localmente config_local.py con Wi-Fi, host MQTT, identidad única y projectId. HiLeS nunca guarda contraseñas en el proyecto compartido, la URL ni mensajes MQTT.',
    accion: 'Despliega «Preparar otra Raspberry Pi Pico» cuando necesites aprovisionar una placa nueva y copia el archivo con Thonny conservando umqtt/.',
    objetivo: '[data-tour="preparar-pico"]',
    panel: 'distributed',
  },
  {
    tema: 'despliegue',
    titulo: 'Desplegar, fragmentos y confirmación ACK',
    explicacion: '«Desplegar» valida los destinos, compila el modelo a IR v2, publica el manifiesto y envía a cada ejecutor únicamente su fragmento propietario. La fase pasa a «Listo» cuando todos responden «ACK recibido».',
    accion: 'Pulsa «Desplegar» cuando todos los bloques tengan un ejecutor válido y confirma que cada fragmento reciba su ACK.',
    objetivo: '[data-tour="desplegar"]',
    panel: 'distributed',
  },
  {
    tema: 'ejecucion',
    titulo: 'Introducir valores mediante Services',
    explicacion: 'El panel «Entradas» detecta automáticamente los Services con puerto de salida y envía valores tipados (booleanos, enteros, reales, texto o JSON) directo al ejecutor propietario de ese Service.',
    accion: 'Elige un Service de entrada, envía un valor de prueba y revisa el «Estado agregado» por propietario.',
    objetivo: '[data-tour="panel-entradas"]',
    panel: 'simulation',
  },
  {
    tema: 'ejecucion',
    titulo: 'Controles globales únicos y estados offline / obsoleto',
    explicacion: '«Iniciar», «Paso», «Detener» y «Reiniciar» gobiernan sincronizadamente todo el despliegue desde la barra superior. Si una placa cae a «offline» o «degradado», o rechaza un fragmento por memoria, verás el diagnóstico accionable y sus elementos quedarán marcados como «Obsoleto» mientras aún puedes detener o reiniciar los ejecutores activos.',
    accion: 'Usa «Iniciar» o «Paso» en la barra superior y consulta el chip de fase siempre que necesites diagnosticar un ejecutor.',
    objetivo: '[data-tour="controles-ejecucion"]',
    panel: 'none',
  },
];
