import type { EntryVertex } from './entryGeometry';

const cross = (a: EntryVertex, b: EntryVertex, p: EntryVertex): number => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
function area(vertices: readonly EntryVertex[]): number {
  let value = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    if (a !== undefined && b !== undefined) value += a.x * b.z - b.x * a.z;
  }
  return value / 2;
}
function clip(vertices: readonly EntryVertex[], a: EntryVertex, b: EntryVertex, inside: boolean): EntryVertex[] {
  const result: EntryVertex[] = [], direction = inside ? 1 : -1;
  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i], q = vertices[(i + 1) % vertices.length]; if (p === undefined || q === undefined) continue;
    const dp = cross(a, b, p) * direction, dq = cross(a, b, q) * direction;
    if (dp >= 0) result.push(p);
    if ((dp < 0) !== (dq < 0)) { const t = dp / (dp - dq); result.push({ x: p.x + (q.x - p.x) * t, y: 0, z: p.z + (q.z - p.z) * t }); }
  }
  return result;
}
/** Canonical counter-clockwise hull in the footprint plane; vertical and line intersections have no area. */
export function convexEntryHull(vertices: readonly EntryVertex[]): EntryVertex[] {
  const sorted = [...vertices].sort((a, b) => a.x - b.x || a.z - b.z), lower: EntryVertex[] = [], upper: EntryVertex[] = [];
  const add = (part: EntryVertex[], point: EntryVertex): void => {
    while (part.length >= 2) {
      const a = part[part.length - 2], b = part[part.length - 1];
      if (a === undefined || b === undefined || cross(a, b, point) > 0) break;
      part.pop();
    }
    part.push(point);
  };
  for (const point of sorted) add(lower, point);
  for (const point of [...sorted].reverse()) add(upper, point);
  lower.pop(); upper.pop(); return [...lower, ...upper];
}
/** Exact convex-polygon subtraction proves area coverage rather than sparse height/raycast samples. */
export function entryCoverage(surfaces: readonly EntryVertex[][]): (polygon: EntryVertex[], message: string) => void {
  let operations = 0;
  return (polygon, message) => {
    let remaining = [polygon];
    for (const surface of surfaces) {
      if (surface.length < 3 || Math.abs(area(surface)) <= 1e-12) continue;
      const next: EntryVertex[][] = [];
      for (const piece of remaining) {
        if (++operations > 100_000) throw new Error('Entry geometry work bound');
        let inside = piece;
        for (let i = 0; i < surface.length; i++) {
          const a = surface[i], b = surface[(i + 1) % surface.length]; if (a === undefined || b === undefined) continue;
          const outside = clip(inside, a, b, false);
          if (Math.abs(area(outside)) > 1e-12) next.push(outside);
          inside = clip(inside, a, b, true); if (inside.length < 3) break;
        }
      }
      remaining = next;
      if (remaining.length === 0) return;
      if (remaining.length > 4096) throw new Error('Entry geometry fragment bound');
    }
    if (remaining.some(piece => Math.abs(area(piece)) > 1e-12)) throw new Error(message);
  };
}
