import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs on the platform the bake was recorded on.
import { platform } from 'node:process';
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { SITE_TIMBER_ROWS } from '../../../src/shards/pine-hollow/world/timberSites';
import { TimberBlocks } from '../../../src/shards/pine-hollow/world/timberBake';
import { unshuffleLanes } from '../../../src/shards/pine-hollow/world/bakeBytes';
import committed from '../../../src/shards/pine-hollow/data/siteTimbers.json' with { type: 'json' };
import { bakeSiteTimberRows } from '../../../src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs';

const shipped = (): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/site-timbers.bin', import.meta.url)))));

describe('Pine Hollow bakes its zipline landing and creek footbridge offline (G285)', () => {
  // Exact against a bake recorded on the Mac; Linux's libm differs in the last ulp (CI 38008817381, the crag bake's gate),
  // so the stale gate runs where bakes are made (the local push gate), not on the Linux runners.
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun src/shards/pine-hollow/generators/bake-pine-site-timbers.mjs)', () => {
    const { rows, bin } = bakeSiteTimberRows();
    // the ground they fit is the level's, and their streams are the level seed's
    expect(rows.seed).toBe(PINE_HOLLOW.seed);
    expect(rows).toEqual(committed);
    expect(shipped()).toEqual(bin);
  });

  it('decodes all four copies in order: whole parts, the ride\'s anchors, a deck floor each, the landing\'s stair', () => {
    const blocks = new TimberBlocks(shipped(), SITE_TIMBER_ROWS.bytes);
    const { landing, bridge } = SITE_TIMBER_ROWS;
    for (const row of [landing.world, landing.turntable, bridge.world, bridge.turntable]) {
      const { parts, glass } = blocks.parts(row);
      for (const g of [...[...parts.values()].flat(), ...glass]) {
        expect(g.getIndex()).toBeNull();
        expect(g.getAttribute('position').count % 3).toBe(0);
        expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
      }
      expect(row.floors).toHaveLength(1);
    }
    blocks.done();
    for (const row of [landing.world, landing.turntable]) {
      expect(Object.keys(row.anchors).sort()).toEqual(['landing', 'zipBottom']);
      expect(row.colliders.some((c) => c.kind === 'treads')).toBe(true);
    }
  });
});
