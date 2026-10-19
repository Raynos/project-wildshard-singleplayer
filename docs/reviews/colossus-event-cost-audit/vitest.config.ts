import { mergeConfig } from 'vitest/config';
import base from '../../../vitest.config';
export default mergeConfig(base,{test:{include:['docs/reviews/colossus-event-cost-audit/*.test.ts'],maxWorkers:1,testTimeout:120000}});
