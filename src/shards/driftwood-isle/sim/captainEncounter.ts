import * as v from 'valibot';
import { silentBossPresentation } from '@wildshard/engine/ai/phases';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
import type { SimHost } from '@wildshard/engine/sim';
import { DrownedCaptain } from '../combat/captain';
import type { DriftwoodBake } from './baked';

/** The captain encounter's fixed-step id. */
export const CAPTAIN_STEP = 'driftwood.captain';
/** The finale's flags: the shards set in the altar wake him; his death ends the fight (quest/Spine.ts's kill hook). */
export const ALTAR_FLAG = 'used:altar', CAPTAIN_DEAD_FLAG = 'dead:captain';

const finite = v.pipe(v.number(), v.finite());
const Encounter = v.strictObject({ attempt: v.boolean(), waitForReturn: v.boolean(),
  boss: v.strictObject({ state: v.picklist(['dormant', 'armed', 'intro', 'fight', 'beat', 'victory']), phase: finite, checkpoint: finite, attempts: finite, t: finite, skipT: finite, short: v.boolean(),
    saved: v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }) }) });

/**
 * The Drowned Captain's finale in a renderer-free host (SF72), as runtime/finale.ts runs it on the page: the altar's flag
 * spawns him at his pool through the island keeper (the manager's next entity id and spawn draws; his authored fight,
 * species/captainPolicy.ts, decides on the creature manager's 'legacy' clock and rises / sinks on the body step) and wakes
 * him; the encounter (combat/captain.ts `DrownedCaptain`, the browser's own, with the silent presentation: the boss bar
 * is the page's) wakes him when the player comes back into the arena, ends an attempt on leaving it or dying in it, and
 * reports `boss.attempt` on the host's events; his death sets `dead:captain`. The encounter's continuation is one fixed
 * step after the keeper's (his body is the keeper's, reinstalled from its recipe before restore).
 */
/** Native fight and body owner; the admitted director delivers spawn/wake decisions at the same phase. */
export interface DriftwoodCaptain { readonly encounter: DrownedCaptain; readonly publish: (event: 'captain.restore' | 'captain.wake') => void }

/** Install the unchanged native encounter and expose only its admitted spawn/wake recipes. */
export function installCaptain(host: SimHost, bake: DriftwoodBake, island: { captain: () => HuntBody | null; spawnCaptain: () => HuntBody }): DriftwoodCaptain {
  const { pool, arena } = bake.captain;
  const encounter = new DrownedCaptain({ player: host.player, pool, events: host.events, flags: host.flags, animal: island.captain, ui: silentBossPresentation() });
  /** finale.ts `spawn`: at his pool, out of any herd, his pool and arena on his memory */
  const spawn = (): void => {
    if (island.captain() !== null) return;
    const a = island.spawnCaptain();
    a.herd = -1; a.mem['poolX'] = pool.x; a.mem['poolZ'] = pool.z; a.mem['arena'] = arena;
  };
  // Spine.ts's kill hook: his death ends the fight
  host.events.on('damage.dealt', ({ req, killed }) => {
    const a = island.captain();
    if (killed && a !== null && req.target === a.combatActor()) host.flags.set(CAPTAIN_DEAD_FLAG);
  }, host.scope);
  host.events.on('player.died', () => { encounter.onPlayerDeath(); }, host.scope);
  host.onStep(CAPTAIN_STEP, dt => { encounter.update(dt, host.clock.now); }, {
    snapshot: () => JSON.stringify(encounter.encounterSnapshot()),
    restore: value => { encounter.encounterRestore(v.parse(Encounter, JSON.parse(v.parse(v.string(), value)))); },
  });
  return { encounter, publish: event => { spawn(); if (event === 'captain.wake') encounter.wake(); } };
}
