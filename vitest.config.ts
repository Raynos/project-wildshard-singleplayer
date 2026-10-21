import { defineConfig } from 'vitest/config';
import { rapierAlias } from './vite/rapier';
import { assertVitestLane, vitestMaxWorkers } from './scripts/vitest-lane';
import { vitestTmpRoot } from './scripts/vitest-tmp';
import { DurationSequencer } from './scripts/vitest-shard';
import { setPriority } from 'node:os';

assertVitestLane();
// BUILD-SPEED 1.2: lane test runs yield CPU to the measurement lane and the Simulator; workers inherit the nice value.
if (!process.env.CI && !process.env.GITHUB_ACTIONS) setPriority(10);
export default defineConfig({
  plugins: [vitestTmpRoot()],
  resolve: { alias: rapierAlias }, assetsInclude: ['**/*.bin', '**/*.wasm'],
  test: { maxWorkers: vitestMaxWorkers(), testTimeout: 30_000, environment: 'node',
    sequence: { sequencer: DurationSequencer },
    include: ['test/**/*.test.ts', 'admin/test/**/*.test.ts', 'drafts/test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'], restoreMocks: true },
});
