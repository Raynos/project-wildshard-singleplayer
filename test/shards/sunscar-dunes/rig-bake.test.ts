import { describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakeSignalSkitterer, skittererGeometry } from '../../../src/shards/sunscar-dunes/generators/species';
import { DUNE_RIGS, DUNE_RIG_URLS } from '../../../src/shards/sunscar-dunes/data/files';
import { duneRig, preloadDuneMeshes } from '../../../src/shards/sunscar-dunes/world/meshes';

const folder = new URL('../../../public/assets/sunscar-dunes/rigs/', import.meta.url);

describe('Signal Dunes bakes its code-built creature bodies offline (SHARD-PLATFORM SF72, SF67 fix 3)', () => {
  it('the committed skitterer rig is byte-exact against its generator (the stale gate: rerun scripts/bake-signal-rigs.mjs)', () => {
    expect(new Uint8Array(readFileSync(new URL('skitterer.glb', folder)))).toEqual(bakeSignalSkitterer().glb);
    // the folder holds exactly this bake: no orphan GLB from an older bake ships
    expect(readdirSync(folder).filter((name) => name.endsWith('.glb')).sort()).toEqual(DUNE_RIGS.map((name) => `${name}.glb`).sort());
  });

  it('the client reads the bake as the code built it: the same positions, colours, flat normals, bones and weights', async () => {
    const parser = new GLTFLoader();
    const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((url) => {
      if (url !== DUNE_RIG_URLS.skitterer) return Promise.reject(new Error('not this test'));
      const bytes = readFileSync(`public${url}`);
      return parser.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await preloadDuneMeshes();
      expect(errors.mock.calls.map(([message]) => String(message)).filter((m) => m.includes('baked rig'))).toEqual([]);
      const got = duneRig('skitterer'), want = skittererGeometry();
      if (got === null) throw new Error('skitterer rig missing');
      for (const name of ['position', 'color', 'normal', 'skinIndex', 'skinWeight']) {
        const a = got.getAttribute(name), b = want.getAttribute(name);
        expect([a.array.constructor.name, a.itemSize, a.normalized]).toEqual([b.array.constructor.name, b.itemSize, b.normalized]);
        expect(Array.from(a.array)).toEqual(Array.from(b.array));
      }
      expect([got.getIndex(), Object.keys(got.attributes).sort()]).toEqual([want.getIndex(), Object.keys(want.attributes).sort()]);
    } finally {
      loaded.mockRestore(); errors.mockRestore();
    }
  });
});
