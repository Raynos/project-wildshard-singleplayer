import type { Vector3 } from 'three';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeBoss, bindRuntimeCoins, type RuntimeCoins } from '@wildshard/game/shardfile/hybridRows';
import { carriedBossRecord, installMarkedBoss, type MarkedBoss, type MarkedBossRows } from '@wildshard/sdk/markedBoss';
import { lastLightAll } from '../look/light';
import source from '../shard.config';
import { MATRIARCH_DEFINITION, MATRIARCH_FIGHT, MATRIARCH_ID, MATRIARCH_PRESENTATION, MATRIARCH_RECORD, MATRIARCH_REWARD } from '../data/matriarchFight';
import type { SignalWorld } from '../world/build';

/** Her rows (data/matriarchFight.ts): the encounter, the marked fight, its presentation and her 20 coins. */
const ROWS: MarkedBossRows = { definition: MATRIARCH_DEFINITION, fight: MATRIARCH_FIGHT, presentation: MATRIARCH_PRESENTATION, reward: MATRIARCH_REWARD };

/**
 * The Dune Matriarch (C5), a platform marked boss (`@wildshard/game/shardfile/markedBoss`) from her rows: a huge ray that
 * rises from the basin when the signal fire is lit — phase I sweeping dives, phase II a sand storm, phase III grounded.
 * Her body is the shardfile's declared boss row (`runtime.spawns`, bound under `sunscar.matriarch`, dressed in the dusk
 * rim); her record is the shard's flags (a current save's old `bossesSave` entry carried over once, C26); her coins go
 * through the platform purse (`coins`, else the shard's platform purse headless). Armed now once the fire is lit, or by
 * the returned `summon`.
 */
export function installMatriarch(ctx: ShardContext, player: Vector3, flags: SignalWorld['flags'], lit: () => boolean, coins?: RuntimeCoins, onDown?: () => void): { boss: MarkedBoss; summon: () => void } {
  const body = bindRuntimeBoss(ctx, source, MATRIARCH_ID, (a) => { lastLightAll(a.mesh, ctx.scope); });
  const record = carriedBossRecord(ctx, flags, MATRIARCH_ID, MATRIARCH_RECORD);
  return installMarkedBoss(ctx, ROWS, { player, body, record, coins: coins ?? bindRuntimeCoins(ctx, null), lit, ...(onDown === undefined ? {} : { onDown }) });
}
