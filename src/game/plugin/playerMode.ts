import * as v from 'valibot';
import { MathUtils, Vector3 } from 'three';
import { ZiplineModeSchema, type ZiplineMode, UpdraftModeSchema, type UpdraftMode } from '@wildshard/format/modes';
/** The platform's cable/deck law, used by author rows and both native hosts. */

/** Floor endpoint vectors; explicit construction data, never scene or renderer ownership. */
export interface ZiplineSpec { top: Vector3; bottom: Vector3; /** sag in metres at mid-span per 100 m (default 1.6) */ sag?: number }

/** Platform deck offset and cable/landing attachment heights in metres. */
export const DECK_H = 0.5, CABLE_ABOVE = 3.6, LANDING_ABOVE = 3.2;
const V = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** the zipline's layout on its ends: the launch deck, the cable's two ends and its sag (world) */
export class CableLayout {
  /** the cable's two ends (world) */
  readonly a = new Vector3();
  readonly b = new Vector3();
  readonly len: number;
  readonly sag: number;
  readonly dir = new Vector3();
  /** the flat direction down the line */
  readonly flat: Vector3;
  readonly deck = { x: 0, z: 0, yaw: 0, y: 0, hw: 1.2, hd: 1.8 };

  readonly spec: ZiplineSpec;

  constructor(spec: ZiplineSpec) {
    this.spec = spec;
    const flat = this.flat = V(spec.bottom.x - spec.top.x, 0, spec.bottom.z - spec.top.z).normalize();
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


const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ riding: v.boolean(), s: v.pipe(finite, v.minValue(0)), v: v.pipe(finite, v.minValue(0), v.maxValue(32)) });

/** The native page's zipline continuation: cable gravity/drag, carry pose and release velocity; no renderer or grants. */
export class ZiplineDriver {
  private readonly layout: CableLayout;
  private readonly point = new Vector3();
  private readonly ahead = new Vector3();
  private readonly onRide: (on: boolean) => void;
  private riding = false;
  private s = 0;
  private v = 0;

  private readonly row: ZiplineMode;
  constructor(row: ZiplineMode, onRide: (on: boolean) => void) {
    this.row = v.parse(ZiplineModeSchema, row);
    this.layout = new CableLayout({ top: new Vector3(row.top.x, row.top.y, row.top.z), bottom: new Vector3(row.bottom.x, row.bottom.y, row.bottom.z), sag: row.sag }); this.onRide = onRide;
  }

  get isRiding(): boolean { return this.riding; }

  /** The page's prompt starts once, before its next update. Carry ownership belongs to the callback's player owner. */
  start(): void {
    if (this.riding) return;
    this.riding = true; this.s = 0.4; this.v = 2.5;
    this.onRide(true);
  }

  /** Same post-player update law as world/Zipline.ts; all vectors are reused and the finish callback runs once. */
  update(dt: number, player: { position: Vector3; velocity: Vector3 }): void {
    if (!this.riding) return;
    const slope = -(this.layout.at(this.s + 0.5, this.ahead).y - this.layout.at(this.s, this.point).y) / 0.5;
    this.v = Math.min(this.row.maxSpeed, Math.max(1.5, this.v + (this.row.gravity * slope * 0.9 - this.row.drag * this.v * this.v) * dt));
    this.s += this.v * dt;
    this.layout.at(this.s, this.point);
    player.position.copy(this.point); player.position.y -= this.row.hang;
    player.velocity.set(0, 0, 0);
    if (this.s >= this.layout.len - 1.6) {
      this.riding = false;
      const dir = this.layout.dir;
      player.velocity.set(dir.x * Math.min(6, this.v * 0.4), 1.5, dir.z * Math.min(6, this.v * 0.4));
      this.layout.park(this.point);
      this.onRide(false);
    }
  }

  /** Copied native continuation; the host snapshots the actual player pose and carry owner separately. */
  snapshot(): v.InferOutput<typeof Saved> { return { riding: this.riding, s: this.s, v: this.v }; }

  /** Restore does not start a ride, move the player, draw RNG or publish a callback. Refusal is atomic. */
  restore(value: unknown): void {
    const saved = v.parse(Saved, value);
    if (saved.v > this.row.maxSpeed) throw new Error('Zipline continuation exceeds its admitted speed');
    this.riding = saved.riding; this.s = saved.s; this.v = saved.v;
  }
}

/** The directional column keeps the native strict sides and upper ceiling, with no invented lower boundary. */
export function inUpdraft(row: UpdraftMode, x: number, y: number, z: number): boolean {
  const ux = row.to.x - row.from.x, uz = row.to.z - row.from.z, len = Math.hypot(ux, uz);
  const along = ((x - row.from.x) * ux + (z - row.from.z) * uz) / len, across = Math.abs((x - row.from.x) * uz - (z - row.from.z) * ux) / len;
  return across < row.width / 2 + row.margin && along > 0 && along < len && y < row.to.y + row.margin;
}
/** The board wind law reads real feet and hover state; one host owns when the impulse reaches its player phase. */
export class UpdraftDriver {
  private readonly row: UpdraftMode;
  constructor(row: UpdraftMode) { this.row = v.parse(UpdraftModeSchema, row); }
  /** Add the native lift only while the board is actually inside the admitted column. */
  step(dt: number, feet: { x: number; y: number; z: number }, hovering: boolean, impulse: Vector3): void {
    if (hovering && inUpdraft(this.row, feet.x, feet.y, feet.z)) impulse.y += this.row.lift * dt;
  }
}
