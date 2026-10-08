// Unit tests (`pnpm test` → `vitest run`; CI runs it between Lint and the CSS check). Deliberately NOT vite.config.ts:
// that config bakes every chunk's terrain / sky at load, which a test run must not pay for (or depend on).
// Tests live in test/ (outside src/, so no `import.meta.glob` in the game can ever pull one into the bundle) and run
// in plain node: the few browser globals the pure modules touch (localStorage, location) are stubbed in test/setup.ts.
import { defineConfig } from 'vitest/config';
import { rapierAlias } from './vite/rapier';

export const HEAVY_INTEGRATION_TESTS = [
  'test/live-grid.test.ts',
  'test/sdk-repo-build.test.ts',
  'test/template-copy-scaffold.test.ts',
];

export default defineConfig({
  // Rapier's wasm-importing module → plain bindings; tests hand loadRapier() the binary. (A test reaches a layer's
  // internals by its relative path; src imports only the @wildshard/* packages' exports, E432.)
  resolve: { alias: rapierAlias },
  assetsInclude: ['**/*.bin', '**/*.wasm'], // `?inline` of a baked terrain.bin and Rapier's binary (test/physics-terrain.test.ts)
  test: {
    // 2026-10-03: under coverage on the CI runner, tests that parse every shard (gen-shards AG10, gen-budget-derivations)
    // ran past vitest's 5 s default and failed main's runs one after another (each passes in ~2 s locally); 20 s is the floor
    testTimeout: 20_000,
    include: ['test/**/*.test.ts', 'api-tests/**/*.test.ts', 'drafts/test/**/*.test.ts'], // API tests live outside api/ so Vercel does not deploy them as functions.
    environment: 'node',
    // These real subprocess/worker proofs keep their deadlines, after the main pool has drained.
    projects: [
      { extends: true, test: { name: 'unit', exclude: HEAVY_INTEGRATION_TESTS, sequence: { groupOrder: 0 } } },
      { extends: true, test: { name: 'integration', include: HEAVY_INTEGRATION_TESTS, fileParallelism: false, sequence: { groupOrder: 1 } } },
    ],
    // Actor and engine contracts stay in Node. Only the legacy sword viewmodel opts into happy-dom via its header.
    coverage: {
      provider: 'v8',
      include: [
        'src/engine/**/*.ts',
      ],
      reporter: ['json-summary'],
    },
    setupFiles: ['test/setup.ts'],
    restoreMocks: true,
  },
});
