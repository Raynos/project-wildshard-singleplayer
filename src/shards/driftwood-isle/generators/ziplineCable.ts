import { MathUtils, Vector3 } from 'three';

/** Platform deck offset and cable/landing attachment heights in metres (the engine's zipline constants). */
const DECK_H = 0.5, CABLE_ABOVE = 3.6, LANDING_ABOVE = 3.2;

/** A zipline's floor ends and its sag in metres at mid-span per 100 m (default 1.6). */
export interface ZiplineEnds { readonly top: Vector3; readonly bottom: Vector3; readonly sag?: number }

/**
 * The cable a zipline's build-time geometry follows: the launch deck, the cable's two ends and its parabolic sag,
 * constructed exactly as the engine's `CableLayout` (engine/sim/cableTraversal.ts) constructs them, so the zipline bank
 * needs no runtime import; `test/driftwood-zipline-cable.test.ts` fences the two against each other.
 */
export class ZiplineCable {
  readonly a: Vector3 = new Vector3();
  readonly b: Vector3 = new Vector3();
  readonly len: number;
  readonly sag: number;
  readonly dir: Vector3 = new Vector3();
  readonly flat: Vector3;
  readonly deck = { x: 0, z: 0, yaw: 0, y: 0, hw: 1.2, hd: 1.8 };
  readonly spec: ZiplineEnds;

  constructor(spec: ZiplineEnds) {
    this.spec = spec;
    const flat = this.flat = new Vector3(spec.bottom.x - spec.top.x, 0, spec.bottom.z - spec.top.z).normalize();
    // the deck: 3.6 m long, its outer edge at `top`, running back up the slope
    this.deck.yaw = Math.atan2(flat.x, flat.z);
    this.deck.x = spec.top.x - flat.x * this.deck.hd; this.deck.z = spec.top.z - flat.z * this.deck.hd; this.deck.y = spec.top.y + DECK_H;
    this.a.set(spec.top.x + flat.x * 0.4, this.deck.y + CABLE_ABOVE, spec.top.z + flat.z * 0.4);
    this.b.set(spec.bottom.x, spec.bottom.y + LANDING_ABOVE, spec.bottom.z);
    this.len = this.a.distanceTo(this.b);
    this.sag = (spec.sag ?? 1.6) * (this.len / 100);
    this.dir.subVectors(this.b, this.a).normalize();
  }

  /** a point on the cable at arc position s (0 … len), sagging as a parabola */
  at(s: number, out: Vector3): Vector3 {
    const t = MathUtils.clamp(s / this.len, 0, 1);
    return out.lerpVectors(this.a, this.b, t).setY(this.a.y + (this.b.y - this.a.y) * t - this.sag * 4 * t * (1 - t));
  }

  /** where the trolley parks at the top, and its turn about +Y */
  park(out: Vector3): number { this.at(0.6, out); return Math.atan2(this.dir.x, this.dir.z) + Math.PI / 2; }
}
