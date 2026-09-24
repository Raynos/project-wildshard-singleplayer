import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from './Player';
import type { Forest } from '../world/Forest';
import { painterlyMaterial } from '../world/painterly';
import { wind as worldWind } from '../world/steppeWind';
import { getSetting, setSetting } from '../ui/Settings';
import { fovForAspect, FOV_HIP, FOV_ADS, type ImpactSurface, type Targets, type TargetHit } from './Crossbow';
import { Projectiles, type ProjectileKind, type WindField } from './Projectiles';
import { gloveFist, riderArm, placeArm } from './nalatiArms';
import type { Weapon } from './Weapon';

/**
 * Bow — Nalati's composite recurve (horn-and-sinew, style-B painterly), the shard's main weapon (NALATI.md B2,
 * design: docs/design/nalati/combat.md §C). A `Weapon` (Weapon.ts) with the optional kit hooks (`holster`, `aimRay`,
 * `inputAllowed`, `charge`) so `Weapons.ts` can hold it like the crossbow.
 *
 *   const bow = new Bow({ game, sky, player, forest }, targets, { allowUnlocked: nolock });
 *   game.onUpdate((dt, t) => bow.update(dt, t));          // AFTER player.update (the Weapons manager does this)
 *   bow.wind                                               // src/world/Wind.ts's `wind` by default — arrows (and the arc) drift in it
 *
 * REGISTERING IT (for whoever owns the Nalati kit in Weapons.ts / main.ts — the melee-agent, B3):
 *   - `Weapons.ts`: `'bow'` in `WeaponId`; the HUD strip comes from the Bow's own `ammoLabel` ('Arrows'), `segments` (4)
 *     and `magazine` (QUIVER_MAX) through BaseLike's overrides.
 *   - `main.ts` (Nalati only): `const bow = new Bow({ game, sky, player, forest }, targets, { allowUnlocked: nolock })`
 *     as the kit's base weapon (`new Weapons(bow, rifle, [sabre, spear])` or however the 3-slot kit is built), with
 *     `new BaseWeapon(bow, 'bow', 'Bow')`. Hooks arrive through the manager like the crossbow's: `onFire` (the loose —
 *     `audio.crossbowFire()` until a bow twang exists), `onImpact(surface, point)` (`audio.boltImpact`), `onHit`,
 *     `onDry` (quiver empty). Bow-only extras, wired on the instance: `onDrawStart`, `onRecover(survived)` (toast
 *     "Arrow recovered" / "Arrow broke" + `audio.hitMarker()`), `onLetDown`.
 *   - The respawn refill already works: `addBolts(n)` tops the quiver up.
 *   - TouchControls: the ranged AIM disc is the bow's DRAW (a latch on `weapons.adsHeld`); relabel it "Draw" while the bow
 *     is held and paint its ring from `weapons.current.charge` (the draw, 0..1) like the HEAVY disc. Nothing else changes:
 *     a tap on LOOK = `tryFire()` = loose (latched) or a snap shot (not latched).
 *   - The pause-menu switch: `sw('huntersEye', "Hunter's eye")` in Menu.ts's Gameplay list (Settings key `huntersEye`,
 *     default ON on touch, OFF with a mouse; `?arc=1` / `?arc=0` writes it once at load).
 *
 * Input (only while `inputAllowed()`):
 *   desktop  hold LMB = draw, release = loose; RMB toggles STEADY (1.3× zoom, sway × 0.4, spread × 0.5, like the crossbow's
 *            ADS toggle); F = snap shot.
 *   touch    the DRAW latch (`adsHeld`, the AIM disc): latched → the bow draws to full and holds; a tap on the LOOK pad
 *            (`tryFire`) looses; still latched → it re-nocks and draws again. Unlatching lets the draw down (no shot).
 *            Not latched, a LOOK tap is a SNAP shot: auto-draw to 60 % and loose (the "I'm in trouble" shot).
 *   Loosing under 25 % draw is a let-down (no arrow spent). Held at full: steady 2.5 s, then the aim sways (± 1.5° by 4 s),
 *   then the arms tire and the bow lets down for a second.
 *
 * Numbers (combat.md §C): full draw 0.75 s (ease-out) × 1/`drawSpeedScale`; speed 30 + 28·p m/s; drag 0.015; gravity 5
 * (half real — the arc reads); wind drift 0.25 /s sideways; damage = the animal's own bolt model (32–40, falloff, ×2.5
 * head) × 1.2 × (0.35 + 0.65·p) × `damageMultiplier(hit)` → 40–48 body at full draw. Quiver QUIVER_MAX; stuck arrows are
 * picked up by walking over them, 70 % survive.
 *
 * The drop arc ("Hunter's eye"): while drawing, a faint dotted cyan arc of the arrow's real path (same integrator, wind
 * included) and a landing ring on the ground. Setting `huntersEye`; `arcAllowed = false` hides it whatever the setting
 * (mounted: the ring reticle only).
 *
 * FROM THE SADDLE (B7, `Mount`): `bow.setMount({ speed, yaw } | null)` every frame (nalatiKit.setMount does) — it keeps its
 * own share and composes with the public knobs below (which other systems — the Golden Bow — also set):
 *   `drawSpeedScale`   0.75 / 0.9 ≈ 0.83 mounted (0.9 s draw), less again for the Parthian shot
 *   `extraSpreadDeg`   the gait's cone (walk 0.8 … trot 3.0), halved on the gallop's float
 *   `carrierVelocity`  the horse's world velocity — added to every arrow (and to the arc preview)
 *   `arcAllowed`       false while mounted
 *   `damageMultiplier` (hit) => … — the sneak shot from HIDDEN (×2), the Parthian stagger, the pass bonus
 * The aim is the CAMERA's forward (`aimRay`), never the body's: the rider's head turns ±170° off the horse's heading and
 * the arrow goes where the head looks. The viewmodel hangs off the camera, so it follows the head too.
 *
 * The viewmodel (mockups art/nalati-grasslands/round-2/1-combat/combat-C-bow-foot.png, combat-A-horse-archery.png; the look
 * round-1/1-art-style/style-B-painterly.png): a horn-and-sinew recurve with bone siyahs and sinew bindings, a painted
 * ornament on the belly, the left fist in a leather glove round the grip, both forearms in cream wool sleeves with a red
 * ram's-horn band and a fur cuff, the right hand hooking the string with a thumb ring. All of it is ONE painterly
 * material (vertex colours, `painterly.ts`), five draw calls: the bow + left fist (limbs and string rewritten on the CPU
 * while the draw changes), the arrow on the string, the right hand, and the two sleeves. The world's arrows are one
 * InstancedMesh (Projectiles.ts).
 */

export const QUIVER_MAX = 24;
const DRAW_TIME = 0.75;          // s to full draw on foot
const MIN_LOOSE = 0.25;          // below this a release is a let-down
const HOLD_STEADY = 2.5, HOLD_TIRE = 4.0, TIRED_TIME = 1.1, SWAY_MAX = THREE.MathUtils.degToRad(1.5);
const RENOCK_TIME = 0.62;        // s from a loose to the next arrow on the string: follow-through, down to the quiver, back up with an arrow
const SNAP_P = 0.6, SNAP_DELAY = 0.35;
const SPEED_BASE = 30, SPEED_DRAW = 28;
const DAMAGE_SCALE = 1.2;        // × the bolt model's 32–40 → 38–48 at full draw
const LETDOWN_RATE = 3.2;        // /s of draw time when the draw is let down
const ARC_MAX = 56, ARC_SPACING = 0.8, ARC_SKIP = 0.5, ARC_BLEND = 11, ARC_CYAN = 0x8fe3ff;
const Q_ARC_PARAM = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('arc');
if (Q_ARC_PARAM !== null) setSetting('huntersEye', Q_ARC_PARAM !== '0');

export interface BowWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface BowOptions { allowUnlocked?: boolean }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ───────────────────────────── palette (sRGB hex → linear via THREE.Color) ─────────────────────────────

const C = (hex: number) => new THREE.Color(hex);
const PAL = {
  lacquer: C(0x7a3a1c), lacquerDark: C(0x4a2412), ornament: C(0xe0c080), birch: C(0x9a7650), horn: C(0x2a1a10),
  bone: C(0xe6dcc2), boneDark: C(0x5a4a38), sinew: C(0xd8c8a0), leather: C(0x3c2414), leatherHi: C(0x5a3a22),
  string: C(0xd4c8a8), serving: C(0x4a3424), hornHoney: C(0x9a6a34), birchBark: C(0xd8bc92), lenticel: C(0x4a3424), gold: C(0xe0b864),
  shaft: C(0xc8a070), shaftDark: C(0x8a6440), head: C(0x3a3c40), feather: C(0xece6da), featherBar: C(0x4a3a30),
  crest: C(0xa82a1c),
};

// ───────────────────────────── geometry helpers ─────────────────────────────

/** keep only position / normal / colour (so different generators merge) */
function pnc(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}
/** paint a geometry one colour × a seeded per-vertex jitter */
function paint(g: THREE.BufferGeometry, c: THREE.Color, jitter = 0.06, seed = 7): THREE.BufferGeometry {
  const n = g.getAttribute('position').count, out = new Float32Array(n * 3);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const k = 1 - jitter + (s / 4294967296) * jitter * 2;
    out[i * 3] = c.r * k; out[i * 3 + 1] = c.g * k; out[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return pnc(g);
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The arrow: birch shaft with a red cresting band, iron leaf head, three barred feathers. TIP at the origin, shaft
 *  along +Z (`ARROW_LEN`), so a stuck one is placed at the hit point. Feathers are two-faced (no DoubleSide program). */
export const ARROW_LEN = 0.8;
export function buildArrowGeometry(): THREE.BufferGeometry {
  const L = ARROW_LEN, r = 0.0042;
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(r, r * 0.92, L - 0.07, 6, 1); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 0.065 + (L - 0.07) / 2);
  parts.push(paint(shaft, PAL.shaft, 0.08, 11));
  const crest = new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.05, 6, 1); crest.rotateX(Math.PI / 2); crest.translate(0, 0, L - 0.2);
  parts.push(paint(crest, PAL.crest, 0.05, 12));
  const nock = new THREE.CylinderGeometry(r * 0.9, r * 1.1, 0.014, 6, 1); nock.rotateX(Math.PI / 2); nock.translate(0, 0, L - 0.004);
  parts.push(paint(nock, PAL.shaftDark, 0.04, 13));
  // leaf head: a flattened 4-sided cone + its socket
  const head = new THREE.ConeGeometry(0.011, 0.058, 4, 1); head.rotateY(Math.PI / 4); head.scale(1, 1, 0.3); head.rotateX(-Math.PI / 2); head.translate(0, 0, 0.029);
  parts.push(paint(head, PAL.head, 0.08, 14));
  const socket = new THREE.CylinderGeometry(r * 1.05, r * 1.25, 0.018, 6, 1); socket.rotateX(Math.PI / 2); socket.translate(0, 0, 0.064);
  parts.push(paint(socket, PAL.head, 0.05, 15));
  // three feathers, each a two-faced swept blade with a dark bar
  for (let k = 0; k < 3; k++) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const seg = 6, z0 = L - 0.035, len = 0.13;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, z = z0 - t * len;
      const h = 0.017 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (1 - 0.35 * t * t); // tall at the back, tapering forward
      const bar = t > 0.45 && t < 0.62 ? 1 : 0;
      const c = bar ? PAL.featherBar : PAL.feather;
      pos.push(0, r, z, 0, r + h, z - 0.012 * t);
      col.push(c.r * 0.92, c.g * 0.92, c.b * 0.92, c.r, c.g, c.b);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3, a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    g.rotateZ((k / 3) * Math.PI * 2);
    parts.push(g);
  }
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

/** the arrow as a `Projectiles` kind (the world pool) — combat.md §C numbers */
export function arrowKind(sky: Sky): ProjectileKind {
  return {
    geometry: buildArrowGeometry(), material: painterlyMaterial(sky, { rim: 0.45 }),
    length: ARROW_LEN, gravity: 5, drag: 0.015, windCoupling: 0.25, bury: 0.09, recover: 0.7, maxFlying: 8, maxStuck: 64,
  };
}

// ───────────────────────────── the bow's shape ─────────────────────────────

const _b1 = new THREE.Vector3(), _b2 = new THREE.Vector3(), _b3 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

/* Bow-local frame: grip centre at the origin, +Y up the bow, −Z = where the arrow flies (the bow's back), +Z toward the
 * archer (the belly), +X the archer's right (the arrow rides on the right: a thumb draw). Each limb is the grip, a
 * working limb bending at curvature κ(p) toward the archer, then the stiff siyah (ear) kinked forward by SIYAH_KINK. */
const GRIP_H = 0.07, LIMB_W = 0.42, SIYAH = 0.15, SIYAH_KINK = 0.95;
const KAPPA_REST = 2.1, KAPPA_DRAW = 1.35;
const BRACE_Z = 0.163, DRAW_LEN = 0.58; // string at rest / pulled back at full draw (bow-local)
const ARROW_X = 0.02, ARROW_Y = 0.058; // the arrow's line past the grip: on top of the left thumb, right of the bow (a thumb draw)
const BOW_LEN = GRIP_H + LIMB_W + SIYAH;
const RADIAL = 16, STRING_RADIAL = 6, STRING_R = 0.0021;
/** each string leg: tip → the serving's start (two rings a hair apart: a crisp colour change) → the nock */
const STRING_RINGS = 4, SERVING = 0.085;

/** the limb centreline at arc length u (≥ 0) from the grip, for draw p; sign +1 upper, −1 lower. Writes pos + tangent. */
function limbAt(u: number, sign: number, p: number, pos: THREE.Vector3, tan: THREE.Vector3): void {
  const k = KAPPA_REST + KAPPA_DRAW * p;
  if (u <= GRIP_H) { pos.set(0, sign * u, 0); tan.set(0, sign, 0); return; }
  const w = Math.min(u - GRIP_H, LIMB_W);
  const th = k * w;
  let y = GRIP_H + Math.sin(th) / k, z = (1 - Math.cos(th)) / k;
  let a = th;
  if (u > GRIP_H + LIMB_W) {
    a = k * LIMB_W - SIYAH_KINK;
    const s = u - GRIP_H - LIMB_W;
    y += Math.cos(a) * s; z += Math.sin(a) * s;
  }
  pos.set(0, sign * y, z); tan.set(0, sign * Math.cos(a), Math.sin(a));
}
/** half width (x) and half thickness (belly-back) at u */
function limbSection(u: number): [number, number] {
  if (u <= GRIP_H) { const g = 1 - (u / GRIP_H) ** 2; return [0.016 + 0.002 * g, 0.018 + 0.006 * g]; }
  const w = u - GRIP_H;
  const bind = binding(w) ? 0.0013 : 0;                                         // sinew cord stands proud
  if (w <= LIMB_W) { const t = w / LIMB_W; return [0.019 - 0.006 * t + bind, 0.013 - 0.004 * t + bind]; }
  const t = (w - LIMB_W) / SIYAH;
  const bridge = 0.0045 * Math.exp(-(((t - 0.1) / 0.07) ** 2));               // the string bridge on the ear's belly
  return [0.011 - 0.003 * t, 0.015 - 0.004 * t + bridge];
}
/** the sinew bindings: where the grip meets the limb, and where the limb meets the bone ear */
function binding(w: number): boolean { return (w > 0 && w < 0.018) || Math.abs(w - LIMB_W) < 0.014; }
/** the leather grip's spiral wrap, as a radius multiplier */
function gripRidge(u: number, ph: number, sign: number): number { return u < GRIP_H ? 1 + 0.07 * Math.max(0, Math.sin(u * 280 * sign + ph * 2)) ** 3 : 1; }
/** build-time value noise for the painted grain */
function grain(x: number, y: number): number { const h = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); }; const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf); return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv; }
function mix3(out: number[], a: THREE.Color, b: THREE.Color, t: number, k = 1): void { out.push((a.r + (b.r - a.r) * t) * k, (a.g + (b.g - a.g) * t) * k, (a.b + (b.b - a.b) * t) * k); }
/** the painted colour at arc length u, ring angle φ (sin φ > 0 = belly, toward the archer) */
/** the colours the limbs + string are painted from (`Bow.setStyle` swaps the set and repaints) */
interface LimbPalette { leather: THREE.Color; leatherHi: THREE.Color; sinew: THREE.Color; bone: THREE.Color; boneDark: THREE.Color; birchBark: THREE.Color; lenticel: THREE.Color; lacquer: THREE.Color; gold: THREE.Color; horn: THREE.Color; hornHoney: THREE.Color; ornament: THREE.Color; string: THREE.Color; serving: THREE.Color }
export type BowStyle = 'recurve' | 'golden' | 'sky-wolf';
const LIMB_STYLES: Record<BowStyle, LimbPalette> = {
  recurve: { leather: PAL.leather, leatherHi: PAL.leatherHi, sinew: PAL.sinew, bone: PAL.bone, boneDark: PAL.boneDark, birchBark: PAL.birchBark, lenticel: PAL.lenticel, lacquer: PAL.lacquer, gold: PAL.gold, horn: PAL.horn, hornHoney: PAL.hornHoney, ornament: PAL.ornament, string: PAL.string, serving: PAL.serving },
  // the Golden Bow (the Golden King's reward, src/player/GoldenBow.ts): gold-sheathed limbs, the scroll burnished bright
  // (a touch over 1: it catches the bloom), ivory ears, a string of light
  golden: {
    leather: PAL.leather, leatherHi: PAL.leatherHi, sinew: C(0xf0c060), bone: C(0xf4e6c0), boneDark: C(0x8a6a30),
    birchBark: C(0xc8902a), lenticel: C(0x6a4410), lacquer: C(0xb87818), gold: new THREE.Color(1.6, 1.2, 0.5),
    horn: C(0x8a5210), hornHoney: C(0xe0a030), ornament: new THREE.Color(1.5, 1.15, 0.45),
    string: new THREE.Color(3.2, 2.6, 1.3), serving: C(0xd8a040),
  },
  // the SKY-WOLF skin (Kokbori's drop, B15 src/player/nalatiSkins.ts): blue-grey horn limbs, wolf-bone ears, a silver string
  'sky-wolf': {
    leather: C(0x2e3440), leatherHi: C(0x56606e), sinew: C(0xb8c4d0), bone: C(0xe6ecf2), boneDark: C(0x6a7684),
    birchBark: C(0x7c8a9a), lenticel: C(0x3a4452), lacquer: C(0x4a5a6e), gold: C(0xc8d4e0),
    horn: C(0x3c4a5c), hornHoney: C(0x8a9cb2), ornament: C(0xd8e4f0),
    string: new THREE.Color(1.6, 1.7, 1.9), serving: C(0x9aa6b4),
  },
};
let LIMB: LimbPalette = LIMB_STYLES.recurve;

function limbColor(out: number[], u: number, phi: number, sign: number): void {
  const belly = Math.sin(phi);
  const w = u - GRIP_H;
  if (u <= GRIP_H) { // leather grip, spiral-wrapped: the ridge catches light, the groove is dark
    const wrap = Math.max(0, Math.sin(u * 280 * sign + phi * 2)) ** 3;
    mix3(out, LIMB.leather, LIMB.leatherHi, 0.15 + wrap * 0.75, 0.85 + 0.15 * wrap); return;
  }
  if (binding(w)) { // sinew cord: tight turns, pale where they bulge
    const b = Math.max(0, Math.sin(u * 1500 * sign + phi)) ** 2;
    mix3(out, LIMB.sinew, LIMB.bone, b * 0.5, 0.78 + 0.22 * b); return;
  }
  if (w > LIMB_W) { // bone ear: warm cream with grain, the nock groove dark at the tip, the bridge a shade darker
    const t = (w - LIMB_W) / SIYAH, g = grain(u * 90, phi * 2);
    const tip = u > BOW_LEN - 0.018 ? 0.85 : 0;
    mix3(out, LIMB.bone, LIMB.boneDark, Math.max(tip, 0.12 * g + 0.25 * Math.exp(-(((t - 0.1) / 0.07) ** 2)) * Math.max(0, belly)));
    return;
  }
  const t = w / LIMB_W;
  if (belly < -0.38) { // the back: birch bark, pale, with dark lenticel dashes across the limb
    const len = grain(u * 170, phi * 1.5 + sign * 7);
    const dash = len > 0.78 ? 1 : 0;
    mix3(out, LIMB.birchBark, LIMB.lenticel, dash * 0.85 + 0.12 * grain(u * 30, phi), 0.92 + 0.08 * grain(u * 60, 3));
    return;
  }
  if (belly < 0.38) { // the sides: sinew under red-brown lacquer, a thin gold rule along the belly edge
    const rule = Math.abs(belly - 0.3) < 0.09 ? 1 : 0;
    mix3(out, LIMB.lacquer, LIMB.gold, rule * 0.85, 0.9 + 0.1 * grain(u * 40, phi * 3)); return;
  }
  // the belly: horn — honey and near-black streaks running along the limb — with the painted ram's-horn scroll near
  // the grip and a fine centre line out to the ear
  const streak = 0.5 + 0.5 * Math.sin(u * 60 + 3 * Math.sin(u * 9 + sign) + phi * 3);
  let orn = 0;
  if (t > 0.05 && t < 0.42) {
    const sAl = (t - 0.05) / 0.37;                       // 0..1 along the ornament
    const across = (Math.cos(phi) / 0.92) * 0.5 + 0.5;  // 0..1 across the belly
    const curl = 0.5 + 0.3 * Math.sin(sAl * Math.PI * 3.2);
    orn = Math.max(0, 1 - Math.abs(across - curl) * 5) * (sAl < 0.95 ? 1 : 0);
    const bay = Math.hypot((across - (curl > 0.5 ? 0.22 : 0.78)) * 1.4, ((sAl * 3.2 * 0.5) % 1) - 0.5);
    orn = Math.max(orn, bay < 0.16 ? 0.9 : 0);          // a dot in each bay of the scroll
    if (sAl < 0.04 || sAl > 0.92) orn = Math.max(orn, 0.95); // border bars
  } else if (t >= 0.42 && t < 0.97) orn = Math.max(0, 1 - Math.abs(Math.cos(phi)) * 5) * 0.75;
  const hornR = LIMB.horn.r + (LIMB.hornHoney.r - LIMB.horn.r) * streak, hornG = LIMB.horn.g + (LIMB.hornHoney.g - LIMB.horn.g) * streak, hornB = LIMB.horn.b + (LIMB.hornHoney.b - LIMB.horn.b) * streak;
  const o = Math.min(1, orn);
  out.push(hornR + (LIMB.ornament.r - hornR) * o, hornG + (LIMB.ornament.g - hornG) * o, hornB + (LIMB.ornament.b - hornB) * o);
}

/** The bow + the left fist: one geometry. The first `dynVerts` vertices (limbs + string) are rewritten by `shape(p)`. */
class BowMesh {
  readonly geometry = new THREE.BufferGeometry();
  readonly dynVerts: number;
  /** upper / lower string anchor (just inside the tips), the nock — bow-local, refreshed by `shape` */
  readonly tipTop = new THREE.Vector3(); readonly tipBot = new THREE.Vector3(); readonly nock = new THREE.Vector3();
  private readonly ringU: number[] = [];
  private readonly ringSign: number[] = [];
  private readonly pos: Float32Array; private readonly nrm: Float32Array;
  private readonly posAttr: THREE.BufferAttribute; private readonly nrmAttr: THREE.BufferAttribute;
  private readonly limbVerts: number;
  private lastP = -1; private lastNock = -1;

  constructor(staticParts: THREE.BufferGeometry[]) {
    // rings from the lower tip to the upper tip (signed arc length); denser where the ornament is
    for (const sign of [-1, 1]) {
      const us: number[] = [];
      for (let u = 0; u <= BOW_LEN + 1e-6; u += u < GRIP_H ? 0.01 : u < GRIP_H + LIMB_W * 0.45 ? 0.0045 : u < GRIP_H + LIMB_W ? 0.008 : 0.01) us.push(Math.min(u, BOW_LEN));
      if ((us[us.length - 1] ?? 0) < BOW_LEN) us.push(BOW_LEN);
      if (sign < 0) { for (let i = us.length - 1; i >= 1; i--) { this.ringU.push(us[i] ?? 0); this.ringSign.push(-1); } }
      else for (const u of us) { this.ringU.push(u); this.ringSign.push(1); }
    }
    const rings = this.ringU.length;
    this.limbVerts = rings * (RADIAL + 1) + 2; // + the two tip caps
    const stringVerts = 2 * STRING_RINGS * STRING_RADIAL;
    this.dynVerts = this.limbVerts + stringVerts;
    // static parts appended after the dynamic range
    const stat = mergeGeometries(staticParts, false);
    const statVerts = stat.getAttribute('position').count;
    const total = this.dynVerts + statVerts;
    this.pos = new Float32Array(total * 3); this.nrm = new Float32Array(total * 3);
    const col: number[] = [];
    const idx: number[] = [];
    // limb colours + indices
    for (let r = 0; r < rings; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      for (let k = 0; k <= RADIAL; k++) limbColor(col, u, (k / RADIAL) * Math.PI * 2, sign);
    }
    mix3(col, LIMB.boneDark, LIMB.boneDark, 0); mix3(col, LIMB.boneDark, LIMB.boneDark, 0); // caps
    for (let r = 0; r < rings - 1; r++) for (let k = 0; k < RADIAL; k++) {
      const a = r * (RADIAL + 1) + k, b = a + RADIAL + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const capBot = rings * (RADIAL + 1), capTop = capBot + 1, lastRing = (rings - 1) * (RADIAL + 1);
    for (let k = 0; k < RADIAL; k++) { idx.push(capBot, k + 1, k); idx.push(capTop, lastRing + k, lastRing + k + 1); }
    // string: two legs × STRING_RINGS rings — linen from the tips, a dark serving over the last SERVING m to the nock
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS; ring++) for (let k = 0; k < STRING_RADIAL; k++) {
      const serv = ring >= 2;
      mix3(col, serv ? LIMB.serving : LIMB.string, serv ? LIMB.serving : LIMB.string, 0, 0.9 + 0.1 * (k % 2));
    }
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS - 1; ring++) {
      const o = this.limbVerts + (leg * STRING_RINGS + ring) * STRING_RADIAL;
      for (let k = 0; k < STRING_RADIAL; k++) {
        const a = o + k, a1 = o + ((k + 1) % STRING_RADIAL), b = a + STRING_RADIAL, b1 = a1 + STRING_RADIAL;
        idx.push(a, a1, b, a1, b1, b);
      }
    }
    // static
    const sp = stat.getAttribute('position'), sn = stat.getAttribute('normal'), sc = stat.getAttribute('color');
    for (let i = 0; i < statVerts; i++) {
      const j = (this.dynVerts + i) * 3;
      this.pos[j] = sp.getX(i); this.pos[j + 1] = sp.getY(i); this.pos[j + 2] = sp.getZ(i);
      this.nrm[j] = sn.getX(i); this.nrm[j + 1] = sn.getY(i); this.nrm[j + 2] = sn.getZ(i);
      col.push(sc.getX(i), sc.getY(i), sc.getZ(i));
    }
    const si = stat.getIndex();
    if (si) for (let i = 0; i < si.count; i++) idx.push(si.getX(i) + this.dynVerts);
    else for (let i = 0; i < statVerts; i++) idx.push(i + this.dynVerts);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3); this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.nrmAttr = new THREE.BufferAttribute(this.nrm, 3); this.nrmAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('normal', this.nrmAttr);
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.geometry.setIndex(idx);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    this.shape(0, 0);
  }

  /** repaint the limbs + string from a style's palette (the fist, after them, keeps its colours) */
  repaint(style: BowStyle): void {
    LIMB = LIMB_STYLES[style];
    const col: number[] = [];
    for (let r = 0; r < this.ringU.length; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      for (let k = 0; k <= RADIAL; k++) limbColor(col, u, (k / RADIAL) * Math.PI * 2, sign);
    }
    mix3(col, LIMB.boneDark, LIMB.boneDark, 0); mix3(col, LIMB.boneDark, LIMB.boneDark, 0);
    for (let leg = 0; leg < 2; leg++) for (let ring = 0; ring < STRING_RINGS; ring++) for (let k = 0; k < STRING_RADIAL; k++) {
      const serv = ring >= 2;
      mix3(col, serv ? LIMB.serving : LIMB.string, serv ? LIMB.serving : LIMB.string, 0, 0.9 + 0.1 * (k % 2));
    }
    const attr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    (attr.array as Float32Array).set(col, 0);
    attr.clearUpdateRanges(); attr.addUpdateRange(0, col.length); attr.needsUpdate = true;
    LIMB = LIMB_STYLES.recurve;
  }

  /** bend the limbs for draw `p` (0..1) and pull the string to `nockDraw` (0 = braced, 1 = full, < 0 overshoot) */
  shape(p: number, nockDraw: number): void {
    const pc = Math.max(0, Math.min(1.08, p));
    if (Math.abs(pc - this.lastP) < 0.0015 && Math.abs(nockDraw - this.lastNock) < 0.0015) return;
    this.lastP = pc; this.lastNock = nockDraw;
    const P = this.pos, N = this.nrm;
    const c = _b1, t = _b2, n = _b3;
    const rings = this.ringU.length;
    for (let r = 0; r < rings; r++) {
      const u = this.ringU[r] ?? 0, sign = this.ringSign[r] ?? 1;
      limbAt(u, sign, pc, c, t);
      // section frame: B = +X, Nb = belly direction (⊥ tangent in YZ, toward the archer for the upper limb)
      n.set(0, -t.z * sign, t.y * sign);
      const [hw, ht] = limbSection(u);
      for (let k = 0; k <= RADIAL; k++) {
        const ph = (k / RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        const j = (r * (RADIAL + 1) + k) * 3;
        const rr = gripRidge(u, ph, sign);
        P[j] = cp * hw * rr; P[j + 1] = c.y + n.y * sp * ht * rr; P[j + 2] = c.z + n.z * sp * ht * rr;
        const ex = cp / hw, en = sp / ht, l = Math.hypot(ex, en) || 1;
        N[j] = ex / l; N[j + 1] = (n.y * en) / l; N[j + 2] = (n.z * en) / l;
      }
      if (r === 0 || r === rings - 1) { // caps
        const j = (rings * (RADIAL + 1) + (r === 0 ? 0 : 1)) * 3;
        P[j] = 0; P[j + 1] = c.y + t.y * 0.004; P[j + 2] = c.z + t.z * 0.004;
        N[j] = 0; N[j + 1] = t.y; N[j + 2] = t.z;
      }
    }
    // string anchors: 1.2 cm in from each tip, on the belly face
    limbAt(BOW_LEN - 0.012, 1, pc, this.tipTop, t); this.tipTop.z += 0.006;
    limbAt(BOW_LEN - 0.012, -1, pc, this.tipBot, t); this.tipBot.z += 0.006;
    const braceZ = (this.tipTop.z + this.tipBot.z) / 2;
    this.nock.set(0, ARROW_Y - 0.004, braceZ + (BRACE_Z + DRAW_LEN - braceZ) * Math.max(-0.12, nockDraw));
    this.nock.z = Math.max(this.nock.z, braceZ - 0.03);
    this.writeLeg(0, this.tipBot, this.nock);
    this.writeLeg(1, this.tipTop, this.nock);
    this.posAttr.clearUpdateRanges(); this.posAttr.addUpdateRange(0, this.dynVerts * 3); this.posAttr.needsUpdate = true;
    this.nrmAttr.clearUpdateRanges(); this.nrmAttr.addUpdateRange(0, this.dynVerts * 3); this.nrmAttr.needsUpdate = true;
  }

  private writeLeg(leg: number, a: THREE.Vector3, b: THREE.Vector3): void {
    const d = _b1.subVectors(b, a).normalize();
    const e1 = _b2.set(1, 0, 0); e1.addScaledVector(d, -e1.dot(d)).normalize();
    const e2 = _b3.crossVectors(d, e1);
    const o = this.limbVerts + leg * STRING_RINGS * STRING_RADIAL;
    const len = a.distanceTo(b), sv = Math.max(0, 1 - SERVING / Math.max(len, 1e-3));
    const at = [0, Math.max(0, sv - 0.004), sv, 1];
    for (let ring = 0; ring < STRING_RINGS; ring++) {
      const f = at[ring] ?? 1, rad = STRING_R * (ring >= 2 ? 1.3 : 1);
      const cx = a.x + (b.x - a.x) * f, cy = a.y + (b.y - a.y) * f, cz = a.z + (b.z - a.z) * f;
      for (let k = 0; k < STRING_RADIAL; k++) {
        const ph = (k / STRING_RADIAL) * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
        const j = (o + ring * STRING_RADIAL + k) * 3;
        const nx = e1.x * cp + e2.x * sp, ny = e1.y * cp + e2.y * sp, nz = e1.z * cp + e2.z * sp;
        this.pos[j] = cx + nx * rad; this.pos[j + 1] = cy + ny * rad; this.pos[j + 2] = cz + nz * rad;
        this.nrm[j] = nx; this.nrm[j + 1] = ny; this.nrm[j + 2] = nz;
      }
    }
  }
}

// ───────────────────────────── the drop arc ─────────────────────────────

class DropArc {
  readonly points: THREE.Points;
  readonly ring: THREE.Mesh;
  private readonly buf = new Float32Array(ARC_MAX * 3);
  private readonly attr: THREE.BufferAttribute;
  private readonly uAlpha: THREE.IUniform<number> = { value: 0 };
  private readonly uPx: THREE.IUniform<number> = { value: 6 };
  private readonly ringMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.buf, 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: this.uAlpha, uPx: this.uPx, uColor: { value: new THREE.Color(ARC_CYAN) } },
      vertexShader: `uniform float uPx; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uPx * clamp(8.0 / max(0.1, -mv.z), 0.6, 1.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uAlpha; uniform vec3 uColor; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(uColor, uAlpha * (1.0 - smoothstep(0.55, 1.0, r))); }`,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false; this.points.renderOrder = 998; this.points.visible = false; // under the viewmodel (999 clears depth, 1000 draws it)
    this.ringMat = new THREE.MeshBasicMaterial({ color: ARC_CYAN, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
    const rg = new THREE.RingGeometry(0.62, 1, 36); rg.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(rg, this.ringMat);
    this.ring.frustumCulled = false; this.ring.renderOrder = 998; this.ring.visible = false;
    scene.add(this.points, this.ring);
  }

  hide(): void { this.points.visible = false; this.ring.visible = false; }

  /** `from` = where the dots start (the nocked arrow's tip): the arc leaves the bow like the mockup's and blends onto the
   *  true flight over ARC_BLEND m — seen from the eye the true path is almost end-on, a stroke under the crosshair. The
   *  landing ring is the true landing point. */
  show(arrows: Projectiles, origin: THREE.Vector3, vel: THREE.Vector3, from: THREE.Vector3, alpha: number, camPos: THREE.Vector3, dpr: number): void {
    const n = arrows.predict(origin, vel, this.buf, ARC_MAX, ARC_SPACING, ARC_SKIP);
    const ox = from.x - origin.x, oy = from.y - origin.y, oz = from.z - origin.z, b = this.buf;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      const px = b[j] ?? 0, py = b[j + 1] ?? 0, pz = b[j + 2] ?? 0;
      const d = Math.hypot(px - origin.x, py - origin.y, pz - origin.z);
      const k = 1 - sstep(0, ARC_BLEND, d);
      b[j] = px + ox * k; b[j + 1] = py + oy * k; b[j + 2] = pz + oz * k;
    }
    this.attr.clearUpdateRanges(); this.attr.addUpdateRange(0, n * 3); this.attr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, n);
    this.uAlpha.value = alpha * 0.85; this.uPx.value = 8.5 * dpr;
    this.points.visible = n > 0;
    this.ring.visible = arrows.landed;
    if (arrows.landed) {
      const d = arrows.landing.distanceTo(camPos);
      this.ring.position.copy(arrows.landing).addScaledVector(arrows.landingNormal, 0.05);
      this.ring.quaternion.setFromUnitVectors(_up, arrows.landingNormal);
      this.ring.scale.setScalar(0.2 + d * 0.013);
      this.ringMat.opacity = alpha * 0.85;
    }
  }
}

// ───────────────────────────── the bow ─────────────────────────────

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _fwd = new THREE.Vector3(), _dir = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const NEG_Z = new THREE.Vector3(0, 0, -1), POS_Z = new THREE.Vector3(0, 0, 1), Y_AXIS = new THREE.Vector3(0, 1, 0);

/** a camera-space pose of the bow's grip: position + aim point (−Z of the bow points at it) + cant (roll, rad) */
interface GripPose { pos: THREE.Vector3; aim: THREE.Vector3; cant: number; pitch: number }
/** the fists (nalatiArms.ts): the left closed on the grip, the right a tight thumb-draw fist hooked on the string */
const L_FIST = { R: 0.021, mirror: true, yaw: -0.32 };
const R_FIST = { R: 0.009, thumbRing: true, yaw: 0.55 };
/** the drawing hand is pronated (a thumb draw: the back of the hand and the knuckles up toward the eye), rolled this far
 *  about its forearm; its thumb hook (`Fist.hook`) sits on the string just under the arrow's nock */
const R_FIST_ROLL = 1.35, HOOK_BELOW_NOCK = 0.006;
const _rollQ = new THREE.Quaternion(), _rDir = new THREE.Vector3();
/** the right forearm keeps this heading (rig space) wherever the hand is — the elbow follows the hand, so the arm never
 *  stretches forward to the string (the old "reaching" glitch); portrait turns it further down */
const R_ARM_DIR = V(0.6, -0.42, 0.68).normalize(), R_ARM_DIR_PORT = V(0.42, -0.62, 0.66).normalize();
/** the re-nock: follow-through (the hand flies back off the string), down to the quiver at the hip, back up with an arrow */
const RN_FOLLOW = 0.18, RN_DROP = 0.52, RN_EARLY = 0.4, FOLLOW_OFF = V(0.035, 0.012, 0.075), QUIVER_OFF = V(0.3, -0.55, 0.12);

/* Poses in rig space (camera space / VM_SCALE). REST = the bow lowered and canted (style-B mockup: the left fist lower
 * right, no arrow). DRAWN = the fist right of centre, the bow canted ~20°, the arrow converging on the crosshair a
 * couple of metres out so it reads as pointing at it (combat-C). Portrait phones get their own (narrower frame). */
const VM_SCALE = 0.72;
/** the viewmodel's shade-side fill (painterly `shade`; 1 = the world's) */
export const VM_SHADE = 2.4;
const POSE = {
  rest: { pos: V(0.34, -0.42, -0.86), aim: V(-0.1, 0.25, -4), cant: -0.62, pitch: -0.14 },
  drawn: { pos: V(0.22, -0.17, -1.12), aim: V(0, 0, -5.5), cant: -0.36, pitch: 0 },
  restPort: { pos: V(0.17, -0.5, -0.9), aim: V(-0.05, 0.12, -4), cant: -0.5, pitch: -0.12 },
  drawnPort: { pos: V(0.07, -0.1, -1.08), aim: V(0, 0, -5.5), cant: -0.3, pitch: 0 },
} satisfies Record<string, GripPose>;
const L_ELBOW = V(-0.42, -0.52, -0.3), L_ELBOW_PORT = V(-0.2, -0.75, -0.32);

export class Bow implements Weapon {
  readonly hasAmmo = true;
  /** the HUD strip (Weapons.ts BaseLike overrides): ARROWS n / 24 */
  readonly ammoLabel = 'Arrows';
  readonly segments = 4;
  readonly magazine = QUIVER_MAX;
  state = { bolts: QUIVER_MAX, loaded: true, reloading: false, reloadProgress: 1, ads: false };
  enabled = true;
  allowUnlocked = false;
  /** the touch DRAW latch (Weapons.adsHeld) — held = draw and hold; `?ads=1` forces it */
  adsHeld = false;
  /** 0..1 weapon-swap blend driven by Weapons.ts (1 = dropped out of the frame) */
  holster = 0;
  aimInfo: { kind: string; distance: number } | null = null;
  /** dev: > 0 = the viewmodel held up close and turned for inspection (`inspectYaw` rad, `inspectPitch`) — `?inspect=1` in the harness */
  inspect = 0; inspectYaw = 0; inspectPitch = 0;

  // ── the saddle's knobs (B7) — see the header ──
  drawSpeedScale = 1;
  extraSpreadDeg = 0;
  readonly carrierVelocity = new THREE.Vector3();
  arcAllowed = true;
  damageMultiplier: ((hit: TargetHit) => number) | undefined;

  onFire?: (() => void) | undefined;
  onHit?: ((kind: string, headshot: boolean, killed: boolean) => void) | undefined;
  onImpact?: ((surface: ImpactSurface, point: THREE.Vector3) => void) | undefined;
  onReloadStart?: (() => void) | undefined;
  onReloadEnd?: (() => void) | undefined;
  onDry?: (() => void) | undefined;
  /** bow-only: the string starts coming back / a draw was let down / a stuck arrow was picked up (survived or broke) */
  onDrawStart?: (() => void) | undefined;
  onLetDown?: (() => void) | undefined;
  onRecover?: ((survived: boolean) => void) | undefined;
  /** the loose with its power (0.25..1) — audio can scale the twang */
  onLoose?: ((power: number) => void) | undefined;

  readonly model = new THREE.Group();
  readonly arrows: Projectiles;
  private readonly game: Game; private readonly sky: Sky; private readonly player: Player;
  private readonly targets: Targets | undefined;
  private readonly bowPivot = new THREE.Group();
  private readonly bowMesh: BowMesh;
  private readonly nocked: THREE.Mesh;
  private readonly rHand: THREE.Mesh;
  private readonly lSleeve: THREE.Mesh; private readonly rSleeve: THREE.Mesh;
  private readonly lWrist: THREE.Vector3; private readonly rWrist: THREE.Vector3; private readonly rHook: THREE.Vector3; private readonly rWristDir: THREE.Vector3;
  /** the hand's nock point (rig space) at the last loose — the follow-through starts there */
  private readonly releasePos = new THREE.Vector3(); private readonly handPos = new THREE.Vector3();
  private readonly arc: DropArc;
  private readonly mat: THREE.Material;

  // draw state
  private drawT = 0;          // 0..1 linear draw time (p = ease-out of it)
  private p = 0;              // the draw, 0..1
  private vis = 0; private visVel = 0; // the string's visual draw (a spring: the release overshoots)
  private mouseDraw = false; private mouseAds = false;
  private snapT = -1;         // ≥ 0 while a snap shot runs
  private looseQueued = false;
  private holdT = 0; private tiredT = 0; private renockT = 0;
  private wasWanting = false;
  private ready = 0;          // 0 lowered … 1 raised
  private recoil = 0;
  private swayYaw = 0; private swayPitch = 0; // applied aim sway (removed again as it changes)
  private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagPitch = 0; private lagYawV = 0; private lagPitchV = 0;
  private aimFrame = 0; private readonly aimCache = { kind: '', distance: 0 };
  private readonly spawnPos = new THREE.Vector3(); private readonly launchVel = new THREE.Vector3();
  private readonly gripPos = new THREE.Vector3(); private readonly gripQuat = new THREE.Quaternion();

  constructor(world: BowWorld, targets?: Targets, opts: BowOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;

    // one painterly program for the whole viewmodel; drawn after the depth clear (renderOrder 999 / 1000, like Crossbow)
    // shade > 1: the painted sky tint is ADDED on the shade side (painterly.ts), so it doubles as the viewmodel's cool fill —
    // an arm turned away from the sun reads as a cool-shadowed sleeve, not a black hole
    this.mat = painterlyMaterial(this.sky, { rim: 0.55, bands: 0.7, shade: VM_SHADE, transparent: true, depthWrite: true });
    const lf = gloveFist(L_FIST), rf = gloveFist(R_FIST);
    this.lWrist = lf.wrist; this.rWrist = rf.wrist; this.rHook = rf.hook; this.rWristDir = rf.wristDir;
    _rollQ.setFromAxisAngle(rf.wristDir, R_FIST_ROLL); // pronate about the forearm itself, so the forearm keeps its heading
    this.bowMesh = new BowMesh([lf.geometry]);
    const bow = new THREE.Mesh(this.bowMesh.geometry, this.mat);
    this.bowPivot.add(bow);
    this.nocked = new THREE.Mesh(buildArrowGeometry(), this.mat);
    this.rHand = new THREE.Mesh(rf.geometry, this.mat);
    this.lSleeve = new THREE.Mesh(riderArm(1.0, 1), this.mat);
    this.rSleeve = new THREE.Mesh(riderArm(0.9, 2), this.mat);
    this.model.add(this.bowPivot, this.nocked, this.rHand, this.lSleeve, this.rSleeve);
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    this.model.traverse((m) => {
      if (!(m instanceof THREE.Mesh)) return;
      m.frustumCulled = false; m.castShadow = false; m.receiveShadow = m !== clearer;
      if (m !== clearer) m.renderOrder = 1000;
    });
    this.model.scale.setScalar(VM_SCALE);
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);

    this.arrows = new Projectiles(world, targets, arrowKind(this.sky));
    this.arrows.onHit = (kind, headshot, killed) => this.onHit?.(kind, headshot, killed);
    this.arrows.onImpact = (s, pt) => this.onImpact?.(s, pt);
    this.arrows.wind = worldWind; // the one wind (grass, clouds, arrows); `bow.wind = null` for a still-air test
    this.arrows.canRecover = () => this.state.bolts < QUIVER_MAX;
    this.arrows.onRecover = (ok) => { if (ok) this.state.bolts = Math.min(QUIVER_MAX, this.state.bolts + 1); this.onRecover?.(ok); };
    this.arc = new DropArc(this.game.scene);
    this.bindInput();
  }

  /** the wind the arrows (and the arc) drift in */
  get wind(): WindField | null { return this.arrows.wind; }
  set wind(w: WindField | null) { this.arrows.wind = w; }
  /** the draw, 0..1 — the touch DRAW disc's ring (Weapons' `charge`) */
  get charge(): number { return this.p; }
  get drawing(): boolean { return this.p > 0.01; }

  // ── input ──
  inputAllowed(): boolean { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) { if (this.state.bolts <= 0) this.onDry?.(); else this.mouseDraw = true; }
      if (e.button === 2) this.mouseAds = !this.mouseAds;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0 || !this.mouseDraw) return;
      this.mouseDraw = false;
      if (this.inputAllowed()) this.loose(); else this.drawT = Math.min(this.drawT, 0.99);
    });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => { if (!e.repeat && e.code === 'KeyF' && this.inputAllowed()) this.tryFire(); });
    window.addEventListener('blur', () => { this.mouseDraw = false; this.mouseAds = false; });
  }

  /** LOOK tap / F: loose a held draw, or a snap shot when nothing is drawn */
  tryFire(): void {
    if (!this.enabled) return;
    if (this.state.bolts <= 0) { this.onDry?.(); return; }
    if (this.renockT > 0 || this.snapT >= 0) return;
    const held = this.adsHeld || this.mouseDraw;
    if (held && this.p >= MIN_LOOSE) { this.loose(); return; }
    if (held) { this.looseQueued = true; return; }      // still coming up: loose as soon as it reaches the snap draw
    this.snapT = 0;
  }

  /** release: an arrow if drawn past MIN_LOOSE, else a let-down (nothing spent) */
  loose(): void {
    const p = this.p;
    this.snapT = -1; this.looseQueued = false;
    if (p < MIN_LOOSE || this.state.bolts <= 0 || this.renockT > 0) { if (p > 0.02) this.onLetDown?.(); this.drawT = Math.min(this.drawT, 0.3); return; }
    this.aimRay(_v1, _fwd);
    const spreadDeg = (0.3 + (1 - p) * 1.1) * (this.state.ads ? 0.5 : 1) + 0.6 * this.player.speedFactor + this.extraSpreadDeg + this.mountSpread;
    const spread = THREE.MathUtils.degToRad(spreadDeg);
    _dir.copy(_fwd);
    _v2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(_fwd).normalize();
    _dir.addScaledVector(_v2, Math.tan(spread * Math.sqrt(Math.random()))).normalize();
    this.launchFrom(_dir, p, this.spawnPos, this.launchVel);
    this.arrows.launch(this.spawnPos, this.launchVel, { damageScale: DAMAGE_SCALE * (0.35 + 0.65 * p), onHitScale: this.damageMultiplier });
    this.state.bolts--;
    this.drawT = 0; this.p = 0; this.holdT = 0;
    this.renockT = RENOCK_TIME;
    this.releasePos.copy(this.handPos);
    this.recoil = 0.6 + 0.4 * p;
    this.onFire?.(); this.onLoose?.(p);
  }

  /** the arrow's start (on the aim line, just in front of the eye, where the nocked arrow's tip is) and velocity */
  private launchFrom(dir: THREE.Vector3, p: number, pos: THREE.Vector3, vel: THREE.Vector3): void {
    const cam = this.game.camera;
    pos.setFromMatrixPosition(cam.matrixWorld).addScaledVector(dir, 0.55);
    this.nocked.getWorldPosition(_v3); // the nocked arrow's origin is its tip
    pos.lerp(_v3, 0.15);
    vel.copy(dir).multiplyScalar(SPEED_BASE + SPEED_DRAW * p).add(this.carrierVelocity);
  }

  /** the aim is the CAMERA forward — the rider's head, not the horse / body */
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const cam = this.game.camera;
    cam.getWorldDirection(dir);
    origin.setFromMatrixPosition(cam.matrixWorld);
    return dir;
  }

  /**
   * The saddle's per-frame hand-off (nalatiKit.setMount → here; `null` on foot). From the horse's speed (m/s) and heading
   * (`yaw`, Player.yaw convention) it sets the knobs above per combat.md §A: the draw 0.9 s mounted (0.75 on foot), the
   * gait's spread cone (walk 0.8° · trot 3.0° · canter 1.5° · gallop 1.8°), the horse's velocity added to every arrow,
   * no drop arc from the saddle, and the Parthian shot — the view > 110° off the heading: the draw 0.2 s slower and
   * +0.5° spread. (The gallop's "float" halving of the spread needs the stride phase: the Mount can lower
   * `extraSpreadDeg` itself after this call.)
   */
  setMount(m: { speed: number; yaw: number } | null): void {
    if (m === null) { this.mountDraw = 1; this.mountSpread = 0; this.carrierVelocity.set(0, 0, 0); this.mountArc = true; this.parthian = false; return; }
    const v = m.speed;
    const gait = v < 0.3 ? 0.3 : v < 3.2 ? 0.8 : v < 6.5 ? 3.0 : v < 10.5 ? 1.5 : 1.8;
    let off = this.player.yaw - m.yaw; off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
    this.parthian = off > THREE.MathUtils.degToRad(110);
    this.mountDraw = DRAW_TIME / (0.9 + (this.parthian ? 0.2 : 0));
    this.mountSpread = gait + (this.parthian ? 0.5 : 0);
    this.carrierVelocity.set(-Math.sin(m.yaw) * v, 0, -Math.cos(m.yaw) * v);
    this.mountArc = false;
  }
  /** the saddle's share (setMount) — kept apart from `drawSpeedScale` / `extraSpreadDeg` / `arcAllowed`, which other
   *  systems (the Golden Bow) set: the two multiply / add / AND */
  private mountDraw = 1; private mountSpread = 0; private mountArc = true;

  /** the bow's look: 'recurve' (horn and birch) or 'golden' (the Golden King's reward) — repaints the limbs + string */
  setStyle(style: BowStyle): void { this.style = style; this.bowMesh.repaint(style); }
  style: BowStyle = 'recurve';
  /** the view is > 110° off the horse's heading (the HUD's REAR SHOT chip; a hit on a pursuer staggers — B7's `damageMultiplier`) */
  parthian = false;

  addBolts(n: number): void { this.state.bolts = Math.min(QUIVER_MAX, this.state.bolts + n); }
  reload(): void { /* the draw is the reload */ }

  // ── per frame ──
  update(dt: number, t: number): void {
    const pl = this.player, cam = this.game.camera;
    cam.updateMatrixWorld();
    this.renockT = Math.max(0, this.renockT - dt);
    this.tiredT = Math.max(0, this.tiredT - dt);
    if (!this.enabled) { this.mouseDraw = false; this.mouseAds = false; this.snapT = -1; this.looseQueued = false; }

    // ── the draw ──
    // the next draw may start while the hand is still coming up from the quiver (RN_EARLY of the re-nock left): the
    // string comes back to meet the hand halfway, instead of the hand reaching all the way out to the braced string
    const blocked = !this.enabled || this.state.bolts <= 0 || this.renockT > RENOCK_TIME * RN_EARLY || this.tiredT > 0 || pl.sprinting || pl.swimming;
    const want = !blocked && (this.mouseDraw || this.adsHeld || this.snapT >= 0);
    if (want && !this.wasWanting) this.onDrawStart?.();
    if (!want && this.wasWanting && this.p > 0.05) this.onLetDown?.();
    this.wasWanting = want;
    if (want) {
      this.drawT = Math.min(1, this.drawT + (dt * this.drawSpeedScale * this.mountDraw) / DRAW_TIME);
      if (this.snapT >= 0) {
        this.snapT += dt;
        this.drawT = Math.min(this.drawT, 1 - Math.sqrt(1 - SNAP_P));
        if (this.snapT >= SNAP_DELAY) { this.p = 1 - (1 - this.drawT) ** 2; this.loose(); }
      }
    } else {
      this.drawT = Math.max(0, this.drawT - dt * LETDOWN_RATE);
      this.snapT = -1; this.looseQueued = false;
    }
    this.p = 1 - (1 - this.drawT) ** 2;
    if (this.looseQueued && this.p >= SNAP_P) this.loose();
    // held at full: steady, then sway, then the arms give out
    if (this.p >= 0.999 && want) {
      this.holdT += dt;
      if (this.holdT >= HOLD_TIRE) { this.tiredT = TIRED_TIME; this.holdT = 0; this.mouseDraw = false; }
    } else if (this.p < 0.9) this.holdT = 0;
    this.state.loaded = this.state.bolts > 0;
    this.state.reloading = false;
    this.state.reloadProgress = 1 - this.renockT / RENOCK_TIME;

    // ── steady (RMB) + FOV ──
    if (pl.sprinting || !this.enabled) this.mouseAds = false;
    this.state.ads = this.mouseAds && this.enabled && !pl.sprinting;
    const steady = this.state.ads ? 1 : 0;
    // the held weapon owns the FOV (Hor+ on portrait, 1.3× while steady, + the dodge kick); the cascades refit only on a base change
    const baseFov = fovForAspect(steady ? FOV_ADS : FOV_HIP, cam.aspect);
    const prevFov = this.fov;
    this.fov += (baseFov - this.fov) * Math.min(1, dt * 12);
    if (Math.abs(baseFov - this.fov) < 0.02) this.fov = baseFov;
    const fovNow = this.fov + pl.fovKick;
    if (this.model.visible && Math.abs(fovNow - cam.fov) > 0.01) { cam.fov = fovNow; cam.updateProjectionMatrix(); if (Math.abs(prevFov - this.fov) > 0.001 || Math.abs(fovNow - this.fov) < 0.01) this.sky.csm.updateFrustums(); }

    // ── aim sway on a long hold (applied to the view and taken back as it changes) ──
    let sy = 0, sp = 0;
    if (this.p > 0.3) {
      const over = clamp01((this.holdT - HOLD_STEADY) / (HOLD_TIRE - HOLD_STEADY));
      const amp = (THREE.MathUtils.degToRad(0.06) + SWAY_MAX * over * over) * (steady ? 0.4 : 1) * this.p;
      sy = Math.sin(t * 1.3) * amp + Math.sin(t * 2.9 + 1) * amp * 0.35;
      sp = Math.sin(t * 1.7 + 0.5) * amp * 0.8 + Math.sin(t * 3.7) * amp * 0.25;
    }
    pl.yaw += sy - this.swayYaw; pl.pitch += sp - this.swayPitch; this.swayYaw = sy; this.swayPitch = sp;

    // ── the viewmodel ──
    this.poseViewmodel(dt, t);

    // ── the drop arc ──
    const arcOn = this.arcAllowed && this.mountArc && getSetting('huntersEye') && this.p > MIN_LOOSE && this.model.visible && this.holster < 0.01;
    if (arcOn) {
      this.aimRay(_v1, _fwd);
      this.launchFrom(_fwd, this.p, _v2, _v3);
      this.nocked.getWorldPosition(_dir);
      this.arc.show(this.arrows, _v2, _v3, _dir, sstep(MIN_LOOSE, 0.85, this.p), _v1, this.game.renderer.getPixelRatio());
    } else this.arc.hide();

    // ── aim readout ──
    if (this.targets && (++this.aimFrame & 3) === 0) {
      this.aimRay(_v1, _fwd);
      const hit = this.targets.raycast(_v1, _fwd, 150);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }

    this.arrows.update(dt);
  }

  private poseViewmodel(dt: number, t: number): void {
    const pl = this.player, cam = this.game.camera;
    const port = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    // raised while drawing (and a beat after the loose so the follow-through reads)
    const raise = this.p > 0.01 || this.mouseDraw || this.adsHeld || this.snapT >= 0 || this.renockT > 0;
    this.ready += ((raise ? 1 : 0) - this.ready) * Math.min(1, dt * (raise ? 9 : 4));
    const r = sstep(0, 1, this.ready);
    // the string: a spring onto the draw (under-damped: the release snaps past the brace and back)
    for (let rem = dt; rem > 0; rem -= 1 / 240) {
      const h = Math.min(rem, 1 / 240);
      this.visVel += (-(this.vis - this.p) * 1600 - this.visVel * 26) * h; this.vis += this.visVel * h;
    }
    this.bowMesh.shape(Math.max(0, this.vis), this.vis);

    // the grip pose: rest ↔ drawn (portrait has its own pair)
    const R = POSE.rest, D = POSE.drawn, RP = POSE.restPort, DP = POSE.drawnPort;
    const g = this.gripPos, aim = _v1;
    g.lerpVectors(R.pos, RP.pos, port).lerp(_v2.lerpVectors(D.pos, DP.pos, port), r);
    aim.lerpVectors(R.aim, RP.aim, port).lerp(_v2.lerpVectors(D.aim, DP.aim, port), r);
    let cant = THREE.MathUtils.lerp(THREE.MathUtils.lerp(R.cant, RP.cant, port), THREE.MathUtils.lerp(D.cant, DP.cant, port), r);
    const pitch = THREE.MathUtils.lerp(THREE.MathUtils.lerp(R.pitch, RP.pitch, port), 0, r);
    // motion: breathing, walk bob (heavier at rest), look lag, the loose's follow-through
    const sf = pl.speedFactor * (1 - 0.6 * r);
    let dYaw = pl.yaw - this.lastYaw, dPitch = pl.pitch - this.lastPitch;
    this.lastYaw = pl.yaw; this.lastPitch = pl.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawV += (-this.lagYaw * 200 - this.lagYawV * 20) * h; this.lagYaw += this.lagYawV * h;
      this.lagPitchV += (-this.lagPitch * 200 - this.lagPitchV * 20) * h; this.lagPitch += this.lagPitchV * h;
    }
    this.recoil *= Math.exp(-dt * 7);
    const lagK = 1 - 0.6 * r;
    g.x += Math.sin(t * 0.8) * 0.004 + Math.cos(pl.bobTime) * 0.02 * sf + this.lagYaw * 0.3 * lagK;
    g.y += Math.sin(t * 1.2) * 0.003 - Math.abs(Math.sin(pl.bobTime)) * 0.018 * sf + this.lagPitch * 0.25 * lagK;
    g.z -= this.recoil * 0.05; g.y -= this.recoil * 0.012;
    cant += Math.cos(pl.bobTime) * 0.03 * sf + this.recoil * 0.1;
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); g.y -= h * 0.5; g.z += h * 0.1; cant -= h * 0.4; }
    // orientation: the bow's −Z at the aim point, rolled by the cant, pitched forward at rest
    _dir.subVectors(aim, g).normalize();
    this.gripQuat.setFromUnitVectors(NEG_Z, _dir)
      .multiply(_q1.setFromAxisAngle(POS_Z, cant))
      .multiply(_q2.setFromAxisAngle(_v3.set(1, 0, 0), pitch - this.recoil * 0.08 + this.lagPitch * 0.4 * lagK))
      .multiply(_q3.setFromAxisAngle(Y_AXIS, this.lagYaw * 0.5 * lagK));
    if (this.inspect > 0) { // dev: the grip up close, turned
      g.set(0.02, -0.02, -0.5);
      this.gripQuat.setFromAxisAngle(Y_AXIS, this.inspectYaw).multiply(_q1.setFromAxisAngle(_v3.set(1, 0, 0), this.inspectPitch));
    }
    this.bowPivot.position.copy(g); this.bowPivot.quaternion.copy(this.gripQuat);

    // ── the right hand: on the string while drawing; after a loose it follows through, drops to the quiver and comes
    //    back up with the next arrow, which it lays on the string (the draw only starts once it is there) ──
    const nock = _v2.copy(this.bowMesh.nock).applyQuaternion(this.gripQuat).add(g);
    const H = this.handPos;
    let arrowInHand = this.state.bolts > 0;
    if (this.renockT > 0) {
      const u = 1 - this.renockT / RENOCK_TIME;
      const follow = _v3.copy(this.releasePos).add(FOLLOW_OFF);
      if (u < RN_FOLLOW) H.lerpVectors(this.releasePos, follow, sstep(0, 1, u / RN_FOLLOW));
      else if (u < RN_DROP) { const k = (u - RN_FOLLOW) / (RN_DROP - RN_FOLLOW); H.copy(follow).lerp(_v1.copy(this.releasePos).add(QUIVER_OFF), k * k); }
      else { const k = (u - RN_DROP) / (1 - RN_DROP); H.copy(this.releasePos).add(QUIVER_OFF).lerp(nock, 1 - (1 - k) ** 3); }
      arrowInHand &&= u >= RN_DROP;
    } else H.copy(nock);
    const raised = r > 0.25;
    this.rHand.visible = raised; this.rSleeve.visible = raised;
    this.rHand.quaternion.copy(this.gripQuat).multiply(_rollQ);
    this.rHand.position.copy(this.rHook).applyQuaternion(this.rHand.quaternion).negate().add(H);
    this.rHand.position.addScaledVector(_v3.set(0, 1, 0).applyQuaternion(this.gripQuat), -HOOK_BELOW_NOCK);
    if (this.inspect === 2) { // dev: the drawing hand alone, up close, turned
      this.bowPivot.position.y = -5;
      this.rHand.quaternion.setFromAxisAngle(Y_AXIS, this.inspectYaw).multiply(_q1.setFromAxisAngle(_v3.set(1, 0, 0), this.inspectPitch)).multiply(_rollQ);
      this.rHand.position.set(0, -0.06, -0.38);
    }
    // the arrow: from the hand's nock point to the rest on the left thumb (it swings in as the hand comes up)
    this.nocked.visible = raised && arrowInHand;
    const rest = _v1.set(ARROW_X, ARROW_Y, 0).applyQuaternion(this.gripQuat).add(g);
    _dir.subVectors(rest, H).normalize();
    this.nocked.quaternion.setFromUnitVectors(NEG_Z, _dir);
    this.nocked.position.copy(H).addScaledVector(_dir, ARROW_LEN);
    // ── the forearms: each sleeve from its glove's wrist; the left heads for a fixed elbow (the bow arm is straight),
    //    the right keeps its heading (the elbow travels with the hand) ──
    const lw = _v1.copy(this.lWrist).applyQuaternion(this.gripQuat).add(g);
    const ld = _v3.lerpVectors(L_ELBOW, L_ELBOW_PORT, port).sub(lw).normalize();
    placeArm(this.lSleeve, lw.addScaledVector(ld, -0.02), ld);
    const rw = _v1.copy(this.rWrist).applyQuaternion(this.rHand.quaternion).add(this.rHand.position);
    // the sleeve continues the glove's own forearm line, pulled toward down-right so it leaves the frame at the corner
    _rDir.copy(this.rWristDir).applyQuaternion(this.rHand.quaternion);
    const rd = _v3.lerpVectors(R_ARM_DIR, R_ARM_DIR_PORT, port).lerp(_rDir, 0.5).normalize();
    placeArm(this.rSleeve, rw.addScaledVector(rd, -0.02), rd);
  }

  /** dev: arrows stuck in the world */
  get stuckCount(): number { return this.arrows.stuckCount; }
}
