import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CueMap } from '@wildshard/engine/audio/Cues';
import type { CombatCueOpts } from '@wildshard/engine/combat/cues';
import type { Vector3 } from 'three';
import source from '../../shard.config';
import type { IslandSfx } from './sfx';

/** Routing adds no sound taps or random draws: each admitted voice calls the original island recipe once. */
export function driftwoodCueMap(sfx: Pick<IslandSfx, 'footstep' | 'whoosh' | 'impact' | 'vocal' | 'windup' | 'plunge' | 'interact' | 'gullCallAt'>,
  listener: { readonly position: Vector3; readonly yaw: number }): CueMap {
  const voices = new Map<string, (opts: CombatCueOpts) => boolean | undefined>();
  voices.set('island.whoosh', (opts) => { if (typeof opts.dir !== 'number') return false; sfx.whoosh(opts.speed ?? 1, { heavy: opts.heavy ?? false, dir: opts.dir }); return true; });
  for (const material of ['flesh', 'shell', 'wood', 'stone'] as const) voices.set(`island.impact.${material}`, (opts) => { sfx.impact(material, opts.strength ?? 1, opts.point); });
  for (const kind of ['boar', 'crab', 'monkey', 'sailor'] as const) voices.set(`island.vocal.${kind}`, (opts) => { sfx.vocal(kind, opts.point, opts.gain ?? 1.3); });
  for (const kind of ['boar', 'crab', 'sailor'] as const) voices.set(`island.windup.${kind}`, (opts) => { sfx.windup(kind, opts.point); });
  for (const surface of ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water'] as const) voices.set(`island.step.${surface}`, (opts) => { sfx.footstep(surface, opts.speed ?? 0); });
  voices.set('island.dive', () => { sfx.plunge(false); }); voices.set('island.surface', () => { sfx.plunge(true); });
  voices.set('island.chime', () => { sfx.interact('chime'); });
  voices.set('island.gull', (opts) => { if (opts.point === undefined) return false; sfx.gullCallAt(opts.point, listener.position, listener.yaw); return true; });
  return createCueRouter(source.audio.routing.filter((route) => route.bus === 'audio'), { voices });
}
