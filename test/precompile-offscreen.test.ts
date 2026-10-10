import { expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Color, type Camera, type Object3D, Group, InstancedMesh, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, Scene, ShaderMaterial, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Scope } from '../src/engine/app/scope';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { offscreenPreparations, registerOffscreenPreparation } from '../src/engine/render/offscreenPreparation';
import { offscreenJobs, runPrecompile } from '../src/engine/render/precompile';

it('borrows each real override variant and pass target without changing casters or drawing', () => {
  const page = new Scene(), scene = new Scene(), root = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  page.add(scene); scene.add(root); scene.visible = false;
  const plain = new Mesh(geometry, material), instanced = new InstancedMesh(geometry, material, 1);
  instanced.setColorAt(0, new Color(0.4, 0.5, 0.6));
  const batch = new BatchedMesh(1, geometry.getAttribute('position').count, geometry.index?.count ?? 0, material);
  batch.setColorAt(batch.addInstance(batch.addGeometry(geometry)), new Color(0.2, 0.3, 0.4));
  root.add(plain, instanced, batch);
  for (const mesh of [plain, instanced, batch]) mesh.layers.enable(7);
  const hidden = new Mesh(geometry, material); hidden.layers.enable(7); hidden.visible = false; root.add(hidden);
  root.add(new Mesh(geometry, material)); // outside the pass's layer
  const nonOverride = new Mesh(geometry, new MeshBasicMaterial()); nonOverride.material.allowOverride = false;
  nonOverride.layers.enable(7); root.add(nonOverride);
  const invisibleMaterial = new MeshBasicMaterial({ visible: false }), noNormals = new BoxGeometry(); noNormals.deleteAttribute('normal'); noNormals.clearGroups();
  const invisible = new Mesh(noNormals, invisibleMaterial), noGroups = new Mesh(noNormals, [material]);
  for (const mesh of [invisible, noGroups]) { mesh.layers.enable(7); root.add(mesh); }
  const owner = new Scope('offscreen'), camera = new OrthographicCamera(), target = new WebGLRenderTarget(); camera.layers.set(7);
  const override = new ShaderMaterial({ vertexShader: 'void main(){gl_Position=vec4(position,1.0);}', fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}' });
  const before = { vertex: override.vertexShader, fragment: override.fragmentShader, version: override.version };
  const dispose = vi.spyOn(override, 'dispose'), geometryDispose = vi.spyOn(geometry, 'dispose');
  const pass = { label: 'fixture', camera, material: override, target, roots: () => [root] };
  registerOffscreenPreparation(scene, owner, pass);
  const jobs = offscreenJobs(page, 2), clones = jobs.flatMap(job => job.root.children);
  expect(clones).toHaveLength(3); expect(jobs).toHaveLength(2);
  expect(clones.filter(mesh => mesh instanceof InstancedMesh)).toHaveLength(1);
  const colored = clones.find(mesh => mesh instanceof InstancedMesh);
  expect(colored instanceof InstancedMesh && colored.instanceColor?.array).toEqual(instanced.instanceColor?.array);
  expect(clones.filter(mesh => mesh instanceof BatchedMesh)).toHaveLength(1);
  for (const clone of clones) {
    expect(clone instanceof Mesh && clone.material).toBe(override);
    if (clone instanceof BatchedMesh) expect(clone.geometry.getAttribute('position').array).toEqual(batch.geometry.getAttribute('position').array);
    else expect(clone instanceof Mesh && clone.geometry).toBe(geometry);
  }
  for (const job of jobs) { expect(job.camera).toBe(camera); expect(job.rt).toBe(target); expect(job.target).toBe(scene); }
  expect([plain.parent, instanced.parent, batch.parent]).toEqual([root, root, root]);
  expect(scene.visible).toBe(false); expect(scene.overrideMaterial).toBeNull();
  expect({ vertex: override.vertexShader, fragment: override.fragmentShader, version: override.version }).toEqual(before);
  owner.dispose(); expect(offscreenJobs(page)).toEqual([]); expect(dispose).not.toHaveBeenCalled(); expect(geometryDispose).not.toHaveBeenCalled();
  expect(() => registerOffscreenPreparation(scene, owner, pass)).toThrow('live owner');
  target.dispose(); override.dispose(); geometry.dispose(); material.dispose(); nonOverride.material.dispose(); invisibleMaterial.dispose(); noNormals.dispose();
});

it('collects streamed casters at preparation time, and refuses duplicate registration', () => {
  const scene = new Scene(), root = new Group(), owner = new Scope('streamed'), camera = new OrthographicCamera();
  const target = new WebGLRenderTarget(), material = new ShaderMaterial(), geometry = new BoxGeometry();
  const pass = { label: 'streamed', camera, material, target, roots: () => [root] };
  registerOffscreenPreparation(scene, owner, pass);
  expect(offscreenJobs(scene)).toEqual([]);
  root.add(new Mesh(geometry, material));
  expect(offscreenJobs(scene).flatMap(job => job.root.children)).toHaveLength(1);
  expect(() => registerOffscreenPreparation(scene, owner, pass)).toThrow('already registered');
  owner.dispose(); expect(offscreenPreparations(scene)).toEqual([]);
  target.dispose(); material.dispose(); geometry.dispose();
});

it('issues offscreen jobs with their own camera and restores the previous render target', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { render(0); }); return 1; }, cancelFrame: () => undefined });
  const renderer: unknown = Object.create(WebGLRenderer.prototype);
  if (!(renderer instanceof WebGLRenderer)) throw new Error('Renderer prototype');
  const scene = new Scene(), root = new Group(), material = new ShaderMaterial(), geometry = new BoxGeometry();
  root.add(new Mesh(geometry, material));
  const owner = new Scope('camera'), camera = new OrthographicCamera(), target = new WebGLRenderTarget(), previous = new WebGLRenderTarget();
  registerOffscreenPreparation(scene, owner, { label: 'camera', camera, material, target, roots: () => [root] });
  let active = previous;
  const compile = vi.fn((_root: Object3D, selected: Camera, selectedScene: Scene) => { expect(selected).toBe(camera); expect(selectedScene).toBe(scene); expect(active).toBe(target); });
  const commands = { extensions: { has: () => false }, info: { programs: [] }, getRenderTarget: () => active,
    setRenderTarget: (value: WebGLRenderTarget) => { active = value; }, compile };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  try { await runPrecompile(renderer, new PerspectiveCamera(), offscreenJobs(scene), 1); }
  finally { installScopeEnvironment(prior); owner.dispose(); target.dispose(); previous.dispose(); material.dispose(); geometry.dispose(); }
  expect(compile).toHaveBeenCalledOnce(); expect(active).toBe(previous);
});

it('prepares the live representative flags for a position-only override without extra unused attribute programs', () => {
  const scene = new Scene(), root = new Group(), owner = new Scope('position-only'), camera = new OrthographicCamera();
  const target = new WebGLRenderTarget(), material = new ShaderMaterial(), geometry = new BoxGeometry(), corners = new BoxGeometry();
  corners.deleteAttribute('normal'); corners.deleteAttribute('uv');
  const solid = new Mesh(geometry, material), smoke = new Mesh(corners, material);
  root.add(solid, smoke);
  registerOffscreenPreparation(scene, owner, { label: 'position-only', camera, material, target, roots: () => [root], positionOnly: true });
  const jobs = offscreenJobs(scene), clones = jobs.flatMap(job => job.root.children);
  expect(clones).toHaveLength(1);
  const representative = clones[0];
  expect(representative instanceof Mesh && representative.geometry).toBe(geometry);
  expect(representative instanceof Mesh && representative.material).toBe(material);
  expect(smoke.geometry.getAttribute('normal')).toBeUndefined();
  owner.dispose(); target.dispose(); material.dispose(); geometry.dispose(); corners.dispose();
});
