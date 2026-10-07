import type { ShardProps } from './props';
import type { SocketLiftEntry } from './socketLift';
import type { EntryVertex } from './entryGeometry';
import { glbPoint, glbTransform } from './glbTriangles';

/** Only admitted, permanently active collision rows may prove the static road-to-lift approach. */
export interface LiftApproachSource {
  props: ShardProps | null;
  targets: { panels: readonly { colliders: readonly string[] }[] };
}
type Point = readonly [number, number, number];
type Box = Extract<ShardProps['colliders'][number]['shapes'][number], { kind: 'box' }>;
const radius = 0.35, epsilon = 1e-9;
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
function hull(vertices: readonly EntryVertex[]): EntryVertex[] {
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
function boxTop(box: Box): EntryVertex[][] {
  const q = box.rot ?? { x: 0, y: Math.sin((box.yaw ?? 0) / 2), z: 0, w: Math.cos((box.yaw ?? 0) / 2) };
  const matrix = glbTransform({ translation: [box.x, box.y, box.z], rotation: [q.x, q.y, q.z, q.w] });
  const at = (x: number, z: number) => glbPoint(matrix, { x, y: box.hy, z });
  const a = at(-box.hx, -box.hz), b = at(box.hx, -box.hz), c = at(-box.hx, box.hz), d = at(box.hx, box.hz);
  return [[a, b, c], [d, c, b]];
}
function staticTops(rows: readonly ShardProps['colliders'][number][]): EntryVertex[][] {
  return rows.flatMap(row => row.shapes.flatMap(shape => {
    if (shape.kind === 'box') return boxTop(shape);
    const dx = shape.to.x - shape.from.x, dz = shape.to.z - shape.from.z, run = Math.hypot(dx, dz) / shape.count, rise = (shape.to.y - shape.from.y) / shape.count;
    return Array.from({ length: shape.count }, (_unused, i) => {
      const f = (i + 0.5) / shape.count, hy = Math.max(0.01, rise * (i + 1) / 2);
      return boxTop({ kind: 'box', x: shape.from.x + dx * f, y: shape.from.y + hy, z: shape.from.z + dz * f, hx: shape.width / 2, hy, hz: run / 2, yaw: Math.atan2(dx, dz) });
    }).flat();
  })).filter(triangle => triangle.every(vertex => Math.abs(vertex.y) <= epsilon)).map(hull);
}
function ribbon(a: Point, b: Point, half: number): EntryVertex[] {
  const dx = b[0] - a[0], dz = b[2] - a[2], distance = Math.hypot(dx, dz);
  if (distance <= epsilon) return hull([-1, 1].flatMap(x => [-1, 1].map(z => ({ x: a[0] + x * half, y: 0, z: a[2] + z * half }))));
  const x = -dz / distance * half, z = dx / distance * half;
  return hull([{ x: a[0] + x, y: 0, z: a[2] + z }, { x: a[0] - x, y: 0, z: a[2] - z },
    { x: b[0] + x, y: 0, z: b[2] + z }, { x: b[0] - x, y: 0, z: b[2] - z }]);
}
/** Exact convex-polygon subtraction proves area coverage rather than sparse height/raycast samples. */
function coverage(surfaces: readonly EntryVertex[][]): (polygon: EntryVertex[], message: string) => void {
  let operations = 0;
  return (polygon, message) => {
    let remaining = [polygon];
    for (const surface of surfaces) {
      const next: EntryVertex[][] = [];
      for (const piece of remaining) {
        if (++operations > 100_000) throw new Error('Static approach geometry work bound');
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
      if (remaining.length > 4096) throw new Error('Static approach geometry fragment bound');
    }
    if (remaining.some(piece => Math.abs(area(piece)) > 1e-12)) throw new Error(message);
  };
}
/** Prove a full-width static mouth, continuous capsule corridor and the actual deck seam before allocating physics. */
export function validateLiftApproach(entry: SocketLiftEntry, deck: readonly EntryVertex[][], source: LiftApproachSource): void {
  const approach = entry.lift.approach; if (approach === undefined) return;
  const rows = approach.colliders.map(id => {
    if (id === entry.lift.mover || id === entry.lift.gate) throw new Error('Static approach collider cannot alias its moving deck or road gate');
    const row = source.props?.colliders.find(candidate => candidate.id === id);
    if (row === undefined || !row.initialActive || row.panel !== null || source.targets.panels.some(target => target.colliders.includes(id))) throw new Error('Static approach requires permanent active declared colliders');
    return row;
  });
  const first = approach.route[0], last = approach.route[approach.route.length - 1];
  if (first === undefined || last === undefined) throw new Error('Missing static approach route');
  const mouth: Point = [entry.edge === 'east' ? 235 : entry.edge === 'west' ? -235 : 0, 0, entry.edge === 'north' ? 235 : entry.edge === 'south' ? -235 : 0];
  if (!first.every((value, axis) => value === mouth[axis])) throw new Error('Static approach must start at the socket inner midpoint');
  let length = Math.hypot(last[0] - entry.lift.roadStop[0], last[2] - entry.lift.roadStop[2]);
  for (let i = 1; i < approach.route.length; i++) {
    const a = approach.route[i - 1], b = approach.route[i]; if (a !== undefined && b !== undefined) length += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  if (length > 32) throw new Error('Static approach route exceeds thirty-two metres');
  const surfaces = staticTops(rows), cover = coverage(surfaces);
  // The mouth strip extends inward only; the platform socket cannot prove any part of this landing.
  const inward: Point = [mouth[0] + (entry.edge === 'east' ? -radius : entry.edge === 'west' ? radius : 0), 0,
    mouth[2] + (entry.edge === 'north' ? -radius : entry.edge === 'south' ? radius : 0)];
  cover(ribbon(mouth, inward, 4), 'Static approach must cover the eight metre road-height mouth');
  for (let i = 0; i < approach.route.length; i++) {
    const point = approach.route[i]; if (point === undefined) continue;
    // At the mouth the socket supplies the outside half of the capsule; all subsequent joins are static ground.
    if (i > 0) cover(ribbon(point, point, radius), 'Static approach corridor lacks declared road-height ground');
    const next = approach.route[i + 1]; if (next !== undefined) cover(ribbon(point, next, radius), 'Static approach corridor lacks declared road-height ground');
  }
  const flatDeck = deck.filter(triangle => triangle.every(vertex => Math.abs(vertex.y) <= epsilon)).map(hull);
  coverage(flatDeck)(ribbon(entry.lift.roadStop, entry.lift.roadStop, radius), 'Socket lift deck must support the real capsule at its road stop');
  const dx = last[0] - entry.lift.roadStop[0], dz = last[2] - entry.lift.roadStop[2], distance = Math.hypot(dx, dz);
  // Only the boarding seam may have a gap: extrude the real deck by at most five centimetres toward the static endpoint.
  const seam = flatDeck.map(surface => hull([...surface, ...surface.map(vertex => ({ ...vertex,
    x: vertex.x + (distance <= epsilon ? 0 : dx / distance * 0.05), z: vertex.z + (distance <= epsilon ? 0 : dz / distance * 0.05) }))]));
  coverage([...surfaces, ...seam])(ribbon(last, entry.lift.roadStop, radius), 'Static approach boarding seam exceeds five centimetres');
}
