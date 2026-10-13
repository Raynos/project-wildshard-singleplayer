import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import { RowBossView } from '@wildshard/game/plugin/ui';
import stages from '../data/bossStages.json' with { type: 'json' };
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Vector3 } from 'three';
import { rocBrain } from '../species/stormRoc';
import { ROC_DEFINITION, ROC_BOSS_PROFILE } from '../data/rocFight';

/**
 * The Storm Roc, the platform's held-body boss (`RowBossView`) from its rows (data/rocFight.ts): the engine's BossBrain
 * owns the intro, the HP-threshold phases, checkpoint and retry, and victory. Phase 1 stoops from the storm, phase 2
 * sweeps gale walls across the crown, phase 3 lands on the dais and fights there.
 */
export class StormRocBoss extends RowBossView {
  constructor(ctx: ShardContext, player: Vector3, roc: Animal | null, onVictory: (at: Vector3) => void, saves: { read: () => BossSaved; write: (value: BossSaved) => void }) {
    super(ctx, { definition: ROC_DEFINITION, stages, profile: ROC_BOSS_PROFILE }, { player, held: roc, brain: roc ? rocBrain(roc) : null, victory: onVictory, record: { saved: saves.read(), persist: saves.write } });
  }
}
