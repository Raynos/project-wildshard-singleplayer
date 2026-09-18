import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import type { Targets, ImpactSurface } from './Crossbow';
import type { Weapon, WeaponState, AimInfo } from './Weapon';

/**
 * Sword — the Driftwood Isle melee weapon (`ChunkDef.weapon === 'sword'`): a low-poly wooden sword (pale carved blade
 * with a rounded tip, plain crossguard, leather-wrapped grip, dark pommel) held in two low-poly hands lower-right,
 * one horizontal swing with a short additive white arc trail, a cooldown, and a melee hit test. Faceted flat-shaded
 * vertex colours, no textures (mockups: art/driftwood-fp-sword-wooden.png, art/driftwood-fp-spawn.png). The iron
 * sword (art/driftwood-fp-sword-iron.png) is the same rig with `{ blade: 'iron' }` later: steel blade, 28 damage.
 *
 *   const sword = new Sword({ game, sky, player, forest }, targets?, { allowUnlocked?: boolean });
 *   game.onUpdate((dt, t) => sword.update(dt, t));   // register AFTER player.update
 *
 * Implements `Weapon` (src/player/Weapon.ts) — the same surface main.ts / TouchControls / Combat / HUD use on the
 * crossbow: `enabled`, `model`, `state` (no ammo: `bolts` undefined, `hasAmmo = false` → the HUD hides the BOLTS
 * panel), `aimInfo`, `adsHeld`, `tryFire()`, `update(dt, t)`, `addBolts()` (no-op) and the same callbacks.
 *
 * Input (only while `player.locked`, or always when `allowUnlocked`): LMB / `F` swing; RMB (hold) or `adsHeld`
 * (the touch AIM disc) = a guard pose — the sword raised upright in front of the face; harmless, no zoom.
 *
 * Swing: SWING_TIME s — a short wind-up to the right, a horizontal slash right → left across the frame, recover.
 * During the slash (the active window) a fan of rays from the eye (±SWEEP_YAW, three pitches) is cast against
 * `targets.raycast` out to REACH m; the first animal hit takes `applyDamage(damage, point, dir)` once per swing, then
 * `onHit(kind, false, killed)` + `onImpact('flesh', point)` fire (Combat's damage float and the HUD hit marker work
 * unchanged), the swing hit-stops for a beat and a star burst pops at the point. `onFire()` fires at the start of
 * every swing (play the whoosh); nothing else on a miss.
 *
 * Events: onFire() · onHit(kind, headshot=false, killed) · onImpact('flesh', point) · onDry() never · onReload* never.
 * `sword.reach` = REACH so Combat's MISS judgement ignores animals out of range.
 *
 * Side effects (same as the crossbow): owns `game.camera.fov` (Hor+ on portrait) + `sky.csm.updateFrustums()`,
 * parents the viewmodel to `game.camera` (added to the scene if not yet), renders after a depth clear at 999/1000.
 */

export interface SwordWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface SwordOptions { allowUnlocked?: boolean; blade?: 'wood' | 'iron' }

const DAMAGE_WOOD = 12, DAMAGE_IRON = 28;
export const REACH = 2.2;            // m from the eye
const SWEEP_YAW = 0.55;              // rad: half-angle of the horizontal fan the slash covers
const SWING_TIME = 0.35;             // s: wind-up + slash + recover
const COOLDOWN = 0.42;               // s between swings (a hair over the swing: no double-swing on a fast tap)
const WINDUP = 0.07, SLASH_END = 0.235; // s: the active window is [WINDUP, SLASH_END]
const HIT_STOP = 0.045;              // s: the swing freezes on contact
const TRAIL_SAMPLES = 16, TRAIL_LIFE = 0.13; // ribbon samples kept / s a sample lives
const GUARD_BLEND = 0.14;
const ARM_FOLLOW = 0.45;             // the forearms take this much of the sword's rotation away from rest (a cheap elbow)
const FOV_HIP = 72;
/** three's fov is vertical: a fixed 72° on a portrait phone collapses the horizontal view, so widen it (Hor+, same as Crossbow.ts) */
function fovForAspect(base: number, aspect: number) {
  if (aspect >= 1) return base;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / Math.sqrt(aspect)));
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
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
    const a = rings[r], b = rings[r + 1], n = a.length;
    for (let i = 0; i < n; i++) {
      const a0 = a[i], a1 = a[(i + 1) % n], b0 = b[i], b1 = b[(i + 1) % n];
      pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b1.x, b1.y, b1.z);
      pos.push(a0.x, a0.y, a0.z, b1.x, b1.y, b1.z, b0.x, b0.y, b0.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
/** diamond cross-section ring at height y: half-width w along X (the edges), half-thickness t along Z (the flats) */
const diamond = (y: number, w: number, t: number) => [new THREE.Vector3(w, y, 0), new THREE.Vector3(0, y, t), new THREE.Vector3(-w, y, 0), new THREE.Vector3(0, y, -t)];
/** hexagonal blade section: two edges + two flats, so the flat reads as one facet and the edges as bevels */
const hexSection = (y: number, w: number, t: number, flat = 0.5) => [
  new THREE.Vector3(w, y, 0), new THREE.Vector3(w * flat, y, t), new THREE.Vector3(-w * flat, y, t), new THREE.Vector3(-w, y, 0), new THREE.Vector3(-w * flat, y, -t), new THREE.Vector3(w * flat, y, -t),
];
const ring = (y: number, r: number, n: number, rot = 0) => { const out: THREE.Vector3[] = []; for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return out; };
const cap = (ringV: THREE.Vector3[], up: boolean) => { // fan cap over a ring
  const pos: number[] = []; const n = ringV.length; const cx = ringV.reduce((s, v) => s + v.x, 0) / n, cy = ringV[0].y, cz = ringV.reduce((s, v) => s + v.z, 0) / n;
  for (let i = 0; i < n; i++) { const a = ringV[i], b = ringV[(i + 1) % n]; if (up) pos.push(cx, cy, cz, a.x, a.y, a.z, b.x, b.y, b.z); else pos.push(cx, cy, cz, b.x, b.y, b.z, a.x, a.y, a.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
};
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
  parts.push(paint(cap(rings[0], false), bladeCol, 0, 4));
  // ── guard: a plain bar, a touch thicker in the middle, ends knocked off ──
  const gw = 0.20, gh = 0.028, gd = 0.042;
  const gr = [
    [new THREE.Vector3(-gw / 2 + 0.012, guardY - gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY - gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY - gh / 2, gd / 2 - 0.008), new THREE.Vector3(-gw / 2 + 0.012, guardY - gh / 2, gd / 2 - 0.008)],
    [new THREE.Vector3(-gw / 2, guardY - gh / 2 + 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY - gh / 2 + 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY - gh / 2 + 0.006, gd / 2), new THREE.Vector3(-gw / 2, guardY - gh / 2 + 0.006, gd / 2)],
    [new THREE.Vector3(-gw / 2, guardY + gh / 2 - 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY + gh / 2 - 0.006, -gd / 2), new THREE.Vector3(gw / 2, guardY + gh / 2 - 0.006, gd / 2), new THREE.Vector3(-gw / 2, guardY + gh / 2 - 0.006, gd / 2)],
    [new THREE.Vector3(-gw / 2 + 0.012, guardY + gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY + gh / 2, -gd / 2 + 0.008), new THREE.Vector3(gw / 2 - 0.012, guardY + gh / 2, gd / 2 - 0.008), new THREE.Vector3(-gw / 2 + 0.012, guardY + gh / 2, gd / 2 - 0.008)],
  ];
  const guardCol = blade === 'iron' ? lin(0x4a4a50) : C.guard;
  parts.push(paint(loft(gr), guardCol, 0.05, 5)); parts.push(paint(cap(gr[3], true), guardCol, 0, 6)); parts.push(paint(cap(gr[0], false), guardCol, 0, 7));
  // ── grip: octagonal leather core with three raised wrap bands; a short wooden tang collar under the guard ──
  parts.push(paint(loft([ring(-0.075, 0.0165, 8, 0.2), ring(guardY - 0.013, 0.0175, 8, 0.2)]), C.grip, 0.06, 8));
  for (const y of [-0.055, -0.012, 0.031]) {
    parts.push(paint(loft([ring(y - 0.008, 0.0165, 8, 0.2), ring(y - 0.006, 0.0195, 8, 0.2), ring(y + 0.006, 0.0195, 8, 0.2), ring(y + 0.008, 0.0165, 8, 0.2)]), C.wrap, 0.06, 9));
  }
  // ── pommel: a squat six-sided knob ──
  const pr = [ring(-0.078, 0.014, 6, 0.3), ring(-0.088, 0.024, 6, 0.3), ring(-0.104, 0.024, 6, 0.3), ring(-0.112, 0.013, 6, 0.3)];
  parts.push(paint(loft(pr), C.pommel, 0.06, 10)); parts.push(paint(cap(pr[3], false), C.pommel, 0, 11));
  // ── hands: two fists stacked on the grip (right hand above, left below), thumbs over the top toward the blade ──
  for (const [y, seed, upper] of [[0.037, 12, true], [-0.031, 13, false]] as [number, number, boolean][]) {
    const ry = upper ? 0.18 : -0.14;
    const add = (g: THREE.BufferGeometry, col: THREE.Color, sd: number) => { g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry)); g.translate(0, y, 0); parts.push(paint(g, col, 0.035, sd)); };
    add(fist(0.086, 0.062, 0.078, 0.65), C.skin, seed);                              // palm + fingers wrapped round the grip
    for (let k = 0; k < 4; k++) add(xform(fist(0.019, 0.05, 0.03, 0.7), -0.031 + k * 0.021, 0.002, 0.038, 0, 0, 0), k % 2 ? C.skin : C.skinDark, seed + 1 + k); // finger ridges on the eye side
    add(xform(fist(0.05, 0.024, 0.03, 0.7), -0.008, 0.03, 0.028, 0.25, 0.15, -0.45), C.skinDark, seed + 10); // thumb over the top, toward the blade
  }
  // ── forearms: a wrist stub of skin then a wide cream sleeve, angled off toward the lower right / bottom of the frame ──
  const restInv = poseQuat(new THREE.Quaternion(), REST.dir, REST.roll).invert();
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
  const sword = mergeGeometries(parts, false)!, arms = mergeGeometries(armParts, false)!;
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
  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', (this.posAttr = new THREE.BufferAttribute(this.pos, 3)));
    g.setAttribute('aAlpha', (this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1)));
    g.setAttribute('aSize', (this.sizeAttr = new THREE.BufferAttribute(this.size, 1)));
    this.posAttr.setUsage(THREE.DynamicDrawUsage); this.alphaAttr.setUsage(THREE.DynamicDrawUsage); this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
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
    this.mat.uniforms.uScale.value = this.tmpSize.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let any = false;
    for (let i = 0; i < STAR_COUNT; i++) {
      if (this.life[i] <= 0) continue;
      any = true; this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 6 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = this.life[i] > 0 ? Math.min(1, this.life[i] * 5) : 0;
    }
    if (any) { this.posAttr.needsUpdate = true; this.alphaAttr.needsUpdate = true; this.sizeAttr.needsUpdate = true; }
  }
}

// ───────────────────────────── the sword ─────────────────────────────

/** one swing keyframe in camera space: hands position, blade direction, roll about the blade (0 = flat toward the eye) */
interface Key { t: number; pos: THREE.Vector3; dir: THREE.Vector3; roll: number }
const key = (t: number, px: number, py: number, pz: number, dx: number, dy: number, dz: number, roll: number): Key => ({ t, pos: new THREE.Vector3(px, py, pz), dir: new THREE.Vector3(dx, dy, dz).normalize(), roll });
/**
 * The swing, camera space at scale 1 (landscape). Rest = the spawn mockup (hands lower-right, blade up-left toward the
 * frame centre). Wind-up pulls the hands right and cocks the blade back over the shoulder; the slash drops the blade
 * to horizontal and sweeps it right → left across the frame, edge leading; recover eases back to rest.
 */
const REST = key(0, 0.27, -0.33, -0.52, -0.34, 0.76, -0.55, 0.35);
const SWING: Key[] = [
  REST,
  key(WINDUP, 0.42, -0.25, -0.50, 0.62, 0.62, -0.48, 0.55),        // cocked: blade up-right, tip toward the frame's right edge
  key(0.13, 0.22, -0.33, -0.48, -0.70, 0.48, -0.53, 0.3),          // mid-slash: sweeping across, tip upper-left of centre (the mockup frame)
  key(SLASH_END, -0.02, -0.35, -0.46, -0.88, 0.22, -0.42, 0.15),  // follow-through: blade out to the left, still rising a little
  key(SWING_TIME, REST.pos.x, REST.pos.y, REST.pos.z, REST.dir.x, REST.dir.y, REST.dir.z, REST.roll),
];
const GUARD = key(0, 0.17, -0.27, -0.50, -0.50, 0.82, -0.28, 0.15); // raised across the body, the crosshair stays clear
const SPRINT = key(0, 0.34, -0.46, -0.58, -0.2, 0.55, -0.81, 0.6);

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qk = new THREE.Quaternion(), _qk2 = new THREE.Quaternion(), _e = new THREE.Euler();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** quaternion that takes +Y to `dir` then rolls about it */
function poseQuat(out: THREE.Quaternion, dir: THREE.Vector3, roll: number) {
  out.setFromUnitVectors(Y_AXIS, dir);
  return out.multiply(_q2.setFromAxisAngle(Y_AXIS, roll));
}

export class Sword implements Weapon {
  readonly hasAmmo = false;
  readonly reach = REACH;
  readonly state: WeaponState = { loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  /** hold the guard pose externally (touch AIM disc, dev `?ads=1`) — OR'ed with the right mouse button */
  adsHeld = false;
  /** damage per hit: wooden 12, iron 28 */
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
  onHit?: (kind: string, headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;

  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player;
  private targets?: Targets;
  private rig = new THREE.Group(); private armRig = new THREE.Group();
  private restQ = new THREE.Quaternion();
  private tipY = 0; private baseY = 0;

  // swing state
  private swingT = -1;        // s into the swing, -1 = idle
  private cooldown = 0;
  private hitDone = false; private hitStop = 0;
  private jolt = 0;
  private mouseGuard = false; private guardBlend = 0; private sprintBlend = 0;
  private fov = FOV_HIP;
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private posePos = new THREE.Vector3(); private poseQ = new THREE.Quaternion(); private poseInit = false;

  // trail
  private trail!: THREE.Mesh; private trailPos!: Float32Array; private trailAlpha!: Float32Array;
  private trailPosAttr!: THREE.BufferAttribute; private trailAlphaAttr!: THREE.BufferAttribute;
  private trailT = new Float32Array(TRAIL_SAMPLES).fill(-1); private trailHead = 0; private trailN = 0;
  private stars = new Stars();
  private time = 0;

  constructor(world: SwordWorld, targets?: Targets, opts: SwordOptions = {}) {
    this.game = world.game; this.sky = world.sky; this.player = world.player;
    this.targets = targets;
    this.allowUnlocked = !!opts.allowUnlocked;
    this.damage = opts.blade === 'iron' ? DAMAGE_IRON : DAMAGE_WOOD;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.buildViewmodel(opts.blade ?? 'wood');
    this.buildTrail();
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.game.scene.add(this.stars.points);
    this.bindInput();
  }

  // ── input ──
  inputAllowed() { return this.enabled && (this.player.locked || this.allowUnlocked); }
  private bindInput() {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) this.tryFire();
      if (e.button === 2) this.mouseGuard = true;
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 2) this.mouseGuard = false; });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => {
      if (!this.inputAllowed() || e.repeat) return;
      if (e.code === 'KeyF') this.tryFire();
    });
    window.addEventListener('blur', () => { this.mouseGuard = false; });
  }

  /** Swing (LMB / F / touch tap). Ignored while a swing is running or cooling down. */
  tryFire() {
    if (this.swingT >= 0 || this.cooldown > 0 || !this.enabled) return;
    this.swingT = 0; this.cooldown = COOLDOWN; this.hitDone = false; this.hitStop = 0;
    this.onFire?.();
  }
  /** no ammo to add / nothing to reload */
  addBolts(_n: number) { /* melee */ }
  reload() { /* melee */ }
  /** the aim line: the camera forward from the eye (what the crosshair shows) */
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3) { const cam = this.game.camera; cam.getWorldDirection(dir); origin.copy(cam.position); return dir; }
  /** shown + held (true) or holstered (false: hidden, input off) */
  setActive(on: boolean) { this.model.visible = on; if (!on) { this.enabled = false; this.swingT = -1; this.trailN = 0; this.trail.visible = false; } }
  /** true while the blade is in its active window (dev / tests) */
  get swinging() { return this.swingT >= 0; }

  // ── viewmodel ──
  private buildViewmodel(blade: 'wood' | 'iron') {
    const { sword, arms, tipY, baseY } = buildSword(blade);
    this.tipY = tipY; this.baseY = baseY;
    poseQuat(this.restQ, REST.dir, REST.roll);
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
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
  }

  /** the arc trail: a ribbon of the last TRAIL_SAMPLES blade positions (outer half of the blade), additive white, alpha by age */
  private buildTrail() {
    const g = new THREE.BufferGeometry();
    const quads = TRAIL_SAMPLES - 1;
    this.trailPos = new Float32Array(quads * 6 * 3); this.trailAlpha = new Float32Array(quads * 6);
    g.setAttribute('position', (this.trailPosAttr = new THREE.BufferAttribute(this.trailPos, 3)));
    g.setAttribute('aAlpha', (this.trailAlphaAttr = new THREE.BufferAttribute(this.trailAlpha, 1)));
    this.trailPosAttr.setUsage(THREE.DynamicDrawUsage); this.trailAlphaAttr.setUsage(THREE.DynamicDrawUsage);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vA); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    });
    this.trail = new THREE.Mesh(g, mat);
    this.trail.frustumCulled = false; this.trail.renderOrder = 1001; this.trail.visible = false;
    this.model.add(this.trail); // camera space, like the rig — the ribbon is the sword's own motion, not the world's
  }
  private trailA = new Float32Array(TRAIL_SAMPLES * 3); private trailB = new Float32Array(TRAIL_SAMPLES * 3);
  private trailSample() {
    // the ribbon spans the outer 55 % of the blade, in the model's (camera) space
    this.rig.updateMatrix();
    _v1.set(0, this.baseY + (this.tipY - this.baseY) * 0.62, 0).applyMatrix4(this.rig.matrix);
    _v2.set(0, this.tipY + 0.03, 0).applyMatrix4(this.rig.matrix);
    if (this.trailN > 0) { // skip a sample the tip has not moved for (hit-stop): no zero-width quads
      const l = (this.trailHead - 1 + TRAIL_SAMPLES) % TRAIL_SAMPLES;
      if (_v2.distanceToSquared(_v3.set(this.trailB[l * 3], this.trailB[l * 3 + 1], this.trailB[l * 3 + 2])) < 1e-4) return;
    }
    const i = this.trailHead; this.trailHead = (this.trailHead + 1) % TRAIL_SAMPLES; this.trailN = Math.min(TRAIL_SAMPLES, this.trailN + 1);
    this.trailA[i * 3] = _v1.x; this.trailA[i * 3 + 1] = _v1.y; this.trailA[i * 3 + 2] = _v1.z;
    this.trailB[i * 3] = _v2.x; this.trailB[i * 3 + 1] = _v2.y; this.trailB[i * 3 + 2] = _v2.z;
    this.trailT[i] = this.time;
  }
  private trailRebuild() {
    // walk the ring oldest → newest, quad per consecutive pair; alpha fades with age and toward the inner edge
    let live = 0, q = 0;
    const P = this.trailPos, A = this.trailAlpha, n = this.trailN;
    for (let k = 0; k < n - 1; k++) {
      const i0 = (this.trailHead - n + k + TRAIL_SAMPLES) % TRAIL_SAMPLES, i1 = (i0 + 1) % TRAIL_SAMPLES;
      const life = TRAIL_LIFE * this.swingScale;
      const a0 = clamp01(1 - (this.time - this.trailT[i0]) / life), a1 = clamp01(1 - (this.time - this.trailT[i1]) / life);
      if (a0 <= 0 && a1 <= 0) continue;
      live++;
      const o = q * 18, oa = q * 6; q++;
      const put = (slot: number, src: Float32Array, idx: number, alpha: number) => {
        P[o + slot * 3] = src[idx * 3]; P[o + slot * 3 + 1] = src[idx * 3 + 1]; P[o + slot * 3 + 2] = src[idx * 3 + 2]; A[oa + slot] = alpha;
      };
      const inner = 0.0, outer = 0.6;
      // tri 1: A0 B0 B1 · tri 2: A0 B1 A1  (A = inner edge, B = tip)
      put(0, this.trailA, i0, a0 * a0 * inner); put(1, this.trailB, i0, a0 * outer); put(2, this.trailB, i1, a1 * outer);
      put(3, this.trailA, i0, a0 * a0 * inner); put(4, this.trailB, i1, a1 * outer); put(5, this.trailA, i1, a1 * a1 * inner);
    }
    (this.trail.geometry as THREE.BufferGeometry).setDrawRange(0, q * 6);
    this.trail.visible = live > 0;
    if (live) { this.trailPosAttr.needsUpdate = true; this.trailAlphaAttr.needsUpdate = true; }
  }

  // ── melee hit test: a fan of rays from the eye across the slash's sweep, out to REACH ──
  private static YAWS = [0, -0.18, 0.18, -0.36, 0.36, -SWEEP_YAW, SWEEP_YAW];
  private static PITCHES = [-0.3, 0.0, -0.6, -0.9]; // a boar at your feet is ~40° below the eye
  private testHit() {
    if (!this.targets) return;
    const cam = this.game.camera;
    cam.getWorldDirection(_fwd);
    _v3.copy(cam.position);
    _e.set(0, 0, 0, 'YXZ');
    for (const pitch of Sword.PITCHES) for (const yaw of Sword.YAWS) {
      _e.y = yaw; _e.x = pitch;
      _q.setFromEuler(_e); _q.premultiply(cam.quaternion);
      _dir.set(0, 0, -1).applyQuaternion(_q);
      const hit = this.targets.raycast(_v3, _dir, REACH);
      if (!hit || !hit.animal.alive) continue;
      // strike direction = the sweep (right → left across the forward), not the ray: the flinch reads as a side-on blow
      _v1.copy(_fwd).applyAxisAngle(Y_AXIS, Math.PI / 2).multiplyScalar(0.7).addScaledVector(_fwd, 0.7).normalize();
      const killed = hit.animal.applyDamage(this.damage, hit.point, _v1);
      this.hitDone = true; this.hitStop = HIT_STOP; this.jolt = 1;
      this.stars.burst(hit.point, _fwd);
      this.onHit?.(hit.animal.kind, false, killed);
      this.onImpact?.('flesh', hit.point);
      return;
    }
  }

  /** evaluate the swing keys at `t` s into the swing → position + quaternion (camera space, scale 1) */
  private evalSwing(t: number, outPos: THREE.Vector3, outQ: THREE.Quaternion) {
    let k = 0; while (k < SWING.length - 2 && t > SWING[k + 1].t) k++;
    const a = SWING[k], b = SWING[k + 1];
    let f = clamp01((t - a.t) / (b.t - a.t));
    f = k === 0 ? easeIn(f) : k === SWING.length - 2 ? sstep(0, 1, f) : k === 1 ? easeOut(f) : f; // snap into the slash, settle out of it
    outPos.copy(a.pos).lerp(b.pos, f);
    poseQuat(_qk, a.dir, a.roll); poseQuat(_qk2, b.dir, b.roll);
    outQ.slerpQuaternions(_qk, _qk2, f); // (qb must not be outQ: slerpQuaternions copies qa into this first)
  }

  // ── per-frame ──
  update(dt: number, t: number) {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    this.cooldown = Math.max(0, this.cooldown - dt);

    // FOV (Hor+ on portrait; the sword never zooms)
    const targetFov = fovForAspect(FOV_HIP, cam.aspect);
    if (Math.abs(targetFov - this.fov) > 0.01) { this.fov = targetFov; cam.fov = this.fov; cam.updateProjectionMatrix(); this.sky.csm.updateFrustums(); }

    // swing clock (hit-stop holds it on contact)
    if (this.swingT >= 0) {
      if (this.hitStop > 0) this.hitStop -= dt; else this.swingT += dt / this.swingScale;
      if (this.swingT >= SWING_TIME) this.swingT = -1;
    }
    const swinging = this.swingT >= 0, active = swinging && this.swingT >= WINDUP && this.swingT <= SLASH_END;
    if (active && !this.hitDone) this.testHit();
    this.jolt *= Math.exp(-dt * 14);

    // guard pose (RMB / touch AIM latch), sprint
    this.state.ads = (this.mouseGuard || this.adsHeld) && this.enabled && !swinging && !p.sprinting;
    { const step = dt / GUARD_BLEND; this.guardBlend = clamp01(this.guardBlend + THREE.MathUtils.clamp((this.state.ads ? 1 : 0) - this.guardBlend, -step, step)); }
    this.sprintBlend += ((p.sprinting && !swinging ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);

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

    // base pose: rest, or the swing, blended toward guard / sprint
    const pos = _v1, q = _q;
    if (swinging) this.evalSwing(this.swingT, pos, q);
    else { pos.copy(REST.pos); poseQuat(q, REST.dir, REST.roll); }
    const g = sstep(0, 1, this.guardBlend), sp = this.sprintBlend;
    if (g > 0) { pos.lerp(GUARD.pos, g); q.slerp(poseQuat(_qk, GUARD.dir, GUARD.roll), g); }
    if (sp > 0) { pos.lerp(SPRINT.pos, sp); q.slerp(poseQuat(_qk, SPRINT.dir, SPRINT.roll), sp); }

    // idle sway / walk bob (counter-phase to the camera bob) / look lag / hit jolt — full at the hip, 30 % in the guard
    const m = 1 - g * 0.7, sf = p.speedFactor;
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
    this.armRig.quaternion.copy(this.restQ).slerp(this.poseQ, ARM_FOLLOW);

    // trail: sample through the slash, then fade
    if (active) this.trailSample();
    if (this.trailN > 0) {
      this.trailRebuild();
      const newest = (this.trailHead - 1 + TRAIL_SAMPLES) % TRAIL_SAMPLES;
      if (t - this.trailT[newest] > TRAIL_LIFE * this.swingScale) this.trailN = 0; // every sample has faded: drop the ribbon
    }

    // aim readout (HUD "BOAR · 15 M")
    if (this.targets && (++this.aimFrame & 3) === 0) {
      cam.getWorldDirection(_fwd);
      const hit = this.targets.raycast(cam.position, _fwd, 120);
      if (hit && hit.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }
    this.stars.update(dt, this.game.renderer, cam);
  }
}
