import marcaHiles from './hiles-mark.svg';

/**
 * Identidad visual de HiLeS Web (Persona 3, entrega 7). Los colores se
 * replican como variables CSS en `features/editor/editor.css`.
 */
export const MARCA = {
  nombre: 'HiLeS',
  subtitulo: 'Modelado y ejecución distribuida',
  logo: marcaHiles,
};

export const PALETA = {
  tinta: '#0f172a',
  superficie: '#ffffff',
  fondo: '#f8fafc',
  primario: '#2563eb',
  acento: '#22d3ee',
  exito: '#16a34a',
  advertencia: '#d97706',
  error: '#dc2626',
  neutro: '#64748b',
} as const;
