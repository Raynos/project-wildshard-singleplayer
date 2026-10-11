// Unit tests (`pnpm test` → `vitest run`; CI runs it between Lint and the CSS check). Deliberately NOT vite.config.ts:
// that config bakes every chunk's terrain / sky at load, which a test run must not pay for (or depend on).
// Tests live in test/ (outside src/, so no `import.meta.glob` in the game can ever pull one into the bundle) and run
// in plain node: the few browser globals the pure modules touch (localStorage, location) are stubbed in test/setup.ts.
import { defineConfig } from 'vitest/config';
import { rapierAlias } from './vite/rapier';
import { assertVitestLane, vitestCoverageEnabled, vitestMaxWorkers } from './scripts/vitest-lane';
import { DurationSequencer } from './scripts/vitest-shard';

assertVitestLane();

export const HEAVY_INTEGRATION_TESTS = [
  'test/live-grid.test.ts',
  'test/sdk-repo-build.test.ts',
  'test/template-copy-scaffold.test.ts',
  // Whole API inventory and semantic example compilation retain their 10/20 s
  // deadlines after the parallel pool drains (nightly coverage contention).
  'test/authoring-docs.test.ts',
  // Real Rapier worlds and production vegetation builds exceed their unchanged 20 s deadlines
  // under CI coverage when competing with the main pool. Keep their proofs serial as well.
  'test/grid-collision-strips.test.ts',
  'test/immutable-vegetation-canvases-off.test.ts',
  'test/immutable-vegetation-canvases.test.ts',
  'test/shardfile-splat-admission.test.ts',
  // Native tapes and SDK workers keep their deadlines after the main pool has drained.
  // Checkpoint caches are prepared before Vitest; reef and Signal still execute their real spawn journeys.
  'test/proof/compatibility/determinism.test.ts',
  'test/proof/driftwood-isle/reef.test.ts',
  'test/proof/driftwood-isle/replay.test.ts',
  'test/proof/driftwood-isle/zipline.test.ts',
  // These native hosts and exact geometry comparisons also exceeded their existing
  // deadlines while sharing the parallel pool; retain their complete proofs here.
  'test/proof/blender-template/replay.test.ts',
  'test/proof/nine-dragon-stack/headless.test.ts',
  // Nalati now runs the living-horse journey and all 92 native entry lanes; retain
  // its complete codec/bond proofs at their original 20 s deadlines after the unit pool drains.
  'test/proof/nalati-grasslands/headless.test.ts',
  'test/proof/nalati-grasslands/replay.test.ts',
  'test/shards/driftwood-isle/trailside-bake.test.ts',
  // These exact nightly failures compete for native worlds and a complete type
  // graph. Keep their 20/60 s deadlines after the covered parallel pool drains;
  // ordinary push/local tests retain their current parallel scheduling.
  ...(vitestCoverageEnabled() ? [
    'test/shards/nalati-grasslands/headless-taming.test.ts',
    'test/shards/sunscar-dunes/headless-runtime.test.ts',
    'test/shard-coupling.test.ts',
  ] : []),
];

export default defineConfig({
  // Rapier's wasm-importing module → plain bindings; tests hand loadRapier() the binary. (A test reaches a layer's
  // internals by its relative path; src imports only the @wildshard/* packages' exports, E432.)
  resolve: { alias: rapierAlias },
  assetsInclude: ['**/*.bin', '**/*.wasm'], // `?inline` of a baked terrain.bin and Rapier's binary (test/physics-terrain.test.ts)
  test: {
    maxWorkers: vitestMaxWorkers(),
    // 2026-10-03: under coverage on the CI runner, tests that parse every shard (gen-shards AG10, gen-budget-derivations)
    // ran past vitest's 5 s default and failed main's runs one after another (each passes in ~2 s locally); 20 s is the floor
    testTimeout: 20_000,
    environment: 'node',
    // SF74 W23: --shard=i/n packs files by recorded duration (test/durations.json), not by path hash (141-354 s shards)
    sequence: { sequencer: DurationSequencer },
    // These real subprocess/worker proofs keep their deadlines, after the main pool has drained.
    projects: [
      // Vite merges inherited arrays by concatenation: keep include out of the parent or integration runs all files.
      { extends: true, test: { name: 'unit', include: ['test/**/*.test.ts', 'api-tests/**/*.test.ts', 'drafts/test/**/*.test.ts', 'admin/test/**/*.test.ts'], exclude: HEAVY_INTEGRATION_TESTS, sequence: { groupOrder: 0 } } },
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
