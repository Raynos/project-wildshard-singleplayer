import { defineConfig } from 'vitest/config';
import { rapierAlias } from '../../../vite/rapier';
export default defineConfig({ resolve: { alias: rapierAlias }, test: { maxWorkers: 1, environment: 'node',
  include: ['docs/reviews/mantis-exact-strike-adapter-independent/independent.test.mjs',
    'test/creature-numeric-clips.test.ts', 'test/monkey-numeric-clips.test.ts'],
  setupFiles: ['test/setup.ts'], testTimeout: 120000 } });
