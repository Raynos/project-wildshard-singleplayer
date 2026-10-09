import type { AnimalSim } from '../entities/AnimalSim';
import type { Rng } from '../core/rng';
import type { SimValue } from '../sim';

/** A hidden interior guardian's perception, holding ring, retreat and strike timing. */
export interface GuardianSpec {
  wakeRadius: number; guardRadius: number; approachRadius: number; swingRadius: number; swingDuration: number;
  speed: number; holdRadius: number; sideSpeed: number; sideFlipSeconds: number; sinkAfterSeconds: number;
  cooldownSeconds: number; hideOffset: number; noticeCue: string;
}
/** Trusted interior floor and vertical-motion recipes publish completion through the actor's numeric memory. */
export interface GuardianPorts<A extends AnimalSim> {
  dt: number; player: A['position']; calm: boolean; rng: Pick<Rng, 'next'>;
  world: { hold?: { x: number; z: number; r: number; guardR: number; floorAt: (x: number, z: number) => number | undefined };
    splash?: (at: A['position'], strength: number) => void };
  heightAt: (x: number, z: number) => number; sound: (cue: string) => void;
  reach: (actor: A) => boolean; claim: (actor: A) => boolean; mayAttack: (actor: A) => boolean;
}
type GuardianMemory = Record<string, number> & {
  init: number; hx: number; hz: number; cd: number; hitT: number; away: number;
  rise: number; rising: number; sinking: number; floor: number; floorS?: number; st: number; hit: number; sd?: number; sdT?: number;
};
const ST_HIDE = 0, ST_RISE = 1, ST_ATTACK = 2, ST_GUARD = 3, ST_SINK = 4;
/** Renderer-free guardian decisions; vertical recipes, line of sight and attack authority remain host ports. */
export class GuardianBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly spec: GuardianSpec;
  private readonly contract: string;
  constructor(actor: A, spec: GuardianSpec) {
    const { noticeCue, hideOffset } = spec;
    const numbers = [spec.wakeRadius, spec.guardRadius, spec.approachRadius, spec.swingRadius, spec.swingDuration,
      spec.speed, spec.holdRadius, spec.sideSpeed, spec.sideFlipSeconds, spec.sinkAfterSeconds, spec.cooldownSeconds];
    if (numbers.some(n => !Number.isFinite(n) || n < 0 || n > 600) || !Number.isFinite(hideOffset) || Math.abs(hideOffset) > 15
      || spec.swingDuration <= 0 || spec.speed > 15 || spec.sideSpeed > 15 || spec.wakeRadius > spec.guardRadius
      || spec.swingRadius > spec.approachRadius || noticeCue.length === 0 || noticeCue.length > 128) throw new Error('Invalid guardian parameters');
    this.actor = actor; this.spec = { ...spec }; this.contract = JSON.stringify({ version: 1, spec: this.spec });
  }
  /** Mutable decisions live in the actor snapshot; this fences the admitted policy on restoration. */
  snapshot(): SimValue { return this.contract; }
  /** Reject policy drift without executing a decision or a native vertical recipe. */
  restore(saved: SimValue): void { if (saved !== this.contract) throw new Error('Incompatible guardian continuation'); }
  /** Run one host-scheduled decision against the same floor, reach and completion observations as native recipes. */
  think(c: GuardianPorts<A>): void {
    // dt 0 is an interrupt's wake in the frame it already decided (the manager's 'decide now', whatever the clock)
    if (!Number.isFinite(c.dt) || c.dt < 0 || c.dt > 1) throw new Error('Invalid guardian step');
    const a = this.actor;
  const m = a.mem as GuardianMemory, H = c.world.hold;
  if (!m.init) {
    m.init = 1; m.hx = a.position.x; m.hz = a.position.z; m.cd = 0; m.hitT = 0; m.away = 0;
    m.rise = 0; m.rising = 0; m.sinking = 0; m.floor = 0;
    m.st = ST_HIDE; a.state = 'hide';
    a.yOffset = this.spec.hideOffset;
  }
  const cx = H?.x ?? m.hx, cz = H?.z ?? m.hz, wakeR = H?.r ?? this.spec.wakeRadius, guardR = H?.guardR ?? this.spec.guardRadius;
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz);
  const toPlayer = Math.atan2(dx, dz);
  const dPlayerHold = Math.hypot(c.player.x - cx, c.player.z - cz);
  m.cd = Math.max(0, m.cd - c.dt);
  // the deck under its feet (the hold's floor), else the sand
  const fl = H?.floorAt(a.position.x, a.position.z);
  m.floor = fl !== undefined ? fl - c.heightAt(a.position.x, a.position.z) : 0;
  a.lookTarget.copy(c.player); a.lookWeight = m.st === ST_HIDE ? 0 : 1;
  const hit = a.lastHitT > m.hitT; if (hit) m.hitT = a.lastHitT;
  switch (m.st) {
    case ST_HIDE: {
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2); a.setStrafe(0);
      if ((!c.calm && dPlayerHold < wakeR) || hit) { m.st = ST_RISE; m.rising = 1; m.sinking = 0; a.state = 'rise'; c.sound(this.spec.noticeCue); c.world.splash?.(a.position, 1); }
      break;
    }
    case ST_RISE: {
      a.state = 'rise'; a.setMotion(toPlayer, 0, 1.5);
      if (!m.rising) { m.st = ST_GUARD; m.away = 0; }
      break;
    }
    case ST_GUARD: {
      a.state = 'stalk';
      const dh = Math.hypot(a.position.x - cx, a.position.z - cz);
      if (hit) a.cancelAttack();
      const reach = c.reach(a);
      if (!c.calm && d < this.spec.swingRadius && m.cd <= 0 && reach && c.claim(a)) { m.st = ST_ATTACK; m.hit = 0; a.setStrafe(0); a.startAttack(this.spec.swingDuration); a.setMotion(toPlayer, 0, 6); c.sound(this.spec.noticeCue); break; } // no swing through the mast or a beam (E296)
      if (!c.calm && dPlayerHold < guardR && d < this.spec.approachRadius) {
        m.away = 0;
        const wait = !c.mayAttack(a), stand = wait ? this.spec.holdRadius : this.spec.swingRadius * 0.8; // E297: two others attacking — it stands off and waits
        if (d > stand) { if (dh < guardR || (dx * (cx - a.position.x) + dz * (cz - a.position.z)) > 0) a.setMotion(toPlayer, this.spec.speed, 2.5); else a.setMotion(toPlayer, 0, 2.5); }
        else if (wait && d < this.spec.holdRadius - 0.6) a.setMotion(toPlayer, -0.6, 4);
        else a.setMotion(toPlayer, 0, 4);
        // E297 (E296 follow-up): close, but a beam or the mast between — it steps round it for a clear cut instead of waiting there
        if (!reach && d < this.spec.swingRadius + 1.2) {
          m.sdT = (m.sdT ?? 0) - c.dt;
          if (m.sd === undefined || m.sdT <= 0) { m.sd = m.sd === undefined ? (c.rng.next() < 0.5 ? -1 : 1) : -m.sd; m.sdT = this.spec.sideFlipSeconds; }
          a.setStrafe(m.sd * this.spec.sideSpeed);
        } else a.setStrafe(0);
      } else {
        // nobody in the hold: drift back to its spot, glare, and after a while sink out of sight
        m.away += c.dt; a.setStrafe(0);
        const hx = m.hx - a.position.x, hz = m.hz - a.position.z, hd = Math.hypot(hx, hz);
        if (hd > 0.6) a.setMotion(Math.atan2(hx, hz), this.spec.speed * 0.8, 2.5);
        else { a.setMotion(d < 30 ? toPlayer : a.desiredYaw, 0, 2); if (m.away > this.spec.sinkAfterSeconds) { m.st = ST_SINK; m.sinking = 1; m.rising = 0; c.world.splash?.(a.position, 0.5); } }
      }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack'; a.setMotion(toPlayer, 0, 6);
      const p = a.attackPhase;
      if (p >= 1 || p < 0) { a.cancelAttack(); m.st = ST_GUARD; m.cd = this.spec.cooldownSeconds; }
      break;
    }
    case ST_SINK: {
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2);
      if ((!c.calm && dPlayerHold < wakeR) || hit) { m.st = ST_RISE; m.rising = 1; m.sinking = 0; a.state = 'rise'; }
      else if (!m.sinking) m.st = ST_HIDE;
      break;
    }
    default: break;
  }

  }
}
