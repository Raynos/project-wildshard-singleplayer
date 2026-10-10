import { javelinSpearType, type JavelinSpearMount, type JavelinSpearParts, type JavelinSpearPose, type JavelinSpearRowOptions, type JavelinSpearView, type JavelinSpearWeapon, type JavelinSpearWorld } from '@wildshard/sdk/items/javelinSpear';
import { lin } from '@wildshard/engine/math/color';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { MeleeProfile } from '@wildshard/sdk/weapons/meleeProfile';
import { SWORD_WOOD } from '@wildshard/sdk/runtime/weapons/starterMeleeProfile';
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

/** the host the spear draws into */
export type SpearWorld = JavelinSpearWorld;
/** construction: the unlock policy and an optional profile over SPEAR_PROFILE */
export type SpearOptions = JavelinSpearRowOptions<typeof SPEAR_PROFILE>;
/** the riding row's hook (B7): horse speed / heading while mounted */
export type MountState = JavelinSpearMount;

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

// ───────────────────────────── poses (camera space: +X right, +Y up, -Z forward; the right hand's grip point + the shaft's direction) ─────────────────────────────

const Y = new THREE.Vector3(0, 1, 0);
const _qr = new THREE.Quaternion();
function pose(px: number, py: number, pz: number, dx: number, dy: number, dz: number, roll = 0): JavelinSpearPose {
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

/** the spear's view row: the poses above, the rider's fists and sleeves (nalatiArms), the RMB tap */
export const SPEAR_VIEW: JavelinSpearView = {
  poses: { rest: REST, cock: COCK, jab: JAB, leftLow: LEFT_LOW, sprint: SPRINT, lance: LANCE, javCock: JAV_COCK, javOut: JAV_OUT },
  leftHandY: LEFT_HAND_Y,
  hands: { left: [-0.42, -0.62, 0.66], right: [0.62, -0.5, 0.6], radius: 0.0165, splay: 0.12, sleeve: 0.75, javelinGrip: 0.1 },
  elbows: { left: new THREE.Vector3(-0.3, -0.62, 0.05), right: new THREE.Vector3(0.36, -0.6, 0.08) },
  tapMax: RMB_TAP_MAX,
};
/** the spear's model: the painterly viewmodel material, the PBR steel, the spear and the javelin, meleeGeo's merge, the
 *  thrown javelins' instanced mesh on a rim-lit painterly material */
export const SPEAR_PARTS: JavelinSpearParts = {
  material: (sky) => meleeMaterial(sky), steel: (sky) => steelMaterial(sky, 0.3), spear: buildSpear, javelin: buildJavelin, merge,
  thrown: (sky, geometry, count) => new THREE.InstancedMesh(geometry, painterlyMaterial(sky, { vertexColors: true, rim: 0.4 }), count),
};

export const JAVELIN: ThrownProfile = {
  id: 'weapon.javelin', speed: JAV_SPEED, gravity: JAV_GRAVITY, damage: JAV_DAMAGE, headMultiplier: JAV_HEAD,
  radius: JAV_RADIUS, headOffset: 0.8, windup: WINDUP, release: THROW_T, recovery: THROW_RECOVER,
  carried: 3, pool: JAV_POOL, pickupRadius: PICKUP_R, pickupHeight: 2.2, survive: JAV_SURVIVE,
  arcPoints: ARC_POINTS, arcAfter: ARC_SHOW_AFTER, stagger: 1,
};

export const SPEAR_PROFILE: MeleeProfile & {
  thrust: { damage: number; stagger: number; windup: number; activeEnd: number; total: number; fan: typeof THRUST_FAN };
  lance: { reach: number; cone: number; minSpeed: number; baseDamage: number; speedDamage: number; rehit: number };
} = {
  ...SWORD_WOOD, ...SPEAR, parent: SWORD_WOOD.id, damage: THRUST_DAMAGE, reach: REACH,
  hitStop: { body: 0, head: 0, kill: 0 },
  cues: { fire: 'cue.spear.thrust', reload: 'cue.reload', impact: 'cue.javelin.hit', hit: 'cue.javelin.hit', charge: { throw: 'cue.javelin.throw', recover: 'cue.javelin.pickup' } },
  thrust: { damage: THRUST_DAMAGE, stagger: THRUST_STAGGER, windup: T_WIND, activeEnd: T_ACTIVE_END, total: T_TOTAL, fan: THRUST_FAN },
  lance: { reach: LANCE_REACH, cone: LANCE_CONE, minSpeed: LANCE_MIN_SPEED, baseDamage: 40, speedDamage: 6, rehit: LANCE_REHIT },
  feel: { lag: { gain: 0.4, clampYaw: 0.1, clampPitch: 0.08, k: 200, c: 20, posYaw: 0.25, posPitch: 0.2 },
    bob: { x: 0.016, y: 0.013, rx: 0.01, rz: 0.015 }, sway: { ax: 0.003, fx: 0.7, ay: 0.0025, fy: 1.1 }, fovHip: FOV_HIP },
};

/** A built spear: the type the riding and kit code hold. */
export type SpearWeapon = JavelinSpearWeapon<typeof SPEAR_PROFILE>;
/** The spear as a row over the platform's javelin spear: SPEAR_PROFILE (or `opts.profile`), JAVELIN, its model and view. */
export const Spear = javelinSpearType<typeof SPEAR_PROFILE>({ profile: SPEAR_PROFILE, javelin: JAVELIN, parts: SPEAR_PARTS, view: SPEAR_VIEW });
