import { expect, it } from 'vitest';
import { DirectionalLight, Group, Light, PointLight, Scene, PerspectiveCamera, BoxGeometry, Mesh, MeshDepthMaterial, MeshStandardMaterial, WebGLRenderer, DataTexture, Fog, type Object3D } from 'three';
import { includeFutureLights, precompileLevel, registerExteriorLighting, type CompileJob } from '../src/engine/render/precompile';

import { Scope } from '../src/engine/app/scope';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { Game } from '../src/engine/core/Game';
import { EffectComposer } from 'postprocessing';

// Three's compile() collects lights from the visible target and the detached job, with the camera's layer mask.
function lightInputs(target: Scene, root: Object3D, camera: PerspectiveCamera): string[] {
  const result: string[] = [];
  const collect = (object: Object3D): void => {
    if (object instanceof Light && object.layers.test(camera.layers)) result.push(`${object.type}:${String(object.castShadow)}`);
  };
  target.traverseVisible(collect);
  if (root !== target) root.traverseVisible(collect);
  return result.sort();
}

it('warms the exact post-entry light counts without exposing or changing the parked world', () => {
  const page = new Scene(), parked = new Group(), future = new Scene(), camera = new PerspectiveCamera();
  const sun = new DirectionalLight(); sun.castShadow = true;
  page.add(sun, new PointLight(), new PointLight(), parked); parked.add(future); parked.visible = false;
  const points = [new PointLight(0xffa040, 0), new PointLight(0xffa050, 0), new PointLight(0xffa050, 0)];
  future.add(...points);
  const hidden = new PointLight(); hidden.visible = false; future.add(hidden);
  const otherLayer = new PointLight(); otherLayer.layers.set(3); future.add(otherLayer);
  const compileRoot = new Group(), postRoot = new Group();
  const jobs: CompileJob[] = [{ label: 'world', root: compileRoot, target: page, rt: null },
    { label: 'post', root: postRoot, target: null, rt: null }];
  const parents = points.map(light => light.parent);
  const before = lightInputs(page, new Group(), camera);
  includeFutureLights(jobs, page, future);
  expect(lightInputs(page, new Group(), camera)).toEqual(before);
  expect(parked.visible).toBe(false);
  expect(points.map(light => light.parent)).toEqual(parents);
  expect(points.map(light => light.intensity)).toEqual([0, 0, 0]);
  expect(postRoot.children).toHaveLength(0);
  const compiled = lightInputs(page, compileRoot, camera);
  expect(compiled.filter(input => input.startsWith('PointLight:'))).toHaveLength(5);
  expect(compileRoot.children.some(light => points.some(point => point === light))).toBe(false);
  parked.visible = true;
  expect(lightInputs(page, new Group(), camera)).toEqual(compiled);
});

it('does not count visible lights twice or add parked lights to unrelated compile targets', () => {
  const page = new Scene(), future = new Scene(), light = new PointLight();
  page.add(future); future.add(light);
  const root = new Group(), other = new Group();
  const jobs: CompileJob[] = [{ label: 'world', root, target: page, rt: null },
    { label: 'other scene', root: other, target: new Scene(), rt: null }];
  includeFutureLights(jobs, page, future);
  includeFutureLights(jobs, page, page);
  expect(root.children).toHaveLength(0);
  expect(other.children).toHaveLength(0);
  expect(light.parent).toBe(future);
});

it('prepares shadow depths for both the previous road state and the subsequent entered light state', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { render(0); }); return 1; }, cancelFrame: () => undefined });
  const page = new Scene(), future = new Scene(), parked = new Group(), camera = new PerspectiveCamera();
  page.add(new PointLight(), new PointLight(), parked); parked.visible = false; parked.add(future);
  future.add(new PointLight(), new PointLight(), new PointLight());
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial(), caster = new Mesh(geometry, material);
  caster.castShadow = true; future.add(caster);
  const depthCounts = new Set<number>(), litCounts = new Set<number>(), owner = new Scope('warm');
  const composer = new EffectComposer();
  const renderer: unknown = Object.create(WebGLRenderer.prototype), game: unknown = Object.create(Game.prototype);
  if (!(renderer instanceof WebGLRenderer) || !(game instanceof Game)) throw new Error('Fixture prototypes');
  const commands = { shadowMap: { type: 1 }, extensions: { has: () => false }, info: { programs: [] },
    getRenderTarget: () => null, setRenderTarget: () => undefined, initTexture: () => undefined,
    compile: (root: Object3D, view: PerspectiveCamera, target: Scene): void => {
      const count = lightInputs(target, root, view).filter(input => input.startsWith('PointLight:')).length;
      root.traverse(object => { if (object instanceof Mesh) {
        if (object.material instanceof MeshDepthMaterial) depthCounts.add(count);
        if (object.material === material) litCounts.add(count);
      } });
    } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  Reflect.set(game, 'renderer', renderer); Reflect.set(game, 'camera', camera); Reflect.set(game, 'rootScene', page);
  Reflect.set(game, '_composer', composer); Reflect.set(game, 'level', { boot: { shaders: { background: false, post: false } } });
  try {
    await precompileLevel(game, undefined, { chunkCasters: false, futureLighting: future, owner });
    expect(depthCounts).toEqual(new Set([5, 2])); expect(litCounts).toEqual(new Set([5]));
    expect(lightInputs(page, new Group(), camera)).toHaveLength(2); expect(parked.visible).toBe(false);
    expect(caster.parent).toBe(future); expect(future.children.filter(object => object instanceof PointLight)).toHaveLength(3);
  } finally { owner.dispose(); composer.dispose(); material.dispose(); geometry.dispose(); installScopeEnvironment(prior); }
});


it('prepares the actual exterior light and null-environment keys without changing the entered scene', async () => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: render => { queueMicrotask(() => { render(0); }); return 1; }, cancelFrame: () => undefined });
  const page = new Scene(), inside = new Group(), parked = new Group(), camera = new PerspectiveCamera();
  const sun = new DirectionalLight(), fill = new PointLight(), local = new PointLight(), environment = new DataTexture();
  sun.castShadow = true; fill.layers.set(2); camera.layers.enable(2);
  page.environment = environment; page.fog = new Fog(0x112233, 1, 100);
  page.add(sun, fill, inside, parked); inside.add(local); parked.add(new PointLight()); parked.visible = false;
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial(), mesh = new Mesh(geometry, material);
  mesh.castShadow = true; inside.add(mesh);
  const insideOwner = new Scope('inside'), parkedOwner = new Scope('parked'), programsOwner = new Scope('programs');
  registerExteriorLighting(page, insideOwner, inside, null); registerExteriorLighting(page, parkedOwner, parked, null);
  const seen: { lights: string[]; environment: object | null; depth: boolean }[] = [];
  const renderer: unknown = Object.create(WebGLRenderer.prototype), game: unknown = Object.create(Game.prototype);
  if (!(renderer instanceof WebGLRenderer) || !(game instanceof Game)) throw new Error('Fixture prototypes');
  const commands = { shadowMap: { type: 1 }, extensions: { has: () => false }, info: { programs: [] },
    getRenderTarget: () => null, setRenderTarget: () => undefined, initTexture: () => undefined,
    compile: (root: Object3D, view: PerspectiveCamera, target: Scene): void => {
      expect(page.environment).toBe(environment); expect(inside.visible).toBe(true); expect(parked.visible).toBe(false);
      expect(local.parent).toBe(inside); expect(sun.parent).toBe(page);
      root.traverse(object => { if (object instanceof Mesh && (object.material === material || object.material instanceof MeshDepthMaterial)) {
        seen.push({ lights: lightInputs(target, root, view), environment: target.environment, depth: object.material instanceof MeshDepthMaterial });
        if (!(object.material instanceof MeshDepthMaterial)) expect(target.fog).toBe(page.fog);
      } });
    } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  const composer = new EffectComposer();
  Reflect.set(game, 'renderer', renderer); Reflect.set(game, 'camera', camera); Reflect.set(game, 'rootScene', page);
  Reflect.set(game, '_composer', composer); Reflect.set(game, 'level', { boot: { shaders: { background: false, post: false } } });
  try {
    await precompileLevel(game, undefined, { chunkCasters: false, owner: programsOwner });
    const exterior = seen.filter(row => row.environment === null);
    expect(new Set(exterior.map(row => row.depth))).toEqual(new Set([false, true]));
    const interiorCount = seen.filter(row => row.environment === environment).length;
    expect(exterior.every(row => row.lights.join(',') === 'DirectionalLight:true,PointLight:false')).toBe(true);
    expect(seen.filter(row => row.environment === environment).every(row => row.lights.length === 3)).toBe(true);
    // The compiler's exterior inventory equals the real scene after the two content owners leave it.
    inside.visible = false;
    expect(lightInputs(page, new Group(), camera)).toEqual(exterior[0]?.lights);
    inside.visible = true; insideOwner.dispose(); parkedOwner.dispose(); seen.length = 0;
    await precompileLevel(game, undefined, { chunkCasters: false, owner: programsOwner });
    expect(seen).toHaveLength(interiorCount); expect(seen.every(row => row.environment === environment)).toBe(true);
  } finally { insideOwner.dispose(); parkedOwner.dispose(); programsOwner.dispose(); composer.dispose(); material.dispose(); geometry.dispose(); environment.dispose(); installScopeEnvironment(prior); }
});
