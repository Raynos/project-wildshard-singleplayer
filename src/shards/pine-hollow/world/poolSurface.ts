/** Pine's reversible pool lowering: the eased level the story's open / shut selects. The pool's look graph
 * (generators/waterGraphs.ts, `level`) stands each vertex at it over the baked bed, so no vertex is rewritten here. */
import * as v from 'valibot';
import { WaterSurfaceSchema } from '@wildshard/format/water';
import { smoothstep } from '@wildshard/engine/core/noise';
import { WaterSurface, type WaterSurfaceLook } from '@wildshard/game/systems/looks/waterSurface';

const finite = v.pipe(v.number(), v.finite());
const transition = v.strictObject({ full: finite, lowered: finite,
  seconds: v.pipe(finite, v.minValue(Number.MIN_VALUE)), exponent: v.pipe(finite, v.minValue(Number.MIN_VALUE)),
  depth: v.pipe(v.string(), v.minLength(1), v.maxLength(64)), film: finite, lift: finite, bank: finite,
  reveal: v.tuple([finite, finite]),
});
const schema = v.strictObject({ ...WaterSurfaceSchema.entries, transition: v.exactOptional(transition) });

/** Local presentation only; story commands select the full or lowered state. */
export class PineWaterSurface extends WaterSurface {
  private readonly transition: v.InferOutput<typeof transition> | undefined;
  private travel = 0;
  private lowered = false;
  constructor(input: unknown, look: WaterSurfaceLook) {
    const { transition: row, ...surface } = v.parse(schema, input);
    if (row !== undefined && row.reveal[0] >= row.reveal[1]) throw new Error('Ordered water reveal band required');
    super(surface, look); this.transition = row;
  }
  /** Reveal of the trickle from the pool's normalized travel band. */
  get reveal(): number { const band = this.transition?.reveal; return band === undefined ? 0 : smoothstep(band[0], band[1], this.travel); }
  override draw(...args: Parameters<WaterSurface['draw']>): this { super.draw(...args); this.applyLevel(); return this; }
  /** Saved state can settle immediately without an animation. */
  setLowered(lowered: boolean, instant = false): void {
    if (this.transition === undefined) throw new Error('Water surface has no level transition');
    this.lowered = lowered;
    if (instant) { this.travel = lowered ? 1 : 0; this.applyLevel(); }
  }
  private applyLevel(): void {
    const row = this.transition;
    if (row === undefined) return;
    this.level = row.full + (row.lowered - row.full) * (1 - (1 - this.travel) ** row.exponent);
  }
  override update(dt: number): void {
    const row = this.transition, goal = this.lowered ? 1 : 0;
    if (row !== undefined && this.travel !== goal) {
      this.travel = goal > this.travel ? Math.min(1, this.travel + dt / row.seconds) : Math.max(0, this.travel - dt / row.seconds);
      this.applyLevel();
    }
    super.update(dt);
  }
}
