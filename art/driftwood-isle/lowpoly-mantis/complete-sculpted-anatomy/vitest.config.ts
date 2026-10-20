import { mergeConfig } from 'vitest/config';
import base from '../../../../vitest.config';

export default mergeConfig(base, { test: {
  include: ['art/driftwood-isle/lowpoly-mantis/complete-sculpted-anatomy/*.test.ts'], maxWorkers: 1,
} });
