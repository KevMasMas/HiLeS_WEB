import { describe, expect, it } from 'vitest';
import { MotorFragmentoNavegador } from '../../services/distributed/BrowserWorker';
import type {
  FragmentoDespliegueV3,
  RutaRemotaV3,
} from '../../services/ir/tiposIrDistribuida';
import type {
  IrElementoV2,
  IrModeloV2,
  IrValorRuntimeV2,
} from '../../services/ir';

const projectId = 'conformidad-browser-browser';
const deploymentId = 'deploy-conformidad-browser-browser';

const modelo = (
  id: string,
  elementos: IrElementoV2[],
  conexiones: IrModeloV2['conexiones'] = [],
): IrModeloV2 => ({
  ir_version: 2,
  modelo_id: id,
  version: 1,
  nombre: id,
  metadata: {
    documento_schema_version: 2,
    compilado_en: '2026-11-06T09:00:00.000-05:00',
    bloque_raiz_id: null,
  },
  entradas_externas: elementos
    .filter((elemento) => elemento.tipo === 'service')
    .map((elemento) => ({
      elemento_id: elemento.id,
      nombre: elemento.nombre,
      puerto_salida: elemento.tipo === 'service' ? elemento.salidas[0] : 'out',
      tipo_dato: elemento.tipo === 'service' ? elemento.tipo_dato : 'integer',
    })),
  elementos,
  conexiones,
});

const service = (tipoDato: 'boolean' | 'integer'): IrElementoV2 => ({
  id: 'source',
  tipo: 'service',
  nombre: 'Source',
  tipo_dato: tipoDato,
  salidas: ['out'],
  entradas: [],
});

const ruta = (
  tipo: 'cch' | 'dch' | 'lch',
  destino: string,
  puertoDestino: string,
): RutaRemotaV3 => ({
  connection_id: `remote-${tipo}`,
  tipo,
  tipo_dato: tipo === 'lch' ? 'boolean' : 'integer',
  source_element_id: 'source',
  source_port_id: 'out',
  source_executor_id: 'browser:source',
  target_element_id: destino,
  target_port_id: puertoDestino,
  target_executor_id: 'browser:target',
  topic: `udfjc/hiles/v3/projects/${projectId}/deployments/${deploymentId}/channels/remote-${tipo}`,
  qos: 1,
  retain: false,
  ...(tipo === 'dch' ? { capacidad_cola: 2 } : {}),
});

const fragmento = (
  executorId: string,
  modeloFragmento: IrModeloV2,
  inbound: RutaRemotaV3[],
  outbound: RutaRemotaV3[],
): FragmentoDespliegueV3 => ({
  protocol_version: 3,
  project_id: projectId,
  deployment_id: deploymentId,
  epoch: 1,
  fragment_id: `${deploymentId}:${executorId}`,
  executor_id: executorId,
  owner_executor_id: executorId,
  modelo: modeloFragmento,
  inbound_routes: inbound,
  outbound_routes: outbound,
});

const crearPar = (
  canal: RutaRemotaV3,
  elementosDestino: IrElementoV2[],
  conexionesDestino: IrModeloV2['conexiones'] = [],
) => {
  const entregas: IrValorRuntimeV2[] = [];
  const emisor = new MotorFragmentoNavegador(
    fragmento(
      'browser:source',
      modelo(`source-${canal.tipo}`, [service(canal.tipo === 'lch' ? 'boolean' : 'integer')]),
      [],
      [canal],
    ),
    (_ruta, valor) => {
      entregas.push(valor);
      receptor.inyectarRemoto(canal.connection_id, valor);
    },
  );
  const receptor = new MotorFragmentoNavegador(
    fragmento(
      'browser:target',
      modelo(`target-${canal.tipo}`, elementosDestino, conexionesDestino),
      [canal],
      [],
    ),
    () => undefined,
  );
  return { emisor, receptor, entregas };
};

const hold: IrElementoV2 = {
  id: 'hold',
  tipo: 'hold',
  nombre: 'Hold',
  habilitado: true,
  tipo_dato: 'integer',
  puerto_entrada: 'in',
  puerto_cch: 'out',
  puerto_lch: 'event',
};

describe('Conformidad Browser ↔ Browser por canales remotos', () => {
  it('CCH conserva el último valor y no lo publica de nuevo sin cambios', async () => {
    const canal = ruta('cch', 'hold', 'in');
    const { emisor, receptor, entregas } = crearPar(canal, [hold]);

    emisor.establecerEntrada('source', 10);
    emisor.establecerEntrada('source', 20);
    await emisor.paso(0);
    await receptor.paso(0);

    expect(entregas).toEqual([20]);
    expect(receptor.snapshot()).toEqual({
      hold: { valor_retenido: 20, salida: 20, evento_pendiente: true },
    });

    await emisor.paso(0);
    expect(entregas).toEqual([20]);
  });

  it('DCH conserva FIFO, capacidad y un evento por paso', async () => {
    const canal = ruta('dch', 'hold', 'in');
    const { emisor, receptor, entregas } = crearPar(canal, [hold]);

    emisor.establecerEntrada('source', 5);
    emisor.establecerEntrada('source', 6);
    await emisor.paso(0);
    expect(entregas).toEqual([5, 6]);

    await receptor.paso(0);
    expect(receptor.snapshot()).toEqual({
      hold: {
        valor_retenido: 5,
        salida: 5,
        evento_pendiente: true,
        cola_dch: 1,
      },
    });
    await receptor.paso(0);
    expect(receptor.snapshot()).toEqual({
      hold: { valor_retenido: 6, salida: 6, evento_pendiente: true },
    });
    await receptor.paso(0);
    expect(receptor.snapshot()).toEqual({
      hold: { valor_retenido: 6, salida: 6, evento_pendiente: false },
    });
  });

  it('LCH dispara una sola vez la red Petri local del receptor', async () => {
    const canal = ruta('lch', 'transition', 'condition');
    const elementosDestino: IrElementoV2[] = [
      { id: 'start', tipo: 'place', nombre: 'Start', tokens: 1, capacidad: 1 },
      {
        id: 'transition',
        tipo: 'transition',
        nombre: 'Transition',
        habilitada: true,
        puerto_condicion: 'condition',
        puerto_accion: 'action',
      },
      { id: 'end', tipo: 'place', nombre: 'End', tokens: 0, capacidad: 1 },
    ];
    const conexiones: IrModeloV2['conexiones'] = [
      { id: 'arc-in', tipo: 'arco', origen: 'start', destino: 'transition', peso: 1 },
      { id: 'arc-out', tipo: 'arco', origen: 'transition', destino: 'end', peso: 1 },
    ];
    const { emisor, receptor, entregas } = crearPar(
      canal,
      elementosDestino,
      conexiones,
    );

    emisor.establecerEntrada('source', true);
    await emisor.paso(0);
    await receptor.paso(0);

    expect(entregas).toEqual([true]);
    expect(receptor.snapshot()).toEqual({
      start: { tokens: 0 },
      transition: { habilitada: false, disparada: true },
      end: { tokens: 1 },
    });

    await receptor.paso(0);
    expect(receptor.snapshot()).toEqual({
      start: { tokens: 0 },
      transition: { habilitada: false, disparada: false },
      end: { tokens: 1 },
    });
  });
});
