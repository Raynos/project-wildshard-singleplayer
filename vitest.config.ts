import { defineConfig } from 'vitest/config';
import { rapierAlias } from './vite/rapier';
import { assertVitestLane, vitestMaxWorkers } from './scripts/vitest-lane';
import { vitestTmpRoot } from './scripts/vitest-tmp';
import { DurationSequencer } from './scripts/vitest-shard';

assertVitestLane();
export default defineConfig({
  plugins: [vitestTmpRoot()],
  resolve: { alias: rapierAlias }, assetsInclude: ['**/*.bin', '**/*.wasm'],
  test: { maxWorkers: vitestMaxWorkers(), testTimeout: 30_000, environment: 'node',
    sequence: { sequencer: DurationSequencer },
    include: ['test/**/*.test.ts', 'admin/test/**/*.test.ts', 'drafts/test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'], restoreMocks: true },
});
