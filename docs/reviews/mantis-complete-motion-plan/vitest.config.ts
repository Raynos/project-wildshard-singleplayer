import { defineConfig } from 'vitest/config';
import { rapierAlias } from '../../../vite/rapier';
export default defineConfig({ resolve: { alias: rapierAlias }, test: { maxWorkers: 1, environment: 'node',
  include: ['test/mantis-complete-*.test.ts'], setupFiles: ['test/setup.ts'], testTimeout: 120000 } });
