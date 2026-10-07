import { expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { RAIL_OFFSET, ROAD_HALF, rightSide, roadLayout, segmentPoint } from '../src/game/grid/roadLayout';
import { GAME_STRINGS } from '../src/game/strings';

const grid = new GridAssembly({ developer: false, devserver: false });
const layout = roadLayout(grid, (slug) => slug.toUpperCase());

it('lays the boulevard on the generator gaps: 24 segments, 16 junctions, roundabouts only where four arms meet (G80, G81)', () => {
  expect(layout.segments).toHaveLength(24);
  expect(layout.junctions).toHaveLength(16);
  expect(layout.junctions.filter((j) => j.roundabout).map((j) => j.id).sort()).toEqual(['cross.-1.-1', 'cross.-1.0', 'cross.0.-1', 'cross.0.0']);
  const corner = layout.junctions.find((j) => j.id === 'cross.-2.-2');
  expect(corner?.arms).toEqual({ east: true, west: false, north: true, south: false });
  // segment ids and centres match the generator's (gap.x runs along z between columns)
  const between = layout.segments.find((s) => s.id === 'gap.x.-1.0');
  expect(between?.centre).toEqual({ x: -277.5, z: 0 });
  expect(between?.low?.instance).toBe('template-3'); expect(between?.high?.instance).toBe('driftwood-isle');
});

it('puts the rail on the outer road shoulder, where the rim walls stand (G89)', () => {
  expect(layout.rail).toEqual({ minX: -832.5 - RAIL_OFFSET, maxX: 832.5 + RAIL_OFFSET, minZ: -832.5 - RAIL_OFFSET, maxZ: 832.5 + RAIL_OFFSET });
  expect(RAIL_OFFSET).toBeGreaterThan(ROAD_HALF);
  // no streetlight stands on the void side of the outer road
  for (const light of layout.lights) {
    expect(light.at.x).toBeGreaterThan(-832.5 - ROAD_HALF); expect(light.at.x).toBeLessThan(832.5 + ROAD_HALF);
    expect(light.at.z).toBeGreaterThan(-832.5 - ROAD_HALF); expect(light.at.z).toBeLessThan(832.5 + ROAD_HALF);
  }
});

it('names the shards ahead on green signs from the catalogue, on the traveller\'s right (G80, G81, G93)', () => {
  const segment = layout.segments.find((s) => s.id === 'gap.x.-1.0');
  if (segment === undefined) throw new Error('missing segment');
  // heading north (+z) between template-3 (west, −x) and Driftwood (east, +x): in three's mirrored frame your right hand is
  // west, so the sign stands on the west shoulder and Driftwood's turn-in is on the left
  expect(rightSide(segment, 1)).toBe(-1);
  const north = layout.signs.find((s) => s.facing.z === -1 && Math.abs(s.at.x - segmentPoint(segment, 0, -9.7).x) < 0.01 && s.at.z < -190 && s.at.z > -210);
  expect(north?.lines).toEqual([{ arrow: 'right', names: ['_TEMPLATE'], metres: 200 }, { arrow: 'left', names: ['DRIFTWOOD-ISLE'], metres: 200 }]);
  // heading east (+x) your right hand is +z (south of the road is −z)
  const east = layout.segments.find((s) => s.id === 'gap.z.0.0');
  if (east === undefined) throw new Error('missing segment');
  expect(rightSide(east, 1)).toBe(1);
  // a roundabout approach lists left, ahead and right
  const approach = layout.signs.filter((s) => s.lines.some((l) => l.arrow === 'ahead'));
  expect(approach.length).toBe(4 * 4 + 8 * 2); // a T has no ahead from its stem
  for (const sign of approach) expect(sign.lines.map((l) => l.arrow)).toEqual(sign.lines.map((l) => l.arrow).sort((a, b) => ['left', 'ahead', 'right'].indexOf(a) - ['left', 'ahead', 'right'].indexOf(b)));
  // nothing is hard-coded: every name on a sign is a catalogue slug through the given namer, or the open plots' name (G198)
  const slugs = new Set([...grid.cells.map((c) => c.slug.toUpperCase()), GAME_STRINGS.grid.plot.turnIn]);
  for (const sign of layout.signs) for (const line of sign.lines) for (const name of line.names) expect(slugs.has(name)).toBe(true);
});

it('puts a green shard-name sign at every turn-in, on its far corner, an arrow into the shard and no distance (G100)', () => {
  const turnIns = layout.signs.filter((s) => s.lines.length === 1 && s.lines[0]?.metres === null);
  const sides = layout.segments.reduce((n, s) => n + (s.low === undefined ? 0 : 1) + (s.high === undefined ? 0 : 1), 0);
  expect(turnIns).toHaveLength(sides);
  const between = layout.segments.find((s) => s.id === 'gap.x.-1.0');
  const driftwood = turnIns.find((s) => s.lines[0]?.names[0] === 'DRIFTWOOD-ISLE' && Math.abs(s.at.x - (between?.centre.x ?? 0)) < 15 && Math.abs(s.at.z) < 15);
  expect(driftwood?.lines[0]?.arrow).toBe('right');
  // on Driftwood's side of the road (+x), just past the 12 m opening, facing the traffic whose right hand the entry is on
  expect(driftwood?.at.x).toBeGreaterThan(-277.5 + ROAD_HALF);
  expect(Math.abs(driftwood?.at.z ?? 0)).toBeGreaterThan(6);
});
