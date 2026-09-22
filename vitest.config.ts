// Unit tests (`pnpm test` → `vitest run`; CI runs it between Lint and the CSS check). Deliberately NOT vite.config.ts:
// that config bakes every chunk's terrain / sky at load, which a test run must not pay for (or depend on).
// Tests live in test/ (outside src/, so no `import.meta.glob` in the game can ever pull one into the bundle) and run
// in plain node: the few browser globals the pure modules touch (localStorage, location) are stubbed in test/setup.ts.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    restoreMocks: true,
  },
});
