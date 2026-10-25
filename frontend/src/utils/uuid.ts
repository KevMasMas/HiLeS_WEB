export const safeRandomUUID = (): string => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const makePrefixedId = (prefix: string): string => `${prefix}-${safeRandomUUID()}`;
