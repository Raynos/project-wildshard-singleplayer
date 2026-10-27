// oxlint-disable-next-line import/no-nodejs-modules -- The test reads the committed Driftwood terrain bake and its sidecar.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';

// GR7: the driftwood-ground job retired; the WSTR lattice the grid edge reader fetches (/assets/baked/<slug>/terrain.bin)
// is committed, as Pine's and Nalati's are, and must stay the native ground the retained rows compile.
it('the committed Driftwood terrain bake is the native ground its rows compile, as its sidecar records', () => {
  const committed = new Uint8Array(readFileSync('public/assets/baked/driftwood-isle/terrain.bin'));
  const sidecar: unknown = JSON.parse(readFileSync('public/assets/baked/driftwood-isle/terrain.json', 'utf8'));
  const native = driftwoodGroundBytes();
  expect(committed.byteLength).toBe(native.byteLength);
  expect(hashImmutableBytes(committed)).toBe(hashImmutableBytes(native));
  expect(sidecar).toMatchObject({ hash: hashImmutableBytes(native), bytes: native.byteLength });
});
