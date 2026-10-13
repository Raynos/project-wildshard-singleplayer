import { defineConfig } from 'vitest/config';
import { rapierAlias } from './vite/rapier';
import { assertVitestLane, vitestMaxWorkers } from './scripts/vitest-lane';

assertVitestLane();
export default defineConfig({
  resolve: { alias: rapierAlias }, assetsInclude: ['**/*.bin', '**/*.wasm'],
  test: { maxWorkers: vitestMaxWorkers(), testTimeout: 30_000, environment: 'node',
    include: ['test/**/*.test.ts', 'admin/test/**/*.test.ts', 'drafts/test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'], restoreMocks: true },
});
