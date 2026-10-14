import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';
import type { AudioData } from '@wildshard/format/audio';
import type { Vector3 } from 'three';
import source from '../../shard.config';
import type { PhShot } from './sfx';

export function pineCombatCues(ports: {
  shot: (name: PhShot, opts?: { gain?: number; at?: Vector3 }) => boolean;
  later: (fn: () => void, seconds: number) => void; stony: (point: Vector3) => boolean;
  echoDelay: number; echoGain: number;
}, routing: AudioData['routing'] = source.audio.routing): CombatCueMap {
  const voices = new Map<string, (opts: CombatCueOpts) => boolean | undefined>();
  voices.set('pine.boltImpact-rock', (opts) => opts.point !== undefined && ports.stony(opts.point) && ports.shot('boltImpact-rock', { at: opts.point }));
  // Preserve the existing injected echo port for isolated fixtures; production supplies the declaration's delay/gain.
  const routes = structuredClone(routing);
  for (const route of routes) for (const action of route.actions) if (action.voice === 'pine.leverEcho') action.delay = ports.echoDelay;
  return createCueRouter(routes, { voices, later: ports.later,bindings:source.audio.voiceBindings,owners:new Map([['ports',ports]]) });
}
