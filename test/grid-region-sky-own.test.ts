// SHARD-PLATFORM G321 (Jake, 2026-10-10: "when you enter a shard, you enter it with its sky"): a grid cell draws its
// shard's own sky dome, key light, fill, environment intensity and sun-disc choice through the page's one sky rig.
import { expect, it } from 'vitest';
import { BoxGeometry, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3 } from 'three';
import type { SkyBackdrop, SkyBackdropTargets } from '../src/engine/render/look';
import type { DayCycleClock } from '../src/engine/world/dayCycle';
import { BackdropLayer, LAYER_DOME_REACH, layerKeyedSky, seedLayerTargets, type LayerLevelLight } from '../src/engine/world/backdropLayer';

/** a page's shared sky state, as SkyRig binds it (the road's light) */
function pageTargets(): SkyBackdropTargets {
  return {
    sunDir: new Vector3(0, 1, 0), sunColor: new Color(1, 1, 1), lights: [new DirectionalLight(0xffffff, 3)],
    lightDirection: new Vector3(0, -1, 0), hemi: new HemisphereLight(0x8899aa, 0x443322, 1.1), fog: new Fog(0xaabbcc, 1, 1e6),
    fogU: { fogSunDir: { value: new Vector3(0, 1, 0) }, fogSunColor: { value: new Color(1, 0.9, 0.8) }, fogDistDensity: { value: 0.001 }, fogHeightDensity: { value: 0.02 } },
    underwater: () => false, disc: new Mesh(new BoxGeometry(), new MeshBasicMaterial({ color: 0xffffee })), halo: new Sprite(new SpriteMaterial({ color: 0xffeecc, opacity: 0.5 })),
    cloud: { uSunDir: { value: new Vector3(0, 1, 0) }, uSunColor: { value: new Color(1, 1, 1) }, uCloudLit: { value: new Color(1, 1, 1) }, uCloudAlpha: { value: 0.6 } },
    far: { uHazeCol: { value: new Color(0.7, 0.8, 0.9) }, uSeaSky: { value: new Color() }, uSeaSun: { value: new Color() }, uSeaSunDir: { value: new Vector3(0, 1, 0) } },
    planet: { uSunDir: { value: new Vector3(0, 1, 0) }, uHaze: { value: new Color(0.2, 0.2, 0.3) }, uCrisp: { value: 1 } },
    shadowBusy: () => false,
  };
}

/** a region's level light (Sky Reach-like: a warm low sun, a lilac fill) */
const LEVEL: LayerLevelLight = {
  sky: { sunColor: [1, 0.64, 0.36], sunIntensity: 2, hemiSky: 0x9490b8, hemiGround: 0x5a5070, hemiIntensity: 1.4, fogSunColor: [1, 0.7, 0.4], sun: { azimuth: 200, elevation: 6 } },
  atmosphere: { fogDistDensity: 0.003, fogHeightDensity: 0.01 },
};

/**
 * Sky Reach's backdrop as it is: a fixed clock that moves only the key light through the rig (`sky.setKeyLight`), hands
 * its 120 m dome over as `clouds` without adding it to its scene, and hides its own sun disc.
 */
function fixedSunBackdrop(sky: { setKeyLight: (dir: Vector3, color: Color, intensity: number) => void }): SkyBackdrop & { dome: Mesh } {
  const dome = new Mesh(new SphereGeometry(120, 8, 4), new ShaderMaterial({ depthTest: false }));
  dome.name = 'own-dome';
  const key = new Color(1, 0.82, 0.64), dir = new Vector3(-0.14, 0.1, -0.98).normalize();
  return { clock: {} as DayCycleClock, horizon: new Color(), lut: null, clouds: dome, dome,
    bind: (t) => { t.disc.visible = false; },
    update: () => { sky.setKeyLight(dir, key, 2); },
    rebuild: () => undefined, attachPost: () => undefined };
}

it('draws a dome handed over as clouds, on the camera, scaled past the world, and lights the cell with the level and its key (G321)', () => {
  const page = pageTargets(), scene = new Scene(), camera = new PerspectiveCamera(60, 1, 0.1, 2600);
  camera.position.set(1200, 40, -800);
  const pageSky = { setKeyLight: (): void => { throw new Error('the page key light was moved'); } };
  const layer = new BackdropLayer({ targets: page, scene }, { onDispose: () => undefined });
  seedLayerTargets(layer, LEVEL);
  const backdrop = fixedSunBackdrop(layerKeyedSky(pageSky, layer));
  layer.attach(backdrop);
  expect(backdrop.dome.parent).toBe(scene);
  expect(backdrop.dome.material instanceof ShaderMaterial && backdrop.dome.material.depthTest && backdrop.dome.material.transparent).toBe(true);

  // the road: nothing of it
  const road = { key: page.lights[0]?.intensity, hemi: page.hemi.intensity };
  expect(layer.apply(1 / 60, camera)).toBeNull();
  expect(backdrop.dome.visible).toBe(false);

  // inside: its dome on the camera at the layer's reach, its key light, its level's fill and environment, no sun disc
  layer.weight = 1;
  const undo = layer.apply(1 / 60, camera);
  expect(backdrop.dome.visible).toBe(true);
  expect(backdrop.dome.position.toArray()).toEqual(camera.position.toArray());
  expect(120 * backdrop.dome.scale.x).toBeCloseTo(LAYER_DOME_REACH * camera.far, 6);
  expect(page.sunDir.distanceTo(new Vector3(-0.14, 0.1, -0.98).normalize())).toBeLessThan(1e-9);
  expect(page.lightDirection.distanceTo(page.sunDir.clone().negate())).toBeLessThan(1e-9);
  expect(page.lights[0]?.color.toArray()).toEqual(new Color(1, 0.82, 0.64).toArray());
  expect(page.lights[0]?.intensity).toBe(2);
  expect(page.hemi.color.getHex()).toBe(0x9490b8);
  expect(page.hemi.intensity).toBeCloseTo(1.4, 9);
  expect(scene.environmentIntensity).toBe(1); // a standalone backdrop page keeps the scene's 1
  expect(page.fogU.fogDistDensity.value).toBeCloseTo(0.003, 9);
  expect(page.disc.visible).toBe(false);

  // leave: everything back
  undo?.();
  layer.weight = 0;
  expect(layer.apply(1 / 60, camera)).toBeNull();
  expect(page.lights[0]?.intensity).toBe(road.key);
  expect(page.hemi.intensity).toBe(road.hemi);
  expect(page.disc.visible).toBe(true);
  expect(backdrop.dome.visible).toBe(false);
  layer.dispose();
  expect(backdrop.dome.parent).toBeNull();
});

it('keeps the page sun disc below half weight and a dome already past the reach at its own size (G321)', () => {
  const page = pageTargets(), scene = new Scene(), camera = new PerspectiveCamera(60, 1, 0.1, 2600);
  const layer = new BackdropLayer({ targets: page, scene }, { onDispose: () => undefined });
  const dome = new Mesh(new SphereGeometry(2200, 8, 4), new ShaderMaterial());
  layer.holder.add(dome);
  layer.attach({ lut: null, clouds: dome, bind: (t) => { t.disc.visible = false; }, update: () => undefined, rebuild: () => undefined });
  layer.weight = 0.4;
  const undo = layer.apply(1 / 60, camera);
  expect(page.disc.visible).toBe(true);
  expect(dome.scale.x).toBe(1);
  undo?.();
  layer.weight = 0.6;
  layer.apply(1 / 60, camera);
  expect(page.disc.visible).toBe(false);
  layer.dispose();
});

it('hands every other page sky member through unchanged (G321)', () => {
  const layer = new BackdropLayer({ targets: pageTargets(), scene: new Scene() }, { onDispose: () => undefined });
  const page = { tint: new Color(0.1, 0.2, 0.3), count: 0, bump(): number { this.count++; return this.count; }, setKeyLight: (): void => undefined };
  const keyed = layerKeyedSky(page, layer);
  expect(keyed.tint).toBe(page.tint);
  expect(keyed.bump()).toBe(1);
  expect(page.count).toBe(1);
  layer.dispose();
});
