import { useEditorStore } from '../../stores/useEditorStore';
import { crearEjemploMinimo } from './ejemploMinimo';
import { CLAVE_TUTORIAL_COMPLETADO } from './tutorialSteps';

export const tutorialCompletado = (): boolean => {
  try {
    return localStorage.getItem(CLAVE_TUTORIAL_COMPLETADO) === '1';
  } catch {
    return false;
  }
};

export const marcarCompletado = (): void => {
  try {
    localStorage.setItem(CLAVE_TUTORIAL_COMPLETADO, '1');
  } catch {
    // Sin almacenamiento local el tutorial se puede volver a abrir desde Ayuda.
  }
};

export const cargarEjemploMinimo = (): void => {
  useEditorStore.getState().importModel(JSON.stringify(crearEjemploMinimo()));
};
