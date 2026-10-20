import { mergeConfig } from 'vitest/config';
import base from '../../../../vitest.config';
export default mergeConfig(base, { test: { include: ['art/driftwood-isle/approved-conch/articulated-source-candidate1/*.test.ts'], maxWorkers: 1 } });
