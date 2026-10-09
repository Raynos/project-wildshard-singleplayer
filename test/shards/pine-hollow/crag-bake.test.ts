import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { CRAG_ROWS, CragSkin, unshuffleLanes } from '../../../src/shards/pine-hollow/world/cragBake';
import committed from '../../../src/shards/pine-hollow/data/crags.json' with { type: 'json' };
import { bakeCragRows, installPineGround } from '../../../scripts/bake-pine-crags.mjs';

const shipped = (tier: 'phone' | 'desktop'): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL(`../../../public/assets/pine-hollow/baked/crags.${tier}.bin`, import.meta.url)))));

describe('Pine Hollow bakes its crags offline (G285)', () => {
  it('the committed bake is byte-exact against its generator (the stale gate: rerun scripts/bake-pine-crags.mjs)', async () => {
    // the ground the crags stand on is the level's: its baked grid carries the level seed (1337)
    expect(installPineGround()).toBe(PINE_HOLLOW.seed);
    const { rows, bins } = await bakeCragRows();
    expect(rows).toEqual(committed);
    for (const tier of ['phone', 'desktop'] as const) expect(shipped(tier)).toEqual(bins[tier]);
  }, 30_000);

  it('decodes every tier\'s skin into the page\'s tiles: a near and a far geometry each, finite, indexed, bounded', async () => {
    expect(CRAG_ROWS.places.filter((p) => p.id === 'hero')).toHaveLength(1);
    for (const tier of ['phone', 'desktop'] as const) {
      const tiles = await new CragSkin(shipped(tier), CRAG_ROWS.skin[tier]).tiles(() => Promise.resolve());
      expect(tiles.length).toBe(CRAG_ROWS.skin[tier].tiles.length);
      for (const [near, far] of tiles) for (const g of [near, far]) {
        expect(Object.keys(g.attributes)).toEqual(['position', 'cdata', 'ctint', 'normal']);
        expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        expect((g.getIndex()?.count ?? 0) % 3).toBe(0);
        expect(g.boundingSphere?.radius ?? 0).toBeGreaterThan(1);
      }
      expect(tiles.reduce((n, [near]) => n + near.getAttribute('position').count, 0)).toBeGreaterThan(tiles.reduce((n, [, far]) => n + far.getAttribute('position').count, 0));
    }
  }, 30_000);
});
