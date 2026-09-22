import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx, type ThinkCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, type Paint, type RGB } from './loft';
import type { Animal } from '../Animal';
import { NO_FUR, lookAngles, smooth01, bump, step, clamp } from './rigs';

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

type Side = 'L' | 'R';
/** the rig's bones by name — exactly the BoneDef list buildMonkey() emits (so the factory's bone map holds every key) */
type MonkeyBones = Record<'body' | 'spine' | 'chest' | 'head' | `tail${1 | 2 | 3}` | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, THREE.Bone>;
/** `Animal.mem` as the monkey uses it (numbers only, the registry contract). The first `think` tick writes the first row;
 *  the rest are set as it perches / drops / climbs / bites, and `animate` (which can run first) guards them (`|| 0`, truthiness). */
interface MonkeyMem extends Record<string, number> {
  init: number; cd: number; under: number; hitT: number; fled: number; onGround: number; st: number; hx: number; hz: number;
  perch: number; px: number; pz: number; bx: number; bz: number; perchH: number;
  drop: number; vy: number; land: number; climb: number; bite: number; hit: number; gt: number; fleeTo: number; bit: number;
}

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

const R = (b: THREE.Bone, x: number, y: number, z: number) => b.rotation.set(x, y, z);
const L = THREE.MathUtils.lerp;
const _from = new THREE.Vector3(), _to = new THREE.Vector3();

function animateMonkey(c: RigAnimCtx): void {
  const b = c.bones as MonkeyBones, t = c.t, seed = c.seed, m = c.mem as MonkeyMem, a = c.animal, dt = c.dt;
  // ── vertical: the drop (ballistic) and the climb (2.2 m/s up the trunk, sliding from the foot to the crown) run here, per frame ──
  if (m.drop) {
    m.vy = (m.vy || 0) - 9.8 * dt;
    a.yOffset += m.vy * dt;
    if (a.yOffset <= 0) { a.yOffset = 0; m.drop = 0; m.vy = 0; m.land = 0.35; }
  } else if (m.climb && m.perchH > 0) {
    a.yOffset = Math.min(m.perchH, a.yOffset + 2.2 * dt);
    const k = m.perchH > 0.01 ? a.yOffset / m.perchH : 1;
    a.position.x = L(m.bx, m.px, k); a.position.z = L(m.bz, m.pz, k);
    if (a.yOffset >= m.perchH - 1e-3) { m.climb = 0; a.position.x = m.px; a.position.z = m.pz; }
  }
  m.land = Math.max(0, (m.land || 0) - dt);
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const perched = c.state === 'perch' || (c.state === 'attack' && !m.bite && m.onGround !== 1);
  const moving = clamp(Math.hypot(c.speed, c.strafe) / 1.0, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const atk = c.attack;
  const look = lookAngles(c, 0.75);
  // ── base pose weights: sitting (perch), all-fours scamper (moving), standing crouch (ground idle), falling, climbing ──
  const sit = perched ? 1 : 0, fall = m.drop ? 1 : 0, climb = m.climb ? 1 : 0;
  const run = (1 - sit) * (1 - fall) * (1 - climb) * moving;
  const crouch = (1 - sit) * (1 - fall) * (1 - climb) * (1 - moving);
  // body: sits low with the chest up; scampers pitched forward; a landing squat
  const landK = bump(m.land, 0, 0.35);
  b.body.position.y = c.dims.bodyY - 0.13 * sit - 0.08 * run - 0.05 * crouch - 0.12 * landK + 0.02 * Math.sin(ph * 2) * run + 0.005 * Math.sin(t * 1.6 + seed) - 0.30 * dead;
  R(b.body, 0.25 * sit + 0.65 * run + 0.35 * crouch + 0.2 * fall + 0.35 * landK + 0.35 * c.flinch + dead - 0.6 * climb, 0, 0.04 * Math.sin(ph) * run);
  R(b.spine, -0.15 * sit - 0.1 * run + 0.15 * c.brace + 0.2 * dead, look.yaw * 0.25, 0);
  R(b.chest, -0.1 * sit + 0.1 * c.brace, look.yaw * 0.25, 0);
  // head: looks at you; the bite lunges it forward
  let headP = -0.25 * sit - 0.5 * run - 0.3 * crouch + 0.35 * c.flinch + 0.5 * dead + 0.3 * climb;
  if (atk >= 0 && m.bite) headP += 0.5 * bump(atk, 0.2, 0.7);
  R(b.head, headP - look.pitch * 0.6, look.yaw * 0.5, 0.08 * Math.sin(t * 0.9 + seed * 3) * sit);
  // ── arms ──
  const scratch = sit ? bump(((t + seed * 7) % 9) / 9, 0.55, 0.75) : 0;   // now and then a hand comes up to scratch the head
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = b[`arm${side}_sh`], el = b[`arm${side}_el`];
    const sw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    let shX = 0.35 * sit + (0.9 + 0.7 * sw) * run + 0.5 * crouch - 1.6 * fall + (side === 'R' ? 0.25 : 0.15) * dead;
    let elX = -0.4 * sit - (0.5 + 0.4 * Math.max(0, -sw)) * run - 0.6 * crouch - 0.6 * fall;
    let shZ = sx * (0.15 * sit + 0.1 * run + 0.9 * fall + 0.35 * dead);
    if (climb) { const cs = Math.sin(t * 6 + (sx > 0 ? 0 : Math.PI)); shX = -1.9 + 0.5 * cs; elX = -0.8 + 0.4 * cs; shZ = sx * 0.3; }
    if (scratch > 0 && side === 'L') { shX = L(shX, -1.4, scratch); elX = L(elX, -2.2, scratch); shZ = L(shZ, sx * 0.9, scratch); }
    if (atk >= 0) {
      if (m.bite) { const lunge = bump(atk, 0.15, 0.75); shX = L(shX, -1.1, lunge); elX = L(elX, -0.2, lunge); shZ = L(shZ, sx * 0.5, lunge); }
      else if (side === 'R') {
        // the throw: the arm winds back over the head (0 → 0.6), whips forward (0.6 → 0.75), drops back
        const wind = step(atk, 0, 0.58), whip = step(atk, 0.6, 0.76), rec = step(atk, 0.82, 1);
        const target = L(-2.8, 0.9, whip);
        shX = L(L(shX, -2.8, wind), target, whip) * (1 - rec) + shX * rec;
        elX = L(L(elX, -1.2, wind), -0.15, whip) * (1 - rec) + elX * rec;
        shZ = L(shZ, sx * 0.5, wind) * (1 - rec) + shZ * rec;
      } else { const wind = step(atk, 0, 0.58) * (1 - step(atk, 0.82, 1)); shX = L(shX, -0.6, wind); shZ = L(shZ, sx * 0.4, wind); }
    }
    R(sh, shX + 0.3 * c.brace, 0, shZ);
    R(el, elX, 0, 0);
    // legs: folded under while sitting, kicking while scampering, tucked while falling
    const hip = b[`leg${side}_hip`], knee = b[`leg${side}_knee`], foot = b[`leg${side}_foot`];
    const lsw = Math.sin(ph + (sx > 0 ? Math.PI : 0));
    let hipX = -1.5 * sit + (-0.5 + 0.6 * lsw) * run - crouch - 1.2 * fall - 0.6 * dead - 0.9 * climb - 0.7 * landK;
    let kneeX = 2.3 * sit + (0.9 + 0.5 * Math.max(0, lsw)) * run + 1.7 * crouch + 1.4 * fall + 0.8 * dead + 1.4 * climb + 1.2 * landK;
    if (climb) { const cs = Math.sin(t * 6 + (sx > 0 ? Math.PI : 0)); hipX += 0.4 * cs; kneeX += 0.3 * cs; }
    R(hip, hipX, 0, sx * (0.25 * sit + 0.1 + 0.4 * fall));
    R(knee, kneeX, 0, 0);
    R(foot, -0.4 * sit - 0.3 * run - 0.5 * crouch + 0.3 * fall, 0, 0);
  }
  // ── tail: curls up over the back at rest, streams behind on the run, lashes while it winds up ──
  const lash = atk >= 0 && !m.bite ? 0.6 * Math.sin(t * 9) * step(atk, 0, 0.5) : 0;
  const curl = 0.9 * sit + 0.4 * crouch + 0.2 * run + 0.7 * climb - 0.9 * dead;
  R(b.tail1, -0.5 * curl - 0.4 * run + 0.9 * dead, 0, 0.25 * Math.sin(t * 1.7 + seed) * (1 - run) + lash * 0.4);
  R(b.tail2, -0.8 * curl + 0.3 * Math.sin(t * 2.1 + seed) * sit, 0, 0.2 * Math.sin(t * 1.7 + 1 + seed) + lash * 0.6);
  R(b.tail3, -0.9 * curl + 0.4 * Math.sin(t * 2.6 + seed), 0, lash);
}

// ── AI ───────────────────────────────────────────────────────────────────────────────────

const ST_PERCH = 0, ST_GROUND_IDLE = 1, ST_ATTACK = 2, ST_DROP = 3, ST_GROUND = 4, ST_RETURN = 5, ST_CLIMB = 6;
const THROW_R = 14, THROW_DUR = 1.0, THROW_RELEASE = 0.62, BITE_R = 1.3, BITE_DAMAGE = 6, BITE_DUR = 0.7, UNDER_R = 2.6, UNDER_T = 2.0, RUN = 3.2;

function pickPerch(a: Animal, c: ThinkCtx, minD: number, maxD: number, awayFrom?: THREE.Vector3): number {
  const P = c.world.perches; if (P === undefined || P.length === 0) return -1;
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < P.length; i++) {
    const p = P[i]; if (p === undefined) continue;
    const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
    if (d < minD || d > maxD) continue;
    const taken = c.herd?.some((h) => h !== a && h.alive && h.mem['perch'] === i) ? 1 : 0;
    const away = awayFrom ? Math.hypot(p.x - awayFrom.x, p.z - awayFrom.z) : 0;
    const score = away * 0.5 - d * 0.3 - taken * 30 + c.rng.next() * 3;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
function setPerch(a: Animal, c: ThinkCtx, i: number): void {
  const m = a.mem as MonkeyMem;
  const p = c.world.perches?.[i];
  if (p === undefined) throw new Error(`monkey: no perch ${i}`);   // i came from pickPerch
  const base = c.world.perchBases?.[i] ?? p;
  m.perch = i; m.px = p.x; m.pz = p.z; m.bx = base.x; m.bz = base.z;
  m.perchH = Math.max(0.5, p.y - c.heightAt(p.x, p.z) + 0.05);
}

function thinkMonkey(a: Animal, c: ThinkCtx): void {
  const m = a.mem as MonkeyMem, rng = c.rng;
  if (!m.init) {
    m.init = 1; m.cd = rng.range(1, 3); m.under = 0; m.hitT = 0; m.fled = 0; m.onGround = 0;
    const i = pickPerch(a, c, 0, 12);
    if (i >= 0) { setPerch(a, c, i); a.position.x = m.px; a.position.z = m.pz; a.yOffset = m.perchH; m.st = ST_PERCH; }
    else { m.st = ST_GROUND_IDLE; m.onGround = 1; m.hx = a.position.x; m.hz = a.position.z; }
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
      if (d < THROW_R && d > 2.5 && m.cd <= 0) { m.st = ST_ATTACK; m.bite = 0; m.hit = 0; a.startAttack(THROW_DUR); c.sound('monkey_chatter'); }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack';
      a.setMotion(toPlayer, 0, 6); a.setStrafe(0);
      const p = a.attackPhase;
      if (m.bite) { if (p >= 0.45 && !m.hit) { m.hit = 1; if (d <= BITE_R) { c.hurt(BITE_DAMAGE); c.sound('monkey_shriek'); } } }
      else if (p >= THROW_RELEASE && !m.hit) {
        m.hit = 1;
        _from.set(a.position.x, a.position.y + 0.95 * a.scale, a.position.z);
        _to.set(c.player.x, c.player.y + 0.9, c.player.z);
        c.world.throwCoconut?.(_from, _to, a);
      }
      if (p >= 1 || p < 0) { a.cancelAttack(); if (m.bite) { m.cd = 1.2; m.st = ST_GROUND; m.bit = 1; } else { m.cd = rng.range(2.5, 4); m.st = m.onGround ? ST_GROUND_IDLE : ST_PERCH; } }
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
      if (d > BITE_R * 0.85) c.steer(a, toPlayer, RUN, 5); else a.setMotion(toPlayer, 0, 6);
      if (d < BITE_R && m.cd <= 0) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(BITE_DUR); break; }
      if (m.gt <= 0 || (m.bit && d > 5) || c.calm) { m.st = ST_RETURN; if (m.perch < 0) { m.st = ST_GROUND_IDLE; } }
      break;
    }
    case ST_RETURN: {
      a.state = 'wander';
      const rx = m.bx - a.position.x, rz = m.bz - a.position.z, rd = Math.hypot(rx, rz);
      if (rd < 0.6) { m.st = ST_CLIMB; m.climb = 1; a.yOffset = 0; a.setMotion(Math.atan2(m.px - m.bx, m.pz - m.bz) || a.yaw, 0, 4); a.setStrafe(0); break; }
      c.steer(a, Math.atan2(rx, rz), RUN, 5);
      // bitten on the way back: turns and fights
      if (!c.calm && d < BITE_R && m.cd <= 0) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(BITE_DUR); }
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
      if (d < BITE_R && m.cd <= 0) { m.st = ST_ATTACK; m.bite = 1; m.hit = 0; a.startAttack(BITE_DUR); }
      else if (d < THROW_R && d > 2.5 && m.cd <= 0) { m.st = ST_ATTACK; m.bite = 0; m.hit = 0; a.startAttack(THROW_DUR); c.sound('monkey_chatter'); }
      break;
    }
    default: break;
  }
  if (m.onGround && !m.drop) c.confine(a);
}

registerSpecies({
  kind: 'monkey',
  label: 'Coconut monkey',
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: 1.2,
  chargeDamage: BITE_DAMAGE,
  sounds: { call: 'monkey_chatter', hurt: 'monkey_shriek', callEvery: [6, 18] },
  variants: [
    { id: 'monkey', label: 'Coconut monkey', weight: 85, rarity: 'common', scale: [1.25, 1.4], hp: 30 },
    { id: 'elder', label: 'Grey elder', weight: 15, rarity: 'uncommon', scale: [1.5, 1.6], hp: 45, tint: { fur: [0.62, 0.58, 0.50], back: [0.40, 0.37, 0.32], belly: [0.85, 0.82, 0.74] } },
  ],
  build: buildMonkey,
  animate: animateMonkey,
  think: thinkMonkey,
});
