import { HilesConnectionType, HilesElementType } from '../types/hiles';
import type { HilesPort } from '../types/hiles';
import { BusObserver } from './BusObserver';
import { crearElemento } from './elementos';
import { ElementoLugar } from './elementos/ElementoLugar';
import { ElementoService } from './elementos/ElementoService';
import { ElementoTransicion } from './elementos/ElementoTransicion';
import { nombreVariable } from './elementos/ElementoBloqueFuncional';
import type { IElementoHiLeS } from './elementos/interfaces';
import {
  dispararTransicion,
  obtenerTransicionesHabilitadas,
} from './EvaluadorPetri';
import {
  aplanarConexionesFrontera,
  construirOrdenTopologico,
  detectarCiclos,
  ejecutorAsyncPorDefecto,
  propagarValoresAsync,
} from './GrafoDatos';
import type { EjecutorElementoAsync } from './GrafoDatos';
import {
  EstadoSimulacion,
  LIMITE_PASOS_POR_DEFECTO,
  TipoEventoSimulacion,
} from './tipos';
import type {
  AristaHiLeS,
  EstadoElemento,
  EventoSimulacion,
  InstantaneaSimulacion,
  NodoHiLeS,
  ResultadoEjecucion,
  ResultadoInyeccion,
  ResultadoPaso,
  ServicioInyectable,
  ValorRuntime,
} from './tipos';
import { ejecutarPython, type EntradasRuntime } from './EjecutorCodigo';
import { evaluarExpresionIr } from '../services/ir/expresiones';
import type {
  IrEstadoElementoV2,
  IrExpresion,
  IrModeloV2,
  IrPuertoTipadoV2,
  IrTipoDatoV2,
  IrValorRuntimeV2,
} from '../services/ir/tiposIrV2';
import {
  ErrorPythonPerfilIrV2,
  normalizarEntradasPython,
  normalizarSalidasPython,
  validarCodigoPythonPerfilV2,
} from '../services/ir/validadorIrV2';

export interface OpcionesMotor {
  /** Tope de pasos de `ejecutar()` antes de declarar que el circuito oscila. */
  limitePasos?: number;
  /** Permite instrumentar o sustituir la evaluación de cada elemento (tests). */
  ejecutor?: EjecutorElementoAsync;
  /** Avance de tiempo lógico por defecto en cada `paso()` cuando no se indica otro (ms). */
  pasoTiempoMs?: number;
}

/** Tipos que existen en el editor pero no tienen lógica de ejecución propia. */
const TIPOS_SIN_LOGICA: readonly HilesElementType[] = [
  HilesElementType.PORT,
  HilesElementType.TOKEN,
];

interface TimerSalidaElemento {
  venceEnMs: number;
  salidas: Map<string, ValorRuntime>;
}

interface MetadataExtendidaNodo {
  retardoMs: number;
  lenguajeIr?: 'python' | 'expresion';
  codigoPython?: string;
  expresionIr?: IrExpresion;
  entradasTipadas?: IrPuertoTipadoV2[];
  salidasTipadas?: IrPuertoTipadoV2[];
}

/**
 * Orquestador de la simulación HiLeS (compatible con IR v1 e IR v2).
 */
export class MotorSimulacion {
  private readonly limitePasos: number;
  private readonly ejecutorPersonalizado?: EjecutorElementoAsync;
  private readonly pasoTiempoMsPorDefecto: number;
  private readonly bus = new BusObserver();

  private nodos: NodoHiLeS[] = [];
  private aristas: AristaHiLeS[] = [];
  private aristasEfectivas: AristaHiLeS[] = [];
  /** Instancia lógica de cada nodo ejecutable, indexada por id del editor. */
  private elementos = new Map<string, IElementoHiLeS>();
  /** Nombre legible de cada nodo, para que los eventos no dependan del canvas. */
  private nombres = new Map<string, string>();
  /** Orden topológico del flujo de datos calculado al construir el grafo. */
  private orden: string[] = [];
  /** Último valor publicado por cada nodo. */
  private valores = new Map<string, ValorRuntime>();
  /** Salidas detalladas por puerto de cada nodo. */
  private salidasPorNodo = new Map<string, Record<string, ValorRuntime>>();
  /** Entradas recibidas por puerto en cada nodo (para bloques funcionales Python/AST v2). */
  private entradasPorNodo = new Map<string, Record<string, ValorRuntime>>();
  /** Metadatos IR v2 por nodo (retardos, firmas tipadas, código Python/AST). */
  private metadataNodos = new Map<string, MetadataExtendidaNodo>();
  /** Errores observables por nodo (incluyendo códigos canónicos IR v2). */
  private erroresNodos = new Map<string, string>();
  /** Errores ya reportados en la cola de eventos. */
  private erroresReportados = new Map<string, string>();

  /** Reloj lógico del motor en milisegundos (sin `sleep` bloqueante). */
  private relojMs = 0;
  /** Timers pendientes de elementos con `executionDelay` / `retardo_ms`. */
  private timersElementos = new Map<string, TimerSalidaElemento>();
  /** Salidas retenidas vigentes para elementos con `retardo_ms`. */
  private salidasRetenidasElemento = new Map<
    string,
    Map<string, ValorRuntime>
  >();
  /** Timers pendientes de Transitions con `retardo_ms`. */
  private timersTransiciones = new Map<string, number>();
  /** Transitions que dispararon en el último paso. */
  private transicionesDisparadasUltimoPaso = new Set<string>();
  /** Marcador de pulso LCH emitido por Hold o Sample en el último paso. */
  private pulsoEmitidoUltimoPaso = new Map<string, boolean>();

  private eventos: EventoSimulacion[] = [];
  private contadorEventos = 0;
  private contadorPasos = 0;
  private estado: EstadoSimulacion = EstadoSimulacion.INACTIVA;

  constructor(opciones: OpcionesMotor = {}) {
    this.limitePasos = opciones.limitePasos ?? LIMITE_PASOS_POR_DEFECTO;
    this.ejecutorPersonalizado = opciones.ejecutor;
    this.pasoTiempoMsPorDefecto = opciones.pasoTiempoMs ?? 0;
  }

  // ---------------------------------------------------------------------
  // Construcción del grafo
  // ---------------------------------------------------------------------

  /**
   * Construye el grafo directamente desde un `IrModeloV2` validado.
   */
  construirDesdeIrV2(modelo: IrModeloV2): void {
    const nodos: NodoHiLeS[] = [];
    const aristas: AristaHiLeS[] = [];

    const crearPuerto = (
      p: Omit<HilesPort, 'side' | 'offset'> & {
        side?: HilesPort['side'];
        offset?: number;
      },
    ): HilesPort => ({
      side: p.direction === 'input' ? 'left' : 'right',
      offset: 0.5,
      ...p,
    });

    const crearPropiedades = (
      extra: Record<string, unknown>,
    ): NodoHiLeS['data']['properties'] =>
      ({
        description: '',
        collapsed: false,
        locked: false,
        visible: true,
        expression: '',
        executionDelay: 0,
        enabled: true,
        tokens: 0,
        maxTokens: 1,
        delay: 0,
        condition: '',
        heldValue: '',
        operatorDirection: 'right',
        rotation: 0,
        ...extra,
      }) as unknown as NodoHiLeS['data']['properties'];

    modelo.elementos.forEach((el, idx) => {
      const position = { x: (idx % 4) * 200, y: Math.floor(idx / 4) * 140 };
      if (el.tipo === 'service') {
        const ports: HilesPort[] = [
          ...el.entradas.map((id, i) =>
            crearPuerto({
              id,
              name: `In${i + 1}`,
              direction: 'input',
              dataType: el.tipo_dato as HilesPort['dataType'],
              nature: 'continuous',
            }),
          ),
          ...el.salidas.map((id, i) =>
            crearPuerto({
              id,
              name: i === 0 ? 'Out' : `Out${i + 1}`,
              direction: 'output',
              dataType: el.tipo_dato as HilesPort['dataType'],
              nature: 'continuous',
            }),
          ),
        ];
        nodos.push({
          id: el.id,
          type: 'hilesNode',
          position,
          data: {
            hilesType: HilesElementType.SERVICE,
            name: el.nombre,
            ports,
            properties: crearPropiedades({
              ...(el.valor_inicial !== undefined
                ? { initialValue: el.valor_inicial }
                : {}),
              ...(el.retardo_ms ? { executionDelay: el.retardo_ms } : {}),
            }),
          },
        });
      } else if (el.tipo === 'functional_block') {
        const ports: HilesPort[] = [
          ...el.entradas.map((en) =>
            crearPuerto({
              id: en.puerto,
              name: en.variable,
              direction: 'input',
              dataType: en.tipo_dato as HilesPort['dataType'],
              nature: 'continuous',
            }),
          ),
          ...el.salidas.map((sal) =>
            crearPuerto({
              id: sal.puerto,
              name: sal.variable,
              direction: 'output',
              dataType: sal.tipo_dato as HilesPort['dataType'],
              nature: 'continuous',
            }),
          ),
        ];
        nodos.push({
          id: el.id,
          type: 'hilesNode',
          position,
          data: {
            hilesType: HilesElementType.FUNCTIONAL_BLOCK,
            name: el.nombre,
            ports,
            properties: crearPropiedades({
              enabled: el.habilitado,
              codeLanguage: el.lenguaje === 'python' ? 'python' : 'javascript',
              ...(el.codigo ? { code: el.codigo } : {}),
              ...(el.retardo_ms ? { executionDelay: el.retardo_ms } : {}),
              irV2Metadata: {
                lenguaje: el.lenguaje,
                codigo: el.codigo ?? undefined,
                expresion: el.expresion ?? undefined,
                entradas: el.entradas,
                salidas: el.salidas,
              },
            }),
          },
        });
      } else if (el.tipo === 'sample') {
        const ports: HilesPort[] = [
          crearPuerto({
            id: el.puerto_dato,
            name: 'Data',
            direction: 'input',
            dataType: el.tipo_dato as HilesPort['dataType'],
            nature: 'continuous',
          }),
          crearPuerto({
            id: el.puerto_control,
            name: 'Control',
            direction: 'input',
            dataType: 'boolean',
            nature: 'control',
          }),
          crearPuerto({
            id: el.puerto_salida,
            name: 'Out',
            direction: 'output',
            dataType: el.tipo_dato as HilesPort['dataType'],
            nature: 'continuous',
          }),
        ];
        nodos.push({
          id: el.id,
          type: 'hilesNode',
          position,
          data: {
            hilesType: HilesElementType.SAMPLE,
            name: el.nombre,
            ports,
            properties: crearPropiedades({
              enabled: el.habilitado,
              ...(el.retardo_ms ? { executionDelay: el.retardo_ms } : {}),
            }),
          },
        });
      } else if (el.tipo === 'hold') {
        const ports: HilesPort[] = [
          crearPuerto({
            id: el.puerto_entrada,
            name: 'DCH',
            direction: 'input',
            dataType: el.tipo_dato as HilesPort['dataType'],
            nature: 'continuous',
          }),
          crearPuerto({
            id: el.puerto_cch,
            name: 'CCH',
            direction: 'output',
            dataType: el.tipo_dato as HilesPort['dataType'],
            nature: 'continuous',
          }),
          crearPuerto({
            id: el.puerto_lch,
            name: 'LCH',
            direction: 'output',
            dataType: 'boolean',
            nature: 'control',
          }),
        ];
        nodos.push({
          id: el.id,
          type: 'hilesNode',
          position,
          data: {
            hilesType: HilesElementType.HOLD,
            name: el.nombre,
            ports,
            properties: crearPropiedades({
              enabled: el.habilitado,
              ...(el.valor_inicial !== undefined
                ? { initialValue: el.valor_inicial }
                : {}),
              ...(el.retardo_ms ? { executionDelay: el.retardo_ms } : {}),
            }),
          },
        });
      } else if (el.tipo === 'place') {
        nodos.push({
          id: el.id,
          type: 'hilesNode',
          position,
          data: {
            hilesType: HilesElementType.PLACE,
            name: el.nombre,
            ports: [
              crearPuerto({
                id: 'petri-in',
                name: 'In',
                direction: 'input',
                dataType: 'integer',
                nature: 'control',
              }),
              crearPuerto({
                id: 'petri-out',
                name: 'Out',
                direction: 'output',
                dataType: 'integer',
                nature: 'control',
              }),
            ],
            properties: crearPropiedades({
              tokens: el.tokens,
              ...(el.capacidad !== null ? { maxTokens: el.capacidad } : {}),
            }),
          },
        });
      } else if (el.tipo === 'transition') {
        nodos.push({
          id: el.id,
          type: 'hilesNode',
          position,
          data: {
            hilesType: HilesElementType.TRANSITION,
            name: el.nombre,
            ports: [
              crearPuerto({
                id: el.puerto_condicion,
                name: 'Condition',
                direction: 'input',
                dataType: 'boolean',
                nature: 'control',
              }),
              crearPuerto({
                id: el.puerto_accion ?? 'transition-action-out',
                name: 'Action',
                direction: 'output',
                dataType: 'boolean',
                nature: 'control',
              }),
            ],
            properties: crearPropiedades({
              enabled: el.habilitada,
              ...(el.retardo_ms ? { executionDelay: el.retardo_ms } : {}),
            }),
          },
        });
      }
    });

    modelo.conexiones.forEach((conn) => {
      if (conn.tipo === 'arco') {
        aristas.push({
          id: conn.id,
          source: conn.origen,
          sourceHandle: 'petri-out',
          target: conn.destino,
          targetHandle: 'petri-in',
          data: {
            hilesConnectionType: HilesConnectionType.PETRI,
            weight: conn.peso,
            channelType: 'arco',
          } as unknown as AristaHiLeS['data'],
        });
      } else {
        const hilesType =
          conn.tipo === 'dch'
            ? HilesConnectionType.DISCRETE
            : conn.tipo === 'lch'
              ? HilesConnectionType.PETRI
              : HilesConnectionType.CONTINUOUS;
        aristas.push({
          id: conn.id,
          source: conn.origen,
          sourceHandle: conn.puerto_origen,
          target: conn.destino,
          targetHandle: conn.puerto_destino,
          data: {
            hilesConnectionType: hilesType,
            channelType: conn.tipo,
            ...(conn.retardo_ms ? { delay: conn.retardo_ms } : {}),
            ...(conn.tipo === 'dch' && conn.capacidad_cola
              ? { queueCapacity: conn.capacidad_cola }
              : {}),
          } as unknown as AristaHiLeS['data'],
        });
      }
    });

    this.construirGrafo(nodos, aristas);
  }

  /**
   * Construye una instancia `IElementoHiLeS` por cada nodo ejecutable del
   * canvas y calcula el orden en que deben evaluarse.
   */
  construirGrafo(
    nodos: readonly NodoHiLeS[],
    aristas: readonly AristaHiLeS[],
  ): void {
    this.nodos = [...nodos];
    this.aristas = [...aristas];
    this.aristasEfectivas = aplanarConexionesFrontera(this.nodos, this.aristas);
    this.elementos = new Map();
    this.nombres = new Map();
    this.valores = new Map();
    this.salidasPorNodo = new Map();
    this.entradasPorNodo = new Map();
    this.metadataNodos = new Map();
    this.erroresNodos = new Map();
    this.erroresReportados = new Map();
    this.timersElementos = new Map();
    this.salidasRetenidasElemento = new Map();
    this.timersTransiciones = new Map();
    this.transicionesDisparadasUltimoPaso = new Set();
    this.pulsoEmitidoUltimoPaso = new Map();
    this.relojMs = 0;
    this.eventos = [];
    this.contadorEventos = 0;
    this.contadorPasos = 0;
    this.estado = EstadoSimulacion.INACTIVA;

    const fallidos: string[] = [];

    this.nodos.forEach((nodo) => {
      const tipo = nodo.data.hilesType;
      this.nombres.set(nodo.id, nodo.data.name);
      if (TIPOS_SIN_LOGICA.includes(tipo)) return;

      const props = nodo.data.properties as unknown as Record<string, unknown>;
      const retardoRaw =
        props?.executionDelay ?? props?.retardo_ms ?? props?.delay ?? 0;
      const retardoMs =
        typeof retardoRaw === 'number' &&
        Number.isFinite(retardoRaw) &&
        retardoRaw > 0
          ? Math.trunc(retardoRaw)
          : 0;

      const irMeta = props?.irV2Metadata as
        | {
            lenguaje?: 'python' | 'expresion';
            codigo?: string;
            expresion?: IrExpresion;
            entradas?: IrPuertoTipadoV2[];
            salidas?: IrPuertoTipadoV2[];
          }
        | undefined;

      const entradasTipadas: IrPuertoTipadoV2[] =
        irMeta?.entradas ??
        nodo.data.ports
          .filter((p) => p.direction === 'input')
          .map((p, idx) => ({
            puerto: p.id,
            variable: nombreVariable(p.name) || `in_${idx + 1}`,
            tipo_dato: (p.dataType ?? 'real') as IrTipoDatoV2,
          }));

      const salidasTipadas: IrPuertoTipadoV2[] =
        irMeta?.salidas ??
        nodo.data.ports
          .filter((p) => p.direction === 'output')
          .map((p, idx) => ({
            puerto: p.id,
            name: p.name,
            variable: nombreVariable(p.name) || (idx === 0 ? 'out' : `out_${idx + 1}`),
            tipo_dato: (p.dataType ?? 'real') as IrTipoDatoV2,
          }));

      this.metadataNodos.set(nodo.id, {
        retardoMs,
        lenguajeIr:
          irMeta?.lenguaje ??
          (nodo.data.properties.codeLanguage === 'python'
            ? 'python'
            : undefined),
        codigoPython: irMeta?.codigo ?? nodo.data.properties.code,
        expresionIr: irMeta?.expresion,
        entradasTipadas,
        salidasTipadas,
      });

      try {
        const instancia = crearElemento(tipo, {
          properties: nodo.data.properties,
          ports: nodo.data.ports,
          hijos: this.nodos
            .filter((hijo) => hijo.parentId === nodo.id)
            .map((hijo) => hijo.id),
        });

        // Si es un HOLD con initialValue / valorInicial configurado en properties, inicializarlo
        if (
          tipo === HilesElementType.HOLD &&
          props?.initialValue !== undefined
        ) {
          const puertoDch = nodo.data.ports.find((p) => p.direction === 'input');
          if (puertoDch) {
            instancia.recibirEntrada(
              puertoDch.id,
              props.initialValue as ValorRuntime,
            );
            // Consumir el evento pendiente inicial para que en reposo solo publique CCH continuo
            instancia.evaluar();
          }
        }

        // Si es un SERVICE con initialValue configurado en properties, inicializar su valor
        if (
          tipo === HilesElementType.SERVICE &&
          props?.initialValue !== undefined &&
          instancia instanceof ElementoService
        ) {
          instancia.establecerValor(
            props.initialValue as ValorRuntime,
          );
        }

        // Envolver recibirEntrada para registrar las entradas por puerto en el nodo
        const recibirOriginal = instancia.recibirEntrada.bind(instancia);
        instancia.recibirEntrada = (puertoId: string, valor: ValorRuntime) => {
          const mapaActual = this.entradasPorNodo.get(nodo.id) ?? {};
          mapaActual[puertoId] = valor;
          const puertoObj = nodo.data.ports.find((p) => p.id === puertoId);
          if (puertoObj) {
            mapaActual[puertoObj.name] = valor;
            mapaActual[nombreVariable(puertoObj.name)] = valor;
          }
          const entradaIr = entradasTipadas.find((e) => e.puerto === puertoId);
          if (entradaIr) {
            mapaActual[entradaIr.variable] = valor;
          }
          this.entradasPorNodo.set(nodo.id, mapaActual);
          recibirOriginal(puertoId, valor);
        };

        this.elementos.set(nodo.id, instancia);
      } catch (error) {
        fallidos.push(nodo.id);
        this.registrar({
          tipo: TipoEventoSimulacion.ERROR,
          elementoId: nodo.id,
          mensaje:
            error instanceof Error
              ? `No se pudo crear ${nodo.data.name}: ${error.message}`
              : `No se pudo crear ${nodo.data.name}.`,
        });
      }
    });

    const resultadoOrden = construirOrdenTopologico(
      this.nodos,
      this.aristasEfectivas,
    );
    const ordenCandidato = resultadoOrden.orden.filter((id) =>
      this.elementos.has(id),
    );
    this.orden = [
      ...ordenCandidato.filter(
        (id) => this.elementos.get(id) instanceof ElementoService,
      ),
      ...ordenCandidato.filter(
        (id) => this.elementos.get(id) instanceof ElementoTransicion,
      ),
      ...ordenCandidato.filter((id) => {
        const el = this.elementos.get(id);
        return (
          !(el instanceof ElementoService) &&
          !(el instanceof ElementoTransicion)
        );
      }),
    ];

    this.registrar({
      tipo: TipoEventoSimulacion.CONSTRUCCION,
      mensaje: `Grafo construido con ${this.elementos.size} elemento(s) y ${this.aristasEfectivas.length} conexión(es).`,
    });

    if (resultadoOrden.hayCiclo) {
      detectarCiclos(this.nodos, this.aristasEfectivas).forEach((ciclo) => {
        this.registrar({
          tipo: TipoEventoSimulacion.ERROR,
          mensaje: `Ciclo en el flujo de datos: ${ciclo
            .map((id) => this.nombreDe(id))
            .join(' → ')} → ${this.nombreDe(ciclo[0])}.`,
        });
      });
    }

    if (fallidos.length > 0 || resultadoOrden.hayCiclo) {
      this.estado = EstadoSimulacion.ERROR;
      return;
    }

    // El bus vincula a los observadores ahora que todos los elementos existen.
    this.bus.construirDesdeAristas(
      this.aristasEfectivas,
      this.elementos,
      (nodoId) => this.primerPuertoEntrada(nodoId),
    );

    this.estado =
      this.elementos.size > 0
        ? EstadoSimulacion.LISTA
        : EstadoSimulacion.INACTIVA;
  }

  // ---------------------------------------------------------------------
  // Reloj lógico y entrada del usuario
  // ---------------------------------------------------------------------

  /** Avanza el reloj lógico del motor sin bloquear la ejecución. */
  avanzarTiempo(deltaMs: number): number {
    if (Number.isFinite(deltaMs) && deltaMs > 0) {
      this.relojMs += Math.trunc(deltaMs);
      this.bus.establecerRelojMs(this.relojMs);
    }
    return this.relojMs;
  }

  obtenerRelojMs(): number {
    return this.relojMs;
  }

  /** Permite acceder al bus interno para consultar colas DCH o entregas diferidas. */
  obtenerBus(): BusObserver {
    return this.bus;
  }

  /**
   * Punto de entrada del usuario: coloca un valor en un Service para que el
   * siguiente paso lo publique hacia el circuito.
   */
  inyectarEntrada(
    servicioId: string,
    valor: ValorRuntime | IrValorRuntimeV2,
  ): ResultadoInyeccion {
    const elemento = this.elementos.get(servicioId);
    if (!(elemento instanceof ElementoService)) {
      const mensaje = 'Solo se puede inyectar un valor en un Service.';
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        elementoId: servicioId,
        mensaje,
      });
      return { exito: false, mensaje };
    }

    const nodo = this.nodos.find((item) => item.id === servicioId);
    if (!nodo?.data.ports.some((puerto) => puerto.direction === 'output')) {
      const mensaje = `${this.nombreDe(servicioId)} necesita al menos un puerto de salida para inyectar valores.`;
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        elementoId: servicioId,
        mensaje,
      });
      return { exito: false, mensaje };
    }

    const valorRuntime = valor as unknown as ValorRuntime;
    elemento.establecerValor(valorRuntime);
    this.bus.registrarMuestraService(servicioId, valorRuntime);
    const mensaje = `${this.nombreDe(servicioId)} recibió ${
      typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
    }.`;
    this.registrar({
      tipo: TipoEventoSimulacion.ENTRADA,
      elementoId: servicioId,
      mensaje,
      valor: valorRuntime,
    });
    this.estado = EstadoSimulacion.EJECUTANDO;
    return { exito: true, mensaje };
  }

  // ---------------------------------------------------------------------
  // Ejecución
  // ---------------------------------------------------------------------

  private async evaluarElementoConSoporteIrV2(
    elementoId: string,
    elemento: IElementoHiLeS,
  ): Promise<Map<string, ValorRuntime>> {
    if (this.ejecutorPersonalizado) {
      return this.ejecutorPersonalizado(elementoId, elemento);
    }

    const meta = this.metadataNodos.get(elementoId);
    const nodo = this.nodos.find((n) => n.id === elementoId);

    let salidasCalculadas: Map<string, ValorRuntime>;

    if (
      elemento.tipo === HilesElementType.FUNCTIONAL_BLOCK &&
      meta?.expresionIr
    ) {
      if (nodo?.data.properties.enabled === false) {
        salidasCalculadas = new Map();
      } else {
        const entradasRaw = this.entradasPorNodo.get(elementoId) ?? {};
        const vars: Record<string, number | boolean | string> = {};
        for (const en of meta.entradasTipadas ?? []) {
          const val = entradasRaw[en.puerto] ?? entradasRaw[en.variable] ?? 0;
          vars[en.variable] =
            typeof val === 'number' ||
            typeof val === 'boolean' ||
            typeof val === 'string'
              ? val
              : 0;
        }
        const resultadoAst = evaluarExpresionIr(meta.expresionIr, vars);
        salidasCalculadas = new Map();
        for (const sal of meta.salidasTipadas ?? []) {
          salidasCalculadas.set(sal.puerto, (resultadoAst ?? 0) as ValorRuntime);
        }
        this.erroresNodos.delete(elementoId);
      }
    } else if (
      elemento.tipo === HilesElementType.FUNCTIONAL_BLOCK &&
      (meta?.lenguajeIr === 'python' ||
        nodo?.data.properties.codeLanguage === 'python')
    ) {
      if (nodo?.data.properties.enabled === false) {
        salidasCalculadas = new Map();
      } else {
        const codigo = (
          meta?.codigoPython ??
          nodo?.data.properties.code ??
          ''
        ).trim();
        const entradasTipadas = meta?.entradasTipadas ?? [];
        const salidasTipadas = meta?.salidasTipadas ?? [];
        try {
          validarCodigoPythonPerfilV2(codigo, entradasTipadas, salidasTipadas);
          const entradasActuales = this.entradasPorNodo.get(elementoId) ?? {};
          const entradasNormalizadas = normalizarEntradasPython(
            entradasActuales,
            entradasTipadas,
          );
          const resultadoBruto = await ejecutarPython(codigo, {
            ...entradasActuales,
            ...(entradasNormalizadas as unknown as EntradasRuntime),
          });
          const salidasDict = normalizarSalidasPython(
            resultadoBruto,
            salidasTipadas,
          );
          salidasCalculadas = new Map();
          for (const [puertoId, val] of Object.entries(salidasDict)) {
            salidasCalculadas.set(puertoId, val as ValorRuntime);
          }
          this.erroresNodos.delete(elementoId);
        } catch (err) {
          const codigoError =
            err instanceof ErrorPythonPerfilIrV2
              ? err.codigo
              : 'PYTHON_EJECUCION_ERROR';
          this.erroresNodos.set(elementoId, codigoError);
          throw new Error(
            `${codigoError}: ${err instanceof Error ? err.message : String(err)}`,
            { cause: err },
          );
        }
      }
    } else {
      salidasCalculadas = await ejecutorAsyncPorDefecto(elementoId, elemento);
      const errInterno = elemento.obtenerEstado().error;
      if (errInterno) {
        this.erroresNodos.set(elementoId, errInterno);
      } else {
        this.erroresNodos.delete(elementoId);
      }
    }

    // Registrar si un Sample o Hold emitió un evento en este paso
    if (elemento.tipo === HilesElementType.SAMPLE) {
      this.pulsoEmitidoUltimoPaso.set(elementoId, salidasCalculadas.size > 0);
    } else if (elemento.tipo === HilesElementType.HOLD) {
      const puertoLch = nodo?.data.ports.find(
        (p) => p.direction === 'output' && p.nature === 'control',
      );
      this.pulsoEmitidoUltimoPaso.set(
        elementoId,
        puertoLch ? salidasCalculadas.get(puertoLch.id) === true : false,
      );
    }

    // Manejar retardo de ejecución (`retardo_ms` / `executionDelay`) sin bloqueo
    const retardoMs = meta?.retardoMs ?? 0;
    if (retardoMs > 0) {
      const timerExistente = this.timersElementos.get(elementoId);
      if (timerExistente && this.relojMs >= timerExistente.venceEnMs) {
        this.timersElementos.delete(elementoId);
        this.salidasRetenidasElemento.set(
          elementoId,
          new Map(timerExistente.salidas),
        );
        salidasCalculadas = new Map(timerExistente.salidas);
      } else if (salidasCalculadas.size > 0) {
        const retenidas = this.salidasRetenidasElemento.get(elementoId);
        const cambioSalida =
          !retenidas ||
          JSON.stringify(Object.fromEntries(salidasCalculadas)) !==
            JSON.stringify(Object.fromEntries(retenidas));
        if (cambioSalida && !timerExistente) {
          this.timersElementos.set(elementoId, {
            venceEnMs: this.relojMs + retardoMs,
            salidas: new Map(salidasCalculadas),
          });
        }
        salidasCalculadas = retenidas ? new Map(retenidas) : new Map();
      }
    }

    if (salidasCalculadas.size > 0) {
      const registroSalidas: Record<string, ValorRuntime> = {};
      salidasCalculadas.forEach((v, k) => {
        registroSalidas[k] = v;
      });
      this.salidasPorNodo.set(elementoId, registroSalidas);
    }

    return salidasCalculadas;
  }

  /**
   * Ejecuta un ciclo completo: propaga los datos en orden topológico y después
   * evalúa la red de Petri con el marcado resultante.
   */
  async paso(avanceTiempoMs?: number): Promise<ResultadoPaso> {
    const indiceInicial = this.eventos.length;

    if (this.elementos.size === 0) {
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        mensaje:
          'No hay ningún elemento que simular: construye primero el grafo.',
      });
      return {
        paso: this.contadorPasos,
        cambio: false,
        transicionesDisparadas: [],
        conflicto: false,
        eventos: this.eventos.slice(indiceInicial),
      };
    }

    const deltaMs = avanceTiempoMs ?? this.pasoTiempoMsPorDefecto;
    if (deltaMs > 0) {
      this.avanzarTiempo(deltaMs);
    }

    this.contadorPasos += 1;
    this.transicionesDisparadasUltimoPaso.clear();
    const instantaneaAntes = this.serializarInstantanea();
    this.registrar({
      tipo: TipoEventoSimulacion.PASO,
      mensaje: `Inicio del paso ${this.contadorPasos}.`,
    });

    // 0. Iniciar paso en el bus (entregas diferidas vencidas y consumo FIFO de 1 evento por cola DCH)
    this.bus.iniciarPaso(this.relojMs);

    // 1. Flujo de datos (CCH/DCH/LCH) en modo push.
    const propagacion = await propagarValoresAsync(
      this.orden,
      {
        elementos: this.elementos,
        aristas: this.aristasEfectivas,
        valores: this.valores,
        puertoEntradaPorDefecto: (nodoId) => this.primerPuertoEntrada(nodoId),
      },
      (id, el) => this.evaluarElementoConSoporteIrV2(id, el),
      this.bus,
    );

    // Verificar desbordamientos en colas DCH
    this.bus.obtenerTodasLasColasDch().forEach((estadoCola) => {
      if (estadoCola.desbordada) {
        this.erroresNodos.set(estadoCola.destinoId, 'DCH_COLA_DESBORDADA');
        propagacion.errores.push({
          elementoId: estadoCola.destinoId,
          mensaje: `DCH_COLA_DESBORDADA en puerto '${estadoCola.puertoDestinoId}' (capacidad ${estadoCola.capacidad}).`,
        });
      }
    });

    propagacion.nodosActualizados.forEach((nodoId) => {
      this.registrar({
        tipo: TipoEventoSimulacion.PROPAGACION,
        elementoId: nodoId,
        valor: this.valores.get(nodoId),
        mensaje: `${this.nombreDe(nodoId)} publicó ${String(this.valores.get(nodoId))}.`,
      });
    });

    propagacion.errores.forEach((error) => {
      if (this.erroresReportados.get(error.elementoId) === error.mensaje)
        return;
      this.erroresReportados.set(error.elementoId, error.mensaje);
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        elementoId: error.elementoId,
        mensaje: `${this.nombreDe(error.elementoId)}: ${error.mensaje}`,
      });
    });

    const conError = new Set(
      propagacion.errores.map((error) => error.elementoId),
    );
    [...this.erroresReportados.keys()]
      .filter((elementoId) => !conError.has(elementoId))
      .forEach((elementoId) => this.erroresReportados.delete(elementoId));

    // 2. Red de Petri: guardas + marcado + soporte de retardo no bloqueante en Transitions.
    const habilitadasCrudas = obtenerTransicionesHabilitadas(
      this.elementos,
      this.aristasEfectivas,
    );
    const setHabilitadasCrudas = new Set(habilitadasCrudas);

    // Cancelar timers de transiciones que dejaron de estar habilitadas
    for (const [transId] of this.timersTransiciones.entries()) {
      if (!setHabilitadasCrudas.has(transId)) {
        this.timersTransiciones.delete(transId);
      }
    }

    const habilitadasListasParaDisparar: string[] = [];
    for (const transId of habilitadasCrudas) {
      const retardoTrans = this.metadataNodos.get(transId)?.retardoMs ?? 0;
      if (retardoTrans <= 0) {
        habilitadasListasParaDisparar.push(transId);
        continue;
      }
      const venceEn = this.timersTransiciones.get(transId);
      if (venceEn === undefined) {
        this.timersTransiciones.set(transId, this.relojMs + retardoTrans);
      } else if (this.relojMs >= venceEn) {
        this.timersTransiciones.delete(transId);
        habilitadasListasParaDisparar.push(transId);
      }
    }

    let conflictoPetri = false;
    const transicionesDisparadas: string[] = [];

    if (habilitadasListasParaDisparar.length > 1) {
      conflictoPetri = true;
      this.registrar({
        tipo: TipoEventoSimulacion.CONFLICTO,
        mensaje: `Conflicto entre ${habilitadasListasParaDisparar
          .map((id) => this.nombreDe(id))
          .join(', ')}: los tokens se conservan.`,
      });
    } else if (habilitadasListasParaDisparar.length === 1) {
      const transId = habilitadasListasParaDisparar[0];
      const disparo = dispararTransicion(
        transId,
        this.elementos,
        this.aristasEfectivas,
      );
      if (disparo.exito) {
        transicionesDisparadas.push(transId);
        this.transicionesDisparadasUltimoPaso.add(transId);
        this.registrar({
          tipo: TipoEventoSimulacion.DISPARO,
          elementoId: transId,
          mensaje: `${this.nombreDe(transId)} disparó y movió los tokens.`,
        });
      }
    }

    // 3. Finalizar paso en el bus (limpiar pulsos LCH transitorios)
    this.bus.finalizarPaso();

    const hayTrabajoDiferido =
      this.bus.tieneEventosDchPendientes() ||
      this.bus.tieneEntregasDiferidasPendientes() ||
      this.timersElementos.size > 0 ||
      this.timersTransiciones.size > 0;

    const cambio =
      this.serializarInstantanea() !== instantaneaAntes || hayTrabajoDiferido;

    if (propagacion.errores.length > 0) {
      this.estado = EstadoSimulacion.ERROR;
    } else if (cambio) {
      this.estado = EstadoSimulacion.EJECUTANDO;
    } else {
      this.estado = EstadoSimulacion.ESTABILIZADA;
      this.registrar({
        tipo: TipoEventoSimulacion.ESTABILIZACION,
        mensaje: `El circuito se estabilizó en el paso ${this.contadorPasos}.`,
      });
    }

    return {
      paso: this.contadorPasos,
      cambio,
      transicionesDisparadas,
      conflicto: conflictoPetri,
      eventos: this.eventos.slice(indiceInicial),
    };
  }

  /**
   * Ejecuta pasos hasta que el circuito deje de cambiar, aparezca un error o se
   * alcance el límite configurado.
   */
  async ejecutar(
    limitePasos: number = this.limitePasos,
  ): Promise<ResultadoEjecucion> {
    const indiceInicial = this.eventos.length;
    let pasosEjecutados = 0;
    let estabilizado = false;

    while (pasosEjecutados < limitePasos) {
      const resultado = await this.paso();
      pasosEjecutados += 1;
      if (this.estado === EstadoSimulacion.ERROR) break;
      if (!resultado.cambio) {
        estabilizado = true;
        break;
      }
    }

    if (!estabilizado && this.estado !== EstadoSimulacion.ERROR) {
      this.estado = EstadoSimulacion.ERROR;
      this.registrar({
        tipo: TipoEventoSimulacion.ERROR,
        mensaje: `El circuito no se estabilizó tras ${limitePasos} paso(s); puede estar oscilando.`,
      });
    }

    return {
      pasosEjecutados,
      estabilizado,
      estado: this.estado,
      eventos: this.eventos.slice(indiceInicial),
    };
  }

  /**
   * Restaura el estado exacto del inicio: tokens iniciales de cada Place, sin
   * valores propagados, sin entradas inyectadas, sin timers ni colas pendientes.
   */
  reiniciar(): void {
    this.elementos.forEach((elemento, id) => {
      elemento.reiniciar();
      const nodo = this.nodos.find((n) => n.id === id);
      const props = nodo?.data.properties as unknown as
        | Record<string, unknown>
        | undefined;
      if (
        nodo?.data.hilesType === HilesElementType.HOLD &&
        props?.initialValue !== undefined
      ) {
        const puertoDch = nodo.data.ports.find((p) => p.direction === 'input');
        if (puertoDch) {
          elemento.recibirEntrada(
            puertoDch.id,
            props.initialValue as ValorRuntime,
          );
          elemento.evaluar();
        }
      }
      if (
        nodo?.data.hilesType === HilesElementType.SERVICE &&
        props?.initialValue !== undefined &&
        elemento instanceof ElementoService
      ) {
        elemento.establecerValor(
          props.initialValue as ValorRuntime,
        );
      }
    });
    this.bus.reiniciarEstadoCanales();
    this.valores = new Map();
    this.salidasPorNodo = new Map();
    this.entradasPorNodo = new Map();
    this.erroresNodos = new Map();
    this.erroresReportados = new Map();
    this.timersElementos = new Map();
    this.salidasRetenidasElemento = new Map();
    this.timersTransiciones = new Map();
    this.transicionesDisparadasUltimoPaso = new Set();
    this.pulsoEmitidoUltimoPaso = new Map();
    this.relojMs = 0;
    this.eventos = [];
    this.contadorEventos = 0;
    this.contadorPasos = 0;
    this.estado =
      this.elementos.size > 0
        ? EstadoSimulacion.LISTA
        : EstadoSimulacion.INACTIVA;
    this.registrar({
      tipo: TipoEventoSimulacion.REINICIO,
      mensaje: 'Simulación reiniciada al estado inicial.',
    });
  }

  // ---------------------------------------------------------------------
  // Consulta del estado
  // ---------------------------------------------------------------------

  obtenerEventos(): EventoSimulacion[] {
    return [...this.eventos];
  }

  obtenerEstado(): EstadoSimulacion {
    return this.estado;
  }

  obtenerContadorPasos(): number {
    return this.contadorPasos;
  }

  obtenerValores(): Map<string, ValorRuntime> {
    return new Map(this.valores);
  }

  obtenerEstadosElementos(): Map<string, EstadoElemento> {
    return new Map(
      [...this.elementos.entries()].map(([id, elemento]) => {
        const base = elemento.obtenerEstado();
        const errV2 = this.erroresNodos.get(id);
        const valorPub = this.valores.get(id);
        return [
          id,
          {
            ...base,
            ...(valorPub !== undefined && base.valor === undefined
              ? { valor: valorPub }
              : {}),
            ...(errV2 ? { error: errV2 } : {}),
          },
        ];
      }),
    );
  }

  obtenerInstantanea(): InstantaneaSimulacion {
    return {
      estados: Object.fromEntries(this.obtenerEstadosElementos()),
      valores: Object.fromEntries(this.valores),
    };
  }

  /**
   * Obtiene el estado ampliado en formato IR v2 para comparación de conformidad
   * entre el motor TypeScript de referencia y el motor MicroPython.
   */
  obtenerEstadoIrV2(): Record<string, IrEstadoElementoV2> {
    const resultado: Record<string, IrEstadoElementoV2> = {};

    for (const [id, elemento] of this.elementos.entries()) {
      const estadoBase = elemento.obtenerEstado();
      const colaDch = this.bus.obtenerEstadoColaDch(id);
      const timerPendiente =
        this.timersElementos.has(id) ||
        this.timersTransiciones.has(id) ||
        this.bus.tieneEntregasDiferidasPendientes(id);
      const errorStr = this.erroresNodos.get(id) ?? estadoBase.error ?? null;

      if (elemento instanceof ElementoService) {
        const valorServicio = this.valores.get(id) ?? estadoBase.valor;
        resultado[id] = {
          ...(valorServicio !== undefined
            ? { valor: valorServicio as IrValorRuntimeV2 }
            : {}),
          ...(timerPendiente ? { timer_pendiente: true } : {}),
        };
      } else if (elemento.tipo === HilesElementType.FUNCTIONAL_BLOCK) {
        const salidasNodo = this.salidasPorNodo.get(id);
        const primerPuertoSalida =
          this.metadataNodos.get(id)?.salidasTipadas?.[0]?.puerto;
        const salidaPrincipal =
          (primerPuertoSalida && salidasNodo
            ? salidasNodo[primerPuertoSalida]
            : undefined) ??
          this.valores.get(id) ??
          estadoBase.valor;
        resultado[id] = {
          ...(salidaPrincipal !== undefined
            ? { salida: salidaPrincipal as IrValorRuntimeV2 }
            : {}),
          ...(salidasNodo
            ? {
                salidas: { ...(salidasNodo as Record<string, IrValorRuntimeV2>) },
              }
            : {}),
          ...(timerPendiente ? { timer_pendiente: true } : {}),
          ...(errorStr ? { error: errorStr } : {}),
        };
      } else if (elemento.tipo === HilesElementType.SAMPLE) {
        const salidaSample = this.valores.get(id) ?? estadoBase.valor;
        resultado[id] = {
          ...(salidaSample !== undefined
            ? { salida: salidaSample as IrValorRuntimeV2 }
            : {}),
          evento_pendiente: Boolean(this.pulsoEmitidoUltimoPaso.get(id)),
          ...(colaDch
            ? {
                cola_dch: colaDch.cola.length,
                cola_desbordada: colaDch.desbordada,
              }
            : {}),
          ...(timerPendiente ? { timer_pendiente: true } : {}),
          ...(errorStr ? { error: errorStr } : {}),
        };
      } else if (elemento.tipo === HilesElementType.HOLD) {
        const retenido = estadoBase.valor ?? this.valores.get(id);
        resultado[id] = {
          ...(retenido !== undefined
            ? {
                valor_retenido: retenido as IrValorRuntimeV2,
                salida: retenido as IrValorRuntimeV2,
              }
            : {}),
          evento_pendiente: Boolean(this.pulsoEmitidoUltimoPaso.get(id)),
          ...(colaDch
            ? {
                cola_dch: colaDch.cola.length,
                cola_desbordada: colaDch.desbordada,
              }
            : {}),
          ...(timerPendiente ? { timer_pendiente: true } : {}),
          ...(errorStr ? { error: errorStr } : {}),
        };
      } else if (elemento instanceof ElementoLugar) {
        resultado[id] = {
          tokens: elemento.obtenerCantidadTokens(),
        };
      } else if (elemento instanceof ElementoTransicion) {
        resultado[id] = {
          habilitada: elemento.estaHabilitada(),
          disparada: this.transicionesDisparadasUltimoPaso.has(id),
          ...(timerPendiente ? { timer_pendiente: true } : {}),
          ...(errorStr ? { error: errorStr } : {}),
        };
      }
    }

    return resultado;
  }

  obtenerServiciosInyectables(): ServicioInyectable[] {
    return this.nodos
      .filter(
        (nodo) =>
          nodo.data.hilesType === HilesElementType.SERVICE &&
          nodo.data.ports.some((puerto) => puerto.direction === 'output'),
      )
      .map((nodo) => ({
        id: nodo.id,
        nombre: nodo.data.name,
        tipoDato:
          nodo.data.ports.find((puerto) => puerto.direction === 'output')
            ?.dataType ?? 'real',
      }));
  }

  // ---------------------------------------------------------------------
  // Utilidades internas
  // ---------------------------------------------------------------------

  private nombreDe(nodoId: string): string {
    return this.nombres.get(nodoId) ?? nodoId;
  }

  private primerPuertoEntrada(nodoId: string): string | undefined {
    return this.nodos
      .find((nodo) => nodo.id === nodoId)
      ?.data.ports.find((puerto) => puerto.direction === 'input')?.id;
  }

  private serializarInstantanea(): string {
    return JSON.stringify(this.obtenerInstantanea());
  }

  private registrar(evento: {
    tipo: EventoSimulacion['tipo'];
    mensaje: string;
    elementoId?: string;
    valor?: ValorRuntime;
  }): void {
    const indice = this.contadorEventos;
    this.contadorEventos += 1;
    this.eventos.push({
      id: `evt-${indice}`,
      indice,
      paso: this.contadorPasos,
      tipo: evento.tipo,
      mensaje: evento.mensaje,
      marcaTiempo: Date.now(),
      ...(evento.elementoId
        ? {
            elementoId: evento.elementoId,
            elementoNombre: this.nombreDe(evento.elementoId),
          }
        : {}),
      ...(evento.valor !== undefined ? { valor: evento.valor } : {}),
    });
  }
}
