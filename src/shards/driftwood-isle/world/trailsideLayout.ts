import { TRAILSIDE_ROWS, type FenceRow } from '../data/trailsideRows';
/** A sampled fence polyline and its post spacing. */
export interface FenceSpec { path: [number, number][]; spacing?: number }
/** A terrain-following line of plank steps. */
export interface StepsSpec { from: [number, number]; to: [number, number]; width?: number }
/** a trestle stair down a cliff the path crosses: straight from the top (on the upper ground) to the bottom (on the path below) */
/** A trestle flight from lower ground to upper ground. */
export interface FlightSpec { top: [number, number]; bottom: [number, number]; width?: number }
/** A sign location and its lettered arrow headings. */
export interface SignSpec { x: number; z: number; /** arrow boards, top down: heading in radians (0 = +z: world (sin, cos)) and the place lettered on it */ arrows: { toward: number; label?: string }[] }
/** The authored trail dressing layout admitted by the fixed bake. */
export interface TrailsideSpec { fences: FenceSpec[]; steps: StepsSpec[]; signs: SignSpec[]; flights?: FlightSpec[] }

/** a polyline moved `d` m to its left (negative: right), for fences either side of a path's centreline */
function offset(path: [number, number][], d: number): [number, number][] {
  return path.map(([x, z], i) => {
    const a = path[Math.max(0, i - 1)] ?? [x, z], b = path[Math.min(path.length - 1, i + 1)] ?? [x, z];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [x - (dz / l) * d, z + (dx / l) * d];
  });
}

/** The original island fence, plank, sign and trestle layout (its rows: data/trailsideRows.ts). */
export function islandTrailsideSpec(): TrailsideSpec {
  const rows = TRAILSIDE_ROWS;
  const fence = (f: FenceRow): FenceSpec => {
    const spec: FenceSpec = { path: f.centre !== undefined ? offset(f.centre, f.offset ?? 0) : structuredClone(f.path ?? []) };
    if (f.spacing !== undefined) spec.spacing = f.spacing;
    return spec;
  };
  return {
    fences: rows.fences.map(fence),
    steps: structuredClone(rows.steps),
    flights: structuredClone(rows.flights),
    signs: structuredClone(rows.signs),
  };
}

/** A flight's frame: along (bottom → top) and across unit vectors, its width, tread count, run and rise per tread. */
export function flightOf(f: FlightSpec, heightAt: (x: number, z: number) => number): { ux: number; uz: number; sx: number; sz: number; len: number; yb: number; yt: number; w: number; m: number; run: number; rise: number } {
  const dx = f.top[0] - f.bottom[0], dz = f.top[1] - f.bottom[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const yb = heightAt(f.bottom[0], f.bottom[1]), yt = heightAt(f.top[0], f.top[1]) + 0.02;
  // risers ≤ 0.28 m and treads ≥ 0.36 m deep (the character's stair rule, below)
  const m = Math.max(1, Math.ceil((yt - yb) / 0.28));
  return { ux, uz, sx: uz, sz: -ux, len, yb, yt, w: f.width ?? 1.8, m, run: len / m, rise: (yt - yb) / m };
}

/** Layout identity with explicit defaults, independent of property insertion order. */
export function trailsideSpecKey(spec: TrailsideSpec): string {
  return JSON.stringify({
    fences: spec.fences.map(f => [f.path, f.spacing ?? 2.6]),
    steps: spec.steps.map(s => [s.from, s.to, s.width ?? 2.4]),
    signs: spec.signs.map(s => [s.x, s.z, s.arrows.map(a => [a.toward, a.label ?? ''])]),
    flights: (spec.flights ?? []).map(f => [f.top, f.bottom, f.width ?? 1.8]),
  });
}
