// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, type Object3D, type WebGLRenderer } from 'three';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { sceneObjectOwner } from '../../src/engine/app/sceneOwnership';
import { TrainingTarget } from '../../src/engine/practice/TrainingArena';
import type { TrainingDummyModel } from '../../src/engine/practice/TrainingDummy';
import { UploadOwnership } from '../../src/engine/render/uploadOwnership';
import { legacyDouble } from '../fake/FakeGame';

// Keep the studio's per-figure material-copy contract; its shader/PMREM builder is an injected GL dependency.
function studio(root: Object3D): MeshStandardMaterial[] {
  const materials: MeshStandardMaterial[] = [];
  root.traverse(node => {
    if (node instanceof Mesh) {
      const source: unknown = node.material;
      if (source instanceof MeshStandardMaterial) {
        const copy = source.clone(); node.material = copy; materials.push(copy);
      }
    }
  });
  return materials;
}

function figure(geometry = new BoxGeometry()): TrainingDummyModel {
  const root = new Group(); root.add(new Mesh(geometry, new MeshStandardMaterial()));
  return { root, joints: {}, rig: 'placeholder' };
}
function material(model: TrainingDummyModel): MeshStandardMaterial {
  const child = model.root.children[0];
  if (!(child instanceof Mesh) || !(child.material instanceof MeshStandardMaterial)) throw new Error('Missing figure');
  return child.material;
}

it('replacing a drawn stand-in retires its program holder and unload retires the installed figure without shared assets', () => {
  const level = new Scope('practice-level'), uploads = new UploadOwnership(level, app.assets);
  const renderer = legacyDouble<WebGLRenderer>({ properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined, compile: () => new Set() });
  uploads.attach(renderer);
  const target = new TrainingTarget('wood', 0, 900, 0, 2, 3, document.createElement('div'), 1, level, studio);
  const room = new Group(); room.add(target.model.root);
  const placeholderGeo = new BoxGeometry(), placeholder = figure(placeholderGeo);
  const placeholderGeometry = vi.spyOn(placeholderGeo, 'dispose');
  target.install(placeholder, renderer);
  const oldMaterial = material(placeholder), oldDispose = vi.spyOn(oldMaterial, 'dispose');
  renderer.compile(placeholder.root, new PerspectiveCamera());
  const shared = new BoxGeometry(), key = `practice-fixture:${shared.uuid}`;
  app.assets.register(key, shared); app.assets.acquire(key);
  const sharedDispose = vi.spyOn(shared, 'dispose'), loaded = figure(shared);
  target.install(loaded, renderer);
  const loadedMaterial = material(loaded), loadedDispose = vi.spyOn(loadedMaterial, 'dispose');
  renderer.compile(loaded.root, new PerspectiveCamera());
  expect(oldDispose).toHaveBeenCalledOnce(); expect(placeholderGeometry).toHaveBeenCalledOnce();
  expect(uploads.has(oldMaterial)).toBe(false); expect(uploads.has(loadedMaterial)).toBe(true);
  expect(sceneObjectOwner(loaded.root)?.belongsTo(level)).toBe(true);
  expect(loaded.root.parent).toBe(room); expect(loaded.root.position.toArray()).toEqual([2, 0, 3]);
  level.dispose();
  expect(loadedDispose).toHaveBeenCalledOnce(); expect(sharedDispose).not.toHaveBeenCalled();
  expect(uploads.resources().size).toBe(0); expect(room.children).toHaveLength(0);
  app.assets.release(key); expect(sharedDispose).toHaveBeenCalledOnce();
});
