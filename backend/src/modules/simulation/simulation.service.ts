import { Injectable } from '@nestjs/common';

export interface SimulationEvent {
  sequence: number;
  topic: string;
  payload?: boolean;
  description: string;
  publishedAt: string;
}

export interface DemoSimulationState {
  input: boolean;
  output: boolean;
  places: {
    waiting: number;
    active: number;
  };
  queueDepth: number;
  events: SimulationEvent[];
}

interface QueuedPublication {
  topic: 'tCCH1/send' | 'tLCH1' | 'tLCH2' | 'tLCH3' | 'tLCH4' | 'tCCH2/send';
  payload?: boolean;
}

@Injectable()
export class SimulationService {
  private input = false;
  private output = false;
  private waitingTokens = 1;
  private activeTokens = 0;
  private sequence = 0;
  private readonly queue: QueuedPublication[] = [];
  private readonly history: SimulationEvent[] = [];

  getState(): DemoSimulationState {
    return this.snapshot(this.history.slice(-12));
  }

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
    const cycleEvents: SimulationEvent[] = [];
    this.queue.push({ topic: 'tCCH1/send', payload: value });

    while (this.queue.length > 0) {
      const publication = this.queue.shift();
      if (!publication) break;
      const event = this.process(publication);
      this.history.push(event);
      cycleEvents.push(event);
    }

    if (this.history.length > 40) this.history.splice(0, this.history.length - 40);
    return this.snapshot(cycleEvents);
  }

  private process(publication: QueuedPublication): SimulationEvent {
    let description = '';

    switch (publication.topic) {
      case 'tCCH1/send':
        this.input = publication.payload === true;
        this.queue.push({ topic: this.input ? 'tLCH1' : 'tLCH3' });
        description = `Entrada recibida: ${this.input ? '1' : '0'}.`;
        break;
      case 'tLCH1':
        if (this.waitingTokens > 0) {
          this.waitingTokens -= 1;
          this.activeTokens += 1;
          this.queue.push({ topic: 'tLCH2' }, { topic: 'tCCH2/send', payload: true });
          description = 'T1 disparó y movió el token hacia Activo.';
        } else {
          description = 'T1 evaluó la entrada; el token ya estaba en Activo.';
        }
        break;
      case 'tLCH2':
        description = 'El arco lógico confirmó el token en Activo.';
        break;
      case 'tLCH3':
        if (this.activeTokens > 0) {
          this.activeTokens -= 1;
          this.waitingTokens += 1;
          this.queue.push({ topic: 'tLCH4' }, { topic: 'tCCH2/send', payload: false });
          description = 'T2 disparó y devolvió el token a Espera.';
        } else {
          description = 'T2 evaluó la entrada; el token ya estaba en Espera.';
        }
        break;
      case 'tLCH4':
        description = 'El arco lógico confirmó el token en Espera.';
        break;
      case 'tCCH2/send':
        this.output = publication.payload === true;
        description = `Salida publicada: ${this.output ? '1' : '0'}.`;
        break;
    }

    return {
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
      queueDepth: this.queue.length,
      events,
    };
  }
}
