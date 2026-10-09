import { Vector3 } from 'three';

/** A combat target's chest above its port position (its feet), and the lane's body allowance (metres). */
export const LASH_CHEST = 0.9, LASH_BODY = 0.7;

/** A creature's hit volumes in world space: the head ball and the body capsule (the shapes `CreatureBodies` poses). */
export interface LashVolumes {
  readonly head: Vector3; readonly headRadius: number;
  readonly a: Vector3; readonly b: Vector3; readonly bodyRadius: number;
}

const oc = new Vector3(), ba = new Vector3(), oa = new Vector3(), closest = new Vector3(), delta = new Vector3();

/** First non-negative hit of the ray on a ball, or null (the origin is outside it). */
function ball(from: Vector3, dir: Vector3, centre: Vector3, radius: number): number | null {
  oc.subVectors(from, centre);
  const b = oc.dot(dir), c = oc.lengthSq() - radius * radius, h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}

/**
 * The lash's first contact with a creature's volumes along `dir` (unit) within `reach`, in metres from `from`, or null:
 * the same test the browser's shared raycast runs against the posed head ball and body capsule. An origin inside a
 * volume touches it at once (Rapier's solid cast answers 0 there too).
 */
export function lashVolumeHit(from: Vector3, dir: Vector3, reach: number, body: LashVolumes): number | null {
  ba.subVectors(body.b, body.a); oa.subVectors(from, body.a);
  const baba = ba.lengthSq(), along = baba > 1e-12 ? Math.min(1, Math.max(0, oa.dot(ba) / baba)) : 0;
  closest.copy(body.a).addScaledVector(ba, along);
  if (from.distanceToSquared(closest) <= body.bodyRadius ** 2 || from.distanceToSquared(body.head) <= body.headRadius ** 2) return 0;
  let best = Infinity;
  // the capsule's side: the infinite cylinder's entry, kept only between its two caps
  const bard = ba.dot(dir), baoa = ba.dot(oa), rdoa = dir.dot(oa), a = baba - bard * bard;
  if (a > 1e-12) {
    const b = baba * rdoa - baoa * bard, c = baba * oa.lengthSq() - baoa * baoa - body.bodyRadius ** 2 * baba, h = b * b - a * c;
    if (h >= 0) { const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard; if (t >= 0 && y > 0 && y < baba) best = t; }
  }
  // its two caps and the head
  for (const t of [ball(from, dir, body.a, body.bodyRadius), ball(from, dir, body.b, body.bodyRadius), ball(from, dir, body.head, body.headRadius)]) if (t !== null && t < best) best = t;
  return best <= reach ? best : null;
}

/**
 * The browser lash's lane (Bullwhip.inLane): how far along `dir` a target's chest (`LASH_CHEST` over its feet) sits when
 * it is inside the narrow lane (`reach` + `LASH_BODY` long, `width` + `LASH_BODY` wide), or null. The lash lands at
 * `min(forward, reach)` along the ray.
 */
export function lashLane(from: Vector3, dir: Vector3, reach: number, width: number, feet: Vector3): number | null {
  delta.copy(feet).sub(from); delta.y += LASH_CHEST;
  const forward = delta.dot(dir);
  if (forward < 0 || forward > reach + LASH_BODY) return null;
  return delta.addScaledVector(dir, -forward).length() > width + LASH_BODY ? null : forward;
}

/**
 * One lash's contact rule, shared by the browser whip and the headless one (SF72): the first hit on the creature's
 * head ball or body capsule inside the reach, else its chest in the lane; the distance along the ray where it lands.
 */
export function lashContact(from: Vector3, dir: Vector3, reach: number, width: number, body: LashVolumes, feet: Vector3): number | null {
  const hit = lashVolumeHit(from, dir, reach, body);
  if (hit !== null) return hit;
  const lane = lashLane(from, dir, reach, width, feet);
  return lane === null ? null : Math.min(lane, reach);
}
