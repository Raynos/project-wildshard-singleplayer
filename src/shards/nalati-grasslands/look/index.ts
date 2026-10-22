import type * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { NalatiWeather } from '../runtime/state';
import { paintedWorldOf } from '@wildshard/game/looks/paintedWorld';

export interface LookV2Ctx {
  game: Game; sky: Sky; weather: NalatiWeather;
  /** wireNalati's per-frame list: the look's updater is pushed here, after the weather's */
  updates: ((dt: number, t: number) => void)[];
  groups: Record<string, THREE.Object3D>;
  /** the spruce (a static caster for the bake) */
  forest: Forest;
}

/** Nalati's painterly world (game/looks/paintedWorld `wire`, the look's `world` rows): the panorama, the painter's key, the
 *  static capture and the grass's mood, hearing the grade and the live re-grade and following the weather's hour and storm. */
export async function wireLookV2(ctx: LookV2Ctx): Promise<void> {
  const { game, sky, weather } = ctx;
  const world = await paintedWorldOf('nalati-grasslands').wire({ renderer: game.renderer, scene: game.scene, scope: game.levelScope, sky, stars: weather.dome,
    groups: ctx.groups, casters: [ctx.forest.group], daySaturation: game.level.grade.saturation });
  if (world === null) return;
  ctx.groups['skyV2'] = world.panorama.dome;
  ctx.updates.push(dt => { world.update(dt, { look: weather.look, sunElevation: weather.clock.sunElevation, overcast: weather.air.overcast }); });
}
