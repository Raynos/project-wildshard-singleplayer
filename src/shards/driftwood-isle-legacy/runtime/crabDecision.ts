import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';

/** `Animal.mem` as the crab uses it (numbers only, the registry contract): every key is written by the first `think` tick */
export interface CrabMem extends Record<string, number> {
  init: number; hx: number; hz: number; st: number; tm: number; sd: number; cd: number; hitT: number; shy: number; scat: number;
  wander: number; tx: number; tz: number; hit: number;
}

const ST_IDLE = 0, ST_ENGAGE = 1, ST_ATTACK = 2, ST_FLEE = 3;
const ENGAGE_R = 9, SHY_R = 3, DISENGAGE_R = 18, SNAP_DUR = 0.78;
/** E297 fight rules: a crab waiting its turn (two others attacking) circles this far out (m), not in snapping range */
const HOLD_R = 3.6;

/** Shipping crab decision oracle; the native species calls this exact policy until conversion. */
export function legacyCrabDecision(a: Animal, c: ThinkCtx): void {
  const m = a.mem as CrabMem, rng = c.rng;
  if (!m.init) { m.init = 1; m.hx = a.position.x; m.hz = a.position.z; m.st = ST_IDLE; m.tm = rng.range(1, 3); m.sd = rng.next() < 0.5 ? -1 : 1; m.cd = 0; m.hitT = 0; m.shy = 0; m.scat = 0; }
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz);
  const toPlayer = Math.atan2(dx, dz);
  m.cd = Math.max(0, m.cd - c.dt);
  // a blow interrupts whatever it was doing: it turns on you
  if (a.lastHitT > m.hitT) { m.hitT = a.lastHitT; a.cancelAttack(); if (m.st !== ST_FLEE) { m.st = ST_ENGAGE; m.cd = Math.max(m.cd, 0.6); } }
  // the big one is down: the small ones scatter, and stay shy afterwards
  if (a.variant === 'small' && !m.scat && c.herd?.some((h) => h.variant === 'big' && !h.alive)) { m.scat = 1; m.shy = 1; m.st = ST_FLEE; m.tm = rng.range(5, 7); a.cancelAttack(); c.sound('crab_click'); }
  const engageR = m.shy ? SHY_R : ENGAGE_R;
  switch (m.st) {
    case ST_IDLE: {
      a.state = 'idle';
      if (!c.calm && d < engageR) { m.st = ST_ENGAGE; m.tm = rng.range(1, 2.5); c.sound('crab_click'); break; }
      m.tm -= c.dt;
      if (m.tm <= 0) {
        // doze, or amble a couple of metres around the tidepool
        if (m.wander) { m.wander = 0; m.tm = rng.range(2, 6); a.setMotion(a.desiredYaw, 0, 2); a.setStrafe(0); }
        else { m.wander = 1; m.tm = rng.range(1.5, 3); const ang = rng.range(0, Math.PI * 2); m.tx = m.hx + Math.cos(ang) * 3; m.tz = m.hz + Math.sin(ang) * 3; }
      }
      if (m.wander) {
        const wx = m.tx - a.position.x, wz = m.tz - a.position.z;
        if (Math.hypot(wx, wz) < 0.5) { m.wander = 0; m.tm = rng.range(2, 6); a.setMotion(a.desiredYaw, 0, 2); }
        else { const yaw = Math.atan2(wx, wz); a.setMotion(yaw, 0, 3); a.setStrafe(Math.sin(yaw - a.yaw) > 0 ? 0.55 : -0.55); if (Math.abs(Math.sin(yaw - a.yaw)) < 0.3) { a.setStrafe(0); a.setMotion(yaw, 0.5, 3); } }
      }
      a.lookWeight = d < 14 ? 0.5 : 0; a.lookTarget.copy(c.player);
      break;
    }
    case ST_ENGAGE: {
      a.state = 'sidestep';
      a.lookTarget.copy(c.player); a.lookWeight = 1;
      if (c.calm || d > DISENGAGE_R) { m.st = ST_IDLE; m.tm = 2; a.setStrafe(0); a.setMotion(a.yaw, 0, 2); break; }
      m.tm -= c.dt;
      if (m.tm <= 0) { m.sd = -m.sd; m.tm = rng.range(1.0, 2.5); }
      // E297: while two others hold the attack tokens it circles out at HOLD_R, claws up, and waits its turn
      const wait = !c.mayAttack(a), far = wait ? HOLD_R + 0.6 : 2.6, near = wait ? HOLD_R - 0.6 : 1.4;
      if (d > far) { a.setMotion(toPlayer, 1.7, 5); a.setStrafe(m.sd * 0.5); }
      else if (!wait && m.cd <= 0 && d > 1.75) { a.setMotion(toPlayer, 1.2, 5); a.setStrafe(m.sd * 0.3); } // its turn: it steps in to snap
      else if (d < near) { a.setMotion(toPlayer, wait ? -1.1 : -0.6, 5); a.setStrafe(m.sd * 1.3); }      // too close: back off a step while circling
      else { a.setMotion(toPlayer, 0, 5); a.setStrafe(m.sd * 1.3); }
      if (!wait && d < 1.9 && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.hit = 0; a.startAttack(SNAP_DUR); a.setStrafe(0); a.setMotion(toPlayer, 0, 6); c.sound('crab_click'); }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack';
      a.setMotion(toPlayer, 0, 6); a.setStrafe(0);
      const p = a.attackPhase;
      if (p >= 1 || p < 0) { m.st = ST_ENGAGE; m.cd = 1.4; m.tm = rng.range(0.6, 1.6); a.cancelAttack(); }
      break;
    }
    case ST_FLEE: {
      a.state = 'flee';
      m.tm -= c.dt;
      c.steer(a, Math.atan2(-dx, -dz), 3.0, 4); a.setStrafe(0);
      a.lookWeight = 0;
      if (m.tm <= 0) { m.st = ST_IDLE; m.tm = 2; m.hx = a.position.x; m.hz = a.position.z; a.setMotion(a.yaw, 0, 2); }
      break;
    }
    default: break;
  }
  c.confine(a);
}

