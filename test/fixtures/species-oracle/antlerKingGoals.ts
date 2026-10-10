// Frozen shipping move policy; independent of the new row interpreter.
import type { Vector3 } from 'three';
import type { BrainPoint } from '@wildshard/engine/ai/strikes';
import { clipHitReached } from '@wildshard/game/combat/clipTiming';
import type { Lane, LaneBody } from '../../../src/shards/pine-hollow/combat/lane';
import type { PhShot } from '../../../src/shards/pine-hollow/runtime/audio/sfx';
import { headingTo } from '../../../src/shards/pine-hollow/combat/combatMath';
import { pineContact, PINE_STRIKES } from '../../../src/shards/pine-hollow/combat/strikes';
import { KING_ATTACK_TIMING } from '../../../src/shards/pine-hollow/combat/kingTiming';

interface GoalTell { setTime: (t: number) => void; ring: (x: number, z: number, radius: number, alpha: number) => void; hide: () => void }
/** What the King's goals read of the world, renderer-free (the page's PineCtx satisfies it over its Animal). */
export interface KingGoalEnv<B extends LaneBody> {
  reach: (actor: B, target: BrainPoint) => boolean;
  player: { readonly position: Vector3 };
  hurt: (a: B, dmg: number, throughWalls?: boolean) => void;
  trauma: (k: number) => void;
  shot: (name: PhShot, at: Vector3) => void;
}
const SWEEP_REACH = 7.1, SWEEP_R = SWEEP_REACH - 0.38, STALK_NEAR = 0.9 * SWEEP_REACH, STOMP_R = 4.4;

/** The King's complete move policy, renderer-free over any lane body (SF72). The adapter supplies arena hazards, animation and tells. */
export abstract class AntlerKingGoals<B extends LaneBody> {
  phase = 0;
  mode = 'dormant';
  protected modeT = 0;
  protected sweepCd = 2; protected stompCd = 4; protected callCd = 0; protected laneN = 0;
  protected open = 0;
  protected abstract readonly ctx: KingGoalEnv<B>;
  protected abstract readonly tellRing: GoalTell;
  protected abstract readonly waves: readonly { on: boolean }[];
  protected abstract readonly lane: Lane<B>;
  protected abstract tickWaves(k: B, dt: number, t: number): void;
  protected abstract stompNow(k: B): void;
  protected abstract aliveThralls(): number;
  protected abstract callThralls(n: number): void;
  protected abstract action(k: B, action: 'roar' | 'sweep' | 'strike' | 'brace'): void;
  protected abstract roar(k: B): void;
  protected setMode(mode: string): void { this.mode = mode; this.modeT = 0; }

  protected fight(k: B, dt: number, t: number): void {
    const p = this.ctx.player.position;
    const d = Math.hypot(p.x - k.position.x, p.z - k.position.z), yaw = headingTo(k.position.x, k.position.z, p.x, p.z);
    this.sweepCd -= dt; this.stompCd -= dt; this.callCd -= dt;
    this.tellRing.setTime(t);
    k.lookTarget.copy(p); k.lookWeight = 1;
    const wantOpen = this.mode === 'open' || (this.mode === 'stalk3' && this.lane.state === 'skid') ? 1 : 0;
    this.open = Math.max(0, Math.min(1, this.open + (wantOpen > this.open ? dt * 4 : -dt * 2.5)));
    this.tickWaves(k, dt, t);
    switch (this.mode) {
      case 'stalk': {
        k.setMotion(yaw, d > STALK_NEAR ? (this.phase === 1 ? 2.8 : 2.3) : 0, 1.4);
        if (this.phase >= 1 && this.callCd <= 0 && this.aliveThralls() < 3) { this.setMode('call'); this.action(k, 'roar'); k.startAttack(KING_ATTACK_TIMING.roar.duration); this.ctx.shot('king_bells', k.position); break; }
        if (d < SWEEP_REACH && this.sweepCd <= 0) { this.setMode('sweep'); this.action(k, 'sweep'); k.startAttack(KING_ATTACK_TIMING.sweep.duration); break; }
        if (this.stompCd <= 0 && this.modeT > 1) { this.setMode('stomp'); this.action(k, 'strike'); k.startAttack(KING_ATTACK_TIMING.strike.duration); }
        break;
      }
      case 'sweep': {
        k.setMotion(yaw, 0, 1.2);
        const kk = Math.min(1, this.modeT / KING_ATTACK_TIMING.sweep.duration);
        this.tellRing.ring(k.position.x, k.position.z, SWEEP_R, 0.3 + 0.6 * kk * (0.75 + 0.25 * Math.sin(t * 24)));
        if (clipHitReached(this.modeT, KING_ATTACK_TIMING.sweep)) {
          this.tellRing.hide();
          pineContact(k, p, PINE_STRIKES.sweep, (damage) => { this.ctx.hurt(k, damage); this.ctx.trauma(0.45); }, () => this.ctx.reach(k, p));
          this.ctx.trauma(0.15);
          this.sweepCd = 5; this.setMode('stalk');
        }
        break;
      }
      case 'stomp': {
        k.setMotion(yaw, 0, 1.2);
        const kk = Math.min(1, this.modeT / KING_ATTACK_TIMING.strike.duration);
        this.tellRing.ring(k.position.x, k.position.z, STOMP_R + kk, 0.4 + 0.5 * kk * (0.7 + 0.3 * Math.sin(t * 26)));
        if (clipHitReached(this.modeT, KING_ATTACK_TIMING.strike)) { this.tellRing.hide(); this.stompNow(k); this.setMode('waves'); }
        break;
      }
      case 'waves': {
        k.setMotion(yaw, 0, 1);
        if (this.waves.every((w) => !w.on)) { this.setMode('open'); this.ctx.shot('king_roar', k.position); }
        break;
      }
      case 'open': {
        k.setMotion(yaw, 0, 0.8);
        if (this.modeT >= (this.phase === 1 ? 2.6 : 3.2)) { this.stompCd = this.phase === 1 ? 7.5 : 9; this.setMode(this.phase === 2 ? 'stalk3' : 'stalk'); }
        break;
      }
      case 'call': {
        k.setMotion(yaw, 0, 1);
        if (clipHitReached(this.modeT, KING_ATTACK_TIMING.roar)) { this.callThralls(2); this.callCd = 20; this.setMode('stalk'); }
        break;
      }
      case 'stalk3': {
        // the Last Light: hold off, then down a lane at you — two or three in a row, the ribcage flaring at every skid
        if (this.lane.busy) {
          this.lane.update(k, dt, t, p, (dmg) => { this.ctx.hurt(k, dmg); this.ctx.trauma(0.6); });
          if (this.lane.state === 'run' && this.lane.t < dt * 1.5) this.ctx.shot('king_stomp', k.position);
          if (this.lane.idle()) { this.laneN++; this.modeT = this.laneN % 3 === 0 ? -1.5 : 0.4; }
          break;
        }
        k.setMotion(yaw, d > 18 ? 2.4 : 0, 1.6);
        if (this.stompCd <= 0 && d < 14) { this.setMode('stomp'); this.action(k, 'strike'); k.startAttack(KING_ATTACK_TIMING.strike.duration); break; }
        if (this.modeT > 1.2) { this.action(k, 'brace'); this.lane.start(k, p.x, p.z, 1.1); this.roar(k); }
        break;
      }
      default: this.setMode(this.phase === 2 ? 'stalk3' : 'stalk');
    }
  }

}
