import type { CueMap } from '@wildshard/engine';
import type { Vector3 } from 'three';
import type { IslandSfx, Material, Enemy, WindupEnemy } from './sfx';
import type { Surface } from './surface';

const SURFACES: readonly Surface[] = ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water'];
const MATERIALS: readonly Material[] = ['flesh', 'shell', 'wood', 'stone'];
const ENEMIES: readonly Enemy[] = ['boar', 'crab', 'monkey', 'sailor'];
const WINDUPS: readonly WindupEnemy[] = ['boar', 'crab', 'sailor'];

/** Routing adds no sound taps or random draws: every recipe keeps its original bank call. */
export function driftwoodCueMap(sfx: Pick<IslandSfx, 'footstep' | 'whoosh' | 'impact' | 'vocal' | 'windup' | 'plunge' | 'interact' | 'gullCallAt'>,
  listener: { readonly position: Vector3; readonly yaw: number }): CueMap {
  return (id, opts) => {
    if (id === 'cue.weapon.fire' && typeof opts.dir === 'number') {
      sfx.whoosh(opts.speed ?? 1, { heavy: opts.heavy ?? false, dir: opts.dir }); return true;
    }
    const material = MATERIALS.find((value) => id === `cue.hit.${value}` || id === `cue.weapon.clang.${value}`);
    if (material !== undefined) { sfx.impact(material, opts.strength ?? 1, opts.point); return true; }
    if (id === 'cue.creature.death') {
      const enemy = ENEMIES.find((value) => value === opts.kind);
      if (enemy === undefined) return false;
      sfx.vocal(enemy, opts.point, opts.gain ?? 1.3); return true;
    }
    if (id === 'cue.ai.windup') {
      const enemy = WINDUPS.find((value) => value === (opts.kind === 'bear' ? 'boar' : opts.kind));
      if (enemy === undefined) return false;
      sfx.windup(enemy, opts.point); return true;
    }
    const surface = SURFACES.find((value) => id === `cue.step.${value}`);
    if (surface !== undefined) { sfx.footstep(surface, opts.speed ?? 0); return true; }
    if (id === 'cue.player.dive' || id === 'cue.player.surface') { sfx.plunge(id === 'cue.player.surface'); return true; }
    if (id === 'cue.feat.earned') { sfx.interact('chime'); return true; }
    if (id === 'cue.ambient.gull' && opts.point !== undefined) { sfx.gullCallAt(opts.point, listener.position, listener.yaw); return true; }
    return false;
  };
}
