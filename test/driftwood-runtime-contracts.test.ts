import { expectTypeOf, test } from 'vitest';
import type * as ShrineContract from '../src/shards/driftwood-isle/assets/contracts/shrine';
import type * as WreckContract from '../src/shards/driftwood-isle/assets/contracts/wreck';
import type * as RuntimeShrine from '../src/shards/driftwood-isle/runtime/models/shrine';
import type * as RuntimeWreck from '../src/shards/driftwood-isle/runtime/models/shipwreck';

// G449 (sp-o287): the standalone runtime keeps its own copies of the build-time contract types it reads; the type
// check refuses any drift between a copy and the assets/contracts/ type it mirrors.
test('Driftwood runtime contract types equal their assets/contracts/ sources', () => {
  expectTypeOf<RuntimeShrine.ShrineSite>().toEqualTypeOf<ShrineContract.ShrineSite>();
  expectTypeOf<RuntimeShrine.ShrineAnchor>().toEqualTypeOf<ShrineContract.ShrineAnchor>();
  expectTypeOf<RuntimeShrine.ShrineParams>().toEqualTypeOf<ShrineContract.ShrineParams>();
  expectTypeOf<RuntimeWreck.WreckSpec>().toEqualTypeOf<WreckContract.WreckSpec>();
});
