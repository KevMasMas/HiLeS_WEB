import type { PlanAsignacionDespliegueV3, TipoEjecutorV3 } from '../ir/tiposIrDistribuida';

export interface FixtureDistribucionV3 {
  nombre: string;
  project_id: string;
  deployment_id: string;
  epoch: number;
  ejecutores: Array<{ executor_id: string; tipo: TipoEjecutorV3 }>;
  plan: PlanAsignacionDespliegueV3;
  expected_fragment_count: number;
  expected_remote_route_count: number;
}

/**
 * Escenarios congelados para las pruebas de los workers. Los IDs corresponden al
 * modelo de cuatro elementos usado por `particionarIr.test.ts`.
 */
export const fixturesDistribucionV3: FixtureDistribucionV3[] = [
  {
    nombre: 'dos ejecutores: Pico y navegador',
    project_id: 'fixture-v3-2',
    deployment_id: 'deploy-2',
    epoch: 1,
    ejecutores: [
      { executor_id: 'pico:a', tipo: 'pico' },
      { executor_id: 'browser:b', tipo: 'browser' },
    ],
    plan: {
      structural_blocks: {
        'block-a': 'pico:a',
        'block-c': 'browser:b',
        'block-d': 'browser:b',
      },
    },
    expected_fragment_count: 2,
    expected_remote_route_count: 1,
  },
  {
    nombre: 'tres ejecutores: Pico y dos navegadores',
    project_id: 'fixture-v3-3',
    deployment_id: 'deploy-3',
    epoch: 1,
    ejecutores: [
      { executor_id: 'pico:a', tipo: 'pico' },
      { executor_id: 'browser:b', tipo: 'browser' },
      { executor_id: 'browser:c', tipo: 'browser' },
    ],
    plan: {
      structural_blocks: {
        'block-a': 'pico:a',
        'block-c': 'browser:b',
        'block-d': 'browser:c',
      },
    },
    expected_fragment_count: 3,
    expected_remote_route_count: 2,
  },
  {
    nombre: 'cuatro ejecutores con override del Functional Block',
    project_id: 'fixture-v3-4',
    deployment_id: 'deploy-4',
    epoch: 1,
    ejecutores: [
      { executor_id: 'pico:a', tipo: 'pico' },
      { executor_id: 'browser:b', tipo: 'browser' },
      { executor_id: 'browser:c', tipo: 'browser' },
      { executor_id: 'pico:d', tipo: 'pico' },
    ],
    plan: {
      structural_blocks: {
        'block-a': 'pico:a',
        'block-c': 'browser:c',
        'block-d': 'pico:d',
      },
      functional_blocks: { 'fb-b': 'browser:b' },
    },
    expected_fragment_count: 4,
    expected_remote_route_count: 3,
  },
];
