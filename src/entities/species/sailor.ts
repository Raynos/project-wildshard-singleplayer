import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx, type ThinkCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, type Paint, type RGB } from './loft';
import type { Animal } from '../Animal';
import { NO_FUR, lookAngles, smooth01, bump, step, clamp, squashBody } from './rigs';

/**
 * Drowned Sailor — the wreck's guardian (art/driftwood-isle/round-3-enemies/driftwood-enemy-3-wreckghost.png): a bone-white faceted skeleton in the
 * rags of a striped shirt and dark breeches, a red bandana, seaweed hanging off its shoulders and belt, glowing cyan
 * eyes (the eye material is emissive — `eyeGlow`; Enemies.ts adds the faint cyan point light) and a cutlass in its
 * right hand. Humanoid custom rig: body (pelvis, root) · spine · chest · head · per side arm sh / el / hand, leg
 * hip / knee / foot. 60 hp.
 *
 * Behaviour (`think`): HIDES under the wreck's broken deck (`EnemyWorld.hold`) until you come within `hold.r` of it,
 * then RISES through the planks over 1.5 s (arms up, water streaming — `world.splash`), and SHAMBLES after you at
 * 1.1 m/s while you stay inside `hold.guardR` of the hold — it guards the iron sword, it does not chase you down the
 * beach. Inside 1.8 m it winds the cutlass up over its head for 0.6 s and SWINGS: 18 damage within 1.9 m. When you
 * leave, it drifts back to its spot and sinks under the deck again. Dies into a splash of droplets (Enemies.ts: the
 * light goes out) and dissolves when harvested, or on its own after a minute (`corpseFade`). With no hold (the dev harness) it stands guard where it was placed.
 */

const PALETTE = {
  bone: [0.86, 0.83, 0.72], boneDark: [0.62, 0.60, 0.50], skull: [0.90, 0.88, 0.78], socket: [0.12, 0.16, 0.16],
  shirt: [0.88, 0.86, 0.78], stripe: [0.30, 0.36, 0.46], shorts: [0.24, 0.16, 0.11], bandana: [0.58, 0.13, 0.12],
  weed: [0.20, 0.40, 0.14], steel: [0.72, 0.76, 0.80], steelEdge: [0.90, 0.93, 0.96], guard: [0.22, 0.20, 0.18], grip: [0.32, 0.20, 0.12],
  eye: [0.35, 1.0, 1.0],
} satisfies Record<string, RGB>;

type Side = 'L' | 'R';
/** the rig's bones by name — exactly the BoneDef list buildSailor() emits (so the factory's bone map holds every key) */
type SailorBones = Record<'body' | 'spine' | 'chest' | 'head' | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, THREE.Bone>;
/** `Animal.mem` as the sailor uses it (numbers only, the registry contract; Enemies.ts reads `rise` / `rising` for the droplets).
 *  The first `think` tick writes every key but `floorS`, which `animate` (it can run first) seeds itself. */
interface SailorMem extends Record<string, number> {
  init: number; hx: number; hz: number; cd: number; hitT: number; away: number;
  rise: number; rising: number; sinking: number; floor: number; floorS?: number;
  st: number; hit: number;
}

function sailorPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  return (out, _x, y, z, _nx, ny, nz, part, t, a) => {
    switch (part) {
      case 'skull': out.copy(P.skull); mix(out, out, P.socket, sstep(0.55, 0.75, t) * sstep(0.2, 0.7, nz) * (1 - sstep(0.4, 0.7, ny)) * 0.9); mix(out, out, P.boneDark, sstep(0.86, 1.0, t) * 0.5); break;
      case 'bone': mix(out, P.bone, P.boneDark, 0.35 + 0.3 * Math.sin(y * 9 + a)); break;
      case 'shirt': {
        // horizontal stripes, salt-faded; the hem is torn to a ragged edge with bone showing beneath
        const band = Math.floor((y - 0.90) / 0.085) % 2 === 0;
        out.copy(band ? P.shirt : P.stripe);
        const hem = 0.96 + 0.05 * Math.sin(a * 3 + 1);
        if (y < hem && ((a * 5 + y * 40) % 2) < 1.2) mix(out, out, P.bone, 0.9);
        mix(out, out, P.weed, sstep(0.0, -0.6, nz) * 0.15);
        break;
      }
      case 'shorts': out.copy(P.shorts); break;
      case 'bandana': out.copy(P.bandana); mix(out, out, P.shorts, sstep(0.7, 1.0, t) * 0.3); break;
      case 'weed': mix(out, P.weed, P.shorts, sstep(0.6, 1.0, t) * 0.5); break;
      case 'steel': mix(out, P.steel, P.steelEdge, sstep(0.3, 0.9, Math.abs(ny))); void z; break;
      case 'guard': out.copy(P.guard); break;
      case 'grip': out.copy(P.grip); break;
      case 'eye': out.copy(P.eye); break;
      default: out.copy(P.bone);
    }
  };
}

function buildSailor(v: VariantDef, rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.95, 0] },
    { name: 'spine', parent: 'body', pos: [0, 1.12, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 1.32, 0] },
    { name: 'head', parent: 'chest', pos: [0, 1.56, 0.02] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.22, 1.47, 0] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.26, 1.21, 0.02] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.28, 0.97, 0.06] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.10, 0.92, 0] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.11, 0.50, 0.01] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.11, 0.07, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = sailorPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head');
  // skull: cranium, brow, jaw
  fur.push(loft([
    S(0, 1.63, -0.09, 0.075, 0.075, head),
    S(0, 1.65, -0.02, 0.10, 0.10, head, head, 0, 1.05, 0.95),
    S(0, 1.64, 0.06, 0.095, 0.095, head, head, 0, 1.05, 0.9),
    S(0, 1.60, 0.10, 0.07, 0.07, head),
    S(0, 1.55, 0.09, 0.05, 0.045, head),
  ], 16, 'skull', paint, true, true));
  // the bandana: a band round the cranium and a tail hanging at the back
  hard.push(loft([S(0, 1.69, -0.02, 0.108, 0.108, head), S(0, 1.745, -0.025, 0.098, 0.098, head), S(0, 1.785, -0.03, 0.06, 0.06, head), S(0, 1.80, -0.035, 0.015, 0.015, head)], 16, 'bandana', paint, false, true));
  hard.push(loft([S(0, 1.72, -0.10, 0.04, 0.014, head), S(0, 1.64, -0.16, 0.032, 0.01, head), S(0, 1.54, -0.19, 0.018, 0.006, chest, head, 0.6)], 8, 'bandana', paint, false, true, 'z'));
  for (const sx of [1, -1]) {
    const eye = new THREE.SphereGeometry(0.024, 8, 6);
    eye.translate(sx * 0.04, 1.63, 0.11);
    eyes.push(skinPlain(eye, head, 'eye', paint));
  }
  // neck + spine column
  fur.push(loft([S(0, 1.45, 0.0, 0.035, 0.035, chest), S(0, 1.55, 0.01, 0.03, 0.03, chest, head, 0.7)], 8, 'bone', paint, false, false));
  // torso in the striped shirt: pelvis → ribcage → shoulders, hunched
  // (stacked bands, one loft per stripe, so the flat facets keep the stripes crisp)
  {
    const prof = (y: number) => { const u = (y - 0.90) / 0.59; return { rx: 0.15 + 0.05 * Math.sin(u * Math.PI * 0.9), ry: 0.10 + 0.025 * Math.sin(u * Math.PI * 0.9) }; };
    const skin = (y: number): [number, number, number] => (y < 1.02 ? [body, spine, (y - 0.90) / 0.12 * 0.4] : y < 1.30 ? [spine, chest, Math.max(0, (y - 1.16) / 0.14) * 0.6] : [chest, chest, 0]);
    for (let k = 0; k < 7; k++) {
      const y0 = 0.90 + k * 0.085 + 0.002, y1 = y0 + 0.085 - 0.004;
      const p0 = prof(y0), p1 = prof(y1), s0 = skin(y0), s1 = skin(y1);
      fur.push(loft([S(0, y0, 0, p0.rx, p0.ry, s0[0], s0[1], s0[2]), S(0, y1, 0, p1.rx, p1.ry, s1[0], s1[1], s1[2])], 16, 'shirt', paint, k === 0, k === 6));
    }
    fur.push(loft([S(0, 1.49, 0.0, 0.16, 0.105, chest), S(0, 1.52, 0.0, 0.10, 0.07, chest)], 16, 'shirt', paint, false, true));
  }
  // breeches over the pelvis
  hard.push(loft([S(0, 0.74, 0.0, 0.15, 0.10, body), S(0, 0.86, 0.0, 0.16, 0.105, body), S(0, 0.93, 0.0, 0.15, 0.10, body)], 16, 'shorts', paint, true, false));
  // seaweed strands off the shoulders and belt
  for (let i = 0; i < 6; i++) {
    const ang = rng.range(0, Math.PI * 2), top = i < 3 ? 1.46 : 0.9, r = i < 3 ? 0.2 : 0.16, len = rng.range(0.18, 0.4);
    const bx = Math.cos(ang) * r, bz = Math.sin(ang) * r, bn = i < 3 ? chest : body;
    hard.push(loft([S(bx, top, bz, 0.02, 0.008, bn), S(bx * 1.15, top - len * 0.5, bz * 1.15, 0.018, 0.006, bn), S(bx * 1.2, top - len, bz * 1.2, 0.008, 0.003, bn)], 8, 'weed', paint, false, true, 'z'));
  }
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    // arms: shoulder knob, upper bone, elbow knob, forearm, hand
    hard.push(loft([S(sx * 0.19, 1.50, 0, 0.05, 0.045, chest, sh, 0.3), S(sx * 0.24, 1.46, 0.0, 0.05, 0.045, sh), S(sx * 0.25, 1.42, 0.0, 0.035, 0.035, sh)], 8, 'bone', paint, true, true));
    fur.push(loft([S(sx * 0.24, 1.44, 0.0, 0.032, 0.03, sh), S(sx * 0.25, 1.32, 0.01, 0.028, 0.026, sh), S(sx * 0.26, 1.21, 0.02, 0.03, 0.03, sh, el, 0.5), S(sx * 0.27, 1.09, 0.04, 0.026, 0.024, el), S(sx * 0.28, 0.98, 0.06, 0.022, 0.02, el, hand, 0.6)], 8, 'bone', paint, true, false));
    hard.push(loft([S(sx * 0.28, 0.98, 0.06, 0.03, 0.028, hand), S(sx * 0.285, 0.92, 0.07, 0.035, 0.025, hand), S(sx * 0.29, 0.86, 0.08, 0.018, 0.012, hand)], 8, 'bone', paint, false, true));
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    fur.push(loft([S(sx * 0.10, 0.90, 0.0, 0.05, 0.05, body, hip, 0.5), S(sx * 0.105, 0.72, 0.005, 0.038, 0.036, hip), S(sx * 0.11, 0.50, 0.01, 0.036, 0.036, hip, knee, 0.5), S(sx * 0.11, 0.30, 0.015, 0.03, 0.03, knee), S(sx * 0.11, 0.09, 0.02, 0.028, 0.028, knee, foot, 0.6)], 8, 'bone', paint, true, false));
    hard.push(loft([S(sx * 0.11, 0.055, -0.03, 0.04, 0.03, foot), S(sx * 0.11, 0.04, 0.10, 0.045, 0.028, foot), S(sx * 0.11, 0.03, 0.18, 0.025, 0.015, foot)], 8, 'bone', paint, true, true));
    hard.push(skinPlain(new THREE.SphereGeometry(0.045, 6, 5).translate(sx * 0.11, 0.50, 0.01), knee, 'bone', paint));
  }
  // the cutlass in the right hand: grip, guard, a flat curved blade pointing forward
  {
    const hand = B('armR_hand'), x = -0.29;
    hard.push(loft([S(x, 0.96, 0.02, 0.02, 0.02, hand), S(x, 0.90, 0.0, 0.022, 0.022, hand), S(x, 0.84, -0.02, 0.025, 0.025, hand)], 8, 'grip', paint, true, true));
    hard.push(loft([S(x, 0.91, 0.03, 0.06, 0.06, hand), S(x, 0.90, 0.08, 0.055, 0.05, hand), S(x, 0.89, 0.10, 0.02, 0.02, hand)], 8, 'guard', paint, true, true));
    hard.push(loft([
      S(x, 0.90, 0.10, 0.006, 0.03, hand), S(x, 0.90, 0.30, 0.008, 0.038, hand), S(x, 0.905, 0.50, 0.007, 0.044, hand), S(x, 0.92, 0.64, 0.005, 0.038, hand), S(x, 0.945, 0.74, 0.002, 0.01, hand),
    ], 8, 'steel', paint, true, true));
  }
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.95, bodyHalfLen: 0.48, bodyRadius: 0.26, headRadius: 0.15, legLen: 0.85, feet: [[0.11, 0.05], [-0.11, 0.05], [0.11, -0.05], [-0.11, -0.05]], halfWidth: 0.25, capsuleAxis: 'y' },
  };
}

// ── animation ────────────────────────────────────────────────────────────────────────────

const R = (b: THREE.Bone, x: number, y: number, z: number) => b.rotation.set(x, y, z);
const L = THREE.MathUtils.lerp;
export const RISE_T = 1.5;

function animateSailor(c: RigAnimCtx): void {
  const b = c.bones as SailorBones, t = c.t, seed = c.seed, m = c.mem as SailorMem, a = c.animal, dt = c.dt;
  // ── rising / sinking through the deck (per frame, smooth): mem.rise 0 (under) → 1 (standing) ──
  if (m.rising) { m.rise = Math.min(1, (m.rise || 0) + dt / RISE_T); if (m.rise >= 1) m.rising = 0; }
  if (m.sinking) { m.rise = Math.max(0, (m.rise || 0) - dt / RISE_T); if (m.rise <= 0) m.sinking = 0; }
  const up = m.init ? smooth01(m.rise || 0) : 0;
  const floor = m.floor || 0;
  m.floorS = (m.floorS ?? floor) + (floor - (m.floorS ?? floor)) * Math.min(1, dt * 6);   // the deck under it, smoothed (it steps off the heeled deck onto the sand)
  a.yOffset = L(m.floorS - 2.3, m.floorS, up);
  const rise = 1 - up;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const moving = clamp(c.speed / 0.8, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const atk = c.attack;
  const look = lookAngles(c, 1.6, 0.9, 0.5);
  const sway = Math.sin(t * 0.8 + seed * 4);
  // ── body: hunched, lurching with the shamble; dies to its knees then face down ──
  const kneel = step(dead, 0, 0.5), topple = step(dead, 0.45, 1);
  b.body.position.y = c.dims.bodyY - 0.06 - 0.04 * Math.abs(Math.sin(ph)) * moving - 0.08 * c.brace - 0.42 * kneel - 0.25 * topple + 0.02 * sway * (1 - moving);
  let bodyP = 0.28 + 0.1 * moving + 0.15 * c.brace - 0.35 * rise + 1.35 * topple;
  let spineY = 0.06 * sway, headP = -0.15 + 0.2 * c.flinch + 0.25 * kneel + 0.3 * topple;
  const headZ = 0.15 * Math.sin(t * 0.6 + seed);
  // ── the cutlass swing: wind up over the head (0 → 0.62), the cut (0.62 → 0.78), recover ──
  let swX = 0.2, swZ = -0.25, elR = -0.5;
  const swY = 0;
  if (atk >= 0) {
    const wind = step(atk, 0, 0.6), cut = step(atk, 0.62, 0.78), rec = step(atk, 0.85, 1);
    swX = L(L(0.2, -2.7, wind), 0.95, cut) * (1 - rec) + 0.2 * rec;
    swZ = L(L(-0.25, -0.9, wind), 0.2, cut) * (1 - rec) - 0.25 * rec;
    elR = L(L(-0.5, -0.9, wind), -0.15, cut) * (1 - rec) - 0.5 * rec;
    bodyP += L(L(0, -0.25, wind), 0.45, cut) * (1 - rec);
    spineY += L(L(0, 0.45, wind), -0.5, cut) * (1 - rec);
    headP += 0.2 * cut * (1 - rec);
  }
  R(b.body, bodyP, 0, 0.03 * sway);
  R(b.spine, 0.1 + 0.05 * c.brace, spineY + look.yaw * 0.3, 0.04 * Math.sin(t * 0.7 + seed));
  R(b.chest, 0.08, look.yaw * 0.2, 0);
  R(b.head, headP - look.pitch * 0.5 - 0.6 * rise, look.yaw * 0.5, headZ);
  // ── arms: the left hangs and swings stiffly; the right carries the cutlass low, or swings it ──
  const armSw = Math.sin(ph) * 0.35 * moving;
  const riseArms = rise > 0.02 ? -2.2 * bump(1 - rise, 0, 0.9) - 0.3 * rise : 0;   // arms come up as it surfaces, then drop
  R(b.armL_sh, 0.15 - armSw + riseArms + 0.4 * c.brace + 0.6 * dead, 0, 0.25 + 0.3 * rise);
  R(b.armL_el, -0.35 - 0.2 * Math.max(0, -armSw) - 0.6 * rise, 0, 0.1);
  R(b.armR_sh, swX + armSw * 0.5 + riseArms * 0.8 + 0.8 * dead, swY, swZ - 0.2 * rise);
  R(b.armR_el, elR - 0.5 * rise, 0, -0.1);
  R(b.armR_hand, 0.35, 0, 0);
  // ── legs: a stiff-kneed shamble, knees dropping when it dies ──
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const lsw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    const hip = b[`leg${side}_hip`], knee = b[`leg${side}_knee`], foot = b[`leg${side}_foot`];
    R(hip, -0.55 * lsw * moving - 0.1 * c.brace - 0.1 + 0.15 * kneel - 0.4 * topple, 0, sx * 0.08);
    R(knee, (0.35 + 0.4 * Math.max(0, lsw)) * moving + 0.15 * c.brace + 0.15 + 1.9 * kneel, 0, 0);
    R(foot, -0.15 * lsw * moving - 0.1, 0, 0);
  }
  squashBody(b.body, c.flinch);
}

// ── AI ───────────────────────────────────────────────────────────────────────────────────

const ST_HIDE = 0, ST_RISE = 1, ST_ATTACK = 2, ST_GUARD = 3, ST_SINK = 4;
const SWING_R = 1.8, HIT_R = 1.9, SWING_DAMAGE = 18, WINDUP = 0.6, SWING_DUR = 0.9, SHAMBLE = 1.1, SINK_AFTER = 6;

function thinkSailor(a: Animal, c: ThinkCtx): void {
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
      if (!c.calm && d < SWING_R && m.cd <= 0) { m.st = ST_ATTACK; m.hit = 0; a.startAttack(SWING_DUR); a.setMotion(toPlayer, 0, 6); c.sound('sailor_groan'); break; }
      if (!c.calm && dPlayerHold < guardR && d < 14) {
        m.away = 0;
        if (d > SWING_R * 0.8) { if (dh < guardR || (dx * (cx - a.position.x) + dz * (cz - a.position.z)) > 0) a.setMotion(toPlayer, SHAMBLE, 2.5); else a.setMotion(toPlayer, 0, 2.5); }
        else a.setMotion(toPlayer, 0, 4);
      } else {
        // nobody in the hold: drift back to its spot, glare, and after a while sink out of sight
        m.away += c.dt;
        const hx = m.hx - a.position.x, hz = m.hz - a.position.z, hd = Math.hypot(hx, hz);
        if (hd > 0.6) a.setMotion(Math.atan2(hx, hz), SHAMBLE * 0.8, 2.5);
        else { a.setMotion(d < 30 ? toPlayer : a.desiredYaw, 0, 2); if (m.away > SINK_AFTER) { m.st = ST_SINK; m.sinking = 1; m.rising = 0; c.world.splash?.(a.position, 0.5); } }
      }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack'; a.setMotion(toPlayer, 0, 6);
      const p = a.attackPhase;
      if (p >= WINDUP / SWING_DUR + 0.05 && !m.hit) { m.hit = 1; if (d <= HIT_R) { c.hurt(SWING_DAMAGE); c.sound('sailor_slash'); } }
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

registerSpecies({
  kind: 'sailor',
  label: 'Drowned sailor',
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: SHAMBLE,
  chargeDamage: SWING_DAMAGE,
  corpseFade: 60, // was 2.5 s — gone before you could reach it; now it lies a minute to be looted (harvesting dissolves it at once)
  eyeGlow: [0.2, 1.0, 1.0], eyeGlowIntensity: 1.0,
  sounds: { call: 'sailor_groan', hurt: 'sailor_groan', callEvery: [12, 30] },
  variants: [
    { id: 'sailor', label: 'Drowned sailor', weight: 100, rarity: 'uncommon', scale: [1.0, 1.05], hp: 60 },
  ],
  build: buildSailor,
  animate: animateSailor,
  think: thinkSailor,
});
