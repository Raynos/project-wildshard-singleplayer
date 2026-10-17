import { expectTypeOf, test } from 'vitest';
import { CABIN_LIFE } from '../src/shards/pine-hollow/generators/cabinLook';
import { CAVE_LOOK } from '../src/shards/pine-hollow/generators/cragLook';
import type { BuildingLifeLook } from '../src/format/buildings';
import type { CaveLookRow } from '../src/shards/pine-hollow/runtime/kit/caveInterior';

// data/ is build-time and cannot import runtime/ (no-runtime-in-build); the row types live with the runtime that reads
// them, and tsc checks here that each data/ row still fits its runtime type.
test('Pine data/ look rows fit their runtime types', () => {
  expectTypeOf(CABIN_LIFE).toExtend<BuildingLifeLook>();
  expectTypeOf(CAVE_LOOK).toExtend<CaveLookRow>();
});
