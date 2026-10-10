import * as v from 'valibot';
import { Vector3 } from 'three';
import type { BossBrain, BossDefinition } from '@wildshard/engine/ai/BossBrain';
import type { SimHost } from '@wildshard/engine/sim';
import { bossFlagRecord, installBossRow, type BossRowFlagNames } from './bossRow';
import { markedBossFight, type MarkedBossFightRow } from './bossFight';
import type { KeptBossBody, KeptBossRow } from './homeKeeper';

/** The rows a marked boss runs from headless: its body row, encounter, fight, record flags, coins, floor, respawn and victory. */
export interface MarkedBossRowSpec {
  /** The declared boss row (its id is the encounter's fixed-step id and its saved actor's identity; its `at` the arena heart). */
  readonly row: KeptBossRow;
  readonly definition: BossDefinition;
  readonly fight: MarkedBossFightRow;
  readonly record: BossRowFlagNames;
  readonly reward: number;
  /** The arena floor the reward leaves from, at the row's spot. */
  readonly floor: number;
  /** Where a death in the fight returns the player, on the ground there. */
  readonly respawn: { readonly x: number; readonly z: number; readonly yaw: number };
  /** Victory raises `flag` (a quest's step) and emits `fact` under the boss's id. */
  readonly victory: { readonly flag: string; readonly fact: string };
}
/** What a headless marked boss is lent: its body in the creature keeper and the platform's effect ports. */
export interface MarkedBossRowPorts {
  readonly body: KeptBossBody;
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
}

const finite = v.pipe(v.number(), v.finite());
const Fight = v.strictObject({ stormGoal: finite, storm: finite, invulnerable: v.boolean() });

/**
 * A marked boss fight in the renderer-free host (SF27): the platform's boss row (`installBossRow`: the engine's
 * `BossBrain`, one continuation) over the view-free `markedBossFight`, its body in the creature keeper. `summon` arms it;
 * its invulnerability through a beat refuses hits; victory raises the row's flag and emits its fact, and the first fall
 * pays its coins. A player death in the fight returns them to the respawn point, the body fresh at the checkpoint's
 * phase. Its record is the shard's flags.
 */
export function installMarkedBossRow(host: SimHost, spec: MarkedBossRowSpec, ports: MarkedBossRowPorts): { boss: BossBrain; summon: () => void; locked: () => boolean } {
  const record = bossFlagRecord(host.flags, spec.record), saved = record.saved, id = spec.row.id, [x, z] = spec.row.at, back = spec.respawn;
  const fight = markedBossFight(spec.fight, { body: { spawn: () => ports.body.draw(), retire: () => { ports.body.free(); } },
    rewardPoint: new Vector3(x, spec.floor, z),
    respawnPoint: () => ({ pos: new Vector3(back.x, host.groundHeightAt(back.x, back.z), back.z), yaw: back.yaw }),
    victory: () => { host.flags.set(spec.victory.flag); ports.fact(spec.victory.fact, id); } });
  fight.adopt(ports.body.actor());
  return installBossRow(host, { step: id, definition: spec.definition, script: fight.script, body: fight.body, shielded: fight.invulnerable,
    fight: { snapshot: fight.snapshot, restore: value => { fight.restore(v.parse(Fight, value)); } }, saved, persist: record.persist,
    spawnReward: () => { saved.rewardTaken = true; record.persist(saved); ports.coins(spec.reward, id); },
    restored: () => { fight.adopt(ports.body.actor()); } });
}
