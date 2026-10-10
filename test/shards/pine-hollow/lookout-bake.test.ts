import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs on the platform the bake was recorded on.
import { platform } from 'node:process';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { LOOKOUT_ROWS } from '../../../src/shards/pine-hollow/models/fireLookout';
import { TimberBlocks } from '../../../src/shards/pine-hollow/world/timberBake';
import { unshuffleLanes } from '../../../src/shards/pine-hollow/world/bakeBytes';
import committed from '../../../src/shards/pine-hollow/data/lookout.json' with { type: 'json' };
import { bakeLookoutRows } from '../../../scripts/bake-pine-lookout.mjs';

const shipped = (): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/lookout.bin', import.meta.url)))));

describe('Pine Hollow bakes its fire lookout offline (G285)', () => {
  // Exact against a bake recorded on the Mac; Linux's libm differs in the last ulp (CI 38008817381, the crag bake's gate),
  // so the stale gate runs where bakes are made (the local push gate), not on the Linux runners.
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun scripts/bake-pine-lookout.mjs)', () => {
    const { rows, bin } = bakeLookoutRows();
    // the timber's stream is the level seed's, as the page's engine SEED is while the landmarks build
    expect(rows.seed).toBe(PINE_HOLLOW.seed);
    expect(rows).toEqual(committed);
    expect(shipped()).toEqual(bin);
  });

  it('decodes into the builder\'s parts: whole, finite, non-indexed, the ride\'s anchors and the deck floors', () => {
    const blocks = new TimberBlocks(shipped(), LOOKOUT_ROWS.bytes);
    const { parts, glass } = blocks.parts(LOOKOUT_ROWS);
    blocks.done();
    expect([...parts.keys()]).toEqual(LOOKOUT_ROWS.parts.map((p) => p.key));
    for (const g of [...[...parts.values()].flat(), ...glass]) {
      expect(g.getIndex()).toBeNull();
      expect(Object.keys(g.attributes)).toEqual(['position', 'normal', 'uv']);
      expect(g.getAttribute('position').count % 3).toBe(0);
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    }
    expect(Object.keys(LOOKOUT_ROWS.anchors).sort()).toEqual(['launch', 'zipTop']);
    expect(LOOKOUT_ROWS.floors.length).toBeGreaterThan(0);
    expect(LOOKOUT_ROWS.colliders.some((c) => c.kind === 'treads')).toBe(true);
  });
});
