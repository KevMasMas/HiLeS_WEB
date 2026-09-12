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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const DEMO_URL = `${API_BASE_URL}/api/simulations/demo`;

const readResponse = async (response: Response): Promise<DemoSimulationState> => {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `Backend request failed (${response.status}).`);
  }
  return response.json() as Promise<DemoSimulationState>;
};

export const getDemoState = async () => readResponse(await fetch(DEMO_URL));

export const publishDemoInput = async (value: boolean) => readResponse(await fetch(`${DEMO_URL}/input`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value }),
}));

export const resetDemo = async () => readResponse(await fetch(`${DEMO_URL}/reset`, { method: 'POST' }));
