import { mergeConfig } from 'vitest/config';
import baseline from '../../../vitest.config';
export default mergeConfig(baseline, { test: { include: ['docs/reviews/conch-motion4-independent/*.test.ts'], maxWorkers: 1 } });
