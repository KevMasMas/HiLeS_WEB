import { describe, expect, it, vi } from 'vitest';
import { makePrefixedId, safeRandomUUID } from './uuid';

describe('uuid utilities', () => {
  it('uses a browser-safe fallback when crypto.randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { randomUUID: undefined });

    try {
      const value = safeRandomUUID();
      expect(typeof value).toBe('string');
      expect(value).toMatch(/^id-/);
      expect(makePrefixedId('web')).toMatch(/^web-/);
    } finally {
      vi.stubGlobal('crypto', originalCrypto);
    }
  });
});
