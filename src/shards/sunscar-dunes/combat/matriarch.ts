import { MATRIARCH_BOSS_PROFILE } from '../data/matriarchBoss';
import { parseMarkedBossPresentation } from '@wildshard/format/bossProfiles';
import type { Vector3 } from 'three';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installBossView, RowBossView } from '@wildshard/game/plugin/ui';
import { bindRuntimeBoss, bindRuntimeCoins, type RuntimeCoins } from '@wildshard/game/shardfile/hybridRows';
import { carriedBossRecord, stormWeather, type MarkedBoss } from '../runtime/shardfile/markedBoss';
import { lastLightAll } from '../look/light';
import source from '../runtime/source';
import stages from '../data/bossStages.json' with { type: 'json' };
import { MATRIARCH_DEFINITION, MATRIARCH_ID, MATRIARCH_RECORD, MATRIARCH_REWARD } from '../data/matriarchEncounter';
import { MATRIARCH_PRESENTATION } from '../data/matriarchPresentation';
import type { SignalWorld } from '../world/build';

/**
 * The Dune Matriarch (C5), the platform's spawned-body boss (`RowBossView`) from her rows (data/matriarchEncounter.ts,
 * data/matriarchPresentation.ts): a huge ray that rises from the basin when the signal fire is lit — phase I sweeping
 * dives, phase II a sand storm, phase III grounded. Her body is the shardfile's declared boss row (dressed in the dusk
 * rim); her record is the shard's flags (a current save's old `bossesSave` entry carried over once, C26); her 20 coins go
 * through the platform purse. Armed now once the fire is lit, or by the returned `summon`, which toasts the summons.
 */
export function installMatriarch(ctx: ShardContext, player: Vector3, flags: SignalWorld['flags'], lit: () => boolean, coins?: RuntimeCoins, onDown?: () => void): { boss: MarkedBoss; summon: () => void } {
  const body = bindRuntimeBoss(ctx, source, MATRIARCH_ID, (a) => { lastLightAll(a.mesh, ctx.scope); });
  const record = carriedBossRecord(ctx, flags, MATRIARCH_ID, MATRIARCH_RECORD), presentation = parseMarkedBossPresentation(MATRIARCH_PRESENTATION);
  const boss = new RowBossView(ctx, { definition: MATRIARCH_DEFINITION, stages, profile: MATRIARCH_BOSS_PROFILE }, { player, body, record, presentation,
    reward: MATRIARCH_REWARD, coins: coins ?? bindRuntimeCoins(ctx, null), weather: stormWeather(ctx, player, presentation.storm), ...(onDown === undefined ? {} : { onDown }) });
  return installBossView(ctx, MATRIARCH_ID, boss, lit(), () => { ctx.game.runtime?.play?.hud.toast(presentation.toasts.summoned); });
}
