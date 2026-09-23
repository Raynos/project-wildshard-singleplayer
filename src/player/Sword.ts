import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import type { Targets, TargetHit, ImpactSurface } from './Crossbow';
import type { Weapon, WeaponState, AimInfo } from './Weapon';
import { REST, CHARGE, SPRINT, COMBO, SLASH, HEAVY, type Move } from './SwordMoves';
import { getAimTargets, meleeLock, targetRadius, type AimTarget } from './AimTargets';
import { segmentBlocked } from './MeleeSweep';
import { worldTime } from '../core/time';
import { CameraFX } from './CameraFX';

/**
 * Sword — the Driftwood Isle melee weapon (`ChunkDef.weapon === 'sword'`): a low-poly wooden sword (pale carved blade
 * with a rounded tip, plain crossguard, leather-wrapped grip, dark pommel) held in two low-poly hands lower-right,
 * a three-hit light combo and a charged heavy, each swing with its own arc and additive trail, a melee hit test and
 * hit-stun / knockback on what it hits. Faceted flat-shaded vertex colours, no textures (mockups:
 * art/driftwood-fp-sword-wooden.png, art/driftwood-fp-sword-iron.png). The iron sword is the same rig with
 * `{ blade: 'iron' }`: steel blade, 28 base damage.
 *
 *   const sword = new Sword({ game, sky, player, forest }, targets?, { allowUnlocked?: boolean, blade?: 'wood' | 'iron' });
 *   game.onUpdate((dt, t) => sword.update(dt, t));   // register AFTER player.update
 *
 * Implements `Weapon` (src/player/Weapon.ts) — the same surface main.ts / TouchControls / Combat / HUD use on the
 * crossbow: `enabled`, `model`, `state` (no ammo: `bolts` undefined, `hasAmmo = false` → the HUD hides the BOLTS
 * panel), `aimInfo`, `adsHeld`, `tryFire()`, `update(dt, t)`, `addBolts()` (no-op) and the same callbacks.
 *
 * COMBO (LMB / `F` / a touch tap on the look area = `tryFire()`): tap, tap, tap plays SLASH (right → left) →
 * BACKHAND (left → right) → FINISHER (overhead diagonal) as one chained animation — a tap during swing N queues
 * swing N+1 (one deep), which starts the moment N's active window closes, from N's follow-through pose. After the
 * finisher the next tap restarts at 1; so does a tap more than COMBO_GAP s after the last swing ended. Damage per
 * swing ×1 / ×1 / ×1.33 of the blade's base (wood 12 / 12 / 16).
 *
 * HEAVY (RMB click-toggle / the touch HEAVY disc — `adsHeld`, TouchControls.ts): a toggle-on / press starts the
 * charge — the blade rises over the right shoulder (CHARGE pose) and after HEAVY_CHARGE s the heavy is ready; the
 * release (toggle-off: RMB again) throws a wide, slower overhead chop for ×2 (wood 24) with a longer hit-stop, a thick
 * pale trail with a glint at the tip, and a heavy stagger. Releasing before the charge is full queues the release for
 * when it is. The player keeps walking / strafing while charging (no block; the DODGE disc / Left Alt dashes out — Player.dodge).
 * `state.ads` is true while charging (the HUD's ADS state); `charging` / `charge` (0..1) are readable for a meter.
 *
 * LUNGE (CoD-style melee magnetism, every input — E11): a swing that starts with a live animal within LUNGE_RANGE m
 * (heavy: LUNGE_RANGE_HEAVY) of the feet, edge to edge, and inside ±LUNGE_CONE of the view dashes the player to
 * LUNGE_STOP m short of its body in ≤ LUNGE_MAX_T s (`player.dashTo` — the pier-edge probe there keeps it out of the sea).
 * The lock is published every frame in `meleeLock` (AimTargets.ts): the HUD brackets it, and on touch the camera turns
 * onto it during the lunge (TouchControls.ts, behind the aim-assist switch). `player.swinging` is set while a swing runs
 * (the Swing turn speed setting).
 *
 * Hit test — the BLADE, swept (C1 / B5): every frame of a swing the blade's grip → tip (the swing pose at scale 1, so
 * the portrait framing never changes what you can hit) is turned into rays from the eye through SWEEP_K points along it,
 * each continued SWEEP_EXT further down (the viewmodel is held high in the frame, a crab sits at your feet: the blade
 * reaches the band under itself), swept from last frame's blade to this one in ≤ SWEEP_STEP angular sub-steps, each ray
 * out to REACH m against `targets.raycast` — only while a live animal is within reach (a swing at the air costs nothing).
 * Every animal the blade crosses in the active window is hit ONCE per swing (up to HIT_MAX), at the moment the blade
 * reaches it — not the whole arc on the first frame — and not through a wall: the eye → hit point segment is tested
 * against `player.colliders` (MeleeSweep.segmentBlocked). A hit: `applyDamage(damage, point, dir)`, then
 * `stagger(pushDir, strength)` when the target has one (Animal.ts: light 0.6 m / 0.4 s, heavy 1.5 m / 0.8 s, breaks a
 * running charge), `onHit(kind, false, killed)` + `onImpact('flesh', point)` fire (Combat's damage float and the HUD
 * hit marker work unchanged), the first hit stops the world for the move's hit-stop (Game.hitStop: 60 / 90 / 140 ms for
 * combo / finisher / heavy — C2) and a star burst pops at the point.
 *
 * Events: onFire() every swing (light AND heavy: play the whoosh; Combat's MISS judgement taps it) · onHeavy() on the
 * heavy's release, after onFire (a deeper whoosh layer: Audio.swordHeavy) · onHit(kind, headshot=false, killed) ·
 * onImpact('flesh', point) · onDry() never · onReload* never. `sword.reach` = REACH so Combat's MISS judgement
 * ignores animals out of range. `heavySwing` is true while the current swing is the heavy.
 *
 * Side effects (same as the crossbow): owns `game.camera.fov` (Hor+ on portrait) + `sky.csm.updateFrustums()`,
 * parents the viewmodel to `game.camera` (added to the scene if not yet), renders after a depth clear at 999/1000.
 */

export interface SwordWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface SwordOptions { allowUnlocked?: boolean; blade?: 'wood' | 'iron' }

const DAMAGE_WOOD = 12, DAMAGE_IRON = 28;
export const REACH = 2.2;            // m from the eye
const COOLDOWN = 0.08;               // s after a swing ends before a FRESH tap swings again (queued combo swings chain directly)
const COMBO_GAP = 0.6;               // s after a swing ends within which the next tap continues the combo
const CHAIN_LAG = 0.02;              // s after the active window closes that the queued swing takes over
export const HEAVY_CHARGE = 0.45;    // s of holding before the heavy is ready
const CHARGE_BLEND = 0.16;           // s to raise the blade into the charge pose
const LUNGE_RANGE = 4;               // m, feet to the animal's body edge: a light swing lunges this far …
const LUNGE_RANGE_HEAVY = 5;         // … the heavy this far
const LUNGE_CONE = 25 * Math.PI / 180; // rad either side of the view (horizontal)
const LUNGE_STOP = 1.1;              // m short of the body edge where the lunge stops (inside REACH from the eye)
const LUNGE_SPEED = 22;              // m/s …
const LUNGE_MIN_T = 0.08, LUNGE_MAX_T = 0.15; // … clamped to this duration
const TRAIL_SAMPLES = 20;
const HIT_MAX = 8;                   // animals one swing can strike
const SWEEP_K = 5;                   // rays along the blade, grip → tip …
const SWEEP_EXT = [0.12, 0.24, 0.36, 0.48] as const; // … each continued this far (rad) BELOW the blade, pitched down in camera space
const SWEEP_STEP = 0.09;             // rad: the largest blade move between two sweep sub-samples (~5°)
const SWEEP_SUB_MAX = 6;
const ARM_FOLLOW = 0.45;             // the forearms take this much of the sword's rotation away from rest (a cheap elbow)
const FOV_HIP = 72;
/** three's fov is vertical: a fixed 72° on a portrait phone collapses the horizontal view, so widen it (Hor+, same as Crossbow.ts) */
function fovForAspect(base: number, aspect: number) {
  if (aspect >= 1) return base;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / Math.sqrt(aspect)));
}
const clamp01 = (v: number) => (v < 0 ? 0 : Math.min(1, v));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;

// ───────────────────────────── low-poly geometry ─────────────────────────────

/** sRGB hex → linear Color (vertex colours are linear) */
const lin = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
const C = {
  blade: lin(0xdcbb8c), bladeEdge: lin(0xe9cda3), guard: lin(0xb08752), grip: lin(0x5a3a22), wrap: lin(0x7b5232), pommel: lin(0x6a4728),
  skin: lin(0xcfa082), skinDark: lin(0xb98a6a), sleeve: lin(0xe9e0cf), sleeveDark: lin(0xd2c6b0),
};

/** non-indexed copy with a `color` attribute: `col` per vertex, each FACE brightened/darkened by a tiny deterministic jitter so the facets read */
function paint(g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.05, seed = 1): THREE.BufferGeometry {
  const ni = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(ni.attributes)) if (k !== 'position' && k !== 'normal') ni.deleteAttribute(k);
  ni.computeVertexNormals(); // non-indexed → per-face normals (flat)
  const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
  let h = seed * 7919;
  for (let f = 0; f < n; f += 3) {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const j = 1 + ((h / 0x7fffffff) - 0.5) * 2 * jitter;
    for (let v = f; v < f + 3; v++) { c[v * 3] = col.r * j; c[v * 3 + 1] = col.g * j; c[v * 3 + 2] = col.b * j; }
  }
  ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return ni;
}

/** loft consecutive rings (same vertex count) into a closed-around, open-ended tube; a ring may collapse to a point (tip) */
function loft(rings: THREE.Vector3[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r], b = rings[r + 1];
    if (a === undefined || b === undefined) continue;
    const n = a.length;
    for (let i = 0; i < n; i++) {
      const a0 = a[i], a1 = a[(i + 1) % n], b0 = b[i], b1 = b[(i + 1) % n];
      if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
      pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z);
      pos.push(a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
/** hexagonal blade section: two edges + two flats, so the flat reads as one facet and the edges as bevels */
const hexSection = (y: number, w: number, t: number, flat = 0.5) => [
  new THREE.Vector3(w, y, 0), new THREE.Vector3(w * flat, y, t), new THREE.Vector3(-w * flat, y, t), new THREE.Vector3(-w, y, 0), new THREE.Vector3(-w * flat, y, -t), new THREE.Vector3(w * flat, y, -t),
];
const ring = (y: number, r: number, n: number, rot = 0) => { const out: THREE.Vector3[] = []; for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return out; };
const cap = (ringV: THREE.Vector3[], up: boolean) => { // fan cap over a ring
  const pos: number[] = []; const n = ringV.length; const cx = ringV.reduce((s, v) => s + v.x, 0) / n, cy = ringV[0]?.y ?? 0, cz = ringV.reduce((s, v) => s + v.z, 0) / n;
  for (let i = 0; i < n; i++) { const a = ringV[i], b = ringV[(i + 1) % n]; if (a === undefined || b === undefined) continue; if (up) pos.push(cx, cy, cz, a.x, a.y, a.z, b.x, b.y, b.z); else pos.push(cx, cy, cz, b.x, b.y, b.z, a.x, a.y, a.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
};
/** ring `i` of a lofted stack (build-time only: every stack below is literal, so a miss is a programming error) */
const ringAt = (rings: THREE.Vector3[][], i: number): THREE.Vector3[] => { const r = rings[i]; if (r === undefined) throw new Error(`Sword: no ring ${i}`); return r; };
function xform(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  if (s !== 1) g.scale(s, s, s);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
}
/** a low-poly fist: a 2×1×2-segment box with its vertices pulled toward a sphere so the corners knock off */
function fist(w: number, h: number, d: number, round = 0.45): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 2, 1, 2).toNonIndexed();
  const p = g.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) / (w / 2), p.getY(i) / (h / 2), p.getZ(i) / (d / 2));
    const l = v.length(); if (l > 1e-6) v.multiplyScalar(THREE.MathUtils.lerp(1, 1 / l, round));
    p.setXYZ(i, v.x * w / 2, v.y * h / 2, v.z * d / 2);
  }
  return g;
}

/**
 * Sword model space: origin at the middle of the grip (between the two fists), +Y up the blade, +X across the
 * guard (the edges), +Z the flat facing the player's eye at rest. Blade 0.56 m, whole sword ≈ 0.78 m.
 */
function buildSword(blade: 'wood' | 'iron'): { sword: THREE.BufferGeometry; arms: THREE.BufferGeometry; tipY: number; baseY: number } {
  const parts: THREE.BufferGeometry[] = [], armParts: THREE.BufferGeometry[] = [];
  const guardY = 0.085, bladeY0 = guardY + 0.014, L = 0.52, tipY = bladeY0 + L;
  // ── blade: hexagonal section, wide at the base, gently tapering, then a rounded (three-step) tip ──
  const bw = (y: number) => 0.044 - 0.010 * y / L; // half-width 4.4 → 3.4 cm (a chunky carved plank)
  const bt = (y: number) => 0.012 - 0.004 * y / L; // half-thickness 1.2 → 0.8 cm
  const rings: THREE.Vector3[][] = [];
  for (const f of [0, 0.25, 0.5, 0.72, 0.86]) rings.push(hexSection(bladeY0 + L * f, bw(L * f), bt(L * f)));
  rings.push(hexSection(bladeY0 + L * 0.93, bw(L) * 0.86, bt(L) * 0.9));
  rings.push(hexSection(bladeY0 + L * 0.975, bw(L) * 0.55, bt(L) * 0.65));
  rings.push(hexSection(bladeY0 + L * 0.995, bw(L) * 0.22, bt(L) * 0.35));
  rings.push(hexSection(tipY, 0.0005, 0.0003)); // rounded tip: collapses to a point over the last two rings
  const bladeCol = blade === 'iron' ? lin(0xc9ccd2) : C.blade;
  parts.push(paint(loft(rings), bladeCol, 0.045, 3));
  parts.push(paint(cap(ringAt(rings, 0), false), bladeCol, 0, 4));
  // ── guard: a plain bar, a touch thicker in the middle, ends knocked off ──
  const gw = 0.20, gh = 0.028, gd = 0.042;
  const gr = [
    [new THREE.Vector3(-gw / 2 + 0.012, guardY - gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY - gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY - gh / 2, gd / 2 - 0.008), new THREE.Vector3(-gw / 2 + 0.012, guardY - gh / 2, gd / 2 - 0.008)],
    [new THREE.Vector3(-gw / 2, guardY - gh / 2 + 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY - gh / 2 + 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY - gh / 2 + 0.006, gd / 2), new THREE.Vector3(-gw / 2, guardY - gh / 2 + 0.006, gd / 2)],
    [new THREE.Vector3(-gw / 2, guardY + gh / 2 - 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY + gh / 2 - 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY + gh / 2 - 0.006, gd / 2), new THREE.Vector3(-gw / 2, guardY + gh / 2 - 0.006, gd / 2)],
    [new THREE.Vector3(-gw / 2 + 0.012, guardY + gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY + gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY + gh / 2, gd / 2 - 0.008), new THREE.Vector3(-gw / 2 + 0.012, guardY + gh / 2, gd / 2 - 0.008)],
  ];
  const guardCol = blade === 'iron' ? lin(0x4a4a50) : C.guard;
  parts.push(paint(loft(gr), guardCol, 0.05, 5)); parts.push(paint(cap(ringAt(gr, 3), true), guardCol, 0, 6)); parts.push(paint(cap(ringAt(gr, 0), false), guardCol, 0, 7));
  // ── grip: octagonal leather core with three raised wrap bands; a short wooden tang collar under the guard ──
  parts.push(paint(loft([ring(-0.075, 0.0165, 8, 0.2), ring(guardY - 0.013, 0.0175, 8, 0.2)]), C.grip, 0.06, 8));
  for (const y of [-0.055, -0.012, 0.031]) {
    parts.push(paint(loft([ring(y - 0.008, 0.0165, 8, 0.2), ring(y - 0.006, 0.0195, 8, 0.2), ring(y + 0.006, 0.0195, 8, 0.2), ring(y + 0.008, 0.0165, 8, 0.2)]), C.wrap, 0.06, 9));
  }
  // ── pommel: a squat six-sided knob ──
  const pr = [ring(-0.078, 0.014, 6, 0.3), ring(-0.088, 0.024, 6, 0.3), ring(-0.104, 0.024, 6, 0.3), ring(-0.112, 0.013, 6, 0.3)];
  parts.push(paint(loft(pr), C.pommel, 0.06, 10)); parts.push(paint(cap(ringAt(pr, 3), false), C.pommel, 0, 11));
  // ── hands: two fists stacked on the grip (right hand above, left below), thumbs over the top toward the blade ──
  for (const [y, seed, upper] of [[0.037, 12, true], [-0.031, 13, false]] as [number, number, boolean][]) {
    const ry = upper ? 0.18 : -0.14;
    const add = (g: THREE.BufferGeometry, col: THREE.Color, sd: number) => { g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry)); g.translate(0, y, 0); parts.push(paint(g, col, 0.035, sd)); };
    add(fist(0.086, 0.062, 0.078, 0.65), C.skin, seed);                              // palm + fingers wrapped round the grip
    for (let k = 0; k < 4; k++) add(xform(fist(0.019, 0.05, 0.03, 0.7), -0.031 + k * 0.021, 0.002, 0.038, 0, 0, 0), k % 2 ? C.skin : C.skinDark, seed + 1 + k); // finger ridges on the eye side
    add(xform(fist(0.05, 0.024, 0.03, 0.7), -0.008, 0.03, 0.028, 0.25, 0.15, -0.45), C.skinDark, seed + 10); // thumb over the top, toward the blade
  }
  // ── forearms: a wrist stub of skin then a wide cream sleeve, angled off toward the lower right / bottom of the frame ──
  const restInv = REST.q.clone().invert();
  const arm = (fromY: number, dirCam: THREE.Vector3, seed: number) => {
    const d = dirCam.clone().normalize().applyQuaternion(restInv), from = new THREE.Vector3(0, fromY, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); // tube +Y → down the arm
    const seg = (a: number, b: number, ra: number, rb: number, col: THREE.Color, s: number) => {
      const g = loft([ring(a, ra, 7), ring(b, rb, 7)]);
      g.applyQuaternion(q); g.translate(from.x, from.y, from.z);
      armParts.push(paint(g, col, 0.04, s));
    };
    seg(0.02, 0.10, 0.033, 0.037, C.skin, seed);                // wrist
    seg(0.095, 0.11, 0.038, 0.05, C.sleeveDark, seed + 1);      // cuff lip
    seg(0.11, 0.55, 0.05, 0.058, C.sleeve, seed + 2);           // sleeve to out of frame
  };
  arm(0.01, new THREE.Vector3(0.78, -0.56, 0.28), 30);   // right arm (upper fist): out to the lower-right corner
  arm(-0.058, new THREE.Vector3(0.3, -0.88, 0.34), 40);  // left arm (lower fist): down, a little toward the camera
  const sword = mergeGeometries(parts, false), arms = mergeGeometries(armParts, false);
  sword.computeBoundingSphere(); arms.computeBoundingSphere();
  return { sword, arms, tipY, baseY: bladeY0 };
}

// ───────────────────────────── hit stars ─────────────────────────────

const STAR_COUNT = 24;
class Stars {
  points: THREE.Points;
  private pos = new Float32Array(STAR_COUNT * 3); private vel = new Float32Array(STAR_COUNT * 3);
  private life = new Float32Array(STAR_COUNT); private alpha = new Float32Array(STAR_COUNT); private size = new Float32Array(STAR_COUNT);
  private posAttr: THREE.BufferAttribute; private alphaAttr: THREE.BufferAttribute; private sizeAttr: THREE.BufferAttribute;
  private mat: THREE.ShaderMaterial; private cursor = 0; private tmpSize = new THREE.Vector2();
  private uScale: THREE.IUniform<number> = { value: 400 };
  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', (this.posAttr = new THREE.BufferAttribute(this.pos, 3)));
    g.setAttribute('aAlpha', (this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1)));
    g.setAttribute('aSize', (this.sizeAttr = new THREE.BufferAttribute(this.size, 1)));
    this.posAttr.setUsage(THREE.DynamicDrawUsage); this.alphaAttr.setUsage(THREE.DynamicDrawUsage); this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale },
      vertexShader: `attribute float aAlpha; attribute float aSize; varying float vA; uniform float uScale;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.05,-mv.z); gl_Position = projectionMatrix * mv; }`,
      // a four-point star: |x|^0.5 + |y|^0.5 ≤ 1 in point space
      fragmentShader: `varying float vA; void main(){ vec2 d = abs(gl_PointCoord - 0.5) * 2.0; float s = sqrt(d.x) + sqrt(d.y); if (s > 1.0 || vA <= 0.001) discard; float a = (1.0 - s) * vA; gl_FragColor = vec4(1.0, 0.93, 0.62, a * 1.4); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 1001;
  }
  burst(point: THREE.Vector3, dir: THREE.Vector3, n = 9) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % STAR_COUNT;
      this.pos[i * 3] = point.x; this.pos[i * 3 + 1] = point.y; this.pos[i * 3 + 2] = point.z;
      const sp = 1.2 + Math.random() * 1.6;
      this.vel[i * 3] = (-dir.x * 0.6 + (Math.random() - 0.5) * 1.6) * sp; this.vel[i * 3 + 1] = (0.5 + Math.random() * 0.9) * sp; this.vel[i * 3 + 2] = (-dir.z * 0.6 + (Math.random() - 0.5) * 1.6) * sp;
      this.life[i] = 0.3 + Math.random() * 0.2; this.alpha[i] = 1; this.size[i] = 0.05 + Math.random() * 0.05;
    }
  }
  update(dt: number, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    renderer.getDrawingBufferSize(this.tmpSize);
    this.uScale.value = this.tmpSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let any = false;
    const pos = this.pos, vel = this.vel;
    for (let i = 0; i < STAR_COUNT; i++) {
      const life0 = this.life[i] ?? 0;
      if (life0 <= 0) continue;
      any = true; const life = life0 - dt; this.life[i] = life;
      const j = i * 3, vy = (vel[j + 1] ?? 0) - 6 * dt; vel[j + 1] = vy;
      pos[j] = (pos[j] ?? 0) + (vel[j] ?? 0) * dt; pos[j + 1] = (pos[j + 1] ?? 0) + vy * dt; pos[j + 2] = (pos[j + 2] ?? 0) + (vel[j + 2] ?? 0) * dt;
      this.alpha[i] = life > 0 ? Math.min(1, life * 5) : 0;
    }
    if (any) { this.posAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true; }
  }
}

// ───────────────────────────── the sword ─────────────────────────────

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3(), _push = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _b = new THREE.Vector3(), _g0 = new THREE.Vector3(), _g1 = new THREE.Vector3(), _t0 = new THREE.Vector3(), _t1 = new THREE.Vector3(), _hitPoint = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** the heavy's tip glint: one additive star quad (camera space — the model group is camera-parented, so it always faces the eye) that rides the blade tip through the chop, spinning, then winks out */
class Glint {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private uAlpha: THREE.IUniform<number> = { value: 0 }; private uRot: THREE.IUniform<number> = { value: 0 };
  alpha = 0;
  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: this.uAlpha, uRot: this.uRot },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      // a spinning four-point star with a soft core: |x|^0.5 + |y|^0.5 ≤ 1 in rotated quad space, plus a radial glow
      fragmentShader: `uniform float uAlpha; uniform float uRot; varying vec2 vUv; void main(){
        vec2 p = (vUv - 0.5) * 2.0; float c = cos(uRot), s = sin(uRot); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        vec2 d = abs(p) * 0.85; float st = sqrt(d.x) + sqrt(d.y); float star = st < 1.0 ? pow(1.0 - st, 0.6) : 0.0;
        float glow = max(0.0, 1.0 - length(p) * 1.5); glow *= glow;
        float a = (star * 1.6 + glow * 1.3) * uAlpha; if (a <= 0.002) discard; gl_FragColor = vec4(1.0, 0.97, 0.82, a); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1002; this.mesh.visible = false;
  }
  set(pos: THREE.Vector3) { this.mesh.position.copy(pos); }
  update(dt: number, t: number, lit: boolean) {
    this.alpha = lit ? Math.min(1, this.alpha + dt * 12) : Math.max(0, this.alpha - dt * 7);
    this.mesh.visible = this.alpha > 0.002;
    if (!this.mesh.visible) return;
    this.uAlpha.value = this.alpha; this.uRot.value = t * 9;
    const pulse = 1 + 0.12 * Math.sin(t * 31);
    this.mesh.scale.setScalar(pulse * (0.7 + 0.3 * this.alpha));
  }
}

export class Sword implements Weapon {
  readonly hasAmmo = false;
  readonly reach = REACH;
  readonly state: WeaponState = { loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  /** the heavy's charge held externally (the touch HEAVY disc, or dev `?ads=1`); OR'ed with the right mouse button. On = charging, off = release. */
  adsHeld = false;
  /** base damage per light hit: wooden 12, iron 28 (the finisher ×1.33, the heavy ×2) */
  damage: number;
  /** dev: showcase pose (model centred, slowly turning) */
  inspect = 0;
  /** dev: swing duration multiplier (1 = normal; 8 = slow motion for screenshots) */
  swingScale = 1;
  /** 0..1 weapon-swap blend (a Weapons manager drives it): 1 = dropped out of the frame; 0 = held */
  holster = 0;
  aimInfo: AimInfo | null = null;
  private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };

  onFire?: () => void;
  /** the heavy's release (after onFire): a deeper whoosh — Audio.swordHeavy() */
  onHeavy?: () => void;
  onHit?: (kind: string, headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;

  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player;
  private targets: Targets | undefined;
  private rig = new THREE.Group(); private armRig = new THREE.Group();
  private tipY = 0; private baseY = 0;

  // swing / combo state
  private move: Move | null = null;
  private swingT = 0;
  private fromPos = new THREE.Vector3(); private fromQ = new THREE.Quaternion();   // where the sword was when this swing started
  private basePos = new THREE.Vector3().copy(REST.pos); private baseQ = new THREE.Quaternion().copy(REST.q); // this frame's pose before sway / portrait
  private queued = false;
  private comboIdx = 0;          // index into COMBO of the NEXT light swing
  private lastSwingEnd = -1e9;
  private cooldown = 0;
  private hitDone = false; private kicked = false;
  private fx: CameraFX;
  private jolt = 0;
  // heavy
  private mouseHeld = false; private heldPrev = false;
  private charging = false; private chargeT = 0; private releaseQueued = false; private chargePending = false;
  private chargeBlend = 0; private sprintBlend = 0;
  private fov = FOV_HIP; private baseFov = 0;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseQ = new THREE.Quaternion(); private poseInit = false;
  // lunge
  private active = false; private lungeTarget: AimTarget | null = null;
  // blade sweep (C1): what this swing has struck, and last frame's blade (camera-space unit dirs from the eye, grip + tip)
  private struck: (TargetHit['animal'] | null)[] = Array.from({ length: HIT_MAX }, () => null); private struckN = 0;
  private sweepGrip = new THREE.Vector3(); private sweepTip = new THREE.Vector3(); private sweepHave = false;

  // trail
  private trail!: THREE.Mesh; private trailMat!: THREE.ShaderMaterial; private trailPos!: Float32Array; private trailAlpha!: Float32Array;
  private trailPosAttr!: THREE.BufferAttribute; private trailAlphaAttr!: THREE.BufferAttribute;
  private trailT = new Float32Array(TRAIL_SAMPLES).fill(-1); private trailHead = 0; private trailN = 0;
  private trailStyle = SLASH.trail;
  private trailColor: THREE.IUniform<THREE.Color> = { value: new THREE.Color(1, 1, 1) };
  private stars = new Stars();
  private glint = new Glint();
  private time = 0;

  constructor(world: SwordWorld, targets?: Targets, opts: SwordOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.damage = opts.blade === 'iron' ? DAMAGE_IRON : DAMAGE_WOOD;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.fx = CameraFX.for(this.game); // camera kick / FOV punch (C3); after bootstrap, so it layers on Player.update's camera
    this.buildViewmodel(opts.blade ?? 'wood');
    this.buildTrail();
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.game.scene.add(this.stars.points);
    this.model.add(this.glint.mesh);
    this.bindInput();
  }

  // ── input ──
  inputAllowed(): boolean { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) this.tryFire();
      if (e.button === 2) this.mouseHeld = !this.mouseHeld; // toggle, not hold (trackpad), like the touch HEAVY latch
    });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inputAllowed() || e.repeat) return;
      if (e.code === 'KeyF') this.tryFire();
    });
    window.addEventListener('blur', () => { this.mouseHeld = false; });
  }

  /**
   * A light swing (LMB / F / touch tap). Idle → the next combo swing (1 again if the last swing ended more than
   * COMBO_GAP s ago, or the combo is spent). Mid-swing → queues the next combo swing (one deep; not off the heavy).
   * Ignored while charging the heavy.
   */
  tryFire(): void {
    if (!this.enabled || this.charging) return;
    if (this.move) {
      if (this.move !== HEAVY && this.comboIdx < COMBO.length) this.queued = true;
      return;
    }
    if (this.cooldown > 0) return;
    if (this.comboIdx >= COMBO.length || this.time - this.lastSwingEnd > COMBO_GAP) this.comboIdx = 0;
    const next = COMBO[this.comboIdx++];
    if (next !== undefined) this.startSwing(next);
  }
  private startSwing(move: Move): void {
    this.move = move; this.swingT = 0; this.hitDone = false; this.kicked = false; this.queued = false;
    this.struckN = 0; this.struck.fill(null); this.sweepHave = false;
    this.fromPos.copy(this.basePos); this.fromQ.copy(this.baseQ);
    this.trailN = 0; this.trail.visible = false;
    this.trailStyle = move.trail; this.trailColor.value.copy(move.trail.color);
    // lunge onto the locked animal (a chained combo swing re-locks, so a fleeing target is chased swing by swing)
    const lock = this.findLunge(move === HEAVY ? LUNGE_RANGE_HEAVY : LUNGE_RANGE);
    this.lungeTarget = lock;
    if (lock) {
      const p = this.player.position, go = Math.hypot(lock.position.x - p.x, lock.position.z - p.z) - targetRadius(lock) - LUNGE_STOP;
      this.player.dashTo(lock.position.x, lock.position.z, targetRadius(lock) + LUNGE_STOP, THREE.MathUtils.clamp(go / LUNGE_SPEED, LUNGE_MIN_T, LUNGE_MAX_T));
    }
    this.onFire?.();
    if (move === HEAVY) this.onHeavy?.();
  }
  /** the animal a swing would lunge onto: alive, within `range` m (feet → body edge), inside ±LUNGE_CONE of the view, near the
   *  feet's height — the smallest angle wins, distance breaking near-ties */
  private findLunge(range: number): AimTarget | null {
    const p = this.player.position, yaw = this.player.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let best: AimTarget | null = null, bestScore = Infinity;
    for (const t of getAimTargets()) {
      if (!t.alive || t.hidden || Math.abs(t.position.y - p.y) > 2) continue;
      const dx = t.position.x - p.x, dz = t.position.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.01 || d - targetRadius(t) > range) continue;
      const angle = Math.acos(THREE.MathUtils.clamp((dx * fx + dz * fz) / d, -1, 1));
      if (angle > LUNGE_CONE) continue;
      const score = angle / LUNGE_CONE + 0.3 * d / range;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    return best;
  }
  private beginCharge(): void { this.charging = true; this.chargeT = 0; this.releaseQueued = false; this.chargePending = false; this.comboIdx = 0; }
  private releaseHeavy(): void { this.charging = false; this.releaseQueued = false; this.comboIdx = 0; this.startSwing(HEAVY); }

  /** no ammo to add / nothing to reload */
  addBolts(_n: number): void { /* melee */ }
  reload(): void { /* melee */ }
  /** the aim line: the camera forward from the eye (what the crosshair shows) */
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { const cam = this.game.camera; cam.getWorldDirection(dir); origin.copy(cam.position); return dir; }
  /** shown + held (true) or holstered (false: hidden, input off) */
  setActive(on: boolean): void {
    this.model.visible = on;
    if (!on) { this.enabled = false; this.move = null; this.queued = false; this.charging = false; this.chargePending = false; this.releaseQueued = false; this.trailN = 0; this.trail.visible = false; }
  }
  /** true while a swing is running (dev / tests) */
  get swinging(): boolean { return this.move !== null; }
  /** the running swing's name ('slash' | 'backhand' | 'finisher' | 'heavy'), or null */
  get swingName(): Move['name'] | null { return this.move?.name ?? null; }
  /** true while the running swing is the heavy */
  get heavySwing(): boolean { return this.move === HEAVY; }
  /** true while the heavy is being charged (RMB / HEAVY disc toggled on) */
  get chargingHeavy(): boolean { return this.charging; }
  /** 0..1 heavy charge (1 = ready to release) */
  get charge(): number { return this.charging ? clamp01(this.chargeT / HEAVY_CHARGE) : 0; }
  /** which light swing the next tap throws (1..3) */
  get comboStep(): number { return this.comboIdx >= COMBO.length || (this.move === null && this.time - this.lastSwingEnd > COMBO_GAP) ? 1 : this.comboIdx + 1; }

  // ── viewmodel ──
  private buildViewmodel(blade: 'wood' | 'iron'): void {
    const { sword, arms, tipY, baseY } = buildSword(blade);
    this.tipY = tipY; this.baseY = baseY;
    const mat = new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.82, metalness: blade === 'iron' ? 0.6 : 0, envMapIntensity: 0.6 });
    mat.name = 'sword'; mat.customProgramCacheKey = () => 'sword-lowpoly';
    this.sky.setupMaterial(mat);
    mat.transparent = true; mat.depthWrite = true; // transparent queue, after the depth clear (see below)
    for (const [g, rig] of [[sword, this.rig], [arms, this.armRig]] as [THREE.BufferGeometry, THREE.Group][]) {
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      rig.add(mesh);
    }
    this.model.add(this.rig, this.armRig);
    // depth clear so the viewmodel never clips into world geometry (same trick as Crossbow.ts: 999 in the transparent queue)
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false })); // fogless: draws nothing, shares the fogless MeshBasic program (as the crossbow's);
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
  }

  /** the arc trail: a ribbon of the last TRAIL_SAMPLES blade positions (the outer part of the blade, per move), additive, alpha by age */
  private buildTrail(): void {
    const g = new THREE.BufferGeometry();
    const quads = TRAIL_SAMPLES - 1;
    this.trailPos = new Float32Array(quads * 6 * 3); this.trailAlpha = new Float32Array(quads * 6);
    g.setAttribute('position', (this.trailPosAttr = new THREE.BufferAttribute(this.trailPos, 3)));
    g.setAttribute('aAlpha', (this.trailAlphaAttr = new THREE.BufferAttribute(this.trailAlpha, 1)));
    this.trailPosAttr.setUsage(THREE.DynamicDrawUsage); this.trailAlphaAttr.setUsage(THREE.DynamicDrawUsage);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    g.setDrawRange(0, 0);
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { uColor: this.trailColor },
      vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    this.trail = new THREE.Mesh(g, this.trailMat);
    this.trail.frustumCulled = false; this.trail.renderOrder = 1001; this.trail.visible = false;
    this.model.add(this.trail); // camera space, like the rig — the ribbon is the sword's own motion, not the world's
  }
  private trailA = new Float32Array(TRAIL_SAMPLES * 3); private trailB = new Float32Array(TRAIL_SAMPLES * 3);
  private trailSample(): void {
    // the ribbon spans the blade from the move's `from` fraction to the tip, in the model's (camera) space
    this.rig.updateMatrix();
    _v1.set(0, this.baseY + (this.tipY - this.baseY) * this.trailStyle.from, 0).applyMatrix4(this.rig.matrix);
    _v2.set(0, this.tipY + 0.03, 0).applyMatrix4(this.rig.matrix);
    if (this.trailN > 0) { // skip a sample the tip has not moved for (hit-stop): no zero-width quads
      const l = (this.trailHead - 1 + TRAIL_SAMPLES) % TRAIL_SAMPLES;
      if (_v2.distanceToSquared(_v3.set(this.trailB[l * 3] ?? 0, this.trailB[l * 3 + 1] ?? 0, this.trailB[l * 3 + 2] ?? 0)) < 1e-4) return;
    }
    const i = this.trailHead; this.trailHead = (this.trailHead + 1) % TRAIL_SAMPLES; this.trailN = Math.min(TRAIL_SAMPLES, this.trailN + 1);
    this.trailA[i * 3] = _v1.x; this.trailA[i * 3 + 1] = _v1.y; this.trailA[i * 3 + 2] = _v1.z;
    this.trailB[i * 3] = _v2.x; this.trailB[i * 3 + 1] = _v2.y; this.trailB[i * 3 + 2] = _v2.z;
    this.trailT[i] = this.time;
  }
  private trailRebuild(): void {
    // walk the ring oldest → newest, quad per consecutive pair; alpha fades with age and toward the inner edge
    let live = 0, q = 0;
    const P = this.trailPos, A = this.trailAlpha, n = this.trailN, st = this.trailStyle;
    const life = st.life * this.swingScale;
    for (let k = 0; k < n - 1; k++) {
      const i0 = (this.trailHead - n + k + TRAIL_SAMPLES) % TRAIL_SAMPLES, i1 = (i0 + 1) % TRAIL_SAMPLES;
      const a0 = clamp01(1 - (this.time - (this.trailT[i0] ?? 0)) / life), a1 = clamp01(1 - (this.time - (this.trailT[i1] ?? 0)) / life);
      if (a0 <= 0 && a1 <= 0) continue;
      live++;
      const o = q * 18, oa = q * 6; q++;
      const put = (slot: number, src: Float32Array, idx: number, alpha: number) => {
        P[o + slot * 3] = src[idx * 3] ?? 0; P[o + slot * 3 + 1] = src[idx * 3 + 1] ?? 0; P[o + slot * 3 + 2] = src[idx * 3 + 2] ?? 0; A[oa + slot] = alpha;
      };
      const inner = st.inner, outer = st.alpha;
      // tri 1: A0 B0 B1 · tri 2: A0 B1 A1  (A = inner edge, B = tip)
      put(0, this.trailA, i0, a0 * a0 * inner); put(1, this.trailB, i0, a0 * outer); put(2, this.trailB, i1, a1 * outer);
      put(3, this.trailA, i0, a0 * a0 * inner); put(4, this.trailB, i1, a1 * outer); put(5, this.trailA, i1, a1 * a1 * inner);
    }
    this.trail.geometry.setDrawRange(0, q * 6);
    this.trail.visible = live > 0;
    if (live) { this.trailPosAttr.needsUpdate = true; this.trailAlphaAttr.needsUpdate = true; }
  }

  // ── melee hit test: the blade swept from last frame's pose to this one (see the header) ──
  /** this frame's blade from the swing pose (basePos / baseQ, scale 1): unit dirs from the eye through the grip and tip, camera space */
  private bladeDirs(grip: THREE.Vector3, tip: THREE.Vector3): void {
    grip.copy(this.basePos).normalize();
    tip.set(0, this.tipY, 0).applyQuaternion(this.baseQ).add(this.basePos).normalize();
  }
  private sweepHit(move: Move, active: boolean): void {
    this.bladeDirs(_g1, _t1);
    if (!active || this.targets === undefined || !this.sweepHave || !this.anyInReach()) { this.sweepGrip.copy(_g1); this.sweepTip.copy(_t1); this.sweepHave = true; return; }
    const cam = this.game.camera;
    const ang = Math.max(this.sweepGrip.angleTo(_g1), this.sweepTip.angleTo(_t1));
    const subs = Math.min(SWEEP_SUB_MAX, Math.max(1, Math.ceil(ang / SWEEP_STEP)));
    for (let s = 1; s <= subs && this.struckN < HIT_MAX; s++) {
      const f = s / subs;
      _g0.copy(this.sweepGrip).lerp(_g1, f).normalize(); _t0.copy(this.sweepTip).lerp(_t1, f).normalize();
      for (let k = 0; k < SWEEP_K * (1 + SWEEP_EXT.length); k++) {
        const j = k % SWEEP_K, ext = (k - j) / SWEEP_K;
        _b.copy(_g0).lerp(_t0, j / (SWEEP_K - 1)).normalize();
        if (ext === 0) _dir.copy(_b);
        else { // under the blade: the blade point's dir pitched further down about the camera's right axis
          const a = SWEEP_EXT[ext - 1] ?? 0, c = Math.cos(a), sn = Math.sin(a);
          _dir.set(_b.x, _b.y * c + _b.z * sn, -_b.y * sn + _b.z * c);
        }
        _dir.applyQuaternion(cam.quaternion);
        const hit = this.targets.raycast(cam.position, _dir, REACH);
        if (hit === null || !hit.animal.alive || this.struck.includes(hit.animal)) continue;
        const p = hit.point, e = cam.position;
        if (segmentBlocked(e.x, e.y, e.z, p.x, p.y, p.z, this.player.colliders)) continue;
        this.struck[this.struckN++] = hit.animal;
        this.strike(move, hit);
        if (this.struckN >= HIT_MAX) break;
      }
    }
    this.sweepGrip.copy(_g1); this.sweepTip.copy(_t1);
  }
  /** a live animal's body is within REACH (+ its radius, + a metre of slack) of the eye */
  private anyInReach(): boolean {
    const e = this.game.camera.position;
    for (const t of getAimTargets()) {
      if (!t.alive || t.hidden) continue;
      const r = REACH + targetRadius(t) + 1;
      if (t.position.distanceToSquared(e) < r * r) return true;
    }
    return false;
  }
  private strike(move: Move, hit: TargetHit): void {
    const cam = this.game.camera;
    cam.getWorldDirection(_fwd);
    // strike direction = the sweep (across the forward, the move's way), not the ray: the flinch reads as a side-on blow;
    // an overhead chop (sweep ≈ 0) drives forward and down
    _v2.copy(_fwd).applyAxisAngle(Y_AXIS, Math.PI / 2);                                       // the player's left
    _v1.copy(_fwd).multiplyScalar(0.7).addScaledVector(_v2, 0.7 * move.sweep).normalize();
    if (Math.abs(move.sweep) < 0.6) _v1.y -= 0.35 * (1 - Math.abs(move.sweep)); _v1.normalize();
    const dmg = Math.round(this.damage * move.damage);
    const point = _hitPoint.copy(hit.point); // the raycast result object is reused by the next ray
    const animal = hit.animal;
    const killed = animal.applyDamage(dmg, point, _v1);
    // knockback: away from the player, biased the way the sweep travels (Animal.stagger flattens it)
    _push.set(_fwd.x, 0, _fwd.z).normalize().multiplyScalar(0.8).addScaledVector(_v2, 0.5 * move.sweep);
    if (!killed) (animal as unknown as { stagger?: (dir: THREE.Vector3, strength: number) => void }).stagger?.(_push, move.stagger);
    // hit-stop (C2): the first contact of a swing stops the WORLD (Game.hitStop — the swing, the target, the player) for the
    // move's 60 / 90 / 140 ms; the stars, trail fade and camera kick run on worldTime.realDt through it
    if (!this.hitDone) { this.hitDone = true; this.game.hitStop(move.hitStop * this.swingScale); this.jolt = move === HEAVY ? 1.6 : 1; this.fx.kick(move.kick.pitch * 0.5, move.kick.roll * 0.5); }
    this.stars.burst(point, _fwd, move === HEAVY ? 14 : 9);
    this.onHit?.(animal.kind, false, killed);
    this.onImpact?.('flesh', point);
  }

  /** evaluate a move at `t` s into it → position + quaternion (camera space, scale 1): from-pose → cocked → mid → follow-through → REST */
  private evalSwing(move: Move, t: number, outPos: THREE.Vector3, outQ: THREE.Quaternion): void {
    const k = move.keys;
    let aPos: THREE.Vector3, aQ: THREE.Quaternion, bPos: THREE.Vector3, bQ: THREE.Quaternion, t0: number, t1: number, f: number;
    if (t < k[0].t) { aPos = this.fromPos; aQ = this.fromQ; bPos = k[0].pos; bQ = k[0].q; t0 = 0; t1 = k[0].t; f = easeIn(clamp01((t - t0) / (t1 - t0))); }
    else if (t < k[1].t) { aPos = k[0].pos; aQ = k[0].q; bPos = k[1].pos; bQ = k[1].q; t0 = k[0].t; t1 = k[1].t; f = easeOut(clamp01((t - t0) / (t1 - t0))); } // snap into the slash
    else if (t < k[2].t) { aPos = k[1].pos; aQ = k[1].q; bPos = k[2].pos; bQ = k[2].q; t0 = k[1].t; t1 = k[2].t; f = clamp01((t - t0) / (t1 - t0)); }
    else { aPos = k[2].pos; aQ = k[2].q; bPos = REST.pos; bQ = REST.q; t0 = k[2].t; t1 = move.total; f = sstep(0, 1, clamp01((t - t0) / (t1 - t0))); } // settle out of it
    outPos.copy(aPos).lerp(bPos, f);
    outQ.slerpQuaternions(aQ, bQ, f);
  }

  // ── per-frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.cooldown = Math.max(0, this.cooldown - dt);

    // FOV (Hor+ on portrait; the sword never zooms) + the dodge / lunge kick while in hand (Player.fovKick — transient, so
    // the shadow cascades are only refit for a base change, not every kicked frame)
    const baseFov = fovForAspect(FOV_HIP, cam.aspect);
    const targetFov = baseFov + (this.model.visible ? p.fovKick + this.fx.fovOffset : 0);
    if (Math.abs(targetFov - this.fov) > 0.01) {
      const refit = Math.abs(baseFov - this.baseFov) > 0.01; this.baseFov = baseFov;
      this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix();
      if (refit) this.sky.csm.updateFrustums();
    }

    // heavy: the hold (RMB / touch HEAVY latch) — edge on = start charging (after the running swing, if any), edge off = release
    if (!this.enabled) this.mouseHeld = false; // pause / holster drop the RMB toggle
    const held = (this.mouseHeld || this.adsHeld) && this.enabled;
    if (held && !this.heldPrev) { if (this.move) this.chargePending = true; else this.beginCharge(); }
    if (!held && this.heldPrev) { this.chargePending = false; if (this.charging) { if (this.chargeT >= HEAVY_CHARGE) this.releaseHeavy(); else this.releaseQueued = true; } }
    this.heldPrev = held;
    if (this.charging) {
      this.chargeT += dt;
      if (this.releaseQueued && this.chargeT >= HEAVY_CHARGE) this.releaseHeavy();
    } else if (this.chargePending && !this.move) this.beginCharge();

    // swing clock (a hit-stop slows it with the whole world: dt is scaled, Game.hitStop); a queued combo swing chains the moment the active window closes
    let move = this.move;
    if (move) {
      this.swingT += dt / this.swingScale;
      const next = this.queued && this.swingT >= move.slashEnd + CHAIN_LAG && this.comboIdx < COMBO.length ? COMBO[this.comboIdx++] : undefined;
      if (next !== undefined) { this.startSwing(next); move = this.move; }
      else if (this.swingT >= move.total) { this.move = move = null; this.lastSwingEnd = t; this.cooldown = COOLDOWN; }
    }
    const active = move !== null && this.swingT >= move.windup && this.swingT <= move.slashEnd;
    // the camera leans along the swing as the blade comes through (C3), the heavy punches the FOV in
    if (move && active && !this.kicked && this.model.visible) { this.kicked = true; this.fx.kick(move.kick.pitch, move.kick.roll); if (move.kick.fov !== undefined) this.fx.fovPunch(move.kick.fov); }
    // the melee lock (HUD brackets, touch lunge camera turn): the lunge's target while a swing runs, else what a swing would take
    // now. Every kit weapon ticks, so only the one in hand (its viewmodel shown — the kit's setActive) writes it, and the one
    // that just left the hand clears it once.
    const inHand = this.model.visible;
    if (inHand) {
      if (!move) this.lungeTarget = null;
      else if (this.lungeTarget && !this.lungeTarget.alive) this.lungeTarget = null;
      meleeLock.target = this.lungeTarget ?? (this.enabled ? this.findLunge(this.charging ? LUNGE_RANGE_HEAVY : LUNGE_RANGE) : null);
      meleeLock.lunging = this.lungeTarget !== null && this.player.dashing;
      this.player.swinging = move !== null;
    } else if (this.active) { meleeLock.target = null; meleeLock.lunging = false; this.player.swinging = false; this.lungeTarget = null; }
    this.active = inHand;
    this.jolt *= Math.exp(-dt * 14);

    // charge pose blend (the blade rises over the shoulder), sprint
    this.state.ads = this.charging;
    { const step = dt / CHARGE_BLEND; this.chargeBlend = clamp01(this.chargeBlend + THREE.MathUtils.clamp((this.charging ? 1 : 0) - this.chargeBlend, -step, step)); }
    this.sprintBlend += ((p.sprinting && !move && !this.charging ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);

    // look lag (spring, substepped like the crossbow)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.5, -0.12, 0.12);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.5, -0.1, 0.1);
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 220 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 220 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }

    // base pose: rest, or the swing, blended toward the charge / sprint poses
    const pos = _v1, q = _q;
    if (move) this.evalSwing(move, this.swingT, pos, q);
    else { pos.copy(REST.pos); q.copy(REST.q); }
    const c = sstep(0, 1, this.chargeBlend), sp = this.sprintBlend;
    if (c > 0) {
      pos.lerp(CHARGE.pos, c); q.slerp(CHARGE.q, c);
      // charged: a taut tremble in the raised blade, and a small lift as it comes ready
      const ready = this.charge;
      pos.x += Math.sin(t * 43) * 0.0025 * ready * c; pos.y += (Math.sin(t * 37) * 0.002 + 0.02 * ready) * c;
    }
    if (sp > 0) { pos.lerp(SPRINT.pos, sp); q.slerp(SPRINT.q, sp); }
    this.basePos.copy(pos); this.baseQ.copy(q);
    if (move) this.sweepHit(move, active); // the blade sweep hit test, on this frame's swing pose (before sway / portrait framing)

    // idle sway / walk bob (counter-phase to the camera bob) / look lag / hit jolt — full at the hip, 30 % in the charge
    const m = 1 - c * 0.7, sf = p.speedFactor;
    const swX = Math.sin(t * 0.7) * 0.003, swY = Math.sin(t * 1.1) * 0.0025;
    const bobX = Math.cos(p.bobTime) * 0.018 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.014 * sf;
    pos.x += (swX + bobX + this.lagYaw * 0.25) * m; pos.y += (swY + bobY + this.lagPitch * 0.2) * m; pos.z += this.jolt * 0.05;
    _e.set((Math.sin(p.bobTime * 2) * 0.012 * sf + this.lagPitch + this.jolt * 0.08) * m, this.lagYaw * m, (Math.sin(t * 0.5) * 0.008 + Math.cos(p.bobTime) * 0.02 * sf) * m, 'YXZ');
    q.premultiply(_q2.setFromEuler(_e));

    // portrait phone: the wider FOV + narrow frame put the hands mid-screen — hold the sword lower, further out, smaller
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const scale = 1 - portrait * 0.2;
    pos.x *= 1 - portrait * 0.32; pos.y *= 1 + portrait * 0.1; pos.z *= 1 + portrait * 0.45;
    if (this.holster > 0) { const h = sstep(0, 1, this.holster); pos.y -= h * 0.45; pos.z += h * 0.1; q.premultiply(_q2.setFromEuler(_e.set(-h * 0.6, 0, h * 0.3, 'YXZ'))); } // weapon swap: drop out of the frame
    if (this.inspect) { pos.set(0.0, -0.05, -0.75); q.setFromEuler(_e.set(0.2, Math.sin(t * 0.3) * 0.8, 0.9, 'YXZ')); }
    this.rig.scale.setScalar(scale); this.armRig.scale.setScalar(scale);
    const sm = this.poseInit ? Math.min(1, dt * 30) : 1; this.poseInit = true;
    this.posePos.lerp(pos, sm); this.poseQ.slerp(q, sm);
    this.rig.position.copy(this.posePos); this.rig.quaternion.copy(this.poseQ);
    // forearms: pinned to the hands, but only part of the way round with the sword (the wrists bend, the elbows stay put)
    this.armRig.position.copy(this.posePos);
    this.armRig.quaternion.copy(REST.q).slerp(this.poseQ, ARM_FOLLOW);

    // trail: sample through the slash, then fade
    if (active) this.trailSample();
    if (this.trailN > 0) {
      this.trailRebuild();
      const newest = (this.trailHead - 1 + TRAIL_SAMPLES) % TRAIL_SAMPLES;
      if (t - (this.trailT[newest] ?? t) > this.trailStyle.life * this.swingScale) this.trailN = 0; // every sample has faded: drop the ribbon
    }
    // the heavy's tip glint: on through the chop's active window, then winks out
    const glintOn = move === HEAVY && active;
    if (glintOn) { this.rig.updateMatrix(); this.glint.set(_v2.set(0, this.tipY + 0.02, 0).applyMatrix4(this.rig.matrix)); }
    this.glint.update(worldTime.realDt, t, glintOn);

    // aim readout (HUD "BOAR · 15 M")
    if (this.targets && (++this.aimFrame & 3) === 0) {
      cam.getWorldDirection(_fwd);
      const hit = this.targets.raycast(cam.position, _fwd, 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }
    this.stars.update(worldTime.realDt, this.game.renderer, cam); // particles keep flying through a hit-stop
  }
}
