import type * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { NalatiWeather } from '../world/installWeather';
import { PaintedPanorama } from '@wildshard/game/looks/painterlyLook';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import { PANO_RIDGE_V } from './panoramaData';
import { gradeUniforms } from './grade';
import { fogLut, tint } from './fog';
import { LightCheat } from './light';
import { grassV2Uniforms, grassMood, terrainHeightTexture } from './field';
import { createStaticCapture, PHONE_STATIC_OFF_CSM } from './capture';
import { smoothstep } from '@wildshard/engine/core/noise';

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
  // the painted panorama (game/looks/painterlyLook): the dome and the cloud sea, hearing the grade and the live re-grade
  const uniforms = Object.fromEntries(Object.entries({ ...gradeUniforms, uV2KeyTint: tint.key, uV2Moon: tint.moon, uV2Light: tint.light, uV2Veil: tint.veil, uV2VeilCol: tint.veilColour, uV2Flash: tint.flash }).filter(([key]) => key !== 'uV2LookSat'));
  const panorama = await PaintedPanorama.build(game.scene, Math.min(8, game.renderer.capabilities.getMaxAnisotropy()), scope,
    'panorama' in paintedTextures ? paintedTextures.panorama : null, { ridge: PANO_RIDGE_V, lut: fogLut, uniforms });
  if (panorama === null) return;
  ctx.groups['skyV2'] = panorama.dome;
  const rigDome = weather.rig.dome;
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
    const look = weather.look, w = weather.air;
    cheat.apply(look); // step 4: the key swung round + lifted, the fill lower and cooler (light.ts)
    bake.update(sky.sunDir); // step 6: after the cheat, so the baked shadows fall from the key
    // night: the painted sky fades out above the ridge line, the rig's stars show through (it is hidden by day: no overdraw)
    const night = panorama.update(look.sunDir, weather.clock.sunElevation);
    grassV2Uniforms.uSunView.value.copy(look.sunDir); // the grass glows looking into the (painted, real) sun
    grassMood(night, smoothstep(12, 0, weather.clock.sunElevation) * (1 - night), w.overcast); // the grass darkens + greys with the hour / storm
    rigDome.visible = night > 0.001;
    // the sun is painted; the rig's disc stays only as the moon
    if (look.moon <= 0) sky.sunDisc.visible = false;
  });
}
