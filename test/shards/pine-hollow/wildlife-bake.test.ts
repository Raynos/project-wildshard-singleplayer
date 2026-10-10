import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate runs the byte-exact half where the bake was made.
import { platform } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The committed bake is a zlib stream the page inflates.
import { inflateSync } from 'node:zlib';
import { unshuffleLanes } from '../../../src/shards/pine-hollow/world/bakeBytes';
import { KIND, WILD_BAKE_KINDS, WILD_ROWS, WildlifeMesh, useWildShapes, wildShapes } from '../../../src/shards/pine-hollow/models/wildlife';
import committed from '../../../src/shards/pine-hollow/data/wildlife.json' with { type: 'json' };
import { bakeWildlifeRows } from '../../../scripts/bake-pine-wildlife.mjs';
import type { SkyRig } from '@wildshard/engine/world/skyRig';

const shipped = (): Uint8Array => unshuffleLanes(new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/pine-hollow/baked/wildlife.bin', import.meta.url)))));

describe('Pine Hollow bakes its procedural wildlife offline (G285)', () => {
  // Math.sin / hypot in the mottling and the ellipsoids: byte-exact where the bake was made (macOS)
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun scripts/bake-pine-wildlife.mjs)', () => {
    const { rows, bin } = bakeWildlifeRows();
    expect(rows).toEqual(committed);
    expect(shipped()).toEqual(bin);
  });

  it('decodes into the four kinds in order, triangles in range, and the one shared draw holds them all', () => {
    const shapes = wildShapes(shipped());
    expect([...shapes.keys()]).toEqual(WILD_BAKE_KINDS);
    for (const { kind, vertices, indices } of WILD_ROWS.kinds) {
      const s = shapes.get(kind);
      expect(s?.pos.length).toBe(vertices * 3);
      expect(s?.info.length).toBe(vertices * 4);
      expect(indices % 3).toBe(0);
      expect(Array.from(s?.idx ?? []).every((i) => i < vertices)).toBe(true);
      // every vertex carries its own kind (the vertex shader collapses the others)
      expect(Array.from(s?.info ?? []).filter((_, i) => i % 4 === 1).every((k) => k === kind)).toBe(true);
    }
    useWildShapes(shipped());
    const sky: Pick<SkyRig, 'setupMaterial'> = { setupMaterial: () => undefined };
    const mesh = new WildlifeMesh(sky as SkyRig, 4);
    expect(mesh.vertexCount).toBe(WILD_ROWS.kinds.reduce((n, k) => n + k.vertices, 0));
    expect(mesh.mesh.geometry.getIndex()?.array).toBeInstanceOf(Uint16Array);
    expect(WILD_ROWS.kinds.at(-1)?.kind).toBe(KIND.hare);
  });
});
