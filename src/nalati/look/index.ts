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
 * painting and the fog for the hour and the storm, then applies the lighting cheat (light.ts).
 */
import * as THREE from 'three';
import type { Game } from '../../core/Game';
import type { Sky } from '../../world/Sky';
import type { NalatiWeather } from '../weather';
import { SkyDomeV2 } from './sky';
import { fogLut } from './fog';
import { updateTint } from './tint';
import { LightCheat } from './light';
import { grassV2Uniforms } from './grass';
import { getActiveChunk } from '../../chunks/registry';

export { LOOK_V2 } from './flag';

export interface LookV2Ctx {
  game: Game; sky: Sky; weather: NalatiWeather;
  /** wireNalati's per-frame list: the look's updater is pushed here, after the weather's */
  updates: ((dt: number, t: number) => void)[];
  groups: Record<string, THREE.Object3D>;
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
  const rigDome = weather.rig.dome;
  const u = dome.uniforms;
  const cheat = new LightCheat(sky, getActiveChunk().grade.saturation);
  ctx.updates.push(() => {
    const look = weather.look, w = weather.weather;
    updateTint(look, w);
    cheat.apply(look); // step 4: the key swung round + lifted, the fill lower and cooler (light.ts)
    u.uSunNow.value.copy(look.sunDir);
    grassV2Uniforms.uSunView.value.copy(look.sunDir); // the grass glows looking into the (painted, real) sun
    // night: the painted sky fades out above the ridge line, the rig's stars show through (it is hidden by day: no overdraw)
    const night = smooth(2, -9, weather.clock.sunElevation);
    u.uNight.value = night;
    rigDome.visible = night > 0.001;
    // the sun is painted; the rig's disc stays only as the moon
    if (look.moon <= 0) sky.sunDisc.visible = false;
  });
}
