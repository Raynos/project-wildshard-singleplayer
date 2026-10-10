// SHARD-PLATFORM G321 part 5: a backdrop-less level's grid cell carries its default sky's environment alone
// (`BackdropLayer`'s `environment`, `SkyRig.layeredEnvironment`), and a shell whose chain leaves its god rays out carries a
// region's in rays placed with the cinematic effects (`RegionCinematic.rays`, `chainKnobs`' page value).
import { expect, it } from 'vitest';
import { BoxGeometry, Color, DirectionalLight, Fog, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Sprite, SpriteMaterial, Texture, Vector3 } from 'three';
import { Effect } from 'postprocessing';
import type { SkyBackdropTargets } from '../src/engine/render/look';
import { BackdropLayer } from '../src/engine/world/backdropLayer';
import { chainKnobs, type FramePostEffects } from '../src/game/grid/frame';

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

it('moves only the environment: the texture from half weight, the intensity from its source, everything back on undo', () => {
  const scene = new Scene(), page = pageTargets(), camera = new PerspectiveCamera(), env = new Texture();
  scene.environmentIntensity = 1;
  let intensity = 0.6;
  const layer = new BackdropLayer({ targets: page, scene }, { environment: { intensity: () => intensity }, onDispose: () => undefined });
  layer.holder.environment = env;
  layer.attach({ lut: null, bind: () => undefined, update: () => undefined, rebuild: () => undefined });
  // a region's own light swap writes the shared light: the layer never moves it
  page.lights[0]?.color.setRGB(1, 0.8, 0.6); page.hemi.intensity = 0.4; page.fog.color.setRGB(0.6, 0.7, 0.9);
  const light = [page.lights[0]?.color.toArray(), page.hemi.intensity, page.fog.color.toArray(), page.sunDir.toArray()];
  layer.weight = 0.4;
  let undo = layer.apply(1 / 60, camera);
  expect(scene.environment).toBeNull(); expect(scene.environmentIntensity).toBeCloseTo(1 + (0.6 - 1) * 0.4);
  expect([page.lights[0]?.color.toArray(), page.hemi.intensity, page.fog.color.toArray(), page.sunDir.toArray()]).toEqual(light);
  undo?.(); expect(scene.environmentIntensity).toBe(1); expect(scene.environment).toBeNull();
  layer.weight = 1; intensity = 0.45; // its clock turned the hour
  undo = layer.apply(1 / 60, camera);
  expect(scene.environment).toBe(env); expect(scene.environmentIntensity).toBeCloseTo(0.45);
  expect([page.lights[0]?.color.toArray(), page.hemi.intensity, page.fog.color.toArray(), page.sunDir.toArray()]).toEqual(light);
  undo?.(); expect(scene.environment).toBeNull(); expect(scene.environmentIntensity).toBe(1);
  layer.dispose();
});

it('mixes carried god rays from the page value 0, never a value a region clock wrote before the take', () => {
  const rays = new Effect('rays', 'void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { outputColor = inputColor; }');
  rays.blendMode.opacity.value = 0.9; // the region's clock wrote its hour's value this frame, before the frame took it
  const post: FramePostEffects = { rays, grade: Object.assign(new Effect('g', ''), { set: () => undefined, hold: () => () => undefined }),
    saturation: Object.assign(new Effect('s', ''), { saturation: 0 }), contrast: Object.assign(new Effect('c', ''), { brightness: 0, contrast: 0 }) };
  const knobs = chainKnobs(post, { kind: 'cinematic', bloomIntensity: 0, bloomThreshold: 1, bloomSmoothing: 0, vignette: 0, rays: 1, ao: false }, 0);
  expect(knobs).not.toBeNull();
  knobs?.weight(0.5); expect(rays.blendMode.opacity.value).toBeCloseTo(0.5);
  knobs?.restore(); expect(rays.blendMode.opacity.value).toBe(0);
});
