import * as v from 'valibot';
import { Vector3 } from 'three';
import { ZiplineLayout, type ZiplineSpec } from './ziplineLayout';

const HANG = 2.9, G = 9.8, DRAG = 0.012, VMAX = 16;
const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ riding: v.boolean(), s: v.pipe(finite, v.minValue(0)), v: v.pipe(finite, v.minValue(0), v.maxValue(VMAX)) });

/** The native page's zipline continuation: cable gravity/drag, carry pose and release velocity; no renderer or grants. */
export class DriftwoodZipline {
  private readonly layout: ZiplineLayout;
  private readonly point = new Vector3();
  private readonly ahead = new Vector3();
  private readonly onRide: (on: boolean) => void;
  private riding = false;
  private s = 0;
  private v = 0;

  constructor(spec: ZiplineSpec, onRide: (on: boolean) => void) {
    this.layout = new ZiplineLayout(spec); this.onRide = onRide;
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
    this.v = Math.min(VMAX, Math.max(1.5, this.v + (G * slope * 0.9 - DRAG * this.v * this.v) * dt));
    this.s += this.v * dt;
    this.layout.at(this.s, this.point);
    player.position.copy(this.point); player.position.y -= HANG;
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
    this.riding = saved.riding; this.s = saved.s; this.v = saved.v;
  }
}
