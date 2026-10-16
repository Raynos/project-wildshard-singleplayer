import { expect, test } from 'vitest';
import { Bone, BoxGeometry, DirectionalLight, WebGLRenderTarget, InstancedMesh, Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, Scene, Skeleton, SkinnedMesh, type Material } from 'three';
import { holdShadowRedraw, sceneJobs, shadowJobs } from '../src/engine/render/precompile';

test('preparation retains both shadow-receiver variants of a shared material', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const plain = new Mesh(geometry, material), receiver = new Mesh(geometry, material), duplicate = new Mesh(geometry, material);
  receiver.receiveShadow = true;
  scene.add(plain, receiver, duplicate);
  const { jobs, materials } = sceneJobs(scene, null);
  const copies = jobs.flatMap(job => job.root.children);
  expect(materials).toBe(1);
  expect(copies).toHaveLength(2);
  expect(copies.map(copy => copy.receiveShadow)).toEqual([false, true]);
  expect(scene.children).toEqual([plain, receiver, duplicate]);
  expect(plain.receiveShadow).toBe(false); expect(receiver.receiveShadow).toBe(true);
  geometry.dispose(); material.dispose();
});

test('preparation covers distinct skin array lengths without splitting instance counts', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const first = new SkinnedMesh(geometry, material), second = new SkinnedMesh(geometry, material);
  first.bind(new Skeleton([new Bone(), new Bone()]));
  second.bind(new Skeleton([new Bone(), new Bone(), new Bone()]));
  const small = new InstancedMesh(geometry, material, 3), large = new InstancedMesh(geometry, material, 5);
  scene.add(first, second, small, large);
  const { jobs } = sceneJobs(scene, null);
  const copies = jobs.flatMap(job => job.root.children);
  expect(copies).toHaveLength(3);
  expect(copies.filter((copy): copy is SkinnedMesh => copy instanceof SkinnedMesh).map(copy => copy.skeleton.bones.length)).toEqual([2, 3]);
  expect(copies.filter(copy => copy instanceof InstancedMesh)).toHaveLength(1);
  first.skeleton.dispose(); second.skeleton.dispose(); small.dispose(); large.dispose();
  geometry.dispose(); material.dispose();
});

test('shadow preparation compiles the depth variant a registered shadow draw substitutes (sp-o289)', () => {
  const scene = new Scene(), geometry = new BoxGeometry(), moving = new MeshStandardMaterial(), still = new MeshStandardMaterial();
  const a = new Mesh(geometry, moving), b = new Mesh(geometry, moving), c = new Mesh(geometry, still);
  for (const mesh of [a, b, c]) mesh.castShadow = true;
  scene.add(a, b, c);
  const variant = new MeshBasicMaterial(), stocks: MeshDepthMaterial[] = [];
  const resolve = (source: Material, stock: MeshDepthMaterial): Material | null => {
    if (source !== moving) return null;
    stocks.push(stock); variant.side = stock.side; return variant;
  };
  const jobs = shadowJobs(scene, null, 6, undefined, resolve);
  const prepared = jobs.filter(job => job.prepare !== undefined);
  expect(prepared).toHaveLength(1);
  const copy = prepared[0]?.root.children[0];
  if (!(copy instanceof Mesh)) throw new Error('graph depth job has no caster');
  variant.side = 0; prepared[0]?.prepare?.();
  expect(copy.material).toBe(variant);
  expect(variant.side).toBe(stocks.at(-1)?.side);
  // the still material keeps a stock depth caster
  expect(jobs.flatMap(job => job.root.children).some(child => child instanceof Mesh && child.material instanceof MeshDepthMaterial)).toBe(true);
  for (const job of jobs) job.dispose?.();
  geometry.dispose(); moving.dispose(); still.dispose(); variant.dispose();
});

test('a warm-up compile holds the shadow redraw only where every caster light has its map (sp-o289)', () => {
  const scene = new Scene(), light = new DirectionalLight(), root = new Scene();
  light.castShadow = true; scene.add(light);
  const shadowMap = { enabled: true, autoUpdate: true, needsUpdate: false };
  expect(holdShadowRedraw({ shadowMap }, root, scene)).toBeUndefined();
  const map = new WebGLRenderTarget(1, 1); light.shadow.map = map;
  const restore = holdShadowRedraw({ shadowMap }, root, scene);
  expect(shadowMap.autoUpdate).toBe(false);
  restore?.();
  expect(shadowMap).toEqual({ enabled: true, autoUpdate: true, needsUpdate: false });
  map.dispose();
});
