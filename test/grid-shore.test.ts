// oxlint-disable-next-line import/no-nodejs-modules -- Real collider proof uses the committed native Rapier binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { Scope } from '../src/engine/app/scope';
import { seamGeometry } from '../src/engine/sim/seamGeometry';
import { SHORE_REVETMENT_INNER_FACE } from '../src/engine/sim/shore';
import { generatePlatform, type GeneratedStrip, type PlatformCell, type StripProfile } from '../src/engine/sim/strips';

// G149 (the §3.2 shore rule): a Driftwood-like edge, seabed −2.6 m off a road-height 8 m midpoint entry, under a sea at 0.
const seabed = (count = 256): StripProfile => ({
  heights: Array.from({ length: count }, (_, i) => { const at = -250 + i * 500 / (count - 1), t = Math.max(0, Math.min(1, (Math.abs(at) - 10) / 12)); return -2.6 * t * t * (3 - 2 * t); }),
  colours: Array.from({ length: count }, () => [0.5, 0.5, 0.5]), roadHeight: 0,
});
const flat = (count = 256): StripProfile => ({ heights: Array.from({ length: count }, () => 0), colours: Array.from({ length: count }, () => [0.5, 0.5, 0.5]), roadHeight: 0 });
const sides = <T>(value: T): Record<'north' | 'east' | 'south' | 'west', T> => ({ north: value, east: value, south: value, west: value });
const shoreCell = (waterSurface: number | undefined, edges = seabed()): PlatformCell => ({ instance: 'shore', cell: [0, 0], origin: { x: 0, z: 0 }, edges: sides(edges),
  observations: sides({ entryWidth: 8, geometry: 'ground' as const, ...(waterSurface === undefined ? {} : { waterSurface }) }) });

const crossroads = (cell: PlatformCell): GeneratedStrip[] => generatePlatform([cell], flat()).filter((strip) => strip.id.startsWith('cross.'));
const lowest = (strips: readonly GeneratedStrip[]): number => Math.min(...strips.flatMap((strip) => Array.from(strip.mesh.positions.filter((_, k) => k % 3 === 1))));
const kinds = (strips: readonly GeneratedStrip[]): Set<string> => new Set(strips.flatMap((strip) => strip.features.map((feature) => feature.kind)));

it('keeps a shore corner (seabed under a sea at exactly 0, StripCorner.shore) at road level with no drop face or road wall', () => {
  const shore = crossroads(shoreCell(0));
  expect(lowest(shore)).toBe(0);
  for (const kind of ['parapet', 'road-wall', 'guard-rail']) expect(kinds(shore).has(kind)).toBe(false);
  // the same seabed with no sea, or the old +0.8 sea (the dike), keeps G90's descent, drop face and road wall
  for (const water of [undefined, 0.8]) {
    const other = crossroads(shoreCell(water));
    expect(lowest(other)).toBeLessThan(-2.5);
    for (const kind of ['parapet', 'road-wall', 'guard-rail']) expect(kinds(other).has(kind)).toBe(true);
  }
  // deterministic (two runs, identical bytes)
  expect(crossroads(shoreCell(0))).toEqual(shore);
});

const strip = (axis: 'x' | 'z', water: number | undefined, height?: number): ReturnType<typeof seamGeometry> => {
  const low = height === undefined ? seabed() : { ...seabed(), heights: seabed().heights.map((h) => h * height / -2.6) }; // `height`: the seabed's shape raised to dry ground
  return seamGeometry({ id: 'shore.edge', axis, origin: { x: 0, z: 0 }, edges: [{ profile: low, entryWidth: 8, geometry: 'ground', ...(water === undefined ? {} : { waterSurface: water }) }, { profile: flat(), entryWidth: 8 }] });
};
const triangles = (result: ReturnType<typeof seamGeometry>, kind: string): (readonly [number, number, number])[][] => result.features.filter((f) => f.kind === kind).flatMap((f) =>
  Array.from({ length: f.indexCount / 3 }, (_, t) => [0, 1, 2].map((c) => { const n = result.mesh.indices[f.firstIndex + t * 3 + c] ?? 0; return [result.mesh.positions[n * 3] ?? 0, result.mesh.positions[n * 3 + 1] ?? 0, result.mesh.positions[n * 3 + 2] ?? 0] as const; })));

it('holds a shore strip at 0 to the cell edge and builds the rip-rap revetment there, never across the entry (G149)', () => {
  for (const axis of ['x', 'z'] as const) {
    const result = strip(axis, 0), across = axis === 'x' ? 0 : 2, alongAxis = axis === 'x' ? 2 : 0;
    expect(result).toEqual(strip(axis, 0));
    // the floor never descends (B = max(0, clamp(H, −1.5, 6)))
    for (const kind of ['neutral-buffer', 'gradient']) for (const tri of triangles(result, kind)) for (const p of tri) expect(p[1]).toBeGreaterThanOrEqual(0);
    // no cyan drop wall crosses a shoreline
    expect(result.features.some((f) => f.kind === 'road-wall' || f.kind === 'guard-rail')).toBe(false);
    const rock = triangles(result, 'revetment'), runs = result.features.filter((f) => f.kind === 'revetment');
    expect(runs.length).toBe(2); expect(runs.every((f) => f.side === -1 && f.top <= 0.68 && f.top >= 0.56 && f.bottom <= -2.6 - 0.4 + 1e-6)).toBe(true);
    expect(rock.length).toBeLessThan(800); // ~4 m stations: a 500 m Driftwood edge costs a few hundred triangles
    // never across the 8 m entry (nor its 15 m socket, which lies inside the same 8 m)
    for (const tri of rock) for (const p of tri) expect(Math.abs(p[alongAxis])).toBeGreaterThanOrEqual(4);
    // the runs reach past the cell corners so the two edges' crests meet
    expect(Math.min(...runs.map((f) => f.from))).toBeLessThan(-250); expect(Math.max(...runs.map((f) => f.to))).toBeGreaterThan(250);
    const crest = rock.flat().filter((p) => p[1] > 0.5);
    for (const p of crest) expect(p[1]).toBeGreaterThanOrEqual(0.56);
    // the crest covers the inner face: the sea, clipped at SHORE_REVETMENT_INNER_FACE, ends under it
    expect(Math.min(...crest.filter((p) => Math.abs(p[across]) > 27.5).map((p) => Math.abs(p[across])))).toBeGreaterThanOrEqual(27.5 + SHORE_REVETMENT_INNER_FACE);
    expect(Math.max(...crest.filter((p) => Math.abs(p[across]) < 27.5).map((p) => Math.abs(p[across])))).toBeLessThanOrEqual(27.5 - SHORE_REVETMENT_INNER_FACE);
    // every slope and crest triangle faces up (outward), on either axis
    for (const tri of rock) {
      const [a, b, c] = tri; if (a === undefined || b === undefined || c === undefined) throw new Error('Missing triangle');
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      expect((e1[2] ?? 0) * (e2[0] ?? 0) - (e1[0] ?? 0) * (e2[2] ?? 0)).toBeGreaterThanOrEqual(-1e-6);
    }
  }
  // no sea, the old +0.8 sea (the dike) or dry ground: no revetment
  for (const [water, height] of [[undefined, undefined], [0.8, undefined], [0, 0.5]] as const) expect(strip('x', water, height).features.some((f) => f.kind === 'revetment')).toBe(false);
});

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
for (const axis of ['x', 'z'] as const) it(`walks a real capsule from the road up onto the revetment's crest and stops at nothing else on axis ${axis}`, () => {
  const physics = new Physics(rapier), scope = new Scope('shore.seam');
  installStripCollider(physics, strip(axis, 0).mesh, scope);
  const motor = new CharacterMotor(physics, { radius: 0.35, height: 1.8, step: 0.3, snap: 0.2, maxClimbDeg: 45, group: 'PLAYER', blockedBy: ['WORLD'] });
  try {
    const feet = { x: axis === 'x' ? -8 : 100, y: 0.005, z: axis === 'z' ? -8 : 100 };
    let crest = -Infinity, floor = Infinity;
    for (let tick = 0; tick < 240 && feet[axis] > -27.5; tick++) {
      physics.step(); motor.move(feet, { x: axis === 'x' ? -0.1 : 0, y: -9.81 / 3600, z: axis === 'z' ? -0.1 : 0 });
      floor = Math.min(floor, feet.y); if (feet[axis] < -26.9) crest = Math.max(crest, feet.y);
    }
    expect(feet[axis]).toBeLessThanOrEqual(-27.4); // the floor and the landward slope never snag (no road wall on a shore)
    expect(floor).toBeGreaterThan(-0.06); expect(crest).toBeGreaterThan(0.45);
  } finally { motor.dispose(); scope.dispose(); expect(physics.world.colliders.len()).toBe(0); physics.dispose(); }
});
