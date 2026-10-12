import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import { BossView } from '@wildshard/game/plugin/ui';
import stages from '../data/bossStages.json' with { type: 'json' };
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Vector3 } from 'three';
import { rocBrain } from '../species/stormRoc';
import { bossFight } from '@wildshard/game/plugin/bossPhase';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import { ROC_DEFINITION, ROC_BOSS_PROFILE } from '../data/rocFight';

/**
 * The Storm Roc: the engine's BossBrain owns the intro, the HP-threshold phases, checkpoint and retry, and victory.
 * Phase 1 stoops from the storm, phase 2 sweeps gale walls across the crown, phase 3 lands on the dais and fights there.
 * The fight itself is the view-free runtime/rocEncounter.ts (the headless runtime runs the same script); its views are the
 * platform's browser boss row (`BossView`).
 */
export class StormRocBoss extends BossView {
  constructor(ctx: ShardContext, player: Vector3, roc: Animal | null, onVictory: (at: Vector3) => void, saves: { read: () => BossSaved; write: (value: BossSaved) => void }) {
    const profile = parseBossProfile(ROC_BOSS_PROFILE);
    if (profile.pattern !== 'held') throw new Error('The Storm Roc requires its declared held-body pattern');
    const fight = bossFight(profile, {body: roc, brain: roc ? rocBrain(roc) : null, victory: onVictory});
    super(ctx, { definition: ROC_DEFINITION, stages, script: fight.script, player, body: () => roc, shielded: fight.shielded, saved: saves.read(), persist: saves.write });
  }
}
