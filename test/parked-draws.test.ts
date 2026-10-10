import { expect, it } from 'vitest';
import { BoxGeometry, DepthTexture, DirectionalLight, Group, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, PointLight, Scene, UnsignedIntType, WebGLRenderTarget, type Camera, type Object3D, type Texture, type Vector4 } from 'three';
import { SHADOW_LAYER } from '../src/engine/core/shadowLayer';
import { parkedDrawSlices, warmParkedDraws, type ParkedDrawRenderer } from '../src/engine/render/parkedDraws';

const mesh = (material = new MeshStandardMaterial()): Mesh => new Mesh(new BoxGeometry(), material);

it('slices drawables by count and by materials no earlier slice drew', () => {
  const shared = new MeshStandardMaterial();
  const objects = [mesh(shared), mesh(shared), mesh(), mesh(), mesh(shared), mesh()];
  const slices = parkedDrawSlices(objects, { drawables: 3, newMaterials: 2 });
  expect(slices.map(slice => slice.length)).toEqual([3, 3]);
  expect(parkedDrawSlices(objects, { drawables: 8, newMaterials: 1 }).map(slice => slice.length)).toEqual([2, 1, 2, 1]);
  expect(parkedDrawSlices([], { drawables: 8, newMaterials: 2 })).toEqual([]);
});

it('draws only the parked root\'s visible drawables, with every light, into a 1x1 scissor, and restores all state', async () => {
  const scene = new Scene(), road = mesh(), root = new Group(), inner = new Group();
  const a = mesh(), b = mesh(), hidden = mesh(), offLayer = mesh(), cellLight = new PointLight(), sun = new PointLight();
  hidden.visible = false; offLayer.layers.set(9); offLayer.frustumCulled = true; a.frustumCulled = true;
  inner.add(b, hidden); root.add(a, inner, offLayer, cellLight); root.visible = false;
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
