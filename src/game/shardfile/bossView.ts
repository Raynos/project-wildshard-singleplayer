import type { Vector3 } from 'three';
import type { BossDefinition, BossSaved, BossScript } from '@wildshard/engine/ai/BossBrain';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { DirectorBossBrain } from '../plugin/director';
import type { ShardContext } from '../plugin/context';

/** What a boss row's browser encounter is given: its rows, its view-free script, its body and its record. */
export interface BossViewSpec {
  readonly definition: BossDefinition;
  /** The encounter's authored stage rows (`DirectorBossBrain`). */
  readonly stages: unknown;
  readonly script: BossScript;
  /** The player's live position (the arena check, the reward's target). */
  readonly player: Vector3;
  /** The boss's live body: a hit on it is refused while `shielded`. */
  readonly body: () => Animal | null;
  readonly shielded: () => boolean;
  readonly saved: BossSaved;
  readonly persist: (value: BossSaved) => void;
  /** The first fall's reward (absent: the victory callback pays it). */
  readonly spawnReward?: () => void;
  /** Toast the brain's own lines on the HUD (a later fall's); absent, the shard's victory callback says it. */
  readonly toast?: boolean;
}

/**
 * A boss row's encounter in the browser (SHARD-PLATFORM BR-2), the twin of `installBossRow` in the renderer-free host:
 * the engine's `BossBrain` under its authored stages over the shard's view-free script, with the engine's `BossBar` (boss
 * bar, name card, skip hold), the player's weapons locked through the intro, respawn / face-toward on the player's motor,
 * its toasts on the HUD when asked, and `damage.modify` refusing hits on the body while the script is shielded. Signal's Dune Matriarch
 * and Sky Reach's Storm Roc are these.
 */
export class BossView extends DirectorBossBrain {
  constructor(ctx: ShardContext, spec: BossViewSpec) {
    const bar = new BossBar(), motor = (): { position: Vector3; yaw: number } | null => ctx.game.runtime?.world?.player ?? null;
    ctx.scope.onDispose(() => { bar.scope.dispose(); });
    ctx.answer('damage.modify', (request) => { const body = spec.body(); return request !== null && body !== null && request.target === body.combatActor() && spec.shielded() ? null : request; });
    super(spec.definition, spec.script, { events: ctx.app.events, player: { position: spec.player },
      lockInput: (on) => { ctx.game.runtime?.play?.weapons.setEnabled(!on); }, skipHeld: () => ctx.app.input.held('skip'),
      respawn: (pos, yaw) => { const m = motor(); if (m) { m.position.copy(pos); m.yaw = yaw; } },
      faceToward: (target) => { const m = motor(); if (m) m.yaw = Math.atan2(m.position.x - target.x, m.position.z - target.z); },
      spawnReward: () => { spec.spawnReward?.(); }, toast: spec.toast === true ? (message) => { ctx.game.runtime?.play?.hud.toast(message); } : undefined,
      persist: spec.persist }, bar, spec.saved, spec.stages);
  }
}

/**
 * Registers a browser boss with the level's encounters under `id`: armed now when `armed`, answering the health model's
 * death checkpoint, updated each frame. `summon` arms a dormant boss (`onSummon` runs then, e.g. its summons toast).
 */
export function installBossView<T extends BossView>(ctx: ShardContext, id: string, brain: T, armed: boolean, onSummon?: () => void): { boss: T; summon: () => void } {
  const live = ctx.app.encounters.boss(id, brain, ctx.scope);
  if (armed) live.arm();
  ctx.answer('death.checkpoint', (value) => live.onPlayerDeath() || value === true);
  ctx.system({ id, phase: 'update', run: (dt, t) => { live.update(dt, t); } });
  return { boss: live, summon: () => { if (live.state === 'dormant') { live.arm(); onSummon?.(); } } };
}
