import * as v from 'valibot';
import { Vector3 } from 'three';
import type { BossBrain } from '@wildshard/engine/ai/BossBrain';
import type { SimHost } from '@wildshard/engine/sim';
import { bossFlagRecord, installBossRow } from '@wildshard/game/shardfile/bossRow';
import { BASIN } from '../data/layout';
import { BASIN_FLOOR } from '../world/dunes';
import { FACT, MATRIARCH_FLAG } from '../quests/signal';
import { markedBossFight } from '@wildshard/sdk/bossFight';
import { MATRIARCH_DEFINITION, MATRIARCH_FIGHT, MATRIARCH_ID, MATRIARCH_RECORD, MATRIARCH_REWARD } from '../data/matriarchFight';
import type { KeptBossBody } from '@wildshard/game/shardfile/homeKeeper';

/** Her encounter's fixed-step id; its continuation is `BossBrain`'s plus the script's storm and invulnerability. */
export const MATRIARCH_STEP = MATRIARCH_ID;

const finite = v.pipe(v.number(), v.finite());
const Fight = v.strictObject({ stormGoal: finite, storm: finite, invulnerable: v.boolean() });

/** What her encounter is lent: her body in the creature keeper and the platform's effect ports. */
export interface SignalMatriarchPorts {
  readonly body: KeptBossBody;
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
}

/**
 * The Dune Matriarch's encounter in the renderer-free host (SF72) on the platform's boss row (`installBossRow`: the
 * engine's `BossBrain` with the host's damage / checkpoint answers and one continuation) over her view-free script
 * (data/matriarchFight.ts MATRIARCH_FIGHT, a marked boss fight), with her body in the creature keeper (runtime/headless.ts' species homes: the stream's six draws per reset,
 * the shared tokens, her phased-flyer brain at the 10 Hz cadence). The signal fire's light arms her (`summon`); her
 * invulnerability through a beat refuses hits; victory sets `MATRIARCH_FLAG` (the quest's last step) and emits her fact,
 * and the first fall pays her 20 coins. A player death in her fight returns them to the basin's rim, her body fresh at
 * the checkpoint's phase. Her record is the shard's beaten / paid flags.
 */
export function installSignalMatriarch(host: SimHost, ports: SignalMatriarchPorts): { boss: BossBrain; summon: () => void; locked: () => boolean } {
  const record = bossFlagRecord(host.flags, MATRIARCH_RECORD), saved = record.saved;
  const fight = markedBossFight(MATRIARCH_FIGHT, { body: { spawn: () => ports.body.draw(), retire: () => { ports.body.free(); } },
    rewardPoint: new Vector3(BASIN.x, BASIN_FLOOR, BASIN.z),
    respawnPoint: () => ({ pos: new Vector3(BASIN.x, host.groundHeightAt(BASIN.x, BASIN.z + BASIN.r + 4), BASIN.z + BASIN.r + 4), yaw: 0 }),
    victory: () => { host.flags.set(MATRIARCH_FLAG); ports.fact(FACT.matriarch, MATRIARCH_ID); } });
  fight.adopt(ports.body.actor());
  return installBossRow(host, { step: MATRIARCH_STEP, definition: MATRIARCH_DEFINITION, script: fight.script, body: fight.body, shielded: fight.invulnerable,
    fight: { snapshot: fight.snapshot, restore: value => { fight.restore(v.parse(Fight, value)); } }, saved, persist: record.persist,
    spawnReward: () => { saved.rewardTaken = true; record.persist(saved); ports.coins(MATRIARCH_REWARD, MATRIARCH_ID); },
    restored: () => { fight.adopt(ports.body.actor()); } });
}
