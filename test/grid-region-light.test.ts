import { expect, it } from 'vitest';
import { Color, DataTexture, DirectionalLight, Fog, HemisphereLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry, Sprite, SpriteMaterial, Vector3 } from 'three';
import { BloomEffect, BrightnessContrastEffect, HueSaturationEffect, ToneMappingEffect, VignetteEffect } from 'postprocessing';
import { legacyDouble } from './fake/FakeGame';
import { Scope } from '../src/engine/app/scope';
import type { Game } from '../src/engine/core/Game';
import { GradeEffect } from '../src/engine/core/Grade';
import { VolumetricsEffect } from '../src/engine/core/Volumetrics';
import { fogUniforms, weatherFogUniforms, weatherUniforms } from '../src/engine/world/Atmosphere';
import { painterlyUniforms, setPainterlyLook, syncPainterlySun, updatePainterly } from '../src/engine/world/painterly';
import { SkyRig } from '../src/engine/world/skyRig';
import { applyLevelLight, holdPageLight, regionLightSwap } from '../src/game/grid/regionLight';
import { wind } from '../src/engine/world/steppeWind';
import { windStrength } from '../src/engine/world/wind';
import { NALATI_GRASSLANDS } from '../src/shards/nalati-grasslands/manifest';
import { SkyRig as NalatiSkyRig, copyLook, makeLook } from '../src/shards/nalati-grasslands/look/skyRig';
import { LightCheat } from '../src/shards/nalati-grasslands/look/light';
import { blendSteppeKey, clockForSun, nightKeys } from '../src/shards/nalati-grasslands/look/dayKeys';

/** The real SkyRig methods on an instance with the page rig's light parts and no WebGL context. */
function pageSky(): SkyRig {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('SkyRig prototype');
  const disc = new Mesh(new SphereGeometry(1), new MeshBasicMaterial({ color: new Color(1, 0.9, 0.7) }));
  const halo = new Sprite(new SpriteMaterial()); halo.scale.set(420, 420, 1); disc.add(halo);
  const lights = [new DirectionalLight(0xffeedd, 2.5), new DirectionalLight(0xffeedd, 2.5)];
  for (const l of lights) l.shadow.mapSize.set(2048, 2048);
  const visual = {
    sunDisc: disc, sunHalo: halo,
    cloudUniforms: { uTime: { value: 0 }, uSunDir: { value: new Vector3(0.3, 0.6, 0.4) }, uSunColor: { value: new Color(1, 0.8, 0.6) }, uLight: { value: new Color(1, 1, 1) }, uCloudLit: { value: new Color(1, 1, 1) }, uCloudAlpha: { value: 1 } },
    giantUniforms: { uSunDir: { value: new Vector3(0.3, 0.6, 0.4) }, uLight: { value: new Color(1, 1, 1) }, uOpacity: { value: 1 } },
  };
  for (const [key, value] of Object.entries({ visual, keyShadowWant: null, sunDir: new Vector3(0.3, 0.6, 0.4).normalize(), sunColor: new Color(1, 0.93, 0.85),
    hemi: new HemisphereLight(0x9ab4d8, 0x5a5040, 0.6), csm: { lights, lightDirection: new Vector3(-0.3, -0.6, -0.4).normalize(), shadowMapSize: 2048 } })) {
    Reflect.defineProperty(sky, key, { value, writable: true });
  }
  return sky;
}

function pageGame(): Pick<Game, 'scene' | 'camera' | 'post' | 'volumetrics'> {
  const camera = new PerspectiveCamera(), scene = new Scene();
  scene.fog = new Fog(0x8899aa, 1, 1e6);
  return { scene, camera, volumetrics: new VolumetricsEffect(camera, new DataTexture()),
    post: { grade: new GradeEffect(), saturation: new HueSaturationEffect(), contrast: new BrightnessContrastEffect(), bloom: new BloomEffect(), vignette: new VignetteEffect(), rays: null, ao: null, tone: new ToneMappingEffect() } };
}

/** Every shared value a region's light could touch, each part as JSON. */
function readout(sky: SkyRig, game: Pick<Game, 'post' | 'volumetrics'>): Record<string, string> {
  const uniforms = (set: Readonly<Record<string, { value: unknown }>>, skip: string[] = []): Record<string, unknown> => Object.fromEntries(Object.entries(set).filter(([k]) => !skip.includes(k))
    .map(([k, u]) => [k, typeof u.value === 'number' ? u.value : JSON.stringify(u.value)]));
  const visual: unknown = Reflect.get(sky, 'visual'), march: unknown = Reflect.get(game.volumetrics, 'marchUniforms'), grade: unknown = Reflect.get(game.post?.grade ?? {}, 'u');
  const disc = sky.sunDisc, discColor = disc.material instanceof MeshBasicMaterial ? disc.material.color.toArray() : null;
  const halo = disc.children[0];
  const parts: Record<string, unknown> = {
    sunDir: sky.sunDir, sunColor: sky.sunColor, want: Reflect.get(sky, 'keyShadowWant'), lightDirection: sky.csm.lightDirection, mapSize: sky.csm.shadowMapSize,
    lights: sky.csm.lights.map((l) => [l.color.toArray(), l.intensity, l.shadow.mapSize.toArray()]),
    hemi: [sky.hemi.color.toArray(), sky.hemi.groundColor.toArray(), sky.hemi.intensity],
    disc: [disc.visible, disc.scale.toArray(), discColor], halo: halo instanceof Sprite ? [halo.scale.toArray(), halo.material.opacity] : null,
    visual, painterly: uniforms(painterlyUniforms, ['uPTime']), fog: uniforms(fogUniforms), weather: uniforms(weatherUniforms), weatherFog: uniforms(weatherFogUniforms),
    post: [grade, game.post?.saturation.saturation, game.post?.contrast.contrast, game.post?.contrast.brightness], march: typeof march === 'object' && march !== null
      ? Object.fromEntries(Object.entries(march).filter(([k]) => ['uSunDir', 'uSunColor', 'uFogColor', 'uHeight', 'uFalloff', 'uDensity', 'uStrength'].includes(k))) : null,
  };
  return Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, JSON.stringify(v)]));
}

/** Nalati's own light writers, as its runtime runs them in a grid region: build-time painterly, its sky rig + cheat, the phone CSM. */
function nalatiLights(sky: SkyRig, game: Pick<Game, 'scene' | 'camera' | 'post' | 'volumetrics'>, region: Scene, hour: number): { frame: () => void } {
  // state.ts: the painterly look, once at build
  syncPainterlySun(sky);
  setPainterlyLook({ shadeTint: new Color(0.1, 0.16, 0.36), rimColor: new Color(1.5, 1.28, 0.95), wind: { x: 1, z: 0.35, strength: 1 } });
  // installWeather.ts / look/index.ts: the rig on the region's own scene (game.scene is the region's while entered)
  const regionGame = legacyDouble<Game>({ post: game.post, volumetrics: game.volumetrics, camera: game.camera, scene: region });
  const rig = new NalatiSkyRig(regionGame, sky, { frames: nightKeys, blend: blendSteppeKey }, NALATI_GRASSLANDS);
  const clock = clockForSun(NALATI_GRASSLANDS.sky.sun ?? { azimuth: 250, elevation: 26 });
  void clock.set(hour);
  const base = makeLook(), look = makeLook(), cheat = new LightCheat(sky, NALATI_GRASSLANDS.grade.saturation);
  // look/index.ts: the phone's static-off CSM, once
  sky.csm.shadowMapSize = 512;
  for (const l of sky.csm.lights) { l.shadow.mapSize.set(512, 512); l.shadow.map = null; }
  return { frame: () => {
    rig.look(clock, base); copyLook(look, base);
    look.fogDist += 0.004; look.fogHeightDensity += 0.003; look.disc = 0; // a storm's rain thickens the air and hides the disc
    rig.flash = 0.4; rig.apply(look, 1 / 60);
    cheat.apply(look);
    painterlyUniforms.uPWet.value = 0.7; weatherUniforms.uWet.value = 0.5; weatherFogUniforms.fogWeather.value.set(0.01, 0.02, 0.8, 0);
    if (look.moon <= 0) sky.sunDisc.visible = false;
    updatePainterly(1 / 60);
  } };
}

it('puts back every shared light value a Nalati region wrote when it is left, and its own on re-entry', () => {
  const sky = pageSky(), game = pageGame(), region = new Scene();
  region.fog = new Fog(0x8899aa, 1, 1e6);
  const swap = regionLightSwap(() => holdPageLight({ sky, game }));
  const page = readout(sky, game);

  const first = new Scope('entered:1');
  swap(first);
  const nalati = nalatiLights(sky, game, region, 15);
  nalati.frame(); nalati.frame();
  const inside = readout(sky, game);
  expect(inside).not.toEqual(page);
  const parts = ['sunDir', 'sunColor', 'want', 'lightDirection', 'mapSize', 'lights', 'hemi', 'disc', 'halo', 'visual', 'painterly', 'fog', 'weather', 'weatherFog', 'post', 'march'] as const;
  // every channel the readout covers really was written by Nalati's own writers
  expect(parts.filter((key) => page[key] === inside[key])).toEqual(['lightDirection']); // the stepped shadow direction moves in the rig's update(), never in a setter
  const rim = painterlyUniforms.uPRimColor.value.toArray();
  first.dispose();
  expect(readout(sky, game)).toEqual(page);

  // the road runs on: the page's own light moves while the region is parked
  sky.hemi.intensity = 0.8; painterlyUniforms.uPShade.value.setRGB(0.2, 0.2, 0.2);
  const road = readout(sky, game);
  const second = new Scope('entered:2');
  swap(second);
  // the region's once-at-build writes come back with it (it does not rebuild on re-entry)
  expect(sky.csm.shadowMapSize).toBe(512); expect(sky.sunDisc.visible).toBe(false);
  expect(painterlyUniforms.uPRimColor.value.toArray()).toEqual(rim);
  nalati.frame();
  second.dispose();
  expect(readout(sky, game)).toEqual(road);
});

it('frees a shadow map the region resized, so the page redraws at its own size', () => {
  const sky = pageSky(), game = pageGame();
  const light = sky.csm.lights[0];
  if (light === undefined) throw new Error('light');
  const restore = holdPageLight({ sky, game });
  light.shadow.mapSize.set(512, 512);
  let freed = 0;
  const map = { dispose: () => { freed++; } };
  Reflect.set(light.shadow, 'map', map);
  restore();
  expect(light.shadow.mapSize.toArray()).toEqual([2048, 2048]); expect(freed).toBe(1); expect(light.shadow.map).toBeNull();
});

it('leaves the composer alone before it is built', () => {
  const sky = pageSky(), game = { post: null, volumetrics: pageGame().volumetrics };
  const restore = holdPageLight({ sky, game });
  sky.hemi.intensity = 3; fogUniforms.fogDistDensity.value = 0.01;
  const before = fogUniforms.fogDistDensity.value;
  restore();
  expect(sky.hemi.intensity).toBe(0.6); expect(fogUniforms.fogDistDensity.value).not.toBe(before);
});

it('starts a region sky rig from its own level light, not the road light, and gives the road its light back (G222 follow-up #3)', () => {
  const sky = pageSky(), game = pageGame(), region = new Scene();
  region.fog = new Fog(0x8899aa, 1, 1e6);
  const level = NALATI_GRASSLANDS, page = readout(sky, game);
  // the road's light differs from Nalati's own (2.5 vs its sun intensity, a different fill)
  expect(sky.csm.lights[0]?.intensity).not.toBe(level.sky.sunIntensity);
  const swap = regionLightSwap(() => holdPageLight({ sky, game }), () => { applyLevelLight({ sky, scene: region }, level); });
  const first = new Scope('entered:1');
  swap(first);
  const regionGame = legacyDouble<Game>({ post: game.post, volumetrics: game.volumetrics, camera: game.camera, scene: region });
  const rig = new NalatiSkyRig(regionGame, sky, { frames: nightKeys, blend: blendSteppeKey }, level);
  expect(rig.daySunIntensity).toBe(level.sky.sunIntensity);
  const day: unknown = Reflect.get(rig, 'day');
  const key = day !== null && typeof day === 'object' ? Object.fromEntries(Object.entries(day)) : {};
  expect(key['sun']).toEqual([...level.sky.sunColor]);
  expect(key['hemiSky']).toEqual(new Color(level.sky.hemiSky).toArray());
  expect(key['hemiI']).toBe(level.sky.hemiIntensity);
  expect(key['env']).toBe(level.sky.envIntensity);
  expect(key['fogSun']).toEqual([...level.sky.fogSunColor]);
  expect(Reflect.get(rig, 'fogDist')).toBe(level.atmosphere.fogDistDensity);
  first.dispose();
  expect(readout(sky, game)).toEqual(page);
  // a re-entry brings the region's own last light back; the level light is only its first start
  sky.hemi.intensity = 0.9;
  const second = new Scope('entered:2');
  swap(second);
  expect(sky.hemi.intensity).toBe(level.sky.hemiIntensity);
  second.dispose();
  expect(sky.hemi.intensity).toBe(0.9);
});

it('swaps the one engine wind with the region: its storm inside, the road wind back on leave (G222 follow-up #4)', () => {
  const sky = pageSky(), game = pageGame();
  wind.set(5, 1.95, 0.6); wind.update(1 / 60);
  const road = { speed: wind.speed, dir: wind.dir, gust: wind.gustiness, dirX: wind.dirX, strength: windStrength.value, uDir: wind.uniforms.uWindDir.value.toArray() };
  const swap = regionLightSwap(() => holdPageLight({ sky, game }));
  const first = new Scope('entered:1');
  swap(first);
  // the region's storm: a hard gusting wind from another quarter
  wind.setTarget(22, 0.4, 1, 0.1); for (let i = 0; i < 240; i++) wind.update(1 / 60);
  const storm = { speed: wind.speed, dir: wind.dir, strength: windStrength.value };
  expect(storm.speed).toBeGreaterThan(15); expect(storm.strength).toBeGreaterThan(road.strength);
  const time = wind.time;
  first.dispose();
  expect({ speed: wind.speed, dir: wind.dir, gust: wind.gustiness, dirX: wind.dirX, strength: windStrength.value, uDir: wind.uniforms.uWindDir.value.toArray() }).toEqual(road);
  expect(wind.time).toBe(time); // its clock is not a look: it keeps running
  // the road's wind eases back to its own target, not the storm's
  for (let i = 0; i < 60; i++) wind.update(1 / 60);
  expect(wind.speed).toBeLessThan(8);
  // re-entry: the storm is back as the region left it
  const second = new Scope('entered:2');
  swap(second);
  expect(wind.speed).toBe(storm.speed); expect(windStrength.value).toBe(storm.strength);
  second.dispose();
});
