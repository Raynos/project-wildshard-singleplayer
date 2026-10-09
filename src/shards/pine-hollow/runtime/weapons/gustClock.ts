import * as v from 'valibot';
import type { Vector3 } from 'three';
import { clockGust, fieldGustAt } from '@wildshard/engine/world/windField';

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ version: v.literal(1), time: v.pipe(finite, v.minValue(0)), gust: v.pipe(finite, v.minValue(0), v.maxValue(1)) });
type GustSnapshot = v.InferOutput<typeof Saved>;
const FIELD = { x: -0.55, z: 0.83, frontLength: 150, frontSpeed: 11, secondaryLength: 0.61 * 150 };
const INVALID_DELTA = new RangeError('Invalid gust clock delta');

/** Explicit continuation for Pine's projectile gusts. Its owner supplies the SAME weather's wind boost and advances
 * it at the world clock boundary; this sampler neither constructs weather nor installs a callback. Until that owner
 * is wired, native rain/render-clock parity remains a named outcome difference. */
export class PineGustClock {
  private readonly boost: () => number;
  private time = 0;
  private gust = 0.5;
  constructor(boost: () => number) { this.boost = boost; }

  advance(dt: number): void {
    if (!Number.isFinite(dt) || dt < 0) throw INVALID_DELTA;
    this.time += dt;
    this.gust = clockGust(this.time, this.boost());
  }

  /** Matches longbowProfile's arithmetic and preserves the supplied vector's Y component. */
  vecAt(x: number, z: number, out: Vector3): Vector3 {
    const speed = 1.2 + 7 * fieldGustAt(x, z, this.time, this.gust, FIELD);
    out.x = FIELD.x * speed; out.z = FIELD.z * speed;
    return out;
  }

  snapshot(): GustSnapshot { return { version: 1, time: this.time, gust: this.gust }; }
  prepareRestore(value: unknown): () => void {
    const saved = v.parse(Saved, value);
    return () => { this.time = saved.time; this.gust = saved.gust; };
  }
  restore(value: unknown): void { this.prepareRestore(value)(); }
}
