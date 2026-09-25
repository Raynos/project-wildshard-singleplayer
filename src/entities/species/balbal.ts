import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx, type ThinkCtx } from './registry';
import { loft, tube, skinPlain, S, boneIndex, mix, sstep, paletteColors, paintNoise, setShapeFn, type Paint, type RGB } from './loft';
import type { Animal } from '../Animal';
import { NO_FUR, lookAngles, smooth01, step, clamp } from './rigs';
import { heightAt } from '../../world/Heightfield';
import { stateSlot } from '../../core/shardState';

/**
 * Balbal — THE stone warrior (NALATI.md B11; elites-and-bosses.md E4: "they wake at dusk, 2.5 m, 220 hp, amber cracks
 * that the sabre and the spear break"; mockups art/nalati-grasslands/round-1/3-enemies/enemy-2-balbal-warriors.jpg,
 * round-2/1-combat/combat-D-mounted-sabre.png). One species for every walking balbal in the shard:
 *
 *   · the dusk warriors of the Balbal Circle and the kurgan crowns (src/nalati/balbalWarriors.ts wakes them: the statue
 *     tears out of the ground on its plinth's spot, fights, and walks back and sinks at dawn) — `mem.field = 1`;
 *   · the Golden King's phase-II adds (src/nalati/kurganBoss.ts) — they step out of a wall niche onto the chamber floor:
 *     the spawner sets `mem.floorY`, `mem.emergeT` and the chamber bounds `mem.minX / maxX / minZ / maxZ` (the fields
 *     B13's minimal `kurgan-balbal` read; `KURGAN_BALBAL` in kurganBalbal.ts now names THIS species).
 *
 * The look is the POI statue's (src/world/nalati/Balbals.ts: a squat granite stele, a heavy head, brow ridge, drooping
 * moustache, a headband or a pointed cap, the goblet held to the chest, the belt with its pendants, lichen on the tops),
 * with the arms carved free and a stone sabre in the right hand. Amber light burns in the cracks: a second, skinned
 * mesh on the same skeleton (attached on the first animated frame, one MeshBasic program for every balbal) whose
 * brightness this file drives — it smoulders, swells through the slam's wind-up (the telegraph) and flares on the blow.
 *
 * Behaviour (`think`, 10 Hz):
 *   field — RISE (the controller emits the soil; 3.4 s) → GUARD at the plinth, facing out → STALK the player inside
 *           28 m (leash 48 m from home) → the SLAM: a 1.5 s wind-up, sabre over the head (the cracks swell, the
 *           controller paints the wedge it will hit), the blow (30 within 3.1 m, ±55°), 1.2 s with the blade in the turf
 *           (it takes +25 % then) → RETURN home → at dawn (`mem.dawn = 1`) home, then SINK back into the plinth (`mem.gone`).
 *   kurgan — EMERGE forward out of the niche for `emergeT` s, then STALK / SLAM inside the bounds (18 a blow).
 * Damage (`damageMul`): from range (an arrow, a javelin) it chips — ×0.5; the sabre breaks it — ×1.5; the spear ×1, but a
 * thrust into an amber crack (`BALBAL_WEAK`) ×2.5. Which blade is in hand comes from `balbalCombat.melee` (the Nalati
 * wiring sets it from the kit every frame; unknown = the sabre's ×1.5). The Golden Bow's ×2 / ×3 composes on top.
 * Dies crumbling to its knees and sinks; `mem.deadT` counts (the spawners hide it once it is under).
 */

export const BALBAL = 'balbal';

/** what the Nalati wiring tells the damage model every frame: the melee weapon in hand */
export const balbalCombat: { melee: 'sabre' | 'spear' | 'other' } = { melee: 'other' };

const PALETTE = {
  stone: [0.6, 0.58, 0.53], stoneWarm: [0.65, 0.6, 0.53], stoneDark: [0.36, 0.35, 0.33], carve: [0.3, 0.29, 0.27],
  lichenGold: [0.72, 0.64, 0.4], lichenGreen: [0.6, 0.63, 0.49], soil: [0.3, 0.22, 0.15], crack: [0.2, 0.12, 0.06],
} satisfies Record<string, RGB>;

/** the amber of the cracks (linear, × the glow) */
const AMBER = new THREE.Color(1.0, 0.46, 0.1);
/** the weak points: the crack clusters' hearts (model space, before the animal's scale) — the spear's ×2.5 */
export const BALBAL_WEAK: readonly THREE.Vector3[] = [new THREE.Vector3(0.04, 1.26, 0.2), new THREE.Vector3(-0.05, 1.18, -0.2), new THREE.Vector3(-0.28, 1.36, 0.02)];
const WEAK_R = 0.24;

type Side = 'L' | 'R';
type BalbalBones = Record<'body' | 'spine' | 'chest' | 'head' | `arm${Side}_${'sh' | 'el' | 'hand'}` | `leg${Side}_${'hip' | 'knee' | 'foot'}`, THREE.Bone>;
interface BalbalMem extends Record<string, number | undefined> {
  init?: number; st?: number; t?: number; cd?: number; hit?: number;
  // field (the dusk warriors): home plinth, the rise (0 under the ground … 1 standing), dawn / gone flags, the last slam
  field?: number; homeX?: number; homeZ?: number; homeYaw?: number; rise?: number; dawn?: number; gone?: number; slamT?: number; open?: number;
  // kurgan (the King's adds): the chamber floor, the niche step, the bounds
  floorY?: number; emergeT?: number; minX?: number; maxX?: number; minZ?: number; maxZ?: number; emerge?: number;
  deadT?: number; glow?: number; windup?: number; dmg?: number;
}

const _player = new THREE.Vector3(), _lp = new THREE.Vector3();

// ───────────────────────────── the model ─────────────────────────────

function balbalPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  const base = v.traits?.['cap'] === true ? P.stoneWarm : P.stone;
  return (out, x, y, z, _nx, ny, _nz, part) => {
    if (part === 'crack') { out.copy(P.crack); return; }
    // weathered granite: a brush of light and dark, carved grooves darker, lichen gold on the tops / green in the shade
    const n = paintNoise.fbm(x * 6 + y * 2, z * 6 - y * 3, 3);
    mix(out, base, P.stoneDark, 0.18 + 0.3 * n);
    if (part === 'carve') mix(out, out, P.carve, 0.65);
    if (part === 'blade') mix(out, out, P.stoneDark, 0.25);
    const l = paintNoise.get(x * 4.1 + y * 1.7, z * 4.3 - y * 2.3) * 0.6 + paintNoise.get(x * 11 + y * 5, z * 11) * 0.4;
    if (l > 0.3) mix(out, out, ny > 0.2 || y > 1.5 ? P.lichenGold : P.lichenGreen, Math.min(0.55, (l - 0.3) * 2.2));
    if (ny < -0.4) out.multiplyScalar(0.8);
    // soil still clinging to the feet and shins (it came out of the ground)
    if (y < 0.5) mix(out, out, P.soil, sstep(0.5, 0.12, y) * (0.55 + 0.35 * paintNoise.get(x * 13, z * 13 + y * 9)));
  };
}

function buildBalbal(v: VariantDef, _rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.9, 0] },
    { name: 'spine', parent: 'body', pos: [0, 1.08, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 1.32, 0] },
    { name: 'head', parent: 'chest', pos: [0, 1.6, 0.01] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.34, 1.46, 0] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.37, 1.17, 0.04] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.36, 0.94, 0.1] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.15, 0.84, 0] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.16, 0.46, 0.01] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.16, 0.08, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = balbalPaint(v);
  const cap = v.traits?.['cap'] === true;
  const parts: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head');
  // chipped, weathered stone: the silhouette pushed in and out a centimetre or two
  setShapeFn((x, y, z, part) => (part === 'blade' ? 0 : (paintNoise.get(x * 9 + y * 4, z * 9 - y * 3) * 0.6 + paintNoise.get(x * 23, y * 23 + z * 7) * 0.4) * 0.012));
  // the stele: broad, flattened, a little tapered — the statue's body
  parts.push(loft([
    S(0, 0.74, 0, 0.33, 0.24, body), S(0, 0.92, 0, 0.35, 0.25, body, spine, 0.3), S(0, 1.12, 0, 0.36, 0.26, spine),
    S(0, 1.32, 0, 0.37, 0.26, spine, chest, 0.8), S(0, 1.46, 0, 0.36, 0.25, chest), S(0, 1.56, 0, 0.26, 0.19, chest), S(0, 1.62, 0, 0.19, 0.16, chest, head, 0.3),
  ], 18, 'stone', paint, true, true));
  // the belt (carved band) and three pendants on the front
  parts.push(loft([S(0, 0.86, 0, 0.36, 0.265, body), S(0, 0.93, 0, 0.365, 0.27, body)], 18, 'carve', paint, false, false));
  for (const bx of [-0.2, 0, 0.18]) parts.push(skinPlain(new THREE.BoxGeometry(0.055, 0.13, 0.03).translate(bx, 0.76, 0.26), body, 'stone', paint));
  // the goblet held to the chest (left hand carries it)
  parts.push(skinPlain(new THREE.CylinderGeometry(0.08, 0.045, 0.14, 12).translate(0.04, 1.3, 0.3), chest, 'stone', paint));
  parts.push(skinPlain(new THREE.TorusGeometry(0.078, 0.012, 5, 14).rotateX(Math.PI / 2).translate(0.04, 1.37, 0.3), chest, 'carve', paint));
  // the head: big and heavy, a flattened face, the brow ridge, deep eyes, a long wedge nose, the moustache curling down
  const hy = 1.84;
  parts.push(loft([S(0, 1.6, 0.0, 0.14, 0.13, chest, head, 0.6), S(0, 1.66, 0.0, 0.24, 0.22, head), S(0, 1.8, 0.0, 0.27, 0.25, head), S(0, 1.96, -0.01, 0.23, 0.22, head), S(0, 2.06, -0.02, 0.12, 0.12, head)], 18, 'stone', paint, true, true));
  parts.push(skinPlain(new THREE.CapsuleGeometry(0.036, 0.3, 3, 8).rotateZ(Math.PI / 2).translate(0, hy + 0.07, 0.235), head, 'stone', paint));   // brow
  for (const sx of [1, -1]) {
    parts.push(skinPlain(new THREE.SphereGeometry(0.05, 10, 8).scale(1.3, 0.7, 0.5).translate(sx * 0.09, hy + 0.01, 0.23), head, 'carve', paint)); // sockets
    eyes.push(skinPlain(new THREE.SphereGeometry(0.03, 10, 6).scale(1.5, 0.55, 0.5).translate(sx * 0.09, hy + 0.01, 0.245), head, 'stone', paint)); // almond eyes (the factory merges an eye group)
    // the moustache: thick, drooping past the mouth, the ends curling out
    parts.push(tube([[sx * 0.015, hy - 0.09, 0.27], [sx * 0.08, hy - 0.11, 0.26], [sx * 0.125, hy - 0.17, 0.24], [sx * 0.145, hy - 0.22, 0.22]], 0.027, 0.012, head, 'stone', paint, 8));
    parts.push(skinPlain(new THREE.SphereGeometry(0.055, 8, 6).scale(0.45, 1.1, 0.8).translate(sx * 0.27, hy, -0.02), head, 'stone', paint)); // ears
  }
  { const g = new THREE.CylinderGeometry(0.024, 0.055, 0.18, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9); parts.push(skinPlain(g.translate(0, hy - 0.02, 0.26), head, 'stone', paint)); } // nose
  parts.push(skinPlain(new THREE.BoxGeometry(0.1, 0.016, 0.02).translate(0, hy - 0.14, 0.25), head, 'carve', paint)); // mouth
  if (cap) {
    parts.push(skinPlain(new THREE.ConeGeometry(0.3, 0.34, 18, 2).scale(1, 1, 0.92).translate(0, hy + 0.38, 0.0), head, 'stone', paint));
    parts.push(skinPlain(new THREE.TorusGeometry(0.275, 0.03, 5, 20).rotateX(Math.PI / 2).scale(1, 1, 0.92).translate(0, hy + 0.21, 0), head, 'carve', paint));
    parts.push(skinPlain(new THREE.ConeGeometry(0.065, 0.16, 6).rotateX(Math.PI).translate(0, hy - 0.28, 0.21), head, 'stone', paint)); // short beard
  } else {
    parts.push(skinPlain(new THREE.TorusGeometry(0.265, 0.028, 5, 22).rotateX(Math.PI / 2 - 0.12).scale(1, 1, 0.92).translate(0, hy + 0.15, 0.0), head, 'carve', paint)); // headband
  }
  // the arms, carved free of the stele: heavy, short, the forearms thick
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    parts.push(loft([S(sx * 0.33, 1.5, 0, 0.12, 0.12, chest, sh, 0.6), S(sx * 0.36, 1.32, 0.01, 0.1, 0.095, sh), S(sx * 0.37, 1.17, 0.04, 0.095, 0.09, sh, el, 0.5), S(sx * 0.37, 1.04, 0.07, 0.09, 0.085, el), S(sx * 0.36, 0.94, 0.1, 0.085, 0.08, el, hand, 0.6)], 12, 'stone', paint, true, false));
    parts.push(skinPlain(new THREE.SphereGeometry(0.095, 10, 8).scale(1, 1.1, 1.05).translate(sx * 0.36, 0.89, 0.11), hand, 'stone', paint));
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    parts.push(loft([S(sx * 0.15, 0.84, 0, 0.15, 0.14, body, hip, 0.5), S(sx * 0.16, 0.62, 0.005, 0.135, 0.13, hip), S(sx * 0.16, 0.46, 0.01, 0.125, 0.12, hip, knee, 0.5), S(sx * 0.16, 0.26, 0.015, 0.115, 0.115, knee), S(sx * 0.16, 0.1, 0.02, 0.12, 0.12, knee, foot, 0.6)], 12, 'stone', paint, true, false));
    parts.push(loft([S(sx * 0.16, 0.1, -0.05, 0.13, 0.1, foot), S(sx * 0.16, 0.06, 0.1, 0.12, 0.07, foot), S(sx * 0.16, 0.05, 0.22, 0.075, 0.05, foot)], 10, 'stone', paint, true, true));
  }
  // the stone sabre in the right hand: a thick, slightly curved carved blade, the guard a heavy bar
  {
    const hand = B('armR_hand'), x = -0.36;
    hard.push(loft([S(x, 0.89, 0.02, 0.04, 0.04, hand), S(x, 0.89, 0.12, 0.045, 0.045, hand), S(x, 0.89, 0.2, 0.04, 0.04, hand)], 8, 'carve', paint, true, true, 'z'));
    hard.push(skinPlain(new THREE.BoxGeometry(0.2, 0.06, 0.05).translate(x, 0.89, 0.23), hand, 'carve', paint));
    hard.push(loft([S(x, 0.9, 0.25, 0.075, 0.026, hand), S(x, 0.92, 0.55, 0.085, 0.026, hand), S(x, 0.97, 0.85, 0.075, 0.022, hand), S(x, 1.05, 1.12, 0.05, 0.018, hand), S(x, 1.12, 1.28, 0.012, 0.01, hand)], 8, 'blade', paint, true, true, 'z'));
  }
  setShapeFn(null);
  void spine;
  return {
    bones, furParts: parts, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.9, bodyHalfLen: 0.6, bodyRadius: 0.4, headRadius: 0.26, legLen: 0.82, feet: [[0.16, 0.05], [-0.16, 0.05], [0.16, -0.05], [-0.16, -0.05]], halfWidth: 0.38, capsuleAxis: 'y' },
  };
}

// ───────────────────────────── the amber cracks (a second skinned mesh) ─────────────────────────────

/** crack polylines over the stele (model space, bind pose) as thin skinned tubes; `bone` by height */
function buildCracks(bones: BoneDef[]): THREE.BufferGeometry {
  const B = boneIndex(bones);
  const paint: Paint = (out) => { out.setRGB(1, 1, 1); };
  const parts: THREE.BufferGeometry[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // the stele's section at height y (matches the loft above), pushed out a hair so the crack sits proud of the stone
  const surf = (th: number, y: number): [number, number, number] => {
    const k = clamp((y - 0.74) / 0.88, 0, 1);
    const rx = y > 1.56 ? 0.26 : 0.33 + 0.04 * Math.sin(k * Math.PI * 0.9), rz = y > 1.56 ? 0.19 : 0.24 + 0.02 * Math.sin(k * Math.PI * 0.9);
    return [Math.sin(th) * (rx + 0.012), y, Math.cos(th) * (rz + 0.012)];
  };
  const boneAt = (y: number) => (y > 1.3 ? B('chest') : y > 1.02 ? B('spine') : B('body'));
  const crack = (th0: number, y0: number, dy: number, steps: number, r0: number) => {
    let th = th0, y = y0;
    const pts: [number, number, number][] = [surf(th, y)];
    for (let i = 0; i < steps; i++) {
      y += dy * (0.7 + rnd() * 0.6); th += (rnd() - 0.5) * 0.5;
      pts.push(surf(th, y));
      if (rnd() < 0.3 && steps > 3) { // a branch
        const bth = th + (rnd() < 0.5 ? -1 : 1) * 0.35;
        parts.push(tube([surf(th, y), surf(bth, y + dy * 0.8), surf(bth + (rnd() - 0.5) * 0.3, y + dy * 1.5)], r0 * 0.6, r0 * 0.15, boneAt(y), 'crack', paint, 5));
      }
    }
    parts.push(tube(pts, r0, r0 * 0.25, boneAt((y0 + y) / 2), 'crack', paint, 5));
  };
  // around each weak point a burst of cracks (the chest seam, the back, the right shoulder), plus a few long ones
  crack(0.1, 1.5, -0.07, 6, 0.016); crack(-0.05, 1.3, 0.06, 4, 0.014); crack(0.3, 1.22, -0.08, 5, 0.013);   // chest, front
  crack(Math.PI - 0.1, 1.42, -0.07, 6, 0.015); crack(Math.PI + 0.25, 1.1, 0.07, 4, 0.012);                    // back
  crack(-1.2, 1.5, -0.06, 5, 0.013); crack(-0.7, 0.98, -0.05, 4, 0.011); crack(1.1, 1.1, 0.07, 5, 0.011);     // sides
  // the right shoulder's cluster rides the arm; a crack across the brow
  parts.push(tube([[-0.36, 1.44, 0.1], [-0.33, 1.36, 0.11], [-0.37, 1.27, 0.1], [-0.36, 1.18, 0.12]], 0.013, 0.004, B('armR_sh'), 'crack', paint, 5));
  parts.push(tube([[0.1, 1.94, 0.2], [0.02, 1.9, 0.235], [-0.07, 1.93, 0.215], [-0.13, 1.88, 0.19]], 0.011, 0.004, B('head'), 'crack', paint, 5));
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    parts.push(tube([[sx * 0.2, 0.7, 0.12], [sx * 0.17, 0.58, 0.13], [sx * 0.2, 0.46, 0.125]], 0.011, 0.004, B(`leg${side}_hip`), 'crack', paint, 5));
  }
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'skinIndex' && k !== 'skinWeight') p.deleteAttribute(k);
  const merged = parts.length > 0 ? mergeParts(parts) : new THREE.BufferGeometry();
  return merged;
}
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // a small merge (indexed parts, same attributes) — three's BufferGeometryUtils is not imported by species files
  const out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'skinIndex', 'skinWeight'] as const;
  let vtx = 0, idxN = 0;
  for (const p of parts) { vtx += p.getAttribute('position').count; idxN += p.index ? p.index.count : p.getAttribute('position').count; }
  const idx = new Uint32Array(idxN);
  let vo = 0, io = 0;
  for (const name of names) {
    const first = parts[0]?.getAttribute(name);
    const size = first?.itemSize ?? 3;
    const arr = new Float32Array(vtx * size);
    let o = 0;
    for (const p of parts) { const a = p.getAttribute(name); for (let i = 0; i < a.count * size; i++) arr[o + i] = (a.array[i] ?? 0); o += a.count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const p of parts) {
    const n = p.getAttribute('position').count;
    if (p.index) for (let i = 0; i < p.index.count; i++) idx[io++] = p.index.getX(i) + vo;
    else for (let i = 0; i < n; i++) idx[io++] = i + vo;
    vo += n;
  }
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

interface CrackRig { mesh: THREE.SkinnedMesh; mat: THREE.MeshBasicMaterial }
const cracks = new WeakMap<Animal, CrackRig>();
let crackGeo: THREE.BufferGeometry | null = null;
function crackRig(a: Animal, bones: BoneDef[]): CrackRig {
  let r = cracks.get(a);
  if (r !== undefined) return r;
  crackGeo ??= buildCracks(bones);
  const mat = new THREE.MeshBasicMaterial({ color: AMBER.clone(), toneMapped: false });
  mat.name = 'balbal-cracks';
  const mesh = new THREE.SkinnedMesh(crackGeo, mat);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  a.mesh.add(mesh);
  mesh.bind(a.mesh.skeleton, a.mesh.bindMatrix);
  r = { mesh, mat };
  cracks.set(a, r);
  return r;
}
let bindBones: BoneDef[] | null = null;

// ───────────────────────────── the pose ─────────────────────────────

const R = (b: THREE.Bone, x: number, y: number, z: number) => b.rotation.set(x, y, z);
const L = THREE.MathUtils.lerp;
/** the slam's shape: wind-up to W_END, the blow to S_END, then the blade in the turf */
const ATK_T = 2.9, W_END = 0.52, S_END = 0.58;

function animateBalbal(c: RigAnimCtx): void {
  const b = c.bones as BalbalBones, m = c.mem as BalbalMem, a = c.animal;
  if (bindBones !== null) {
    const rig = crackRig(a, bindBones);
    // the cracks: a slow smoulder, swelling through the wind-up, a flash on the blow, dying out as it crumbles
    const atk = c.attack;
    const wind = atk >= 0 ? step(atk, 0, W_END) : 0, flash = atk >= 0 ? Math.max(0, 1 - Math.abs(atk - (W_END + S_END) / 2) * 14) : 0;
    const rising = m.field === 1 ? 1 - (m.rise ?? 1) : 0;
    const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
    const g = (0.9 + 0.25 * Math.sin(c.t * 2.3 + c.seed) + 2.6 * wind * wind + 4 * flash + 1.5 * rising * (0.6 + 0.4 * Math.sin(c.t * 17))) * (1 - dead * 0.85);
    m.glow = g;
    rig.mat.color.copy(AMBER).multiplyScalar(g);
  }
  if (!c.alive) m.deadT = (m.deadT ?? 0) + c.dt;
  const sink = Math.max(0, (m.deadT ?? 0) - 0.9) * 1.1;
  const ground = heightAt(a.position.x, a.position.z);
  if (m.field === 1) {
    // out of the ground (rise 0 → 1), back into it at dawn; a grinding shake while it moves through the soil
    const r = smooth01(m.rise ?? 1);
    a.yOffset = -(1 - r) * 2.5 * a.scale - sink;
  } else a.yOffset = (m.floorY ?? ground) - ground - sink;
  const grind = m.field === 1 ? Math.min(1, (1 - (m.rise ?? 1)) * 3) * ((m.rise ?? 1) > 0.02 ? 1 : 0) : 0;
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const moving = clamp(c.speed / 1.0, 0, 1);
  const ph = c.phase * Math.PI * 2;
  const look = lookAngles(c, 1.85, 0.8, 0.4);
  const emerge = 1 - (m.emerge ?? 1);
  const kneel = step(dead, 0, 0.5), topple = step(dead, 0.45, 1);
  const shakeX = grind * 0.05 * Math.sin(c.t * 31), shakeZ = grind * 0.05 * Math.sin(c.t * 27 + 1);
  b.body.position.y = c.dims.bodyY - 0.06 * Math.abs(Math.sin(ph)) * moving - 0.4 * kneel - 0.2 * topple;
  let bodyP = 0.04 + 0.08 * moving + 1.3 * topple + shakeX, spineY = 0, bodyRoll = 0.05 * Math.sin(ph) * moving + shakeZ;
  let armRx = 0.2 - 0.9 * emerge - 0.4 * grind, armRz = -0.22, elR = -0.45, handR = 0.3;
  let kneeBend = 0;
  const atk = c.attack;
  if (atk >= 0) {
    // the SLAM: the sabre goes up and back over the head (a long, readable wind-up, the body leaning back and turning),
    // comes down in one blow into the turf in front, then the stone hauls it back out
    const wind = step(atk, 0, W_END), cut = step(atk, W_END, S_END), rec = step(atk, 0.82, 1);
    const hold = 1 - rec;
    armRx = L(L(0.2, -3.0, wind), 1.15, cut) * hold + 0.2 * rec;
    armRz = L(L(-0.22, -0.35, wind), 0.05, cut) * hold - 0.22 * rec;
    elR = L(L(-0.45, -0.95, wind), -0.05, cut) * hold - 0.45 * rec;
    handR = L(L(0.3, 0.7, wind), -0.2, cut) * hold + 0.3 * rec;
    bodyP += L(L(0, -0.24, wind), 0.52, cut) * hold;
    spineY = L(L(0, 0.35, wind), -0.2, cut) * hold;
    bodyRoll += L(L(0, 0.08, wind), -0.04, cut) * hold;
    kneeBend = L(L(0, 0.15, wind), 0.55, cut) * hold;
    // a tremor through the wind-up: the stone straining
    bodyP += Math.sin(c.t * 40) * 0.012 * wind * (1 - cut);
  }
  R(b.body, bodyP, 0, bodyRoll);
  b.body.position.y -= kneeBend * 0.12;
  R(b.spine, 0.04 + 0.1 * c.brace, spineY + look.yaw * 0.3, 0);
  R(b.chest, 0.02, look.yaw * 0.2, 0);
  R(b.head, -0.1 - look.pitch * 0.4 + 0.2 * c.flinch + 0.3 * kneel, look.yaw * 0.5, 0);
  const armSw = Math.sin(ph) * 0.28 * moving;
  R(b.armR_sh, armRx + armSw * 0.4 + 0.6 * dead, 0, armRz);
  R(b.armR_el, elR, 0, -0.1);
  R(b.armR_hand, handR, 0, 0);
  // the goblet arm stays bent at the chest (as it was carved)
  R(b.armL_sh, 0.12 - armSw * 0.5 - 0.5 * emerge + 0.6 * dead, 0, 0.16);
  R(b.armL_el, -1.35 + 0.3 * moving, 0.35, 0.3);
  R(b.armL_hand, 0.2, 0, 0);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const lsw = Math.sin(ph + (sx > 0 ? 0 : Math.PI));
    R(b[`leg${side}_hip`], -0.42 * lsw * moving + 0.15 * kneel - 0.4 * topple - kneeBend * 0.5, 0, sx * 0.06);
    R(b[`leg${side}_knee`], (0.3 + 0.4 * Math.max(0, lsw)) * moving + 1.7 * kneel + kneeBend, 0, 0);
    R(b[`leg${side}_foot`], -0.15 * lsw * moving - kneeBend * 0.5, 0, 0);
  }
}

// ───────────────────────────── the brain ─────────────────────────────

const ST_RISE = 0, ST_GUARD = 1, ST_STALK = 2, ST_ATTACK = 3, ST_RETURN = 4, ST_SINK = 5, ST_EMERGE = 6;
const WALK = 1.25, AGGRO = 28, LEASH = 48, GIVE_UP = 42, SWING_R = 2.6, HIT_R = 3.1, HIT_CONE = 0.96, DAMAGE = 30, KURGAN_DAMAGE = 18;
const RISE_T = 3.4, SINK_T = 3.0, COOLDOWN = 1.4;
/** exported for the controller's telegraph wedge: the slam's reach and half-angle */
export const BALBAL_SLAM = { reach: HIT_R, cone: HIT_CONE, windup: ATK_T * W_END, strike: ATK_T * (W_END + S_END) / 2 };

function thinkBalbal(a: Animal, c: ThinkCtx): void {
  const m = a.mem as BalbalMem;
  _player.copy(c.player);
  const field = m.field === 1;
  if (m.init !== 1) {
    m.init = 1; m.t = 0; m.cd = 1.2; m.emerge = field ? 1 : 0;
    m.st = field ? ST_RISE : ST_EMERGE;
    if (field) { m.rise ??= 0; a.state = 'rise'; c.sound('bear_growl'); } else a.state = 'rise';
  }
  m.t = (m.t ?? 0) + c.dt; m.cd = Math.max(0, (m.cd ?? 0) - c.dt);
  const dx = c.player.x - a.position.x, dz = c.player.z - a.position.z, d = Math.hypot(dx, dz), toPlayer = Math.atan2(dx, dz);
  const hx = m.homeX ?? a.position.x, hz = m.homeZ ?? a.position.z;
  const fromHome = Math.hypot(c.player.x - hx, c.player.z - hz);
  const toHome = Math.hypot(hx - a.position.x, hz - a.position.z), homeDir = Math.atan2(hx - a.position.x, hz - a.position.z);
  const playerHigh = Math.abs(c.player.y - a.position.y) > 8;   // up a cliff or down in a ravine: out of reach
  a.lookTarget.copy(c.player); a.lookWeight = m.st === ST_RISE || m.st === ST_EMERGE || m.st === ST_SINK ? 0.3 : 1;
  m.open = m.st === ST_ATTACK && a.attackPhase > S_END ? 1 : 0;
  if (field && m.dawn === 1 && m.st !== ST_SINK && m.st !== ST_RETURN && m.st !== ST_ATTACK) { m.st = ST_RETURN; m.t = 0; }
  switch (m.st ?? ST_GUARD) {
    case ST_RISE: {
      m.rise = Math.min(1, (m.rise ?? 0) + c.dt / RISE_T);
      a.setMotion(a.yaw, 0, 0.5);
      if (m.rise >= 1) { m.st = ST_GUARD; m.t = 0; }
      break;
    }
    case ST_EMERGE: {
      const T = m.emergeT ?? 1.6;
      m.emerge = Math.min(1, m.t / T);
      a.setMotion(a.yaw, 0.9, 0.5);
      if (m.t >= T) { m.st = ST_STALK; m.emerge = 1; c.sound('bear_growl'); }
      break;
    }
    case ST_GUARD: {
      a.state = 'idle';
      a.setMotion(m.homeYaw ?? a.yaw, 0, 1.2);
      if (!c.calm && !playerHigh && d < AGGRO && (!field || fromHome < LEASH)) { m.st = ST_STALK; m.t = 0; c.sound('bear_growl'); }
      break;
    }
    case ST_STALK: {
      a.state = 'stalk';
      if (field && (fromHome > LEASH || d > GIVE_UP || c.calm || playerHigh)) { m.st = ST_RETURN; m.t = 0; break; }
      if (d < SWING_R && (m.cd ?? 0) <= 0) {
        m.st = ST_ATTACK; m.hit = 0; m.slamT = 0; a.startAttack(ATK_T); a.setMotion(toPlayer, 0, 3); c.sound('bear_roar');
        break;
      }
      if (field) c.steer(a, toPlayer, d > SWING_R * 0.8 ? WALK : 0, 2.2);
      else a.setMotion(toPlayer, d > SWING_R * 0.8 ? WALK : 0, 2.2);
      break;
    }
    case ST_ATTACK: {
      a.state = 'attack';
      const p = a.attackPhase;
      // it can still turn through most of the wind-up (slowly): side-stepping late is how you beat it
      a.setMotion(toPlayer, 0, p < W_END * 0.8 ? 1.1 : 0);
      if (p >= (W_END + S_END) / 2 && m.hit !== 1) {
        m.hit = 1; m.slamT = 1;
        let off = toPlayer - a.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
        if (d <= HIT_R * a.scale / 1.18 + 0.4 && Math.abs(off) < HIT_CONE && Math.abs(c.player.y - a.position.y) < 2.2) { c.hurt(m.dmg ?? (field ? DAMAGE : KURGAN_DAMAGE)); c.sound('sailor_slash'); }
        c.sound('coconut_land');
      }
      if (p >= 1 || p < 0) { a.cancelAttack(); m.st = ST_STALK; m.cd = COOLDOWN; }
      break;
    }
    case ST_RETURN: {
      a.state = 'wander';
      if (!field) { m.st = ST_STALK; break; }
      if (m.dawn !== 1 && !c.calm && !playerHigh && d < AGGRO * 0.6 && fromHome < LEASH) { m.st = ST_STALK; break; }
      if (toHome < 0.7) {
        a.position.x = hx; a.position.z = hz;
        a.setMotion(m.homeYaw ?? a.yaw, 0, 1.5);
        let off = (m.homeYaw ?? a.yaw) - a.yaw; off = Math.atan2(Math.sin(off), Math.cos(off));
        if (Math.abs(off) < 0.15) { m.st = m.dawn === 1 ? ST_SINK : ST_GUARD; m.t = 0; if (m.dawn === 1) c.sound('bear_growl'); }
      } else c.steer(a, homeDir, m.dawn === 1 ? WALK * 1.3 : WALK, 2.2);
      break;
    }
    case ST_SINK: {
      a.state = 'rise';
      a.setMotion(m.homeYaw ?? a.yaw, 0, 1);
      m.rise = Math.max(0, (m.rise ?? 1) - c.dt / SINK_T);
      if (m.rise <= 0) m.gone = 1;
      break;
    }
    default: break;
  }
  // the chamber's walls (the King's adds)
  if (m.minX !== undefined && m.maxX !== undefined && m.minZ !== undefined && m.maxZ !== undefined && m.st !== ST_EMERGE) {
    a.position.x = clamp(a.position.x, m.minX, m.maxX); a.position.z = clamp(a.position.z, m.minZ, m.maxZ);
  }
}

/** the damage model (see the header) */
function balbalDamageMul(a: Animal, hitPoint: THREE.Vector3): number {
  const m = a.mem as BalbalMem;
  if (m.field === 1 && (m.rise ?? 1) < 0.6) return 0.25;          // still mostly in the ground
  const open = m.open === 1 ? 1.25 : 1;
  const ranged = Math.hypot(hitPoint.x - _player.x, hitPoint.z - _player.z) > 4.2;
  if (ranged) return 0.5 * open;
  if (balbalCombat.melee === 'spear') {
    // into the model's frame: undo the position, the heading and the scale
    _lp.copy(hitPoint).sub(a.position); _lp.y -= a.yOffset;
    const cos = Math.cos(-a.yaw), sin = Math.sin(-a.yaw);
    const x = _lp.x * cos + _lp.z * sin, z = -_lp.x * sin + _lp.z * cos;
    _lp.set(x, _lp.y, z).multiplyScalar(1 / a.scale);
    for (const w of BALBAL_WEAK) if (_lp.distanceTo(w) < WEAK_R) return 2.5 * open;
    return open;
  }
  return 1.5 * open;
}

/** is a hit point on one of the amber cracks' hearts (world) — the spear's ×2.5; exported for effects */
export function onBalbalCrack(a: Animal, hitPoint: THREE.Vector3): boolean {
  _lp.copy(hitPoint).sub(a.position); _lp.y -= a.yOffset;
  const cos = Math.cos(-a.yaw), sin = Math.sin(-a.yaw);
  const x = _lp.x * cos + _lp.z * sin, z = -_lp.x * sin + _lp.z * cos;
  _lp.set(x, _lp.y, z).multiplyScalar(1 / a.scale);
  return BALBAL_WEAK.some((w) => _lp.distanceTo(w) < WEAK_R);
}

registerSpecies({
  kind: BALBAL,
  label: 'Balbal',
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: WALK,
  chargeDamage: DAMAGE,
  sounds: { call: 'bear_growl', hurt: 'crab_click', callEvery: [10, 22] },
  // 2.1 m modelled × 1.18 ≈ 2.5 m; 'capped' wears the pointed cap and the short beard (the statue's variant 1)
  variants: [
    { id: 'warrior', label: 'Balbal', weight: 2, rarity: 'uncommon', scale: [1.15, 1.22], hp: 220 },
    { id: 'capped', label: 'Balbal', weight: 1, rarity: 'uncommon', scale: [1.15, 1.22], hp: 220, traits: { cap: true } },
  ],
  build: (v, rng) => { const sp = buildBalbal(v, rng); bindBones = sp.bones; return sp; },
  animate: animateBalbal,
  think: thinkBalbal,
  damageMul: balbalDamageMul,
  blood: false,   // stone: the controller throws chips / sparks instead
});

// E155 (src/core/shardState.ts)
stateSlot('balbal.combat', balbalCombat);
