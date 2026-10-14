import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CueMap } from '@wildshard/engine/audio/Cues';
import type { Vector3 } from 'three';
import source from '../../shard.config';
import type { IslandSfx } from './sfx';

/** Routing adds no sound taps or random draws: each admitted voice calls the original island recipe once. */
export function driftwoodCueMap(sfx: Pick<IslandSfx, 'footstep' | 'whoosh' | 'impact' | 'vocal' | 'windup' | 'plunge' | 'interact' | 'gullCallAt'>,
  listener: { readonly position: Vector3; readonly yaw: number }, routing = source.audio.routing): CueMap {
  return createCueRouter(routing.filter((route) => route.bus === 'audio'), { voices:new Map(),bindings:source.audio.voiceBindings,owners:new Map<string,object>([['sfx',sfx],['listener',listener]]) });
}
