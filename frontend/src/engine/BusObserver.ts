import { HilesConnectionType } from '../types/hiles';
import { esAristaDatos, obtenerTipoCanalArista } from './GrafoDatos';
import type { AristaHiLeS, ValorRuntime } from './tipos';
import type { IElementoHiLeS } from './elementos/interfaces';

export const CAPACIDAD_COLA_DCH_POR_DEFECTO = 8;
export const CAPACIDAD_COLA_DCH_MAXIMA = 32;

/** Contrato que debe cumplir cualquier nodo que quiera recibir notificaciones. */
export interface IObservadorNodo {
  /** Llamado cuando el sujeto al que está suscrito publica un valor. */
  alRecibirValor(puertoDestinoId: string, valor: ValorRuntime): void;
}

export interface EstadoColaDch {
  destinoId: string;
  puertoDestinoId: string;
  capacidad: number;
  cola: ValorRuntime[];
  desbordada: boolean;
  consumidoEnPaso: boolean;
}

export interface EntregaDiferidaCanal {
  idSuscripcion: string;
  aristaId: string;
  origenId: string;
  puertoOrigenId: string;
  destinoId: string;
  puertoDestinoId: string;
  tipoCanal: 'cch' | 'dch' | 'lch';
  valor: ValorRuntime;
  venceEnMs: number;
}

/**
 * Sujeto del patrón Observer.
 * Cada instancia representa un puerto de salida de un nodo.
 * Mantiene la lista de observadores suscritos y los notifica al publicar.
 */
export class SujetoNodo {
  // Mapa de idSuscripcion -> { puertoDestinoId, observador }
  private readonly observadores = new Map<
    string,
    { puertoDestinoId: string; observador: IObservadorNodo }
  >();

  /** Registra un observador para que reciba notificaciones en el puerto indicado. */
  suscribir(
    idSuscripcion: string,
    puertoDestinoId: string,
    observador: IObservadorNodo,
  ): void {
    this.observadores.set(idSuscripcion, { puertoDestinoId, observador });
  }

  /** Elimina un observador. */
  desuscribir(idSuscripcion: string): void {
    this.observadores.delete(idSuscripcion);
  }

  /** Notifica a todos los observadores suscritos. */
  notificar(valor: ValorRuntime): void {
    this.observadores.forEach(({ puertoDestinoId, observador }) => {
      observador.alRecibirValor(puertoDestinoId, valor);
    });
  }

  /** Vacía todos los observadores. */
  limpiar(): void {
    this.observadores.clear();
  }
}

/**
 * Registrador central de sujetos por arista con soporte diferenciado para:
 * - CCH: canal continuo (nivel persistente modo push)
 * - DCH: canal discreto de eventos con cola FIFO acotada, consumo de 1 evento por paso y desbordamiento visible
 * - LCH: canal lógico de control (pulso booleano de un paso)
 * - Retardos de conexión (`delay` / `retardo_ms`) basados en reloj lógico sin bloqueo
 */
export class BusObserver {
  // Mapa topico (ej: 'nodo1/out-0') -> SujetoNodo
  private readonly sujetos = new Map<string, SujetoNodo>();
  private readonly colasDch = new Map<string, EstadoColaDch>();
  private readonly pulsosLchActivos = new Map<
    string,
    { destinoId: string; puertoDestinoId: string; destino: IElementoHiLeS }
  >();
  private readonly ultimoValorCchPorSuscripcion = new Map<
    string,
    ValorRuntime
  >();
  private readonly muestrasServicePorOrigen = new Map<string, ValorRuntime[]>();
  private entregasDiferidas: EntregaDiferidaCanal[] = [];
  private elementosRef: ReadonlyMap<string, IElementoHiLeS> = new Map();
  private relojActualMs = 0;

  private clavePuerto(destinoId: string, puertoDestinoId: string): string {
    return `${destinoId}::${puertoDestinoId}`;
  }

  private sonValoresIguales(
    a: ValorRuntime | undefined,
    b: ValorRuntime | undefined,
  ): boolean {
    if (Object.is(a, b)) return true;
    if (
      typeof a === 'object' &&
      a !== null &&
      typeof b === 'object' &&
      b !== null
    ) {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Registra una muestra discreta producida explícitamente en un Service durante el paso actual. */
  registrarMuestraService(servicioId: string, valor: ValorRuntime): void {
    const lista = this.muestrasServicePorOrigen.get(servicioId) ?? [];
    lista.push(valor);
    this.muestrasServicePorOrigen.set(servicioId, lista);
  }

  /** Actualiza la referencia de tiempo lógico del bus sin bloquear. */
  establecerRelojMs(relojMs: number): void {
    this.relojActualMs = relojMs;
  }

  obtenerRelojMs(): number {
    return this.relojActualMs;
  }

  /**
   * Inicia un paso de simulación en `relojMs`:
   * 1. Restablece la bandera de consumo único por paso de cada cola DCH.
   * 2. Ejecuta las entregas diferidas cuyo `venceEnMs <= relojMs`.
   * 3. Consume a lo sumo 1 evento pendiente (FIFO) de cada cola DCH que tenga eventos acumulados.
   */
  iniciarPaso(relojMs: number = this.relojActualMs): void {
    this.relojActualMs = relojMs;

    this.colasDch.forEach((estadoCola) => {
      estadoCola.consumidoEnPaso = false;
    });

    // Procesar entregas diferidas vencidas en orden FIFO de vencimiento
    if (this.entregasDiferidas.length > 0) {
      const vencidas: EntregaDiferidaCanal[] = [];
      const pendientes: EntregaDiferidaCanal[] = [];
      for (const item of this.entregasDiferidas) {
        if (item.venceEnMs <= this.relojActualMs) {
          vencidas.push(item);
        } else {
          pendientes.push(item);
        }
      }
      this.entregasDiferidas = pendientes;

      for (const entrega of vencidas) {
        const destino = this.elementosRef.get(entrega.destinoId);
        if (!destino) continue;
        this.entregarEnDestino(
          entrega.tipoCanal,
          entrega.destinoId,
          entrega.puertoDestinoId,
          destino,
          entrega.valor,
        );
      }
    }

    // Si alguna cola DCH aún tiene eventos pendientes de pasos previos y no ha consumido en este paso, consumir 1
    this.colasDch.forEach((estadoCola) => {
      if (!estadoCola.consumidoEnPaso && estadoCola.cola.length > 0) {
        const destino = this.elementosRef.get(estadoCola.destinoId);
        if (!destino) return;
        const siguienteEvento = estadoCola.cola.shift()!;
        estadoCola.consumidoEnPaso = true;
        destino.recibirEntrada(estadoCola.puertoDestinoId, siguienteEvento);
      }
    });
  }

  /**
   * Limpia los pulsos LCH transitorios y las muestras discretas ya emitidas al concluir el paso.
   */
  finalizarPaso(): void {
    this.pulsosLchActivos.forEach(({ destino, puertoDestinoId }) => {
      if (destino.tipo === 'TRANSITION') {
        destino.recibirEntrada(puertoDestinoId, false);
      }
    });
    this.pulsosLchActivos.clear();
    this.muestrasServicePorOrigen.clear();
  }

  /**
   * Encola explícitamente un evento en una cola DCH (útil para pruebas o inyección de ráfagas).
   */
  encolarEventoDch(
    destinoId: string,
    puertoDestinoId: string,
    valor: ValorRuntime,
    capacidad: number = CAPACIDAD_COLA_DCH_POR_DEFECTO,
  ): EstadoColaDch {
    const clave = this.clavePuerto(destinoId, puertoDestinoId);
    let estadoCola = this.colasDch.get(clave);
    if (!estadoCola) {
      estadoCola = {
        destinoId,
        puertoDestinoId,
        capacidad: Math.min(
          CAPACIDAD_COLA_DCH_MAXIMA,
          Math.max(1, Math.trunc(capacidad)),
        ),
        cola: [],
        desbordada: false,
        consumidoEnPaso: false,
      };
      this.colasDch.set(clave, estadoCola);
    }

    if (estadoCola.cola.length >= estadoCola.capacidad) {
      estadoCola.desbordada = true;
    } else {
      estadoCola.cola.push(valor);
    }
    return estadoCola;
  }

  obtenerEstadoColaDch(
    destinoId: string,
    puertoDestinoId?: string,
  ): EstadoColaDch | undefined {
    if (puertoDestinoId) {
      return this.colasDch.get(this.clavePuerto(destinoId, puertoDestinoId));
    }
    for (const estado of this.colasDch.values()) {
      if (estado.destinoId === destinoId) {
        return estado;
      }
    }
    return undefined;
  }

  obtenerTodasLasColasDch(): ReadonlyMap<string, EstadoColaDch> {
    return this.colasDch;
  }

  tieneEntregasDiferidasPendientes(nodoId?: string): boolean {
    if (!nodoId) {
      return this.entregasDiferidas.length > 0;
    }
    return this.entregasDiferidas.some(
      (e) => e.origenId === nodoId || e.destinoId === nodoId,
    );
  }

  obtenerEntregasDiferidas(): readonly EntregaDiferidaCanal[] {
    return this.entregasDiferidas;
  }

  tieneEventosDchPendientes(): boolean {
    for (const estado of this.colasDch.values()) {
      if (estado.cola.length > 0) return true;
    }
    return false;
  }

  private consumirPrimerEventoPendienteDch(
    estadoCola: EstadoColaDch,
    destino: IElementoHiLeS,
  ): void {
    if (!estadoCola.consumidoEnPaso && estadoCola.cola.length > 0) {
      const siguiente = estadoCola.cola.shift()!;
      estadoCola.consumidoEnPaso = true;
      destino.recibirEntrada(estadoCola.puertoDestinoId, siguiente);
    }
  }

  private entregarEnDestino(
    tipoCanal: 'cch' | 'dch' | 'lch',
    destinoId: string,
    puertoDestinoId: string,
    destino: IElementoHiLeS,
    valor: ValorRuntime,
  ): void {
    if (tipoCanal === 'dch') {
      const estadoCola = this.encolarEventoDch(
        destinoId,
        puertoDestinoId,
        valor,
      );
      this.consumirPrimerEventoPendienteDch(estadoCola, destino);
      return;
    }

    if (tipoCanal === 'lch') {
      const pulso = Boolean(valor);
      destino.recibirEntrada(puertoDestinoId, pulso);
      if (pulso) {
        this.pulsosLchActivos.set(this.clavePuerto(destinoId, puertoDestinoId), {
          destinoId,
          puertoDestinoId,
          destino,
        });
      }
      return;
    }

    // CCH (continuo)
    destino.recibirEntrada(puertoDestinoId, valor);
  }

  /**
   * Notifica a los observadores de un puerto de salida específico.
   */
  notificar(nodoId: string, puertoId: string, valor: ValorRuntime): void {
    const topico = `${nodoId}/${puertoId}`;
    const sujeto = this.sujetos.get(topico);
    if (sujeto) {
      sujeto.notificar(valor);
    }

    // Compatibilidad con modelos importados sin sourceHandle (suscritos a 'CUALQUIERA')
    const topicoGenerico = `${nodoId}/CUALQUIERA`;
    const sujetoGenerico = this.sujetos.get(topicoGenerico);
    if (sujetoGenerico) {
      sujetoGenerico.notificar(valor);
    }
  }

  /**
   * Construye los sujetos y suscribe los observadores según las aristas de datos del modelo.
   */
  construirDesdeAristas(
    aristas: readonly AristaHiLeS[],
    elementos: ReadonlyMap<string, IElementoHiLeS>,
    puertoEntradaPorDefecto?: (nodoId: string) => string | undefined,
  ): void {
    this.limpiar();
    this.elementosRef = elementos;

    aristas.forEach((arista) => {
      // Ignorar arcos Petri que mueven tokens; este bus transporta CCH, DCH y LCH
      if (!esAristaDatos(arista)) return;

      const destino = elementos.get(arista.target);
      if (!destino) return;

      const puertoDestinoId =
        arista.targetHandle ?? puertoEntradaPorDefecto?.(arista.target);
      if (!puertoDestinoId) return;

      const puertoOrigenId = arista.sourceHandle ?? 'CUALQUIERA';
      const topicoOrigen = `${arista.source}/${puertoOrigenId}`;

      const tipoCanalRaw = obtenerTipoCanalArista(arista);
      const tipoCanal: 'cch' | 'dch' | 'lch' =
        tipoCanalRaw === 'arco' ? 'cch' : tipoCanalRaw;

      const rawCap = (
        arista.data as { queueCapacity?: number; capacidad_cola?: number } | undefined
      )?.queueCapacity ??
        (
          arista.data as { queueCapacity?: number; capacidad_cola?: number } | undefined
        )?.capacidad_cola;
      const capacidadCola =
        typeof rawCap === 'number' && Number.isInteger(rawCap) && rawCap >= 1
          ? Math.min(CAPACIDAD_COLA_DCH_MAXIMA, rawCap)
          : CAPACIDAD_COLA_DCH_POR_DEFECTO;

      if (tipoCanal === 'dch' || arista.data?.hilesConnectionType === HilesConnectionType.DISCRETE) {
        const clave = this.clavePuerto(arista.target, puertoDestinoId);
        if (!this.colasDch.has(clave)) {
          this.colasDch.set(clave, {
            destinoId: arista.target,
            puertoDestinoId,
            capacidad: capacidadCola,
            cola: [],
            desbordada: false,
            consumidoEnPaso: false,
          });
        }
      }

      const retardoAristaRaw =
        arista.data?.delay ??
        (arista as unknown as { delay?: number; retardo_ms?: number }).delay ??
        (arista as unknown as { delay?: number; retardo_ms?: number }).retardo_ms ??
        0;
      const retardoMs =
        typeof retardoAristaRaw === 'number' &&
        Number.isFinite(retardoAristaRaw) &&
        retardoAristaRaw > 0
          ? Math.trunc(retardoAristaRaw)
          : 0;

      let sujeto = this.sujetos.get(topicoOrigen);
      if (!sujeto) {
        sujeto = new SujetoNodo();
        this.sujetos.set(topicoOrigen, sujeto);
      }

      const idSuscripcion = `${arista.id}-${arista.target}-${puertoDestinoId}`;
      const observadorAdaptado: IObservadorNodo = {
        alRecibirValor: (pDestinoId, valor) => {
          const origenEl = this.elementosRef.get(arista.source);
          if (
            origenEl?.tipo === 'SERVICE' &&
            (tipoCanal === 'dch' || tipoCanal === 'lch')
          ) {
            const muestras = this.muestrasServicePorOrigen.get(arista.source);
            if (!muestras || muestras.length === 0) {
              return;
            }
            if (retardoMs > 0) {
              for (const muestra of muestras) {
                this.entregasDiferidas.push({
                  idSuscripcion,
                  aristaId: arista.id,
                  origenId: arista.source,
                  puertoOrigenId,
                  destinoId: arista.target,
                  puertoDestinoId: pDestinoId,
                  tipoCanal,
                  valor: muestra,
                  venceEnMs: this.relojActualMs + retardoMs,
                });
              }
              return;
            }
            if (tipoCanal === 'dch') {
              let estadoCola: EstadoColaDch | undefined;
              for (const muestra of muestras) {
                estadoCola = this.encolarEventoDch(
                  arista.target,
                  pDestinoId,
                  muestra,
                  capacidadCola,
                );
              }
              if (estadoCola) {
                this.consumirPrimerEventoPendienteDch(estadoCola, destino);
              }
              return;
            }
            for (const muestra of muestras) {
              this.entregarEnDestino(
                tipoCanal,
                arista.target,
                pDestinoId,
                destino,
                muestra,
              );
            }
            return;
          }

          if (tipoCanal === 'cch') {
            const teniaValor =
              this.ultimoValorCchPorSuscripcion.has(idSuscripcion);
            const valorPrevio =
              this.ultimoValorCchPorSuscripcion.get(idSuscripcion);
            const sinCambio =
              teniaValor && this.sonValoresIguales(valorPrevio, valor);
            this.ultimoValorCchPorSuscripcion.set(idSuscripcion, valor);

            if (retardoMs > 0) {
              if (sinCambio) {
                return;
              }
              // Reemplazar entrega pendiente anterior en este CCH para no acumular copias
              this.entregasDiferidas = this.entregasDiferidas.filter(
                (e) => e.idSuscripcion !== idSuscripcion,
              );
              this.entregasDiferidas.push({
                idSuscripcion,
                aristaId: arista.id,
                origenId: arista.source,
                puertoOrigenId,
                destinoId: arista.target,
                puertoDestinoId: pDestinoId,
                tipoCanal,
                valor,
                venceEnMs: this.relojActualMs + retardoMs,
              });
              return;
            }

            this.entregarEnDestino(
              tipoCanal,
              arista.target,
              pDestinoId,
              destino,
              valor,
            );
            return;
          }

          if (retardoMs > 0) {
            this.entregasDiferidas.push({
              idSuscripcion,
              aristaId: arista.id,
              origenId: arista.source,
              puertoOrigenId,
              destinoId: arista.target,
              puertoDestinoId: pDestinoId,
              tipoCanal,
              valor,
              venceEnMs: this.relojActualMs + retardoMs,
            });
            return;
          }
          this.entregarEnDestino(
            tipoCanal,
            arista.target,
            pDestinoId,
            destino,
            valor,
          );
        },
      };

      sujeto.suscribir(idSuscripcion, puertoDestinoId, observadorAdaptado);
    });
  }

  /** Reinicia las colas DCH, pulsos LCH y entregas diferidas sin destruir las suscripciones. */
  reiniciarEstadoCanales(): void {
    this.colasDch.forEach((cola) => {
      cola.cola = [];
      cola.desbordada = false;
      cola.consumidoEnPaso = false;
    });
    this.pulsosLchActivos.clear();
    this.ultimoValorCchPorSuscripcion.clear();
    this.muestrasServicePorOrigen.clear();
    this.entregasDiferidas = [];
    this.relojActualMs = 0;
  }

  /** Destruye todos los sujetos y suscriptores. */
  limpiar(): void {
    this.sujetos.forEach((sujeto) => sujeto.limpiar());
    this.sujetos.clear();
    this.colasDch.clear();
    this.pulsosLchActivos.clear();
    this.ultimoValorCchPorSuscripcion.clear();
    this.muestrasServicePorOrigen.clear();
    this.entregasDiferidas = [];
    this.relojActualMs = 0;
  }
}
