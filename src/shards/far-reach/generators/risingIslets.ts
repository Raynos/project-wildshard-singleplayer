import { Entry, type EntryData } from '@wildshard/sdk/entries';
import { APOTHEM, GROVE, ROOST, RUIN, SUNREST, type Isle, type Span } from '../data/layout';
import { ISLET, SOCKET_DEPTH, type EntryEdge, type P3, type LandingBox, type GateBox, type IsleStrip, type RisingIslet } from '../data/isletDesign';

const CHUNK_HALF = new Entry('north').position.z;
const ENTRY_ASPHALT = SOCKET_DEPTH;
/** The source island's twelve-sided top keeps its original apothem arithmetic. */
const apothem = (isle: Isle): number => isle.r * APOTHEM;
function rimAlong(isle: Isle, angle: number): number {
  const step = Math.PI / 6, t = ((angle % step) + step) % step;
  return apothem(isle) / Math.cos(t - step / 2);
}

const OUTWARD: Readonly<Record<EntryEdge, readonly [number, number]>> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };
/** The entry's frame: `t` along the edge (to the right looking inward), `u` inward from the cell edge. */
function entryFrame(edge: EntryEdge): (t: number, u: number, y: number) => P3 {
  const [ox, oz] = OUTWARD[edge], tx = -oz, tz = ox;
  return (t, u, y) => ({ x: ox * (CHUNK_HALF - u) + tx * t, y, z: oz * (CHUNK_HALF - u) + tz * t });
}
/** The rope span between two islands' rims, overlapping each by a metre (layout's `along` for rope bridges). */
function rope(id: string, a: Isle, b: Isle, width: number): Span {
  const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
  const ra = rimAlong(a, Math.atan2(uz, ux)) - 1, rb = rimAlong(b, Math.atan2(-uz, -ux)) - 1;
  return { id, kind: 'rope', x0: a.x + ux * ra, z0: a.z + uz * ra, x1: b.x - ux * rb, z1: b.z - uz * rb, y: a.y, y1: b.y, width };
}

/** One entry: `gateT` shifts the gate isle along the edge (the south one clears the storm crown overhead). */
function islet(edge: EntryEdge, isle: Isle, gateT: number): Omit<RisingIslet, 'at'> {
  const at = entryFrame(edge), I = ISLET, U0 = ENTRY_ASPHALT, lipU = U0 + I.lip.depth / 2;
  const isletR = apothem({ id: 'islet', x: 0, z: 0, r: I.islet.r, y: 0, keel: I.islet.keel });
  const g = at(gateT, I.gate.u, I.gate.y), gate: Isle = { id: `gate.${edge}`, x: g.x, z: g.z, r: I.gate.r, y: I.gate.y, keel: I.gate.keel };
  const r = at(0, U0 + I.lip.depth + I.gap + isletR, 0), rest: P3 = r;
  // docked: against the gate isle's rim on the line from the resting islet, deck level with the gate isle's
  const dx = gate.x - rest.x, dz = gate.z - rest.z, d = Math.hypot(dx, dz), reach = d - apothem(gate) - isletR - I.gap;
  const dock: P3 = { x: rest.x + (dx / d) * reach, y: gate.y, z: rest.z + (dz / d) * reach };
  const length = Math.hypot(dock.x - rest.x, dock.y - rest.y, dock.z - rest.z), travel = Math.round((length / I.speed) * 10) / 10;
  const c = at(0, lipU, 0), alongX = OUTWARD[edge][0] === 0;
  const landing: LandingBox = { kind: 'box', x: c.x, y: -I.lip.thick / 2, z: c.z, hx: alongX ? I.lip.width / 2 : I.lip.depth / 2, hy: I.lip.thick / 2, hz: alongX ? I.lip.depth / 2 : I.lip.width / 2, surface: 'stone' };
  const bridge = rope(`far.rope.gate.${edge}`, gate, isle, I.bridge);
  const inward = (p: P3, k: number): P3 => ({ x: p.x + (dx / d) * k, y: p.y, z: p.z + (dz / d) * k });
  const bx = bridge.x1 - bridge.x0, bz = bridge.z1 - bridge.z0, bl = Math.hypot(bx, bz);
  const board: P3[] = [at(0, U0 + 0.5, 0), at(0, U0 + I.lip.depth + 1, 0), { ...rest }];
  // the gate bar stands on the lip, its road face on the socket's inner line; the static approach crosses the lip
  const gc = at(0, U0 + I.gateBar.depth / 2, I.gateBar.height / 2);
  const gateBar: GateBox = { x: gc.x, y: gc.y, z: gc.z, hx: alongX ? I.gateBar.width / 2 : I.gateBar.depth / 2, hy: I.gateBar.height / 2, hz: alongX ? I.gateBar.depth / 2 : I.gateBar.width / 2 };
  const lift = { route: [{ ...dock }, inward(dock, isletR + 2), { x: gate.x, y: gate.y, z: gate.z }], approach: [at(0, U0, 0), at(0, U0 + I.approachU, 0)],
    rideTicks: Math.ceil(travel * 60) + I.rideSlack };
  const climb: P3[] = [{ ...dock }, inward(dock, isletR + 2), { x: gate.x, y: gate.y, z: gate.z }, { x: bridge.x0 - (bx / bl) * 2, y: gate.y, z: bridge.z0 - (bz / bl) * 2 },
    { x: bridge.x0, y: bridge.y, z: bridge.z0 }, { x: bridge.x1, y: bridge.y1, z: bridge.z1 }, { x: bridge.x1 + (bx / bl) * 4, y: isle.y, z: bridge.z1 + (bz / bl) * 4 }];
  return { edge, isle, landing, rest, dock, travel, gate, bridge, board, climb, gateBar, lift };
}


/** A gate isle's six walk strips 30° apart (world/build.ts islandColliders, in the shardfile's yaw form). */
function isleStrips(isle: Isle): IsleStrip[] {
  const half = apothem(isle), width = isle.r * 0.26;
  return [0, 1, 2, 3, 4, 5].map((i) => ({ kind: 'box', x: isle.x, y: isle.y - 1, z: isle.z, hx: half, hy: 1, hz: width, yaw: 0 - (i * Math.PI) / 6, surface: 'grass' }));
}

/** The mover id of an entry's islet. */
export const isletId = (entry: Omit<RisingIslet, 'at'>): string => `far.islet.${entry.edge}`;
/** The mover id of an entry's stationary road gate (SF8c socketLift). */
export const gateId = (entry: Omit<RisingIslet, 'at'>): string => `far.islet.${entry.edge}.gate`;
/** SF8c: an entry's declared socketLift link (shard.config.ts's entryway; the platform proves and commands it). */
function isletLift(entry: Omit<RisingIslet, 'at'>): { mover: string; gate: string; roadStop: [number, number, number]; topStop: [number, number, number]; route: [number, number, number][]; rideTicks: number; approach: { colliders: string[]; route: [number, number, number][] } } {
  const v = (p: P3): [number, number, number] => [p.x + 0, p.y + 0, p.z + 0]; // JSON data: never −0
  return { mover: isletId(entry), gate: gateId(entry), roadStop: v(entry.rest), topStop: v(entry.dock), route: entry.lift.route.map(v), rideTicks: entry.lift.rideTicks,
    approach: { colliders: [`landing.${entry.edge}`], route: entry.lift.approach.map(v) } };
}


/** Persisted native layout and admitted SDK entry links; callbacks stay outside JSON. */
export interface RisingIsletRows {
  notice: string;
  entries: (Omit<RisingIslet, 'at'> & { strips: IsleStrip[] })[];
  lifts: { edge: EntryEdge; lift: NonNullable<EntryData['lift']> }[];
}

/** Build the four real entry/lift author objects and their native landing and gate-floor rows.
 * The cached JSON contains no drawing code, callbacks, runtime imports or rounding of geometry. */
export function risingIsletRows(): RisingIsletRows {
  const entries = [islet('north', SUNREST, 0), islet('east', ROOST, 58), islet('south', RUIN, 40), islet('west', GROVE, 0)];
  const lifts = entries.map(entry => {
    const author = new Entry(entry.edge, 'socketLift', { lift: isletLift(entry) }), row = author.toEntryData();
    if (row.lift === undefined) throw new Error('Rising Islet author lost its lift');
    return { edge: row.edge, lift: row.lift };
  });
  return { notice: 'DO NOT EDIT: generated by generators/risingIslets.ts through the verified build cache.',
    entries: entries.map(entry => { const row = {}; return Object.assign(row, entry, { strips: isleStrips(entry.gate) }); }), lifts };
}

/** Author callbacks never enter runtime; the page imports the generated literal row module. */
export const RISING_ISLETS: readonly RisingIslet[] = risingIsletRows().entries.map(row => {
  const { strips: _strips, ...entry } = row;
  return Object.assign(entry, { at: entryFrame(entry.edge) });
});
/** Literal typed rows retain discriminants without rebuilding entry frames at page load. */
export function risingIsletSource(): Uint8Array {
  const rows = risingIsletRows(), entries = rows.entries.map(row => { const { strips: _strips, ...entry } = row; return entry; });
  const links = rows.lifts.map(row => new Entry(row.edge, 'socketLift', { lift: row.lift }).toEntryData());
  return new TextEncoder().encode(`// Generated authored entry rows.\nexport const RISING_ISLETS: readonly Omit<import('./isletDesign').RisingIslet, 'at'>[] = ${JSON.stringify(entries)} as const;\nexport const ENTRYWAYS: readonly import('@wildshard/format/entryways').ShardEntryways[number][] = ${JSON.stringify(links)} as const;\n`);
}
