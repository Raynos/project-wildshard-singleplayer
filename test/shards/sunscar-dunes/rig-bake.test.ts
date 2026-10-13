import { describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readdirSync, readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { FileLoader, type BufferGeometry } from 'three';
import { bakeSignalSkitterer, skittererGeometry } from '../../../src/shards/sunscar-dunes/generators/species';
import { bakeSignalManta, bakeSignalStrider, bandSkin, quadrupedHull } from '../../../src/shards/sunscar-dunes/generators/hulls';
import { DUNE_MODELS, DUNE_RIGS } from '../../../src/shards/sunscar-dunes/data/files';
import { MANTA_HULL, RAY_TINT, STRIDER_HULL } from '../../../src/shards/sunscar-dunes/data/hulls';
import { RAY_BODY, SKITTERER_BODY } from '../../../src/shards/sunscar-dunes/data/species/bodies';
import { STRIDER_BODY } from '../../../src/shards/sunscar-dunes/data/striderRig.baked';
import { STRIDER_LOOK } from '../../../src/shards/sunscar-dunes/data/species/strider';
import { createModelLibrary } from '../../../src/sdk/looks/modelLibrary';
import { duneBakedBody, preloadDuneMeshes } from '../../../src/shards/sunscar-dunes/world/meshes';

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
    const files = vi.spyOn(FileLoader.prototype, 'loadAsync').mockImplementation((url) => {
      const bytes = readFileSync(`public${url}`);
      return Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    });
    return { restore: () => {
      expect(errors.mock.calls.map(([message]) => String(message)).filter((m) => m.includes('baked creature') || m.includes('dune-strider') || m.includes('dune-matriarch'))).toEqual([]);
      loaded.mockRestore(); files.mockRestore(); errors.mockRestore();
    } };
  };
  const same = (got: BufferGeometry, want: BufferGeometry, names: readonly string[]): void => {
    for (const name of names) {
      const a = got.getAttribute(name), b = want.getAttribute(name);
      expect([a.array.constructor.name, a.itemSize, a.normalized]).toEqual([b.array.constructor.name, b.itemSize, b.normalized]);
      expect(Array.from(a.array)).toEqual(Array.from(b.array));
    }
  };

  it('the client reads the bake as the code built it: the same positions, colours, flat normals, bones, weights and dims', async () => {
    const io = fromPublic();
    try {
      await preloadDuneMeshes();
      const body = duneBakedBody('skitterer'), got = body?.hardParts[0], want = skittererGeometry();
      if (body === null || got === undefined) throw new Error('skitterer rig missing');
      same(got, want, ['position', 'color', 'normal', 'skinIndex', 'skinWeight']);
      expect([got.getIndex(), Object.keys(got.attributes).sort()]).toEqual([want.getIndex(), Object.keys(want.attributes).sort()]);
      expect([body.bones, body.dims]).toEqual([SKITTERER_BODY.bones, { ...SKITTERER_BODY.dims, feet: [] }]);
    } finally { io.restore(); }
  });

  it('the strider rig and skeleton are byte-exact against its rows over the client intake of its model, and the client reads them as fitted (G345)', async () => {
    const io = fromPublic();
    try {
      const library = createModelLibrary({ ...DUNE_MODELS, meshes: ['dune-strider'], hd: [] }, '[test]');
      await library.preload();
      const source = (): BufferGeometry => { const g = library.mesh('dune-strider'); if (g === null) throw new Error('dune-strider missing'); return g; };
      const baked = bakeSignalStrider(source(), STRIDER_HULL);
      expect(new Uint8Array(readFileSync(new URL('strider.glb', folder)))).toEqual(baked.glb);
      expect(readFileSync('src/shards/sunscar-dunes/data/striderRig.baked.ts', 'utf8')).toBe(baked.rig);
      const hull = quadrupedHull(source(), STRIDER_HULL), d = STRIDER_LOOK.dims;
      const dims = { bodyY: hull.h * d.bodyY, bodyHalfLen: d.bodyHalfLen, bodyRadius: d.bodyRadius, headRadius: d.headRadius, legLen: hull.h * d.legLen, halfWidth: d.halfWidth };
      expect(STRIDER_BODY).toEqual({ bones: hull.bones, dims });
      await preloadDuneMeshes();
      const body = duneBakedBody('strider'), got = body?.hardParts[0];
      if (body === null || got === undefined) throw new Error('strider rig missing');
      const want = hull.geometry.index === null ? hull.geometry : hull.geometry.toNonIndexed();
      want.computeVertexNormals();
      same(got, want, ['position', 'color', 'normal', 'skinIndex', 'skinWeight']);
      expect([body.bones, body.dims]).toEqual([hull.bones, { ...dims, feet: [] }]);
    } finally { io.restore(); }
  });

  it('the ray and Matriarch rigs are byte-exact against the manta band-skinned over the client intake, and the client reads them as skinned (G345)', async () => {
    const io = fromPublic();
    try {
      const library = createModelLibrary({ ...DUNE_MODELS, meshes: ['dune-matriarch'], hd: [] }, '[test]');
      await library.preload();
      const source = (): BufferGeometry => { const g = library.mesh('dune-matriarch'); if (g === null) throw new Error('dune-matriarch missing'); return g; };
      await preloadDuneMeshes();
      for (const [name, tint] of [['ray', RAY_TINT], ['matriarch', null]] as const) {
        expect(new Uint8Array(readFileSync(new URL(`${name}.glb`, folder)))).toEqual(bakeSignalManta(`sunscar.${name}`, source(), MANTA_HULL, tint).glb);
        const body = duneBakedBody(name), got = body?.hardParts[0], want = bandSkin(source(), MANTA_HULL, tint);
        if (body === null || got === undefined) throw new Error(`${name} rig missing`);
        want.deleteAttribute('normal'); want.computeVertexNormals();
        same(got, want, ['position', 'color', 'normal', 'skinIndex', 'skinWeight']);
        expect([body.bones, body.dims]).toEqual([RAY_BODY.bones, { ...RAY_BODY.dims, feet: [] }]);
      }
    } finally { io.restore(); }
  });
});
