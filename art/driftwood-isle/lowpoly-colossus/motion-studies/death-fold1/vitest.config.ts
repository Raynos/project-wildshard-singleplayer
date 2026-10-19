import { mergeConfig } from 'vitest/config';
import base from '../../../../../vitest.config';
export default mergeConfig(base, { test: { include: ['art/driftwood-isle/lowpoly-colossus/motion-studies/death-fold1/*.test.ts'], maxWorkers: 1, testTimeout: 120000 } });
