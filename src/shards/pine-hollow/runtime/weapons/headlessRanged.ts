import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { castSegment, sweepBall, type Hit } from '@wildshard/engine/physics/query';
import { shotSpread } from '@wildshard/engine/combat/shotSpread';
import { rangedVolumes, type RangedVolumes } from '../rangedVolumes';

/** The page Player's eye over its feet (player/Player.ts EYE): every aim line starts there. */
export const EYE = 1.68;
/** A body's hit along a ray: the body, head or not, the distance along the ray, the point (the result is reused). */
export interface BodyHit { body: AnimalSim | null; head: boolean; distance: number; point: Vector3 }
/** The most bodies a shot is tested against (the roster's live cap). */
const MAX_BODIES = 512;
const SQRT_CONE = { radius: 'sqrt', axisScale: 1 } as const;
const LINEAR_CONE = { radius: 'linear', axisScale: 1 } as const;

type ForeBody = RangedVolumes & { foreCapsule: (a: Vector3, b: Vector3) => boolean };
type RibBody = AnimalSim & { ribsWorld: (out: Vector3) => Vector3 };
const hasFore = (body: RangedVolumes): body is ForeBody => 'foreCapsule' in body && typeof body.foreCapsule === 'function';
const hasRibs = (body: AnimalSim): body is RibBody => 'ribsWorld' in body && typeof body.ribsWorld === 'function';

const _ap = new Vector3(), _ab = new Vector3(), _ao = new Vector3(), _a = new Vector3(), _b = new Vector3();
/** The distance along the unit ray (origin, dir) to a ball, within `max`, or Infinity (0 from inside it, as Rapier's solid cast). */
function raySphere(origin: Vector3, dir: Vector3, centre: Vector3, r: number, max: number): number {
  _ap.subVectors(origin, centre);
  const b = _ap.dot(dir), c = _ap.lengthSq() - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (b > 0 || disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t <= max ? t : Infinity;
}
/** The distance along the unit ray to a capsule (segment a–b, radius r), within `max`, or Infinity: the analytic cast (the
 *  side of the cylinder, else the nearer end ball), 0 from inside it, as Rapier's solid cast of the page's hitbox. */
function rayCapsule(origin: Vector3, dir: Vector3, a: Vector3, b: Vector3, r: number, max: number): number {
  _ab.subVectors(b, a); _ao.subVectors(origin, a);
  const baba = _ab.lengthSq();
  if (baba < 1e-12) return raySphere(origin, dir, a, r, max);
  const u = Math.min(1, Math.max(0, _ao.dot(_ab) / baba));
  if (_ap.copy(a).addScaledVector(_ab, u).distanceToSquared(origin) <= r * r) return 0;
  const bard = _ab.dot(dir), baoa = _ab.dot(_ao), rdoa = dir.dot(_ao), oaoa = _ao.lengthSq();
  const k2 = baba - bard * bard, k1 = baba * rdoa - baoa * bard, k0 = baba * oaoa - baoa * baoa - r * r * baba;
  let t = Infinity;
  if (k2 > 1e-12) {
    const h = k1 * k1 - k2 * k0;
    if (h < 0) return Infinity;
    const side = (-k1 - Math.sqrt(h)) / k2, y = baoa + side * bard;
    if (y > 0 && y < baba && side >= 0) t = side;
  }
  if (t === Infinity) t = Math.min(raySphere(origin, dir, a, r, max), raySphere(origin, dir, b, r, max));
  return t <= max ? t : Infinity;
}

const hitResult: BodyHit = { body: null, head: false, distance: 0, point: new Vector3() };
/**
 * A shot against the creatures' hitboxes (physics/creatures.ts CreatureBodies: a head ball, main capsule and optional chest capsule per live,
 * unhidden body: the Ghost Stag's fade and a parked King take none), from the host body's own head and body capsule
 * (AnimalSim.headWorld / bodyCapsule): the nearest along the ray within `max`, or null.
 */
export function bodyHit(bodies: readonly AnimalSim[], origin: Vector3, dir: Vector3, max: number): BodyHit | null {
  let found = false, bestT = max;
  for (let i = 0; i < MAX_BODIES; i++) {
    const body = bodies[i];
    if (body === undefined) break;
    if (!body.alive || ('hidden' in body && body.hidden === true)) continue;
    const s = body.scale, d = body.dims;
    // a cheap reject: the segment never comes within reach of the body
    if (body.position.distanceTo(origin) > bestT + (d.bodyHalfLen + d.bodyRadius + d.headRadius) * s + d.bodyY * s + 2) continue;
    const volumes = rangedVolumes(body);
    const th = raySphere(origin, dir, volumes.headWorld(_a), d.headRadius * s, bestT);
    volumes.bodyCapsule(_a, _b);
    const tb = rayCapsule(origin, dir, _a, _b, d.bodyRadius * s, Math.min(bestT, th));
    const fore = d.fore;
    let tf = Infinity;
    if (fore !== undefined && hasFore(volumes) && volumes.foreCapsule(_a, _b)) {
      tf = rayCapsule(origin, dir, _a, _b, fore.radius * s, Math.min(bestT, th, tb));
    }
    const t = Math.min(th, tb, tf);
    if (t < bestT) { bestT = t; found = true; hitResult.body = body; hitResult.head = th <= Math.min(tb, tf); hitResult.distance = t; hitResult.point.copy(origin).addScaledVector(dir, t); }
  }
  return found ? hitResult : null;
}

/** The page's `worldHit` (combat/view/ranged.ts): a ball of `radius` (a ray at 0) swept from a to b through the host's world,
 *  passing the ground's edge strips. */
export function worldHit(host: SimHost, a: Vector3, b: Vector3, radius: number): Hit | null {
  let from: { x: number; y: number; z: number } = a, skip: Hit['collider'] | undefined, travelled = 0;
  for (let pass = 0; pass < 4; pass++) {
    const hit = radius > 0 ? sweepBall(host.physics, from, b, radius, undefined, skip) : castSegment(host.physics, from, b, undefined, skip);
    if (hit?.material !== 'edge') { if (hit) hit.distance += travelled; return hit; }
    travelled += hit.distance; from = hit.point; skip = hit.collider;
  }
  return null;
}

/** The `script` command that says where on the body the tick's shots are aimed: its value is the share along the target's
 *  body capsule, from its rear end (0) to its front end (1; a King's ribcage is at 0.75); no command, its middle. */
export const AIM_COMMAND = 'pine.aim';
/** Explicit point aim at a body's declared ribcage (the camera can aim at it on the page); never a damage override. */
export const AIM_RIBS = 2;
/** The aim's share along the body when the tick names none: the capsule's middle. */
export const AIM_MIDDLE = 0.5;
/** A tick's aim share, clamped to the body (a non-finite value is the middle). */
export const aimShare = (value: number): number => (value === AIM_RIBS ? AIM_RIBS : Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : AIM_MIDDLE);

/** The player's eye (`eye`) and the unit aim line from it to the point `along` the target's body capsule (`fwd`; its middle by
 *  default): the tape aims at a point of a body where the page aims along the camera. */
export function aimAt(host: SimHost, target: AnimalSim, eye: Vector3, fwd: Vector3, along = AIM_MIDDLE): void {
  const p = host.player.position;
  eye.set(p.x, p.y + EYE, p.z);
  target.bodyCapsule(_a, _b);
  // the middle in its own arithmetic (the half-sum), so a tape that names no aim flies exactly as before
  if (along === AIM_RIBS && hasRibs(target)) target.ribsWorld(fwd);
  else if (along === AIM_MIDDLE) fwd.addVectors(_a, _b).multiplyScalar(0.5);
  else fwd.copy(_a).lerp(_b, along);
  fwd.sub(eye).normalize();
}

/** The page's cone of fire (hitscan.ts, Bow.ts loose): a random axis across `dir` (three draws), turned by a random share of
 *  `spread` rad (a fourth draw; √ of it when `sqrt`), in place. */
export function spreadInto(dir: Vector3, spread: number, random: () => number, sqrt: boolean, across: Vector3): void {
  shotSpread(dir, spread, random, sqrt ? SQRT_CONE : LINEAR_CONE, across);
}
