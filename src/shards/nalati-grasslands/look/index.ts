import * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { NalatiWeather } from '../world/installWeather';
import { loadTextureRow } from '@wildshard/engine/core/assets';
import { TIER } from '@wildshard/engine/core/tier';
import { headingTexture } from '@wildshard/engine/render/dataLook';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import { PANO_RIDGE_V } from './panoramaData';
import { gradeUniforms } from './grade';
import { tintUniforms, updateTint } from './tint';
import { fogLut, syncPaintedFog } from './fog';
import { LightCheat } from './light';
import { grassV2Uniforms, grassMood, terrainHeightTexture } from './field';
import { createStaticCapture, PHONE_STATIC_OFF_CSM } from './capture';
import { smoothstep } from '@wildshard/engine/core/noise';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import { CRAG_LOOK } from '../models/cragRock';

/** the lit look graphs on the painterly preset (data/lookGraphs.json): they take the world look's live shade, rim and wet */
const PAINTERLY_GRAPHS = [CRAG_LOOK, 'nalati-riders'];
const shadeV = [0, 0, 0], rimV = [0, 0, 0];

export interface LookV2Ctx {
  game: Game; sky: Sky; weather: NalatiWeather;
  /** wireNalati's per-frame list: the look's updater is pushed here, after the weather's */
  updates: ((dt: number, t: number) => void)[];
  groups: Record<string, THREE.Object3D>;
  /** the spruce (a static caster for the bake) */
  forest: Forest;
}


export async function wireLookV2(ctx: LookV2Ctx): Promise<void> {
  const { game, sky, weather } = ctx;
  const scope = game.levelScope;
  const panorama = scope.own(await loadTextureRow({ url: paintedTextures.panorama[TIER], srgb: true, wrapT: THREE.ClampToEdgeWrapping, anisotropy: Math.min(8, game.renderer.capabilities.getMaxAnisotropy()) }));
  if (scope.disposed) return;
  const ridge = scope.own(headingTexture({ samples: PANO_RIDGE_V, stride: 1, half: true }));
  setLentTexture('nalati-panorama', 'tPano', panorama);
  setLentTexture('nalati-panorama', 'tRidge', ridge);
  setLentTexture('nalati-panorama', 'tFogLut', fogLut);
  const size: unknown = panorama.image;
  const width = typeof size === 'object' && size !== null && 'width' in size && typeof size.width === 'number' ? size.width : 6176;
  setLentParam('nalati-panorama', 'uPad', 16 / Math.max(1, width));
  setLentParam('nalati-panorama', 'uZenith', paintedTextures.zenith[TIER]);
  const dome = new THREE.Mesh(scope.own(new THREE.SphereGeometry(2300, 96, 48)), lentLook('nalati-panorama'));
  dome.name = 'sky-dome-v2'; dome.frustumCulled = false; dome.renderOrder = -90;
  dome.material.depthTest = false;
  dome.onBeforeRender = (_renderer, _scene, camera) => { camera.getWorldPosition(dome.position); game.scene.worldToLocal(dome.position); dome.updateMatrixWorld(); };
  game.scene.add(dome);
  ctx.groups['skyV2'] = dome;
  const sea = game.scene.getObjectByName('cloud-sea');
  if (sea instanceof THREE.Mesh) {
    const old: unknown = sea.material;
    sea.material = lentLook('nalati-cloud-sea'); sea.position.y = -68;
    setLentTexture('nalati-cloud-sea', 'tFogLut', fogLut);
    if (old instanceof THREE.Material) old.dispose();
  }
  const rigDome = weather.rig.dome;
  const graphUniforms = Object.entries({ ...gradeUniforms, ...tintUniforms }).filter(([key]) => key !== 'uV2LookSat');
  const cheat = new LightCheat(sky, game.level.grade.saturation);
  // step 6: the static casters' shadows + contact shade, baked (bake.ts) — re-baked as the key swings
  const bake = createStaticCapture(game.renderer, game.scene, terrainHeightTexture(), scope);
  for (const k of ['pois', 'dressing', 'outcrops', 'crags'] as const) { const g = ctx.groups[k]; if (g) bake.add(g); }
  bake.add(ctx.forest.group);
  // the generated models' shading (glbPaint.ts; N20, the user's pick): the clones the builders made of a model get their own bake
  // phone: the realtime shadow map now holds only what moves (the creatures, the player — bake.ts), so 512² does
  if (PHONE_STATIC_OFF_CSM) {
    sky.csm.shadowMapSize = 512;
    for (const l of sky.csm.lights) { l.shadow.mapSize.set(512, 512); l.shadow.map?.dispose(); l.shadow.map = null; }
  }
  let sweepT = 0;
  ctx.updates.push((dt) => {
    sweepT -= dt;
    if (sweepT <= 0) { sweepT = 2; bake.sweep(); } // streamed-in casters join the bake (and leave the phone's CSM)
    const look = weather.look, w = weather.weather;
    updateTint(look, w);
    syncPaintedFog(); // the look graphs' painted fog (data/lookGraphs.json 'nalati-fog') takes the same air and tint
    cheat.apply(look); // step 4: the key swung round + lifted, the fill lower and cooler (light.ts)
    bake.update(sky.sunDir); // step 6: after the cheat, so the baked shadows fall from the key
    setLentParam('nalati-panorama', 'uSunNow', look.sunDir.toArray());
    setLentParam('nalati-cloud-sea', 'uSunView', look.sunDir.toArray());
    for (const id of ['nalati-panorama', 'nalati-cloud-sea']) for (const [key, uniform] of graphUniforms) {
      const value = uniform.value; setLentParam(id, key, typeof value === 'number' ? value : value.toArray());
    }
    for (const id of PAINTERLY_GRAPHS) {
      setLentParam(id, 'shade', painterlyUniforms.uPShade.value.toArray(shadeV)); setLentParam(id, 'rim', painterlyUniforms.uPRimColor.value.toArray(rimV));
      setLentParam(id, 'wet', painterlyUniforms.uPWet.value);
    }
    grassV2Uniforms.uSunView.value.copy(look.sunDir); // the grass glows looking into the (painted, real) sun
    // night: the painted sky fades out above the ridge line, the rig's stars show through (it is hidden by day: no overdraw)
    const night = smoothstep(2, -9, weather.clock.sunElevation);
    setLentParam('nalati-panorama', 'uNight', night);
    grassMood(night, smoothstep(12, 0, weather.clock.sunElevation) * (1 - night), w.overcast); // the grass darkens + greys with the hour / storm
    rigDome.visible = night > 0.001;
    // the sun is painted; the rig's disc stays only as the moon
    if (look.moon <= 0) sky.sunDisc.visible = false;
  });
}
