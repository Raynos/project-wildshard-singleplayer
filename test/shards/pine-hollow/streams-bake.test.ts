import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import { unshuffleLanes } from '../../../src/shards/pine-hollow/world/bakeBytes';
import { STREAM_ROWS, streamGeometry } from '../../../src/shards/pine-hollow/world/streams';
import committed from '../../../src/shards/pine-hollow/data/streams.json' with { type: 'json' };
import { bakeStreamRows } from '../../../scripts/bake-pine-streams.mjs';

const shipped = (): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/streams.bin', import.meta.url)))));

describe('Pine Hollow bakes its running water offline (G285)', () => {
  it('the committed bake is byte-exact against its generator (the stale gate: rerun scripts/bake-pine-streams.mjs)', () => {
    const { rows, bin } = bakeStreamRows();
    expect(rows).toEqual(committed);
    expect(shipped()).toEqual(bin);
  });

  it('decodes into the one water mesh: position, uv, aWater, a 16-bit index, normals, bounds', () => {
    const g = streamGeometry(shipped());
    expect(Object.keys(g.attributes)).toEqual(['position', 'uv', 'aWater', 'normal']);
    expect(g.getAttribute('position').count).toBe(STREAM_ROWS.vertices);
    expect(g.getIndex()?.array).toBeInstanceOf(Uint16Array);
    expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    expect(g.boundingSphere?.radius ?? 0).toBeGreaterThan(50);
    // the fall lands in the pond: the plunge is on the water, below the face's foot
    expect(STREAM_ROWS.plunge[1]).toBeLessThan(STREAM_ROWS.faceFoot[1]);
  });
});
