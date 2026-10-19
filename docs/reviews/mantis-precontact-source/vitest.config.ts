import { defineConfig } from 'vitest/config';
import { rapierAlias } from '../../../vite/rapier';
export default defineConfig({ resolve: { alias: rapierAlias }, test: { maxWorkers: 1, environment: 'node', include: ['test/mantis-precontact-*.test.ts'], setupFiles: ['test/setup.ts'] } });
