/** Listed Pine view code: per-frame wet-bed projection for the beaver pool.
 * The shared surface owns drawing; Pine owns its reversible lowering look. */
import type * as THREE from 'three';
import * as v from 'valibot';
import { WaterSurfaceSchema } from '@wildshard/format/water';
import { smoothstep } from '@wildshard/engine/core/noise';
import { WaterSurface, type WaterSurfaceDraw, type WaterSurfaceLook } from '@wildshard/game/systems/looks/waterSurface';

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
  private ground = new Float32Array(0);
  private travel = 0;
  private lowered = false;
  constructor(input: unknown, look: WaterSurfaceLook) {
    const { transition: row, ...surface } = v.parse(schema, input);
    if (row !== undefined && row.reveal[0] >= row.reveal[1]) throw new Error('Ordered water reveal band required');
    super(surface, look); this.transition = row;
  }
  /** Reveal of the trickle from the pool's normalized travel band. */
  get reveal(): number { const band = this.transition?.reveal; return band === undefined ? 0 : smoothstep(band[0], band[1], this.travel); }
  override draw(geometry: THREE.BufferGeometry, at: WaterSurfaceDraw & { readonly ground?: readonly number[] } = {}): this {
    const row = this.transition;
    if (row !== undefined && (at.ground?.length !== geometry.getAttribute('position').count
      || !at.ground.every(Number.isFinite) || !geometry.hasAttribute(row.depth))) throw new Error('Water transition requires matching bed and depth channels');
    this.ground = Float32Array.from(at.ground ?? []);
    super.draw(geometry, at); this.applyLevel(); return this;
  }
  /** Saved state can settle immediately without an animation. */
  setLowered(lowered: boolean, instant = false): void {
    if (this.transition === undefined) throw new Error('Water surface has no level transition');
    this.lowered = lowered;
    if (instant) { this.travel = lowered ? 1 : 0; this.applyLevel(); }
  }
  private applyLevel(): void {
    const row = this.transition;
    if (row === undefined) return;
    const eased = 1 - (1 - this.travel) ** row.exponent;
    this.level = row.full + (row.lowered - row.full) * eased;
    const geometry = this.mesh.geometry, position = geometry.getAttribute('position'), depth = geometry.getAttribute(row.depth);
    for (let i = 0; i < position.count; i++) {
      const h = this.ground[i]; if (h === undefined) throw new Error('Missing admitted water bed');
      const d = this.level - h;
      let y = this.level, code = d;
      if (d < 0) {
        if (h < row.full) { y = h + row.lift; code = Math.max(d, row.film); }
        else if (d > row.bank) y = h + row.lift;
      }
      position.setY(i, y); depth.setX(i, code);
    }
    position.needsUpdate = true; depth.needsUpdate = true;
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
