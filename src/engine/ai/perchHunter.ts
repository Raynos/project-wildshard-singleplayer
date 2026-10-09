import type { AnimalSim } from '../entities/AnimalSim';
import type { Rng } from '../core/rng';
import type { SimValue } from '../sim';

/** Ranged perch hunting followed by a bounded ground attack and return to a native perch recipe. */
export interface PerchHunterSpec {
  throwRadius: number; throwDuration: number; biteRadius: number; biteDuration: number;
  underRadius: number; underSeconds: number; holdRadius: number; runSpeed: number; activeGroundSeconds: number;
  biteCooldown: number; throwCooldownMin: number; throwCooldownMax: number; alertCue: string; noticeCue: string;
}
/** Native perch/drop/climb recipes and shared cooldown RNG retain authority outside the decision policy. */
export interface PerchHunterPorts<A extends AnimalSim> {
  dt: number; player: A['position']; calm: boolean; rng: Pick<Rng, 'next' | 'range'>; attackRandom: Pick<Rng, 'range'>;
  herd: readonly A[] | null; sound: (cue: string) => void;
  steer: (actor: A, yaw: number, speed: number, turnRate: number) => void; confine: (actor: A) => void;
  claim: (actor: A) => boolean; mayAttack: (actor: A) => boolean;
  pickPerch: (actor: A, minDistance: number, maxDistance: number, awayFrom?: A['position']) => number;
  setPerch: (actor: A, index: number) => void;
}
interface PerchMemory extends Record<string, number> {
  init: number; cd: number; under: number; hitT: number; fled: number; onGround: number; st: number; hx: number; hz: number;
  perch: number; px: number; pz: number; bx: number; bz: number; perchH: number;
  drop: number; vy: number; land: number; climb: number; bite: number; hit: number; gt: number; fleeTo: number; bit: number;
}
const ST_PERCH = 0, ST_GROUND_IDLE = 1, ST_ATTACK = 2, ST_DROP = 3, ST_GROUND = 4, ST_RETURN = 5, ST_CLIMB = 6;
/** Renderer-free decisions with no application singleton; all mutable policy state lives in the actor continuation. */
export class PerchHunterBrain<A extends AnimalSim> {
  private readonly actor: A;
  private readonly spec: PerchHunterSpec;
  private readonly contract: string;
  constructor(actor: A, spec: PerchHunterSpec) {
    const numbers = [spec.throwRadius, spec.throwDuration, spec.biteRadius, spec.biteDuration, spec.underRadius,
      spec.underSeconds, spec.holdRadius, spec.runSpeed, spec.activeGroundSeconds, spec.biteCooldown, spec.throwCooldownMin, spec.throwCooldownMax];
    if (numbers.some(n => !Number.isFinite(n) || n < 0 || n > 600) || spec.throwDuration <= 0 || spec.biteDuration <= 0
      || spec.runSpeed > 15 || spec.biteRadius > spec.throwRadius || spec.throwCooldownMin > spec.throwCooldownMax
      || [spec.alertCue, spec.noticeCue].some(cue => cue.length === 0 || cue.length > 128)) throw new Error('Invalid perch hunter parameters');
    this.actor = actor; this.spec = { ...spec }; this.contract = JSON.stringify({ version: 1, spec: this.spec });
  }
  /** Actor and shared RNG snapshots own mutable state; this adapter fences the policy tuning. */
  snapshot(): SimValue { return this.contract; }
  /** Restore without invoking perch recipes or consuming the shared attack random stream. */
  restore(saved: SimValue): void { if (saved !== this.contract) throw new Error('Incompatible perch hunter continuation'); }
  /** One host-scheduled decision; native body recipes publish drop/climb completion in numeric actor memory. */
  think(c: PerchHunterPorts<A>): void {
    // dt 0 is an interrupt's wake in the frame it already decided (the manager's 'decide now', whatever the clock)
    if (!Number.isFinite(c.dt) || c.dt < 0 || c.dt > 1) throw new Error('Invalid perch hunter step');
    const a = this.actor;
  const m = a.mem as PerchMemory, rng = c.rng;
  if (!m.init) {
    m.init = 1; m.cd = rng.range(1, 3); m.under = 0; m.hitT = 0; m.fled = 0; m.onGround = 0;
    const i = c.pickPerch(a, 0, 12);
    if (i >= 0) { c.setPerch(a, i); a.position.x = m.px; a.position.z = m.pz; a.yOffset = m.perchH; m.st = ST_PERCH; }
    else { m.st = ST_GROUND_IDLE; m.perch = -1; m.onGround = 1; m.hx = a.position.x; m.hz = a.position.z; }
  }
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz);
  const toPlayer = Math.atan2(dx, dz);
  m.cd = Math.max(0, m.cd - c.dt);
  a.lookTarget.copy(c.player); a.lookWeight = d < 25 ? 1 : 0;
  // one of the troop is dead: everyone abandons this palm for one further off
  if (!m.fled && c.herd?.some((h) => h !== a && !h.alive)) {
    m.fled = 1; a.cancelAttack(); c.sound(this.spec.alertCue);
    if (m.st === ST_PERCH || m.st === ST_CLIMB || (m.st === ST_ATTACK && !m.bite)) { m.climb = 0; m.drop = 1; m.vy = 0; m.st = ST_DROP; m.gt = 0; m.fleeTo = 1; }
    else if (m.st !== ST_GROUND_IDLE) { m.st = ST_RETURN; m.fleeTo = 1; }
    if (m.fleeTo) { const i = c.pickPerch(a, 12, 45, c.player); if (i >= 0) c.setPerch(a, i); m.fleeTo = 0; }
  }
  if (a.lastHitT > m.hitT) { m.hitT = a.lastHitT; a.cancelAttack(); if (m.st === ST_ATTACK) m.st = m.onGround ? ST_GROUND : ST_PERCH; }
  switch (m.st) {
    case ST_PERCH: {
      a.state = 'perch'; m.onGround = 0;
      a.setMotion(d < 30 ? toPlayer : a.desiredYaw, 0, 3); a.setStrafe(0);
      if (c.calm) break;
      // standing under the palm: it drops on you
      const du = Math.hypot(c.player.x - m.px, c.player.z - m.pz);
      m.under = du < this.spec.underRadius ? m.under + c.dt : 0;
      if (m.under > this.spec.underSeconds) { m.st = ST_DROP; m.drop = 1; m.vy = 0; m.under = 0; m.gt = this.spec.activeGroundSeconds; c.sound(this.spec.alertCue); break; }
      if (d < this.spec.throwRadius && d > 2.5 && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 0; m.hit = 0; a.startAttack(this.spec.throwDuration); c.sound(this.spec.noticeCue); } // E297: a throw is an attack too (a token)
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack';
      a.setMotion(toPlayer, 0, 6); a.setStrafe(0);
      const p = a.attackPhase;
      if (p >= 1 || p < 0) { a.cancelAttack(); if (m.bite) { m.cd = this.spec.biteCooldown; m.st = ST_GROUND; m.bit = 1; } else { m.cd = c.attackRandom.range(this.spec.throwCooldownMin, this.spec.throwCooldownMax); m.st = m.onGround ? ST_GROUND_IDLE : ST_PERCH; } }
      break;
    }
    case ST_DROP: {
      a.state = 'charge'; a.setMotion(toPlayer, 0, 4);
      if (!m.drop) { m.st = m.gt > 0 ? ST_GROUND : ST_RETURN; m.onGround = 1; m.bit = 0; if (m.st === ST_RETURN) { const i = c.pickPerch(a, 12, 45, c.player); if (i >= 0) c.setPerch(a, i); } }
      break;
    }
    case ST_GROUND: {
      // on the sand: chase and bite, then back to the trunk
      a.state = 'charge'; m.onGround = 1;
      m.gt -= c.dt;
      // E297: two others attacking — it hangs back just out of reach, chattering, until a token frees
      if (!c.mayAttack(a)) { if (d < this.spec.holdRadius - 0.5) c.steer(a, toPlayer + Math.PI, this.spec.runSpeed * 0.6, 5); else if (d > this.spec.holdRadius + 0.8) c.steer(a, toPlayer, this.spec.runSpeed, 5); else a.setMotion(toPlayer, 0, 6); }
      else if (d > this.spec.biteRadius * 0.85) c.steer(a, toPlayer, this.spec.runSpeed, 5); else a.setMotion(toPlayer, 0, 6);
      if (d < this.spec.biteRadius && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(this.spec.biteDuration); break; }
      if (m.gt <= 0 || (m.bit && d > 5) || c.calm) { m.st = ST_RETURN; if (m.perch < 0) { m.st = ST_GROUND_IDLE; } }
      break;
    }
    case ST_RETURN: {
      a.state = 'wander';
      const rx = m.bx - a.position.x, rz = m.bz - a.position.z, rd = Math.hypot(rx, rz);
      if (rd < 0.6) { m.st = ST_CLIMB; m.climb = 1; a.yOffset = 0; a.setMotion(Math.atan2(m.px - m.bx, m.pz - m.bz) || a.yaw, 0, 4); a.setStrafe(0); break; }
      c.steer(a, Math.atan2(rx, rz), this.spec.runSpeed, 5);
      // bitten on the way back: turns and fights
      if (!c.calm && d < this.spec.biteRadius && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(this.spec.biteDuration); }
      break;
    }
    case ST_CLIMB: {
      a.state = 'rise'; a.setMotion(a.desiredYaw, 0, 4);
      if (!m.climb) { m.st = ST_PERCH; m.under = 0; m.onGround = 0; m.cd = 1; }
      break;
    }
    case ST_GROUND_IDLE: {
      // no palms to live in: a ground troop that throws from the sand and bites up close
      a.state = 'idle'; m.onGround = 1;
      a.setMotion(d < 20 ? toPlayer : a.desiredYaw, 0, 3); a.setStrafe(0);
      if (c.calm) break;
      if (d < this.spec.biteRadius && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(this.spec.biteDuration); }
      else if (d < this.spec.throwRadius && d > 2.5 && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 0; m.hit = 0; a.startAttack(this.spec.throwDuration); c.sound(this.spec.noticeCue); }
      break;
    }
    default: break;
  }
  if (m.onGround && !m.drop) c.confine(a);

  }
}
