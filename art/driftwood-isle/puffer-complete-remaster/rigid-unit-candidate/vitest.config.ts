import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../../../vitest.config';
export default mergeConfig(base, defineConfig({ test: { include: ['art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate/consumer.test.ts'], testTimeout: 120000, maxWorkers: 1 } }));
