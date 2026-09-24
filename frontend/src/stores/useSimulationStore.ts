import { create } from 'zustand';
import { MotorSimulacion } from '../engine/MotorSimulacion';
import { EstadoSimulacion } from '../engine/tipos';
import type {
  AristaHiLeS,
  EstadoElemento,
  EventoSimulacion,
  NodoHiLeS,
  ServicioInyectable,
  ValorRuntime,
} from '../engine/tipos';
import type { HilesNodeData } from '../types/hiles';
import { useEditorStore } from './useEditorStore';

type RuntimeNodo = NonNullable<HilesNodeData['runtime']>;

/**
 * Instancia única del motor. Vive fuera del store porque es un objeto mutable
 * con estado interno: el store solo expone fotografías inmutables para React.
 */
const motor = new MotorSimulacion();

interface SimulationState {
  /** Fase actual del motor (inactiva, lista, ejecutando, estabilizada, error). */
  estado: EstadoSimulacion;
  /** Cola de auditoría en orden cronológico. */
  eventos: EventoSimulacion[];
  /** Último valor publicado por cada nodo. */
  valoresRuntime: Record<string, ValorRuntime>;
  /** Estado que cada elemento quiere mostrar (tokens, valor, error). */
  estadosElementos: Record<string, EstadoElemento>;
  /** Pasos ejecutados desde el último reinicio. */
  contadorPasos: number;
  /** Services a los que la UI puede inyectarle un valor. */
  servicios: ServicioInyectable[];
  /** Último mensaje dirigido al usuario (por ejemplo, una inyección rechazada). */
  mensaje: string | null;

  /** Reconstruye el grafo a partir del contenido actual del editor. */
  sincronizar: () => void;
  inyectarEntrada: (servicioId: string, valor: ValorRuntime) => void;
  paso: () => Promise<void>;
  ejecutar: () => Promise<void>;
  reiniciar: () => void;
}

/** Traduce el estado lógico de un elemento al runtime que pinta el canvas. */
const runtimeDesdeEstado = (estado: EstadoElemento): RuntimeNodo => ({
  ...(estado.valor !== undefined ? { value: estado.valor } : {}),
  ...(estado.tokens !== undefined ? { tokens: estado.tokens } : {}),
  ...(estado.activo !== undefined ? { active: estado.activo } : {}),
  ...(estado.error ? { error: estado.error } : {}),
});

const mismoRuntime = (anterior: RuntimeNodo | undefined, siguiente: RuntimeNodo): boolean =>
  anterior !== undefined
  && anterior.value === siguiente.value
  && anterior.tokens === siguiente.tokens
  && anterior.active === siguiente.active
  && anterior.error === siguiente.error;

/**
 * Vuelca el estado del motor sobre los nodos del editor.
 *
 * Solo se reemplazan los nodos cuyo runtime cambió: mantener las mismas
 * referencias evita repintados y no ensucia el historial del documento.
 */
const publicarRuntimeEnCanvas = (estados: Map<string, EstadoElemento>): void => {
  useEditorStore.setState((state) => {
    let cambio = false;
    const nodes = state.nodes.map((nodo) => {
      const estado = estados.get(nodo.id);
      if (!estado) return nodo;
      const runtime = runtimeDesdeEstado(estado);
      if (mismoRuntime(nodo.data.runtime, runtime)) return nodo;
      cambio = true;
      return { ...nodo, data: { ...nodo.data, runtime } };
    });
    return cambio ? { nodes } : {};
  });
};

/** Copia al store la fotografía actual del motor y la refleja en el canvas. */
const publicarEstadoDelMotor = (mensaje: string | null = null): Partial<SimulationState> => {
  const estados = motor.obtenerEstadosElementos();
  publicarRuntimeEnCanvas(estados);
  return {
    estado: motor.obtenerEstado(),
    eventos: motor.obtenerEventos(),
    valoresRuntime: Object.fromEntries(motor.obtenerValores()),
    estadosElementos: Object.fromEntries(estados),
    contadorPasos: motor.obtenerContadorPasos(),
    servicios: motor.obtenerServiciosInyectables(),
    mensaje,
  };
};

export const useSimulationStore = create<SimulationState>((set) => ({
  estado: EstadoSimulacion.INACTIVA,
  eventos: [],
  valoresRuntime: {},
  estadosElementos: {},
  contadorPasos: 0,
  servicios: [],
  mensaje: null,

  sincronizar: () => {
    const { nodes, edges } = useEditorStore.getState();
    motor.construirGrafo(nodes as NodoHiLeS[], edges as AristaHiLeS[]);
    set(publicarEstadoDelMotor());
  },

  inyectarEntrada: (servicioId, valor) => {
    const resultado = motor.inyectarEntrada(servicioId, valor);
    set(publicarEstadoDelMotor(resultado.mensaje));
  },

  paso: async () => {
    await motor.paso();
    set(publicarEstadoDelMotor());
  },

  ejecutar: async () => {
    const resultado = await motor.ejecutar();
    set(publicarEstadoDelMotor(resultado.estabilizado
      ? `El circuito se estabilizó tras ${resultado.pasosEjecutados} paso(s).`
      : 'La ejecución terminó sin estabilizarse: revisa los eventos.'));
  },

  reiniciar: () => {
    motor.reiniciar();
    set(publicarEstadoDelMotor('Simulación reiniciada.'));
  },
}));

/**
 * Firma del modelo: cambia cuando el usuario edita la topología o una propiedad
 * que afecta la ejecución, pero no cuando el motor escribe valores de runtime.
 * Así la suscripción reconstruye el grafo sin entrar en un bucle infinito.
 */
const firmaDelModelo = (nodes: readonly NodoHiLeS[], edges: readonly AristaHiLeS[]): string => JSON.stringify({
  nodos: nodes.map((nodo) => [
    nodo.id,
    nodo.data.hilesType,
    nodo.data.name,
    nodo.data.ports.map((puerto) => [puerto.id, puerto.name, puerto.direction, puerto.nature]),
    [
      nodo.data.properties.tokens,
      nodo.data.properties.maxTokens,
      nodo.data.properties.enabled,
      nodo.data.properties.expression,
      nodo.data.properties.code,
      nodo.data.properties.codeLanguage,
    ],
  ]),
  aristas: edges.map((arista) => [
    arista.id,
    arista.source,
    arista.target,
    arista.sourceHandle,
    arista.targetHandle,
    arista.data?.hilesConnectionType,
    arista.data?.weight,
  ]),
});

let firmaActual = '';

/** Mantiene el motor alineado con el circuito que el usuario está dibujando. */
const sincronizarSiCambioElModelo = (): void => {
  const { nodes, edges } = useEditorStore.getState();
  const firma = firmaDelModelo(nodes as NodoHiLeS[], edges as AristaHiLeS[]);
  if (firma === firmaActual) return;
  firmaActual = firma;
  useSimulationStore.getState().sincronizar();
};

useEditorStore.subscribe((state, previous) => {
  if (state.nodes === previous.nodes && state.edges === previous.edges) return;
  sincronizarSiCambioElModelo();
});

// Primera construcción con el modelo que ya esté cargado en el editor.
sincronizarSiCambioElModelo();
