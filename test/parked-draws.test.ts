import { expect, it, vi } from 'vitest';
import { BoxGeometry, Color, DepthTexture, DirectionalLight, Group, HalfFloatType, InstancedMesh, Mesh, MeshStandardMaterial, OrthographicCamera, PCFShadowMap, PerspectiveCamera, PointLight, Scene, ShaderMaterial, UnsignedIntType, WebGLRenderTarget, type Camera, type Material, type Object3D, type Texture, type Vector4 } from 'three';
import { SHADOW_LAYER } from '../src/engine/core/shadowLayer';
import { parkedDrawSlices, standInTarget, warmOffscreenPasses, warmParkedDraws, type OffscreenWarmRenderer, type ParkedDrawRenderer } from '../src/engine/render/parkedDraws';
import { registerOffscreenPreparation } from '../src/engine/render/offscreenPreparation';
import { Scope } from '../src/engine/app/scope';
import { buildYield } from '../src/engine/core/workSlice';
import { noteFrameDrawn, setFramePacing } from '../src/engine/core/framePacing';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';

const mesh = (material = new MeshStandardMaterial()): Mesh => new Mesh(new BoxGeometry(), material);

it('slices drawables by count and by materials no earlier slice drew', () => {
  const shared = new MeshStandardMaterial();
  const objects = [mesh(shared), mesh(shared), mesh(), mesh(), mesh(shared), mesh()];
  const slices = parkedDrawSlices(objects, { drawables: 3, newMaterials: 2 });
  expect(slices.map(slice => slice.length)).toEqual([3, 3]);
  expect(parkedDrawSlices(objects, { drawables: 8, newMaterials: 1 }).map(slice => slice.length)).toEqual([2, 1, 2, 1]);
  expect(parkedDrawSlices([], { drawables: 8, newMaterials: 2 })).toEqual([]);
});

it('warms shared static geometry once but preserves material, shadow, callback and per-object buffer draws', async () => {
  const scene = new Scene(), root = new Group(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const shared = new Mesh(geometry, material), transformed = new Mesh(geometry, material), shadow = new Mesh(geometry, material);
  const otherMaterial = new Mesh(geometry, new MeshStandardMaterial()), callback = new Mesh(geometry, material);
  const mirrored = new Mesh(geometry, material), customDepth = new Mesh(geometry, material);
  mirrored.scale.x = -1; customDepth.customDepthMaterial = new MeshStandardMaterial();
  const instances = [new InstancedMesh(geometry, material, 2), new InstancedMesh(geometry, material, 2)];
  transformed.position.x = 20; shadow.castShadow = true; callback.onBeforeRender = () => undefined;
  root.add(shared, transformed, shadow, otherMaterial, callback, mirrored, customDepth, ...instances); root.visible = false; scene.add(root);
  const drawn: Object3D[] = [];
  const renderer: ParkedDrawRenderer = {
    shadowMap: { autoUpdate: false, needsUpdate: false, type: PCFShadowMap },
    render: (tree, camera) => { tree.traverseVisible(object => { if (object instanceof Mesh && object.layers.test(camera.layers)) drawn.push(object); }); },
    getRenderTarget: () => null, setRenderTarget: () => undefined, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getScissor: out => out.set(0, 0, 0, 0), setScissor: () => undefined, getScissorTest: () => false, setScissorTest: () => undefined,
  };
  const count = await warmParkedDraws(renderer, scene, new PerspectiveCamera(), null, root, () => true, () => Promise.resolve(),
    { budget: { drawables: 1, newMaterials: 1 } });
  expect(count).toBe(8); expect(drawn).toEqual([shared, shadow, otherMaterial, callback, mirrored, customDepth, ...instances]);
  expect(transformed.visible).toBe(true); expect(transformed.layers.mask).toBe(1); expect(root.visible).toBe(false);
  geometry.dispose(); material.dispose();
});

it('draws only the parked root\'s visible drawables and camera-visible lights into a 1x1 scissor, and restores all state', async () => {
  const scene = new Scene(), road = mesh(), root = new Group(), inner = new Group();
  const a = mesh(), b = mesh(), hidden = mesh(), offLayer = mesh(), cellLight = new PointLight(), sun = new PointLight(), privateLight = new PointLight();
  privateLight.layers.set(7); privateLight.castShadow = true;
  hidden.visible = false; offLayer.layers.set(9); offLayer.frustumCulled = true; a.frustumCulled = true;
  inner.add(b, hidden); root.add(a, inner, offLayer, cellLight, privateLight); root.visible = false;
  scene.add(road, root, sun);
  const camera = new PerspectiveCamera(), target = new WebGLRenderTarget(64, 64), env: Texture | null = null;
  const seen: { drawn: Object3D[]; lights: Object3D[]; rootVisible: boolean; scissor: Vector4; scissorTest: boolean; shadowAuto: boolean; target: ReturnType<ParkedDrawRenderer['getRenderTarget']> }[] = [];
  let bound: ReturnType<ParkedDrawRenderer['getRenderTarget']> = null;
  const shadowMap = { autoUpdate: true, needsUpdate: true, type: PCFShadowMap };
  const renderer: ParkedDrawRenderer = {
    shadowMap,
    render: (drawn: Object3D, view: Camera) => {
      const visible: Object3D[] = [], lights: Object3D[] = [];
      drawn.traverseVisible(object => {
        if (!object.layers.test(view.layers)) return;
        if (object instanceof PointLight) lights.push(object); else if (object instanceof Mesh) visible.push(object);
      });
      seen.push({ drawn: visible, lights, rootVisible: root.visible, scissor: target.scissor.clone(), scissorTest: target.scissorTest, shadowAuto: shadowMap.autoUpdate, target: bound });
    },
    getRenderTarget: () => bound, setRenderTarget: (next) => { bound = next === target ? target : null; },
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getScissor: (out) => out.set(0, 0, 0, 0), setScissor: () => undefined, getScissorTest: () => false, setScissorTest: () => undefined,
  };
  let pauses = 0;
  const drawn = await warmParkedDraws(renderer, scene, camera, target, root, () => true, () => { pauses++; return Promise.resolve(); },
    { budget: { drawables: 1, newMaterials: 1 }, environment: env });
  expect(drawn).toBe(2); expect(pauses).toBe(2);
  expect(seen.map(s => s.drawn)).toEqual([[a], [b]]);
  for (const s of seen) {
    expect(s.lights.sort((x, y) => x.id - y.id)).toEqual([cellLight, sun].sort((x, y) => x.id - y.id));
    expect(s.rootVisible).toBe(true); expect(s.scissor.toArray()).toEqual([0, 0, 1, 1]); expect(s.scissorTest).toBe(true);
    expect(s.shadowAuto).toBe(false); expect(s.target).toBe(target);
  }
  expect(root.visible).toBe(false); expect(bound).toBe(null);
  expect(target.scissor.toArray()).toEqual([0, 0, 64, 64]); expect(target.scissorTest).toBe(false);
  expect([shadowMap.autoUpdate, shadowMap.needsUpdate]).toEqual([true, true]);
  expect(a.frustumCulled).toBe(true); expect(a.layers.mask).toBe(1); expect(cellLight.layers.mask).toBe(1); expect(offLayer.layers.mask).toBe(1 << 9);
  expect(privateLight.layers.mask).toBe(1 << 7); expect(privateLight.shadow.map).toBeNull();
  await expect(warmParkedDraws(renderer, scene, camera, target, root, () => false, () => Promise.resolve())).rejects.toThrow('Parked draw owner left');
});

it('draws the slice\'s casters into a stand-in of each light\'s shadow map, benches other shadow-only casters, and puts every light back', async () => {
  const scene = new Scene(), roadProxy = mesh(), root = new Group(), caster = mesh(), proxy = mesh(), otherProxy = mesh();
  const sun = new DirectionalLight(), unmapped = new DirectionalLight(), lamp = new PointLight();
  for (const p of [roadProxy, proxy, otherProxy]) { p.castShadow = true; p.layers.set(SHADOW_LAYER); }
  caster.castShadow = true;
  root.add(caster, proxy, otherProxy); root.visible = false;
  sun.castShadow = true; unmapped.castShadow = true; lamp.castShadow = true;
  const real = new WebGLRenderTarget(2048, 2048); real.depthTexture = new DepthTexture(2048, 2048, UnsignedIntType);
  sun.shadow.map = real; sun.shadow.mapSize.set(2048, 2048); sun.shadow.autoUpdate = false; sun.shadow.needsUpdate = false;
  lamp.shadow.map = new WebGLRenderTarget(512, 512);
  scene.add(roadProxy, root, sun, unmapped, lamp);
  let disposed = 0;
  const watched = new Set<unknown>();
  const shadowMap = { autoUpdate: false, needsUpdate: false, type: PCFShadowMap };
  const seen: { map: unknown; size: number[]; auto: boolean; rendererAuto: boolean; others: boolean[]; proxies: boolean[]; casterWarm: boolean }[] = [];
  const renderer: ParkedDrawRenderer = {
    shadowMap, render: () => {
      const standIn = sun.shadow.map;
      if (standIn !== null && !watched.has(standIn)) { watched.add(standIn); standIn.addEventListener('dispose', () => { disposed++; }); }
      seen.push({ map: standIn, size: sun.shadow.mapSize.toArray(), auto: sun.shadow.autoUpdate, rendererAuto: shadowMap.autoUpdate,
        others: [unmapped.shadow.autoUpdate || unmapped.shadow.needsUpdate, lamp.shadow.autoUpdate || lamp.shadow.needsUpdate],
        proxies: [roadProxy, proxy, otherProxy].map(p => p.layers.isEnabled(SHADOW_LAYER)), casterWarm: caster.layers.isEnabled(29) });
    },
    getRenderTarget: () => null, setRenderTarget: () => undefined, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getScissor: (out) => out.set(0, 0, 0, 0), setScissor: () => undefined, getScissorTest: () => false, setScissorTest: () => undefined,
  };
  await warmParkedDraws(renderer, scene, new PerspectiveCamera(), null, root, () => true, () => Promise.resolve(), { budget: { drawables: 2, newMaterials: 8 } });
  expect(seen).toHaveLength(2);
  for (const s of seen) {
    expect(s.map).not.toBe(real); expect(s.map).toBeInstanceOf(WebGLRenderTarget);
    expect(s.size).toEqual([1, 1]); expect(s.auto).toBe(true); expect(s.rendererAuto).toBe(true); expect(s.others).toEqual([false, false]);
  }
  // slice 1 = caster + proxy, slice 2 = otherProxy: a shadow-only caster draws only in its own slice, the road's never
  expect(seen.map(s => s.proxies)).toEqual([[false, true, false], [false, false, true]]);
  expect(seen.map(s => s.casterWarm)).toEqual([true, false]);
  expect(sun.shadow.map).toBe(real); expect(sun.shadow.mapSize.toArray()).toEqual([2048, 2048]);
  expect([sun.shadow.autoUpdate, sun.shadow.needsUpdate]).toEqual([false, false]);
  expect(lamp.shadow.autoUpdate).toBe(true); expect(unmapped.shadow.autoUpdate).toBe(true);
  expect(shadowMap.autoUpdate).toBe(false); expect(disposed).toBe(1);
  for (const p of [roadProxy, proxy, otherProxy]) expect(p.layers.mask).toBe(1 << SHADOW_LAYER);
});

it('a slice that throws ends the warm-up with a logged error, never the entry, and leaves every flag restored', async () => {
  const scene = new Scene(), root = new Group(), a = mesh(), b = mesh(), sun = new DirectionalLight();
  a.castShadow = true; root.add(a, b); root.visible = false; scene.add(root, sun);
  const shadowMap = { autoUpdate: true, needsUpdate: false, type: PCFShadowMap };
  const errors: unknown[][] = [];
  const log = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args); });
  let renders = 0;
  const renderer: ParkedDrawRenderer = {
    shadowMap, render: () => { renders++; if (renders === 2) throw new TypeError('render state is null'); },
    getRenderTarget: () => null, setRenderTarget: () => undefined, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getScissor: (out) => out.set(0, 0, 0, 0), setScissor: () => undefined, getScissorTest: () => false, setScissorTest: () => undefined,
  };
  try {
    const drawn = await warmParkedDraws(renderer, scene, new PerspectiveCamera(), null, root, () => true, () => Promise.resolve(), { budget: { drawables: 1, newMaterials: 8 } });
    expect(drawn).toBe(1); expect(renders).toBe(2);
    expect(errors).toHaveLength(1); expect(errors[0]?.[1]).toBeInstanceOf(TypeError);
    expect(root.visible).toBe(false); expect(b.layers.mask).toBe(1); expect(b.frustumCulled).toBe(true); expect(sun.layers.mask).toBe(1);
    expect(shadowMap.autoUpdate).toBe(true);
    // a left owner still rejects: that is the entry being abandoned, not a failed warm-up
    await expect(warmParkedDraws(renderer, scene, new PerspectiveCamera(), null, root, () => false, () => Promise.resolve())).rejects.toThrow('Parked draw owner left');
  } finally { log.mockRestore(); }
});

it('a stand-in target copies the real target\'s attachment formats at its own size', () => {
  const real = new WebGLRenderTarget(1024, 1024, { type: HalfFloatType, generateMipmaps: true, samples: 4 });
  real.depthTexture = new DepthTexture(1024, 1024, UnsignedIntType);
  const copy = standInTarget(real, 1, 1);
  expect([copy.width, copy.height]).toEqual([1, 1]);
  expect([copy.texture.type, copy.texture.format, copy.texture.generateMipmaps, copy.samples]).toEqual([HalfFloatType, real.texture.format, true, 4]);
  expect([copy.depthTexture?.type, copy.depthTexture?.format]).toEqual([UnsignedIntType, real.depthTexture.format]);
  expect(copy.depthTexture).not.toBe(real.depthTexture);
});

it('draws each offscreen pass once, one caster per program key, into a stand-in, and restores every flag', async () => {
  const LAYER = 7, scene = new Scene(), outer = new Scene(), casters = new Group();
  const shared = new BoxGeometry(), material = new ShaderMaterial(), owner = new Scope('offscreen-warm');
  const a = new Mesh(shared, new MeshStandardMaterial()), twin = new Mesh(shared, new MeshStandardMaterial()), off = new Mesh(shared, new MeshStandardMaterial());
  const herd = new InstancedMesh(shared, new MeshStandardMaterial(), 50);
  for (const m of [a, twin, herd]) { m.layers.enable(LAYER); m.frustumCulled = true; }
  casters.add(a, twin, herd, off); scene.add(casters); outer.add(scene);
  const red = new Color(1, 0, 0);
  scene.background = red;
  const camera = new OrthographicCamera(); camera.layers.set(LAYER);
  const real = new WebGLRenderTarget(2048, 2048); real.depthTexture = new DepthTexture(2048, 2048, UnsignedIntType);
  registerOffscreenPreparation(scene, owner, { label: 'static shadow', camera, material, target: real, positionOnly: true, roots: () => [casters] });
  const shadowMap = { autoUpdate: true, needsUpdate: true };
  let bound: unknown = null;
  const seen: { drawn: Object3D[]; override: Material | null; background: unknown; target: unknown; auto: boolean; herdCount: number; culled: boolean[] }[] = [];
  const renderer: OffscreenWarmRenderer = {
    shadowMap,
    render: (drawn: Object3D, view: Camera) => {
      const visible: Object3D[] = [];
      drawn.traverseVisible(object => { if (object instanceof Mesh && object.layers.test(view.layers)) visible.push(object); });
      seen.push({ drawn: visible, override: scene.overrideMaterial, background: scene.background, target: bound, auto: shadowMap.autoUpdate,
        herdCount: herd.count, culled: [a.frustumCulled, herd.frustumCulled] });
    },
    getRenderTarget: () => null, setRenderTarget: (next) => { bound = next; },
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
  };
  let pauses = 0;
  const drawn = await warmOffscreenPasses(renderer, outer, () => true, () => { pauses++; return Promise.resolve(); });
  // a and its twin share a program key (one draws); the instanced herd is its own key; `off` is not on the pass layer
  expect(drawn).toBe(2); expect(pauses).toBe(1); expect(seen).toHaveLength(1);
  const s = seen[0];
  expect(s?.drawn.map(o => o.id).sort((x, y) => x - y)).toEqual([a.id, herd.id].sort((x, y) => x - y));
  expect(s?.override).toBe(material); expect(s?.background).toBe(null); expect(s?.auto).toBe(false);
  const standIn = s?.target;
  if (!(standIn instanceof WebGLRenderTarget)) throw new Error('Expected a stand-in target');
  expect(standIn).not.toBe(real); expect([standIn.width, standIn.height]).toEqual([1, 1]);
  expect(standIn.depthTexture?.type).toBe(UnsignedIntType);
  expect(s?.herdCount).toBe(1); expect(s?.culled).toEqual([false, false]);
  expect(scene.overrideMaterial).toBe(null); expect(scene.background).toBe(red); expect(bound).toBe(null);
  expect([shadowMap.autoUpdate, shadowMap.needsUpdate]).toEqual([true, true]);
  expect(herd.count).toBe(50); expect([a.frustumCulled, herd.frustumCulled]).toEqual([true, true]);
  expect(twin.layers.isEnabled(LAYER)).toBe(true);
  await expect(warmOffscreenPasses(renderer, outer, () => false, () => Promise.resolve())).rejects.toThrow('Offscreen warm owner left');
  owner.dispose();
  expect(await warmOffscreenPasses(renderer, outer, () => true, () => Promise.resolve())).toBe(0);
});

it('defers a hidden sibling override pass without changing its caster or target', async () => {
  const page = new Scene(), hidden = new Group(), scene = new Scene(), owner = new Scope('parked-offscreen');
  hidden.visible = false; page.add(hidden); hidden.add(scene);
  const geometry = new BoxGeometry(), source = new MeshStandardMaterial(), caster = new Mesh(geometry, source), material = new ShaderMaterial();
  scene.add(caster);
  const camera = new PerspectiveCamera(), target = new WebGLRenderTarget(32, 32);
  registerOffscreenPreparation(scene, owner, { label: 'held-pass', camera, material, target, roots: () => [caster] });
  const drawn: Object3D[] = [];
  const renderer: OffscreenWarmRenderer = { shadowMap: { autoUpdate: true, needsUpdate: false },
    render: object => { drawn.push(object); }, getRenderTarget: () => null, setRenderTarget: () => undefined,
    getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0 };
  try {
    expect(await warmOffscreenPasses(renderer, page, () => true, () => Promise.resolve(), new Set([hidden]))).toBe(0);
    expect(drawn).toHaveLength(0); expect(hidden.visible).toBe(false); expect(caster.parent).toBe(scene);
    expect(await warmOffscreenPasses(renderer, page, () => true, () => Promise.resolve())).toBe(1);
    expect(drawn).toEqual([scene]); expect([target.width, target.height]).toEqual([32, 32]);
  } finally { owner.dispose(); target.dispose(); material.dispose(); source.dispose(); geometry.dispose(); }
});


it('shares cheap parked draws within the real construction budget and restores visibility at every yield', async () => {
  const previous = scopeEnvironment(), oldRaf: unknown = Reflect.get(globalThis, 'requestAnimationFrame');
  const owner = new Scope('paced-parked'), scene = new Scene(), root = new Group();
  const objects = [mesh(), mesh(), mesh(), mesh()]; root.add(...objects); root.visible = false; scene.add(root);
  let now = 9_000_000, frames = 0, draws = 0, pauses = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  Reflect.set(globalThis, 'requestAnimationFrame', () => 1);
  installScopeEnvironment({ ...previous, frame: fn => {
    frames++;
    queueMicrotask(() => { now += 1000 / 30; noteFrameDrawn(now, now, 30); fn(now); });
    return frames;
  }, cancelFrame: () => undefined });
  const renderer: ParkedDrawRenderer = {
    shadowMap: { autoUpdate: false, needsUpdate: false, type: PCFShadowMap },
    render: () => { draws++; now += 3; },
    getRenderTarget: () => null, setRenderTarget: () => undefined, getActiveCubeFace: () => 0, getActiveMipmapLevel: () => 0,
    getScissor: out => out.set(0, 0, 0, 0), setScissor: () => undefined, getScissorTest: () => false, setScissorTest: () => undefined,
  };
  try {
    setFramePacing(true); noteFrameDrawn(now, now, 30);
    const drawn = await warmParkedDraws(renderer, scene, new PerspectiveCamera(), null, root, () => !owner.disposed, async () => {
      expect(root.visible).toBe(false); pauses++; await buildYield(owner);
    }, { budget: { drawables: 1, newMaterials: 1 } });
    expect(drawn).toBe(4); expect(draws).toBe(4); expect(pauses).toBe(4);
    expect(frames).toBe(1); // Cheap draws share tasks; the third spends the shared 8 ms and owes a real frame.
    expect(owner.census).toMatchObject({ listeners: 0, timers: 0, rafs: 0, disposers: 0 });
    owner.dispose();
    await expect(warmParkedDraws(renderer, scene, new PerspectiveCamera(), null, root,
      () => !owner.disposed, () => buildYield(owner))).rejects.toThrow('Parked draw owner left');
  } finally {
    owner.dispose(); setFramePacing(false); installScopeEnvironment(previous); clock.mockRestore();
    if (oldRaf === undefined) Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    else Reflect.set(globalThis, 'requestAnimationFrame', oldRaf);
    for (const object of objects) {
      object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    }
  }
});
