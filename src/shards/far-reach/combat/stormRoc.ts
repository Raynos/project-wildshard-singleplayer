import { BossBrain, type BossScript, type BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Vector3 } from 'three';
import { CROWN, DAIS, FALLEN_BRIDGE } from '../layout';
import { STRINGS } from '../strings';
import { rocBrain, type RocPhase } from '../species/stormRoc';

export const ROC_ID = 'far.roc';
/** The HP fractions where phases 2 and 3 begin. */
export const PHASES = [1, 0.66, 0.33] as const;
const clampPhase = (n: number): RocPhase => n <= 0 ? 0 : n === 1 ? 1 : 2;

/**
 * The Storm Roc: the engine's BossBrain owns the intro, the HP-threshold phases, checkpoint and retry, and victory.
 * Phase 1 stoops from the storm, phase 2 sweeps gale walls across the crown, phase 3 lands on the dais and fights there.
 */
export class StormRocBoss extends BossBrain {
  constructor(ctx: ShardContext, player: Vector3, roc: Animal | null, onVictory: (at: Vector3) => void, saves: { read: () => BossSaved; write: (value: BossSaved) => void }) {
    let hp = 1, invulnerable = false;
    const at = new Vector3(DAIS.x, CROWN.y + DAIS.h, DAIS.z), body = roc ? rocBrain(roc) : null;
    const script: BossScript = {
      inArena: (p) => Math.hypot(p.x - CROWN.x, p.z - CROWN.z) < CROWN.r * 0.9 && p.y > CROWN.y - 2,
      reset: (checkpoint) => { hp = PHASES[clampPhase(checkpoint)]; if (body) { body.phase = clampPhase(checkpoint); body.fighting = false; body.restart(); }
        if (roc) { roc.hp = hp * roc.maxHp; roc.alive = true; } },
      seal: () => undefined, intro: () => at,
      begin: (next) => { if (body) { body.phase = clampPhase(next); body.fighting = true; } },
      enterPhase: (next) => { if (body) body.phase = clampPhase(next); },
      update: (_dt, _t, fighting) => { if (roc) hp = roc.hp / roc.maxHp; if (body) body.fighting = fighting; },
      get hpFrac() { return hp; }, get shielded() { return invulnerable; }, get dead() { return roc ? !roc.alive : hp === 0; },
      clampHp: (frac) => { hp = frac; if (roc) roc.hp = frac * roc.maxHp; }, setInvulnerable: (on) => { invulnerable = on; },
      victory: () => { onVictory(at); }, rewardPoint: () => at,
      respawnPoint: () => ({ pos: new Vector3(FALLEN_BRIDGE.x1, CROWN.y + 0.2, FALLEN_BRIDGE.z1 - 2), yaw: 0 }),
    };
    const presentation = new BossBar(); ctx.scope.onDispose(() => { presentation.scope.dispose(); });
    ctx.answer('damage.modify', (request) => request !== null && roc !== null && request.target === roc.combatActor() && invulnerable ? null : request);
    const saved = saves.read();
    super({ id: ROC_ID, name: STRINGS.roc, title: STRINGS.rocTitle, retryTitle: STRINGS.rocRetry, intro: 1.5, introShort: 0.3,
      phases: [{ at: PHASES[0], caption: STRINGS.rocP1, name: STRINGS.rocP1 }, { at: PHASES[1], caption: STRINGS.rocP2, name: STRINGS.rocP2 }, { at: PHASES[2], caption: STRINGS.rocP3, name: STRINGS.rocP3 }],
      reward: {} }, script,
      { events: ctx.app.events, player: { position: player }, lockInput: (on) => { ctx.game.runtime?.play?.weapons.setEnabled(!on); },
        respawn: (pos, yaw) => { const motor = ctx.game.runtime?.world?.player; if (motor) { motor.position.copy(pos); motor.yaw = yaw; } }, skipHeld: () => ctx.app.input.held('skip'),
        faceToward: (target) => { const motor = ctx.game.runtime?.world?.player; if (motor) motor.yaw = Math.atan2(motor.position.x - target.x, motor.position.z - target.z); },
        spawnReward: () => undefined, persist: saves.write }, presentation, saved);
  }
}
