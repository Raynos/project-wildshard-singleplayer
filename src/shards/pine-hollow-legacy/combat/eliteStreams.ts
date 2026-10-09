import { fnv1a32, Rng } from '@wildshard/engine/core/rng';

/** Pine Hollow's level seed (shard.config.ts `seed: 1337`; test/shards/pine-hollow/pine-combat.test.ts holds them equal). */
export const PINE_LEVEL_SEED = 1337;

/** One named elite's two random streams: its spawn facing at the lair (one draw a spawn) and its fight's every roll. */
export interface PineEliteStreams { readonly spawn: Rng; readonly fight: Rng }

/**
 * A named elite's seeded streams (SF72), the one source of its randomness in the browser and the renderer-free runtime alike:
 * `pine.elite.spawn.<id>` turns it at its lair, `pine.elite.<id>` rolls its wander goals and its fight (the second charge, the
 * fade clock, the stag's comeback distance, the rivals' charge onset). Both derive from the level seed alone (never the page's
 * salted streams), so an elite is the same every boot of a seed; each stream is a uniform [0, 1) draw as Math.random was.
 */
export function pineEliteStreams(id: string, seed: number = PINE_LEVEL_SEED): PineEliteStreams {
  return { spawn: new Rng(fnv1a32(`${String(seed)}:pine.elite.spawn.${id}`)), fight: new Rng(fnv1a32(`${String(seed)}:pine.elite.${id}`)) };
}
