import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { registerSpecies, type AnimalSpecies, type BoneDef, type VariantDef, type RigAnimCtx } from './registry';
import { loft, skinPlain, S, boneIndex, mix, sstep, paletteColors, type Station, type RGB, type Paint } from './loft';
import { NO_FUR, smooth01, bump, clamp } from './rigs';
import { thinkHorse, horseDamageMul } from '../Herd';
import type { Animal } from '../Animal';

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

const HORSE = {
  coat: [0.50, 0.27, 0.14], belly: [0.60, 0.38, 0.22], points: [0.07, 0.055, 0.05], mane: [0.07, 0.055, 0.05],
  muzzle: [0.22, 0.15, 0.12], sock: [0.92, 0.90, 0.85], hoof: [0.20, 0.17, 0.15], eye: [0.04, 0.03, 0.025],
  earIn: [0.30, 0.20, 0.16], dorsal: [0.07, 0.055, 0.05],
} satisfies Record<string, RGB>;

const CHESTNUT: Record<string, RGB> = { coat: [0.62, 0.32, 0.14], belly: [0.70, 0.42, 0.22], points: [0.58, 0.30, 0.13], mane: [0.78, 0.52, 0.28], muzzle: [0.40, 0.24, 0.15], dorsal: [0.62, 0.32, 0.14] };
const BLACK: Record<string, RGB> = { coat: [0.13, 0.12, 0.125], belly: [0.16, 0.145, 0.14], points: [0.06, 0.055, 0.058], mane: [0.045, 0.04, 0.045], muzzle: [0.14, 0.12, 0.12], earIn: [0.10, 0.08, 0.08], dorsal: [0.13, 0.12, 0.125] };
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
      case 'body':
        out.copy(P.coat);
        mix(out, out, P.belly, sstep(-0.3, -0.85, ny) * 0.8);
        mix(out, out, P.dorsal, sstep(0.9, 0.98, ny) * sstep(0.05, 0.02, Math.abs(x)));
        if (dappled) mix(out, out, P.points, sstep(0.55, 0.85, Math.sin(x * 23 + z * 7) * Math.sin(z * 19 - y * 11)) * 0.25 * sstep(0.2, -0.3, ny));
        break;
      case 'neck': out.copy(P.coat); mix(out, out, P.belly, sstep(-0.4, -0.9, ny) * 0.4); break;
      case 'head':
        out.copy(P.coat);
        mix(out, out, P.muzzle, sstep(0.72, 0.9, t));
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
  fur.push(loft([
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
  ], 24, 'body', paint));
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
    const h = (foal ? 0.035 : 0.085) * maneK * (i === 1 ? 0.7 : 1);
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
  fur.push(loft([
    S(0, 1.80, 1.11, 0.03, 0.02, hd),
    S(0, 1.78, 1.16, 0.04, 0.02, hd),
    S(0, 1.72, 1.20, 0.028 * maneK, 0.014, hd),
    S(0, 1.68, 1.215, 0.008, 0.006, hd),
  ], 6, 'mane', paint, true, true, 'z'));
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
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 1.10, bodyHalfLen: 0.78, bodyRadius: 0.30, headRadius: 0.2, legLen: 1.08, feet: [...feetF, ...feetB], halfWidth: 0.27 },
  };
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
  const bz = m['_bz'] ?? (m['_bz'] = body.position.z);
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
  const side = (c.seed * 10) % 2 < 1 ? 1 : -1;
  const swing = Math.sin(c.phase * Math.PI * 2 - 1.2) * (0.12 + 0.25 * run) + 0.04 * Math.sin(c.t * 1.7 + c.seed * 3);
  m1.rotation.set(-0.5 * run - 0.1 * rear, 0, side * (0.22 - 0.12 * run) + swing * 0.7);
  m2.rotation.set(-0.6 * run - 0.1 * rear, 0, side * (0.25 - 0.14 * run) + swing);
  // tail: the dock lifts when running (Animal.ts' gallopTail), the hair lags and streams
  const lag = Math.sin(c.phase * Math.PI * 2 - 2.0);
  t2.rotation.set(-0.2 * run + 0.06 * lag * run + 0.3 * buck, 0, 0.1 * Math.sin(c.t * 1.1 + c.seed * 4) * (1 - run) + 0.08 * lag * run);
  t3.rotation.set(-0.35 * run + 0.08 * lag * run, 0, 0.14 * Math.sin(c.t * 1.1 - 0.8 + c.seed * 4) * (1 - run) + 0.1 * lag * run);
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
