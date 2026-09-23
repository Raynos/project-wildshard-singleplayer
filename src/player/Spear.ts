import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from './Player';
import type { Forest } from '../world/Forest';
import type { Targets, ImpactSurface, TargetAnimal } from './Crossbow';
import type { Weapon, WeaponState, AimInfo } from './Weapon';
import { heightAt } from '../world/Heightfield';
import { getAimTargets, targetRadius, type AimTarget } from './AimTargets';
import { tube, blob, xf, merge, lin, forearm, meleeMaterial, section, type ColorAt } from './meleeGeo';
import { painterlyMaterial } from '../world/painterly';

/**
 * Spear — the Nalati spear + javelins (ASKS N6, plan row B3; design docs/design/nalati/combat.md § B; mockups
 * art/nalati-grasslands/round-2/1-combat/combat-B-spear-brace.png, combat-B2-javelin-throw.png). The plan's decision:
 * **javelins are thrown from the spear slot** (3 slots: bow, sabre, spear).
 *
 *   const spear = new Spear({ game, sky, player, forest }, targets, { allowUnlocked });
 *   kit: extras [{ weapon: spear, id: 'spear', name: 'Spear' }] (Weapons.ts; see nalatiKit.ts)
 *   game.onUpdate((dt, t) => spear.update(dt, t));   // AFTER player.update (the kit manager does it)
 *
 * A painterly viewmodel: a long ash shaft (2 m), a leaf-shaped iron head with a red horsehair tassel, held two-handed low
 * on the right (the rider's red embroidered sleeves, meleeGeo.forearm).
 *
 * THRUST — LMB / F / a LOOK tap (`tryFire`): 0.35 s (0.12 wind-up, 0.1 active), reach 3.2 m (a metre past the sabre), a
 * narrow fan (yaw ±0.1 rad), 30 damage, light stagger (0.5). No lunge: the spear keeps a wolf at arm's length.
 *
 * BRACE — the touch BRACE disc (replaces JUMP while the spear is held: `altHeld`), or HOLD RMB on desktop (past 0.25 s):
 * the butt is planted in BRACE_SET s; while set the player cannot walk (`player.moveScale` 0) and a faint cyan ring
 * lights at the point. Anything that runs onto the point — its body within REACH of the eye, inside ±30° of the view,
 * closing faster than 4 m/s — takes 60 + 8 × its speed and a heavy stagger (which ends a charge: Animal.stagger), once
 * per BRACE_REHIT s. A charge from outside the cone hits you as normal. Held at most BRACE_MAX s, then BRACE_COOLDOWN.
 *
 * JAVELINS (3 carried, `maxJavelins` → 5 with the camp upgrade) — the touch THROW disc (the left disc, where AIM sits:
 * `adsHeld`, held): press = the spear drops to the left hand and a javelin comes up cocked by the right ear (WINDUP s to
 * full) with a dotted throw arc; release = throw (a release before full throws the moment it is). Desktop: a quick RMB
 * TAP (< 0.25 s) throws. Flight: 28 m/s (+ `mount` velocity), full gravity, 55 body × 2 head, heavy stagger; it sticks in
 * the ground / a trunk (a hit animal drops it at its feet) and is picked up by walking over it (90 % survive).
 * `javelins` / `maxJavelins` feed the HUD (state.bolts / magazine: the JAVELINS pips).
 *
 * COUCHED LANCE (mounted — `spear.mount = { speed, yaw }`, set by the riding row B7): at canter or faster (≥ 8 m/s) the
 * spear levels by itself; an animal inside 2.5 m ahead ±15° of the horse's heading takes 40 + 6 × v (once per 1.2 s).
 *
 * Implements `Weapon` (+ the kit hooks `holster`, `reload`, `aimRay`, `inputAllowed`, `altHeld`, `ammoLabel`, `segments`,
 * `magazine`). Events: onFire on every thrust and throw · onThrow on a throw (after onFire) · onBrace(on) · onHit ·
 * onImpact · onDry (THROW with none left) · onPickup (a javelin recovered).
 */

export interface SpearWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface SpearOptions { allowUnlocked?: boolean }
export interface MountState { speed: number; yaw: number }

export const REACH = 3.2;
const THRUST_DAMAGE = 30, THRUST_STAGGER = 0.5;
const T_WIND = 0.12, T_ACTIVE_END = 0.22, T_TOTAL = 0.35;
const THRUST_FAN = { yaws: [0, -0.05, 0.05, -0.1, 0.1], pitches: [0, -0.15, -0.3, -0.5, -0.7] };
const BRACE_SET = 0.25, BRACE_MAX = 4, BRACE_COOLDOWN = 1, BRACE_REHIT = 1.2;
const BRACE_CONE = 30 * Math.PI / 180, BRACE_MIN_SPEED = 4;
const LANCE_REACH = 2.5, LANCE_CONE = 15 * Math.PI / 180, LANCE_MIN_SPEED = 8;
const WINDUP = 0.4, THROW_T = 0.14, THROW_RECOVER = 0.45;
const JAV_SPEED = 28, JAV_GRAVITY = 9.8, JAV_DAMAGE = 55, JAV_HEAD = 2;
const JAV_POOL = 5, PICKUP_R = 1.6, JAV_SURVIVE = 0.9;
const ARC_POINTS = 32, ARC_SHOW_AFTER = 0.12;
const FOV_HIP = 72;

function fovForAspect(base: number, aspect: number): number {
  if (aspect >= 1) return base;
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(base) / 2) / Math.sqrt(aspect)));
}
const clamp01 = (v: number) => (v < 0 ? 0 : Math.min(1, v));
const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ───────────────────────────── geometry (+Y = toward the head; origin = the right hand's grip) ─────────────────────────────

const ASH = lin(0xcfa874), ASH_DARK = lin(0x9c7447), ASH_WORN = lin(0x7d5a36);
const IRON = lin(0x737c86), IRON_EDGE = lin(0xdfe4e8), IRON_DARK = lin(0x3f454d);
const CORD = lin(0x4a2c1a), TASSEL = lin(0xb3261e), TASSEL_DARK = lin(0x6f1510);

const shaftCol = (worn: [number, number][], y0: number, y1: number): ColorAt => (v, a, out) => {
  const y = y0 + (y1 - y0) * v;
  out.copy(ASH).lerp(ASH_DARK, 0.35 + 0.35 * Math.sin(a * Math.PI * 6 + y * 3.1) * Math.sin(y * 17.0 + a * 4)); // painted grain
  for (const [c, w] of worn) if (Math.abs(y - c) < w) out.lerp(ASH_WORN, 0.55);                                // hand-worn
  return out;
};

/** a leaf blade along +Y from `y0`, `len` long, half-width `w`; a midrib ridge, bright bevelled edges */
function leafHead(y0: number, len: number, w: number, t: number): THREE.BufferGeometry {
  const SEC: [number, number, number][] = [[1, 0, 1], [0.45, 0.4, 0.3], [0, 1, 0], [-0.45, 0.4, 0.3], [-1, 0, 1], [-0.45, -0.4, 0.3], [0, -1, 0], [0.45, -0.4, 0.3]];
  const fs = [0, 0.08, 0.2, 0.34, 0.48, 0.62, 0.76, 0.88, 0.96, 1];
  const rings = fs.map((f) => { const ww = Math.max(0.0006, w * Math.sin(Math.PI * Math.min(1, f ** 0.72 * 1.02)) * (f < 0.1 ? 0.6 + 4 * f : 1)), tt = Math.max(0.0004, t * (1 - 0.8 * f)); return SEC.map(([sx, sz]) => new THREE.Vector3(sx * ww, y0 + len * f, sz * tt)); });
  return tube(rings, (v, a, out) => { const i = Math.round(a * SEC.length) % SEC.length; const e = SEC[i]?.[2] ?? 0; return out.copy(IRON).lerp(IRON_EDGE, e * 0.85).lerp(IRON_DARK, v < 0.08 ? 0.5 : 0); }, { capStart: true });
}
/** the horsehair tassel: a flared skirt of red below `y` */
function tassel(y: number, len: number, r0: number, r1: number): THREE.BufferGeometry {
  const rings: THREE.Vector3[][] = [];
  for (let k = 0; k <= 4; k++) {
    const f = k / 4, ring: THREE.Vector3[] = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, jag = f > 0.7 ? (i % 2 ? 0.75 : 1.1) : 1; const r = (r0 + (r1 - r0) * f ** 0.7) * jag; ring.push(new THREE.Vector3(Math.cos(a) * r, y - len * f * jag, Math.sin(a) * r)); }
    rings.push(ring);
  }
  return tube(rings, (v, a, out) => out.copy(TASSEL).lerp(TASSEL_DARK, 0.25 + 0.3 * Math.sin(a * 40) + 0.3 * v));
}

function buildSpear(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const yButt = -0.9, ySocket = 1.0;
  const shaft: THREE.Vector3[][] = [];
  for (let k = 0; k <= 16; k++) { const f = k / 16, y = yButt + (ySocket - yButt) * f; shaft.push(section(10, 0.0165 - 0.003 * f, 0.0165 - 0.003 * f, y)); }
  parts.push(tube(shaft, shaftCol([[0, 0.07], [0.45, 0.07]], yButt, ySocket), { capStart: true }));
  parts.push(xf(blob(0.019, 0.02, 0.019, IRON_DARK, 10, 0.3), 0, yButt, 0));                                    // butt cap
  const socket: THREE.Vector3[][] = [section(10, 0.0152, 0.0152, ySocket - 0.03), section(10, 0.0162, 0.0162, ySocket + 0.01), section(10, 0.012, 0.012, ySocket + 0.07), section(10, 0.0085, 0.0085, ySocket + 0.1)];
  parts.push(tube(socket, (v, _a, out) => out.copy(IRON_DARK).lerp(IRON, v)));
  for (const y of [ySocket - 0.05, ySocket - 0.075]) parts.push(tube([section(10, 0.0168, 0.0168, y - 0.006), section(10, 0.0182, 0.0182, y), section(10, 0.0168, 0.0168, y + 0.006)], (_v, _a, out) => out.copy(CORD))); // cord binding
  parts.push(tassel(ySocket - 0.03, 0.12, 0.018, 0.045));
  parts.push(leafHead(ySocket + 0.09, 0.34, 0.046, 0.008));
  return merge(parts);
}
/** the javelin: a slimmer 1.4 m shaft, a narrow leaf head, a red tuft at the tail — origin at its balance point */
function buildJavelin(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const y0 = -0.62, y1 = 0.62;
  const shaft: THREE.Vector3[][] = [];
  for (let k = 0; k <= 8; k++) { const f = k / 8, y = y0 + (y1 - y0) * f; shaft.push(section(8, 0.0115 - 0.002 * f, 0.0115 - 0.002 * f, y)); }
  parts.push(tube(shaft, shaftCol([[0, 0.06]], y0, y1), { capStart: true }));
  parts.push(tube([section(8, 0.0095, 0.0095, y1 - 0.01), section(8, 0.0105, 0.0105, y1 + 0.02), section(8, 0.006, 0.006, y1 + 0.05)], (v, _a, out) => out.copy(IRON_DARK).lerp(IRON, v)));
  parts.push(leafHead(y1 + 0.04, 0.17, 0.02, 0.005));
  parts.push(tassel(y0 + 0.13, 0.13, 0.012, 0.032));
  return merge(parts);
}

// ───────────────────────────── poses (camera space: +X right, +Y up, -Z forward; the right hand's grip point + the shaft's direction) ─────────────────────────────

interface Pose { pos: THREE.Vector3; q: THREE.Quaternion }
const Y = new THREE.Vector3(0, 1, 0);
const _qr = new THREE.Quaternion();
function pose(px: number, py: number, pz: number, dx: number, dy: number, dz: number, roll = 0): Pose {
  const q = new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(dx, dy, dz).normalize());
  q.multiply(_qr.setFromAxisAngle(Y, roll));
  return { pos: new THREE.Vector3(px, py, pz), q };
}
const REST = pose(0.22, -0.25, -0.42, -0.12, 0.13, -0.98, 0.4);       // two hands, low right, the head just under the frame centre
const COCK = pose(0.25, -0.27, -0.26, -0.11, 0.13, -0.98, 0.4);      // thrust wind-up: drawn back
const JAB = pose(0.13, -0.2, -0.9, -0.04, 0.06, -1, 0.4);          // thrust at full extension
const BRACED = pose(0.2, -0.46, -0.36, -0.05, 0.3, -0.95, 0.3);      // butt planted, the point at a charging boar's chest
const LEFT_LOW = pose(-0.3, -0.52, -0.38, 0.2, 0.42, -0.88, -0.5);   // throwing: the spear in the left hand, low left (combat-B2)
const SPRINT = pose(0.26, -0.4, -0.3, -0.35, 0.42, -0.84, 0.6);
const LANCE = pose(0.16, -0.3, -0.5, -0.02, 0.02, -1, 0.3);          // couched: level, dead ahead
const JAV_COCK = pose(0.3, -0.05, -0.34, -0.08, 0.1, -0.99, 0.2);    // the javelin cocked by the right ear
const JAV_OUT = pose(0.12, -0.12, -0.72, -0.02, 0.02, -1, 0.2);      // the throwing hand, arm out after the release
const LEFT_HAND_Y = 0.46;                                           // the left fist sits this far up the shaft from the right

// ───────────────────────────── the weapon ─────────────────────────────

interface Jav { state: 0 | 1 | 2; pos: THREE.Vector3; vel: THREE.Vector3; q: THREE.Quaternion; age: number }  // 0 none · 1 flying · 2 stuck
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s1 = new THREE.Vector3(1, 1, 1);
const _vThrow = new THREE.Vector3(), _qThrow = new THREE.Quaternion(), _vCock = new THREE.Vector3(), _qCock = new THREE.Quaternion();
const _qSway = new THREE.Quaternion(), _qHol = new THREE.Quaternion();

export class Spear implements Weapon {
  readonly hasAmmo = true;
  readonly reach = REACH;
  readonly ammoLabel = 'Javelins';
  readonly state: WeaponState = { bolts: 3, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  enabled = true;
  allowUnlocked = false;
  /** the touch THROW disc (held): press = wind up, release = throw */
  adsHeld = false;
  /** the touch BRACE disc (held) */
  altHeld = false;
  /** 0..1 weapon-swap blend (the kit drives it): 1 = dropped out of the frame */
  holster = 0;
  /** the riding row's hook (B7): horse speed / heading while mounted, null on foot */
  mount: MountState | null = null;
  /** javelins carried now / at most (3; the camp upgrade makes it 5) */
  javelins = 3;
  maxJavelins = 3;
  /** show the dotted throw arc while winding up (touch default on — the bow's Hunter's-eye rule) */
  showArc = true;
  aimInfo: AimInfo | null = null;
  /** dev: showcase pose */
  inspect = 0;

  onFire?: () => void;
  onThrow?: () => void;
  onBrace?: (on: boolean) => void;
  onPickup?: (n: number) => void;
  onHit?: (kind: string, headshot: boolean, killed: boolean) => void;
  onImpact?: (surface: ImpactSurface, point: THREE.Vector3) => void;
  onReloadStart?: () => void;
  onReloadEnd?: () => void;
  onDry?: () => void;

  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player; private forest: Forest;
  private targets: Targets | undefined;
  private spearRig = new THREE.Group(); private handRig = new THREE.Group();
  private heldJav!: THREE.Mesh;
  private ring!: THREE.Mesh; private ringMat!: THREE.MeshBasicMaterial;
  private arc!: THREE.Points; private arcPos = new Float32Array(ARC_POINTS * 3); private arcAttr!: THREE.BufferAttribute; private arcMat!: THREE.PointsMaterial;
  private world!: THREE.InstancedMesh;
  private javs: Jav[] = [];
  private time = 0;
  // thrust
  private thrustT = -1; private hitDone = false; private queued = false;
  // brace
  private braceT = 0; private braceHeldT = 0; private braceCd = 0; private braced = false; private rehit = new Map<object, number>();
  private rmbDown = false; private rmbT = 0;
  // throw
  private windT = -1; private throwT = -1; private releaseQueued = false; private throwPrev = false; private threw = false;
  // lance
  private lanceBlend = 0;
  // look lag / sway
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private fov = FOV_HIP; private baseFov = 0; private jolt = 0; private sprintBlend = 0;
  private braceBlend = 0; private throwBlend = 0; private inHand = false; private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };
  private prevPos = new Map<object, THREE.Vector3>();

  constructor(w: SpearWorld, targets?: Targets, opts: SpearOptions = {}) {
    this.game = w.game; this.sky = w.sky; this.player = w.player; this.forest = w.forest;
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.build();
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.bindInput();
  }

  // ── kit surface ──
  get segments(): number { return this.maxJavelins; }
  get magazine(): number { return this.maxJavelins; }
  get bracing(): boolean { return this.braced; }
  get winding(): boolean { return this.windT >= 0; }
  get thrusting(): boolean { return this.thrustT >= 0; }
  /** javelins in flight or stuck in the world (dev / HUD) */
  get javelinsOut(): number { let n = 0; for (const j of this.javs) if (j.state !== 0) n++; return n; }
  inputAllowed(): boolean { return this.enabled && (this.player.locked || this.allowUnlocked); }
  addBolts(n: number): void { this.javelins = Math.min(this.maxJavelins, this.javelins + Math.max(0, n)); }
  reload(): void { /* nothing to reload: javelins are picked up */ }
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { const cam = this.game.camera; cam.getWorldDirection(dir); origin.copy(cam.position); return dir; }

  private bindInput(): void {
    document.addEventListener('mousedown', (e) => {
      if (!this.inputAllowed()) return;
      if (e.button === 0) this.tryFire();
      if (e.button === 2) { this.rmbDown = true; this.rmbT = 0; }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button !== 2 || !this.rmbDown) return;
      this.rmbDown = false;
      if (this.inputAllowed() && this.rmbT < BRACE_SET) this.requestThrow(); // a tap throws; a hold was a brace
    });
    document.addEventListener('contextmenu', (e) => { if (this.inputAllowed()) e.preventDefault(); });
    document.addEventListener('keydown', (e) => { if (!this.inputAllowed() || e.repeat) return; if (e.code === 'KeyF') this.tryFire(); });
    window.addEventListener('blur', () => { this.rmbDown = false; });
  }

  /** a thrust (LMB / F / LOOK tap); mid-thrust queues one; ignored while bracing or throwing */
  tryFire(): void {
    if (!this.enabled || this.braced || this.windT >= 0 || this.throwT >= 0) return;
    if (this.thrustT >= 0) { if (this.thrustT > T_WIND) this.queued = true; return; }
    this.thrustT = 0; this.hitDone = false; this.queued = false;
    this.onFire?.();
  }
  /** desktop tap / touch release: wind up (if not yet) and throw as soon as the wind-up is full */
  private requestThrow(): void {
    if (this.windT < 0 && !this.beginWind()) return;
    this.releaseQueued = true;
  }
  private beginWind(): boolean {
    if (!this.enabled || this.throwT >= 0 || this.braced) return false;
    if (this.javelins <= 0) { this.onDry?.(); return false; }
    this.thrustT = -1; this.queued = false;
    this.windT = 0; this.releaseQueued = false;
    return true;
  }

  // ── build ──
  private build(): void {
    const mat = meleeMaterial(this.sky);
    const restInv = REST.q.clone().invert();
    // the spear + the left hand (+ its forearm) as one rig; the right hand is its own rig (it leaves the shaft to throw)
    const leftArmDir = new THREE.Vector3(-0.42, -0.62, 0.66).normalize().applyQuaternion(restInv);
    const left = forearm(leftArmDir, 0.62, 0.0165);
    left.translate(0, LEFT_HAND_Y, 0);
    const spear = merge([buildSpear(), left]);
    const rightArmDir = new THREE.Vector3(0.62, -0.5, 0.6).normalize().applyQuaternion(restInv);
    const right = forearm(rightArmDir, 0.62, 0.0165);
    for (const [g, rig] of [[spear, this.spearRig], [right, this.handRig]] as [THREE.BufferGeometry, THREE.Group][]) {
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      rig.add(mesh);
    }
    const javGeo = buildJavelin();
    this.heldJav = new THREE.Mesh(javGeo, mat);
    this.heldJav.frustumCulled = false; this.heldJav.renderOrder = 1000; this.heldJav.visible = false;
    this.heldJav.position.set(0, 0.1, 0); // the right hand grips it just behind the balance point
    this.handRig.add(this.heldJav);
    this.model.add(this.spearRig, this.handRig);
    // the BRACE ring: a faint cyan hoop round the point, lit only while set (combat-B)
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.0035, 6, 48, Math.PI * 1.55), this.ringMat);
    this.ring.renderOrder = 1001; this.ring.frustumCulled = false; this.ring.visible = false;
    this.model.add(this.ring);
    // depth clear so the viewmodel never clips into the world (Sword.ts / Crossbow.ts: 999 in the transparent queue)
    const clearer = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.001, 0.001), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, fog: false }));
    clearer.renderOrder = 999; clearer.frustumCulled = false;
    clearer.onBeforeRender = (renderer) => { renderer.clearDepth(); };
    this.model.add(clearer);
    // the dotted throw arc (world space)
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', (this.arcAttr = new THREE.BufferAttribute(this.arcPos, 3)));
    this.arcAttr.setUsage(THREE.DynamicDrawUsage);
    ag.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.arcMat = new THREE.PointsMaterial({ color: 0x8fe3ff, size: 6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
    this.arc = new THREE.Points(ag, this.arcMat);
    this.arc.frustumCulled = false; this.arc.renderOrder = 1003; this.arc.visible = false;
    this.game.scene.add(this.arc);
    // thrown javelins: one instanced mesh for every javelin in the world
    const wmat = painterlyMaterial(this.sky, { vertexColors: true, rim: 0.4 });
    this.world = new THREE.InstancedMesh(javGeo, wmat, JAV_POOL);
    this.world.count = 0; this.world.castShadow = true; this.world.receiveShadow = true; this.world.frustumCulled = false;
    this.game.scene.add(this.world);
    for (let i = 0; i < JAV_POOL; i++) this.javs.push({ state: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), age: 0 });
  }

  // ── javelins in the world ──
  private launch(): void {
    const j = this.javs.find((x) => x.state === 0);
    if (j === undefined || this.javelins <= 0) return;
    this.javelins--;
    const cam = this.game.camera;
    cam.getWorldDirection(_fwd);
    // leave from beside the right ear, aimed 2° over the crosshair (a heavy javelin is thrown a little up)
    _v1.set(0.22, 0.05, -0.3).applyQuaternion(cam.quaternion).add(cam.position);
    _v2.set(1, 0, 0).applyQuaternion(cam.quaternion);
    _dir.copy(_fwd).applyAxisAngle(_v2, 0.035).normalize();
    j.state = 1; j.age = 0; j.pos.copy(_v1); j.vel.copy(_dir).multiplyScalar(JAV_SPEED);
    const m = this.mount;
    if (m !== null) { j.vel.x -= Math.sin(m.yaw) * m.speed; j.vel.z -= Math.cos(m.yaw) * m.speed; } // the horse's velocity rides along
    j.q.setFromUnitVectors(Y, _dir);
    this.onFire?.(); this.onThrow?.();
  }
  private stick(j: Jav, at: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface): void {
    // embed the head ~0.25 m: the balance point sits 0.62 + 0.21 - 0.25 back along the flight
    j.state = 2; j.age = 0; j.vel.set(0, 0, 0);
    j.q.setFromUnitVectors(Y, _v3.copy(dir).normalize());
    j.pos.copy(at).addScaledVector(_v3, -0.58);
    this.onImpact?.(surface, at);
  }
  private drop(j: Jav, at: THREE.Vector3): void {
    // a javelin that hit an animal falls beside it, head down-ish into the turf
    const a = Math.random() * Math.PI * 2;
    _v1.set(at.x + Math.cos(a) * 0.6, 0, at.z + Math.sin(a) * 0.6);
    _v1.y = heightAt(_v1.x, _v1.z);
    _dir.set(Math.cos(a + 1.3) * 0.7, -0.55, Math.sin(a + 1.3) * 0.7).normalize();
    j.state = 2; j.age = 0; j.vel.set(0, 0, 0);
    j.q.setFromUnitVectors(Y, _dir);
    j.pos.copy(_v1).addScaledVector(_dir, -0.45);
  }
  private flyJavelins(dt: number): void {
    const p = this.player.position;
    for (const j of this.javs) {
      if (j.state === 1) {
        j.age += dt;
        let rem = dt;
        while (rem > 0) { // every way out of the flight breaks the loop
          const h = Math.min(rem, 1 / 120); rem -= h;
          _v1.copy(j.pos);
          j.vel.y -= JAV_GRAVITY * h;
          j.pos.addScaledVector(j.vel, h);
          const seg = _v2.subVectors(j.pos, _v1), len = seg.length();
          if (len < 1e-6) continue;
          _dir.copy(seg).multiplyScalar(1 / len);
          // the head leads the balance point by ~0.8 m: test the head's path
          _v3.copy(_v1).addScaledVector(_dir, 0.8);
          if (this.targets) {
            const hit = this.targets.raycast(_v3, _dir, len);
            if (hit?.animal.alive === true) {
              const dmg = Math.round(JAV_DAMAGE * (hit.headshot ? JAV_HEAD : 1));
              const killed = hit.animal.applyDamage(dmg, hit.point, _dir);
              if (!killed) hit.animal.stagger?.(_v2.set(_dir.x, 0, _dir.z).normalize(), 1);
              this.onHit?.(hit.animal.kind, hit.headshot, killed);
              this.onImpact?.('flesh', hit.point);
              this.drop(j, hit.point);
              break;
            }
          }
          _v3.addScaledVector(_dir, len); // the head's new position
          let stuck = false;
          for (const tr of this.forest.nearby(_v3.x, _v3.z, 1)) {
            if (Math.hypot(_v3.x - tr.x, _v3.z - tr.z) < tr.r + 0.05 && _v3.y > tr.y && _v3.y < tr.y + tr.height) { this.stick(j, _v3, _dir, 'wood'); stuck = true; break; }
          }
          if (stuck) break;
          const g = heightAt(_v3.x, _v3.z);
          if (_v3.y < g) {
            const ws = this.player.waterSurfaceAt(_v3.x, _v3.z);
            if (ws !== null && ws > g) { j.state = 0; this.onImpact?.('ground', _v3); break; } // into the river: gone
            this.stick(j, _v3.set(_v3.x, g + 0.02, _v3.z), _dir, 'ground'); break;
          }
          if (j.age > 8 || j.pos.y < -200) { j.state = 0; break; }
          j.q.setFromUnitVectors(Y, _dir);
        }
      } else if (j.state === 2) {
        j.age += dt;
        if (this.javelins < this.maxJavelins && Math.hypot(j.pos.x - p.x, j.pos.z - p.z) < PICKUP_R && Math.abs(j.pos.y - p.y) < 2.2) {
          j.state = 0;
          if (Math.random() < JAV_SURVIVE) { this.javelins++; this.onPickup?.(this.javelins); }
        }
      }
    }
    let n = 0;
    for (const j of this.javs) {
      if (j.state === 0) continue;
      this.world.setMatrixAt(n++, _m.compose(j.pos, j.q, _s1));
    }
    if (n !== this.world.count || n > 0) { this.world.count = n; this.world.instanceMatrix.needsUpdate = true; }
  }

  /** the dotted arc a javelin thrown now would fly (world space), stopping at the ground */
  private drawArc(alpha: number): void {
    this.arc.visible = alpha > 0.01;
    this.arcMat.opacity = alpha * 0.85;
    if (!this.arc.visible) return;
    const cam = this.game.camera;
    cam.getWorldDirection(_fwd);
    _v1.set(0.22, 0.05, -0.3).applyQuaternion(cam.quaternion).add(cam.position);
    _v2.set(1, 0, 0).applyQuaternion(cam.quaternion);
    _dir.copy(_fwd).applyAxisAngle(_v2, 0.035).normalize().multiplyScalar(JAV_SPEED);
    const P = this.arcPos;
    let hitAt = ARC_POINTS;
    for (let i = 0; i < ARC_POINTS; i++) {
      const t = 0.06 + i * 0.05; // 1.6 s of flight ≈ 40 m
      let x = _v1.x + _dir.x * t, y = _v1.y + _dir.y * t - 0.5 * JAV_GRAVITY * t * t, z = _v1.z + _dir.z * t;
      if (i >= hitAt) { x = P[(hitAt - 1) * 3] ?? x; y = P[(hitAt - 1) * 3 + 1] ?? y; z = P[(hitAt - 1) * 3 + 2] ?? z; }
      else if (y < heightAt(x, z)) { hitAt = i; y = heightAt(x, z) + 0.05; }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    this.arcAttr.needsUpdate = true;
  }

  // ── brace / lance contact: anything closing on the point ──
  private contacts(dt: number, t: number, lance: boolean): void {
    const p = this.player.position, cam = this.game.camera;
    const heading = lance && this.mount !== null ? this.mount.yaw : this.player.yaw;
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    for (const a of getAimTargets()) {
      let prev = this.prevPos.get(a);
      if (prev === undefined) { prev = a.position.clone(); this.prevPos.set(a, prev); continue; }
      const vx = (a.position.x - prev.x) / Math.max(dt, 1e-3), vz = (a.position.z - prev.z) / Math.max(dt, 1e-3);
      prev.copy(a.position);
      if (!a.alive || a.hidden === true) continue;
      const dx = a.position.x - p.x, dz = a.position.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.01) continue;
      const edge = d - targetRadius(a);
      const reach = lance ? LANCE_REACH : REACH - 0.6; // the brace: the point is ~2.6 m out from the feet
      if (edge > reach || Math.abs(a.position.y - p.y) > 2) continue;
      const ang = Math.acos(THREE.MathUtils.clamp((dx * fx + dz * fz) / d, -1, 1));
      if (ang > (lance ? LANCE_CONE : BRACE_CONE)) continue;
      const closing = -(vx * dx + vz * dz) / d;               // its speed toward you
      const speed = lance ? (this.mount?.speed ?? 0) + Math.max(0, closing) : closing;
      if (speed < (lance ? LANCE_MIN_SPEED : BRACE_MIN_SPEED)) continue;
      const last = this.rehit.get(a) ?? -1e9;
      if (t - last < BRACE_REHIT) continue;
      // confirm through the real hit volumes (Targets): a ray from the eye to its body
      _v1.set(a.position.x, a.position.y + (a.dims?.bodyY ?? 0.6) * (a.scale ?? 1), a.position.z);
      _dir.subVectors(_v1, cam.position); const len = _dir.length(); _dir.multiplyScalar(1 / Math.max(len, 1e-4));
      const hit = this.targets?.raycast(cam.position, _dir, len + 1) ?? null;
      if (hit === null || !this.same(hit.animal, a)) continue;
      this.rehit.set(a, t);
      const dmg = Math.round(lance ? 40 + 6 * speed : 60 + 8 * speed);
      const killed = hit.animal.applyDamage(dmg, hit.point, _dir);
      if (!killed) hit.animal.stagger?.(_v2.set(dx, 0, dz).normalize(), 1);
      this.jolt = 1.4;
      this.onHit?.(hit.animal.kind, false, killed);
      this.onImpact?.('flesh', hit.point);
    }
  }
  private same(a: TargetAnimal, b: AimTarget): boolean { return a.position === b.position; }

  private thrustHit(): void {
    if (this.targets === undefined) return;
    const cam = this.game.camera;
    cam.getWorldDirection(_fwd);
    _e.set(0, 0, 0, 'YXZ');
    for (const pitch of THRUST_FAN.pitches) for (const yaw of THRUST_FAN.yaws) {
      _e.y = yaw; _e.x = pitch;
      _q.setFromEuler(_e); _q.premultiply(cam.quaternion);
      _dir.set(0, 0, -1).applyQuaternion(_q);
      const hit = this.targets.raycast(cam.position, _dir, REACH);
      if (!hit || !hit.animal.alive) continue;
      const killed = hit.animal.applyDamage(THRUST_DAMAGE, hit.point, _fwd);
      if (!killed) hit.animal.stagger?.(_v2.set(_fwd.x, 0, _fwd.z).normalize(), THRUST_STAGGER);
      this.hitDone = true; this.jolt = 1;
      this.onHit?.(hit.animal.kind, false, killed);
      this.onImpact?.('flesh', hit.point);
      return;
    }
  }

  // ── per frame ──
  update(dt: number, t: number): void {
    this.time = t;
    const p = this.player, cam = this.game.camera;
    const inHand = this.model.visible;
    if (!inHand || !this.enabled) {
      // holstered / paused: drop every held state
      if (this.braced) { this.braced = false; this.onBrace?.(false); }
      this.braceT = 0; this.braceHeldT = 0; this.rmbDown = false;
      if (this.windT >= 0 && !inHand) { this.windT = -1; this.releaseQueued = false; }
      if (!inHand) { this.thrustT = -1; this.queued = false; }
    }
    if (inHand !== this.inHand) { this.inHand = inHand; if (!inHand) { p.moveScale = 1; p.swinging = false; } }
    this.braceCd = Math.max(0, this.braceCd - dt);

    if (inHand) {
      // FOV (Hor+ on portrait) + the dodge kick
      const baseFov = fovForAspect(FOV_HIP, cam.aspect);
      const target = baseFov + p.fovKick;
      if (Math.abs(target - this.fov) > 0.01) {
        const refit = Math.abs(baseFov - this.baseFov) > 0.01; this.baseFov = baseFov;
        this.fov = target; cam.fov = target; cam.updateProjectionMatrix();
        if (refit) this.sky.csm.updateFrustums();
      }
    }

    // ── inputs: RMB hold → brace, the BRACE disc → brace; the THROW disc edges → wind / throw ──
    if (this.rmbDown) this.rmbT += dt;
    const wantBrace = this.enabled && inHand && this.mount === null && (this.altHeld || (this.rmbDown && this.rmbT >= BRACE_SET)) && this.windT < 0 && this.throwT < 0;
    if (wantBrace && this.braceCd <= 0) {
      if (this.thrustT >= 0 && this.thrustT < T_ACTIVE_END) { /* let the jab land first */ }
      else {
        this.thrustT = -1; this.queued = false;
        this.braceHeldT += dt;
        if (!this.braced && this.braceHeldT >= BRACE_SET) { this.braced = true; this.braceT = 0; this.onBrace?.(true); }
      }
    } else {
      if (this.braced) { this.braced = false; this.onBrace?.(false); if (this.braceT >= BRACE_MAX) this.braceCd = BRACE_COOLDOWN; }
      this.braceHeldT = 0;
    }
    if (this.braced) { this.braceT += dt; if (this.braceT >= BRACE_MAX) { this.braced = false; this.onBrace?.(false); this.braceCd = BRACE_COOLDOWN; } }
    p.moveScale = inHand && (this.braced || this.braceHeldT > 0) ? 0 : 1;

    const throwHeld = this.adsHeld && this.enabled && inHand;
    if (throwHeld && !this.throwPrev) this.beginWind();
    if (!throwHeld && this.throwPrev && this.windT >= 0) this.releaseQueued = true;
    this.throwPrev = throwHeld;
    if (this.windT >= 0) {
      this.windT += dt;
      if (this.releaseQueued && this.windT >= WINDUP) { this.windT = -1; this.releaseQueued = false; this.throwT = 0; this.threw = false; }
    }
    if (this.throwT >= 0) {
      this.throwT += dt;
      if (!this.threw && this.throwT >= THROW_T * 0.5) { this.threw = true; this.launch(); }
      if (this.throwT >= THROW_T + THROW_RECOVER) this.throwT = -1;
    }

    // ── thrust clock ──
    if (this.thrustT >= 0) {
      this.thrustT += dt;
      if (!this.hitDone && this.thrustT >= T_WIND && this.thrustT <= T_ACTIVE_END) this.thrustHit();
      if (this.thrustT >= T_TOTAL) { this.thrustT = -1; if (this.queued) { this.queued = false; this.tryFire(); } }
    }
    if (inHand) p.swinging = this.thrustT >= 0;

    // ── contacts: brace (set) or the couched lance (mounted, canter+) ──
    const lance = this.mount !== null && this.mount.speed >= LANCE_MIN_SPEED && this.windT < 0 && this.throwT < 0;
    if (inHand && (this.braced || lance)) this.contacts(dt, t, lance);
    else if (this.prevPos.size > 0) this.prevPos.clear();

    this.flyJavelins(dt);
    this.state.bolts = this.javelins; this.state.loaded = this.javelins > 0; this.state.ads = this.braced || this.windT >= 0;

    // ── pose ──
    this.jolt *= Math.exp(-dt * 14);
    const k = 1 - Math.exp(-dt * 14);
    this.braceBlend += ((this.braced || this.braceHeldT > 0 ? 1 : 0) - this.braceBlend) * k;
    const throwing = this.windT >= 0 || this.throwT >= 0;
    this.throwBlend += ((throwing ? 1 : 0) - this.throwBlend) * (1 - Math.exp(-dt * (throwing ? 16 : 8)));
    this.lanceBlend += ((lance ? 1 : 0) - this.lanceBlend) * (1 - Math.exp(-dt * 6));
    this.sprintBlend += ((p.sprinting && this.thrustT < 0 && !throwing && !this.braced ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);

    // look lag (spring, substepped)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lagYaw = THREE.MathUtils.clamp(this.lagYaw - dYaw * 0.4, -0.1, 0.1);
    this.lagPitch = THREE.MathUtils.clamp(this.lagPitch - dPitch * 0.4, -0.08, 0.08);
    for (let rem = dt; rem > 0; rem -= 1 / 120) {
      const h = Math.min(rem, 1 / 120);
      this.lagYawVel += (-this.lagYaw * 200 - this.lagYawVel * 20) * h; this.lagYaw += this.lagYawVel * h;
      this.lagPitchVel += (-this.lagPitch * 200 - this.lagPitchVel * 20) * h; this.lagPitch += this.lagPitchVel * h;
    }

    // the spear: rest → thrust (cock, jab, recover) → brace / lance / left-low while throwing
    const sp = _v1, sq = _q;
    sp.copy(REST.pos); sq.copy(REST.q);
    if (this.thrustT >= 0) {
      const tt = this.thrustT;
      if (tt < T_WIND) { const f = sstep(0, 1, tt / T_WIND); sp.lerp(COCK.pos, f); sq.slerp(COCK.q, f); }
      else if (tt < T_ACTIVE_END) { const f = 1 - (1 - (tt - T_WIND) / (T_ACTIVE_END - T_WIND)) ** 3; sp.copy(COCK.pos).lerp(JAB.pos, f); sq.copy(COCK.q).slerp(JAB.q, f); }
      else { const f = sstep(0, 1, (tt - T_ACTIVE_END) / (T_TOTAL - T_ACTIVE_END)); sp.copy(JAB.pos).lerp(REST.pos, f); sq.copy(JAB.q).slerp(REST.q, f); }
    }
    const bb = sstep(0, 1, this.braceBlend), lb = sstep(0, 1, this.lanceBlend), tb = sstep(0, 1, this.throwBlend), sb = this.sprintBlend;
    if (bb > 0) { sp.lerp(BRACED.pos, bb); sq.slerp(BRACED.q, bb); }
    if (lb > 0) { sp.lerp(LANCE.pos, lb); sq.slerp(LANCE.q, lb); }
    if (sb > 0) { sp.lerp(SPRINT.pos, sb); sq.slerp(SPRINT.q, sb); }
    // the right hand: on the shaft (the spear's own grip transform) unless throwing
    const hp = _v2.copy(sp), hq = _q2.copy(sq);
    if (tb > 0) {
      // the spear goes to the left hand, low left; the right hand brings a javelin up by the ear, then snaps it forward
      sp.lerp(_v3.copy(LEFT_LOW.pos), tb); sq.slerp(LEFT_LOW.q, tb);
      let jp = JAV_COCK.pos, jq = JAV_COCK.q;
      let wind = 1;
      if (this.windT >= 0) wind = sstep(0, 1, this.windT / WINDUP);
      if (this.throwT >= 0) {
        const f = this.throwT < THROW_T ? 1 - (1 - this.throwT / THROW_T) ** 2 : 1;
        jp = _vThrow.copy(JAV_COCK.pos).lerp(JAV_OUT.pos, f); jq = _qThrow.copy(JAV_COCK.q).slerp(JAV_OUT.q, f);
      }
      _vCock.copy(REST.pos).lerp(jp, wind); _qCock.copy(REST.q).slerp(jq, wind);
      if (this.windT >= 0) { _vCock.x += Math.sin(t * 31) * 0.002 * wind; _vCock.z += 0.02 * wind * sstep(0.6, 1, this.windT / WINDUP); } // drawn back taut
      hp.lerp(_vCock, tb); hq.slerp(_qCock, tb);
    }
    this.heldJav.visible = (this.windT >= 0 || (this.throwT >= 0 && !this.threw)) && this.javelins > 0;

    // sway / bob / look lag / jolt, the portrait layout, the holster drop — applied to both rigs alike
    const sf = p.speedFactor, m = 1 - bb * 0.7;
    const swX = Math.sin(t * 0.7) * 0.003, swY = Math.sin(t * 1.1) * 0.0025;
    const bobX = Math.cos(p.bobTime) * 0.016 * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * 0.013 * sf;
    _e.set((Math.sin(p.bobTime * 2) * 0.01 * sf + this.lagPitch + this.jolt * 0.05) * m, this.lagYaw * m, (Math.sin(t * 0.5) * 0.006 + Math.cos(p.bobTime) * 0.015 * sf) * m, 'YXZ');
    _qSway.setFromEuler(_e);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const scale = 1 - portrait * 0.15;
    const h = this.holster > 0 ? sstep(0, 1, this.holster) : 0;
    if (h > 0) _qHol.setFromEuler(_e.set(-h * 0.6, 0, h * 0.3, 'YXZ'));
    for (const [pos, q, rig] of [[sp, sq, this.spearRig], [hp, hq, this.handRig]] as [THREE.Vector3, THREE.Quaternion, THREE.Group][]) {
      pos.x += (swX + bobX + this.lagYaw * 0.25) * m; pos.y += (swY + bobY + this.lagPitch * 0.2) * m; pos.z += this.jolt * 0.04;
      q.premultiply(_qSway);
      pos.x *= 1 - portrait * 0.3; pos.y *= 1 + portrait * 0.08; pos.z *= 1 + portrait * 0.25;
      if (h > 0) { pos.y -= h * 0.5; pos.z += h * 0.1; q.premultiply(_qHol); }
      if (this.inspect) { pos.set(0.05, -0.1, -1.1); q.setFromEuler(_e.set(0.3, Math.sin(t * 0.3) * 0.6, 1.3, 'YXZ')); }
      rig.position.copy(pos); rig.quaternion.copy(q); rig.scale.setScalar(scale);
    }

    // the brace ring: round the point while set, a slow turn
    const ringOn = this.braced && inHand;
    this.ringMat.opacity += ((ringOn ? 0.75 : 0) - this.ringMat.opacity) * (1 - Math.exp(-dt * 12));
    this.ring.visible = this.ringMat.opacity > 0.01;
    if (this.ring.visible) {
      this.spearRig.updateMatrix();
      this.ring.position.set(0, 1.25, 0).applyMatrix4(this.spearRig.matrix);
      this.ring.quaternion.copy(this.spearRig.quaternion).multiply(_q.setFromAxisAngle(_v3.set(1, 0, 0), Math.PI / 2)).multiply(_q2.setFromAxisAngle(_v3.set(0, 0, 1), t * 1.4));
      this.ring.scale.setScalar(scale * (1 + 0.06 * Math.sin(t * 5)));
    }
    // the dotted throw arc while winding up
    const arcAlpha = this.showArc && inHand && this.windT >= ARC_SHOW_AFTER ? sstep(ARC_SHOW_AFTER, WINDUP, this.windT) : 0;
    this.drawArc(arcAlpha);

    // aim readout (HUD "WOLF · 15 M")
    if (this.targets && inHand && (++this.aimFrame & 3) === 0) {
      cam.getWorldDirection(_fwd);
      const hit = this.targets.raycast(cam.position, _fwd, 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }
  }

  /** dev: the running clock */
  get clock(): number { return this.time; }
}
