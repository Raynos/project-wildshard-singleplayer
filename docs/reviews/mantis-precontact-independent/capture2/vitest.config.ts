import { defineConfig } from 'vitest/config';
import { rapierAlias } from '../../../../vite/rapier';
export default defineConfig({ resolve: { alias: rapierAlias }, test: { maxWorkers: 1, environment: 'node', include: ['docs/reviews/mantis-precontact-independent/capture2/*.test.ts'], setupFiles: ['test/setup.ts'] } });
