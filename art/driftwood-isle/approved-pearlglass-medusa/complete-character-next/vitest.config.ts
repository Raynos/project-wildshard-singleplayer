import { mergeConfig } from 'vitest/config';
import base from '../../../../vitest.config';
export default mergeConfig(base,{test:{include:['art/driftwood-isle/approved-pearlglass-medusa/complete-character-next/*.test.ts'],maxWorkers:1}});
