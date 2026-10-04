/**
 * Road respawn (SHARD-PLATFORM SF17b, G101): *"If you fall to your death you spawn at the road not inside the shard."*
 * The live crossing remembers the last place the traveller stood on the road itself (the 15 m asphalt band of a segment,
 * not the strips beside it). A fall that began from the road (no ground under the feet inside a cell since) recovers
 * there, in a lane, whatever frame the traveller fell into; standing anywhere inside a cell hands recovery back to that
 * frame's own rules (the shard's start or its last safe floor).
 *
 * Pure grid metres, no three.js or physics: the caller feeds it the world feet once per fixed step.
 */
import { ROAD_HALF } from './roadLayout';

/** A road point in grid metres and the heading the traveller had there. */
export interface RoadPoint { readonly x: number; readonly z: number; readonly yaw: number }
/** The grid's road centre lines: `pitch` apart, half a pitch off the cell origins, over the assembled cells' extent. */
export interface RoadGrid { readonly pitch: number; readonly cells: readonly { readonly cell: readonly [number, number] }[] }

/** How far off a centre line still counts as the road (inside the kerbs). */
const ON_ROAD = ROAD_HALF - 0.5;
/** The recovered point sits in the middle of its lane (the lane dividers are at ±3.55 m). */
const LANE = 3.6;
/** Feet within this of road level are on the deck (a cliff top or a dike crest beside it is not). */
const ROAD_LEVEL = 0.6;

/** Signed distance from the nearest road centre line on one axis (centre lines at k·pitch + pitch/2). */
function across(v: number, pitch: number): number { const c = Math.round((v - pitch / 2) / pitch) * pitch + pitch / 2; return v - c; }

/** Is a world point on a road segment or junction of this grid (within the kerbs, inside the outer ring)? */
export function onRoad(grid: RoadGrid, x: number, z: number): boolean {
  const xs = grid.cells.map((c) => c.cell[0]), zs = grid.cells.map((c) => c.cell[1]), p = grid.pitch;
  const margin = p / 2 + ON_ROAD;
  if (x < Math.min(...xs) * p - margin || x > Math.max(...xs) * p + margin || z < Math.min(...zs) * p - margin || z > Math.max(...zs) * p + margin) return false;
  return Math.abs(across(x, p)) <= ON_ROAD || Math.abs(across(z, p)) <= ON_ROAD;
}

/** The last road point, held until the traveller stands inside a cell. */
export class RoadRecovery {
  private readonly grid: RoadGrid;
  private last: RoadPoint | null = null;
  private inCell = false;
  constructor(grid: RoadGrid) { this.grid = grid; }

  /** Once per fixed step: the world feet, whether they are on the ground, and whether they are inside a cell's interior. */
  observe(feet: { readonly x: number; readonly y: number; readonly z: number }, yaw: number, grounded: boolean, insideCell: boolean): void {
    if (!grounded) return;
    if (insideCell) { this.inCell = true; return; }
    if (Math.abs(feet.y) > ROAD_LEVEL || !onRoad(this.grid, feet.x, feet.z)) return;
    this.inCell = false;
    // snap across the road to the middle of the lane the feet were in (never the kerb beside a drop)
    const p = this.grid.pitch, ax = across(feet.x, p), az = across(feet.z, p);
    const lane = (d: number): number => (d < 0 ? -LANE : LANE);
    const alongX = Math.abs(az) <= ON_ROAD && Math.abs(ax) > ON_ROAD; // a segment running along x (its centre line is a z line)
    this.last = alongX ? { x: feet.x, z: feet.z - az + lane(az), yaw } : Math.abs(ax) <= ON_ROAD && Math.abs(az) > ON_ROAD ? { x: feet.x - ax + lane(ax), z: feet.z, yaw } : { x: feet.x, z: feet.z, yaw };
  }

  /** Where a fall death recovers: the last road point when the fall began from the road, else null (the frame's own rule). */
  target(): RoadPoint | null { return this.inCell ? null : this.last; }
}
