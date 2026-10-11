// Original shipping decision captured at cc3d80266bde50259f7676b0e72e98b80b7229e0:src/shards/driftwood-isle/species/monkey.ts; native perch/vertical/contact recipes stay shipping.
import type { Animal } from '../../../src/engine/entities/AnimalView';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { monkeyAttackRandom } from '../../../src/shards/driftwood-isle/species/monkey';
import { pickPerch, setPerch, type MonkeyMem, ST_PERCH, ST_GROUND_IDLE, ST_ATTACK, ST_DROP, ST_GROUND, ST_RETURN, ST_CLIMB, THROW_R, THROW_DUR, BITE_R, BITE_DUR, UNDER_R, UNDER_T, RUN, HOLD_R } from '../../../src/shards/driftwood-isle/species/monkeyPolicy';

export function legacyMonkeyDecision(a: Animal, c: ThinkCtx): void {
  const m = a.mem as MonkeyMem, rng = c.rng;
  if (!m.init) {
    m.init = 1; m.cd = rng.range(1, 3); m.under = 0; m.hitT = 0; m.fled = 0; m.onGround = 0;
    const i = pickPerch(a, c, 0, 12);
    if (i >= 0) { setPerch(a, c, i); a.position.x = m.px; a.position.z = m.pz; a.yOffset = m.perchH; m.st = ST_PERCH; }
    else { m.st = ST_GROUND_IDLE; m.perch = -1; m.onGround = 1; m.hx = a.position.x; m.hz = a.position.z; }
  }
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz);
  const toPlayer = Math.atan2(dx, dz);
  m.cd = Math.max(0, m.cd - c.dt);
  a.lookTarget.copy(c.player); a.lookWeight = d < 25 ? 1 : 0;
  // one of the troop is dead: everyone abandons this palm for one further off
  if (!m.fled && c.herd?.some((h) => h !== a && !h.alive)) {
    m.fled = 1; a.cancelAttack(); c.sound('monkey_shriek');
    if (m.st === ST_PERCH || m.st === ST_CLIMB || (m.st === ST_ATTACK && !m.bite)) { m.climb = 0; m.drop = 1; m.vy = 0; m.st = ST_DROP; m.gt = 0; m.fleeTo = 1; }
    else if (m.st !== ST_GROUND_IDLE) { m.st = ST_RETURN; m.fleeTo = 1; }
    if (m.fleeTo) { const i = pickPerch(a, c, 12, 45, c.player); if (i >= 0) setPerch(a, c, i); m.fleeTo = 0; }
  }
  if (a.lastHitT > m.hitT) { m.hitT = a.lastHitT; a.cancelAttack(); if (m.st === ST_ATTACK) m.st = m.onGround ? ST_GROUND : ST_PERCH; }
  switch (m.st) {
    case ST_PERCH: {
      a.state = 'perch'; m.onGround = 0;
      a.setMotion(d < 30 ? toPlayer : a.desiredYaw, 0, 3); a.setStrafe(0);
      if (c.calm) break;
      // standing under the palm: it drops on you
      const du = Math.hypot(c.player.x - m.px, c.player.z - m.pz);
      m.under = du < UNDER_R ? m.under + c.dt : 0;
      if (m.under > UNDER_T) { m.st = ST_DROP; m.drop = 1; m.vy = 0; m.under = 0; m.gt = 7; c.sound('monkey_shriek'); break; }
      if (d < THROW_R && d > 2.5 && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 0; m.hit = 0; a.startAttack(THROW_DUR); c.sound('monkey_chatter'); } // E297: a throw is an attack too (a token)
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack';
      a.setMotion(toPlayer, 0, 6); a.setStrafe(0);
      const p = a.attackPhase;
      if (p >= 1 || p < 0) { a.cancelAttack(); if (m.bite) { m.cd = 1.2; m.st = ST_GROUND; m.bit = 1; } else { m.cd = monkeyAttackRandom().range(2.5, 4); m.st = m.onGround ? ST_GROUND_IDLE : ST_PERCH; } }
      break;
    }
    case ST_DROP: {
      a.state = 'charge'; a.setMotion(toPlayer, 0, 4);
      if (!m.drop) { m.st = m.gt > 0 ? ST_GROUND : ST_RETURN; m.onGround = 1; m.bit = 0; if (m.st === ST_RETURN) { const i = pickPerch(a, c, 12, 45, c.player); if (i >= 0) setPerch(a, c, i); } }
      break;
    }
    case ST_GROUND: {
      // on the sand: chase and bite, then back to the trunk
      a.state = 'charge'; m.onGround = 1;
      m.gt -= c.dt;
      // E297: two others attacking — it hangs back just out of reach, chattering, until a token frees
      if (!c.mayAttack(a)) { if (d < HOLD_R - 0.5) c.steer(a, toPlayer + Math.PI, RUN * 0.6, 5); else if (d > HOLD_R + 0.8) c.steer(a, toPlayer, RUN, 5); else a.setMotion(toPlayer, 0, 6); }
      else if (d > BITE_R * 0.85) c.steer(a, toPlayer, RUN, 5); else a.setMotion(toPlayer, 0, 6);
      if (d < BITE_R && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(BITE_DUR); break; }
      if (m.gt <= 0 || (m.bit && d > 5) || c.calm) { m.st = ST_RETURN; if (m.perch < 0) { m.st = ST_GROUND_IDLE; } }
      break;
    }
    case ST_RETURN: {
      a.state = 'wander';
      const rx = m.bx - a.position.x, rz = m.bz - a.position.z, rd = Math.hypot(rx, rz);
      if (rd < 0.6) { m.st = ST_CLIMB; m.climb = 1; a.yOffset = 0; a.setMotion(Math.atan2(m.px - m.bx, m.pz - m.bz) || a.yaw, 0, 4); a.setStrafe(0); break; }
      c.steer(a, Math.atan2(rx, rz), RUN, 5);
      // bitten on the way back: turns and fights
      if (!c.calm && d < BITE_R && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(BITE_DUR); }
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
      if (d < BITE_R && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(BITE_DUR); }
      else if (d < THROW_R && d > 2.5 && m.cd <= 0 && c.claim(a)) { m.st = ST_ATTACK; m.bite = 0; m.hit = 0; a.startAttack(THROW_DUR); c.sound('monkey_chatter'); }
      break;
    }
    default: break;
  }
  if (m.onGround && !m.drop) c.confine(a);
}

