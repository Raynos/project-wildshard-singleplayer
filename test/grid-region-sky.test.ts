// SHARD-PLATFORM G223: a grid region's own sky backdrop laid over the page's one sky (src/engine/world/backdropLayer.ts,
// src/game/grid/regionSky.ts): it blends by the owner weight, and leaving (or re-entering, or disposing) returns the road
// sky exactly.
import { expect, it, vi } from 'vitest';
import { BoxGeometry, BufferGeometry, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial, Sprite, SpriteMaterial, Texture, Vector3 } from 'three';
import { LookupTexture } from 'postprocessing';
import { AssetService } from '../src/engine/app/assets';
import { SceneOwnership, sceneObjectOwner } from '../src/engine/app/sceneOwnership';
import { Scope } from '../src/engine/app/scope';
import type { SkyBackdrop, SkyBackdropTargets } from '../src/engine/render/look';
import { BackdropLayer, LAYER_SKY_ORDER } from '../src/engine/world/backdropLayer';
import type { DayCycleClock } from '../src/engine/world/dayCycle';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import type { FrameSkyLayer } from '../src/game/grid/frameLook';
import { buildRegionSky, regionSkyClaimId } from '../src/game/grid/regionSky';

/** a page's shared sky state, as SkyRig binds it */
function pageTargets(): SkyBackdropTargets {
  return {
    sunDir: new Vector3(0, 1, 0), sunColor: new Color(1, 1, 1), lights: [new DirectionalLight(0xffffff, 3), new DirectionalLight(0xffffff, 3)],
    lightDirection: new Vector3(0, -1, 0), hemi: new HemisphereLight(0x8899aa, 0x443322, 1), fog: new Fog(0xaabbcc, 1, 1e6),
    fogU: { fogSunDir: { value: new Vector3(0, 1, 0) }, fogSunColor: { value: new Color(1, 0.9, 0.8) }, fogDistDensity: { value: 0.001 }, fogHeightDensity: { value: 0.02 } },
    underwater: () => false, disc: new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xffffee })), halo: new Sprite(new SpriteMaterial({ color: 0xffeecc, opacity: 0.5 })),
    cloud: { uSunDir: { value: new Vector3(0, 1, 0) }, uSunColor: { value: new Color(1, 1, 1) }, uCloudLit: { value: new Color(1, 1, 1) }, uCloudAlpha: { value: 0.6 } },
    far: { uHazeCol: { value: new Color(0.6, 0.7, 0.8) }, uSeaSky: { value: new Color(0.5, 0.6, 0.7) }, uSeaSun: { value: new Color(1, 1, 1) }, uSeaSunDir: { value: new Vector3(0, 1, 0) } },
    planet: { uSunDir: { value: new Vector3(0, 1, 0) }, uHaze: { value: new Color(0.2, 0.2, 0.3) }, uCrisp: { value: 1 } },
    shadowBusy: () => false,
  };
}

/** the page's own clock: writes the road's values every frame (a moving sun, so a stale value would show) */
function homeWrite(t: SkyBackdropTargets, scene: Scene, frame: number): void {
  const a = 0.3 + frame * 0.01;
  t.sunDir.set(Math.cos(a), Math.sin(a), 0.2).normalize(); t.sunColor.setRGB(1, 0.95, 0.9);
  t.lightDirection.copy(t.sunDir).negate();
  for (const l of t.lights) { l.color.setRGB(1, 0.97, 0.92); l.intensity = 3 + frame * 0.001; }
  t.hemi.color.setRGB(0.55, 0.65, 0.8); t.hemi.intensity = 1.1;
  t.fog.color.setRGB(0.7, 0.8, 0.95); t.fogU.fogDistDensity.value = 0.0012;
  scene.environmentIntensity = 1;
}

/** a region backdrop: a dome in its scene, an environment, its own clock writing distinct values */
function regionBackdrop(scene: Scene): SkyBackdrop & { disposed: number; bound: SkyBackdropTargets | null; updates: number } {
  const dome = new Mesh(new BoxGeometry(), new ShaderMaterial({ depthTest: false }));
  dome.name = 'region-dome'; dome.renderOrder = -1000;
  scene.add(dome);
  const env = new Texture();
  const b = {
    clock: {} as DayCycleClock, horizon: new Color(), lut: null, disposed: 0, bound: null as SkyBackdropTargets | null, updates: 0,
    bind: (t: SkyBackdropTargets) => { b.bound = t; },
    update: () => {
      b.updates++;
      const t = b.bound;
      if (t === null) return;
      t.sunDir.set(0.6, 0.3, -0.7).normalize(); t.lightDirection.copy(t.sunDir).negate(); t.sunColor.setRGB(1, 0.7, 0.5);
      for (const l of t.lights) { l.color.setRGB(1, 0.75, 0.55); l.intensity = 1.5; }
      t.hemi.color.setRGB(0.4, 0.45, 0.5); t.hemi.intensity = 0.6;
      t.fog.color.setRGB(0.62, 0.6, 0.55); t.fogU.fogDistDensity.value = 0.004;
      scene.environment = env; scene.environmentIntensity = 0.5;
    },
    rebuild: () => undefined, attachPost: () => undefined,
    dispose: () => { b.disposed++; dome.removeFromParent(); },
    gpuBytes: () => 1000, gpuCeiling: () => 4000,
  };
  return b;
}

/** a snapshot of everything shared the layer may move */
function snap(t: SkyBackdropTargets, scene: Scene): unknown {
  return {
    sun: t.sunDir.toArray(), sunColor: t.sunColor.toArray(), dir: t.lightDirection.toArray(), lights: t.lights.map((l) => [...l.color, l.intensity]),
    hemi: [...t.hemi.color, ...t.hemi.groundColor, t.hemi.intensity], fog: t.fog.color.toArray(),
    fogU: [...t.fogU.fogSunDir.value, ...t.fogU.fogSunColor.value, t.fogU.fogDistDensity.value, t.fogU.fogHeightDensity.value],
    disc: t.disc.scale.toArray(), halo: t.halo === null ? null : [t.halo.material.opacity, ...t.halo.scale],
    cloud: [...t.cloud.uSunDir.value, t.cloud.uCloudAlpha.value], far: t.far.uHazeCol.value.toArray(),
    env: scene.environment, envI: scene.environmentIntensity,
  };
}

/** SkyRig.update's order: put back what the layer moved, the page's clock, then the layer */
function frames(t: SkyBackdropTargets, scene: Scene, layer: BackdropLayer | null, from: number, count: number, undo: { fn: (() => void) | null }, camera: PerspectiveCamera): void {
  for (let f = from; f < from + count; f++) {
    undo.fn?.(); undo.fn = null;
    homeWrite(t, scene, f);
    if (layer !== null) undo.fn = layer.apply(1 / 60, camera);
  }
}

it('blends a region backdrop by its weight and returns the road sky exactly on leave, re-entry and dispose', () => {
  const camera = new PerspectiveCamera();
  // the reference: the road with no layer at all
  const refScene = new Scene(), ref = pageTargets();
  const refUndo = { fn: null as (() => void) | null };
  const road: unknown[] = [];
  for (let f = 0; f < 40; f++) { frames(ref, refScene, null, f, 1, refUndo, camera); road.push(snap(ref, refScene)); }

  const scene = new Scene(), page = pageTargets(), regionFog = new Fog(0x000000, 1, 2);
  let disposedLayers = 0;
  const layer = new BackdropLayer({ targets: page, scene }, { air: () => regionFog, onDispose: () => { disposedLayers++; } });
  const backdrop = regionBackdrop(layer.holder);
  layer.attach(backdrop);
  const dome = scene.getObjectByName('region-dome');
  expect(dome?.renderOrder).toBe(LAYER_SKY_ORDER);
  expect(dome instanceof Mesh && dome.material instanceof ShaderMaterial && dome.material.transparent && dome.material.depthTest).toBe(true);
  const undo = { fn: null as (() => void) | null };

  // on the road (weight 0): not run, not drawn, the road exactly
  frames(page, scene, layer, 0, 10, undo, camera);
  expect(backdrop.updates).toBe(0);
  expect(dome?.visible).toBe(false);
  expect(snap(page, scene)).toEqual(road[9]);

  // the edge band (weight 0.5): half way, the dome at half alpha, the environment swapped at half
  layer.weight = 0.5;
  frames(page, scene, layer, 10, 1, undo, camera);
  expect(dome?.visible).toBe(true);
  expect(dome instanceof Mesh && dome.material instanceof ShaderMaterial ? dome.material.blendAlpha : -1).toBe(0.5);
  for (const l of page.lights) expect(l.intensity).toBeCloseTo((3 + 10 * 0.001 + 1.5) / 2, 6);
  expect(page.hemi.intensity).toBeCloseTo((1.1 + 0.6) / 2, 6);
  expect(scene.environment).not.toBeNull();
  // its air goes to the region's own fog object (the frame blends it), never the page fog
  expect(regionFog.color.toArray()).toEqual(new Color(0.62, 0.6, 0.55).toArray());
  expect(page.fog.color.toArray()).toEqual(new Color(0.7, 0.8, 0.95).toArray());

  // inside (weight 1): the region's own light
  layer.weight = 1;
  frames(page, scene, layer, 11, 5, undo, camera);
  expect(page.hemi.intensity).toBeCloseTo(0.6, 9);
  for (const l of page.lights) expect(l.intensity).toBeCloseTo(1.5, 9);
  expect(page.sunDir.distanceTo(new Vector3(0.6, 0.3, -0.7).normalize())).toBeLessThan(1e-9);

  // leave (weight 0): the next frame is the road to the bit
  layer.weight = 0;
  frames(page, scene, layer, 16, 4, undo, camera);
  expect(dome?.visible).toBe(false);
  expect(snap(page, scene)).toEqual(road[19]);

  // re-enter, then leave again: the same
  layer.weight = 1;
  frames(page, scene, layer, 20, 5, undo, camera);
  expect(snap(page, scene)).not.toEqual(road[24]);
  layer.weight = 0;
  frames(page, scene, layer, 25, 3, undo, camera);
  expect(snap(page, scene)).toEqual(road[27]);

  // dispose while inside: the dome leaves, the backdrop frees itself, the next frame is the road
  layer.weight = 1;
  frames(page, scene, layer, 28, 3, undo, camera);
  layer.dispose();
  expect(backdrop.disposed).toBe(1);
  expect(disposedLayers).toBe(1);
  expect(scene.getObjectByName('region-dome')).toBeUndefined();
  frames(page, scene, null, 31, 1, undo, camera);
  expect(snap(page, scene)).toEqual(road[31]);
  expect(layer.apply(1 / 60, camera)).toBeNull();
});

/** a page sky whose layerBackdrop is a real BackdropLayer (SkyRig's own hook needs a WebGL renderer) */
function fakeSky(scene: Scene): { layerBackdrop: (o: { air?: () => Fog | null }) => BackdropLayer; layers: Set<BackdropLayer> } {
  const layers = new Set<BackdropLayer>(), targets = pageTargets();
  return { layers, layerBackdrop: (o) => { const layer: BackdropLayer = new BackdropLayer({ targets, scene }, { ...o, onDispose: () => { layers.delete(layer); } }); layers.add(layer); return layer; } };
}

it('charges a region sky to its owner, refuses without room and frees everything with the resident scope', async () => {
  const hung: FrameSkyLayer[] = [];
  const port = { contribute: () => () => undefined, sky: (_: string, layer: FrameSkyLayer) => { hung.push(layer); return () => { hung.splice(hung.indexOf(layer), 1); }; } };
  const run = (own: boolean, allocator: ResidencyAllocator, scope: Scope, sky: ReturnType<typeof fakeSky>): Promise<string> => buildRegionSky({
    instance: 'cell-a', look: port, allocator, scope,
    layered: () => { if (!own) return Promise.resolve(null); const layer = sky.layerBackdrop({}); return Promise.resolve({ layer, backdrop: regionBackdrop(layer.holder) }); },
  });
  const allocator = new ResidencyAllocator(), scope = new Scope('resident'), sky = fakeSky(new Scene());
  expect(await run(false, allocator, scope, sky)).toBe('off');
  expect(allocator.has(regionSkyClaimId('cell-a'))).toBe(false);
  expect(await run(true, allocator, scope, sky)).toBe('drawn');
  expect(allocator.entries().find((e) => e.id === regionSkyClaimId('cell-a'))).toMatchObject({ bytes: 4000, owner: 'cell-a', category: 'sim', needed: true });
  expect(hung).toHaveLength(1);
  hung[0]?.weight(0.75);
  expect(hung[0]?.state()).toMatchObject({ bytes: 1000, reserved: 4000, weight: 0.75 });
  scope.dispose();
  expect(allocator.has(regionSkyClaimId('cell-a'))).toBe(false);
  expect(hung).toHaveLength(0);
  expect(sky.layers.size).toBe(0);
  // no room: refused, the backdrop freed, nothing hung or reserved
  const full = new ResidencyAllocator({ playing: 1 }), scope2 = new Scope('resident'), sky2 = fakeSky(new Scene());
  expect(await run(true, full, scope2, sky2)).toBe('refused');
  expect(sky2.layers.size).toBe(0);
  expect(hung).toHaveLength(0);
});

it('keeps layered sky geometry under the resident owner when its dome moves onto the retained page', () => {
  const scene = new Scene(), page = new Scope('page'), resident = page.child('resident'), assets = new AssetService();
  const ownership = new SceneOwnership(scene, page, assets); ownership.retain(scene);
  for (let visit = 0; visit < 2; visit++) {
    const layer = new BackdropLayer({ targets: pageTargets(), scene }, { owner: resident, assets, onDispose: () => undefined });
    const backdrop = regionBackdrop(layer.holder), dome = layer.holder.getObjectByName('region-dome');
    if (!(dome instanceof Mesh)) throw new Error('Missing dome');
    const geometry: unknown = dome.geometry;
    if (!(geometry instanceof BufferGeometry)) throw new Error('Missing dome geometry');
    const lut = new LookupTexture(new Uint8Array(32), 2), lutDispose = vi.spyOn(lut, 'dispose');
    const dispose = vi.spyOn(geometry, 'dispose'); layer.attach({ ...backdrop, lut });
    ownership.retainContainer({ grade: { uniforms: { e7Lut: { value: lut } } } });
    expect(assets.isAcquired(lut)).toBe(false);
    expect(sceneObjectOwner(dome)?.belongsTo(resident)).toBe(true);
    ownership.capture(); expect(assets.isAcquired(geometry)).toBe(false);
    layer.dispose(); expect(dispose).toHaveBeenCalledOnce(); expect(lutDispose).toHaveBeenCalledOnce(); expect(scene.getObjectByName('region-dome')).toBeUndefined();
  }
  resident.dispose(); page.dispose(); expect(assets.retained()).toEqual([]);
});

it('draws a layered dome before its own cloud ring, as the backdrop does standalone (SF63)', () => {
  const scene = new Scene();
  const layer = new BackdropLayer({ targets: pageTargets(), scene }, { onDispose: () => undefined });
  const backdrop = regionBackdrop(layer.holder), dome = layer.holder.getObjectByName('region-dome');
  if (!(dome instanceof Mesh)) throw new Error('Missing dome');
  // standalone: an opaque dome at −20, an off-centre transparent ring at −15 inside it (Driftwood's stylized sky)
  dome.renderOrder = -20;
  const ring = new Mesh(new BoxGeometry().translate(900, 200, 300), new ShaderMaterial({ transparent: true, depthWrite: false }));
  ring.name = 'region-ring'; ring.renderOrder = -15; dome.add(ring);
  layer.attach(backdrop);
  expect(dome.renderOrder).toBeLessThan(ring.renderOrder);
  for (const node of [dome, ring]) { expect(node.renderOrder).toBeGreaterThan(-10); expect(node.renderOrder).toBeLessThan(-9); }
  // three's transparent sort: render order first, so the ring's bounding-sphere centre can no longer put it under the dome
  expect(ring.material instanceof ShaderMaterial && ring.material.transparent && ring.material.depthTest).toBe(true);
  layer.dispose();
});
