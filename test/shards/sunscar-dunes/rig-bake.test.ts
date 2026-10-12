import { describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { BufferGeometry } from 'three';
import { bakeSignalSkitterer, skittererGeometry } from '../../../src/shards/sunscar-dunes/generators/species';
import { bakeSignalStrider, quadrupedHull } from '../../../src/shards/sunscar-dunes/generators/hulls';
import { DUNE_MODELS, DUNE_RIGS } from '../../../src/shards/sunscar-dunes/data/files';
import { STRIDER_HULL } from '../../../src/shards/sunscar-dunes/data/hulls';
import { STRIDER_RIG } from '../../../src/shards/sunscar-dunes/data/striderRig.baked';
import { createModelLibrary } from '../../../src/sdk/looks/modelLibrary';
import { duneRig, preloadDuneMeshes } from '../../../src/shards/sunscar-dunes/world/meshes';

const folder = new URL('../../../public/assets/sunscar-dunes/rigs/', import.meta.url);

describe('Signal Dunes bakes its code-built creature bodies offline (SHARD-PLATFORM SF72, SF67 fix 3)', () => {
  it('the committed skitterer rig is byte-exact against its generator (the stale gate: rerun src/shards/sunscar-dunes/generators/bake-signal-rigs.mjs)', () => {
    expect(new Uint8Array(readFileSync(new URL('skitterer.glb', folder)))).toEqual(bakeSignalSkitterer().glb);
    // the folder holds exactly this bake: no orphan GLB from an older bake ships
    expect(readdirSync(folder).filter((name) => name.endsWith('.glb')).sort()).toEqual(DUNE_RIGS.map((name) => `${name}.glb`).sort());
  });

  // every file the loaders ask for is read from public/ (the bake reads the same through its fetch)
  const fromPublic = (): { restore: () => void } => {
    const parser = new GLTFLoader(), errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((url) => {
      const bytes = readFileSync(`public${url}`);
      return parser.setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    });
    return { restore: () => {
      expect(errors.mock.calls.map(([message]) => String(message)).filter((m) => m.includes('baked rig') || m.includes('dune-strider'))).toEqual([]);
      loaded.mockRestore(); errors.mockRestore();
    } };
  };
  const same = (got: BufferGeometry, want: BufferGeometry, names: readonly string[]): void => {
    for (const name of names) {
      const a = got.getAttribute(name), b = want.getAttribute(name);
      expect([a.array.constructor.name, a.itemSize, a.normalized]).toEqual([b.array.constructor.name, b.itemSize, b.normalized]);
      expect(Array.from(a.array)).toEqual(Array.from(b.array));
    }
  };

  it('the client reads the bake as the code built it: the same positions, colours, flat normals, bones and weights', async () => {
    const io = fromPublic();
    try {
      await preloadDuneMeshes();
      const got = duneRig('skitterer'), want = skittererGeometry();
      if (got === null) throw new Error('skitterer rig missing');
      same(got, want, ['position', 'color', 'normal', 'skinIndex', 'skinWeight']);
      expect([got.getIndex(), Object.keys(got.attributes).sort()]).toEqual([want.getIndex(), Object.keys(want.attributes).sort()]);
    } finally { io.restore(); }
  });

  it('the strider rig and skeleton are byte-exact against its rows over the client intake of its model, and the client reads them as fitted (G345)', async () => {
    const io = fromPublic();
    try {
      const library = createModelLibrary({ ...DUNE_MODELS, meshes: ['dune-strider'], hd: [], rigs: [] }, '[test]');
      await library.preload();
      const source = (): BufferGeometry => { const g = library.mesh('dune-strider'); if (g === null) throw new Error('dune-strider missing'); return g; };
      const baked = bakeSignalStrider(source(), STRIDER_HULL);
      expect(new Uint8Array(readFileSync(new URL('strider.glb', folder)))).toEqual(baked.glb);
      expect(readFileSync('src/shards/sunscar-dunes/data/striderRig.baked.ts', 'utf8')).toBe(baked.rig);
      const hull = quadrupedHull(source(), STRIDER_HULL);
      expect([STRIDER_RIG.h, STRIDER_RIG.bones]).toEqual([hull.h, hull.bones]);
      await preloadDuneMeshes();
      const got = duneRig('strider');
      if (got === null) throw new Error('strider rig missing');
      same(got, hull.geometry, ['position', 'color', 'skinIndex', 'skinWeight']);
    } finally { io.restore(); }
  });
});
