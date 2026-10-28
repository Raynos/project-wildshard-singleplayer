// oxlint-disable-next-line import/no-nodejs-modules -- Read only the cover producer's committed Blender inputs.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { CHUNK_HALF, CHUNK_SIZE, TERRAIN_RES } from '../src/engine/core/config';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { islandCoverBank } from '../src/shards/driftwood-isle/generators/islandCoverBank';
import policy from '../src/shards/driftwood-isle/data/groundGeometryPolicy.json' with { type: 'json' };
import { DRIFTWOOD_ISLAND_FACTS } from './fixtures/driftwood-island-facts';
import original from './fixtures/driftwood-cover-policy-original.json' with { type: 'json' };

test('retains the complete cover maps and plant cells on the authored ground policy', async () => {
  expect([policy.size, policy.size / 2, policy.resolution]).toEqual([CHUNK_SIZE, CHUNK_HALF, TERRAIN_RES]);
  const bank = await islandCoverBank(url => new Uint8Array(readFileSync(`public${url}`)), DRIFTWOOD_ISLAND_FACTS);
  expect([...bank].map(([name, bytes]) => ({ name, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }))).toEqual(original);
  expect([...bank.keys()]).toEqual(['world/cover/phone.bin', 'world/cover/cells/phone.bin', 'world/cover/desktop.bin', 'world/cover/cells/desktop.bin']);
});
