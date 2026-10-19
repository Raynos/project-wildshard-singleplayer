import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../../vitest.config';
export default mergeConfig(base, defineConfig({ test: { include: ['docs/reviews/puffer-closed-anatomy-runtime-audit/runtime-audit.test.ts'], testTimeout: 120000, maxWorkers: 1 } }));
