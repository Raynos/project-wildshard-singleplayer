import { expect, test } from 'vitest';
import { BoxGeometry, DirectionalLight, Fog, Mesh, MeshStandardMaterial, PerspectiveCamera, PointLight, Scene, Texture, WebGLRenderer } from 'three';
import { compileTarget, liveProgramReceipts, sceneJobs } from './precompile';

/** A renderer double whose property store says whether each material holds a compiled program. */
function renderer(compiled: Set<object>): WebGLRenderer {
  const made: unknown = Object.create(WebGLRenderer.prototype);
  if (!(made instanceof WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = { toneMapping: 0, shadowMap: { enabled: true, type: 1 }, localClippingEnabled: false, clippingPlanes: [],
    properties: { get: (material: object) => ({ programs: new Map(compiled.has(material) ? [['key', {}]] : []) }) } };
  for (const [key, value] of Object.entries(fields)) Reflect.set(made, key, value);
  return made;
}

test('a live warm-up builds no scene job for a pair its receipts show compiled under the same page state (G782)', () => {
  const geometry = new BoxGeometry(), a = new MeshStandardMaterial(), b = new MeshStandardMaterial(), scene = new Scene();
  scene.add(new Mesh(geometry, a), new Mesh(geometry, b));
  const compiled = new Set<object>([a, b]), page = renderer(compiled);
  const first = sceneJobs(scene, null, 1, [scene], undefined, liveProgramReceipts(page, scene, null).skip);
  expect(first.jobs).toHaveLength(2);
  for (const job of first.jobs) job.kind = 'scene-entered';
  liveProgramReceipts(page, scene, null).record(first.jobs);
  // the same page state: nothing left to compile
  expect(sceneJobs(scene, null, 1, [scene], undefined, liveProgramReceipts(page, scene, null).skip).jobs).toHaveLength(0);
  // a material changed since (its version), or one whose program is gone, compiles again
  a.needsUpdate = true; compiled.delete(b);
  expect(sceneJobs(scene, null, 1, [scene], undefined, liveProgramReceipts(page, scene, null).skip).jobs).toHaveLength(2);
  // other lighting is another program state: every pair compiles under it
  compiled.add(b);
  const second = sceneJobs(scene, null, 1, [scene], undefined, liveProgramReceipts(page, scene, null).skip).jobs;
  for (const job of second) job.kind = 'scene-other';
  liveProgramReceipts(page, scene, null).record(second);
  scene.add(new DirectionalLight());
  expect(sceneJobs(scene, null, 1, [scene], undefined, liveProgramReceipts(page, scene, null).skip).jobs).toHaveLength(2);
  geometry.dispose(); a.dispose(); b.dispose();
});

test('a live warm-up compiles against a stand-in with the page\'s light state, fog and environment, not its world (G782)', () => {
  const scene = new Scene(), camera = new PerspectiveCamera(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const sun = new DirectionalLight(); sun.castShadow = true;
  const hidden = new PointLight(); hidden.visible = false;
  const elsewhere = new PointLight(); elsewhere.layers.set(3);
  scene.add(sun, new PointLight(), hidden, elsewhere, new Mesh(geometry, material));
  scene.fog = new Fog(0xffffff); scene.environment = new Texture();
  const target = compileTarget(scene, camera);
  // only the lights a frame would gather, in kind and shadow; no meshes
  expect(target.children.map(child => `${child.type}${child.castShadow ? '*' : ''}`).sort()).toEqual(['DirectionalLight*', 'PointLight']);
  expect(target.fog).toBe(scene.fog); expect(target.environment).toBe(scene.environment);
  expect(sun.parent).toBe(scene);
  geometry.dispose(); material.dispose(); scene.environment.dispose();
});
