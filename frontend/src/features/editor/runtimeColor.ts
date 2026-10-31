export const claseColorRuntime = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLocaleLowerCase('es');
  if (normalized === 'verde' || normalized === 'green') return 'is-verde';
  if (normalized === 'amarillo' || normalized === 'yellow') return 'is-amarillo';
  if (normalized === 'rojo' || normalized === 'red') return 'is-rojo';
  return '';
};
