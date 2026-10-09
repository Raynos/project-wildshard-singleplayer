/**
 * The zipline's motion law, renderer-free: the one rule the page's ZipRide (quest/rides.ts) and the headless quest keeper
 * (runtime/quest.ts) both ride. A trolley on the lookout's cable (PineLandmarks' sagging chord, 1.2 % of the span):
 * gravity along the wire minus drag (Driftwood's Zipline.ts rule), 1.5–16 m/s, the rider 3.15 m under the trolley. A ride
 * starts 0.7 m down the wire at 2.5 m/s and lets go 2 m short of the end, dropping onto the landing's deck 0.6 m back
 * along the wire's line and walking on at 2.5 m/s.
 */
import { MathUtils, Vector3 } from 'three';

const G = 9.8, DRAG = 0.012, VMIN = 1.5, VMAX = 16, SAG = 0.012, LET_GO = 2.0, BACK = 0.6, DECK = 0.05;
/** The rider hangs this far under the trolley. */
export const ZIP_HANG = 3.15;
/** The top speed (the page's camera roll scales with the speed over it). */
export const ZIP_VMAX = VMAX;
/** Where a ride starts down the wire (and where the parked trolley waits), and its launch speed. */
export const ZIP_START = 0.7, ZIP_LAUNCH_V = 2.5;

/** A ride's place on the wire: its arc position and speed. */
export interface ZipState { s: number; v: number }
interface Point { readonly x: number; readonly y: number; readonly z: number }

const _a = new Vector3(), _b = new Vector3();

/** One cable from the launch's top anchor to the landing's bottom one. */
export class ZipWire {
  readonly len: number;
  /** the wire's level heading, unit length */
  readonly dir = new Vector3();
  private readonly sag: number;
  private readonly top: Vector3;
  private readonly bottom: Vector3;

  constructor(top: Point, bottom: Point) {
    this.top = new Vector3(top.x, top.y, top.z); this.bottom = new Vector3(bottom.x, bottom.y, bottom.z);
    this.len = this.top.distanceTo(this.bottom);
    this.sag = this.len * SAG;
    this.dir.subVectors(this.bottom, this.top).setY(0).normalize();
  }

  /** the cable at arc position s */
  at(s: number, out: Vector3): Vector3 {
    const t = MathUtils.clamp(s / this.len, 0, 1);
    return out.lerpVectors(this.top, this.bottom, t).setY(this.top.y + (this.bottom.y - this.top.y) * t - 4 * this.sag * t * (1 - t));
  }

  /** one step of the trolley: the speed from the wire's slope here, then along. True while the ride holds on. */
  step(ride: ZipState, dt: number): boolean {
    const slope = -(this.at(ride.s + 0.5, _a).y - this.at(ride.s, _b).y) / 0.5;
    ride.v = Math.min(VMAX, Math.max(VMIN, ride.v + (G * slope * 0.9 - DRAG * ride.v * ride.v) * dt));
    ride.s += ride.v * dt;
    return ride.s < this.len - LET_GO;
  }

  /** where the rider hangs at arc position s */
  rider(s: number, out: Vector3): Vector3 { this.at(s, out); out.y -= ZIP_HANG; return out; }

  /** the let-go: onto the landing's deck (never below the rider's height `y`), and the walk-on velocity */
  dismount(landing: Point, y: number, out: Vector3, velocity: Vector3): void {
    out.set(landing.x - this.dir.x * BACK, Math.max(y, landing.y + DECK), landing.z - this.dir.z * BACK);
    velocity.set(this.dir.x * ZIP_LAUNCH_V, 0, this.dir.z * ZIP_LAUNCH_V);
  }
}
