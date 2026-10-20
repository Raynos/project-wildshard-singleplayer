import { mergeConfig } from 'vitest/config';
import base from '../../../../vitest.config';

export default mergeConfig(base, { test: {
  include: ['art/driftwood-isle/lowpoly-colossus/complete-character-refined/*.test.ts'], maxWorkers: 1,
} });
