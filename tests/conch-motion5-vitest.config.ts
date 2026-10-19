import {mergeConfig} from 'vitest/config';
import baseline from '../vitest.config';

// oxlint-disable-next-line import/no-default-export -- Vitest loads its configuration from the default export.
export default mergeConfig(baseline,{test:{include:['tests/conch-motion5-*.test.ts'],maxWorkers:1}});
