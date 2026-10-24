import { defineConfig } from 'vitest/config';
import { rapierAlias } from './vite/rapier';
import { assertVitestLane, vitestMaxWorkers } from './scripts/vitest-lane';
import { vitestTmpRoot } from './scripts/vitest-tmp';
import { vitestModuleCache } from './scripts/vitest-module-cache';
import { DurationSequencer } from './scripts/vitest-shard';
import { setPriority } from 'node:os';

assertVitestLane();
const maxWorkers = vitestMaxWorkers();
const { CI: ci, GITHUB_ACTIONS: githubActions } = process.env;
// BUILD-SPEED 1.2: lane test runs yield CPU to the measurement lane and the Simulator; workers inherit the nice value.
if (!ci && !githubActions) setPriority(10);
export default defineConfig({
  plugins: [vitestTmpRoot(), vitestModuleCache()],
  resolve: { alias: rapierAlias }, assetsInclude: ['**/*.bin', '**/*.wasm'],
  // Reuse transformed code in CI; each test still executes in its isolated worker.
  test: { fsModuleCache: Boolean(ci ?? githubActions), ...(maxWorkers === undefined ? {} : { maxWorkers }), testTimeout: 30_000, environment: 'node',
    // This Node-only reader verifies sealed files; DOM suites must retain file URLs.
    server: { deps: { external: [/\/scripts\/built-product\.mjs$/u] } },
    sequence: { sequencer: DurationSequencer },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'admin/test/**/*.test.ts', 'drafts/test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'], restoreMocks: true },
});
