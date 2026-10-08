// SHARD-PLATFORM G242 (Jake's pick B, "grid dawn"): the road's own dome and key light are a base layer on the page's one
// sky (src/game/grid/roadSky.ts, src/engine/world/backdropLayer.ts `applyLayers`). Across a cell's edge band the road blends
// straight into the region's own sky (nothing of the page shows through), and at road weight 0 the page and the region are
// exactly what they were without it.
import { expect, it } from 'vitest';
import { BoxGeometry, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial, Sprite, SpriteMaterial, Texture, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import type { SkyBackdropTargets } from '../src/engine/render/look';
import { BASE_SKY_ORDER, BackdropLayer, LAYER_SKY_ORDER, applyLayers, type LayeredSkyBackdrop } from '../src/engine/world/backdropLayer';
import { compassDir } from '../src/engine/world/dayCycle';
import { GridFrame } from '../src/game/grid/frame';
import { ROAD_SKY } from '../src/game/grid/frameModel';
import { ROAD_SKY_ORDER, RoadSky, RoadSkyBackdrop, roadSunDir } from '../src/game/grid/roadSky';

function pageTargets(): SkyBackdropTargets {
  return {
    sunDir: new Vector3(0, 1, 0), sunColor: new Color(1, 1, 1), lights: [new DirectionalLight(0xffffff, 3)],
    lightDirection: new Vector3(0, -1, 0), hemi: new HemisphereLight(0x8899aa, 0x443322, 1), fog: new Fog(0xaabbcc, 1, 1e6),
    fogU: { fogSunDir: { value: new Vector3(0, 1, 0) }, fogSunColor: { value: new Color(1, 0.9, 0.8) }, fogDistDensity: { value: 0.001 }, fogHeightDensity: { value: 0.02 } },
    underwater: () => false, disc: new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xffffee })), halo: new Sprite(new SpriteMaterial({ color: 0xffeecc, opacity: 0.5 })),
    cloud: { uSunDir: { value: new Vector3(0, 1, 0) }, uSunColor: { value: new Color(1, 1, 1) }, uCloudLit: { value: new Color(1, 1, 1) }, uCloudAlpha: { value: 0.6 } },
    far: { uHazeCol: { value: new Color(0.6, 0.7, 0.8) }, uSeaSky: { value: new Color(0.5, 0.6, 0.7) }, uSeaSun: { value: new Color(1, 1, 1) }, uSeaSunDir: { value: new Vector3(0, 1, 0) } },
    planet: { uSunDir: { value: new Vector3(0, 1, 0) }, uHaze: { value: new Color(0.2, 0.2, 0.3) }, uCrisp: { value: 1 } },
    shadowBusy: () => false,
  };
}

/** the page's own clock (the shell's fixed sky): its values every frame */
function pageWrite(t: SkyBackdropTargets): void {
  t.sunDir.set(0.3, 0.8, 0.2).normalize(); t.lightDirection.copy(t.sunDir).negate(); t.sunColor.setRGB(1, 1, 1);
  for (const l of t.lights) { l.color.setRGB(1, 1, 1); l.intensity = 3; }
  t.hemi.intensity = 1;
}

/** a region's own sky: a dome and a clock writing its own light */
function regionBackdrop(holder: Scene): LayeredSkyBackdrop {
  const dome = new Mesh(new BoxGeometry(), new ShaderMaterial());
  dome.name = 'region-dome'; holder.add(dome);
  let bound: SkyBackdropTargets | null = null;
  return {
    lut: null, rebuild: () => undefined,
    bind: (t) => { bound = t; },
    update: () => {
      if (bound === null) return;
      bound.sunDir.set(-0.5, 0.4, 0.1).normalize(); bound.lightDirection.copy(bound.sunDir).negate();
      for (const l of bound.lights) l.intensity = 1.5;
      bound.hemi.intensity = 0.4;
    },
  };
}

const camera = new PerspectiveCamera();

/** SkyRig.update's order: put back last frame's moves, the page's clock, then every layer (`applyLayers`) */
function frame(t: SkyBackdropTargets, layers: readonly BackdropLayer[], undo: (() => void)[]): void {
  for (let i = undo.length - 1; i >= 0; i--) undo[i]?.();
  undo.length = 0;
  pageWrite(t);
  undo.push(...applyLayers(layers, 1 / 60, camera));
}

function setup(): { page: SkyBackdropTargets; scene: Scene; road: BackdropLayer; region: BackdropLayer; sky: RoadSky; undo: (() => void)[] } {
  const page = pageTargets(), scene = new Scene();
  const region = new BackdropLayer({ targets: page, scene }, { air: () => new Fog(0), onDispose: () => undefined });
  region.attach(regionBackdrop(region.holder));
  // the road's layer laid after the region's (the order the frame meets them in does not matter)
  const road = new BackdropLayer({ targets: page, scene }, { base: true, air: () => new Fog(0), onDispose: () => undefined });
  const sky = new RoadSky();
  sky.attach({ scene, sky: () => ({ layerBackdrop: () => road }) });
  return { page, scene, road, region, sky, undo: [] };
}

const SUN = compassDir(ROAD_SKY.sun.azimuth, ROAD_SKY.sun.elevation);

it('the road sun is the engine compass direction', () => { expect(roadSunDir(70, 13).distanceTo(SUN)).toBeLessThan(1e-12); });

it('on the road the road owns the key light and fill; inside the cell the region does; the page never shows through', () => {
  const { page, road, region, sky, undo } = setup();
  const layers = [region, road];
  // on the road: the road's dawn sun exactly
  sky.weight(1); region.weight = 0; frame(page, layers, undo);
  expect(page.sunDir.distanceTo(SUN)).toBeLessThan(1e-9);
  expect(page.lights[0]?.intensity).toBeCloseTo(ROAD_SKY.sun.intensity, 9);
  expect(page.hemi.intensity).toBeCloseTo(ROAD_SKY.hemi.intensity, 9);
  expect(sky.drawn).toBe(1);
  // on the edge line: half the road, half the region, none of the page (its intensity is 3)
  sky.weight(0.5); region.weight = 0.5; frame(page, layers, undo);
  expect(road.state().applied).toBe(1); // the road's share of what the region leaves
  expect(page.lights[0]?.intensity).toBeCloseTo((ROAD_SKY.sun.intensity + 1.5) / 2, 9);
  expect(page.hemi.intensity).toBeCloseTo((ROAD_SKY.hemi.intensity + 0.4) / 2, 9);
  // a quarter of the way in
  sky.weight(0.25); region.weight = 0.75; frame(page, layers, undo);
  expect(page.lights[0]?.intensity).toBeCloseTo(0.25 * ROAD_SKY.sun.intensity + 0.75 * 1.5, 9);
  // inside: the region alone, the road off
  sky.weight(0); region.weight = 1; frame(page, layers, undo);
  expect(road.state().applied).toBe(0); expect(sky.drawn).toBe(0);
  expect(page.lights[0]?.intensity).toBeCloseTo(1.5, 9);
});

it('at road weight 0 the page and the region are exactly what they were without the road layer; leaving gives the road back', () => {
  const a = setup(), b = setup();
  const snap = (t: SkyBackdropTargets): unknown => [t.sunDir.toArray(), t.lightDirection.toArray(), t.lights.map((l) => [...l.color, l.intensity]), [...t.hemi.color, ...t.hemi.groundColor, t.hemi.intensity], t.fogU.fogSunColor.value.toArray(), t.fogU.fogSunDir.value.toArray()];
  // inside the cell, with and without the road layer
  a.sky.weight(0); a.region.weight = 1; b.region.weight = 1;
  for (let i = 0; i < 3; i++) { frame(a.page, [a.region, a.road], a.undo); frame(b.page, [b.region], b.undo); }
  expect(snap(a.page)).toEqual(snap(b.page));
  // on the road before entering and after leaving: identical
  a.sky.weight(1); a.region.weight = 0; frame(a.page, [a.region, a.road], a.undo);
  const before = snap(a.page);
  a.sky.weight(0); a.region.weight = 1; frame(a.page, [a.region, a.road], a.undo);
  a.sky.weight(1); a.region.weight = 0; frame(a.page, [a.region, a.road], a.undo);
  expect(snap(a.page)).toEqual(before);
});

it('a cell with no sky of its own keeps its share of the page (the road takes only its own weight)', () => {
  const { page, road, sky, undo } = setup();
  sky.weight(0.5); frame(page, [road], undo);
  expect(road.state().applied).toBe(0.5);
  expect(page.lights[0]?.intensity).toBeCloseTo((ROAD_SKY.sun.intensity + 3) / 2, 9);
});

it('the dome: one shader, no textures, drawn under every region sky by a constant blend alpha', () => {
  const { scene, road, region, sky, page, undo } = setup();
  const dome = scene.getObjectByName('road-sky'), regionDome = scene.getObjectByName('region-dome');
  expect(dome?.renderOrder).toBe(BASE_SKY_ORDER); expect(ROAD_SKY_ORDER).toBe(BASE_SKY_ORDER);
  expect(regionDome?.renderOrder).toBe(LAYER_SKY_ORDER); expect(BASE_SKY_ORDER).toBeLessThan(LAYER_SKY_ORDER - 0.4);
  if (!(dome instanceof Mesh) || !(dome.material instanceof ShaderMaterial)) throw new Error('the road dome is one shader mesh');
  const uniforms: unknown[] = Object.values(dome.material.uniforms).map((u: { value: unknown }) => u.value);
  expect(uniforms.some((v) => v instanceof Texture)).toBe(false);
  sky.weight(0.5); region.weight = 0.5; frame(page, [region, road], undo);
  expect(dome.visible).toBe(true); expect(dome.material.blendAlpha).toBe(1);
  sky.weight(1); region.weight = 0; frame(page, [region, road], undo);
  expect(regionDome?.visible).toBe(false); expect(dome.material.blendAlpha).toBe(1);
  sky.weight(0); region.weight = 1; frame(page, [region, road], undo);
  expect(dome.visible).toBe(false);
  sky.dispose();
  expect(scene.getObjectByName('road-sky')).toBeUndefined();
});

it('the frame lays the road sky on the page sky rig once it is built, and draws the dome alone until then', () => {
  const scene = new Scene(), scope = new Scope('g242-road-sky'), page = pageTargets();
  scene.fog = new Fog(0x88aacc, 10, 100);
  let built = false, warmed = 0;
  const road = new BackdropLayer({ targets: page, scene }, { base: true, onDispose: () => undefined });
  const feet = { x: 300, z: 0 };
  const grid = new GridFrame({ host: { scene, camera, composer: () => { throw new Error('not built'); }, post: () => null,
    sky: () => { if (!built) throw new Error('Game.sky read before buildSky()'); return { layerBackdrop: () => road, warm: () => { warmed++; } }; } },
  scope, cells: [{ instance: '0,0', origin: { x: 0, z: 0 } }], home: { instance: '0,0', origin: { x: 0, z: 0 } }, half: 250, feet: () => feet });
  grid.frame();
  expect(grid.state().roadSky).toBe(1); // alone on the scene
  expect(scene.getObjectByName('road-sky')?.parent).toBe(scene);
  built = true; grid.frame();
  expect(warmed).toBe(1);
  expect(road.weight).toBe(1);
  road.apply(1 / 60, camera);
  expect(grid.state().roadSky).toBe(1);
  expect(page.sunDir.distanceTo(SUN)).toBeLessThan(1e-9);
  scope.dispose();
  expect(road.state().disposed).toBe(true);
  expect(scene.getObjectByName('road-sky')).toBeUndefined();
});

it('the road backdrop writes the dawn key light into its own targets only', () => {
  const t = pageTargets(), b = new RoadSkyBackdrop(new Mesh());
  b.bind(t);
  expect(t.sunColor.toArray()).toEqual([...ROAD_SKY.sun.colour]);
  expect(t.lightDirection.clone().negate().distanceTo(SUN)).toBeLessThan(1e-9);
  expect(t.fog.color.toArray()).toEqual(new Color(...ROAD_SKY.air).toArray());
});
