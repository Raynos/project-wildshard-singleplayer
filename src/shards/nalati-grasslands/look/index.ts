import type * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { NalatiWeather } from '../runtime/state';
import { PainterlyWorld } from '@wildshard/game/looks/painterlyLook';
import { lendUniforms } from '@wildshard/sdk/looks/lentLooks';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import captureRows from '../boot/staticCapture.generated.json' with { type: 'json' };
import metadata from '../bootMetadata.generated.json' with { type: 'json' };
import { gradeUniforms } from './grade';
import { fogLut, tint } from './render';
import { grassProfile } from './field';
import { bakeUniforms } from './capture';

export interface LookV2Ctx {
  game: Game; sky: Sky; weather: NalatiWeather;
  /** wireNalati's per-frame list: the look's updater is pushed here, after the weather's */
  updates: ((dt: number, t: number) => void)[];
  groups: Record<string, THREE.Object3D>;
  /** the spruce (a static caster for the bake) */
  forest: Forest;
}

/** Nalati's painterly world (game/looks/painterlyLook): the panorama, the painter's key, the static capture and the grass's mood,
 *  from the boot rows, hearing the grade and the live re-grade (render.ts `tint`) and following the weather's hour and storm. */
export async function wireLookV2(ctx: LookV2Ctx): Promise<void> {
  const { game, sky, weather } = ctx, rows = paintedTextures;
  // the grade graph's live uniforms (look/grade.ts), lent to the post-graph look before it composes
  lendUniforms(game.levelScope, 'nalati-grade', gradeUniforms);
  const uniforms = Object.fromEntries(Object.entries({ ...gradeUniforms, uV2KeyTint: tint.key, uV2Moon: tint.moon, uV2Light: tint.light, uV2Veil: tint.veil, uV2VeilCol: tint.veilColour, uV2Flash: tint.flash }).filter(([key]) => key !== 'uV2LookSat'));
  const world = await PainterlyWorld.build('world' in rows ? rows.world : null, { renderer: game.renderer, scene: game.scene, scope: game.levelScope, sky, stars: weather.dome,
    groups: ctx.groups, casters: [ctx.forest.group], grass: grassProfile, capture: { rows: captureRows, uniforms: bakeUniforms },
    panorama: { rows: 'panorama' in rows ? rows.panorama : null, ridge: metadata.panoramaRidge, lut: fogLut, uniforms },
    key: { rows: 'key' in rows ? rows.key : null, daySaturation: game.level.grade.saturation, saturation: gradeUniforms.uV2LookSat } });
  if (world === null) return;
  ctx.groups['skyV2'] = world.panorama.dome;
  ctx.updates.push(dt => { world.update(dt, { look: weather.look, sunElevation: weather.clock.sunElevation, overcast: weather.air.overcast }); });
}
