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

export const BACKEND_OFFLINE_MESSAGE = 'Backend desconectado. Abre una terminal en backend/ y ejecuta "npm run start:dev" (puerto 3000).';

/** The dev proxy answers with these codes, in plain text, when Nest is not listening. */
const GATEWAY_ERRORS = new Set([502, 503, 504]);

const request = async (url: string, init?: RequestInit): Promise<DemoSimulationState> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // fetch only rejects when the request never reached a server.
    throw new Error(BACKEND_OFFLINE_MESSAGE);
  }
  if (GATEWAY_ERRORS.has(response.status)) throw new Error(BACKEND_OFFLINE_MESSAGE);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? `El backend respondió ${response.status}. Revisa la terminal de Nest.`);
  }
  return response.json() as Promise<DemoSimulationState>;
};

export const getDemoState = async () => request(DEMO_URL);

export const publishDemoInput = async (value: boolean) => request(`${DEMO_URL}/input`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value }),
});

export const resetDemo = async () => request(`${DEMO_URL}/reset`, { method: 'POST' });
