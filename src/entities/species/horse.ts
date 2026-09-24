import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx } from './registry';
import { loft, tube, skinPlain, S, boneIndex, mix, sstep, srgb, paletteColors, type Station, type RGB, type Paint } from './loft';
import { NO_FUR, smooth01, bump, clamp } from './rigs';
import { thinkHorse, horseDamageMul } from '../Herd';
import type { Animal } from '../Animal';
import { lock, hash01, wrapPatch, type V3, type Skin, type Section } from '../creatureKit';
import { wildEnv } from '../wildEnv';

/**
 * Wild steppe horse (Nalati, row B4) — a stocky Kazakh horse, 1.42 m at the withers: bay / chestnut / black / dun / grey
 * mares, 0.6-scale foals, and the black stallion with the long mane. Herd AI: `src/entities/Herd.ts` (lead mare, boids,
 * flight / stampede, the stallion's guard states). Painterly: smooth lofts, vertex colour, one draw call.
 *
 * ── The horse rig, for riding (B7) and taming (B8) ─────────────────────────────────────────────────────────────────
 * A horse is an ordinary `Animal`. To ride one, take it out of the herd AI (`herd.setRidden(horse)`, Herd.ts) and drive
 * it yourself every frame:
 *
 *   horse.setMotion(yaw, speed, turnRate)   the gait follows the speed (SpeciesDef.gait below):
 *        walk ≤ 1.8 m/s (HORSE_SPEED.walk) · trot 3.0–6.0 (blend in from 3.0, 4.5 typical) · canter 6.5–10 (the gallop
 *        cycle at a lower stride rate, 8.5 typical) · gallop 13. The stride rate follows the ground speed, so hooves
 *        never slide at any speed in between.
 *   horseBones(horse)          → { body, neck1, neck2, head, earL, earR, mane1, mane2, tail, tail2, tail3 } (THREE.Bone)
 *                                 — for the first-person head/neck view and a bridle; read their matrixWorld after update
 *   horseSaddle(horse, out)    → the rider's seat (world): on the spine behind the withers, riding the gait's bob
 *   horseEye(horse, out)       → a point between the ears (world) — a camera anchor for a mounted look
 *   horse.mem knobs (0..1, eased in postPose; set them, the pose follows):
 *        rear    up on the hind legs, forelegs tucked (the stallion's display, a thrown rider)
 *        buck    the hind end kicks up in a rhythm (taming rounds); mem.buckDir ±1 tilts it left / right
 *        kick    a single double-barrelled hind kick (set to 1, it decays)
 *        stamp   a fore hoof stamps (set to 1, it decays)
 *        toss    head toss / snort
 *        headUp  head high, ears forward — watching
 *        pin     ears pinned back — warning / charging
 * Hit volumes: dims below (body capsule 0.9 m half-length, head sphere 0.2 m) — the bow and sabre need nothing new.
 * Palette keys (VariantDef.tint): coat belly points mane muzzle sock hoof eye earIn dorsal.
 */

export const HORSE_SPEED = { walk: 1.8, trot: 4.5, canter: 8.5, gallop: 13 } as const;

export const HORSE = {   // exported: glbCreatures.ts recolours the rigged hull per variant from it
  coat: [0.50, 0.27, 0.14], belly: [0.60, 0.38, 0.22], points: [0.07, 0.055, 0.05], mane: [0.07, 0.055, 0.05],
  muzzle: [0.22, 0.15, 0.12], sock: [0.92, 0.90, 0.85], hoof: [0.20, 0.17, 0.15], eye: [0.04, 0.03, 0.025],
  earIn: [0.30, 0.20, 0.16], dorsal: [0.07, 0.055, 0.05],
} satisfies Record<string, RGB>;

const CHESTNUT: Record<string, RGB> = { coat: [0.62, 0.32, 0.14], belly: [0.70, 0.42, 0.22], points: [0.58, 0.30, 0.13], mane: [0.78, 0.52, 0.28], muzzle: [0.40, 0.24, 0.15], dorsal: [0.62, 0.32, 0.14] };
const BLACK: Record<string, RGB> = { coat: [0.16, 0.15, 0.155], belly: [0.18, 0.165, 0.16], points: [0.07, 0.065, 0.068], mane: [0.05, 0.045, 0.05], muzzle: [0.14, 0.12, 0.12], earIn: [0.10, 0.08, 0.08], dorsal: [0.13, 0.12, 0.125] };
const DUN: Record<string, RGB> = { coat: [0.76, 0.62, 0.42], belly: [0.84, 0.74, 0.56], points: [0.10, 0.08, 0.07], mane: [0.10, 0.08, 0.07], muzzle: [0.30, 0.24, 0.20], dorsal: [0.24, 0.17, 0.12] };
const GREY: Record<string, RGB> = { coat: [0.80, 0.80, 0.78], belly: [0.88, 0.88, 0.86], points: [0.36, 0.35, 0.35], mane: [0.55, 0.54, 0.53], muzzle: [0.24, 0.22, 0.22], earIn: [0.45, 0.40, 0.40], dorsal: [0.80, 0.80, 0.78] };
const FOAL_BAY: Record<string, RGB> = { coat: [0.66, 0.45, 0.30], belly: [0.76, 0.60, 0.44], points: [0.72, 0.58, 0.44], mane: [0.30, 0.22, 0.16], muzzle: [0.42, 0.33, 0.28], dorsal: [0.66, 0.45, 0.30] };
const FOAL_CHESTNUT: Record<string, RGB> = { coat: [0.74, 0.46, 0.26], belly: [0.84, 0.64, 0.46], points: [0.80, 0.60, 0.42], mane: [0.84, 0.62, 0.40], muzzle: [0.50, 0.36, 0.28], dorsal: [0.74, 0.46, 0.26] };

function horsePaint(v: VariantDef): Paint {
  const P = paletteColors(HORSE, v.tint);
  const blaze = Boolean(v.traits?.['blaze']);
  const socks = Number(v.traits?.['socks'] ?? 0);
  const dappled = Boolean(v.traits?.['dapple']);
  return (out, x, y, z, _nx, ny, nz, part, t) => {
    switch (part) {
      case 'body': {
        out.copy(P.coat);
        // painted anatomy: a sheen on the croup and the shoulder, shadowed creases behind the shoulder, at the flank
        // and where the legs join; the belly darker (the painterly light does the rest)
        const shoulder = sstep(0.16, 0.0, Math.hypot(z - 0.42, (y - 1.22) * 1.3)), croup = sstep(0.24, 0.0, Math.hypot(z + 0.62, (y - 1.32) * 1.2));
        out.multiplyScalar(1 + 0.22 * Math.max(shoulder, croup) * sstep(-0.2, 0.5, ny));
        const crease = sstep(0.06, 0.0, Math.abs(z - 0.2 + (y - 1.0) * 0.5)) * sstep(1.25, 0.95, y) + sstep(0.08, 0.0, Math.abs(z + 0.3 - (y - 0.95) * 0.9)) * sstep(1.15, 0.9, y) * 0.8;
        out.multiplyScalar(1 - 0.22 * crease);
        mix(out, out, P.belly, sstep(-0.3, -0.85, ny) * 0.8);
        out.multiplyScalar(1 - 0.25 * sstep(-0.4, -0.95, ny) - 0.18 * sstep(0.95, 0.8, y));
        out.multiplyScalar(1 + 0.28 * sstep(0.25, 0.85, ny));   // the painted sky-light along the back (a black coat reads blue-grey there)
        mix(out, out, P.dorsal, sstep(0.9, 0.98, ny) * sstep(0.05, 0.02, Math.abs(x)));
        if (dappled) mix(out, out, P.points, sstep(0.55, 0.85, Math.sin(x * 23 + z * 7) * Math.sin(z * 19 - y * 11)) * 0.25 * sstep(0.2, -0.3, ny));
        break;
      }
      case 'neck': out.copy(P.coat); mix(out, out, P.belly, sstep(-0.4, -0.9, ny) * 0.4); out.multiplyScalar(1 + 0.12 * sstep(0.2, 0.9, ny) - 0.15 * sstep(-0.3, -0.9, ny)); break;
      case 'head':
        out.copy(P.coat);
        mix(out, out, P.muzzle, sstep(0.72, 0.9, t));
        out.multiplyScalar(1 - 0.35 * sstep(0.05, 0.02, Math.hypot(Math.abs(x) - 0.085, y - 1.69, z - 1.235)) - 0.3 * sstep(0.025, 0.01, Math.hypot(Math.abs(x) - 0.035, y - 1.37, z - 1.525)));   // eye socket, nostrils
        if (blaze) mix(out, out, P.sock, sstep(0.035, 0.02, Math.abs(x)) * sstep(0.18, 0.3, t) * sstep(0.4, 0.8, ny + nz * 0.6) * 0.95);
        break;
      case 'ear': out.copy(P.coat); mix(out, out, P.points, sstep(0.5, 1, t) * 0.8); mix(out, out, P.earIn, sstep(0.2, 0.8, nz) * 0.7); break;
      case 'leg': {
        mix(out, P.coat, P.points, sstep(0.66, 0.5, y));                                   // black points below the knee / hock
        const front = z > 0;
        const sockOn = socks >= 4 || (socks >= 2 && !front) || (socks >= 1 && !front && x > 0);
        if (sockOn) mix(out, out, P.sock, sstep(0.3, 0.22, y));
        break;
      }
      case 'mane': case 'tail': mix(out, P.mane, P.points, 0.2 * t); break;
      case 'hoof': out.copy(P.hoof); break;
      case 'eye': out.copy(P.eye); break;
      default: out.copy(P.coat);
    }
    void nz;
  };
}

/** crest of a neck loft: the ring's top point at station `s` given its neighbours (the loft's own 'x' frame) */
function crestPoint(prev: Station, s: Station, next: Station, lift: number): [number, number, number, number, number] {
  const ty = next.y - prev.y, tz = next.z - prev.z, tl = Math.hypot(ty, tz) || 1;
  // up = tangent × X  →  (0, tz, -ty) / |t|
  const uy = tz / tl, uz = -ty / tl;
  const r = s.ry * s.top;
  return [s.y + uy * (r + lift), s.z + uz * (r + lift), uy, uz, r];
}

function buildHorse(v: VariantDef, _rng: Rng): AnimalSpecies {
  const foal = Boolean(v.traits?.['foal']);
  const maneK = Number(v.traits?.['mane'] ?? 1);
  const bk = foal ? 0.84 : 1;           // foals: a slighter barrel and neck on the same long legs
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 1.10, -0.05] },
    { name: 'neck1', parent: 'body', pos: [0, 1.28, 0.60] },
    { name: 'neck2', parent: 'neck1', pos: [0, 1.50, 0.86] },
    { name: 'head', parent: 'neck2', pos: [0, 1.74, 1.10] },
    { name: 'earL', parent: 'head', pos: [0.062, 1.83, 1.10] },
    { name: 'earR', parent: 'head', pos: [-0.062, 1.83, 1.10] },
    { name: 'mane1', parent: 'neck1', pos: [0, 1.46, 0.60] },
    { name: 'mane2', parent: 'neck2', pos: [0, 1.66, 0.86] },
    { name: 'tail', parent: 'body', pos: [0, 1.36, -0.83] },
    { name: 'tail2', parent: 'tail', pos: [0, 1.14, -0.96] },
    { name: 'tail3', parent: 'tail2', pos: [0, 0.84, -1.0] },
    { name: 'belly', parent: 'body', pos: [0, 0.90, 0.0] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.17, 1.06, 0.55] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.175, 0.53, 0.56] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.175, 0.20, 0.565] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.16, 1.16, -0.55] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.18, 0.80, -0.50] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.18, 0.52, -0.72] },
    );
  }
  const B = boneIndex(bones);
  const paint = horsePaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head'), bl = B('belly');
  const R = (r: number): number => r * bk;
  // torso: round croup, a long barrel, withers over the shoulder, a deep chest
  const torso = [
    S(0, 1.20, -0.87, 0.02, 0.02, body),
    S(0, 1.21, -0.855, R(0.13), R(0.15), body),
    S(0, 1.20, -0.80, R(0.21), R(0.22), body),
    S(0, 1.18, -0.68, R(0.255), R(0.25), body, body, 0, 1.05, 0.95),
    S(0, 1.15, -0.48, R(0.275), R(0.28), body, bl, 0.3),
    S(0, 1.11, -0.22, R(0.285), R(0.30), body, bl, 0.7, 0.93, 1.02),
    S(0, 1.10, 0.08, R(0.285), R(0.31), body, bl, 0.6, 0.95, 1.05),
    S(0, 1.12, 0.34, R(0.265), R(0.30), body, bl, 0.3, 1.07, 1.0),
    S(0, 1.155, 0.54, R(0.235), R(0.27), body, n1, 0.3, 1.1, 0.95),
    S(0, 1.17, 0.70, R(0.19), R(0.225), body, n1, 0.6, 1.02, 0.9),
    S(0, 1.18, 0.79, R(0.10), R(0.13), n1),
    S(0, 1.18, 0.815, 0.02, 0.03, n1),
  ];
  fur.push(loft(torso, 24, 'body', paint));
  // neck: deep at the base, arched crest
  const neck = [
    S(0, 1.20, 0.46, R(0.19), R(0.27), body, n1, 0.2),
    S(0, 1.31, 0.68, R(0.155), R(0.235), n1),
    S(0, 1.445, 0.83, R(0.125), R(0.20), n1, n2, 0.5),
    S(0, 1.575, 0.955, R(0.105), R(0.16), n2),
    S(0, 1.675, 1.05, R(0.092), R(0.13), n2, hd, 0.5),
    S(0, 1.735, 1.11, 0.08, 0.10, hd),
    S(0, 1.755, 1.13, 0.03, 0.035, hd),
  ];
  fur.push(loft(neck, 18, 'neck', paint, false, true));
  // head: wide jowls, a long straight face, a soft muzzle
  fur.push(loft([
    S(0, 1.765, 1.06, 0.06, 0.07, hd),
    S(0, 1.77, 1.10, 0.095, 0.11, hd),
    S(0, 1.715, 1.19, 0.10, 0.125, hd, hd, 0, 1.0, 1.1),
    S(0, 1.635, 1.28, 0.085, 0.10, hd, hd, 0, 1.0, 1.05),
    S(0, 1.545, 1.365, 0.07, 0.075, hd),
    S(0, 1.465, 1.435, 0.064, 0.068, hd),
    S(0, 1.405, 1.49, 0.068, 0.074, hd),
    S(0, 1.365, 1.525, 0.058, 0.062, hd),
    S(0, 1.345, 1.54, 0.03, 0.032, hd),
    S(0, 1.34, 1.545, 0.008, 0.008, hd),
  ], 16, 'head', paint));
  // mane: a fin along the crest (skinned to the mane bones so it can flow), plus the forelock
  const maneSt: Station[] = [];
  const mb1 = B('mane1'), mb2 = B('mane2');
  const skin: [number, number, number][] = [[n1, mb1, 0.5], [mb1, mb1, 0], [mb1, mb2, 0.5], [mb2, mb2, 0], [mb2, hd, 0.3]];
  for (let i = 1; i < neck.length - 2; i++) {
    const prev = neck[i - 1], s = neck[i], next = neck[i + 1];
    if (prev === undefined || s === undefined || next === undefined) continue;
    const h = (foal ? 0.03 : 0.05) * Math.min(1.3, maneK) * (i === 1 ? 0.7 : 1);
    const [cy, cz] = crestPoint(prev, s, next, h * 0.35);
    const sk = skin[i - 1] ?? [mb2, mb2, 0];
    maneSt.push(S(0, cy, cz, 0.028 * Math.min(1.3, maneK), h, sk[0], sk[1], sk[2]));
  }
  if (maneSt.length > 1) {
    const f = maneSt[0], l = maneSt[maneSt.length - 1];
    if (f !== undefined && l !== undefined) {
      maneSt.unshift({ ...f, z: f.z - 0.05, y: f.y - 0.02, rx: 0.01, ry: 0.02 });
      maneSt.push({ ...l, z: l.z + 0.06, y: l.y + 0.03, rx: 0.02, ry: 0.03 * maneK, b0: hd, b1: hd, w1: 0 });
    }
    fur.push(loft(maneSt, 8, 'mane', paint));
  }
  // the mane's LOCKS: flat ribbons from the crest draping over the off side of the neck (the stallion's reach past the
  // jaw), roots on the neck, tips on the mane bones so they swing and stream (postPose); a few stand up on the near side
  const maneSide = -1;   // falls to the right
  const nLocks = foal ? 12 : 24;
  for (let i = 0; i < nLocks; i++) {
    const u = 1 + (i / (nLocks - 1)) * 3.6;                  // along neck stations 1 … 4.6
    const i0 = Math.min(neck.length - 2, Math.floor(u)), f = u - i0;
    const a0 = neck[i0 - 1], a1 = neck[i0], a2 = neck[i0 + 1], a3 = neck[Math.min(neck.length - 1, i0 + 2)];
    if (a0 === undefined || a1 === undefined || a2 === undefined || a3 === undefined) continue;
    const c0 = crestPoint(a0, a1, a2, 0), c1 = crestPoint(a1, a2, a3, 0);
    const lerp = (p: number, q: number): number => p + (q - p) * f;
    const cy = lerp(a1.y, a2.y), cz = lerp(a1.z, a2.z), uy = lerp(c0[2], c1[2]), uz = lerp(c0[3], c1[3]);
    const rx = lerp(a1.rx, a2.rx), ry = lerp(a1.ry * a1.top, a2.ry * a2.top);
    const L = (foal ? 0.07 : 0.27) * maneK * (0.8 + 0.4 * hash01(i, 5)) * (u < 1.6 ? 0.7 : 1);
    const root = u < 2.8 ? n1 : n2, mb = u < 2.8 ? mb1 : mb2;
    const side = maneSide;
    const pts: V3[] = [];
    const steps = 5;
    for (let k = 0; k <= steps; k++) {
      // round the neck from the crest (θ 0) down the side, then hang straight
      const th = Math.min(1.25, (k / steps) * 1.25 * Math.min(1, L / 0.12));
      const off = 0.012 + 0.012 * k / steps;
      const yy = cy + uy * (ry * Math.cos(th) + off) - (k / steps) * Math.max(0, L - 0.12) * 0.9;
      const zz = cz + uz * (ry * Math.cos(th) + off) - 0.02 * (k / steps);
      const xx = side * (rx * Math.sin(th) + off * Math.sin(th));
      const p: V3 = [xx, yy, zz];
      pts.push(p);
    }
    const skins: Skin[] = pts.map((_, k) => (k === 0 ? [root, root, 0] : k < 2 ? [root, mb, 0.5] : [mb, mb, 0]));
    fur.push(lock(pts, 0.058 + 0.02 * hash01(i, 2), 0.012, skins, 'mane', paint, 'z', 5));
  }
  // forelock: three locks over the brow
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.022;
    fur.push(lock([[x, 1.80, 1.10], [x * 1.4, 1.79, 1.15], [x * 1.8, 1.75, 1.19], [x * 2, 1.70, 1.215 + 0.01 * maneK]], 0.022, 0.007, [[hd, hd, 0]], 'mane', paint, 'x', 5));
  }
  // ears
  for (const sx of [1, -1]) {
    const eb = B(sx > 0 ? 'earL' : 'earR');
    fur.push(loft([
      S(sx * 0.055, 1.80, 1.10, 0.03, 0.02, hd, eb, 0.3),
      S(sx * 0.062, 1.85, 1.105, 0.03, 0.018, eb),
      S(sx * 0.066, 1.90, 1.115, 0.02, 0.012, eb),
      S(sx * 0.066, 1.935, 1.125, 0.005, 0.004, eb),
    ], 8, 'ear', paint, true, true, 'z'));
    const eye = new THREE.SphereGeometry(0.024, 10, 8);
    eye.scale(0.7, 1, 1.15);
    eye.translate(sx * 0.093, 1.69, 1.235);
    eyes.push(skinPlain(eye, hd, 'eye', paint));
  }
  // tail: a dock, then the long hair flaring out and down
  const tl = B('tail'), t2 = B('tail2'), t3 = B('tail3');
  const tk = foal ? 0.55 : 1;
  fur.push(loft([
    S(0, 1.37, -0.80, 0.05, 0.05, body, tl, 0.4),
    S(0, 1.33, -0.88, 0.055, 0.055, tl),
    S(0, 1.24, -0.94, 0.07, 0.06, tl, t2, 0.3),
    S(0, 1.36 - 0.30 * tk, -0.975, 0.085, 0.065, t2),
    S(0, 1.36 - 0.46 * tk, -0.99, 0.095, 0.065, t2, t3, 0.5),
    S(0, 1.36 - 0.64 * tk, -1.0, 0.09, 0.06, t3),
    S(0, 1.36 - 0.80 * tk, -1.0, 0.065, 0.045, t3),
    S(0, 1.36 - 0.88 * tk, -0.995, 0.02, 0.02, t3),
  ], 12, 'tail', paint, false, true));
  // the tail's hair: strands from the dock, splaying and falling, each a little different — tips on tail3 so they stream
  const nStr = foal ? 6 : 12;
  for (let i = 0; i < nStr; i++) {
    const a = (i / nStr) * Math.PI * 2 + 0.3;
    const sx = Math.cos(a), sy = Math.sin(a);
    const len = (0.88 + 0.14 * hash01(i, 7)) * tk;
    const pts: V3[] = [
      [sx * 0.02, 1.34 + sy * 0.02, -0.86],
      [sx * 0.045, 1.24 + sy * 0.03, -0.94],
      [sx * 0.07, 1.36 - len * 0.35, -0.985],
      [sx * 0.085, 1.36 - len * 0.62, -1.0 - 0.02 * sy],
      [sx * 0.08, 1.36 - len * 0.86, -1.0 - 0.03 * sy],
      [sx * 0.06, 1.36 - len, -0.99],
    ];
    const skins: Skin[] = [[body, tl, 0.5], [tl, tl, 0], [tl, t2, 0.5], [t2, t2, 0], [t2, t3, 0.6], [t3, t3, 0]];
    fur.push(lock(pts, 0.042 + 0.012 * hash01(i, 3), 0.022, skins, 'tail', paint, 'x', 5));
  }
  // legs
  const feetF: [number, number][] = [], feetB: [number, number][] = [];
  const lk = foal ? 0.85 : 1;
  const hoof = (sx: number, z: number, bone: number): THREE.BufferGeometry => loft([
    S(sx, 0.10, z, 0.047 * lk, 0.05 * lk, bone),
    S(sx, 0.05, z + 0.012, 0.058 * lk, 0.062 * lk, bone),
    S(sx, 0.005, z + 0.02, 0.061 * lk, 0.066 * lk, bone),
    S(sx, 0.0, z + 0.02, 0.01, 0.01, bone),
  ], 12, 'hoof', paint);
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft([
      S(sx * 0.15, 1.18, 0.52, R(0.12), R(0.20), body, sh, 0.3),
      S(sx * 0.17, 0.96, 0.55, R(0.10), R(0.14), body, sh, 0.8),
      S(sx * 0.175, 0.80, 0.56, 0.072 * lk, 0.085 * lk, sh),
      S(sx * 0.175, 0.63, 0.56, 0.052 * lk, 0.058 * lk, sh),
      S(sx * 0.175, 0.535, 0.56, 0.05 * lk, 0.058 * lk, sh, ca, 0.5),
      S(sx * 0.175, 0.44, 0.56, 0.038 * lk, 0.043 * lk, ca),
      S(sx * 0.175, 0.29, 0.56, 0.035 * lk, 0.04 * lk, ca),
      S(sx * 0.175, 0.205, 0.565, 0.044 * lk, 0.05 * lk, ca, fe, 0.5),
      S(sx * 0.175, 0.145, 0.575, 0.038 * lk, 0.041 * lk, fe),
      S(sx * 0.175, 0.10, 0.585, 0.045 * lk, 0.049 * lk, fe),
    ], 12, 'leg', paint, false, true));
    hard.push(hoof(sx * 0.175, 0.585, fe));
    feetF.push([sx * 0.175, 0.605]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft([
      S(sx * 0.12, 1.24, -0.58, R(0.14), R(0.25), body, hp, 0.3),
      S(sx * 0.155, 1.01, -0.55, R(0.13), R(0.20), body, hp, 0.8),
      S(sx * 0.175, 0.82, -0.55, R(0.09), R(0.12), hp, stf, 0.5),
      S(sx * 0.18, 0.665, -0.64, 0.063 * lk, 0.075 * lk, stf),
      S(sx * 0.18, 0.53, -0.72, 0.05 * lk, 0.066 * lk, stf, hk, 0.5),
      S(sx * 0.18, 0.40, -0.72, 0.039 * lk, 0.045 * lk, hk),
      S(sx * 0.18, 0.28, -0.715, 0.035 * lk, 0.041 * lk, hk),
      S(sx * 0.18, 0.205, -0.71, 0.044 * lk, 0.05 * lk, hk),
      S(sx * 0.18, 0.145, -0.70, 0.038 * lk, 0.041 * lk, hk),
      S(sx * 0.18, 0.10, -0.69, 0.045 * lk, 0.049 * lk, hk),
    ], 12, 'leg', paint, false, true));
    hard.push(hoof(sx * 0.18, -0.69, hk));
    feetB.push([sx * 0.18, -0.67]);
  }
  if (v.traits?.['tack'] === true || v.traits?.['tack'] === 1) addTack(hard, torso, B);
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 1.10, bodyHalfLen: 0.78, bodyRadius: 0.30, headRadius: 0.2, legLen: 1.08, feet: [...feetF, ...feetB], halfWidth: 0.27 },
  };
}

// ── tack for the camp horses: felt blanket, saddle, stirrups, bridle + reins (taming-3 / style-B mockups) ──

const FELT = srgb(0.62, 0.11, 0.08), FELT_DARK = srgb(0.36, 0.06, 0.05), ORNAMENT = srgb(0.93, 0.86, 0.66), FLEECE = srgb(0.92, 0.88, 0.80);
const LEATHER = srgb(0.38, 0.21, 0.11), LEATHER_DARK = srgb(0.22, 0.12, 0.07), BRASS = srgb(0.78, 0.60, 0.28), IRON = srgb(0.42, 0.42, 0.44), STRAP = srgb(0.40, 0.14, 0.09);

const tackPaint: Paint = (out, _x, _y, _z, _nx, ny, _nz, part, t, a) => {
  switch (part) {
    case 'blanket': {
      // red felt (taming-3 / camp mockups): a fleece edge at the hem, a border of cream-and-black interlocking diamonds
      // between dark rules, the field with a cream ram's-horn medallion on each flank; darker in the folds
      const hem = Math.min(a, 1 - a);                                 // 0 at the hem … 0.5 over the spine
      const end = Math.min(t, 1 - t);                                 // 0 at the front / back edge
      const edge = Math.min(hem * 1.6, end);                          // distance in from the nearest edge
      out.copy(FELT);
      // the border band: diamonds along it (a zig-zag lattice), cream on black
      const inBand = sstep(0.045, 0.06, edge) * sstep(0.16, 0.145, edge);
      const along = hem * 1.6 < end ? t * 22 : a * 30;
      const across = (edge - 0.06) / 0.095;
      const zig = Math.abs(((along % 1) + 1) % 1 - 0.5) * 2;           // 0..1 triangle wave
      const dia = Math.abs(across - 0.5) * 2 + zig * 0.9;
      mix(out, out, FELT_DARK, inBand * 0.9);
      mix(out, out, ORNAMENT, inBand * sstep(0.95, 0.75, dia));
      mix(out, out, FELT_DARK, sstep(0.16, 0.175, edge) * sstep(0.2, 0.185, edge));   // the inner rule
      // the medallion: a cream ring with four horn curls, centred on each flank
      const fx = (t - 0.5) * 1.3, fy = (hem - 0.3) * 2.2;
      const rr = Math.hypot(fx, fy), ang = Math.atan2(fy, fx);
      const ringM = sstep(0.03, 0.01, Math.abs(rr - 0.2)) + sstep(0.025, 0.008, Math.abs(rr - 0.12 - 0.05 * Math.cos(ang * 4)));
      mix(out, out, ORNAMENT, Math.min(1, ringM) * sstep(0.34, 0.3, rr) * 0.95);
      mix(out, out, FLEECE, sstep(0.045, 0.025, edge));             // the fleece edge
      out.multiplyScalar(0.88 + 0.12 * Math.sin(a * 44 + t * 3) ** 2); // felt folds
      break;
    }
    case 'tassel': mix(out, FELT, ORNAMENT, sstep(0.75, 1, t) * 0.6); break;
    case 'saddle': mix(out, LEATHER, LEATHER_DARK, sstep(0.3, -0.5, ny) * 0.7 + sstep(0.1, 0.0, Math.min(t, 1 - t)) * 0.4); break;
    case 'strap': out.copy(STRAP); break;
    case 'brass': out.copy(BRASS); break;
    case 'iron': out.copy(IRON); break;
    default: out.copy(LEATHER);
  }
};

function addTack(hard: THREE.BufferGeometry[], torso: Station[], B: (n: string) => number): void {
  const body = B('body'), hd = B('head'), n1 = B('neck1'), n2 = B('neck2');
  const section = (z: number): Section => {
    let a = torso[0], b = torso[torso.length - 1];
    for (let i = 0; i < torso.length - 1; i++) { const p = torso[i], q = torso[i + 1]; if (p !== undefined && q !== undefined && p.z <= z && q.z >= z) { a = p; b = q; break; } }
    if (a === undefined || b === undefined) return { y: 1.1, rx: 0.28, ry: 0.3 };
    const u = b.z > a.z ? (z - a.z) / (b.z - a.z) : 0;
    return { y: a.y + (b.y - a.y) * u, rx: a.rx + (b.rx - a.rx) * u, ry: a.ry * a.top + (b.ry * b.top - a.ry * a.top) * u };
  };
  const onBody = (): Skin => [body, body, 0];
  // the felt blanket: over the back from the withers to the loin, down to mid-barrel each side
  const Z0 = -0.12, Z1 = 0.7, A = 1.5;
  hard.push(wrapPatch(section, Z0, Z1, -A, A, (u, v) => 0.014 + 0.006 * Math.sin(u * Math.PI) + 0.004 * Math.sin(v * 40) + 0.05 * sstep(0.2, 0.0, Math.min(v, 1 - v)), 18, 30, onBody, 'blanket', tackPaint));
  // red wool tassels at the blanket's four lower corners
  for (const sx of [1, -1]) for (const z of [Z0 + 0.03, Z1 - 0.03]) {
    const s = section(z);
    const x = sx * (Math.sin(A) * s.rx + 0.06), y = s.y + Math.cos(A) * s.ry - 0.02;
    hard.push(tube([[x, y, z], [x * 1.02, y - 0.1, z], [x * 1.03, y - 0.19, z]], 0.012, 0.03, body, 'tassel', tackPaint, 6));
  }
  // brass studs along the saddle skirt
  for (const sx of [1, -1]) for (let i = 0; i < 5; i++) {
    const z = 0.18 + i * 0.07, s = section(z);
    const st = new THREE.SphereGeometry(0.013, 6, 4);
    st.translate(sx * Math.sin(0.9) * (s.rx + 0.045), s.y + Math.cos(0.9) * (s.ry + 0.045), z);
    hard.push(skinPlain(st, body, 'brass', tackPaint));
  }
  // the saddle seat + skirts, pommel and cantle
  hard.push(wrapPatch(section, 0.14, 0.5, -0.95, 0.95, (u) => 0.03 + 0.035 * Math.sin(u * Math.PI) ** 0.5 + 0.05 * sstep(0.85, 1, u) + 0.03 * sstep(0.15, 0, u), 10, 16, onBody, 'saddle', tackPaint));
  const top = (z: number): number => { const s = section(z); return s.y + s.ry; };
  hard.push(tube([[0, top(0.5) + 0.03, 0.5], [0, top(0.53) + 0.1, 0.53], [0, top(0.55) + 0.13, 0.555]], 0.035, 0.022, body, 'saddle', tackPaint, 8));   // pommel horn
  hard.push(tube([[-0.12, top(0.16) + 0.06, 0.15], [0, top(0.13) + 0.1, 0.12], [0.12, top(0.16) + 0.06, 0.15]], 0.025, 0.025, body, 'saddle', tackPaint, 8));   // cantle
  // girth, stirrup leathers and the stirrups
  for (const sx of [1, -1]) {
    const s = section(0.38);
    hard.push(tube([[sx * s.rx * 0.93, s.y + 0.08, 0.36], [sx * (s.rx + 0.03), s.y - 0.15, 0.36], [sx * (s.rx + 0.05), s.y - 0.32, 0.36]], 0.012, 0.012, body, 'strap', tackPaint, 5));
    const sy = s.y - 0.34, sxx = sx * (s.rx + 0.06);
    hard.push(tube([[sxx, sy, 0.31], [sxx, sy - 0.1, 0.30], [sxx, sy - 0.13, 0.36], [sxx, sy - 0.1, 0.42], [sxx, sy, 0.41]], 0.009, 0.009, body, 'iron', tackPaint, 5));
  }
  hard.push(tube([[0.24, 1.0, 0.5], [0, 0.78, 0.5], [-0.24, 1.0, 0.5]], 0.02, 0.02, body, 'strap', tackPaint, 5));   // girth under the belly
  // the bridle: noseband, browband, cheekpieces, throatlatch; brass rosettes; reins looping back to the withers
  const ring = (cx: number, cy: number, cz: number, rx: number, ry: number, tiltX: number, bone: number, part: string, r: number): void => {
    const pts: V3[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const lx = Math.cos(a) * rx, ly = Math.sin(a) * ry;
      pts.push([cx + lx, cy + ly * Math.cos(tiltX), cz + ly * Math.sin(tiltX)]);
    }
    hard.push(tube(pts, r, r, bone, part, tackPaint, 5));
  };
  ring(0, 1.45, 1.43, 0.075, 0.08, 0.75, hd, 'strap', 0.011);    // noseband round the face
  ring(0, 1.76, 1.08, 0.105, 0.11, -0.2, hd, 'strap', 0.011);    // headpiece / throatlatch behind the ears
  hard.push(tube([[-0.1, 1.80, 1.14], [0, 1.83, 1.16], [0.1, 1.80, 1.14]], 0.01, 0.01, hd, 'strap', tackPaint, 5));   // browband
  for (const sx of [1, -1]) {
    hard.push(tube([[sx * 0.1, 1.76, 1.12], [sx * 0.095, 1.62, 1.28], [sx * 0.075, 1.46, 1.43]], 0.011, 0.011, hd, 'strap', tackPaint, 5));   // cheekpiece
    const ros = new THREE.SphereGeometry(0.018, 8, 6); ros.scale(0.5, 1, 1); ros.translate(sx * 0.1, 1.79, 1.13);
    hard.push(skinPlain(ros, hd, 'brass', tackPaint));
    const bit = new THREE.TorusGeometry(0.022, 0.005, 5, 10); bit.rotateY(Math.PI / 2); bit.translate(sx * 0.07, 1.39, 1.47);
    hard.push(skinPlain(bit, hd, 'iron', tackPaint));
    // reins: from the bit down in a loop and back up to the pommel (skinned head → neck → body so they follow)
    const rs: V3[] = [[sx * 0.075, 1.39, 1.47], [sx * 0.11, 1.25, 1.3], [sx * 0.16, 1.18, 1.0], [sx * 0.2, 1.3, 0.72], [sx * 0.08, 1.52, 0.56]];
    const bones = [hd, n2, n1, body, body];
    rs.forEach((p, i) => { const q = rs[i + 1]; if (q !== undefined) hard.push(tube([p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - 0.03, (p[2] + q[2]) / 2], q], 0.008, 0.008, bones[i] ?? body, 'strap', tackPaint, 4)); });
  }
}

// ── the horse's own motion (SpeciesDef.postPose) ───────────────────────────────────────────────────────────────────

const decayKnob = (m: Record<string, number>, k: string, dt: number, rate: number): number => {
  const v = m[k] ?? 0;
  if (v > 0) m[k] = Math.max(0, v - dt * rate);
  return v;
};

function horsePostPose(c: RigAnimCtx): void {
  const b = c.bones, m = c.mem;
  const body = b['body'], n1 = b['neck1'], n2 = b['neck2'], head = b['head'], m1 = b['mane1'], m2 = b['mane2'];
  const t1 = b['tail'], t2 = b['tail2'], t3 = b['tail3'];
  if (body === undefined || n1 === undefined || n2 === undefined || head === undefined || m1 === undefined || m2 === undefined || t1 === undefined || t2 === undefined || t3 === undefined) return;
  const dt = c.dt;
  // eased knobs
  const ez = (k: string, target: number, rate: number): number => { const cur = m[`_${k}`] ?? 0; const v = cur + (target - cur) * Math.min(1, dt * rate); m[`_${k}`] = v; return v; };
  const alive = c.alive;
  const rear = smooth01(ez('rear', alive ? clamp(m['rear'] ?? 0, 0, 1) : 0, 3.5));
  const buck = ez('buck', alive ? clamp(m['buck'] ?? 0, 0, 1) : 0, 5);
  const kick = alive ? bump(1 - clamp(decayKnob(m, 'kick', dt, 1.8), 0, 1), 0, 1) * ((m['kick'] ?? 0) > 0 ? 1 : 0) : 0;
  const stamp = alive ? bump(1 - clamp(decayKnob(m, 'stamp', dt, 2.5), 0, 1), 0, 1) * ((m['stamp'] ?? 0) > 0 ? 1 : 0) : 0;
  const toss = alive ? bump(1 - clamp(decayKnob(m, 'toss', dt, 2), 0, 1), 0, 1) * ((m['toss'] ?? 0) > 0 ? 1 : 0) : 0;
  const headUp = ez('headUp', alive ? clamp(m['headUp'] ?? 0, 0, 1) : 0, 3);
  const pin = ez('pin', alive ? clamp(m['pin'] ?? 0, 0, 1) : 0, 6);
  const speed = c.speed;
  const run = clamp((speed - 3) / 9, 0, 1);
  // Animal.ts rewrites the body bone's y every frame but never its z: keep the bind z and set z absolutely
  const bz = (m['_bz'] ??= body.position.z);
  body.position.z = bz;

  // rearing: pivot on the hind feet (raise the body bone so the hips stay put), forelegs fold, neck up
  if (rear > 0.001) {
    const th = rear * 0.78;
    body.rotation.x -= th;
    body.position.y += 0.6 * Math.sin(th);
    body.position.z = bz - 0.31 * (1 - Math.cos(th));
    n1.rotation.x -= 0.35 * rear; head.rotation.x += 0.25 * rear;
    for (const s of ['L', 'R'] as const) {
      const sh = b[`F${s}_shoulder`], ca = b[`F${s}_carpus`], fe = b[`F${s}_fetlock`], hp = b[`B${s}_hip`], stf = b[`B${s}_stifle`];
      const paw = s === 'L' ? Math.sin(c.t * 7) : Math.sin(c.t * 7 + 2);   // the forelegs paw the air
      if (sh !== undefined) sh.rotation.x -= (0.5 + 0.25 * paw) * rear;
      if (ca !== undefined) ca.rotation.x += 1.5 * rear;
      if (fe !== undefined) fe.rotation.x += 0.4 * rear;
      if (hp !== undefined) hp.rotation.x += th * 0.85;
      if (stf !== undefined) stf.rotation.x += 0.25 * rear;
    }
  }
  // bucking: the hind end thrown up, head down, a side twist
  if (buck > 0.001) {
    const ph = Math.sin(c.t * 6.5);
    const up = Math.max(0, ph) * buck;
    body.rotation.x += 0.4 * up - 0.1 * Math.max(0, -ph) * buck;
    body.rotation.z += 0.15 * (m['buckDir'] ?? 1) * up;
    body.position.y += 0.12 * Math.abs(ph) * buck;
    n1.rotation.x += 0.45 * up;
    for (const s of ['L', 'R'] as const) { const hp = b[`B${s}_hip`], stf = b[`B${s}_stifle`]; if (hp !== undefined) hp.rotation.x += 0.9 * up; if (stf !== undefined) stf.rotation.x -= 0.5 * up; }
  }
  // the hind kick: weight forward, both hind legs lash back
  if (kick > 0.001) {
    body.rotation.x += 0.3 * kick;
    n1.rotation.x += 0.4 * kick;
    for (const s of ['L', 'R'] as const) { const hp = b[`B${s}_hip`], hk = b[`B${s}_hock`]; if (hp !== undefined) hp.rotation.x += 1.2 * kick; if (hk !== undefined) hk.rotation.x -= 0.5 * kick; }
  }
  if (stamp > 0.001) { const sh = b['FR_shoulder'], ca = b['FR_carpus']; if (sh !== undefined) sh.rotation.x -= 0.5 * stamp; if (ca !== undefined) ca.rotation.x += stamp; }
  // grazing: the generic graze (pose.grazeNeck 0) only nods the head; a horse drops the whole neck from the withers and
  // tucks the head back toward vertical so the muzzle reaches the grass (solved offline for this rig: neck1 1.7, neck2 0.1,
  // head −1.2 in total)
  const graze = ez('graze', alive && c.state === 'graze' && c.speed < 0.3 ? 1 : 0, 2.2);
  if (graze > 0.001) { n1.rotation.x += 1.35 * graze; n2.rotation.x -= 0.1 * graze; head.rotation.x -= 1.55 * graze; }
  // head high + ears forward (watching); ears pinned (warning); a toss
  n1.rotation.x -= 0.28 * headUp + 0.35 * toss;
  n2.rotation.x -= 0.1 * headUp;
  head.rotation.x += 0.15 * headUp + 0.3 * toss;
  const eL = b['earL'], eR = b['earR'];
  if (eL !== undefined) eL.rotation.x += 1.2 * pin - 0.3 * headUp;
  if (eR !== undefined) eR.rotation.x += 1.2 * pin - 0.3 * headUp;
  // mane: falls to one side, swings with the stride, streams back at speed
  // (the locks fall to the right in the model; the bones lift them back and out at speed and swing them with the stride)
  // the steppe wind lifts the mane and the tail even standing (wildEnv.wind: the gusts' strength, which side it comes from)
  const w = wildEnv.wind, ws = w.strength * (1 - run);
  const across = w.x * Math.cos(c.yaw) - w.z * Math.sin(c.yaw);   // + = the wind blows toward the horse's left
  const gust = 0.6 + 0.4 * Math.sin(c.t * 0.9 + c.seed * 5) + 0.25 * Math.sin(c.t * 3.7 + c.seed);
  const swing = Math.sin(c.phase * Math.PI * 2 - 1.2) * (0.1 + 0.22 * run) + 0.05 * Math.sin(c.t * 1.7 + c.seed * 3) + 0.03 * Math.sin(c.t * 4.1 + c.seed)
    + ws * gust * (0.25 * across + 0.06 * Math.sin(c.t * 5.3 + c.seed * 2));
  m1.rotation.set(-0.35 * run - 0.1 * rear, 0, 0.25 * run + swing * 0.7);
  m2.rotation.set(-0.45 * run - 0.1 * rear, 0, 0.3 * run + swing);
  // tail: the dock lifts when running (Animal.ts' gallopTail), the hair lags and streams
  const lag = Math.sin(c.phase * Math.PI * 2 - 2.0);
  t2.rotation.set(-0.2 * run + 0.06 * lag * run + 0.3 * buck - 0.12 * ws * gust, 0, 0.1 * Math.sin(c.t * 1.1 + c.seed * 4) * (1 - run) + 0.08 * lag * run + 0.3 * ws * gust * across);
  t3.rotation.set(-0.35 * run + 0.08 * lag * run - 0.15 * ws * gust, 0, 0.14 * Math.sin(c.t * 1.1 - 0.8 + c.seed * 4) * (1 - run) + 0.1 * lag * run + 0.35 * ws * gust * across);
  void t1;
}

// ── rig API for riding (B7) ────────────────────────────────────────────────────────────────────────────────────────

export interface HorseBones {
  body: THREE.Bone; neck1: THREE.Bone; neck2: THREE.Bone; head: THREE.Bone; earL: THREE.Bone; earR: THREE.Bone;
  mane1: THREE.Bone; mane2: THREE.Bone; tail: THREE.Bone; tail2: THREE.Bone; tail3: THREE.Bone;
}

const boneCache = new WeakMap<Animal, HorseBones>();

/** the horse's named bones (cached); throws for a non-horse */
export function horseBones(a: Animal): HorseBones {
  const hit = boneCache.get(a);
  if (hit !== undefined) return hit;
  const get = (n: string): THREE.Bone => {
    const found = a.mesh.skeleton.getBoneByName(n);
    if (found === undefined) throw new Error(`horseBones: '${a.kind}' has no bone '${n}'`);
    return found;
  };
  const out: HorseBones = {
    body: get('body'), neck1: get('neck1'), neck2: get('neck2'), head: get('head'), earL: get('earL'), earR: get('earR'),
    mane1: get('mane1'), mane2: get('mane2'), tail: get('tail'), tail2: get('tail2'), tail3: get('tail3'),
  };
  boneCache.set(a, out);
  return out;
}

const SADDLE_LOCAL = new THREE.Vector3(0, 0.36, 0.28);   // on the spine, behind the withers (body-bone space, scale 1)
const EYE_LOCAL = new THREE.Vector3(0, 0.16, 0.0);       // between the ears (head-bone space)

/** the rider's seat, world space (follows the gait's bob and pitch; valid after the horse's update this frame) */
export function horseSaddle(a: Animal, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(SADDLE_LOCAL).applyMatrix4(horseBones(a).body.matrixWorld);
}
/** a point between the ears, world space */
export function horseEye(a: Animal, out: THREE.Vector3): THREE.Vector3 {
  return out.copy(EYE_LOCAL).applyMatrix4(horseBones(a).head.matrixWorld);
}

registerSpecies({
  kind: 'horse',
  label: 'Wild horse',
  fur: NO_FUR,
  aggressive: false,
  walkSpeed: HORSE_SPEED.walk,
  chargeSpeed: 12,
  chargeDamage: 25,
  sounds: { call: 'horse_neigh', hurt: 'horse_squeal', callEvery: [40, 120] },
  pose: { grazeNeck: 0, gallopTail: 0.55 },
  gait: { trot: 3.0, gallop: 6.4 },
  variants: [
    { id: 'bay', label: 'Bay mare', weight: 34, rarity: 'common', scale: [0.96, 1.03] },
    { id: 'chestnut', label: 'Chestnut mare', weight: 24, rarity: 'common', scale: [0.95, 1.02], tint: CHESTNUT, traits: { blaze: 1, socks: 1 } },
    { id: 'dun', label: 'Dun mare', weight: 14, rarity: 'common', scale: [0.95, 1.02], tint: DUN },
    { id: 'grey', label: 'Grey mare', weight: 10, rarity: 'uncommon', scale: [0.96, 1.03], tint: GREY, traits: { dapple: 1 } },
    { id: 'black', label: 'Black mare', weight: 8, rarity: 'uncommon', scale: [0.96, 1.03], tint: BLACK },
    { id: 'foal-bay', label: 'Foal', weight: 0, rarity: 'common', scale: [0.6, 0.64], hp: 70, tint: FOAL_BAY, traits: { foal: 1, mane: 0.6 } },
    { id: 'foal-chestnut', label: 'Foal', weight: 0, rarity: 'common', scale: [0.6, 0.64], hp: 70, tint: FOAL_CHESTNUT, traits: { foal: 1, mane: 0.6 } },
    {
      id: 'camp-bay', label: 'Camp horse', weight: 0, rarity: 'common', scale: [1.0, 1.0], traits: { tack: 1 },
    },
    { id: 'tulpar', label: 'Tulpar', weight: 0, rarity: 'rare', scale: [1.08, 1.08], hp: 150, tint: BLACK, traits: { tack: 1, mane: 1.7, stallion: 1 } },
    { id: 'camp-black', label: 'Camp horse', weight: 0, rarity: 'common', scale: [1.02, 1.02], tint: BLACK, traits: { tack: 1, blaze: 1, mane: 1.3 } },
    {
      id: 'stallion', label: 'Black stallion', weight: 0, rarity: 'rare', scale: [1.08, 1.08], hp: 150, tint: BLACK,
      traits: { mane: 1.7, stallion: 1 }, mods: { chargeDamage: 25 },
    },
  ],
  tuning: {
    hp: 150, sightRange: 45, sightRangeGraze: 20, sightCone: THREE.MathUtils.degToRad(70),
    hearStill: 4, hearCrouch: 8, hearWalk: 15, hearSprint: 30,
    noticeRate: 0.4, forgetRate: 0.2, alertAt: 0.45, boltAt: 1, freezeMin: 2, freezeMax: 4, relaxAfter: 4, panicDist: 10,
    runSpeed: 12.5, trotSpeed: 4.5, fleeMinTime: 3, fleeUntil: 80, fleeUntilMax: 120, fleeMaxTime: 14, lookBack: 3,
    waryTime: 20, waryBoost: 1.3, herdAlertRadius: 20, herdBoltDelayMin: 0.2, herdBoltDelayMax: 0.8, impactSpook: 15, impactAlert: 40,
  },
  build: buildHorse,
  postPose: horsePostPose,
  think: thinkHorse,
  damageMul: horseDamageMul,
});
