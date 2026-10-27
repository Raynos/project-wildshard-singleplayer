import { DRIFTWOOD_ISLAND_FACTS } from './fixtures/driftwood-island-facts';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the tracked Blender placement table and metadata.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { driftwoodPlanBytes } from '../src/shards/driftwood-isle/generators/productPageFiles';

// iPhone downloads I8.5: the product's cove plans are byte for byte the dressing producer's published plans (their URLs
// name the sha256 of their bytes), compiled from the same table and metadata.
test('product cove plans equal the published plans', () => {
  const row = v.object({ url: v.string(), bytes: v.number() });
  const published = v.parse(v.object({ phone: row, desktop: row }), JSON.parse(readFileSync('src/shards/driftwood-isle/data/islandPlanFiles.json', 'utf8')));
  const table = Uint8Array.from(readFileSync('public/assets/models/driftwood-blender/placements.bin'));
  const metadata = Uint8Array.from(readFileSync('public/assets/models/driftwood-blender/island.json'));
  for (const tier of ['phone', 'desktop'] as const) {
    const bytes = driftwoodPlanBytes(table, metadata, tier, DRIFTWOOD_ISLAND_FACTS);
    expect(bytes.length).toBe(published[tier].bytes);
    expect(published[tier].url).toBe(`/assets/driftwood-isle/baked/island-plan-${hashImmutableBytes(bytes)}.json`);
  }
});
