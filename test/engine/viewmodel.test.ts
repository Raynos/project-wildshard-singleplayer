import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, type Material, type WebGLRenderer } from 'three';
import { ViewmodelRoot } from '../../src/engine/render/viewmodel';
import { legacyDouble } from '../fake/FakeGame';

it('mounts a custom model before the world depth, retaining its camera transform and effects order', () => {
  const scene = new Scene(), camera = new PerspectiveCamera(), root = new ViewmodelRoot();
  scene.add(camera); camera.add(root); camera.position.set(2, 3, 4);
  const model = new Group(), mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()), glow = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ depthWrite: false }));
  glow.renderOrder = 1001; model.position.set(1, 0, -2); model.add(mesh, glow); root.add(model);
  scene.updateMatrixWorld(true);
  expect(mesh.material.transparent).toBe(true); expect(mesh.material.depthWrite).toBe(true);
  expect(glow.material.depthWrite).toBe(false); expect(mesh.renderOrder).toBe(1000); expect(glow.renderOrder).toBe(1001);
  expect(mesh.frustumCulled).toBe(false); expect(mesh.castShadow).toBe(false);
  expect(mesh.matrixWorld.elements.slice(12, 15)).toEqual([3, 3, 2]);
  const clearers = root.children.filter((part) => part instanceof Mesh && part.renderOrder === 999);
  expect(clearers).toHaveLength(1);
  const clearer = clearers[0]; if (!(clearer instanceof Mesh)) throw new Error('Missing shared clearer');
  const clearDepth = vi.fn<() => void>();
  clearer.onBeforeRender(legacyDouble<WebGLRenderer>({ clearDepth }), scene, camera, mesh.geometry, mesh.material, new Group());
  expect(clearDepth).toHaveBeenCalledOnce();
  model.visible = false; scene.updateMatrixWorld(true); expect(clearer.visible).toBe(false);
  model.visible = true; scene.updateMatrixWorld(true); expect(clearer.visible).toBe(true);
  model.removeFromParent(); scene.updateMatrixWorld(true); expect(clearer.visible).toBe(false);
});

it('does not clear for empty or deeply hidden model groups, even with several mounted weapons', () => {
  const root = new ViewmodelRoot(), first = new Group(), second = new Group();
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.visible = false;
  first.add(mesh); root.add(first, second); root.updateMatrixWorld(true);
  const clearer = root.children.find((part) => part.renderOrder === 999); expect(clearer?.visible).toBe(false);
  mesh.visible = true; root.updateMatrixWorld(true); expect(clearer?.visible).toBe(true);
  expect(root.children.filter((part) => part.renderOrder === 999)).toHaveLength(1);
});

it('clones shared opaque materials and prepares a part attached after mounting', () => {
  const root = new ViewmodelRoot(), model = new Group(), source = new MeshBasicMaterial();
  const world = new Mesh(new BoxGeometry(), source), first = new Mesh(new BoxGeometry(), source);
  const compile = vi.fn<Material['onBeforeCompile']>(); source.onBeforeCompile = compile;
  model.add(first); root.add(model);
  expect(world.material).toBe(source); expect(source.transparent).toBe(false);
  expect(first.material).not.toBe(source); expect(first.material.transparent).toBe(true);
  first.material.onBeforeCompile(legacyDouble<Parameters<Material['onBeforeCompile']>[0]>({}), legacyDouble<WebGLRenderer>({}));
  expect(compile).toHaveBeenCalledOnce();
  const late = new Mesh(new BoxGeometry(), source); model.add(late); root.updateMatrixWorld(true);
  expect(late.material).toBe(first.material); expect(late.renderOrder).toBe(1000); expect(late.frustumCulled).toBe(false);
  const copy = late.material; root.updateMatrixWorld(true); expect(late.material).toBe(copy);
  const ready = new MeshBasicMaterial({ transparent: true }), kit = new Mesh(new BoxGeometry(), ready);
  root.add(kit); root.updateMatrixWorld(true); expect(kit.material).toBe(ready);
});
