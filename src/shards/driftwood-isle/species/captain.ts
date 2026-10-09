import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import type { Rng } from '@wildshard/engine/core/rng';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { loft, skinPlain, S, boneIndex, mix, paletteColors, type Paint, type RGB } from '@wildshard/engine/entities/species/loft';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies, BoneDef, VariantDef, RigAnimCtx, ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR, lookAngles, smooth01, bump, step, clamp } from '@wildshard/engine/entities/species/rigs';
import * as THREE from 'three';
import { captainMesh, type CaptainMesh } from './captainMesh';
import { CaptainBrain, SWING_DMG, UNDER, type CaptainMem } from './captainPolicy';

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

function buildCaptain(v: VariantDef, rng: Rng, mesh: CaptainMesh = captainMesh): AnimalSpecies {
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
  // the generated captain (captainMesh.ts) hangs his arms lower and wider than the loft stand-in, and stands wider: fit the
  // limb joints to the mesh (measured band by band, E70 round 3) so the elbows and shoulders pivot where his arms bend
  if (mesh.loaded()) {
    const fit: Record<string, [number, number, number]> = {
      _sh: [0.26, 1.42, 0], _el: [0.40, 1.12, 0.02], _hand: [0.47, 0.84, 0.05], _hip: [0.12, 0.90, 0], _knee: [0.16, 0.48, 0.01], _foot: [0.17, 0.08, 0.02],
    };
    for (const b of bones) {
      const side = b.name.includes('L_') ? 1 : b.name.includes('R_') ? -1 : 0;
      const key = Object.keys(fit).find((k) => b.name.endsWith(k));
      const f = key === undefined ? undefined : fit[key];
      if (side !== 0 && f) b.pos = [side * f[0], f[1], f[2]];
    }
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
  // (the generated head's painted cyan eyes sit at x 0.022 ± 0.034, y 1.70, z 0.084 of its 1.9 m frame — measured off the
  // file's texture, E343; the loft stand-in's at ± 0.043, 1.635, 0.115)
  const gen = mesh.loaded();
  for (const sx of [1, -1]) eyes.push(skinPlain(gen ? new THREE.SphereGeometry(0.02, 8, 6).translate(0.022 + sx * 0.034, 1.70, 0.092) : new THREE.SphereGeometry(0.027, 8, 6).translate(sx * 0.043, 1.635, 0.115), head, 'eye', paint));
  // v0.2: the generated captain (codex concept → Hunyuan3D-2, src/engine/entities/species/captainMesh.ts) once it has loaded —
  // bound to these same bones, so animateCaptain() drives it unchanged; the glowing eye spheres ride on top. The play
  // installer awaits the file; a failed load uses the loft stand-in below. A pending build throws instead of caching it.
  const generated = mesh.meshFor(bones);
  if (generated) return { bones, furParts: [generated.parts[0]], hardParts: [generated.parts[1]], eyeParts: eyes, dims: CAPTAIN_DIMS, ...(generated.map ? { map: generated.map, selfLight: 0.5 } : {}), facetJitter: 0 };
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
const RISE_T = 1.1, SINK_T = 0.9;

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

export const CAPTAIN: SpeciesRow = {
  lockable: true,
  id: 'creature.captain',
  kind: 'captain',
  label: 'The Drowned Captain',
  aggressive: true,
  walkSpeed: 1.2,
  chargeDamage: SWING_DMG,
  corpseFade: 90,
  sounds: { call: 'sailor_groan', hurt: 'sailor_groan', callEvery: [8, 20] },
  variants: [
    { id: 'captain', label: 'The Drowned Captain', weight: 100, rarity: 'uncommon', scale: [1.35, 1.35], hp: 320 },
  ],
  // The authored fight keeps its 10 Hz decision windows; contact is applied by the body step.
  act: actCaptain,
  think: thinkCaptain,
};

/** the captain's look over a mesh (the page's by default; a test passes its own) */
export function captainLook(mesh: CaptainMesh = captainMesh): SpeciesLook { return {
  rigContract: { skeleton: 'captain.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.captain', species: CAPTAIN.id, kind: 'captain',
  standMem: { init: 1, rise: 1 }, // it waits sunk in its pool until woken: the Explorer shows it risen
  fur: NO_FUR,
  rig: 'custom',
  eyeGlow: [0.2, 1.0, 1.0], eyeGlowIntensity: 1.4,
  build: (v, rng) => buildCaptain(v, rng, mesh),
  animate: animateCaptain,
}; }
export const CAPTAIN_LOOK: SpeciesLook = captainLook();

const brains = new WeakMap<Animal, CaptainBrain<Animal>>();
function brain(a: Animal): CaptainBrain<Animal> {
  let value = brains.get(a);
  if (value === undefined) { value = new CaptainBrain(a); brains.set(a, value); }
  return value;
}
function thinkCaptain(a: Animal, ctx: ThinkCtx): void { brain(a).think(ctx); }
function actCaptain(a: Animal, ctx: ThinkCtx): void { brain(a).act(ctx); }
