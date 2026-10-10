import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { ShardContext } from '@wildshard/game/shard/context';
import { carriedBossRecord as platformRecord, installMarkedBoss as platformInstall, type MarkedBoss as PlatformBoss, type MarkedBossPorts as PlatformPorts,
  type MarkedBossRows as PlatformRows } from '@wildshard/game/shardfile/markedBoss';
import type { BossRowFlagNames, BossRowFlags } from '@wildshard/game/shardfile/bossRow';

/** A marked boss in the browser (SF27): the engine's `BossBrain` over its marked fight, with its presentation row's views. */
export type MarkedBoss = PlatformBoss;
/** The rows a marked boss is built from: definition, marked fight, presentation and coins. */
export type MarkedBossRows = PlatformRows;
/** What a marked boss is lent: player, bound body, record, purse, summoned state and victory beat. */
export type MarkedBossPorts = PlatformPorts;
/**
 * Installs a marked boss from its rows (SF27 / SF7f): the storm's weather fog and sand shells, the boss bar, the coin
 * burst and the toasts, registered with the encounters, armed now when already summoned, else by `summon`.
 */
export function installMarkedBoss(ctx: ShardContext, rows: PlatformRows, ports: PlatformPorts): { boss: PlatformBoss; summon: () => void } { return platformInstall(ctx, rows, ports); }
/** A boss's record on the shard's flags, a current save's old `bossesSave` entry under its id carried over once. */
export function carriedBossRecord(ctx: Pick<ShardContext, 'manifest'>, flags: BossRowFlags, id: string, names: BossRowFlagNames): { saved: BossSaved; persist: (value: BossSaved) => void } {
  return platformRecord(ctx, flags, id, names);
}
