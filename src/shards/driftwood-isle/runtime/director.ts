import { prepareDirectorModule, type DirectorLane } from '@wildshard/game/plugin/director';
import { parseDirector } from '@wildshard/format/director';
import declaration from '../data/director.json' with { type: 'json' };
import module from '../behaviour/director.json' with { type: 'json' };

/** Finale decisions emitted by the immutable author module; combat and the reward view remain native recipes. */
export type DriftwoodFinaleEvent = 'captain.restore' | 'captain.wake' | 'captain.dead' | 'reward.start' | 'reward.finish';

/** The same immutable admitted bytes for page and worker; embedding avoids a second runtime download. */
export function driftwoodDirectorBytes(): Uint8Array {
  if (module.module !== declaration.module) throw new Error('Driftwood finale module is stale');
  return Uint8Array.from(atob(module.bytes), byte => byte.codePointAt(0) ?? 0);
}

/** Admit the page's exact immutable module; every host owns independent author memory and quota history. */
export async function prepareDriftwoodDirector(): Promise<() => DirectorLane> {
  const create = await prepareDirectorModule(parseDirector(declaration), driftwoodDirectorBytes());
  return () => create(357);
}

