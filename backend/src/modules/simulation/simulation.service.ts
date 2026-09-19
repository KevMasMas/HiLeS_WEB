import { Injectable } from '@nestjs/common';

export interface SimulationEvent {
  /** Número consecutivo que usa la interfaz para conservar el orden de los eventos. */
  sequence: number;
  /** Canal o tópico HiLeS que produjo este evento. */
  topic: string;
  /** Dato booleano incluido sólo en publicaciones de entrada o salida. */
  payload?: boolean;
  /** Explicación legible que se muestra en el historial del frontend. */
  description: string;
  /** Fecha y hora ISO capturada al procesar este elemento de la cola. */
  publishedAt: string;
}

export interface DemoSimulationState {
  /** Valor recibido más recientemente desde el Service de entrada de la demo. */
  input: boolean;
  /** Valor publicado más recientemente hacia el Service de salida de la demo. */
  output: boolean;
  /** Marcado de los dos Place de la red de Petri de la demo. */
  places: {
    waiting: number;
    active: number;
  };
  queueDepth: number;
  events: SimulationEvent[];
}

interface QueuedPublication {
  /** Canales fijos del circuito demo: entrada, dos transiciones, confirmaciones y salida. */
  topic: 'tCCH1/send' | 'tLCH1' | 'tLCH2' | 'tLCH3' | 'tLCH4' | 'tCCH2/send';
  payload?: boolean;
}

@Injectable()
export class SimulationService {
  // Estado de ejecución del circuito demo fijo. Se conserva intencionalmente
  // en memoria: se reinicia al reiniciar el backend y no es un modelo guardado.
  private input = false;
  private output = false;
  // Un único token inicia en Espera. Los dos contadores forman el marcado de la
  // red de Petri y una transición nunca debe crear ni destruir un token.
  private waitingTokens = 1;
  private activeTokens = 0;
  private sequence = 0;
  // La cola FIFO permite que una publicación de entrada genere los siguientes
  // eventos lógicos y continuos en un orden determinista y observable.
  private readonly queue: QueuedPublication[] = [];
  private readonly history: SimulationEvent[] = [];

  /** Devuelve el marcado actual y el historial reciente sin cambiar el estado. */
  getState(): DemoSimulationState {
    return this.snapshot(this.history.slice(-12));
  }

  /** Restaura el marcado inicial: Espera tiene un token y la salida está en OFF. */
  reset(): DemoSimulationState {
    this.input = false;
    this.output = false;
    this.waitingTokens = 1;
    this.activeTokens = 0;
    this.sequence = 0;
    this.queue.length = 0;
    this.history.length = 0;
    return this.snapshot([]);
  }

  publishInput(value: boolean): DemoSimulationState {
    // cycleEvents contiene sólo los eventos de esta llamada al botón o API;
    // history conserva la línea de tiempo reciente disponible mediante getState.
    const cycleEvents: SimulationEvent[] = [];
    // CCH1 es el canal continuo desde el Service de entrada hacia el circuito.
    this.queue.push({ topic: 'tCCH1/send', payload: value });

    // Procesa publicaciones en orden FIFO. process() puede agregar elementos,
    // así que el ciclo continúa hasta que termina toda la reacción del circuito.
    while (this.queue.length > 0) {
      const publication = this.queue.shift();
      if (!publication) break;
      const event = this.process(publication);
      this.history.push(event);
      cycleEvents.push(event);
    }

    // Limita el uso de memoria, conservando suficiente contexto para el historial.
    if (this.history.length > 40) this.history.splice(0, this.history.length - 40);
    return this.snapshot(cycleEvents);
  }

  /** Ejecuta una publicación en cola y devuelve su evento de auditoría visible. */
  private process(publication: QueuedPublication): SimulationEvent {
    let description = '';

    switch (publication.topic) {
      case 'tCCH1/send':
        // Normaliza la publicación: sólo el booleano true enciende la entrada
        // de la demo. La entrada selecciona una de las dos transiciones Petri.
        this.input = publication.payload === true;
        this.queue.push({ topic: this.input ? 'tLCH1' : 'tLCH3' });
        description = `Entrada recibida: ${this.input ? '1' : '0'}.`;
        break;
      case 'tLCH1':
        // T1 sólo puede disparar si su Place de entrada (Espera) tiene el token.
        if (this.waitingTokens > 0) {
          // Dispara T1 de forma atómica: consume de Espera y produce en Activo.
          this.waitingTokens -= 1;
          this.activeTokens += 1;
          // Confirma el arco lógico y publica el valor de salida resultante.
          this.queue.push({ topic: 'tLCH2' }, { topic: 'tCCH2/send', payload: true });
          description = 'T1 disparó y movió el token hacia Activo.';
        } else {
          description = 'T1 evaluó la entrada; el token ya estaba en Activo.';
        }
        break;
      case 'tLCH2':
        // Es un evento de auditoría del arco Petri; el movimiento del token ya
        // ocurrió cuando T1 se disparó.
        description = 'El arco lógico confirmó el token en Activo.';
        break;
      case 'tLCH3':
        // T2 es la transición inversa y requiere el token en Activo.
        if (this.activeTokens > 0) {
          // Dispara T2 de forma atómica: consume de Activo y vuelve a Espera.
          this.activeTokens -= 1;
          this.waitingTokens += 1;
          // Confirma el arco lógico y publica el valor de salida OFF.
          this.queue.push({ topic: 'tLCH4' }, { topic: 'tCCH2/send', payload: false });
          description = 'T2 disparó y devolvió el token a Espera.';
        } else {
          description = 'T2 evaluó la entrada; el token ya estaba en Espera.';
        }
        break;
      case 'tLCH4':
        // Como tLCH2, registra una confirmación sin mover otro token.
        description = 'El arco lógico confirmó el token en Espera.';
        break;
      case 'tCCH2/send':
        // CCH2 es el canal continuo desde la acción de transición hasta Salida.
        this.output = publication.payload === true;
        description = `Salida publicada: ${this.output ? '1' : '0'}.`;
        break;
    }

    return {
      // Incrementa antes de asignar, para que la primera publicación sea el evento #1.
      sequence: ++this.sequence,
      topic: publication.topic,
      ...(publication.payload === undefined ? {} : { payload: publication.payload }),
      description,
      publishedAt: new Date().toISOString(),
    };
  }

  private snapshot(events: SimulationEvent[]): DemoSimulationState {
    return {
      input: this.input,
      output: this.output,
      places: { waiting: this.waitingTokens, active: this.activeTokens },
      // publishInput normalmente termina con cero pendientes; exponerlo permite
      // ver trabajo pendiente si el procesamiento de la cola cambia en el futuro.
      queueDepth: this.queue.length,
      events,
    };
  }
}
