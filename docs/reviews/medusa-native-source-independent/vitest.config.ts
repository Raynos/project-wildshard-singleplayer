import { mergeConfig } from 'vitest/config';
import base from '../../../vitest.config';
export default mergeConfig(base, { test: { include: [
  'art/driftwood-isle/approved-pearlglass-medusa/native-owner-candidate1/native.test.ts',
  'test/native-rigid-corpse-resource.test.ts', 'test/animal-pose-flight-clock.test.ts',
  'docs/reviews/medusa-native-source-independent/flight-clock.test.ts',
], maxWorkers: 1 } });
