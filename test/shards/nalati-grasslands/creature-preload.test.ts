import { describe, expect, it, vi } from 'vitest';
import { Bone, BufferGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, Skeleton, SkinnedMesh, Texture, Uint16BufferAttribute } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NALATI_DEFINITIONS, NALATI_SPECIES, nalatiLook } from '../../../src/shards/nalati-grasslands/species/rows';
import { CreatureRigs } from '../../../src/shards/nalati-grasslands/species/hulls';
import manifest from '../../../src/shards/nalati-grasslands/manifest';
import { AnimalFactory } from '../../../src/engine/entities/AnimalFactory';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { fakeWorld } from '../../fake/world';

function rig(): GLTF {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 2, 0], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(12), 4));
  geometry.computeVertexNormals();
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial({ map: new Texture() }));
  const bone = new Bone(); bone.name = 'body'; mesh.add(bone); mesh.bind(new Skeleton([bone]));
  const scene = new Group(); scene.add(mesh);
  return { scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' }, parser: {} as GLTF['parser'], userData: {} };
}

it('rebuilds actual creature sources and baked coats after retirement invalidates the completed preload', async () => {
  const load = vi.fn(() => Promise.resolve(rig())), coats: Texture[] = [];
  const loadCoat = vi.fn(() => { const texture = new Texture(); coats.push(texture); return Promise.resolve(texture); });
  const rigs = new CreatureRigs(load, loadCoat);
  let previous: object | undefined;
  for (let visit = 0; visit < 3; visit++) {
    await rigs.preload();
    const source = await rigs.load('wolf');
    expect(source.geometry).not.toBe(previous); previous = source.geometry;
    const requests = load.mock.calls.length, coatRequests = loadCoat.mock.calls.length;
    await rigs.preload(); expect(load).toHaveBeenCalledTimes(requests); expect(loadCoat).toHaveBeenCalledTimes(coatRequests);
    expect(coatRequests).toBeGreaterThan(0);
    for (const texture of coats.splice(0)) expect(app.assets.evictCached(`scene:${texture.uuid}`)).toBe(true);
    expect(app.assets.evictCached(`scene:${source.geometry.uuid}`)).toBe(true);
    if (source.map !== null) expect(app.assets.evictCached(`scene:${source.map.uuid}`)).toBe(true);
    await rigs.preload(); expect(load.mock.calls.length).toBeGreaterThan(requests); expect(loadCoat.mock.calls.length).toBeGreaterThan(coatRequests);
  }
});

// each case builds its own creature rigs with its own file loader and no baked coats (no module reset, no loader spy, E422)
describe('Nalati creature boot barrier (E357 R9)', () => {
  it.each([false, true])('factory.ready waits for every rig, including when the last file fails (%s)', async (failLast) => {
    const pending: { resolve: (value: GLTF) => void; reject: (reason: Error) => void }[] = [];
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const load = vi.fn(() => new Promise<GLTF>((resolve, reject) => { pending.push({ resolve, reject }); }));
    const rigs = new CreatureRigs(load, () => Promise.resolve(null)), NALATI_LOOKS = NALATI_DEFINITIONS.map((def) => nalatiLook(def, rigs));
    const scope = new Scope('nalati-preload-test');
    app.levelScope = scope;
    for (const row of NALATI_SPECIES) app.species.registerRow(row, scope);
    for (const look of NALATI_LOOKS) app.species.registerLook(look, scope);
    expect(manifest.creatures?.waitForModels).toBe(true);
    const factory = new AnimalFactory(fakeWorld().sky, { render: manifest.creatures });
    let ready = false;
    const done = factory.ready.then(() => { ready = true; return undefined; });
    expect(pending.length).toBeGreaterThan(1);
    const count = pending.length, last = pending.at(-1);
    if (last === undefined) throw new Error('No creature rigs requested');
    for (const p of pending.slice(0, -1)) p.resolve(rig());
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    expect(ready).toBe(false);
    for (const look of NALATI_LOOKS) void look.preload?.();
    expect(load).toHaveBeenCalledTimes(count);
    if (failLast) last.reject(new Error('Rig unavailable')); else last.resolve(rig());
    await done;
    expect(ready).toBe(true);
    expect(warning).toHaveBeenCalledTimes(failLast ? 1 : 0);
    scope.dispose();
    app.levelScope = null;
  });
});
