/**
 * Driftwood Isle's lofted creature bodies (the reef crab, the coconut monkey and the Drowned Sailor), built offline: the
 * builders the page ran (`SpeciesLook.build`) moved here unchanged, run once per (kind, variant) with the factory's own
 * seed (`Rng(hashSeed('kind:variant'))`) and the island's low-poly loft resolution, each material group (fur, hard, eyes)
 * merged and written by ./bake-driftwood-creatures.mjs to one hash-named file the page reads back
 * (species/bodies.ts). The page still facets, tints and skins them exactly as before.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { loft, skinPlain, S, boneIndex, mix, paletteColors, setLowPoly, type Paint, type RGB } from '@wildshard/engine/entities/species/loft';
import type { AnimalSpecies, BoneDef, VariantDef } from '@wildshard/engine/entities/species/registry';

// three returns null for incompatible attributes (its types say otherwise), as the engine's mergeAnimalGeometry reads it
const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null => mergeGeometries(parts, false);

/** A Hunyuan head as the page read it (npc/faceHeads.ts `toHead`): non-indexed triangles, AO folded into the colour. */
export interface FaceHead { readonly pos: Float32Array; readonly nrm: Float32Array; readonly col: Float32Array; readonly count: number }

// ── reef crab ────────────────────────────────────────────────────────────────────────────
const CRAB_PALETTE = {
  shell: [0.86, 0.34, 0.15], shellDark: [0.62, 0.20, 0.09], belly: [0.94, 0.83, 0.66],
  leg: [0.84, 0.40, 0.19], legTip: [0.42, 0.16, 0.07], claw: [0.90, 0.38, 0.17], clawTip: [0.96, 0.87, 0.74],
  stalk: [0.66, 0.28, 0.13], eye: [0.03, 0.02, 0.02], barnacle: [0.88, 0.87, 0.82],
} satisfies Record<string, RGB>;

type LegIdx = 0 | 1 | 2;
/** the rig's bones by name — exactly the BoneDef list buildCrab() emits (so the factory's bone map holds every key) */


function crabPaint(v: VariantDef): Paint {
  const P = paletteColors(CRAB_PALETTE, v.tint);
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


// ── coconut monkey ───────────────────────────────────────────────────────────────────────
const MONKEY_PALETTE = {
  fur: [0.78, 0.60, 0.36], back: [0.55, 0.40, 0.23], belly: [0.90, 0.80, 0.60],
  face: [0.20, 0.13, 0.09], muzzle: [0.84, 0.70, 0.56], hand: [0.24, 0.16, 0.11], earIn: [0.72, 0.48, 0.42], eye: [0.03, 0.02, 0.02],
} satisfies Record<string, RGB>;

/** the rig's bones by name — exactly the BoneDef list buildMonkey() emits (so the factory's bone map holds every key) */

/** `Animal.mem` as the monkey uses it (numbers only, the registry contract). The first `think` tick writes the first row;
 *  the rest are set as it perches / drops / climbs / bites, and `animate` (which can run first) guards them (`|| 0`, truthiness). */

function monkeyPaint(v: VariantDef): Paint {
  const P = paletteColors(MONKEY_PALETTE, v.tint);
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


// ── Drowned Sailor ───────────────────────────────────────────────────────────────────────
const SAILOR_PALETTE = {
  bone: [0.86, 0.83, 0.72], boneDark: [0.62, 0.60, 0.50], skull: [0.90, 0.88, 0.78], socket: [0.12, 0.16, 0.16],
  shirt: [0.88, 0.86, 0.78], stripe: [0.30, 0.36, 0.46], shorts: [0.24, 0.16, 0.11], bandana: [0.58, 0.13, 0.12],
  weed: [0.20, 0.40, 0.14], steel: [0.72, 0.76, 0.80], steelEdge: [0.90, 0.93, 0.96], guard: [0.22, 0.20, 0.18], grip: [0.32, 0.20, 0.12],
  eye: [0.35, 1.0, 1.0],
} satisfies Record<string, RGB>;

/** the rig's bones by name — exactly the BoneDef list buildSailor() emits (so the factory's bone map holds every key) */

/** `Animal.mem` as the sailor uses it (numbers only, the registry contract; Enemies.ts reads `rise` / `rising` for the droplets).
 *  The first `think` tick writes every key but `floorS`, which `animate` (it can run first) seeds itself. */
function sailorPaint(v: VariantDef): Paint {
  const P = paletteColors(SAILOR_PALETTE, v.tint);
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

/**
 * E343 (Jake's pick D): the Drowned Sailor's head (public/assets/models/driftwood-hero/faces/sailor-head.glb: a Hunyuan3D-2
 * skull + bandana from a codex portrait in the island's toon look, art/driftwood-isle/round-14-faces/, its own paint, cut at
 * its neck by scripts/img2mesh/head_cut.py, the faceted post) on the head bone, fitted to the lofted skull's span (its neck
 * at 1.53 m, the bandana's top at 1.80 m). The bake requires it (no lofted stand-in). `eyes` gets the painted sockets'
 * centres (its cyan facets, per side) for the glow spheres.
 */
const SAILOR_NECK_FROM_TOP = 0.8159;
function sailorHead(fh: FaceHead, bone: number, eyes: THREE.Vector3[]): THREE.BufferGeometry {
  const pos = Float32Array.from(fh.pos);
  let top = -Infinity, bot = Infinity;
  for (let i = 1; i < pos.length; i += 3) { top = Math.max(top, pos[i] ?? 0); bot = Math.min(bot, pos[i] ?? 0); }
  const neck = top - SAILOR_NECK_FROM_TOP * (top - bot);
  const k = (1.80 - 1.53) / Math.max(1e-6, top - neck);
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < fh.count; i++) if ((pos[i * 3 + 1] ?? 0) > neck) { cx += pos[i * 3] ?? 0; cz += pos[i * 3 + 2] ?? 0; n++; }
  cx /= Math.max(1, n); cz /= Math.max(1, n);
  for (let i = 0; i < fh.count; i++) {
    pos[i * 3] = ((pos[i * 3] ?? 0) - cx) * k; pos[i * 3 + 1] = 1.53 + ((pos[i * 3 + 1] ?? 0) - neck) * k; pos[i * 3 + 2] = ((pos[i * 3 + 2] ?? 0) - cz) * k + 0.02;
  }
  // the glows: the cyan (painted-eye) facets' centres on each side, a little out of the socket
  const side = [new THREE.Vector3(), new THREE.Vector3()], sn = [0, 0];
  for (let i = 0; i < fh.count; i++) {
    const r = fh.col[i * 3] ?? 0, gr = fh.col[i * 3 + 1] ?? 0, b = fh.col[i * 3 + 2] ?? 0;
    if (Math.min(gr, b) - r < 0.25 || (pos[i * 3 + 2] ?? 0) < 0.03) continue;
    const k2 = (pos[i * 3] ?? 0) >= 0 ? 0 : 1;
    side[k2]?.add(new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])); sn[k2] = (sn[k2] ?? 0) + 1;
  }
  for (const k2 of [0, 1]) { const n2 = sn[k2] ?? 0, v2 = side[k2]; if (n2 > 2 && v2) eyes[k2] = v2.divideScalar(n2).add(new THREE.Vector3(0, 0, 0.004)); }
  const g = new THREE.BufferGeometry(), cnt = fh.count;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(fh.nrm), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
  g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(fh.col), 3));
  const si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
  for (let i = 0; i < cnt; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('furLen', new THREE.BufferAttribute(new Float32Array(cnt), 1));
  g.setIndex(Array.from({ length: cnt }, (_, i) => i));   // the lofts are indexed: mergeGeometries wants them all so
  return g;
}

function buildSailor(v: VariantDef, rng: Rng, dHead: FaceHead): AnimalSpecies {
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
  // E343 (Jake's pick D): the generated skull + bandana
  const dEyes: THREE.Vector3[] = [];
  hard.push(sailorHead(dHead, head, dEyes));
  for (const [i, sx] of [1, -1].entries()) {
    // the glows sit in the sockets: the generated head's painted cyan eyes, else the lofted skull's
    const at = dEyes[i] ?? new THREE.Vector3(sx * 0.04, 1.63, 0.11);
    const eye = new THREE.SphereGeometry(dEyes[i] ? 0.019 : 0.024, 8, 6);
    eye.translate(at.x, at.y, at.z);
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


// ── the bake ─────────────────────────────────────────────────────────────────────────────

/** AnimalFactory's model seed for 'kind:variant' (FNV-1a). */
function hashSeed(key: string): number { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.codePointAt(i) ?? 0; h = Math.imul(h, 16777619); } return h >>> 0; }

/** A variant as the builders read it: its id, the look's palette tint and geometry traits (the rest never reaches a build). */
const variantOf = (id: string, look: Pick<VariantDef, 'tint' | 'traits'> = {}): VariantDef => ({ id, label: id, weight: 1, rarity: 'common', scale: [1, 1], ...look });

/** Every lofted body the page built: (kind, variant) with the look's variant knobs. */
const BODIES: readonly { readonly kind: string; readonly variant: VariantDef; readonly build: (v: VariantDef, rng: Rng, head: FaceHead) => AnimalSpecies }[] = [
  { kind: 'crab', variant: variantOf('small'), build: buildCrab },
  { kind: 'crab', variant: variantOf('big', { traits: { clawScale: 1.25 } }), build: buildCrab },
  { kind: 'monkey', variant: variantOf('monkey'), build: buildMonkey },
  { kind: 'monkey', variant: variantOf('elder', { tint: { fur: [0.62, 0.58, 0.50], back: [0.40, 0.37, 0.32], belly: [0.85, 0.82, 0.74] } }), build: buildMonkey },
  { kind: 'sailor', variant: variantOf('sailor'), build: buildSailor },
];

/** One baked body: its skeleton and size, and each material group's parts merged into one geometry (null: none), less the
 *  normals the page's faceting recomputes. */
export interface BakedCreatureBody {
  readonly kind: string; readonly variant: string; readonly bones: readonly BoneDef[]; readonly dims: AnimalSpecies['dims'];
  readonly fur: THREE.BufferGeometry | null; readonly hard: THREE.BufferGeometry | null; readonly eye: THREE.BufferGeometry | null;
}

const merged = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry | null => {
  if (parts.length === 0) return null;
  const g = merge(parts);
  if (g === null) throw new Error('Driftwood creature parts have incompatible attributes');
  for (const part of parts) part.dispose();
  // the page's facetGeometry recomputes every normal flat after de-indexing, so the lofted normals never reach a draw
  g.deleteAttribute('normal');
  return g;
};

/** Every lofted body's un-merged parts, as the island's low-poly factory built them on the page (`AnimalFactory.model`). */
export function buildCreatureParts(head: FaceHead): { readonly kind: string; readonly variant: string; readonly sp: AnimalSpecies }[] {
  setLowPoly(true);
  try {
    return BODIES.map(({ kind, variant: v, build }) => ({ kind, variant: v.id, sp: build(v, new Rng(hashSeed(`${kind}:${v.id}`)), head) }));
  } finally { setLowPoly(false); }
}

/** Every Driftwood lofted body, each material group merged, ready to write. */
export function bakeCreatureBodies(head: FaceHead): BakedCreatureBody[] {
  return buildCreatureParts(head).map(({ kind, variant, sp }) => {
    if (sp.facetJitter !== undefined || sp.map !== undefined) throw new Error(`Driftwood ${kind} body carries data the bake does not keep`);
    return { kind, variant, bones: sp.bones, dims: sp.dims, fur: merged(sp.furParts), hard: merged(sp.hardParts), eye: merged(sp.eyeParts) };
  });
}

/** npc/faceHeads.ts `toHead`: a loaded head mesh as non-indexed triangles with flat normals and AO folded into its colour. */
export function faceHeadOf(g0: THREE.BufferGeometry): FaceHead {
  const g = g0.index !== null ? g0.toNonIndexed() : g0;
  g.computeVertexNormals();
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), c = g.hasAttribute('color') ? g.getAttribute('color') : null;
  const count = p.count;
  const pos = new Float32Array(count * 3), nrm = new Float32Array(count * 3), col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = p.getX(i); pos[i * 3 + 1] = p.getY(i); pos[i * 3 + 2] = p.getZ(i);
    nrm[i * 3] = n.getX(i); nrm[i * 3 + 1] = n.getY(i); nrm[i * 3 + 2] = n.getZ(i);
    if (c === null) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 1; continue; }
    const ao = c.itemSize === 4 ? 0.4 + 0.6 * c.getW(i) : 1;
    col[i * 3] = c.getX(i) * ao; col[i * 3 + 1] = c.getY(i) * ao; col[i * 3 + 2] = c.getZ(i) * ao;
  }
  return { pos, nrm, col, count };
}
