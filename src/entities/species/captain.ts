import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx, type ThinkCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, type Paint, type RGB } from './loft';
import type { Animal } from '../Animal';
import { NO_FUR, lookAngles, smooth01, bump, step, clamp } from './rigs';
import { captainMeshFor } from './captainMesh';

/**
 * The Drowned Captain — Driftwood Isle's guardian boss (DRIFTWOOD-REMASTER A6, D5): Captain Brine of the Gull's Lament,
 * who sank with the Ring Shrine's secret. He sleeps under the shrine's spring pool until the three glyph shards are set
 * in the altar, then rises out of the water — a tall bone-white skeleton (1.35× the drowned sailor) in a rotted navy
 * frock coat with tarnished gold trim and epaulettes, a battered tricorn, a beard of kelp, barnacles on the shoulders,
 * glowing cyan eyes and a heavy boarding cutlass. Humanoid custom rig (the sailor's bones). 320 hp.
 *
 * The mesh is the adventure agent's stand-in built with the species `loft` kit; the model agent may replace
 * `buildCaptain` wholesale (the rig contract is the bone list + the animate() below).
 *
 * The fight (`think`), three phases by hp:
 *   I   (100–66 %) — he wades after you (1.2 m/s) and swings: a 0.7 s over-the-head wind-up (a readable telegraph),
 *                    the cut hits 24 inside 2.5 m. 1.4 s between swings.
 *   II  (66–33 %)  — every ~7 s he SINKS (1 s, untouchable: his hit capsule goes under the ground), a ring of bubbles
 *                    marks where he will come up — near you — for 1.1 s, and he BURSTS up there: 16 to anything within
 *                    3 m (step out of the bubbles). Then he fights on.
 *   III (< 33 %)   — enraged: faster (1.7 m/s), shorter wind-ups (0.5 s) and a second cut straight after the first;
 *                    he still sinks and bursts, every ~5 s.
 * He never leaves the arena (`mem.arena` m around the pool, default 22) — outside it he wades back and waits.
 * Before `mem.awake` is set (Adventure.ts sets it when the altar is used) he stays hidden under the pool.
 * `mem.poolX / poolZ` = where he rises (default: where he was spawned).
 */

const PALETTE = {
  bone: [0.84, 0.81, 0.70], boneDark: [0.58, 0.56, 0.47], skull: [0.88, 0.86, 0.76], socket: [0.08, 0.12, 0.12],
  coat: [0.13, 0.17, 0.30], coatDark: [0.08, 0.10, 0.18], trim: [0.78, 0.60, 0.22], shirt: [0.74, 0.72, 0.62],
  breeches: [0.20, 0.15, 0.11], boot: [0.10, 0.08, 0.07], hat: [0.08, 0.08, 0.09], kelp: [0.18, 0.38, 0.14],
  barnacle: [0.70, 0.68, 0.60], steel: [0.66, 0.70, 0.74], steelEdge: [0.88, 0.92, 0.95], guard: [0.62, 0.48, 0.20], grip: [0.26, 0.16, 0.10],
  eye: [0.35, 1.0, 1.0],
} satisfies Record<string, RGB>;

type Side = 'L' | 'R';
type CaptainBones = Record<'body' | 'spine' | 'chest' | 'head' | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, THREE.Bone>;
interface CaptainMem extends Record<string, number> {
  init: number; st: number; cd: number; hitT: number; hit: number; combo: number;
  rise: number; rising: number; sinking: number; subT: number; burstX: number; burstZ: number;
  poolX: number; poolZ: number; arena: number; awake: number; phase: number;
}

function captainPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  return (out, _x, y, _z, _nx, ny, nz, part, t, a) => {
    switch (part) {
      case 'skull': out.copy(P.skull); mix(out, out, P.socket, sstep(0.55, 0.75, t) * sstep(0.2, 0.7, nz) * (1 - sstep(0.4, 0.7, ny)) * 0.9); break;
      case 'bone': mix(out, P.bone, P.boneDark, 0.35 + 0.3 * Math.sin(y * 9 + a)); break;
      case 'coat': {
        out.copy(P.coat);
        mix(out, out, P.coatDark, 0.5 + 0.5 * Math.sin(a * 4 + y * 3));                 // rot and salt streaks
        if (Math.abs(Math.sin(a)) > 0.93) mix(out, out, P.trim, 0.9);                     // the gold-trimmed front edges
        if (y < 0.75 && ((a * 7 + y * 30) % 2) < 0.5) mix(out, out, P.kelp, 0.55);         // torn, weedy tails
        break;
      }
      case 'trim': out.copy(P.trim); break;
      case 'shirt': out.copy(P.shirt); break;
      case 'breeches': out.copy(P.breeches); break;
      case 'boot': out.copy(P.boot); break;
      case 'hat': mix(out, P.hat, P.trim, sstep(0.85, 1.0, t) * 0.8); break;
      case 'kelp': mix(out, P.kelp, P.coatDark, sstep(0.6, 1.0, t) * 0.4); break;
      case 'barnacle': out.copy(P.barnacle); break;
      case 'steel': mix(out, P.steel, P.steelEdge, sstep(0.3, 0.9, Math.abs(ny))); break;
      case 'guard': out.copy(P.guard); break;
      case 'grip': out.copy(P.grip); break;
      case 'eye': out.copy(P.eye); break;
      default: out.copy(P.bone);
    }
  };
}

const CAPTAIN_DIMS: AnimalSpecies['dims'] = { bodyY: 0.95, bodyHalfLen: 0.5, bodyRadius: 0.3, headRadius: 0.16, legLen: 0.85, feet: [[0.12, 0.05], [-0.12, 0.05], [0.12, -0.05], [-0.12, -0.05]], halfWidth: 0.28, capsuleAxis: 'y' };

function buildCaptain(v: VariantDef, rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.95, 0] },
    { name: 'spine', parent: 'body', pos: [0, 1.12, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 1.32, 0] },
    { name: 'head', parent: 'chest', pos: [0, 1.56, 0.02] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.24, 1.47, 0] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.28, 1.21, 0.02] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.30, 0.97, 0.06] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.11, 0.92, 0] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.12, 0.50, 0.01] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.12, 0.07, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = captainPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head');
  // skull with a jutting jaw
  fur.push(loft([
    S(0, 1.63, -0.09, 0.08, 0.08, head), S(0, 1.66, -0.02, 0.105, 0.105, head, head, 0, 1.05, 0.95),
    S(0, 1.65, 0.06, 0.10, 0.10, head, head, 0, 1.05, 0.9), S(0, 1.60, 0.11, 0.075, 0.075, head), S(0, 1.54, 0.10, 0.06, 0.05, head),
  ], 16, 'skull', paint, true, true));
  for (const sx of [1, -1]) eyes.push(skinPlain(new THREE.SphereGeometry(0.027, 8, 6).translate(sx * 0.043, 1.635, 0.115), head, 'eye', paint));
  // v0.2: the generated captain (codex concept → Hunyuan3D-2, src/entities/species/captainMesh.ts) once it has loaded —
  // bound to these same bones, so animateCaptain() drives it unchanged; the glowing eye spheres ride on top. Until the
  // file is in (or if it fails) the loft stand-in below is built instead.
  const generated = captainMeshFor(bones);
  if (generated) return { bones, furParts: [generated.parts[0]], hardParts: [generated.parts[1]], eyeParts: eyes, dims: CAPTAIN_DIMS, ...(generated.map ? { map: generated.map, selfLight: 0.35 } : {}), facetJitter: 0 };
  // the tricorn: a flat brim turned up in three corners + a low crown
  hard.push(loft([S(0, 1.72, -0.01, 0.2, 0.2, head), S(0, 1.75, -0.01, 0.23, 0.23, head), S(0, 1.79, -0.01, 0.13, 0.13, head), S(0, 1.86, -0.01, 0.11, 0.11, head), S(0, 1.88, -0.01, 0.02, 0.02, head)], 3, 'hat', paint, true, true));
  // a beard of kelp hanging off the jaw
  for (let i = 0; i < 5; i++) {
    const bx = (i - 2) * 0.03, len = rng.range(0.16, 0.3);
    hard.push(loft([S(bx, 1.54, 0.1, 0.018, 0.008, head), S(bx * 1.2, 1.54 - len * 0.5, 0.12, 0.016, 0.006, chest, head, 0.5), S(bx * 1.3, 1.54 - len, 0.13, 0.006, 0.003, chest)], 6, 'kelp', paint, false, true, 'z'));
  }
  fur.push(loft([S(0, 1.45, 0.0, 0.04, 0.04, chest), S(0, 1.55, 0.01, 0.035, 0.035, chest, head, 0.7)], 8, 'bone', paint, false, false));
  // the frock coat: shoulders → chest → waist → long tails to the knee (one loft; the paint trims the front edges)
  fur.push(loft([
    S(0, 0.52, -0.01, 0.2, 0.15, body), S(0, 0.78, 0, 0.19, 0.13, body), S(0, 0.95, 0, 0.17, 0.11, body, spine, 0.3),
    S(0, 1.12, 0, 0.19, 0.12, spine), S(0, 1.30, 0, 0.23, 0.14, spine, chest, 0.6), S(0, 1.46, 0, 0.25, 0.14, chest), S(0, 1.52, 0, 0.13, 0.09, chest),
  ], 16, 'coat', paint, true, true));
  hard.push(loft([S(0, 1.26, 0.1, 0.1, 0.05, chest), S(0, 1.42, 0.11, 0.08, 0.04, chest)], 8, 'shirt', paint, true, true));   // the shirt front
  hard.push(loft([S(0, 0.98, 0.0, 0.18, 0.12, body), S(0, 1.02, 0.0, 0.18, 0.12, body)], 16, 'trim', paint, true, true));    // the sword belt
  for (const sx of [1, -1]) {
    hard.push(loft([S(sx * 0.2, 1.5, 0, 0.1, 0.06, chest), S(sx * 0.27, 1.49, 0, 0.09, 0.05, chest), S(sx * 0.31, 1.46, 0, 0.03, 0.03, chest)], 8, 'trim', paint, true, true));   // epaulettes
    for (let i = 0; i < 3; i++) hard.push(skinPlain(new THREE.SphereGeometry(0.022 + rng.range(0, 0.012), 5, 3).translate(sx * (0.14 + rng.range(0, 0.1)), 1.5 + rng.range(-0.02, 0.03), rng.range(-0.08, 0.06)), chest, 'barnacle', paint));
  }
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    fur.push(loft([S(sx * 0.25, 1.47, 0, 0.065, 0.06, sh), S(sx * 0.27, 1.32, 0.01, 0.055, 0.05, sh), S(sx * 0.28, 1.21, 0.02, 0.05, 0.05, sh, el, 0.5), S(sx * 0.29, 1.07, 0.04, 0.06, 0.055, el), S(sx * 0.30, 1.0, 0.05, 0.065, 0.06, el)], 8, 'coat', paint, true, true));   // sleeves + cuffs
    hard.push(loft([S(sx * 0.30, 0.99, 0.06, 0.03, 0.028, hand), S(sx * 0.305, 0.92, 0.07, 0.038, 0.027, hand), S(sx * 0.31, 0.86, 0.08, 0.02, 0.013, hand)], 8, 'bone', paint, false, true));
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    hard.push(loft([S(sx * 0.11, 0.9, 0, 0.07, 0.07, body, hip, 0.5), S(sx * 0.115, 0.68, 0.005, 0.06, 0.06, hip), S(sx * 0.12, 0.52, 0.01, 0.055, 0.055, hip, knee, 0.5)], 8, 'breeches', paint, true, false));
    fur.push(loft([S(sx * 0.12, 0.5, 0.01, 0.06, 0.06, knee), S(sx * 0.12, 0.3, 0.015, 0.055, 0.055, knee), S(sx * 0.12, 0.1, 0.02, 0.05, 0.05, knee, foot, 0.6)], 8, 'boot', paint, true, false));   // tall boots
    hard.push(loft([S(sx * 0.12, 0.06, -0.04, 0.055, 0.04, foot), S(sx * 0.12, 0.045, 0.1, 0.055, 0.035, foot), S(sx * 0.12, 0.035, 0.19, 0.03, 0.02, foot)], 8, 'boot', paint, true, true));
  }
  // the boarding cutlass: brass basket guard, a broad curved blade
  {
    const hand = B('armR_hand'), x = -0.31;
    hard.push(loft([S(x, 0.96, 0.02, 0.022, 0.022, hand), S(x, 0.9, 0.0, 0.024, 0.024, hand), S(x, 0.83, -0.02, 0.028, 0.028, hand)], 8, 'grip', paint, true, true));
    hard.push(loft([S(x, 0.92, 0.02, 0.075, 0.075, hand), S(x, 0.9, 0.09, 0.07, 0.06, hand), S(x, 0.89, 0.12, 0.025, 0.025, hand)], 8, 'guard', paint, true, true));
    hard.push(loft([S(x, 0.9, 0.12, 0.008, 0.04, hand), S(x, 0.9, 0.36, 0.01, 0.05, hand), S(x, 0.91, 0.6, 0.009, 0.058, hand), S(x, 0.93, 0.8, 0.006, 0.05, hand), S(x, 0.97, 0.94, 0.002, 0.014, hand)], 8, 'steel', paint, true, true));
  }
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: CAPTAIN_DIMS,
  };
}

// ── animation (the sailor's rig language, heavier) ────────────────────────────────────────

const R = (b: THREE.Bone, x: number, y: number, z: number) => b.rotation.set(x, y, z);
const L = THREE.MathUtils.lerp;
const RISE_T = 1.1, SINK_T = 0.9, UNDER = -2.8;

function animateCaptain(c: RigAnimCtx): void {
  const b = c.bones as CaptainBones, t = c.t, seed = c.seed, m = c.mem as CaptainMem, a = c.animal, dt = c.dt;
  if (m.rising) { m.rise = Math.min(1, (m.rise || 0) + dt / RISE_T); if (m.rise >= 1) m.rising = 0; }
  if (m.sinking) { m.rise = Math.max(0, (m.rise || 0) - dt / SINK_T); if (m.rise <= 0) m.sinking = 0; }
  const up = m.init ? smooth01(m.rise || 0) : 0;
  a.yOffset = L(UNDER, 0, up);
  const rise = 1 - up;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const moving = clamp(c.speed / 0.9, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const atk = c.attack;
  const look = lookAngles(c, 1.6, 0.9, 0.5);
  const sway = Math.sin(t * 0.7 + seed * 4);
  const rage = (m.phase || 0) >= 3 ? 1 : 0;
  const kneel = step(dead, 0, 0.5), topple = step(dead, 0.45, 1);
  b.body.position.y = c.dims.bodyY - 0.05 - 0.05 * Math.abs(Math.sin(ph)) * moving - 0.1 * c.brace - 0.42 * kneel - 0.25 * topple + 0.02 * sway * (1 - moving);
  let bodyP = 0.16 + 0.12 * moving + 0.1 * rage + 0.15 * c.brace - 0.4 * rise + 1.35 * topple;
  let spineY = 0.06 * sway;
  let headP = -0.1 + 0.2 * c.flinch + 0.25 * kneel + 0.3 * topple;
  let swX = 0.25, swZ = -0.3, elR = -0.45;
  if (atk >= 0) {
    const wind = step(atk, 0, 0.62), cut = step(atk, 0.64, 0.8), rec = step(atk, 0.86, 1);
    swX = L(L(0.25, -2.9, wind), 1.05, cut) * (1 - rec) + 0.25 * rec;
    swZ = L(L(-0.3, -1.0, wind), 0.25, cut) * (1 - rec) - 0.3 * rec;
    elR = L(L(-0.45, -1.0, wind), -0.1, cut) * (1 - rec) - 0.45 * rec;
    bodyP += L(L(0, -0.3, wind), 0.5, cut) * (1 - rec);
    spineY += L(L(0, 0.5, wind), -0.55, cut) * (1 - rec);
    headP += 0.2 * cut * (1 - rec);
  }
  R(b.body, bodyP, 0, 0.03 * sway);
  R(b.spine, 0.08 + 0.05 * c.brace, spineY + look.yaw * 0.3, 0.04 * Math.sin(t * 0.6 + seed));
  R(b.chest, 0.06 - 0.1 * rage, look.yaw * 0.2, 0);
  R(b.head, headP - look.pitch * 0.5 - 0.7 * rise, look.yaw * 0.5, 0.1 * Math.sin(t * 0.5 + seed));
  const armSw = Math.sin(ph) * 0.3 * moving;
  const riseArms = rise > 0.02 ? -2.4 * bump(1 - rise, 0, 0.9) - 0.3 * rise : 0;
  R(b.armL_sh, 0.1 - armSw + riseArms + 0.4 * c.brace + 0.6 * dead - 0.6 * rage * (0.5 + 0.5 * Math.sin(t * 5)), 0, 0.3 + 0.3 * rise);
  R(b.armL_el, -0.4 - 0.2 * Math.max(0, -armSw) - 0.6 * rise, 0, 0.1);
  R(b.armR_sh, swX + armSw * 0.5 + riseArms * 0.8 + 0.8 * dead, 0, swZ - 0.2 * rise);
  R(b.armR_el, elR - 0.5 * rise, 0, -0.1);
  R(b.armR_hand, 0.35, 0, 0);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const lsw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    R(b[`leg${side}_hip`], -0.5 * lsw * moving - 0.1 * c.brace - 0.1 + 0.15 * kneel - 0.4 * topple, 0, sx * 0.07);
    R(b[`leg${side}_knee`], (0.3 + 0.4 * Math.max(0, lsw)) * moving + 0.15 * c.brace + 0.12 + 1.9 * kneel, 0, 0);
    R(b[`leg${side}_foot`], -0.15 * lsw * moving - 0.1, 0, 0);
  }
}

// ── AI ───────────────────────────────────────────────────────────────────────────────────

const ST_HIDE = 0, ST_RISE = 1, ST_FIGHT = 2, ST_ATTACK = 3, ST_SINK = 4, ST_UNDER = 5;
const SWING_R = 2.3, HIT_R = 2.5, SWING_DMG = 24, BURST_R = 3, BURST_DMG = 16;
const WADE = [0, 1.2, 1.35, 1.7], WINDUP = [0, 0.7, 0.62, 0.5], COOLDOWN = [0, 1.4, 1.2, 0.8], SINK_EVERY = [0, 0, 7, 5];
const UNDER_T = 1.1;
const _bub = new THREE.Vector3();

/** the fight phase by hp: 1, 2, 3 */
export function captainPhase(hp: number, maxHp: number): number { const f = hp / Math.max(1, maxHp); return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; }

function thinkCaptain(a: Animal, c: ThinkCtx): void {
  const m = a.mem as CaptainMem;
  if (!m.init) {
    m.init = 1; m.st = ST_HIDE; m.cd = 1; m.hitT = 0; m.hit = 0; m.combo = 0; m.rise = 0; m.rising = 0; m.sinking = 0; m.subT = 0;
    const set = a.mem;   // poolX / poolZ / arena / awake may have been set by the spawner before the first tick
    m.poolX = set['poolX'] ?? a.position.x; m.poolZ = set['poolZ'] ?? a.position.z; m.arena = set['arena'] ?? 22; m.awake = set['awake'] ?? 0; m.phase = 1;
    a.state = 'hide'; a.yOffset = UNDER;
  }
  const phase = captainPhase(a.hp, a.maxHp); m.phase = phase;
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz);
  const toPlayer = Math.atan2(dx, dz);
  const playerFromPool = Math.hypot(c.player.x - m.poolX, c.player.z - m.poolZ);
  a.lookTarget.copy(c.player); a.lookWeight = m.st === ST_HIDE || m.st === ST_UNDER ? 0 : 1;
  const hit = a.lastHitT > m.hitT; if (hit) m.hitT = a.lastHitT;
  m.cd = Math.max(0, m.cd - c.dt);
  m.subT += c.dt;
  switch (m.st) {
    case ST_HIDE:
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2); a.setStrafe(0);
      if (m.awake) { m.st = ST_RISE; m.rising = 1; m.sinking = 0; c.sound('sailor_groan'); c.world.splash?.(a.position, 2); }
      break;
    case ST_RISE:
      a.state = 'rise'; a.setMotion(toPlayer, 0, 2);
      if (!m.rising) { m.st = ST_FIGHT; m.subT = 0; m.cd = 0.6; }
      break;
    case ST_FIGHT: {
      a.state = 'stalk';
      if (hit && phase === 1) a.cancelAttack();
      if (SINK_EVERY[phase] && m.subT > (SINK_EVERY[phase] ?? 99) && m.cd <= 0) { m.st = ST_SINK; m.sinking = 1; m.rising = 0; c.world.splash?.(a.position, 1.4); c.sound('sailor_groan'); break; }
      if (!c.calm && d < SWING_R && m.cd <= 0) { m.st = ST_ATTACK; m.hit = 0; a.startAttack((WINDUP[phase] ?? 0.7) + 0.35); a.setMotion(toPlayer, 0, 6); c.sound('sailor_groan'); break; }
      if (!c.calm && playerFromPool < m.arena) a.setMotion(toPlayer, d > SWING_R * 0.85 ? WADE[phase] ?? 1.2 : 0, 3);
      else {   // you ran: he wades back to the pool and glares
        const hx = m.poolX - a.position.x, hz = m.poolZ - a.position.z;
        if (Math.hypot(hx, hz) > 1) a.setMotion(Math.atan2(hx, hz), (WADE[phase] ?? 1.2) * 0.8, 2.5); else a.setMotion(toPlayer, 0, 2);
      }
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack'; a.setMotion(toPlayer, 0, 5);
      const p = a.attackPhase, dur = (WINDUP[phase] ?? 0.7) + 0.35;
      if (p >= (WINDUP[phase] ?? 0.7) / dur + 0.04 && !m.hit) { m.hit = 1; if (d <= HIT_R) { c.hurt(SWING_DMG); c.sound('sailor_slash'); } }
      if (p >= 1 || p < 0) {
        a.cancelAttack();
        if (phase === 3 && !m.combo) { m.combo = 1; m.st = ST_ATTACK; m.hit = 0; a.startAttack(0.55); break; }   // the second cut, straight after
        m.combo = 0; m.st = ST_FIGHT; m.cd = COOLDOWN[phase] ?? 1.4;
      }
      break;
    }
    case ST_SINK:
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2);
      if (!m.sinking) {
        // pick where he comes up: a couple of metres from you, inside the arena; bubbles mark it
        const ang = c.rng.range(0, Math.PI * 2), r = c.rng.range(1.2, 2.2);
        let bx = c.player.x + Math.cos(ang) * r, bz = c.player.z + Math.sin(ang) * r;
        const fx = bx - m.poolX, fz = bz - m.poolZ, fd = Math.hypot(fx, fz);
        if (fd > m.arena - 2) { bx = m.poolX + (fx / fd) * (m.arena - 2); bz = m.poolZ + (fz / fd) * (m.arena - 2); }
        m.burstX = bx; m.burstZ = bz; m.st = ST_UNDER; m.subT = 0;
      }
      break;
    case ST_UNDER: {
      a.state = 'hide'; a.setMotion(a.yaw, 0, 2);
      // the telegraph: bubbles where he will burst
      if (c.rng.next() < 0.85) { _bub.set(m.burstX + c.rng.range(-1, 1), c.heightAt(m.burstX, m.burstZ), m.burstZ + c.rng.range(-1, 1)); c.world.splash?.(_bub, 0.3); }
      if (m.subT > UNDER_T) {
        a.place(m.burstX, m.burstZ, toPlayer);
        m.st = ST_RISE; m.rising = 1; m.subT = 0;
        c.world.splash?.(a.position, 2.2); c.sound('sailor_slash');
        const bd = Math.hypot(c.player.x - m.burstX, c.player.z - m.burstZ);
        if (bd < BURST_R) c.hurt(BURST_DMG);
      }
      break;
    }
    default: break;
  }
}

registerSpecies({
  kind: 'captain',
  label: 'The Drowned Captain',
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: 1.2,
  chargeDamage: SWING_DMG,
  corpseFade: 90,
  eyeGlow: [0.2, 1.0, 1.0], eyeGlowIntensity: 1.4,
  sounds: { call: 'sailor_groan', hurt: 'sailor_groan', callEvery: [8, 20] },
  variants: [
    { id: 'captain', label: 'The Drowned Captain', weight: 100, rarity: 'uncommon', scale: [1.35, 1.35], hp: 320 },
  ],
  build: buildCaptain,
  animate: animateCaptain,
  think: thinkCaptain,
});
