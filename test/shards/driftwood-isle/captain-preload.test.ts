import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ShardContext } from '#game';
import { fakeWorld } from '../../fake/world';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: Error) => void } {
  let yes: (value: T) => void = () => { throw new Error('Promise not initialized'); };
  let no: (reason: Error) => void = () => { throw new Error('Promise not initialized'); };
  const promise = new Promise<T>((resolve, reject) => { yes = resolve; no = reject; });
  return { promise, resolve: yes, reject: no };
}

function hull(): { gltf: GLTF; map: Texture } {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const map = new Texture(), scene = new Group();
  scene.add(new Mesh(geometry, new MeshStandardMaterial({ map })));
  return { gltf: { scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' }, parser: {} as GLTF['parser'], userData: {} }, map };
}

async function outcome(promise: Promise<unknown>): Promise<unknown> {
  try { return await promise; } catch (error: unknown) { return error; }
}

beforeEach(() => { vi.resetModules(); });

describe('Captain preload barrier (E357 R9)', { timeout: 30_000 }, () => {
  it('cannot cache the procedural Captain during a delayed load, and builds the textured hull afterwards', async () => {
    const pending = deferred<GLTF>();
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockReturnValue(pending.promise);
    const mesh = await import('#shards/driftwood-isle/species/captainMesh');
    const { CAPTAIN, CAPTAIN_LOOK } = await import('#shards/driftwood-isle/species/captain');
    const { registerSpecies, speciesWithLook } = await import('#engine');
    const { AnimalFactory } = await import('#engine/entities/AnimalFactory');
    registerSpecies(speciesWithLook(CAPTAIN, CAPTAIN_LOOK));
    const factory = new AnimalFactory(fakeWorld().sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
    const ready = mesh.preloadCaptainMesh();
    try {
      expect(mesh.preloadCaptainMesh()).toBe(ready);
      expect(() => factory.model('captain', 'captain')).toThrow('still loading');
      const asset = hull(); pending.resolve(asset.gltf); await ready;
      const model = factory.model('captain', 'captain');
      expect(model.fur.map).toBe(asset.map);
      expect(factory.model('captain', 'captain')).toBe(model);
      expect(load).toHaveBeenCalledTimes(1);
      expect(mesh.captainMeshLoaded()).toBe(true);
    } finally { pending.resolve(hull().gltf); await ready; }
  });

  it.each(['captain', 'sailor'])('keeps play behind the loading screen until the %s finishes loading', async (last) => {
    const captain = deferred<GLTF>(), sailor = deferred<GLTF>();
    const requested = deferred<undefined>(); let requests = 0;
    const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((url) => {
      if (++requests === 2) requested.resolve(undefined);
      return url.includes('sailor-head') ? sailor.promise : captain.promise;
    });
    const adventure = await import('#shards/driftwood-isle/quest/adventure');
    const reached = new Error('Adventure installation reached');
    const install = vi.spyOn(adventure, 'installAdventure').mockRejectedValue(reached);
    const { installDriftwoodAdventure } = await import('#shards/driftwood-isle/quest/install');
    const scope = { disposed: false };
    const ctx = { game: { runtime: { world: {}, play: {} } }, scope } as ShardContext;
    const captainMesh = await import('#shards/driftwood-isle/species/captainMesh');
    const sailorMesh = await import('#shards/driftwood-isle/species/sailor');
    const result = outcome(installDriftwoodAdventure(ctx));
    try {
      await requested.promise; // loadRigFile imports its loader asynchronously; one microtask is not a barrier.
      expect(requests).toBe(2); expect(install).not.toHaveBeenCalled();
      const first = last === 'captain' ? sailor : captain, final = last === 'captain' ? captain : sailor;
      first.resolve(hull().gltf);
      await (last === 'captain' ? sailorMesh.preloadSailorHead() : captainMesh.preloadCaptainMesh());
      expect(install).not.toHaveBeenCalled();
      final.resolve(hull().gltf);
      expect(await result).toBe(reached); expect(install).toHaveBeenCalledTimes(1);
    } finally {
      // Always drain the current installation before resetModules/restoreMocks starts the next case. If an assertion
      // fails while either asset is pending, disposal prevents its continuation from calling the next case's spy.
      scope.disposed = true; captain.resolve(hull().gltf); sailor.resolve(hull().gltf);
      await result; install.mockRestore(); load.mockRestore();
    }

  });

  it('permits the procedural stand-in after a real load failure', async () => {
    const pending = deferred<GLTF>();
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockReturnValue(pending.promise);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mesh = await import('#shards/driftwood-isle/species/captainMesh');
    const { CAPTAIN, CAPTAIN_LOOK } = await import('#shards/driftwood-isle/species/captain');
    const { Rng, speciesWithLook } = await import('#engine');
    const species = speciesWithLook(CAPTAIN, CAPTAIN_LOOK), variant = species.variants[0];
    if (variant === undefined) throw new Error('Captain variant missing');
    const ready = mesh.preloadCaptainMesh();
    pending.reject(new Error('Asset unavailable')); await ready;
    expect(mesh.captainMeshLoaded()).toBe(false);
    expect(species.build(variant, new Rng(357)).map).toBeUndefined();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
