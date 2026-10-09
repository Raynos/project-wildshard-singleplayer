import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import { gameplayRandom, app } from '@wildshard/engine/app/runtime';
import { aimRay, fovForAspect } from '@wildshard/engine/combat/blocks/melee';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import type { Targets, TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import { impactSurfaceOf, worldHit } from '@wildshard/engine/combat/view/ranged';
import { quiverState, type WeaponState, type AimInfo, type ImpactSurface } from '@wildshard/engine/combat/Weapon';
import type { Game } from '@wildshard/engine/core/Game';
import { weaponActionGate } from '@wildshard/engine/input/weaponActions';
import { lin } from '@wildshard/engine/math/color';
import { floorBelow, sticksIn } from '@wildshard/engine/physics/query';
import { targetRadius, type AimTarget } from '@wildshard/engine/player/AimTargets';
import { gloveFist, riderArm, placeArm } from '@wildshard/engine/player/nalatiArms';
import type { Player } from '@wildshard/engine/player/Player';
import { viewmodel } from '@wildshard/engine/render/viewmodelFeel';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { Melee } from '@wildshard/sdk/runtime/weapons/Melee';
import type { MeleeProfile } from '@wildshard/sdk/weapons/meleeProfile';
import { SWORD_WOOD } from '@wildshard/sdk/runtime/weapons/starterMeleeProfile';
import { Thrown } from '@wildshard/sdk/runtime/weapons/Thrown';
import type { ThrownProfile } from '@wildshard/sdk/weapons/thrownProfile';
import { SPEAR } from '../../weapons/equipment';

import * as THREE from 'three';








import { tube, blob, xf, merge, meleeMaterial, steelMaterial, withUV, sweep, helix, section, type ColorAt } from '../../weapons/meleeGeo';



/**
 * Spear — the Nalati spear + javelins (ASKS N6, plan row B3; design docs/design/nalati/combat.md § B; mockups
 * art/nalati-grasslands/round-2/1-combat/combat-B-spear-brace.jpg, combat-B2-javelin-throw.png). The plan's decision:
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
 * JAVELINS (3 carried) — the touch THROW disc (the left disc, where AIM sits:
 * `adsHeld`, held): press = the spear drops to the left hand and a javelin comes up cocked by the right ear (WINDUP s to
 * full) with a dotted throw arc; release = throw (a release before full throws the moment it is). Desktop: a quick RMB
 * TAP (< 0.25 s) throws. Flight: 28 m/s (+ `mount` velocity), full gravity, 55 body × 2 head, heavy stagger; it sticks in
 * the ground / a trunk (a hit animal drops it at its feet) and is picked up by walking over it (90 % survive).
 * `javelins` / `maxJavelins` feed the HUD (state.bolts / magazine: the JAVELINS pips).
 *
 * COUCHED LANCE (mounted — `spear.mount = { speed, yaw }`, set by the riding row B7): at canter or faster (≥ 8 m/s) the
 * spear levels by itself; an animal inside 2.5 m ahead ±15° of the horse's heading takes 40 + 6 × v (once per 1.2 s).
 *
 * Implements `Weapon` (+ the kit hooks `holster`, `reload`, `aimRay`, `altHeld`, `ammoLabel`, `segments`,
 * `magazine`). Events: onFire on every thrust and throw · onThrow on a throw (after onFire) · onHit ·
 * onImpact · onDry (THROW with none left) · onPickup (a javelin recovered).
 */

export interface SpearWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface SpearOptions { allowUnlocked?: boolean; profile?: typeof SPEAR_PROFILE }
export interface MountState { speed: number; yaw: number }

const _commandOrigin = new THREE.Vector3(), _commandRotation = new THREE.Quaternion();
export const REACH = 3.2;
const THRUST_DAMAGE = 30, THRUST_STAGGER = 0.5;
const T_WIND = 0.12, T_ACTIVE_END = 0.22, T_TOTAL = 0.35;
const THRUST_FAN = { yaws: [0, -0.05, 0.05, -0.1, 0.1], pitches: [0, -0.15, -0.3, -0.5, -0.7] };
const RMB_TAP_MAX = 0.25; // quick desktop tap throws; a held RMB has no action
const LANCE_REHIT = 1.2;
const LANCE_REACH = 2.5, LANCE_CONE = 15 * Math.PI / 180, LANCE_MIN_SPEED = 8;
const WINDUP = 0.4, THROW_T = 0.14, THROW_RECOVER = 0.45;
const JAV_SPEED = 28, JAV_GRAVITY = 9.8, JAV_DAMAGE = 55, JAV_HEAD = 2;
const JAV_POOL = 5, PICKUP_R = 1.6, JAV_SURVIVE = 0.9;
/** the ball a javelin's head sweeps through the world (NALATI-MERGE P2) */
const JAV_RADIUS = 0.03;
const ARC_POINTS = 32, ARC_SHOW_AFTER = 0.12;
const FOV_HIP = 72;
const LEFT_HAND_Y = 0.3;         // the left fist sits this far up the shaft from the right

/** Deterministic javelin substep (the flight uses steps of at most 1/120 s). */
export function javelinFlightStep(pos: THREE.Vector3, vel: THREE.Vector3, h: number): void {
  vel.y -= JAV_GRAVITY * h;
  pos.addScaledVector(vel, h);
}


// ───────────────────────────── geometry (+Y = toward the head; origin = the right hand's grip) ─────────────────────────────

const ASH = lin(0xd2ab7a), ASH_LIGHT = lin(0xebcb98), ASH_DARK = lin(0x9a7046), ASH_WORN = lin(0x84603c);
const STEEL = lin(0xc2c4c6), STEEL_EDGE = lin(0xf4f2ee), STEEL_RIDGE = lin(0x8d9196), IRON = lin(0x5d636b), IRON_DARK = lin(0x3a3e44);
const THONG = lin(0x6b4127), THONG_LIGHT = lin(0x92603a), TASSEL = lin(0xc0301f), TASSEL_LIGHT = lin(0xe0543a), TASSEL_DARK = lin(0x6f1510);

/** the painted ash grain: long streaks along the shaft, a few dark knots, the hand-worn bands darker and smoother */
const shaftCol = (worn: [number, number][], y0: number, y1: number): ColorAt => (v, a, out) => {
  const y = y0 + (y1 - y0) * v, ang = a * Math.PI * 2;
  const streak = Math.sin(ang * 5 + Math.sin(y * 2.3 + ang) * 1.6) * 0.5 + Math.sin(ang * 11 + y * 0.7) * 0.3;
  out.copy(ASH).lerp(streak > 0.25 ? ASH_LIGHT : ASH_DARK, Math.min(1, Math.abs(streak) * 0.55));
  const knot = Math.sin(y * 9.1 + 0.5) * Math.sin(ang * 3 + 1.1); if (knot > 0.93) out.lerp(ASH_DARK, 0.75);
  for (const [c, w] of worn) if (Math.abs(y - c) < w) out.lerp(ASH_WORN, 0.5);
  return out;
};

/** a leaf head along +Y from `y0`: diamond section (a midrib ridge), bright bevelled edges, widest at 35 % */
function leafHead(y0: number, len: number, w: number, t: number): THREE.BufferGeometry {
  const SEC: [number, number, number][] = [[1, 0, 1], [0.72, 0.18, 0.75], [0.4, 0.46, 0.2], [0, 1, 0], [-0.4, 0.46, 0.2], [-0.72, 0.18, 0.75], [-1, 0, 1], [-0.72, -0.18, 0.75], [-0.4, -0.46, 0.2], [0, -1, 0], [0.4, -0.46, 0.2], [0.72, -0.18, 0.75]];
  const fs: number[] = []; for (let k = 0; k <= 18; k++) fs.push(k / 18);
  const width = (f: number) => (f < 0.35 ? Math.sin((f / 0.35) * Math.PI / 2) ** 0.8 : Math.cos(((f - 0.35) / 0.65) * Math.PI / 2) ** 0.9) * (f < 0.06 ? 0.35 + f * 10 : 1);
  const rings = fs.map((f) => { const ww = Math.max(0.0005, w * width(f)), tt = Math.max(0.0004, t * (1 - 0.75 * f)); return SEC.map(([sx, sz]) => new THREE.Vector3(sx * ww, y0 + len * f, sz * tt)); });
  return tube(rings, (v, a, out) => { const e = SEC[Math.round(a * SEC.length) % SEC.length]?.[2] ?? 0; return out.copy(STEEL_RIDGE).lerp(STEEL, 0.5).lerp(STEEL_EDGE, e * 0.9).lerp(IRON, v < 0.05 ? 0.4 : 0); }, { capStart: true });
}
/** the socket: a dark iron cone from the shaft up into the head, two raised rings, a rivet */
function socket(y: number, len: number, r0: number, r1: number, parts: THREE.BufferGeometry[]): void {
  const rings: THREE.Vector3[][] = [];
  for (let k = 0; k <= 8; k++) { const f = k / 8; rings.push(section(14, r0 + (r1 - r0) * f ** 1.3 + (f < 0.12 ? 0.0012 : 0), r0 + (r1 - r0) * f ** 1.3 + (f < 0.12 ? 0.0012 : 0), y + len * f)); }
  parts.push(tube(rings, (v, a, out) => out.copy(IRON).lerp(IRON_DARK, 0.3 + 0.3 * Math.sin(a * Math.PI * 2)).lerp(STEEL_RIDGE, v * 0.3)));
  for (const f of [0.1, 0.34]) { const yy = y + len * f, r = r0 + (r1 - r0) * f ** 1.3; parts.push(tube([section(14, r, r, yy - 0.004), section(14, r + 0.0022, r + 0.0022, yy), section(14, r, r, yy + 0.004)], (_v, _a, out) => out.copy(IRON).lerp(STEEL_RIDGE, 0.35))); }
  parts.push(xf(blob(0.0032, 0.0032, 0.0022, STEEL_RIDGE, 8, 0.3), 0, y + len * 0.22, r0 + 0.0012));
}
/** a leather thong bound round the shaft: a raised helix with a tied tail */
function binding(r: number, y0: number, y1: number, turns: number, parts: THREE.BufferGeometry[]): void {
  parts.push(sweep(helix(r, y0, y1, turns, Math.round(turns * 18)), () => 0.0026, 6, (_v, a, out) => out.copy(THONG).lerp(THONG_LIGHT, 0.5 + 0.5 * Math.sin(a * Math.PI * 2)), true, 0.6));
  parts.push(sweep([new THREE.Vector3(r, y0, 0), new THREE.Vector3(r + 0.008, y0 - 0.02, 0.004), new THREE.Vector3(r + 0.012, y0 - 0.045, 0.01)], (u) => 0.002 * (1 - 0.6 * u), 5, (_v, _a, out) => out.copy(THONG)));
}
/** horsehair: `n` tapered red strands from a ring of radius r at y, falling `len` (down = -Y when `dir` -1), flaring out */
function horsehair(n: number, y: number, r: number, len: number, flare: number, parts: THREE.BufferGeometry[], dir = -1, seed = 7): void {
  let h = seed * 9301;
  const rnd = () => { h = (h * 16807) % 2147483647; return h / 2147483647; };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.3, l = len * (0.7 + 0.45 * rnd()), fl = flare * (0.7 + 0.6 * rnd()), tw = (rnd() - 0.5) * 0.5;
    const path: THREE.Vector3[] = [];
    for (let k = 0; k <= 5; k++) { const u = k / 5, rr = r + fl * Math.sin(u * Math.PI * 0.6) + 0.004 * u; path.push(new THREE.Vector3(Math.cos(a + tw * u) * rr, y + dir * l * u, Math.sin(a + tw * u) * rr)); }
    const shade = rnd();
    parts.push(sweep(path, (u) => 0.0042 * (1 - 0.8 * u) + 0.0008, 4, (u, _a, out) => out.copy(shade > 0.7 ? TASSEL_LIGHT : shade < 0.2 ? TASSEL_DARK : TASSEL).lerp(TASSEL_DARK, u * 0.35), false));
  }
  parts.push(tube([section(12, r + 0.0005, r + 0.0005, y - 0.006), section(12, r + 0.0035, r + 0.0035, y), section(12, r + 0.0005, r + 0.0005, y + 0.008)], (_v, _a, out) => out.copy(THONG))); // the lashing that holds it
}

/** a spear's or a javelin's two draws: the painterly wood, horsehair and thongs; the PBR steel (with a `uv`) */
export interface SpearParts { paint: THREE.BufferGeometry; metal: THREE.BufferGeometry }
/** the spear (combat-B-spear-brace.png): 1.9 m of ash, grain + worn grip bands, a thong binding under a dark iron socket,
 *  a red horsehair tassel, a long leaf head with a midrib, an iron butt ferrule — origin at the right hand's grip */
export function buildSpear(): SpearParts {
  const paint: THREE.BufferGeometry[] = [], metal: THREE.BufferGeometry[] = [];
  const yButt = -1.3, ySocket = 0.62; // held choked up: the grip is 0.6 m behind the socket
  const shaft: THREE.Vector3[][] = [];
  for (let k = 0; k <= 48; k++) { const f = k / 48, y = yButt + (ySocket - yButt) * f; const r = 0.0172 - 0.0032 * f; shaft.push(section(14, r, r * 0.97, y)); }
  paint.push(tube(shaft, shaftCol([[0, 0.07], [LEFT_HAND_Y, 0.07]], yButt, ySocket), { capStart: true }));
  binding(0.0148, ySocket - 0.12, ySocket - 0.03, 5, paint);
  horsehair(44, ySocket - 0.005, 0.0142, 0.12, 0.022, paint);
  socket(ySocket - 0.01, 0.11, 0.0146, 0.0078, metal);
  metal.push(leafHead(ySocket + 0.09, 0.42, 0.037, 0.009));
  metal.push(tube([section(14, 0.0176, 0.0176, yButt + 0.06), section(14, 0.0186, 0.0186, yButt + 0.02), section(14, 0.0165, 0.0165, yButt - 0.012), section(14, 0.006, 0.006, yButt - 0.022)], (v, _a, out) => out.copy(IRON).lerp(IRON_DARK, v), { capEnd: true })); // butt ferrule
  return { paint: merge(paint), metal: withUV(merge(metal)) };
}
/** the javelin (combat-B2-javelin-throw.png): a slimmer 1.3 m shaft, a narrow leaf head on a socket, a red horsehair tuft
 *  at the tail — origin at its balance point */
export function buildJavelin(): SpearParts {
  const paint: THREE.BufferGeometry[] = [], metal: THREE.BufferGeometry[] = [];
  const y0 = -0.62, y1 = 0.6;
  const shaft: THREE.Vector3[][] = [];
  for (let k = 0; k <= 24; k++) { const f = k / 24, y = y0 + (y1 - y0) * f; const r = 0.0118 - 0.0022 * f; shaft.push(section(10, r, r, y)); }
  paint.push(tube(shaft, shaftCol([[0.1, 0.06]], y0, y1), { capStart: true }));
  binding(0.0102, y1 - 0.07, y1 - 0.01, 3, paint);
  horsehair(30, y0 + 0.1, 0.0112, 0.11, 0.02, paint, -1, 11);
  socket(y1 - 0.005, 0.07, 0.0098, 0.006, metal);
  metal.push(leafHead(y1 + 0.055, 0.19, 0.022, 0.006));
  return { paint: merge(paint), metal: withUV(merge(metal)) };
}
/** one geometry for a thrown javelin in the world (painterly only: the head painted steel) */
function worldJavelin(p: SpearParts): THREE.BufferGeometry {
  const m = p.metal.clone(); m.deleteAttribute('uv');
  return merge([p.paint.clone(), m]);
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
const REST = pose(0.2, -0.25, -0.36, -0.13, 0.05, -0.99, -1.2);       // two hands, low right, the head just under the frame centre
const COCK = pose(0.23, -0.27, -0.22, -0.12, 0.05, -0.99, -1.2);      // thrust wind-up: drawn back
const JAB = pose(0.13, -0.21, -0.95, -0.04, 0.03, -1, -1.2);          // thrust at full extension
const LEFT_LOW = pose(-0.3, -0.52, -0.38, 0.2, 0.42, -0.88, -0.5);   // throwing: the spear in the left hand, low left (combat-B2)
const SPRINT = pose(0.26, -0.4, -0.3, -0.35, 0.42, -0.84, 0.6);
const LANCE = pose(0.16, -0.3, -0.5, -0.02, 0.02, -1, 0.3);          // couched: level, dead ahead
const JAV_COCK = pose(0.33, -0.02, -0.55, -0.08, 0.1, -0.99, 0.2);    // the javelin cocked by the right ear
const JAV_OUT = pose(0.12, -0.12, -0.72, -0.02, 0.02, -1, 0.2);      // the throwing hand, arm out after the release

// ───────────────────────────── the weapon ─────────────────────────────

interface Jav { state: 0 | 1 | 2; pos: THREE.Vector3; vel: THREE.Vector3; q: THREE.Quaternion; age: number }  // 0 none · 1 flying · 2 stuck
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _dir = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _head = new THREE.Vector3(), _nrm = new THREE.Vector3(), _arcPrev = new THREE.Vector3();
/** the top of the world under (x, z) from y down (terrain, a deck, a rock); the terrain when there is no physics */
function floorUnder(x: number, y: number, z: number): number {
  const ph = app.physics;
  return (ph ? floorBelow(ph, x, z, y, 60) : undefined) ?? heightAt(x, z);
}
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _s1 = new THREE.Vector3(1, 1, 1);
const _vThrow = new THREE.Vector3(), _qThrow = new THREE.Quaternion(), _vCock = new THREE.Vector3(), _qCock = new THREE.Quaternion();
const _qSway = new THREE.Quaternion(), _qHol = new THREE.Quaternion(), _vArm = new THREE.Vector3(), _vEl = new THREE.Vector3();
/** where the sleeves run back to (camera space): the elbows, just off the bottom corners of the frame */
const L_ELBOW = new THREE.Vector3(-0.3, -0.62, 0.05), R_ELBOW = new THREE.Vector3(0.36, -0.6, 0.08);

export const JAVELIN: ThrownProfile = {
  id: 'weapon.javelin', speed: JAV_SPEED, gravity: JAV_GRAVITY, damage: JAV_DAMAGE, headMultiplier: JAV_HEAD,
  radius: JAV_RADIUS, headOffset: 0.8, windup: WINDUP, release: THROW_T, recovery: THROW_RECOVER,
  carried: 3, pool: JAV_POOL, pickupRadius: PICKUP_R, pickupHeight: 2.2, survive: JAV_SURVIVE,
  arcPoints: ARC_POINTS, arcAfter: ARC_SHOW_AFTER, stagger: 1,
};

export const SPEAR_PROFILE: MeleeProfile & {
  thrust: { damage: number; stagger: number; windup: number; activeEnd: number; total: number; fan: typeof THRUST_FAN };
  lance: { reach: number; cone: number; minSpeed: number; baseDamage: number; speedDamage: number };
} = {
  ...SWORD_WOOD, ...SPEAR, parent: SWORD_WOOD.id, damage: THRUST_DAMAGE, reach: REACH,
  hitStop: { body: 0, head: 0, kill: 0 },
  cues: { fire: 'cue.spear.thrust', reload: 'cue.reload', impact: 'cue.javelin.hit', hit: 'cue.javelin.hit', charge: { throw: 'cue.javelin.throw', recover: 'cue.javelin.pickup' } },
  thrust: { damage: THRUST_DAMAGE, stagger: THRUST_STAGGER, windup: T_WIND, activeEnd: T_ACTIVE_END, total: T_TOTAL, fan: THRUST_FAN },
  lance: { reach: LANCE_REACH, cone: LANCE_CONE, minSpeed: LANCE_MIN_SPEED, baseDamage: 40, speedDamage: 6 },
  feel: { lag: { gain: 0.4, clampYaw: 0.1, clampPitch: 0.08, k: 200, c: 20, posYaw: 0.25, posPitch: 0.2 },
    bob: { x: 0.016, y: 0.013, rx: 0.01, rz: 0.015 }, sway: { ax: 0.003, fx: 0.7, ay: 0.0025, fy: 1.1 }, fovHip: FOV_HIP },
};

export class Spear extends Melee<typeof SPEAR_PROFILE> {
  override readonly reach = this.profile.reach;
  readonly state: WeaponState = quiverState({ bolts: 3, loaded: true, reloading: false, reloadProgress: 0, ads: false }, 3);
  enabled = true;
  allowUnlocked = false;
  /** the touch THROW disc (held): press = wind up, release = throw */
  adsHeld = false;

  /** 0..1 weapon-swap blend (the kit drives it): 1 = dropped out of the frame */
  holster = 0;
  /** the riding row's hook (B7): horse speed / heading while mounted, null on foot */
  mount: MountState | null = null;
  /** Three javelins carried; the throw shares this weapon slot. */
  readonly thrown = new Thrown(JAVELIN);
  get javelins(): number { return this.thrown.ammo; }
  set javelins(value: number) { this.thrown.ammo = value; }
  get maxJavelins(): number { return this.thrown.profile.carried; }
  /** × the javelin's damage on a hit (the sneak shot from HIDDEN ×2 — src/shards/nalati-grasslands/stealth.ts); undefined = 1 */
  damageMultiplier: ((hit: TargetHit) => number) | undefined;
  /** show the dotted throw arc while winding up (touch default on — the bow's Hunter's-eye rule) */
  showArc = true;
  aimInfo: AimInfo | null = null;
  /** dev: showcase pose */
  inspect = 0;

  onThrow?: () => void;
  onPickup?: (n: number) => void;

  readonly model = new THREE.Group();
  private game: Game; private sky: Sky; private player: Player;
  private targets: Targets | undefined;
  private spearRig = new THREE.Group(); private handRig = new THREE.Group();
  private heldJav!: THREE.Group;
  private leftArm!: THREE.Mesh; private rightArm!: THREE.Mesh;
  private leftWrist = new THREE.Vector3(); private rightWrist = new THREE.Vector3();
  private arc!: THREE.Points; private arcPos = new Float32Array(this.thrown.profile.arcPoints * 3); private arcAttr!: THREE.BufferAttribute; private arcMat!: THREE.PointsMaterial;
  private world!: THREE.InstancedMesh;
  private javs: Jav[] = [];
  private time = 0;
  // thrust
  private thrustT = -1; private hitDone = false; private queued = false;
  private rehit = new Map<object, number>();
  private rmbDown = false; private rmbT = 0;
  // throw
  private windT = -1; private throwT = -1; private releaseQueued = false; private throwPrev = false; private threw = false;
  // lance
  private lanceBlend = 0;
  // look lag / sway
  private lastYaw = 0; private lastPitch = 0; private lagYaw = 0; private lagYawVel = 0; private lagPitch = 0; private lagPitchVel = 0;
  private fov = this.profile.feel.fovHip; private baseFov = 0; private jolt = 0; private sprintBlend = 0;
  private throwBlend = 0; private inHand = false; private aimFrame = 0;
  private aimCache: AimInfo = { kind: 'deer', distance: 0 };
  private prevPos = new Map<object, THREE.Vector3>();

  constructor(w: SpearWorld, targets?: Targets, opts: SpearOptions = {}) {
    super(opts.profile ?? SPEAR_PROFILE, app.combat);
    this.row = { ...this.row, ui: { ...this.row.ui, inputContext: 'weapon.spear' } };
    this.game = w.game; this.sky = w.sky; this.player = w.player;
    this.setAimSource(() => this.player.sampleAimCommand());
    this.targets = targets;
    this.allowUnlocked = opts.allowUnlocked ?? false;
    this.lastYaw = this.player.yaw; this.lastPitch = this.player.pitch;
    this.build();
    const cam = this.game.camera;
    cam.add(this.model);
    if (!cam.parent) this.game.scene.add(cam);
    this.aimBlock = aimRay(() => this.player.sampleAimCommand()); this.blocks.aim = this.aimBlock; this.blocks.vm = this.lookBlock;
  }

  // ── kit surface ──
  override get segments(): number { return this.maxJavelins; }
  get magazine(): number { return this.maxJavelins; }
  get winding(): boolean { return this.windT >= 0; }
  get thrusting(): boolean { return this.thrustT >= 0; }
  /** javelins in flight or stuck in the world (dev / HUD) */
  get javelinsOut(): number { let n = 0; for (const j of this.javs) if (j.state !== 0) n++; return n; }
  override addBolts(n: number): void { this.javelins = Math.min(this.maxJavelins, this.javelins + Math.max(0, n)); }
  override reload(): void { /* nothing to reload: javelins are picked up */ }
  override aimRay(origin: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 { return super.aimRay(origin, dir); }

  private readonly lookBlock = viewmodel(this.profile.feel.lag);
  private readonly lookState = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly lookDelta = new THREE.Vector2();
  private readonly aimBlock: ReturnType<typeof aimRay>;
  override install(ctx: EquipContext): void {
    super.install(ctx); this.bindInput(ctx);
    ctx.scope.onDispose(() => { this.model.removeFromParent(); this.world.removeFromParent(); this.arc.removeFromParent(); });
  }
  private bindInput(ctx: EquipContext): void {
    const allowed = weaponActionGate(this, this.player);
    app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, allowed);
    app.input.bind('aim', () => { this.rmbDown = true; this.rmbT = 0; }, ctx.scope, allowed);
    app.input.bindRelease('aim', () => { if (!this.rmbDown) return; this.rmbDown = false; if (allowed() && this.rmbT < RMB_TAP_MAX) this.requestThrow(); }, ctx.scope);
    app.input.onReset(() => { this.rmbDown = false; }, ctx.scope);
  }

  /** a thrust (LMB / F / LOOK tap); mid-thrust queues one; ignored while throwing */
  tryFire(): void {
    if (!this.enabled || this.windT >= 0 || this.throwT >= 0) return;
    if (this.thrustT >= 0) { if (this.thrustT > this.profile.thrust.windup) this.queued = true; return; }
    this.thrustT = 0; this.hitDone = false; this.queued = false;
    this.onFire?.();
  }
  /** desktop tap / touch release: wind up (if not yet) and throw as soon as the wind-up is full */
  private requestThrow(): void {
    if (this.windT < 0 && !this.beginWind()) return;
    this.releaseQueued = true;
  }
  private beginWind(): boolean {
    if (!this.enabled || this.throwT >= 0) return false;
    if (this.javelins <= 0) { this.onDry?.(); return false; }
    this.thrustT = -1; this.queued = false;
    this.windT = 0; this.chargeEvent('throw', 0); this.releaseQueued = false;
    return true;
  }

  // ── build ──
  private build(): void {
    const mat = meleeMaterial(this.sky);
    const restInv = REST.q.clone().invert();
    // the fists ride the rigs (the left on the spear, the right on its own rig — it leaves the shaft to throw); the sleeves
    // are separate meshes placed every frame from each wrist back to a fixed elbow off the bottom of the frame (nalatiArms)
    const fist = (dirCam: THREE.Vector3, mirror: boolean) => {
      const d = dirCam.clone().normalize().applyQuaternion(restInv);
      const yaw = Math.atan2(d.x, d.z) - Math.atan2(mirror ? -0.12 : 0.12, 1);
      return gloveFist({ R: 0.0165, mirror, yaw });
    };
    const lf = fist(new THREE.Vector3(-0.42, -0.62, 0.66), true), rf = fist(new THREE.Vector3(0.62, -0.5, 0.6), false);
    const left = lf.geometry.clone().translate(0, LEFT_HAND_Y, 0);
    this.leftWrist.copy(lf.wrist).setY(lf.wrist.y + LEFT_HAND_Y); this.rightWrist.copy(rf.wrist);
    this.leftArm = new THREE.Mesh(riderArm(0.75, 2), mat); this.rightArm = new THREE.Mesh(riderArm(0.75, 1), mat);
    for (const a of [this.leftArm, this.rightArm]) { a.frustumCulled = false; a.renderOrder = 1000; a.receiveShadow = true; this.model.add(a); }
    const steel = steelMaterial(this.sky, 0.3);
    const sp = buildSpear();
    const spear = merge([sp.paint, left]);
    const right = rf.geometry;
    const add = (g: THREE.BufferGeometry, m: THREE.Material, to: THREE.Object3D) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1000;
      to.add(mesh);
    };
    add(spear, mat, this.spearRig); add(sp.metal, steel, this.spearRig); add(right, mat, this.handRig);
    const jav = buildJavelin();
    const javGeo = worldJavelin(jav);
    this.heldJav = new THREE.Group();
    add(jav.paint, mat, this.heldJav); add(jav.metal, steel, this.heldJav);
    this.heldJav.visible = false;
    this.heldJav.position.set(0, 0.1, 0); // the right hand grips it just behind the balance point
    this.handRig.add(this.heldJav);
    this.model.add(this.spearRig, this.handRig);
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
    this.world = new THREE.InstancedMesh(javGeo, wmat, this.thrown.profile.pool);
    this.world.count = 0; this.world.castShadow = true; this.world.receiveShadow = true; this.world.frustumCulled = false;
    this.game.scene.add(this.world);
    for (let i = 0; i < this.thrown.profile.pool; i++) this.javs.push({ state: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), age: 0 });
  }

  // ── javelins in the world ──
  private launch(): void {
    const j = this.javs.find((x) => x.state === 0);
    if (j === undefined || this.javelins <= 0) return;
    if (!this.thrown.release()) return;
    this.aimPose(_commandOrigin, _commandRotation);
    this.aimRay(_commandOrigin, _fwd);
    // leave from beside the right ear, aimed 2° over the crosshair (a heavy javelin is thrown a little up)
    _v1.set(0.22, 0.05, -0.3).applyQuaternion(_commandRotation).add(_commandOrigin);
    _v2.set(1, 0, 0).applyQuaternion(_commandRotation);
    _dir.copy(_fwd).applyAxisAngle(_v2, 0.035).normalize();
    j.state = 1; j.age = 0; j.pos.copy(_v1); j.vel.copy(_dir).multiplyScalar(this.thrown.profile.speed);
    const m = this.mount;
    if (m !== null) { j.vel.x -= Math.sin(m.yaw) * m.speed; j.vel.z -= Math.cos(m.yaw) * m.speed; } // the horse's velocity rides along
    j.q.setFromUnitVectors(Y, _dir);
    this.chargeEvent('throw', 1); this.onFire?.(); this.onThrow?.();
  }
  private stick(j: Jav, at: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface): void {
    // embed the head ~0.25 m: the balance point sits 0.62 + 0.21 - 0.25 back along the flight
    j.state = 2; j.age = 0; j.vel.set(0, 0, 0);
    j.q.setFromUnitVectors(Y, _v3.copy(dir).normalize());
    j.pos.copy(at).addScaledVector(_v3, -0.58);
    this.onImpact?.(surface, at);
  }
  /** off stone: it lies where it struck, along its flight flattened onto the surface */
  private lie(j: Jav, at: THREE.Vector3, n: THREE.Vector3, surface: ImpactSurface): void {
    const along = _v2.copy(_dir).addScaledVector(n, -_dir.dot(n));
    if (along.lengthSq() < 1e-6) along.set(1, 0, 0);
    along.normalize();
    j.state = 2; j.age = 0; j.vel.set(0, 0, 0);
    j.q.setFromUnitVectors(Y, along);
    j.pos.copy(at).addScaledVector(n, 0.04).addScaledVector(along, -0.58);
    this.onImpact?.(surface, at);
  }
  private drop(j: Jav, at: THREE.Vector3): void {
    // a javelin that hit an animal falls beside it, head down-ish into the turf
    const a = gameplayRandom() * Math.PI * 2;
    _v1.set(at.x + Math.cos(a) * 0.6, 0, at.z + Math.sin(a) * 0.6);
    _v1.y = floorUnder(_v1.x, at.y + 1, _v1.z);   // the turf, a deck, a rock under it
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
          this.thrown.flightStep(j.pos, j.vel, h);
          const seg = _v2.subVectors(j.pos, _v1), len = seg.length();
          if (len < 1e-6) continue;
          _dir.copy(seg).multiplyScalar(1 / len);
          // the head leads the balance point by ~0.8 m: test the head's path — through the physics world (NALATI-MERGE P2:
          // a small ball swept like the crossbow's bolt: terrain, trunks, rocks, yurts, fences, decks), animals short of it
          _v3.copy(_v1).addScaledVector(_dir, this.thrown.profile.headOffset);
          _head.copy(_v3).addScaledVector(_dir, len);
          const wall = worldHit(_v3, _head, this.thrown.profile.radius);
          if (this.targets) {
            const hit = this.targets.raycast(_v3, _dir, wall ? wall.distance : len);
            if (hit?.animal.alive === true) {
              const dmg = Math.round(this.thrown.profile.damage * (hit.headshot ? this.thrown.profile.headMultiplier : 1) * (this.damageMultiplier?.(hit) ?? 1));
              const killed = hit.animal.applyDamage(dmg, hit.point, _dir);
              if (!killed) hit.animal.stagger?.(_v2.set(_dir.x, 0, _dir.z).normalize(), this.thrown.profile.stagger);
              this.onHit?.(hit.animal.kind, hit.headshot, killed);
              this.onImpact?.('flesh', hit.point);
              this.drop(j, hit.point);
              break;
            }
          }
          if (wall) {
            _v3.set(wall.point.x, wall.point.y, wall.point.z);
            if (wall.material === 'ground') {
              const ws = this.player.waterSurfaceAt(_v3.x, _v3.z);
              if (ws !== null && ws > _v3.y) { j.state = 0; this.onImpact?.('ground', _v3); break; } // into the river: gone
            }
            if (sticksIn(wall.material)) { this.stick(j, _v3.addScaledVector(_dir, this.thrown.profile.radius), _dir, impactSurfaceOf(wall.material)); break; }
            // stone, rock, metal: it clatters off and lies on the surface
            _nrm.set(wall.normal.x, wall.normal.y, wall.normal.z);
            if (_nrm.dot(_dir) > 0) _nrm.negate();
            this.lie(j, _v3, _nrm, impactSurfaceOf(wall.material));
            break;
          }
          if (j.age > 8 || j.pos.y < -200) { j.state = 0; break; }
          j.q.setFromUnitVectors(Y, _dir);
        }
      } else if (j.state === 2) {
        j.age += dt;
        if (this.javelins < this.maxJavelins && Math.hypot(j.pos.x - p.x, j.pos.z - p.z) < this.thrown.profile.pickupRadius && Math.abs(j.pos.y - p.y) < this.thrown.profile.pickupHeight) {
          j.state = 0;
          if (gameplayRandom() < this.thrown.profile.survive) { this.javelins++; this.onPickup?.(this.javelins); this.chargeEvent('recover', this.javelins); }
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

  /** the dotted arc a javelin thrown now would fly (world space), stopping at the first surface (the world query) */
  private drawArc(alpha: number): void {
    this.arc.visible = alpha > 0.01;
    this.arcMat.opacity = alpha * 0.85;
    if (!this.arc.visible) return;
    this.aimPose(_commandOrigin, _commandRotation);
    this.aimRay(_commandOrigin, _fwd);
    _v1.set(0.22, 0.05, -0.3).applyQuaternion(_commandRotation).add(_commandOrigin);
    _v2.set(1, 0, 0).applyQuaternion(_commandRotation);
    _dir.copy(_fwd).applyAxisAngle(_v2, 0.035).normalize().multiplyScalar(this.thrown.profile.speed);
    const P = this.arcPos;
    let hitAt = this.thrown.profile.arcPoints;
    for (let i = 0; i < this.thrown.profile.arcPoints; i++) {
      const t = 0.06 + i * 0.05; // 1.6 s of flight ≈ 40 m
      let x = _v1.x + _dir.x * t, y = _v1.y + _dir.y * t - 0.5 * this.thrown.profile.gravity * t * t, z = _v1.z + _dir.z * t;
      if (i >= hitAt) { x = P[(hitAt - 1) * 3] ?? x; y = P[(hitAt - 1) * 3 + 1] ?? y; z = P[(hitAt - 1) * 3 + 2] ?? z; }
      else if (i > 0) {
        _head.set(x, y, z);
        const wall = worldHit(_arcPrev.set(P[(i - 1) * 3] ?? x, P[(i - 1) * 3 + 1] ?? y, P[(i - 1) * 3 + 2] ?? z), _head, 0);
        if (wall) { hitAt = i; x = wall.point.x; y = wall.point.y + 0.05; z = wall.point.z; }
      }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    this.arcAttr.needsUpdate = true;
  }

  // ── couched lance contact: anything closing on the point ──
  private contacts(dt: number, t: number): void {
    const p = this.player.position; this.aimPose(_commandOrigin, _commandRotation);
    const heading = this.mount !== null ? this.mount.yaw : this.player.yaw;
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    for (const a of app.aimTargets) {
      let prev = this.prevPos.get(a);
      if (prev === undefined) { prev = a.position.clone(); this.prevPos.set(a, prev); continue; }
      const vx = (a.position.x - prev.x) / Math.max(dt, 1e-3), vz = (a.position.z - prev.z) / Math.max(dt, 1e-3);
      prev.copy(a.position);
      if (!a.alive || a.hidden === true) continue;
      const dx = a.position.x - p.x, dz = a.position.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.01) continue;
      const edge = d - targetRadius(a);
      const reach = this.profile.lance.reach;
      if (edge > reach || Math.abs(a.position.y - p.y) > 2) continue;
      const ang = Math.acos(THREE.MathUtils.clamp((dx * fx + dz * fz) / d, -1, 1));
      if (ang > this.profile.lance.cone) continue;
      const closing = -(vx * dx + vz * dz) / d;               // its speed toward you
      const speed = (this.mount?.speed ?? 0) + Math.max(0, closing);
      if (speed < this.profile.lance.minSpeed) continue;
      const last = this.rehit.get(a) ?? -1e9;
      if (t - last < LANCE_REHIT) continue;
      // confirm through the real hit volumes (Targets): a ray from the eye to its body
      _v1.set(a.position.x, a.position.y + (a.dims?.bodyY ?? 0.6) * (a.scale ?? 1), a.position.z);
      _dir.subVectors(_v1, _commandOrigin); const len = _dir.length(); _dir.multiplyScalar(1 / Math.max(len, 1e-4));
      const hit = this.targets?.raycast(_commandOrigin, _dir, len + 1) ?? null;
      if (hit === null || !this.same(hit.animal, a)) continue;
      const dmg = Math.round(this.profile.lance.baseDamage + this.profile.lance.speedDamage * speed);
      const result = this.contact(hit.animal, dmg, hit.point, _dir, _commandOrigin, 'move.lance');
      if (!result) continue;
      this.rehit.set(a, t);
      const killed = result.killed;
      if (!killed) hit.animal.stagger?.(_v2.set(dx, 0, dz).normalize(), 1);
      this.jolt = 1.4;
      this.onHit?.(hit.animal.kind, false, killed);
      this.onImpact?.('flesh', hit.point);
    }
  }
  private same(a: TargetAnimal, b: AimTarget): boolean { return a.position === b.position; }

  private thrustHit(): void {
    if (this.targets === undefined) return;
    this.aimPose(_commandOrigin, _commandRotation);
    this.aimRay(_commandOrigin, _fwd);
    _e.set(0, 0, 0, 'YXZ');
    for (const pitch of this.profile.thrust.fan.pitches) for (const yaw of this.profile.thrust.fan.yaws) {
      _e.y = yaw; _e.x = pitch;
      _q.setFromEuler(_e); _q.premultiply(_commandRotation);
      _dir.set(0, 0, -1).applyQuaternion(_q);
      const hit = this.targets.raycast(_commandOrigin, _dir, this.profile.reach);
      if (!hit || !hit.animal.alive) continue;
      const result = this.contact(hit.animal, this.profile.thrust.damage, hit.point, _fwd, _commandOrigin, 'move.thrust');
      if (!result) continue;
      const killed = result.killed;
      if (!killed) hit.animal.stagger?.(_v2.set(_fwd.x, 0, _fwd.z).normalize(), this.profile.thrust.stagger);
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
      this.rmbDown = false;
      if (this.windT >= 0 && !inHand) { this.windT = -1; this.releaseQueued = false; }
      if (!inHand) { this.thrustT = -1; this.queued = false; }
    }
    if (inHand !== this.inHand) { this.inHand = inHand; if (!inHand) { p.moveScale = 1; p.swinging = false; } }

    if (inHand) {
      // FOV (Hor+ on portrait) + the dodge kick
      const baseFov = fovForAspect(this.profile.feel.fovHip, cam.aspect);
      const target = baseFov + p.fovKick;
      if (Math.abs(target - this.fov) > 0.01) {
        const refit = Math.abs(baseFov - this.baseFov) > 0.01; this.baseFov = baseFov;
        this.fov = target; cam.fov = target; cam.updateProjectionMatrix();
        if (refit) this.sky.csm.updateFrustums();
      }
    }

    // ── inputs: quick RMB tap throws; the THROW disc edges wind / throw ──
    if (this.rmbDown) this.rmbT += dt;
    p.moveScale = 1;

    const throwHeld = this.adsHeld && this.enabled && inHand;
    if (throwHeld && !this.throwPrev) this.beginWind();
    if (!throwHeld && this.throwPrev && this.windT >= 0) this.releaseQueued = true;
    this.throwPrev = throwHeld;
    if (this.windT >= 0) {
      this.windT += dt;
      if (this.releaseQueued && this.windT >= this.thrown.profile.windup) { this.windT = -1; this.releaseQueued = false; this.throwT = 0; this.threw = false; }
    }
    if (this.throwT >= 0) {
      this.throwT += dt;
      if (!this.threw && this.throwT >= this.thrown.profile.release * 0.5) { this.threw = true; this.launch(); }
      if (this.throwT >= this.thrown.profile.release + this.thrown.profile.recovery) this.throwT = -1;
    }

    // ── thrust clock ──
    if (this.thrustT >= 0) {
      this.thrustT += dt;
      if (!this.hitDone && this.thrustT >= this.profile.thrust.windup && this.thrustT <= this.profile.thrust.activeEnd) this.thrustHit();
      if (this.thrustT >= this.profile.thrust.total) { this.thrustT = -1; if (this.queued) { this.queued = false; this.tryFire(); } }
    }
    if (inHand) p.swinging = this.thrustT >= 0;

    // ── contacts: the couched lance (mounted, canter+) ──
    const lance = this.mount !== null && this.mount.speed >= this.profile.lance.minSpeed && this.windT < 0 && this.throwT < 0;
    if (inHand && lance) this.contacts(dt, t);
    else if (this.prevPos.size > 0) this.prevPos.clear();

    this.flyJavelins(dt);
    this.state.bolts = this.javelins; this.state.loaded = this.javelins > 0; this.state.ads = this.windT >= 0;

    // ── pose ──
    this.jolt *= Math.exp(-dt * 14);
    const throwing = this.windT >= 0 || this.throwT >= 0;
    this.throwBlend += ((throwing ? 1 : 0) - this.throwBlend) * (1 - Math.exp(-dt * (throwing ? 16 : 8)));
    this.lanceBlend += ((lance ? 1 : 0) - this.lanceBlend) * (1 - Math.exp(-dt * 6));
    this.sprintBlend += ((p.sprinting && this.thrustT < 0 && !throwing ? 1 : 0) - this.sprintBlend) * Math.min(1, dt * 7);

    // look lag (spring, substepped)
    let dYaw = p.yaw - this.lastYaw, dPitch = p.pitch - this.lastPitch;
    this.lastYaw = p.yaw; this.lastPitch = p.pitch;
    if (Math.abs(dYaw) > 1) dYaw = 0; if (Math.abs(dPitch) > 1) dPitch = 0;
    this.lookState.yaw = this.lagYaw; this.lookState.pitch = this.lagPitch;
    this.lookState.yawVelocity = this.lagYawVel; this.lookState.pitchVelocity = this.lagPitchVel;
    this.lookBlock.step(this.lookState, this.lookDelta.set(dYaw, dPitch), dt);
    this.lagYaw = this.lookState.yaw; this.lagPitch = this.lookState.pitch;
    this.lagYawVel = this.lookState.yawVelocity; this.lagPitchVel = this.lookState.pitchVelocity;

    // the spear: rest → thrust (cock, jab, recover) → lance / left-low while throwing
    const sp = _v1, sq = _q;
    sp.copy(REST.pos); sq.copy(REST.q);
    if (this.thrustT >= 0) {
      const tt = this.thrustT;
      if (tt < this.profile.thrust.windup) { const f = sstep(0, 1, tt / this.profile.thrust.windup); sp.lerp(COCK.pos, f); sq.slerp(COCK.q, f); }
      else if (tt < this.profile.thrust.activeEnd) { const f = 1 - (1 - (tt - this.profile.thrust.windup) / (this.profile.thrust.activeEnd - this.profile.thrust.windup)) ** 3; sp.copy(COCK.pos).lerp(JAB.pos, f); sq.copy(COCK.q).slerp(JAB.q, f); }
      else { const f = sstep(0, 1, (tt - this.profile.thrust.activeEnd) / (this.profile.thrust.total - this.profile.thrust.activeEnd)); sp.copy(JAB.pos).lerp(REST.pos, f); sq.copy(JAB.q).slerp(REST.q, f); }
    }
    const lb = sstep(0, 1, this.lanceBlend), tb = sstep(0, 1, this.throwBlend), sb = this.sprintBlend;
    if (lb > 0) { sp.lerp(LANCE.pos, lb); sq.slerp(LANCE.q, lb); }
    if (sb > 0) { sp.lerp(SPRINT.pos, sb); sq.slerp(SPRINT.q, sb); }
    // the right hand: on the shaft (the spear's own grip transform) unless throwing
    const hp = _v2.copy(sp), hq = _q2.copy(sq);
    if (tb > 0) {
      // the spear goes to the left hand, low left; the right hand brings a javelin up by the ear, then snaps it forward
      sp.lerp(_v3.copy(LEFT_LOW.pos), tb); sq.slerp(LEFT_LOW.q, tb);
      let jp = JAV_COCK.pos, jq = JAV_COCK.q;
      let wind = 1;
      if (this.windT >= 0) wind = sstep(0, 1, this.windT / this.thrown.profile.windup);
      if (this.throwT >= 0) {
        const f = this.throwT < this.thrown.profile.release ? 1 - (1 - this.throwT / this.thrown.profile.release) ** 2 : 1;
        jp = _vThrow.copy(JAV_COCK.pos).lerp(JAV_OUT.pos, f); jq = _qThrow.copy(JAV_COCK.q).slerp(JAV_OUT.q, f);
      }
      _vCock.copy(REST.pos).lerp(jp, wind); _qCock.copy(REST.q).slerp(jq, wind);
      if (this.windT >= 0) { _vCock.x += Math.sin(t * 31) * 0.002 * wind; _vCock.z += 0.02 * wind * sstep(0.6, 1, this.windT / this.thrown.profile.windup); } // drawn back taut
      hp.lerp(_vCock, tb); hq.slerp(_qCock, tb);
    }
    this.heldJav.visible = (this.windT >= 0 || (this.throwT >= 0 && !this.threw)) && this.javelins > 0;

    // sway / bob / look lag / jolt, the portrait layout, the holster drop — applied to both rigs alike
    const sf = p.speedFactor, m = 1;
    const swX = Math.sin(t * this.profile.feel.sway.fx) * this.profile.feel.sway.ax, swY = Math.sin(t * this.profile.feel.sway.fy) * this.profile.feel.sway.ay;
    const bobX = Math.cos(p.bobTime) * this.profile.feel.bob.x * sf, bobY = -Math.abs(Math.sin(p.bobTime)) * this.profile.feel.bob.y * sf;
    _e.set((Math.sin(p.bobTime * 2) * this.profile.feel.bob.rx * sf + this.lagPitch + this.jolt * 0.05) * m, this.lagYaw * m, (Math.sin(t * 0.5) * 0.006 + Math.cos(p.bobTime) * this.profile.feel.bob.rz * sf) * m, 'YXZ');
    _qSway.setFromEuler(_e);
    const portrait = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * 1.6) : 0;
    const scale = 1 - portrait * 0.15;
    const h = this.holster > 0 ? sstep(0, 1, this.holster) : 0;
    if (h > 0) _qHol.setFromEuler(_e.set(-h * 0.6, 0, h * 0.3, 'YXZ'));
    for (const [pos, q, rig] of [[sp, sq, this.spearRig], [hp, hq, this.handRig]] as [THREE.Vector3, THREE.Quaternion, THREE.Group][]) {
      pos.x += (swX + bobX + this.lagYaw * this.profile.feel.lag.posYaw) * m; pos.y += (swY + bobY + this.lagPitch * this.profile.feel.lag.posPitch) * m; pos.z += this.jolt * 0.04;
      q.premultiply(_qSway);
      pos.x *= 1 - portrait * 0.3; pos.y *= 1 + portrait * 0.08; pos.z *= 1 + portrait * 0.25;
      if (h > 0) { pos.y -= h * 0.5; pos.z += h * 0.1; q.premultiply(_qHol); }
      if (this.inspect) { pos.set(0.05, -0.1, -1.1); q.setFromEuler(_e.set(0.3, Math.sin(t * 0.3) * 0.6, 1.3, 'YXZ')); }
      rig.position.copy(pos); rig.quaternion.copy(q); rig.scale.setScalar(scale);
    }
    // the sleeves: from each wrist (on its rig) back to its elbow, fixed off the bottom corners of the frame
    for (const [rig, wrist, elbow, arm] of [[this.spearRig, this.leftWrist, L_ELBOW, this.leftArm], [this.handRig, this.rightWrist, R_ELBOW, this.rightArm]] as [THREE.Group, THREE.Vector3, THREE.Vector3, THREE.Mesh][]) {
      rig.updateMatrix();
      _vArm.copy(wrist).applyMatrix4(rig.matrix);
      _vEl.set(elbow.x * (1 - portrait * 0.3), elbow.y - h * 0.5, elbow.z);
      placeArm(arm, _vArm, _vEl.sub(_vArm));
      arm.scale.setScalar(scale);
    }

    // the dotted throw arc while winding up
    const arcAlpha = this.showArc && inHand && this.windT >= this.thrown.profile.arcAfter ? sstep(this.thrown.profile.arcAfter, this.thrown.profile.windup, this.windT) : 0;
    this.drawArc(arcAlpha);

    // aim readout (HUD "WOLF · 15 M")
    if (this.targets && inHand && (++this.aimFrame & 3) === 0) {
      this.aimRay(_commandOrigin, _fwd);
      const hit = this.targets.raycast(_commandOrigin, _fwd, 120);
      if (hit?.animal.alive) { this.aimCache.kind = hit.animal.kind; this.aimCache.distance = hit.distance; this.aimInfo = this.aimCache; }
      else this.aimInfo = null;
    }
  }

  /** dev: the running clock */
  get clock(): number { return this.time; }
}
