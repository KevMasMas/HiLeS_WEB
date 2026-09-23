import { HilesElementType } from '../../types/hiles';
import type { HilesNodeProperties, HilesPort } from '../../types/hiles';
import { ElementoLugar } from './ElementoLugar';
import { ElementoTransicion } from './ElementoTransicion';
import { ElementoBloqueEstructural } from './ElementoBloqueEstructural';
import { ElementoBloqueFuncional } from './ElementoBloqueFuncional';
import { ElementoMuestreo } from './ElementoMuestreo';
import { ElementoRetencion } from './ElementoRetencion';
import { ElementoService } from './ElementoService';
import type { IElementoHiLeS } from './interfaces';

export * from './ElementoLugar';
export * from './ElementoTransicion';
export * from './ElementoBloqueEstructural';
export * from './ElementoBloqueFuncional';
export * from './ElementoMuestreo';
export * from './ElementoRetencion';
export * from './ElementoService';
export type * from './interfaces';

export interface ConfiguracionElemento {
  properties?: Partial<HilesNodeProperties>;
  ports?: readonly HilesPort[];
}

export type FabricaElemento = (configuracion: ConfiguracionElemento) => IElementoHiLeS;

const fabricasAdicionales = new Map<HilesElementType, FabricaElemento>();

/**
 * Permite que los responsables de los demás elementos registren su fábrica
 * sin acoplar este módulo a archivos que todavía no han sido implementados.
 */
export const registrarFabricaElemento = (tipo: HilesElementType, fabrica: FabricaElemento): void => {
  if (tipo === HilesElementType.PLACE || tipo === HilesElementType.TRANSITION) {
    throw new Error(`La fábrica base de ${tipo} no puede reemplazarse.`);
  }
  fabricasAdicionales.set(tipo, fabrica);
};

/** Crea la implementación lógica correspondiente a un nodo del editor. */
export const crearElemento = (
  tipo: HilesElementType,
  configuracion: ConfiguracionElemento = {},
): IElementoHiLeS => {
  const properties = configuracion.properties ?? {};

  if (tipo === HilesElementType.PLACE) {
    return new ElementoLugar({
      tokensIniciales: properties.tokens,
      maxTokens: properties.maxTokens,
    });
  }

  if (tipo === HilesElementType.TRANSITION) {
    const puertoCondicion = configuracion.ports?.find((puerto) =>
      puerto.direction === 'input' && puerto.nature === 'control');
    const puertoAccion = configuracion.ports?.find((puerto) =>
      puerto.direction === 'output' && puerto.nature === 'control');
    return new ElementoTransicion({
      habilitada: properties.enabled,
      puertoCondicionId: puertoCondicion?.id,
      puertoAccionId: puertoAccion?.id,
    });
  }

  const fabrica = fabricasAdicionales.get(tipo);
  if (fabrica) return fabrica(configuracion);
  throw new Error(`El elemento ${tipo} todavía no tiene una fábrica registrada.`);
};

// Registro explícito para mantener el motor desacoplado de las clases concretas.
registrarFabricaElemento(HilesElementType.SERVICE, (configuracion) => new ElementoService(configuracion));
registrarFabricaElemento(HilesElementType.FUNCTIONAL_BLOCK, (configuracion) => new ElementoBloqueFuncional(configuracion));
registrarFabricaElemento(HilesElementType.SAMPLE, (configuracion) => new ElementoMuestreo(configuracion));
registrarFabricaElemento(HilesElementType.HOLD, (configuracion) => new ElementoRetencion(configuracion));
registrarFabricaElemento(HilesElementType.STRUCTURAL_BLOCK, (configuracion) => new ElementoBloqueEstructural(configuracion));
