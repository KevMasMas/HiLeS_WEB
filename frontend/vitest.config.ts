import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/engine/__tests__/**/*.test.ts', 'src/services/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
