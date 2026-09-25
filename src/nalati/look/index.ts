/**
 * The Nalati look v2 (docs/design/nalati/handoff/port-v2.md, NALATI.md Phase A2), behind `?look=v2` (flag.ts).
 *
 * The hooks into shared files, one line each:
 *   Game constructor      `if (LOOK_V2) installLookV2Fog()`                 (fog.ts — before anything compiles)
 *   Game.buildComposer    `if (LOOK_V2) { this._composer = buildLookV2Chain(…); return; }`   (grade.ts)
 *   wireNalati            `await wireLookV2({ game, sky, weather, updates })` instead of the v1 painted backdrop
 *
 * wireLookV2: the panorama sky dome (sky.ts) in place of the v1 sky's painted clouds / planet / sun disc / backdrop
 * (the rig's star dome and the moon stay for the night), the far geometric ranges stood down (the painting is the far
 * range; Horizon rings 0 + 1 and the cloud sea stay in front), and one updater after the weather rig that re-tints the
 * painting and the fog for the hour and the storm, then applies the lighting cheat (light.ts) and keeps the static bake (bake.ts) on the key.
 */
import * as THREE from 'three';
import type { Game } from '../../core/Game';
import type { Sky } from '../../world/Sky';
import type { NalatiWeather } from '../weather';
import { SkyDomeV2 } from './sky';
import { fogLut } from './fog';
import { updateTint } from './tint';
import { LightCheat } from './light';
import { grassV2Uniforms, grassMood, terrainHeightTexture } from './grass';
import { StaticBake, PHONE_STATIC_OFF_CSM } from './bake';
import { setModelShade } from '../../world/nalati/glbPaint';
import { applyCloudSeaV2 } from './cloudSea';
import type { Forest } from '../../world/Forest';
import { getActiveChunk } from '../../chunks/registry';

export { LOOK_V2 } from './flag';

export interface LookV2Ctx {
  game: Game; sky: Sky; weather: NalatiWeather;
  /** wireNalati's per-frame list: the look's updater is pushed here, after the weather's */
  updates: ((dt: number, t: number) => void)[];
  groups: Record<string, THREE.Object3D>;
  /** the spruce (a static caster for the bake) */
  forest: Forest;
}

const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export async function wireLookV2(ctx: LookV2Ctx): Promise<void> {
  const { game, sky, weather } = ctx;
  const dome = await SkyDomeV2.load(game.renderer, fogLut);
  if (dome === null) { console.warn('[look v2] no panorama: the v1 sky stays'); return; }
  game.scene.add(dome.mesh);
  ctx.groups['skyV2'] = dome.mesh;
  // the painting is the sky, the clouds, the planet, the sun and the far range: the v1 layers stand down
  sky.clouds.visible = false;
  sky.planet.visible = false;
  game.scene.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.Material && /^ridge[23]$/.test(o.material.name)) o.visible = false; });
  // A3: the cloud sea rises to hug the slab's rocky wall — a painted cumulus deck, not a pale panel (cloudSea.ts)
  const sea = game.scene.getObjectByName('cloud-sea');
  if (sea) applyCloudSeaV2(sea, grassV2Uniforms.uSunView);
  const rigDome = weather.rig.dome;
  const u = dome.uniforms;
  const cheat = new LightCheat(sky, getActiveChunk().grade.saturation);
  // step 6: the static casters' shadows + contact shade, baked (bake.ts) — re-baked as the key swings
  const bake = new StaticBake(game.renderer, game.scene, terrainHeightTexture());
  for (const k of ['pois', 'dressing', 'outcrops', 'crags'] as const) { const g = ctx.groups[k]; if (g) bake.add(g); }
  bake.add(ctx.forest.group);
  // the generated models' shading (glbPaint.ts; N20, the user's pick): the clones the builders made of a model get their own bake
  setModelShade(true, game.scene);
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
    cheat.apply(look); // step 4: the key swung round + lifted, the fill lower and cooler (light.ts)
    bake.update(sky.sunDir); // step 6: after the cheat, so the baked shadows fall from the key
    u.uSunNow.value.copy(look.sunDir);
    grassV2Uniforms.uSunView.value.copy(look.sunDir); // the grass glows looking into the (painted, real) sun
    // night: the painted sky fades out above the ridge line, the rig's stars show through (it is hidden by day: no overdraw)
    const night = smooth(2, -9, weather.clock.sunElevation);
    u.uNight.value = night;
    grassMood(night, smooth(12, 0, weather.clock.sunElevation) * (1 - night), w.overcast); // the grass darkens + greys with the hour / storm
    rigDome.visible = night > 0.001;
    // the sun is painted; the rig's disc stays only as the moon
    if (look.moon <= 0) sky.sunDisc.visible = false;
  });
}
