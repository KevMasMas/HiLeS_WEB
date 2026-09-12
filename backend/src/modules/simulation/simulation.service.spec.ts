import { SimulationService } from './simulation.service.js';

describe('SimulationService', () => {
  let service: SimulationService;

  beforeEach(() => {
    service = new SimulationService();
  });

  it('starts with one token in Espera and a false output', () => {
    expect(service.getState()).toMatchObject({
      input: false,
      output: false,
      places: { waiting: 1, active: 0 },
      queueDepth: 0,
    });
  });

  it('moves the token to Activo and publishes true through the queue', () => {
    const state = service.publishInput(true);

    expect(state).toMatchObject({
      input: true,
      output: true,
      places: { waiting: 0, active: 1 },
      queueDepth: 0,
    });
    expect(state.events.map((event) => event.topic)).toEqual([
      'tCCH1/send',
      'tLCH1',
      'tLCH2',
      'tCCH2/send',
    ]);
  });

  it('returns the token to Espera when the input becomes false', () => {
    service.publishInput(true);
    const state = service.publishInput(false);

    expect(state).toMatchObject({
      input: false,
      output: false,
      places: { waiting: 1, active: 0 },
      queueDepth: 0,
    });
    expect(state.events.map((event) => event.topic)).toEqual([
      'tCCH1/send',
      'tLCH3',
      'tLCH4',
      'tCCH2/send',
    ]);
  });

  it('does not duplicate tokens when the same input is sent twice', () => {
    service.publishInput(true);
    const state = service.publishInput(true);

    expect(state.places).toEqual({ waiting: 0, active: 1 });
    expect(state.output).toBe(true);
    expect(state.events).toHaveLength(2);
  });
});
