import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { Rng } from '../../../src/engine/core/rng';
import { speciesWithLook } from '../../../src/engine/entities/species/look';
import { AnimalFactory } from '../../../src/engine/entities/AnimalFactory';
import { CaptainMesh } from '../../../src/shards/driftwood-isle/species/captainMesh';
import { CAPTAIN, captainLook } from '../../../src/shards/driftwood-isle/species/captain';
import { installDriftwoodAdventure } from '../../../src/shards/driftwood-isle/quest/install';
import type { ShardContext } from '../../../src/game/shard/context';
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

// each case builds its own captain mesh with its own file loader, registers the captain in its own scope and hands the
// installer its preload and install (no module reset, no loader or module spies: E422)
describe('Captain preload barrier (E357 R9)', { timeout: 30_000 }, () => {
  it('cannot cache the procedural Captain during a delayed load, and builds the textured hull afterwards', async () => {
    const pending = deferred<GLTF>();
    const load = vi.fn(() => pending.promise);
    const mesh = new CaptainMesh(load), scope = new Scope('captain-preload-test');
    const previous = app.levelScope; app.levelScope = scope;
    app.species.registerRow(CAPTAIN, scope); app.species.registerLook(captainLook(mesh), scope);
    const factory = new AnimalFactory(fakeWorld().sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
    const ready = mesh.preload();
    try {
      expect(mesh.preload()).toBe(ready);
      expect(() => factory.model('captain', 'captain')).toThrow('still loading');
      const asset = hull(); pending.resolve(asset.gltf); await ready;
      const model = factory.model('captain', 'captain');
      expect(model.fur.map).toBe(asset.map);
      expect(factory.model('captain', 'captain')).toBe(model);
      expect(load).toHaveBeenCalledTimes(1);
      expect(mesh.loaded()).toBe(true);
    } finally { pending.resolve(hull().gltf); await ready; scope.dispose(); app.levelScope = previous; }
  });

  it('reloads the cached Captain atlas after a regional owner retires it', async () => {
    const load = vi.fn(() => Promise.resolve(hull().gltf)), mesh = new CaptainMesh(load);
    let previous: Texture | null = null;
    for (let entry = 0; entry < 3; entry++) {
      await mesh.preload();
      const model = mesh.meshFor([{ name: 'body', parent: null, pos: [0, 0, 0] }]);
      if (model?.map === null || model === null) throw new Error('Missing Captain atlas');
      expect(model.map).not.toBe(previous); previous = model.map;
      model.map.dispose(); for (const part of model.parts) part.dispose();
      expect(mesh.loaded()).toBe(false); expect(load).toHaveBeenCalledTimes(entry + 1);
    }
  });

  it.each(['captain', 'sailor'])('keeps play behind the loading screen until the %s finishes loading', async (last) => {
    const captain = deferred<GLTF>(), sailor = deferred<GLTF>();
    const mesh = new CaptainMesh(() => captain.promise);
    const reached = new Error('Adventure installation reached');
    const install = vi.fn(() => Promise.reject(reached));
    const scope = { disposed: false };
    const ctx = { game: { runtime: { world: {}, play: {} } }, scope } as ShardContext;
    const result = outcome(installDriftwoodAdventure(ctx, { preload: () => Promise.all([mesh.preload(), sailor.promise]), install }));
    try {
      expect(install).not.toHaveBeenCalled();
      if (last === 'captain') { sailor.resolve(hull().gltf); await sailor.promise; } else { captain.resolve(hull().gltf); await mesh.preload(); }
      expect(install).not.toHaveBeenCalled();
      if (last === 'captain') captain.resolve(hull().gltf); else sailor.resolve(hull().gltf);
      expect(await result).toBe(reached); expect(install).toHaveBeenCalledTimes(1);
    } finally {
      scope.disposed = true; captain.resolve(hull().gltf); sailor.resolve(hull().gltf);
      await result;
    }
  });

  it('permits the procedural stand-in after a real load failure', async () => {
    const pending = deferred<GLTF>();
    const mesh = new CaptainMesh(() => pending.promise);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const species = speciesWithLook(CAPTAIN, captainLook(mesh)), variant = species.variants[0];
    if (variant === undefined) throw new Error('Captain variant missing');
    const ready = mesh.preload();
    pending.reject(new Error('Asset unavailable')); await ready;
    expect(mesh.loaded()).toBe(false);
    expect(species.build(variant, new Rng(357)).map).toBeUndefined();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
