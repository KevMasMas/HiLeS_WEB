import { create } from 'zustand';

interface FollowState {
  /** `clientId` del colaborador seguido o `null`. */
  siguiendo: string | null;
  seguir: (clientId: string | null) => void;
}

/** Estado local: seguir a alguien nunca se publica ni cambia el documento. */
export const useFollowStore = create<FollowState>((set) => ({
  siguiendo: null,
  seguir: (clientId) => set({ siguiendo: clientId }),
}));
