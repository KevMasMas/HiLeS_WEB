import { esAristaDatos } from './GrafoDatos';
import type { AristaHiLeS, ValorRuntime } from './tipos';
import type { IElementoHiLeS } from './elementos/interfaces';

/** Contrato que debe cumplir cualquier nodo que quiera recibir notificaciones. */
export interface IObservadorNodo {
  /** Llamado cuando el sujeto al que está suscrito publica un valor. */
  alRecibirValor(puertoDestinoId: string, valor: ValorRuntime): void;
}

/**
 * Sujeto del patrón Observer.
 * Cada instancia representa un puerto de salida de un nodo.
 * Mantiene la lista de observadores suscritos y los notifica al publicar.
 */
export class SujetoNodo {
  // Mapa de idSuscripcion -> { puertoDestinoId, observador }
  private readonly observadores = new Map<string, { puertoDestinoId: string; observador: IObservadorNodo }>();

  /** Registra un observador para que reciba notificaciones en el puerto indicado. */
  suscribir(idSuscripcion: string, puertoDestinoId: string, observador: IObservadorNodo): void {
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
 * Registrador central de sujetos por arista.
 * Lo posee MotorSimulacion (no es global).
 * Al construir el grafo, crea un SujetoNodo por cada puerto de salida
 * con conexiones y suscribe a los nodos destino como observadores.
 */
export class BusObserver {
  // Mapa topico (ej: 'nodo1/out-0') -> SujetoNodo
  private readonly sujetos = new Map<string, SujetoNodo>();

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
    puertoEntradaPorDefecto?: (nodoId: string) => string | undefined
  ): void {
    this.limpiar();

    aristas.forEach((arista) => {
      // Ignorar arcos Petri, este bus es solo para transporte de datos CCH/DCH
      if (!esAristaDatos(arista)) return;

      const destino = elementos.get(arista.target);
      if (!destino) return;

      const puertoDestinoId = arista.targetHandle ?? puertoEntradaPorDefecto?.(arista.target);
      if (!puertoDestinoId) return;

      const puertoOrigenId = arista.sourceHandle ?? 'CUALQUIERA';
      const topicoOrigen = `${arista.source}/${puertoOrigenId}`;

      let sujeto = this.sujetos.get(topicoOrigen);
      if (!sujeto) {
        sujeto = new SujetoNodo();
        this.sujetos.set(topicoOrigen, sujeto);
      }

      // Creamos un adaptador IObservadorNodo que delega en el método del elemento original
      const observadorAdaptado: IObservadorNodo = {
        alRecibirValor: (pDestinoId, valor) => {
          destino.recibirEntrada(pDestinoId, valor);
        }
      };

      const idSuscripcion = `${arista.id}-${arista.target}-${puertoDestinoId}`;
      sujeto.suscribir(idSuscripcion, puertoDestinoId, observadorAdaptado);
    });
  }

  /** Destruye todos los sujetos y suscriptores. */
  limpiar(): void {
    this.sujetos.forEach((sujeto) => sujeto.limpiar());
    this.sujetos.clear();
  }
}
