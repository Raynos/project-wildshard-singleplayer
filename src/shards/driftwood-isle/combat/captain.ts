import { BossBrain, type BossDef, type BossPorts, type BossPresentation, type BossScript, type Events } from '#engine';
import { Vector3 } from 'three';

export const CAPTAIN_DEF: BossDef = {
  id: 'boss.captain', name: 'boss.captain.name',
  arena: { at: 'shrine.pool', r: 22 }, wake: { flag: 'used:altar' },
  intro: null, seal: false, checkpoint: false, bar: 'boss',
  phases: [
    { at: 1, strikes: ['strike.captain.swing'] },
    { at: 0.66, strikes: ['strike.captain.swing', 'strike.captain.burst'] },
    { at: 0.33, strikes: ['strike.captain.swing', 'strike.captain.second-cut', 'strike.captain.burst'] },
  ],
  reward: null, persist: { deadFlag: 'dead:captain' }, capExempt: true,
};
export interface CaptainActor {
  position: Vector3; mem: Record<string, number>; alive: boolean; hp: number; maxHp: number;
}
export interface CaptainPorts {
  player: { position: Vector3 }; pool: { x: number; z: number }; events: Events;
  flags: { has: (flag: string) => boolean }; animal: () => CaptainActor | null;
  ui: BossPresentation;
}
const NAME = 'The Drowned Captain';

/** The authored fight owns its phases and rise/sink; the boss runtime owns encounter lifetime and UI. */
export class DrownedCaptain extends BossBrain {
  private readonly ports: CaptainPorts;
  private attempt = false;
  private waitForReturn = false;
  constructor(ports: CaptainPorts) {
    const noop = (): void => undefined;
    const script: BossScript = {
      inArena: (p) => Math.hypot(p.x - ports.pool.x, p.z - ports.pool.z) < CAPTAIN_DEF.arena.r,
      reset: noop, seal: noop, intro: () => new Vector3(ports.pool.x, 0, ports.pool.z), begin: noop,
      enterPhase: noop, update: noop, hpFrac: 1, shielded: false, dead: false, clampHp: noop,
      setInvulnerable: noop, victory: noop, rewardPoint: () => new Vector3(),
      respawnPoint: () => ({ pos: new Vector3(), yaw: 0 }),
    };
    const host: BossPorts = {
      player: ports.player, lockInput: noop, respawn: noop, skipHeld: () => false,
      faceToward: noop, spawnReward: noop, persist: noop,
    };
    super({ id: CAPTAIN_DEF.id, name: NAME, title: '', retryTitle: '', intro: 0, introShort: 0,
      phases: CAPTAIN_DEF.phases.map((phase) => ({ at: phase.at, caption: '', name: '' })), reward: {} },
    script, host, ports.ui, { defeated: false, rewardTaken: false, kills: 0 });
    this.ports = ports;
  }
  wake(): void {
    const animal = this.ports.animal();
    if (animal === null || !animal.alive || this.waitForReturn) return;
    animal.mem['awake'] = 1;
    if (!this.attempt) { this.attempt = true; this.state = 'fight'; }
  }
  private finish(outcome: 'won' | 'lost' | 'left'): void {
    if (!this.attempt) return;
    this.attempt = false;
    this.ports.events.emit('boss.attempt', { boss: CAPTAIN_DEF.id, level: 'driftwood-isle', outcome });
  }
  override arm(): void { this.wake(); }
  override disarm(): void { this.finish('left'); this.ui.hideBar(); this.state = 'dormant'; }
  /** No checkpoint, retry card, invulnerability beat, health clamp or arena seal for this fight. */
  override onPlayerDeath(): boolean {
    if (this.script.inArena(this.ports.player.position)) { this.finish('lost'); this.waitForReturn = true; this.ui.hideBar(); this.state = 'dormant'; }
    return false;
  }
  override update(dt: number, _t: number): void {
    this.ui.update(dt);
    const a = this.ports.animal(), near = this.script.inArena(this.ports.player.position);
    if (a === null) { this.ui.hideBar(); return; }
    if (!a.alive || this.ports.flags.has(CAPTAIN_DEF.persist.deadFlag)) {
      this.finish('won'); this.state = 'victory'; this.ui.hideBar(); return;
    }
    if (!near) { this.finish('left'); this.waitForReturn = false; this.state = 'dormant'; }
    if (near && this.ports.flags.has(CAPTAIN_DEF.wake.flag)) this.wake();
    const visible = near && (a.mem['rise'] ?? 0) > 0.5;
    if (visible && !this.ui.barShown) this.ui.showBar(NAME, [0.66, 0.33]);
    else if (!visible) this.ui.hideBar();
    this.phase = (a.mem['phase'] ?? 1) - 1;
    this.ui.setHp(a.hp / Math.max(1, a.maxHp));
  }
}
