/** Resume de forma legible el estado público reportado por un ejecutor para un elemento. */
export const resumirEstadoElemento = (estado: Record<string, unknown> | null): string => {
  if (!estado) return 'sin datos';
  const partes: string[] = [];
  const valor = estado.valor ?? estado.salida ?? estado.valor_retenido;
  if (valor !== undefined) partes.push(`valor ${JSON.stringify(valor)}`);
  if (typeof estado.tokens === 'number') partes.push(`${estado.tokens} token(s)`);
  if (estado.disparada === true) partes.push('disparó');
  if (estado.habilitada === true) partes.push('habilitada');
  if (estado.evento_pendiente === true) partes.push('evento');
  if (typeof estado.error === 'string') partes.push(`error ${estado.error}`);
  return partes.join(' · ') || 'en reposo';
};
