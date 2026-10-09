import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';
import source from '../../shard.config';
import type { IslandSfx } from './sfx';

/** The rich sword-event layer keeps its bank calls and sound-log ids at their original boundaries. */
export function driftwoodCombatCues(sfx: Pick<IslandSfx, 'whoosh' | 'impact' | 'vocal'>): CombatCueMap {
  const voices = new Map<string, (opts: CombatCueOpts) => boolean | undefined>();
  voices.set('island.whoosh', (opts) => { if (typeof opts.dir !== 'number') return false; sfx.whoosh(opts.speed ?? 1, { heavy: opts.heavy ?? false, dir: opts.dir }); return true; });
  for (const material of ['flesh', 'shell', 'wood', 'stone'] as const) voices.set(`island.impact.${material}`, (opts) => { sfx.impact(material, opts.strength ?? 1, opts.point); });
  for (const kind of ['boar', 'crab', 'monkey', 'sailor'] as const) voices.set(`island.kill.${kind}`, (opts) => { sfx.vocal(kind, opts.point, opts.gain ?? 1.3); });
  return createCueRouter(source.audio.routing.filter((route) => route.bus === 'combat'), { voices });
}
