import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate rebakes over the committed terrain grid the page samples.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs on the platform the bake was recorded on.
import { platform } from 'node:process';
import { bakeNalatiPlacesOnTerrain } from '../../../src/shards/nalati-grasslands/generators/places';
import type { PlaceRow } from '../../../src/shards/nalati-grasslands/world/placeBake';
import { bakeDifference, committedPlaces } from '../../../scripts/bake-nalati-places.mjs';

const terrain = (): ArrayBuffer => {
  const b = readFileSync(new URL('../../../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
/** a place's own slice of a bake: its row, and its geometries' words (the rows are laid out in order in the binary) */
const placeSlice = (rows: readonly PlaceRow[], bin: Uint8Array, name: string, wordsOf: (row: PlaceRow) => number): { rows: PlaceRow[]; bin: Uint8Array } => {
  let at = 0;
  for (const row of rows) {
    const n = wordsOf(row) * 4;
    if (row.name === name) return { rows: [row], bin: bin.subarray(at, at + n) };
    at += n;
  }
  throw new Error(`no place ${name}`);
};
/** a place's binary words: each mesh's attributes, then its index deltas (data/places.json's layout) */
const wordsOf = (row: PlaceRow): number => row.meshes.reduce((n, { geometry: g }) => n + g.attrs.reduce((s, attr) => s + g.count * attr[2], 0) + (g.index === null ? 0 : g.indexCount), 0);

describe('Nalati bakes its painted places offline (SHARD-PLATFORM M3)', () => {
  // The full stale gate is `scripts/bake-nalati-places.mjs --check` (bake-check's node baker `nalati-places`: the three places
  // and every specimen). Here: the committed binary is its rows', and one place, the Kunes bridge, rebaked in Node against it
  // (Chromium made the bake: rows within 1e-9, stored floats within 2^-20, as the gate allows).
  // Linux's libm differs in the last ulp (Pine's crags, CI 38008817381): the gate runs where the bakes are made.
  it.runIf(platform === 'darwin')('the committed bridge re-encodes from its generator (the stale gate: rerun scripts/bake-nalati-places.mjs)', () => {
    const committed = committedPlaces(), made = bakeNalatiPlacesOnTerrain(terrain()).places;
    const shipped = placeSlice(committed.places.rows.rows, committed.places.raw, 'bridge', wordsOf), rebaked = placeSlice(made.rows, made.bin, 'bridge', wordsOf);
    const mine = { rows: { ...committed.places.rows, rows: shipped.rows }, raw: shipped.bin };
    expect(bakeDifference('places', mine, rebaked, (r) => r.meshes)).toBeNull();
    expect(made.rows.map((r) => r.name)).toEqual(committed.places.rows.rows.map((r) => r.name));
  }, 30_000);
  it.runIf(platform === 'darwin')('the committed dressing shapes re-encode from their generator (generators/dressingGeos.ts)', () => {
    const committed = committedPlaces(), made = bakeNalatiPlacesOnTerrain(terrain()).dressing;
    expect(bakeDifference('dressing', committed.dressing, made, (r) => [r])).toBeNull();
    expect(made.rows.map((r) => r.key)).toEqual(committed.dressing.rows.rows.map((r) => r.key));
  }, 30_000);
});
