import { mergeConfig } from 'vitest/config';
import base from '../../../../vitest.config';

export default mergeConfig(base, { test: {
  include: ['art/driftwood-isle/approved-conch/selected-native-normals/*.test.ts'], maxWorkers: 1,
} });
