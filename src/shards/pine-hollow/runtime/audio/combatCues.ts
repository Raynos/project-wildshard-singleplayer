import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';
import type { Vector3 } from 'three';
import source from '../../shard.config';
import type { PhShot } from './sfx';

export function pineCombatCues(ports: {
  shot: (name: PhShot, opts?: { gain?: number; at?: Vector3 }) => boolean;
  later: (fn: () => void, seconds: number) => void; stony: (point: Vector3) => boolean;
  echoDelay: number; echoGain: number;
}): CombatCueMap {
  const voices = new Map<string, (opts: CombatCueOpts) => boolean | undefined>();
  for (const name of ['leverShot', 'leverDry', 'leverCycle', 'longbowLoose'] as const) voices.set(`pine.${name}`, () => ports.shot(name));
  voices.set('pine.leverEcho', () => ports.shot('leverEcho', { gain: ports.echoGain }));
  voices.set('pine.leverRoundIn', (opts) => ports.shot('leverRoundIn', { gain: opts.gain ?? 0.9 }));
  voices.set('pine.longbowDraw', (opts) => ports.shot('longbowDraw', { gain: opts.gain ?? 0.8 }));
  voices.set('pine.boltImpact-rock', (opts) => opts.point !== undefined && ports.stony(opts.point) && ports.shot('boltImpact-rock', { at: opts.point }));
  // Preserve the existing injected echo port for isolated fixtures; production supplies the declaration's delay/gain.
  const routes = structuredClone(source.audio.routing);
  for (const route of routes) for (const action of route.actions) if (action.voice === 'pine.leverEcho') action.delay = ports.echoDelay;
  return createCueRouter(routes, { voices, later: ports.later });
}
