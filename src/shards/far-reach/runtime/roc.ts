import { installBossRow } from '@wildshard/game/shardfile/bossRow';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { FLAGS } from '../quest/flags';
import { BOSS_REWARD, ROC_ID } from '../data/rocFight';
import { rocBossDefinition, rocEncounter } from './rocEncounter';
import type { StormRocBrain } from './stormRocBrain';

/** The Roc encounter's fixed-step id; its continuation is BossBrain's plus the script's HP and shield. */
export const ROC_STEP = 'far.roc.encounter';
/** The ledger fact its first fall records (data/ledger.ts `far-reach.roc`, origin encounter.victory). */
export const ROC_FACT = 'far-reach.roc';

/** What the encounter is lent: the Roc's body and brain in the flock keeper, and the platform's effect ports. */
export interface SkyRocPorts {
  readonly roc: AnimalSim;
  readonly body: StormRocBrain<AnimalSim>;
  readonly fact: (name: string, actorId: string) => void;
  readonly coins: (amount: number, actorId: string) => void;
}

/**
 * The Storm Roc's encounter in the renderer-free host (SF72) on the platform's boss row (`installBossRow`: the engine's
 * BossBrain armed at install, the host's `damage.modify` refusing hits on the Roc through a beat's shield and the health
 * model's `death.checkpoint` returning a player who dies in the fight to the bridge landing), over the shared view-free
 * script (runtime/rocEncounter.ts) and the Roc's body in the flock keeper. A player on the crown starts the intro, then
 * the phases at 66 % and 33 %. Its first fall sets the boss flag, records the `far-reach.roc` fact and pays BOSS_REWARD
 * coins, exactly once (a later victory only toasts in the browser); it keeps no record of its own (the boss flag is it).
 * The player's weapons are locked through the intro (`locked`). The boss bar, name card, skip hold, toasts and coin burst
 * are views.
 */
export function installSkyRoc(host: SimHost, ports: SkyRocPorts): { boss: ReturnType<typeof installBossRow>['boss']; locked: () => boolean } {
  const fight = rocEncounter(ports.roc, ports.body, () => {
    if (host.flags.has(FLAGS.roc)) return;
    host.flags.set(FLAGS.roc); ports.fact(ROC_FACT, ROC_ID); ports.coins(BOSS_REWARD, ROC_ID);
  });
  const row = installBossRow(host, { step: ROC_STEP, definition: rocBossDefinition(), script: fight.script, body: () => ports.roc, shielded: fight.shielded,
    fight: { snapshot: fight.snapshot, restore: fight.restore }, saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, armed: true });
  return { boss: row.boss, locked: row.locked };
}
