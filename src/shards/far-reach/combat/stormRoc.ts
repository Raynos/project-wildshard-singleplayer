import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import { DirectorBossBrain } from '@wildshard/game/plugin/director';
import stages from '../data/bossStages.json' with { type: 'json' };
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Vector3 } from 'three';
import { rocBrain } from '../species/stormRoc';
import { heldBossFight } from '../runtime/heldBossFight';
import { ROC_DEFINITION, ROC_FIGHT } from '../data/rocFight';

/**
 * The Storm Roc: the engine's BossBrain owns the intro, the HP-threshold phases, checkpoint and retry, and victory.
 * Phase 1 stoops from the storm, phase 2 sweeps gale walls across the crown, phase 3 lands on the dais and fights there.
 * The fight itself is the view-free runtime/rocEncounter.ts (the headless runtime runs the same script); here are its views.
 */
export class StormRocBoss extends DirectorBossBrain {
  constructor(ctx: ShardContext, player: Vector3, roc: Animal | null, onVictory: (at: Vector3) => void, saves: { read: () => BossSaved; write: (value: BossSaved) => void }) {
    const fight = heldBossFight(ROC_FIGHT, roc, roc ? rocBrain(roc) : null, onVictory);
    const presentation = new BossBar(); ctx.scope.onDispose(() => { presentation.scope.dispose(); });
    ctx.answer('damage.modify', (request) => request !== null && roc !== null && request.target === roc.combatActor() && fight.shielded() ? null : request);
    const saved = saves.read();
    super(ROC_DEFINITION, fight.script,
      { events: ctx.app.events, player: { position: player }, lockInput: (on) => { ctx.game.runtime?.play?.weapons.setEnabled(!on); },
        respawn: (pos, yaw) => { const motor = ctx.game.runtime?.world?.player; if (motor) { motor.position.copy(pos); motor.yaw = yaw; } }, skipHeld: () => ctx.app.input.held('skip'),
        faceToward: (target) => { const motor = ctx.game.runtime?.world?.player; if (motor) motor.yaw = Math.atan2(motor.position.x - target.x, motor.position.z - target.z); },
        spawnReward: () => undefined, persist: saves.write }, presentation, saved, stages);
  }
}
