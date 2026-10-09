import * as v from 'valibot';
import { BossBrain, type BossSaved } from '@wildshard/engine/ai/BossBrain';
import { silentBossPresentation } from '@wildshard/engine/ai/phases';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { FLAGS } from '../quest/flags';
import { BOSS_REWARD, ROC_ID, rocBossDefinition, rocEncounter } from './rocEncounter';
import type { StormRocBrain } from './stormRocBrain';

/** The Roc encounter's fixed-step id; its continuation is BossBrain's plus the script's HP and shield. */
export const ROC_STEP = 'far.roc.encounter';
/** The ledger fact its first fall records (data/ledger.ts `far-reach.roc`, origin encounter.victory). */
export const ROC_FACT = 'far-reach.roc';

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(1),
  boss: v.strictObject({ state: v.picklist(['dormant', 'armed', 'intro', 'fight', 'beat', 'victory']), phase: finite, checkpoint: finite, attempts: finite, t: finite, skipT: finite, short: v.boolean(),
    saved: v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }) }),
  fight: v.strictObject({ hp: finite, invulnerable: v.boolean() }) });

/** What the encounter is lent: the Roc's body and brain in the flock keeper, and the platform's effect ports. */
export interface SkyRocPorts {
  readonly roc: AnimalSim;
  readonly body: StormRocBrain<AnimalSim>;
  readonly fact: (name: string, actorId: string) => void;
  readonly coins: (amount: number, actorId: string) => void;
}

/**
 * The Storm Roc's encounter in the renderer-free host (SF72), as runtime/index.ts runs it: the engine's BossBrain armed
 * at install over the shared view-free script (runtime/rocEncounter.ts) and the Roc's body in the flock keeper. A player
 * on the crown starts the intro, then the phases at 66 % and 33 %; its shield through a beat answers the host's
 * `damage.modify`; a player death in the fight answers the health model's `death.checkpoint` (back at the bridge
 * landing, the Roc reset to the checkpoint's phase). Its first fall sets the boss flag, records the `far-reach.roc` fact
 * and pays BOSS_REWARD coins, exactly once (a later victory only toasts in the browser). The player's weapons are locked
 * through the intro (`locked`). The boss bar, name card, skip hold, toasts and coin burst are views.
 */
export function installSkyRoc(host: SimHost, ports: SkyRocPorts): { boss: BossBrain; locked: () => boolean } {
  let saved: BossSaved = { defeated: false, rewardTaken: false, kills: 0 };
  const fight = rocEncounter(ports.roc, ports.body, () => {
    if (host.flags.has(FLAGS.roc)) return;
    host.flags.set(FLAGS.roc); ports.fact(ROC_FACT, ROC_ID); ports.coins(BOSS_REWARD, ROC_ID);
  });
  const player = host.player;
  const boss = new BossBrain(rocBossDefinition(), fight.script, { events: host.events, player: { position: player.position },
    lockInput: () => undefined, skipHeld: () => false,
    respawn: (pos, yaw) => { player.position.copy(pos); player.yaw = yaw; },
    faceToward: (target) => { player.yaw = Math.atan2(player.position.x - target.x, player.position.z - target.z); },
    spawnReward: () => undefined, persist: value => { saved = { ...value }; } }, silentBossPresentation(), saved);
  host.events.answer('damage.modify', (request) => request !== null && request.target === ports.roc.combatActor() && fight.shielded() ? null : request, host.scope);
  host.events.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true, host.scope);
  boss.arm();
  host.onStep(ROC_STEP, dt => { boss.update(dt, host.clock.now); }, {
    snapshot: () => JSON.stringify({ version: 1, boss: boss.snapshot(), fight: fight.snapshot() }),
    restore: value => {
      if (typeof value !== 'string') throw new Error('Invalid Roc encounter continuation');
      const state = v.parse(Saved, JSON.parse(value));
      boss.restore(state.boss); fight.restore(state.fight); saved = { ...state.boss.saved };
    },
  });
  return { boss, locked: () => boss.state === 'intro' };
}
