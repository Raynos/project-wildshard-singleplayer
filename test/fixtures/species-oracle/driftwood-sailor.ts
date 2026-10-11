// Original shipping decision captured at cc3d80266bde50259f7676b0e72e98b80b7229e0:src/shards/driftwood-isle/species/sailor.ts; native body/contact shell stays shipping; unused row/contact constants omitted.
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import type { SailorMem } from '../../../src/shards/driftwood-isle/species/sailor';

const ST_HIDE = 0, ST_RISE = 1, ST_ATTACK = 2, ST_GUARD = 3, ST_SINK = 4;
const SWING_R = 1.8, SWING_DUR = 0.9, SHAMBLE = 1.1, SINK_AFTER = 6;
/** E297 fight rules: waiting its turn (two others attacking) it stands off this far (m); blocked by a beam or the mast
 *  (no line of sight, E296) it side-steps round it at STEP_AROUND m/s, flipping side every SIDE_FLIP s */
const HOLD_R = 3.0, STEP_AROUND = 1.0, SIDE_FLIP = 1.6;

export function legacySailorDecision(a: Animal, c: ThinkCtx): void {
  const m = a.mem as SailorMem, H = c.world.hold;
  if (!m.init) {
    m.init = 1; m.hx = a.position.x; m.hz = a.position.z; m.cd = 0; m.hitT = 0; m.away = 0;
    m.rise = 0; m.rising = 0; m.sinking = 0; m.floor = 0;
    m.st = ST_HIDE; a.state = 'hide';
    a.yOffset = -2.3;
  }
  const cx = H?.x ?? m.hx, cz = H?.z ?? m.hz, wakeR = H?.r ?? 8, guardR = H?.guardR ?? 9;
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
      if ((!c.calm && dPlayerHold < wakeR) || hit) { m.st = ST_RISE; m.rising = 1; m.sinking = 0; a.state = 'rise'; c.sound('sailor_groan'); c.world.splash?.(a.position, 1); }
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
      if (!c.calm && d < SWING_R && m.cd <= 0 && reach && c.claim(a)) { m.st = ST_ATTACK; m.hit = 0; a.setStrafe(0); a.startAttack(SWING_DUR); a.setMotion(toPlayer, 0, 6); c.sound('sailor_groan'); break; } // no swing through the mast or a beam (E296)
      if (!c.calm && dPlayerHold < guardR && d < 14) {
        m.away = 0;
        const wait = !c.mayAttack(a), stand = wait ? HOLD_R : SWING_R * 0.8; // E297: two others attacking — it stands off and waits
        if (d > stand) { if (dh < guardR || (dx * (cx - a.position.x) + dz * (cz - a.position.z)) > 0) a.setMotion(toPlayer, SHAMBLE, 2.5); else a.setMotion(toPlayer, 0, 2.5); }
        else if (wait && d < HOLD_R - 0.6) a.setMotion(toPlayer, -0.6, 4);
        else a.setMotion(toPlayer, 0, 4);
        // E297 (E296 follow-up): close, but a beam or the mast between — it steps round it for a clear cut instead of waiting there
        if (!reach && d < SWING_R + 1.2) {
          m.sdT = (m.sdT ?? 0) - c.dt;
          if (m.sd === undefined || m.sdT <= 0) { m.sd = m.sd === undefined ? (c.rng.next() < 0.5 ? -1 : 1) : -m.sd; m.sdT = SIDE_FLIP; }
          a.setStrafe(m.sd * STEP_AROUND);
        } else a.setStrafe(0);
      } else {
        // nobody in the hold: drift back to its spot, glare, and after a while sink out of sight
        m.away += c.dt; a.setStrafe(0);
        const hx = m.hx - a.position.x, hz = m.hz - a.position.z, hd = Math.hypot(hx, hz);
        if (hd > 0.6) a.setMotion(Math.atan2(hx, hz), SHAMBLE * 0.8, 2.5);
        else { a.setMotion(d < 30 ? toPlayer : a.desiredYaw, 0, 2); if (m.away > SINK_AFTER) { m.st = ST_SINK; m.sinking = 1; m.rising = 0; c.world.splash?.(a.position, 0.5); } }
      }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack'; a.setMotion(toPlayer, 0, 6);
      const p = a.attackPhase;
      if (p >= 1 || p < 0) { a.cancelAttack(); m.st = ST_GUARD; m.cd = 1.5; }
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

