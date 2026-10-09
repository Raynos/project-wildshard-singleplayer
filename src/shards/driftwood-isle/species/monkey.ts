import { animateMonkey } from './monkeyPose';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { app } from '@wildshard/engine/app/runtime';
import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import type { Rng } from '@wildshard/engine/core/rng';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { loft, skinPlain, S, boneIndex, mix, paletteColors, type Paint, type RGB } from '@wildshard/engine/entities/species/loft';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies, BoneDef, VariantDef, ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { MONKEY_VARIANTS } from './monkeyVariants';
import { MonkeyBrain, pickPerch, setPerch, type MonkeyMem, ST_PERCH, ST_GROUND_IDLE, ST_ATTACK, ST_DROP, ST_GROUND, ST_RETURN, ST_CLIMB,
  THROW_R, THROW_DUR, BITE_R, BITE_DAMAGE, BITE_DUR, UNDER_R, UNDER_T, RUN, HOLD_R } from './monkeyPolicy';
import * as THREE from 'three';

/**
 * Coconut Monkey — the palm-grove troop (art/driftwood-isle/round-3-enemies/driftwood-enemy-2-monkey.png): tan faceted fur, a dark face with a pale
 * muzzle, round ears, long arms, a long tail curling up over its back. Troops of 3–4, each in a palm crown. Custom rig:
 * body (pelvis, root) · spine · chest · head · per side arm sh / el / hand, leg hip / knee / foot · tail1..3.
 *
 * Behaviour (`think`): PERCHES in a frond crown (`EnemyWorld.perches` — Enemies.ts hands over the palm crowns; with
 * none it lives on the ground). From the crown it THROWS COCONUTS at you inside 14 m (a 1 s wind-up over its head,
 * then `world.throwCoconut` lobs one on a ballistic arc — 8 damage on a hit, and it is aimed at where you stand
 * when it leaves the hand, so strafing dodges it), every 2.5–4 s. Stand under its palm for more than 2 s and it DROPS
 * on you: chases at 3.2 m/s and BITES (0.7 s lunge, 6 damage within 1.3 m), then runs back to the trunk and CLIMBS
 * (2.2 m/s up the trunk) to its crown. When one of the troop dies the rest drop and flee to another palm 12–45 m
 * away. On the ground it scampers on all fours.
 */

const PALETTE = {
  fur: [0.78, 0.60, 0.36], back: [0.55, 0.40, 0.23], belly: [0.90, 0.80, 0.60],
  face: [0.20, 0.13, 0.09], muzzle: [0.84, 0.70, 0.56], hand: [0.24, 0.16, 0.11], earIn: [0.72, 0.48, 0.42], eye: [0.03, 0.02, 0.02],
} satisfies Record<string, RGB>;

/** the rig's bones by name — exactly the BoneDef list buildMonkey() emits (so the factory's bone map holds every key) */

/** `Animal.mem` as the monkey uses it (numbers only, the registry contract). The first `think` tick writes the first row;
 *  the rest are set as it perches / drops / climbs / bites, and `animate` (which can run first) guards them (`|| 0`, truthiness). */

function monkeyPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  return (out, x, _y, z, nx, ny, nz, part, t) => {
    switch (part) {
      case 'body': out.copy(P.fur); mix(out, out, P.back, sstep(0.2, -0.9, nz) * 0.8); mix(out, out, P.belly, sstep(0.3, 0.9, nz) * 0.8); break;
      case 'head':
        out.copy(P.fur); mix(out, out, P.back, sstep(0.3, 0.9, ny) * 0.5);
        mix(out, out, P.face, sstep(0.38, 0.46, t) * (1 - sstep(0.82, 0.9, t)) * (1 - sstep(0.5, 0.85, ny)));   // the dark mask: the front of the skull below the brow
        mix(out, out, P.muzzle, sstep(0.86, 0.94, t)); void nz;
        break;
      case 'ear': out.copy(P.back); mix(out, out, P.earIn, sstep(0.1, 0.6, -nx * Math.sign(x)) * 0.8); break;
      case 'arm': case 'leg': out.copy(P.fur); mix(out, out, P.back, sstep(0.4, 1.0, t) * 0.5); break;
      case 'hand': out.copy(P.hand); break;
      case 'tail': out.copy(P.fur); mix(out, out, P.back, sstep(0.3, 1.0, t) * 0.7); void z; break;
      case 'eye': out.copy(P.eye); break;
      default: out.copy(P.fur);
    }
  };
}

function buildMonkey(v: VariantDef, rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.42, 0] },
    { name: 'spine', parent: 'body', pos: [0, 0.52, 0.03] },
    { name: 'chest', parent: 'spine', pos: [0, 0.62, 0.05] },
    { name: 'head', parent: 'chest', pos: [0, 0.72, 0.08] },
    { name: 'tail1', parent: 'body', pos: [0, 0.42, -0.08] },
    { name: 'tail2', parent: 'tail1', pos: [0, 0.48, -0.24] },
    { name: 'tail3', parent: 'tail2', pos: [0, 0.62, -0.36] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.12, 0.64, 0.06] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.14, 0.47, 0.10] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.15, 0.31, 0.15] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.08, 0.40, -0.02] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.11, 0.25, 0.10] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.11, 0.05, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = monkeyPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head');
  // torso: pelvis → chest, a little pot belly
  fur.push(loft([
    S(0, 0.30, -0.01, 0.09, 0.08, body),
    S(0, 0.40, 0.0, 0.115, 0.10, body, spine, 0.2),
    S(0, 0.52, 0.02, 0.12, 0.10, spine),
    S(0, 0.62, 0.04, 0.115, 0.095, spine, chest, 0.7),
    S(0, 0.70, 0.06, 0.08, 0.07, chest),
  ], 16, 'body', paint, true, true));
  // head: round skull, short muzzle
  fur.push(loft([
    S(0, 0.74, -0.02, 0.085, 0.08, head),
    S(0, 0.755, 0.06, 0.10, 0.095, head),
    S(0, 0.752, 0.10, 0.095, 0.088, head),
    S(0, 0.745, 0.14, 0.085, 0.075, head),
    S(0, 0.735, 0.17, 0.07, 0.06, head),
    S(0, 0.72, 0.195, 0.05, 0.04, head),
    S(0, 0.71, 0.215, 0.02, 0.015, head),
  ], 16, 'head', paint, true, true));
  for (const sx of [1, -1]) {
    fur.push(loft([
      S(sx * 0.085, 0.78, 0.05, 0.03, 0.02, head),
      S(sx * 0.115, 0.80, 0.045, 0.042, 0.03, head),
      S(sx * 0.14, 0.81, 0.04, 0.025, 0.018, head),
    ], 8, 'ear', paint, true, true, 'z'));
    const eye = new THREE.SphereGeometry(0.017, 8, 6);
    eye.translate(sx * 0.036, 0.775, 0.165);
    eyes.push(skinPlain(eye, head, 'eye', paint));
    const side = sx > 0 ? 'L' : 'R';
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    fur.push(loft([
      S(sx * 0.11, 0.66, 0.06, 0.045, 0.045, chest, sh, 0.5),
      S(sx * 0.135, 0.56, 0.08, 0.036, 0.036, sh),
      S(sx * 0.14, 0.47, 0.10, 0.033, 0.033, sh, el, 0.5),
      S(sx * 0.145, 0.39, 0.125, 0.03, 0.03, el),
      S(sx * 0.15, 0.32, 0.15, 0.028, 0.028, el, hand, 0.6),
    ], 8, 'arm', paint, true, false));
    hard.push(loft([S(sx * 0.15, 0.32, 0.15, 0.03, 0.03, hand), S(sx * 0.155, 0.27, 0.17, 0.038, 0.03, hand), S(sx * 0.16, 0.22, 0.18, 0.02, 0.016, hand)], 8, 'hand', paint, false, true));
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    fur.push(loft([
      S(sx * 0.08, 0.42, -0.02, 0.055, 0.055, body, hip, 0.5),
      S(sx * 0.10, 0.33, 0.04, 0.045, 0.045, hip),
      S(sx * 0.11, 0.25, 0.10, 0.038, 0.038, hip, knee, 0.5),
      S(sx * 0.11, 0.15, 0.06, 0.033, 0.033, knee),
      S(sx * 0.11, 0.06, 0.02, 0.03, 0.03, knee, foot, 0.6),
    ], 8, 'leg', paint, true, false));
    hard.push(loft([S(sx * 0.11, 0.045, 0.0, 0.035, 0.028, foot), S(sx * 0.11, 0.035, 0.09, 0.04, 0.025, foot), S(sx * 0.11, 0.03, 0.14, 0.02, 0.014, foot)], 8, 'hand', paint, true, true));
  }
  const t1 = B('tail1'), t2 = B('tail2'), t3 = B('tail3');
  fur.push(loft([
    S(0, 0.40, -0.06, 0.03, 0.03, body, t1, 0.3),
    S(0, 0.44, -0.16, 0.026, 0.026, t1),
    S(0, 0.50, -0.26, 0.022, 0.022, t1, t2, 0.5),
    S(0, 0.58, -0.33, 0.019, 0.019, t2),
    S(0, 0.66, -0.35, 0.016, 0.016, t2, t3, 0.5),
    S(0, 0.74, -0.30, 0.012, 0.012, t3),
    S(0, 0.77, -0.24, 0.006, 0.006, t3),
  ], 8, 'tail', paint, false, true));
  void rng;
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.42, bodyHalfLen: 0.2, bodyRadius: 0.16, headRadius: 0.12, legLen: 0.36, feet: [[0.11, 0.06], [-0.11, 0.06], [0.11, -0.04], [-0.11, -0.04]], halfWidth: 0.16, capsuleAxis: 'y' },
  };
}

// ── animation ────────────────────────────────────────────────────────────────────────────




// ── AI ───────────────────────────────────────────────────────────────────────────────────


/** G51: preserve the existing shared cooldown stream and its lazy creation order. */
export function monkeyAttackRandom(): Pick<Rng, 'range'> { return app.rng.stream('ai'); }

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

export const MONKEY: SpeciesRow = {
  lockable: true,
  id: 'creature.monkey',
  kind: 'monkey',
  label: 'Coconut monkey',
  aggressive: true,
  walkSpeed: 1.2,
  chargeDamage: BITE_DAMAGE,
  sounds: { call: 'monkey_chatter', hurt: 'monkey_shriek', callEvery: [6, 18] },
  variants: MONKEY_VARIANTS,
  tick: 'ai',
  act: actMonkey,
  think: thinkMonkey,
};

export const MONKEY_LOOK: SpeciesLook = {
  rigContract: { skeleton: 'monkey.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.monkey', species: MONKEY.id, kind: 'monkey',
  fur: NO_FUR,
  rig: 'custom',
  build: buildMonkey,
  animate: animateMonkey,
  variants: { elder: { tint: { fur: [0.62, 0.58, 0.50], back: [0.40, 0.37, 0.32], belly: [0.85, 0.82, 0.74] } } },
};

const brains = new WeakMap<Animal, MonkeyBrain<Animal, ThinkCtx>>();
function brain(a: Animal): MonkeyBrain<Animal, ThinkCtx> {
  let value = brains.get(a);
  if (value === undefined) { value = new MonkeyBrain(a, legacyMonkeyDecision); brains.set(a, value); }
  return value;
}
function thinkMonkey(a: Animal, ctx: ThinkCtx): void { brain(a).think(ctx); }
function actMonkey(a: Animal, ctx: ThinkCtx): void { brain(a).act(ctx); }
