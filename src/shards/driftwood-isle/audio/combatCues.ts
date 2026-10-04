import type { CombatCueMap } from '@wildshard/engine';
import type { IslandSfx } from './sfx';

/** The rich sword-event layer keeps its bank calls (and sound-log ids) at their original boundaries. */
export function driftwoodCombatCues(sfx: Pick<IslandSfx, 'whoosh' | 'impact' | 'vocal'>): CombatCueMap {
  return (id, opts) => {
    if (id === 'cue.sword.swing' && typeof opts.dir === 'number') {
      sfx.whoosh(opts.speed ?? 1, { heavy: opts.heavy ?? false, dir: opts.dir }); return true;
    }
    const point = opts.point;
    if (point === undefined) return false;
    if (id === 'cue.sword.hit') {
      const kind = opts.kind;
      sfx.impact(kind === 'crab' ? 'shell' : kind === 'sailor' ? 'wood' : 'flesh', opts.strength ?? 1, point);
      if (opts.killed && (kind === 'boar' || kind === 'crab' || kind === 'monkey' || kind === 'sailor')) sfx.vocal(kind, point, 1.3);
      return true;
    }
    if (id === 'cue.sword.clang' && opts.clang !== undefined) { sfx.impact(opts.clang, opts.strength ?? 1, point); return true; }
    return false;
  };
}
