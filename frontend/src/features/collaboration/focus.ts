import { useEditorStore } from '../../stores/useEditorStore';

/** Evento que el canvas escucha para centrar la vista en un elemento. */
export const EVENTO_ENFOCAR_ELEMENTO = 'hiles:enfocar-elemento';

export interface DetalleEnfocarElemento {
  id: string;
  seleccionar: boolean;
}

/**
 * Centra la vista en un nodo. Con `seleccionar` también lo marca como
 * seleccionado localmente (al seguir a otra persona no se cambia la selección
 * propia para no alterar lo que este usuario está editando).
 */
export const enfocarElemento = (id: string, seleccionar = false): boolean => {
  const existe = useEditorStore.getState().nodes.some((nodo) => nodo.id === id);
  if (!existe) return false;
  if (seleccionar) useEditorStore.getState().setSelectedElement(id);
  window.dispatchEvent(new CustomEvent<DetalleEnfocarElemento>(EVENTO_ENFOCAR_ELEMENTO, { detail: { id, seleccionar } }));
  return true;
};
