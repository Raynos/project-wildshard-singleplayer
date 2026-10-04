import { BossBrain, type BossScript } from '@wildshard/engine/ai/BossBrain';
import { EliteBrain } from '@wildshard/engine/ai/EliteBrain';
import type { Animal } from '@wildshard/engine/entities/Animal';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { bossesSave, shardSave } from '@wildshard/game/saves';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Vector3 } from 'three';
import { BOSS, ELITE } from '../layout';
import { STRINGS } from '../strings';

export class Greyback extends EliteBrain<Animal> {
  private readonly ctx: ShardContext;
  constructor(ctx: ShardContext, player: Vector3) { super({ id: 'template.elite', awareR: 15, leashR: 25, lair: { ...ELITE, r: 5 } }, { player: { position: player }, random: () => ctx.app.rng.stream('ai').next() }); this.ctx = ctx; }
  override spawn(): void { this.animal = this.ctx.game.runtime?.play?.animals.spawn('boar', ELITE.x, ELITE.z, 0, 'greyback') ?? null; }
  override despawn(): void { if (this.animal) this.ctx.game.runtime?.play?.animals.retire(this.animal); this.animal = null; }
  protected override fight(a: Animal): void { const p = this.toPlayer(a); a.setMotion(p.yaw, p.d > 2 ? 2 : 0, 3); }
}
/** The engine owns intro, thresholds, checkpoint/retry and victory. */
export class BigBlob extends BossBrain {
  constructor(ctx: ShardContext, player: Vector3, animal: Animal | null) {
    let hp = 1, invulnerable = false, phase = 0;
    const at = new Vector3(BOSS.x, ctx.manifest.ground.terrain?.heightAt(BOSS.x, BOSS.z) ?? 0, BOSS.z);
    const script: BossScript = { inArena: (p) => p.distanceTo(at) < 8,
      reset: (checkpoint) => { phase = checkpoint; hp = checkpoint === 0 ? 1 : 0.5; if (animal) { animal.hp = hp * animal.maxHp; animal.alive = true; } },
      seal: () => undefined, intro: () => at, begin: (next) => { phase = next; },
      enterPhase: (next) => { phase = next; }, update: (_dt, _t, fighting) => {
        if (animal) { hp = animal.hp / animal.maxHp; if (fighting && animal.alive) animal.setMotion(Math.atan2(player.x - animal.position.x, player.z - animal.position.z), phase === 1 ? 2.5 : 1, 4); }
      },
      get hpFrac() { return hp; }, get shielded() { return invulnerable; }, get dead() { return animal ? !animal.alive : hp === 0; },
      clampHp: (frac) => { hp = frac; if (animal) animal.hp = frac * animal.maxHp; }, setInvulnerable: (on) => { invulnerable = on; },
      victory: () => undefined, rewardPoint: () => at, respawnPoint: () => ({ pos: new Vector3(0, 0, 0), yaw: 0 }) };
    const presentation = new BossBar(); ctx.scope.onDispose(() => { presentation.scope.dispose(); });
    ctx.answer('damage.modify', (request) => request !== null && animal !== null && request.target === animal.combatActor() && invulnerable ? null : request);
    const saves = shardSave(bossesSave, ctx.manifest.slug), saved = saves.read()['template.boss'] ?? { defeated: false, rewardTaken: false, kills: 0 };
    super({ id: 'template.boss', name: STRINGS.boss, title: STRINGS.bossTitle, retryTitle: STRINGS.retry, intro: 1, introShort: 0.2,
      phases: [{ at: 1, caption: STRINGS.phase1, name: STRINGS.phase1 }, { at: 0.5, caption: STRINGS.phase2, name: STRINGS.phase2 }], reward: {} }, script,
      { events: ctx.app.events, player: { position: player }, lockInput: (on) => { ctx.game.runtime?.play?.weapons.setEnabled(!on); },
        respawn: (pos, yaw) => { const motor = ctx.game.runtime?.world?.player; if (motor) { motor.position.copy(pos); motor.yaw = yaw; } }, skipHeld: () => ctx.app.input.held('skip'),
        faceToward: (target) => { const motor = ctx.game.runtime?.world?.player; if (motor) motor.yaw = Math.atan2(motor.position.x - target.x, motor.position.z - target.z); },
        spawnReward: () => undefined, persist: (value) => { saves.write({ ...saves.read(), 'template.boss': { ...value } }); } }, presentation, saved);
  }
}
export function installEncounters(ctx: ShardContext, player: Vector3): { elite: Greyback; boss: BigBlob } {
  const elite = ctx.app.encounters.elite('template.elite', new Greyback(ctx, player), ctx.scope); elite.spawn();
  const animals = ctx.game.runtime?.play?.animals;
  const blob = animals?.spawn('greyBlob', BOSS.x, BOSS.z, 0, 'big') ?? null;
  const boss = ctx.app.encounters.boss('template.boss', new BigBlob(ctx, player, blob), ctx.scope); boss.arm();
  ctx.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true);
  ctx.scope.onDispose(() => { elite.despawn(); if (blob) animals?.retire(blob); });
  ctx.system({ id: 'template.encounters', phase: 'update', run: (dt, t) => { elite.tick(dt, t, player.distanceTo(new Vector3(ELITE.x, 0, ELITE.z)) < 15, false); boss.update(dt, t); } });
  return { elite, boss };
}
