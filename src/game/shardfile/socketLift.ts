import * as v from 'valibot';
import { ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { isJsonData } from './json';
import { parseMovers, type MoverData } from './movers';
import { glbPoint, glbTransform } from './glbTriangles';
import { clipEntryPolygon, type EntryVertex } from './entryGeometry';

const name = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const coordinate = v.pipe(v.number(), v.finite(), v.minValue(-250), v.maxValue(250));
const point = v.tuple([coordinate, coordinate, coordinate]);
/** A bounded entry ride names admitted mover/gate rows and feet-level stops; the route is walked, never teleported. */
export const SocketLiftSchema = v.pipe(v.strictObject({ mover: name, gate: name,
  roadStop: point, topStop: point, route: v.pipe(v.array(point), v.minLength(2), v.maxLength(32)),
  rideTicks: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(3600)),
}), v.check(row => row.mover !== row.gate && row.roadStop[1] === 0 && row.topStop[1] > 0
  && row.route[0]?.every((value, axis) => value === row.topStop[axis]) === true,
'socket lift requires distinct mover/gate, road height zero and an onward route starting at its top stop'));
/** Data-only lift link; gameplay commands and physics remain platform-owned. */
export type SocketLift = v.InferOutput<typeof SocketLiftSchema>;
/** Parse without invoking an accessor or serializer from an author object. */
export function parseSocketLift(input: unknown): SocketLift {
  if (!isJsonData(input)) throw new Error('Socket lift must be JSON data only');
  return v.parse(SocketLiftSchema, input);
}
/** An edge's declared lift; shared structural shape avoids a schema dependency cycle. */
export interface SocketLiftEntry { edge: 'north' | 'east' | 'south' | 'west'; lift: SocketLift }
/** Select declared lifts without treating an ordinary entry or a missing link as executable admission. */
export function socketLiftEntries(entries: readonly { edge: SocketLiftEntry['edge']; kind?: string | undefined; lift?: SocketLift }[]): SocketLiftEntry[] {
  return entries.flatMap(entry => {
    if (entry.kind !== 'socketLift') return [];
    if (entry.lift === undefined) throw new Error('Missing socket lift declaration');
    return [{ edge: entry.edge, lift: entry.lift }];
  });
}

function boxVertices(row: MoverData[number], stop: readonly [number, number, number]): EntryVertex[][] {
  if (row.euler.x !== 0 || row.euler.y !== 0 || row.euler.z !== 0) throw new Error('Socket lift rests without rotation');
  return row.boxes.map(box => {
    const matrix = glbTransform({ translation: [stop[0] + box.x, stop[1] + box.y, stop[2] + box.z], rotation: [box.rot.x, box.rot.y, box.rot.z, box.rot.w] });
    return Array.from({ length: 8 }, (_unused, index) => glbPoint(matrix, {
      x: (index & 1) === 0 ? -box.hx : box.hx, y: (index & 2) === 0 ? -box.hy : box.hy, z: (index & 4) === 0 ? -box.hz : box.hz,
    }));
  });
}
function topTriangles(boxes: readonly EntryVertex[][]): EntryVertex[][] {
  return boxes.flatMap(box => {
    const a = box[2], b = box[3], c = box[6], d = box[7];
    if (a === undefined || b === undefined || c === undefined || d === undefined) throw new Error('Missing lift box vertex');
    return [[a, b, c], [d, c, b]];
  });
}
function coversLine(triangles: readonly EntryVertex[][], edge: SocketLiftEntry['edge'], along: number, y: number): boolean {
  const cross = edge === 'north' || edge === 'south' ? 'x' : 'z', half = ENTRY_WIDTH / 2;
  const line = cross === 'x' ? { minX: -half, maxX: half, minZ: along, maxZ: along } : { minX: along, maxX: along, minZ: -half, maxZ: half };
  const intervals = triangles.flatMap(triangle => {
    const clipped = clipEntryPolygon(triangle, line);
    if (clipped.length === 0 || clipped.some(vertex => Math.abs(vertex.y - y) > 1e-8)) return [];
    return [[Math.min(...clipped.map(vertex => vertex[cross])), Math.max(...clipped.map(vertex => vertex[cross]))]];
  }).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
  let covered = -half;
  for (const interval of intervals) {
    const from = interval[0], to = interval[1]; if (from === undefined || to === undefined || from > covered + 1e-8) return false;
    covered = Math.max(covered, to);
  }
  return covered >= half;
}
/** Before physics allocation, prove stable references and the real deck's complete road-height boarding line. */
export function socketLiftRules(entries: readonly SocketLiftEntry[], input: MoverData): string[] {
  const errors: string[] = [];
  let movers: MoverData;
  try { movers = parseMovers(input); } catch { return ['invalid socket lift mover declarations']; }
  const ids = new Set<string>();
  for (const entry of entries) {
    try {
      const lift = parseSocketLift(entry.lift), mover = movers.find(row => row.id === lift.mover), gate = movers.find(row => row.id === lift.gate);
      if (ids.has(lift.mover) || ids.has(lift.gate)) throw new Error('Socket lift mover/gate belongs to one entry');
      ids.add(lift.mover); ids.add(lift.gate);
      if (mover?.kind !== 'platform' || !mover.enabled) throw new Error('Unknown or inactive socket lift mover');
      if (gate === undefined || gate.kind === 'chain') throw new Error('Missing socket lift platform gate');
      if (![mover.at.x, mover.at.y, mover.at.z].every((value, axis) => value === lift.roadStop[axis])) throw new Error('Socket lift must load at its road stop');
      const boxes = boxVertices(mover, lift.roadStop), top = boxVertices(mover, lift.topStop);
      if ([...boxes, ...top].flat().some(vertex => Math.abs(vertex.x) > 240 || Math.abs(vertex.z) > 240 || Math.abs(vertex.y) > 250)) throw new Error('Socket lift footprint must remain at least ten metres inside the cell');
      const along = entry.edge === 'north' || entry.edge === 'east' ? 235 : -235;
      // A maximum five-centimetre seam is admitted; the executable capsule proof still has to walk it.
      const boardLine = along + (along > 0 ? -0.05 : 0.05);
      if (!coversLine(topTriangles(boxes), entry.edge, boardLine, 0)) throw new Error('Socket lift road stop must cover the eight metre socket boarding line at height zero');
      if (lift.route.every(position => position.every((value, axis) => value === lift.topStop[axis]))) throw new Error('Socket lift needs an onward route to playable ground');
    } catch (error) { errors.push(error instanceof Error ? error.message : 'Invalid socket lift'); }
  }
  return errors;
}
