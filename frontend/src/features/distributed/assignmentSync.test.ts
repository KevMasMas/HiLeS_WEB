import { describe, expect, it } from 'vitest';
import type { HilesModelDocument } from '../../domain/modelDocument';
import {
  aplicarOperacionIncrementalADocumento,
  calcularOperacionesEntreDocumentos,
} from '../../services/projects/projectMessages';
import { crearEjemploMinimo } from '../onboarding/ejemploMinimo';
import { CLAVE_DESTINO, cambioDestino } from './assignments';

/** Simula `updateNodeProperties` sobre el documento serializado. */
const asignar = (documento: HilesModelDocument, nodoId: string, executorId: string | null): HilesModelDocument => {
  const copia = JSON.parse(JSON.stringify(documento)) as HilesModelDocument;
  const elemento = copia.allElements.find((item) => item.id === nodoId)!;
  // JSON elimina `undefined`, igual que la serialización del editor.
  elemento.properties = JSON.parse(JSON.stringify({ ...elemento.properties, ...cambioDestino(executorId) }));
  return copia;
};

describe('asignación colaborativa de ejecutores', () => {
  it('cambiar el destino produce una sola operación node.update', () => {
    const antes = crearEjemploMinimo();
    const despues = asignar(antes, 'ejemplo-sensor', 'pico:lab-1');
    const operaciones = calcularOperacionesEntreDocumentos(antes, despues);
    expect(operaciones).toHaveLength(1);
    expect(operaciones[0]).toMatchObject({ kind: 'node.update', elementId: 'ejemplo-sensor' });
  });

  it('aplicar la misma operación dos veces no duplica ni altera el resultado', () => {
    const antes = crearEjemploMinimo();
    const despues = asignar(antes, 'ejemplo-proceso', 'browser:abc');
    const [operacion] = calcularOperacionesEntreDocumentos(antes, despues);
    const una = aplicarOperacionIncrementalADocumento(antes, operacion);
    const dos = aplicarOperacionIncrementalADocumento(una, operacion);
    const destino = (documento: HilesModelDocument) =>
      (documento.allElements.find((item) => item.id === 'ejemplo-proceso')!.properties as Record<string, unknown>)[CLAVE_DESTINO];
    expect(destino(una)).toBe('browser:abc');
    expect(dos).toEqual(una);
    expect(calcularOperacionesEntreDocumentos(una, dos)).toEqual([]);
  });

  it('volver a «Sin asignar» elimina la propiedad con otra única operación', () => {
    const asignado = asignar(crearEjemploMinimo(), 'ejemplo-sensor', 'pico:lab-1');
    const libre = asignar(asignado, 'ejemplo-sensor', null);
    const operaciones = calcularOperacionesEntreDocumentos(asignado, libre);
    expect(operaciones).toHaveLength(1);
    const aplicado = aplicarOperacionIncrementalADocumento(asignado, operaciones[0]);
    expect((aplicado.allElements.find((item) => item.id === 'ejemplo-sensor')!.properties as Record<string, unknown>)[CLAVE_DESTINO]).toBeUndefined();
  });
});
