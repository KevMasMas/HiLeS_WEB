export type TemaTutorial = 'bienvenida' | 'canvas' | 'elementos' | 'conexiones' | 'colaboracion' | 'despliegue' | 'ejecucion';

export interface PasoTutorial {
  tema: TemaTutorial;
  titulo: string;
  /** Explicación sin suponer conocimiento previo de HiLeS. */
  explicacion: string;
  /** Qué debe hacer la persona en este paso. */
  accion: string;
  /** Selector CSS del control que se resalta; `null` centra la tarjeta. */
  objetivo: string | null;
}

export const CLAVE_TUTORIAL_COMPLETADO = 'hiles_tutorial_completado_v1';

export const pasosTutorial: PasoTutorial[] = [
  {
    tema: 'bienvenida',
    titulo: 'Bienvenido a HiLeS Web',
    explicacion: 'HiLeS describe sistemas con bloques. Un Structural Block agrupa elementos; dentro hay Services (entradas y salidas), Functional Blocks (cálculos) y redes de Petri. Luego puedes ejecutar cada bloque en una Raspberry Pi Pico W o en un navegador.',
    accion: 'Si el lienzo está vacío, pulsa «Cargar ejemplo mínimo» para seguir el recorrido con un modelo listo.',
    objetivo: null,
  },
  {
    tema: 'canvas',
    titulo: 'El lienzo',
    explicacion: 'Aquí se dibuja el modelo. Con poco zoom los bloques se muestran resumidos; al acercarte aparecen sus elementos internos.',
    accion: 'Usa la rueda del ratón para acercarte y arrastra con el botón derecho para moverte por el lienzo.',
    objetivo: '.react-flow',
  },
  {
    tema: 'elementos',
    titulo: 'Agregar elementos',
    explicacion: 'El botón Elementos abre la paleta con Structural Blocks, Services, Functional Blocks, Sample, Hold, Places y Transitions.',
    accion: 'Abre «Elementos» y arrastra un elemento al lienzo. Suéltalo dentro de un Structural Block para que forme parte de él.',
    objetivo: '[data-tour="elementos"]',
  },
  {
    tema: 'conexiones',
    titulo: 'Conectar puertos',
    explicacion: 'Las conexiones llevan datos entre puertos: CCH para valores continuos, DCH para eventos y LCH para pulsos lógicos. Los puertos deben tener el mismo tipo de dato.',
    accion: 'En la paleta elige un conector y arrastra desde un puerto de salida (›) hasta un puerto de entrada (‹).',
    objetivo: '.react-flow',
  },
  {
    tema: 'colaboracion',
    titulo: 'Trabajar en equipo',
    explicacion: 'Todas las personas con el mismo enlace editan el mismo proyecto. Verás sus avatares, cursores y lo que seleccionan, y puedes seguir a alguien para que tu vista acompañe su selección.',
    accion: 'Pulsa «Compartir», copia el enlace y ábrelo en otra pestaña. Luego abre la lista de colaboradores y prueba «Seguir».',
    objetivo: '[data-tour="compartir"]',
  },
  {
    tema: 'despliegue',
    titulo: 'Asignar y desplegar',
    explicacion: 'En Ejecutores eliges dónde corre cada Structural Block: una Pico W, este navegador u otro navegador. Desplegar divide el modelo en fragmentos y espera la confirmación (ACK) de cada ejecutor.',
    accion: 'Abre «Ejecutores», activa «Ejecutar aquí», asigna los bloques y pulsa «Desplegar». Espera a que todos digan «ACK recibido».',
    objetivo: '[data-tour="ejecutores"]',
  },
  {
    tema: 'ejecucion',
    titulo: 'Ejecutar y observar',
    explicacion: 'Iniciar y Paso controlan a todos los ejecutores a la vez. La etiqueta de la barra superior indica si está desconectado, desplegando, listo, ejecutando o con error, sin abrir la consola.',
    accion: 'Pulsa «Iniciar» o «Paso», inyecta un valor en la Entrada y mira el resultado en «Estado agregado» y en el lienzo.',
    objetivo: '[data-tour="estado-distribuido"]',
  },
];
