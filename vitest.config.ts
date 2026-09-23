// Unit tests (`pnpm test` → `vitest run`; CI runs it between Lint and the CSS check). Deliberately NOT vite.config.ts:
// that config bakes every chunk's terrain / sky at load, which a test run must not pay for (or depend on).
// Tests live in test/ (outside src/, so no `import.meta.glob` in the game can ever pull one into the bundle) and run
// in plain node: the few browser globals the pure modules touch (localStorage, location) are stubbed in test/setup.ts.
import { defineConfig } from 'vitest/config';
import { rapierAlias } from './vite/rapier';

export default defineConfig({
  resolve: { alias: rapierAlias }, // Rapier's wasm-importing module → plain bindings; tests hand loadRapier() the binary
  assetsInclude: ['**/*.bin', '**/*.wasm'], // `?inline` of a baked terrain.bin and Rapier's binary (test/physics-terrain.test.ts)
  test: {
    include: ['test/**/*.test.ts', 'api/**/*.test.ts'], // api/ tests run in node against api/tsconfig.json
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    restoreMocks: true,
  },
});
