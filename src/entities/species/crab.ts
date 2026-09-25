import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx, type ThinkCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, type Paint, type RGB } from './loft';
import type { Animal } from '../Animal';
import { NO_FUR, lookAngles, smooth01, bump, step, clamp, squashBody } from './rigs';

/**
 * Reef Crab — Wreck Cove's tidepool crab (art/driftwood-isle/round-3-enemies/driftwood-enemy-1-crab.png): a wide domed orange-red carapace with
 * a pale underside and a crust of barnacles, two eyestalks, six jointed legs and two big pincers. Groups of 3–5 —
 * one BIG (scale ~1.8, 70 hp, claws a quarter larger) and the rest small (scale ~0.85, 25 hp). Custom rig
 * (`rig: 'custom'`): body (root) + head (eyestalk root) + per side: claw arm / hand / tip, three legs × hip / knee.
 *
 * Behaviour (`think`, 10 Hz): dozes around its tidepool; inside 9 m it turns to face you and SIDESTEPS — strafes
 * around you at 1.3 m/s, flipping direction every 1–2.5 s, closing to ~2.4 m — and inside 1.9 m raises both claws
 * for a 0.5 s wind-up, then SNAPS: 10 damage if you are still within 1.6 m (strafe out of it). HARD SHELL
 * (`damageMul`): a blow that lands from the front (within 60° of its heading) does 50 %; flank it. When the big one
 * dies the small ones scatter (flee 6 s, then only bite when you come within 3 m or hit them).
 * Skitter (`animate`): the legs walk in two alternating tripods (L0 R1 L2 / R0 L1 R2), the sidestep reaches the
 * leading legs out and folds the trailing ones; claws up while engaged; the snap raises then slams them.
 */

const PALETTE = {
  shell: [0.86, 0.34, 0.15], shellDark: [0.62, 0.20, 0.09], belly: [0.94, 0.83, 0.66],
  leg: [0.84, 0.40, 0.19], legTip: [0.42, 0.16, 0.07], claw: [0.90, 0.38, 0.17], clawTip: [0.96, 0.87, 0.74],
  stalk: [0.66, 0.28, 0.13], eye: [0.03, 0.02, 0.02], barnacle: [0.88, 0.87, 0.82],
} satisfies Record<string, RGB>;

type Side = 'L' | 'R';
type LegIdx = 0 | 1 | 2;
/** the rig's bones by name — exactly the BoneDef list buildCrab() emits (so the factory's bone map holds every key) */
type CrabBones = Record<'body' | 'head' | `claw${Side}_${'arm' | 'hand' | 'tip'}` | `leg${Side}${LegIdx}_${'hip' | 'knee'}`, THREE.Bone>;
/** `Animal.mem` as the crab uses it (numbers only, the registry contract): every key is written by the first `think` tick */
interface CrabMem extends Record<string, number> {
  init: number; hx: number; hz: number; st: number; tm: number; sd: number; cd: number; hitT: number; shy: number; scat: number;
  wander: number; tx: number; tz: number; hit: number;
}

function crabPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  return (out, _x, y, z, _nx, ny, _nz, part, t) => {
    switch (part) {
      case 'body':
        out.copy(P.shell);
        mix(out, out, P.shellDark, sstep(0.05, -0.2, ny) * 0.5 + sstep(-0.18, 0.28, z) * 0.15);   // darker flanks, a warm front edge
        mix(out, out, P.belly, sstep(-0.25, -0.75, ny));
        break;
      case 'leg': mix(out, P.leg, P.legTip, sstep(0.45, 1.0, t)); if (y < 0.06) out.copy(P.legTip); break;
      case 'arm': out.copy(P.leg); break;
      case 'claw': mix(out, P.claw, P.clawTip, sstep(0.55, 1.0, t)); break;
      case 'tip': mix(out, P.claw, P.clawTip, sstep(0.3, 1.0, t)); break;
      case 'stalk': out.copy(P.stalk); break;
      case 'eye': out.copy(P.eye); break;
      case 'barnacle': out.copy(P.barnacle); break;
      default: out.copy(P.shell);
    }
  };
}

const LEG_IDX: readonly LegIdx[] = [0, 1, 2];
const LEG_Z: Record<LegIdx, number> = [0.08, -0.03, -0.14], LEG_FAN: Record<LegIdx, number> = [0.07, 0, -0.07];

function buildCrab(v: VariantDef, rng: Rng): AnimalSpecies {
  const cs = Number(v.traits?.['clawScale'] ?? 1);
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.20, 0] },
    { name: 'head', parent: 'body', pos: [0, 0.24, 0.22] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `claw${side}_arm`, parent: 'body', pos: [sx * 0.28, 0.18, 0.14] },
      { name: `claw${side}_hand`, parent: `claw${side}_arm`, pos: [sx * 0.50, 0.18, 0.38] },
      { name: `claw${side}_tip`, parent: `claw${side}_hand`, pos: [sx * 0.60, 0.20, 0.52] },
    );
    for (const i of LEG_IDX) bones.push(
      { name: `leg${side}${i}_hip`, parent: 'body', pos: [sx * 0.28, 0.17, LEG_Z[i]] },
      { name: `leg${side}${i}_knee`, parent: `leg${side}${i}_hip`, pos: [sx * 0.50, 0.38, LEG_Z[i] + LEG_FAN[i]] },
    );
  }
  const B = boneIndex(bones);
  const paint = crabPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), head = B('head');
  // carapace: a wide domed hexagonal shell, flat underneath, a scalloped front edge
  fur.push(loft([
    S(0, 0.20, -0.25, 0.14, 0.05, body, body, 0, 1.2, 0.6),
    S(0, 0.205, -0.15, 0.28, 0.09, body, body, 0, 1.35, 0.55),
    S(0, 0.21, -0.01, 0.35, 0.105, body, body, 0, 1.4, 0.5),
    S(0, 0.205, 0.13, 0.31, 0.095, body, body, 0, 1.3, 0.55),
    S(0, 0.195, 0.24, 0.20, 0.06, body, body, 0, 1.2, 0.6),
    S(0, 0.185, 0.30, 0.07, 0.03, body),
  ], 16, 'body', paint, true, true));
  // eyestalks + eyes
  for (const sx of [1, -1]) {
    hard.push(loft([
      S(sx * 0.07, 0.24, 0.23, 0.022, 0.022, head),
      S(sx * 0.085, 0.31, 0.245, 0.018, 0.018, head),
      S(sx * 0.09, 0.345, 0.25, 0.012, 0.012, head),
    ], 8, 'stalk', paint, false, true));
    const eye = new THREE.SphereGeometry(0.03, 8, 6);
    eye.translate(sx * 0.09, 0.36, 0.25);
    eyes.push(skinPlain(eye, head, 'eye', paint));
  }
  // barnacles: a crust of little cones over the top of the shell
  for (let i = 0; i < 13; i++) {
    const bx = rng.range(-0.28, 0.28), bz = rng.range(-0.18, 0.18);
    const by = 0.21 + 0.105 * 1.4 * Math.sqrt(Math.max(0, 1 - (bx / 0.35) ** 2 - (bz / 0.22) ** 2)) - 0.015;
    const r = rng.range(0.025, 0.045);
    hard.push(loft([S(bx, by - 0.01, bz, r, r, body), S(bx, by + r * 0.9, bz, r * 0.55, r * 0.55, body), S(bx, by + r * 1.15, bz, r * 0.2, r * 0.2, body)], 8, 'barnacle', paint, false, true));
  }
  // claws: arm → fat hand (the fixed finger runs on from it) + the movable dactyl on its own bone
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const arm = B(`claw${side}_arm`), hand = B(`claw${side}_hand`), tip = B(`claw${side}_tip`);
    fur.push(loft([
      S(sx * 0.26, 0.18, 0.13, 0.05, 0.045, body, arm, 0.5),
      S(sx * 0.38, 0.19, 0.26, 0.05 * cs, 0.045 * cs, arm),
      S(sx * 0.50, 0.18, 0.38, 0.055 * cs, 0.05 * cs, arm, hand, 0.5),
    ], 8, 'arm', paint, true, false));
    fur.push(loft([
      S(sx * 0.50, 0.18, 0.38, 0.075 * cs, 0.07 * cs, hand),
      S(sx * 0.58, 0.185, 0.48, 0.17 * cs, 0.13 * cs, hand),
      S(sx * 0.67, 0.18, 0.61, 0.14 * cs, 0.11 * cs, hand),
      S(sx * 0.72, 0.15, 0.75, 0.055 * cs, 0.045 * cs, hand),
      S(sx * 0.745, 0.12, 0.86, 0.01, 0.01, hand),
    ], 8, 'claw', paint, false, true));
    fur.push(loft([
      S(sx * 0.60, 0.21, 0.52, 0.055 * cs, 0.045 * cs, tip),
      S(sx * 0.665, 0.25, 0.66, 0.045 * cs, 0.036 * cs, tip),
      S(sx * 0.69, 0.25, 0.80, 0.01, 0.01, tip),
    ], 8, 'tip', paint, true, true));
    // legs: upper segment rising to the knee, lower segment down to a pointed foot
    for (const i of LEG_IDX) {
      const hip = B(`leg${side}${i}_hip`), knee = B(`leg${side}${i}_knee`);
      const z = LEG_Z[i], fan = LEG_FAN[i];
      fur.push(loft([
        S(sx * 0.27, 0.17, z, 0.035, 0.032, body, hip, 0.5),
        S(sx * 0.39, 0.30, z + fan * 0.5, 0.032, 0.03, hip),
        S(sx * 0.50, 0.38, z + fan, 0.03, 0.028, hip, knee, 0.5),
      ], 8, 'leg', paint, true, false));
      fur.push(loft([
        S(sx * 0.50, 0.38, z + fan, 0.03, 0.028, knee),
        S(sx * 0.60, 0.20, z + fan * 1.3, 0.024, 0.022, knee),
        S(sx * 0.66, 0.0, z + fan * 1.6, 0.006, 0.006, knee),
      ], 8, 'leg', paint, false, true));
    }
  }
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.20, bodyHalfLen: 0.22, bodyRadius: 0.30, headRadius: 0.09, legLen: 0.32, feet: [[0.68, 0.08], [-0.68, 0.08], [0.68, -0.25], [-0.68, -0.25]], halfWidth: 0.36 },
  };
}

// ── animation ────────────────────────────────────────────────────────────────────────────

const TRIPOD_A = new Set(['L0', 'R1', 'L2']);

function animateCrab(c: RigAnimCtx): void {
  const b = c.bones as CrabBones, t = c.t, seed = c.seed;
  const moving = clamp(Math.hypot(c.speed, c.strafe) / 0.5, 0, 1);
  const strafeK = clamp(c.strafe / 1.3, -1, 1);
  const fwdK = clamp(c.speed / 1.5, -1, 1);
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const engaged = c.state === 'sidestep' || c.state === 'attack' || c.state === 'alert';
  const atk = c.attack;
  // ── claws: raised while engaged, the snap = raise both over 2/3 of the attack then slam down and shut ──
  let raise = engaged ? 0.55 : 0.15, spread = engaged ? 0.25 : 0.0, open = engaged ? 0.35 : 0.1;
  if (atk >= 0) {
    const wind = step(atk, 0, 0.62), slam = step(atk, 0.64, 0.78), rec = step(atk, 0.86, 1);
    raise = THREE.MathUtils.lerp(raise, 1.35, wind) * (1 - slam) + 0.05 * slam * (1 - rec) + raise * rec;
    open = THREE.MathUtils.lerp(open, 0.85, wind) * (1 - slam) + 0.0 * slam;
    spread = THREE.MathUtils.lerp(spread, 0.55, wind) * (1 - slam) - 0.25 * slam;
  }
  raise += 0.5 * c.brace - 0.9 * dead;                          // braced: claws up; dead: claws drop
  const twitch = 0.05 * Math.sin(t * 2.7 + seed * 5);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const arm = b[`claw${side}_arm`], hand = b[`claw${side}_hand`], tip = b[`claw${side}_tip`];
    arm.rotation.set(-raise * 0.7, sx * (spread * 0.6 + twitch), sx * raise * 0.35);
    hand.rotation.set(-raise * 0.5, sx * spread * 0.5, 0);
    tip.rotation.set(0, sx * -(open * 0.6), -sx * open * 0.15);
  }
  // ── legs: two tripods, lift + swing; the sidestep reaches the leading legs out and folds the trailing ones ──
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    for (const i of LEG_IDX) {
      const hip = b[`leg${side}${i}_hip`], knee = b[`leg${side}${i}_knee`];
      const lp = (c.phase + (TRIPOD_A.has(side + i) ? 0 : 0.5)) % 1;
      const swing = lp < 0.42 ? Math.sin((lp / 0.42) * Math.PI) : 0;           // in the air
      const along = lp < 0.42 ? -Math.cos((lp / 0.42) * Math.PI) : 1 - 2 * ((lp - 0.42) / 0.58);   // -1 → 1 forward in the air, back on the ground
      const lift = swing * 0.42 * moving;
      // + rotation.z on a left leg raises it; rotation.y swings it along the body (sign by side)
      const reach = strafeK * sx;                                             // this side leads the sidestep
      const idle = (1 - moving) * 0.03 * Math.sin(t * 1.3 + i * 1.9 + seed * 3);
      hip.rotation.set(0, -sx * along * 0.30 * fwdK * moving, sx * (lift + idle + 0.22 * reach * swing));
      knee.rotation.set(0, 0, sx * (0.25 * swing * moving - 0.30 * reach * (1 - swing) * moving + 0.55 * c.flinch));
      if (dead > 0) { hip.rotation.z = sx * (0.15 + 0.5 * dead); knee.rotation.z = sx * 1.25 * dead; }
    }
  }
  // ── body: bob with the skitter, a low crouch when braced / flinching, drops to the sand when dead ──
  const bob = 0.012 * Math.sin(c.phase * Math.PI * 4) * moving;
  b.body.position.y = c.dims.bodyY + bob + 0.006 * Math.sin(t * 1.5 + seed) - 0.05 * c.brace - 0.03 * c.flinch - 0.11 * dead + 0.03 * (atk >= 0 ? bump(atk, 0.6, 0.85) : 0);
  b.body.rotation.set(0.05 * c.flinch + 0.08 * (atk >= 0 ? step(atk, 0, 0.62) : 0) - 0.06 * dead, 0, strafeK * 0.06 * moving);
  // ── eyestalks follow the target ──
  const look = lookAngles(c, 0.36, 1.0, 0.5);
  b.head.rotation.set(-look.pitch * 0.4 + 0.15 * dead, look.yaw * 0.6, 0.06 * Math.sin(t * 3.1 + seed * 7));
  squashBody(b.body, c.flinch);
}

// ── AI ───────────────────────────────────────────────────────────────────────────────────

const ST_IDLE = 0, ST_ENGAGE = 1, ST_ATTACK = 2, ST_FLEE = 3;
const ENGAGE_R = 9, SHY_R = 3, DISENGAGE_R = 18, SNAP_R = 1.6, SNAP_DAMAGE = 10, WINDUP = 0.5, SNAP_DUR = 0.78;

function thinkCrab(a: Animal, c: ThinkCtx): void {
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
      if (d > 2.6) { a.setMotion(toPlayer, 1.7, 5); a.setStrafe(m.sd * 0.5); }
      else if (d < 1.4) { a.setMotion(toPlayer, -0.6, 5); a.setStrafe(m.sd * 1.3); }      // too close: back off a step while circling
      else { a.setMotion(toPlayer, 0, 5); a.setStrafe(m.sd * 1.3); }
      if (d < 1.9 && m.cd <= 0) { m.st = ST_ATTACK; m.hit = 0; a.startAttack(SNAP_DUR); a.setStrafe(0); a.setMotion(toPlayer, 0, 6); c.sound('crab_click'); }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack';
      a.setMotion(toPlayer, 0, 6); a.setStrafe(0);
      const p = a.attackPhase;
      if (p >= WINDUP / SNAP_DUR && !m.hit) { m.hit = 1; if (d <= SNAP_R * Math.max(1, a.scale * 0.8)) { c.hurt(SNAP_DAMAGE); c.sound('crab_snap'); } }
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

/** the shell: a blow from within 60° of the crab's heading does half damage */
function crabDamageMul(a: Animal, _hit: THREE.Vector3, dir: THREE.Vector3): number {
  const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
  const dot = fx * dir.x + fz * dir.z;             // the blow travels opposite the heading when it comes from the front
  return dot < -0.5 ? 0.5 : 1;
}

registerSpecies({
  kind: 'crab',
  label: 'Reef crab',
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: 0.5,
  chargeDamage: SNAP_DAMAGE,
  sounds: { call: 'crab_click', hurt: 'crab_click', callEvery: [8, 25] },
  variants: [
    { id: 'small', label: 'Reef crab', weight: 75, rarity: 'common', scale: [0.78, 0.95], hp: 25 },
    { id: 'big', label: 'Big reef crab', weight: 25, rarity: 'uncommon', scale: [1.7, 1.9], hp: 70, traits: { clawScale: 1.25 }, mods: { chargeDamage: 14 } },
  ],
  build: buildCrab,
  animate: animateCrab,
  think: thinkCrab,
  damageMul: crabDamageMul,
});
