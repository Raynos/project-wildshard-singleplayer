import { expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { entrywayRules } from '../../../src/game/shardfile/entryways';
import { contentHash, validateProject } from '../../../src/sdk/project';
import { validateShardfileAssets } from '../../../src/game/shardfile/validate';
import { validateSocketLandings } from '../../../src/game/shardfile/entryLanding';
import { dryEntryContains } from '../../../src/engine/world/water/declared';
import manifest, { BOAT_MOOR, BRIDGE, JETTIES, OCEAN, PIER_PENNANT_AT, WRECK } from '../../../src/shards/driftwood-isle/manifest';
import { pierColliders, pierDeckAt, pierPosts, type PierParams } from '../../../src/shards/driftwood-isle/models/pier';
import { ropeBridgeSegments } from '../../../src/shards/driftwood-isle/models/ropeBridge';
import { G164_LOWERED } from '../../../src/shards/driftwood-isle/world/build';
import { boatColliders } from '../../../src/shards/driftwood-isle/models/boat';
import { MOVERS } from '../../../src/shards/driftwood-isle/data/movers';
import { WATER_UNBOUNDED, seaDamp, waterExtent } from '../../../src/engine/world/waves';
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '../../../src/engine/core/config';
import { DRIFTWOOD_SEA, DRY_ENTRIES, ENTRY_LANDINGS, LANDING_RUN, dryEntryRect, inEntryFootprint, LOWERED_SEA, PIER_START, SHORE_INNER_FACE, SHORE_LEVEL, WORLD_DROP, droppedTerrain, hybridRowOn, lowerSea, seaLevel, waterline, worldDrop } from '../../../src/shards/driftwood-isle/world/sea';
import { DRIFTWOOD_EDGE_HEIGHTS } from '../../../src/shards/driftwood-isle/data/edges';
import source from '../../../src/shards/driftwood-isle/shard.config';

// SHARD-PLATFORM SF46 (Jake's G164): with the hybrid row ON Driftwood's whole world drops 0.8 m together (terrain, seabed,
// sea, pier, jetties, boat, props, colliders, movers), so the sea rests at road height; row OFF is the legacy world exactly.

const authored = manifest.ground.terrain;
if (authored === undefined) throw new Error('Driftwood has an analytic terrain');
const SAMPLES: readonly (readonly [number, number])[] = [[0, -194], [-4.2, -203], [0, -250], [-24, -62], [98, 96], [153, 2], [-98, 108], [24, 22], [-250, 0], [250, 250], [-180, -30]];

it('row OFF: no drop, and the field, the waterline and the wreck read the authored numbers', () => {
  expect(hybridRowOn()).toBe(false); expect(worldDrop()).toBe(0);
  expect(OCEAN.level).toBe(0.8); expect(waterline()).toBe(SHORE_LEVEL); expect(WRECK.floorY).toBe(1.45);
  expect(authored.waterLevel()).toBe(0.8); expect(authored.datum).toBeCloseTo(0, 12);
  expect(manifest.minimap?.openWater?.level).toBe(0.8);
});

it('row ON: the field drops WORLD_DROP as one (heights, waterline, the bake datum), normals unchanged', () => {
  const on = droppedTerrain(authored, () => WORLD_DROP);
  expect(WORLD_DROP).toBe(0.8);
  for (const [x, z] of SAMPLES) expect(on.heightAt(x, z)).toBeCloseTo(authored.heightAt(x, z) - WORLD_DROP, 9);
  for (const [x, z] of SAMPLES) expect(on.normalAt(x, z)).toEqual(authored.normalAt(x, z));
  expect(on.waterLevel()).toBeCloseTo(LOWERED_SEA, 12); expect(on.datum).toBe(-WORLD_DROP);
  // the boat by the pier floats in the water it always had: the depth under its mooring is the legacy one
  expect(on.waterLevel() - on.heightAt(BOAT_MOOR.x, BOAT_MOOR.z)).toBeCloseTo(authored.waterLevel() - authored.heightAt(BOAT_MOOR.x, BOAT_MOOR.z), 9);
});

it('declares four 8 m midpoint entries on the lowered boundary rows, the socket at road height across each opening', () => {
  expect(validateProject(source, new Map())).toEqual(source);
  expect(source.entryways.map((row) => [row.edge, row.width])).toEqual([['north', ENTRY_WIDTH], ['east', ENTRY_WIDTH], ['south', ENTRY_WIDTH], ['west', ENTRY_WIDTH]]);
  expect(entrywayRules(source)).toEqual([]);
  for (const edge of ['north', 'east', 'south', 'west'] as const) {
    const row = source.edge[edge].heights, bake = DRIFTWOOD_EDGE_HEIGHTS[edge], stride = 500 / (row.length - 1);
    expect(row).toHaveLength(256);
    expect(Math.min(...row)).toBeCloseTo(-2.6 - WORLD_DROP, 9); // the seabed off the entries, lowered
    row.forEach((height, i) => {
      const along = -250 + i * stride;
      const [x, z] = edge === 'north' ? [along, 250] : edge === 'south' ? [along, -250] : edge === 'east' ? [250, along] : [-250, along];
      if (Math.abs(along) <= ENTRY_WIDTH / 2 + stride) { expect(height).toBe(0); return; }
      expect(height).toBe((bake[i] ?? Number.NaN) - WORLD_DROP);
      expect(Math.abs(authored.heightAt(x, z) - WORLD_DROP - height)).toBeLessThan(1e-3);
    });
  }
});

it('declares every entry a socket over water: the sea row clips all four sockets, four 8 m landings at y = 0 prove the walk off', () => {
  expect(source.entryways.map((row) => row.kind)).toEqual(['socketOverWater', 'socketOverWater', 'socketOverWater', 'socketOverWater']);
  expect(source.water).toEqual([{ id: 'sea', kind: 'sea', level: 0, waves: true, dryEntries: ['north', 'east', 'south', 'west'] }]);
  expect(source.props?.colliders.map((row) => row.shapes)).toEqual(ENTRY_LANDINGS.map(({ box }) => [box]));
  expect(() => validateShardfileAssets(source, new Map(), contentHash)).not.toThrow();
  // no landing, or one 0.5 m short of the full 8 m, or 1 cm proud of the road: refused
  expect(() => validateShardfileAssets({ ...source, props: null }, new Map(), contentHash)).toThrow('full-width collision landing');
  const narrow = ENTRY_LANDINGS.map(({ edge, box }) => ({ id: `landing.${edge}`, panel: null, initialActive: true, shapes: [edge === 'north' ? { ...box, x: box.x + 0.5 } : { ...box }] }));
  const props = source.props; if (props === null) throw new Error('Driftwood declares its landings');
  expect(() => validateSocketLandings({ ...source, props: { ...props, colliders: narrow } }, new Map())).toThrow('full-width collision landing');
  const proud = ENTRY_LANDINGS.map(({ edge, box }) => ({ id: `landing.${edge}`, panel: null, initialActive: true, shapes: [{ ...box, y: box.y + 0.01 }] }));
  expect(() => validateShardfileAssets({ ...source, props: { ...props, colliders: proud } }, new Map(), contentHash)).toThrow();
  // the ocean's rectangles and the swim / wade clip are the engine's dry sockets exactly (inclusive edges)
  for (const edge of DRY_ENTRIES) {
    const r = dryEntryRect(edge);
    for (const [x, z] of [[r.minX, r.minZ], [r.maxX, r.maxZ], [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2], [r.minX - 0.01, r.minZ], [r.maxX + 0.01, r.maxZ], [r.minX, r.minZ - 0.01]] as const) {
      expect(dryEntryContains(edge, x, z)).toBe(x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
      expect(inEntryFootprint(x, z)).toBe(DRY_ENTRIES.some((dry) => dryEntryContains(dry, x, z)));
    }
  }
  expect(G164_LOWERED.dry).toEqual(DRY_ENTRIES.map(dryEntryRect)); expect(G164_LOWERED.landings).toBe(ENTRY_LANDINGS);
  // each landing: top at exactly y = 0, the whole 8 m across, LANDING_RUN in from its socket's shard-side edge
  for (const { edge, box } of ENTRY_LANDINGS) {
    expect(box.y + box.hy).toBe(0);
    const ns = edge === 'north' || edge === 'south';
    expect(2 * (ns ? box.hx : box.hz)).toBe(ENTRY_WIDTH); expect(2 * (ns ? box.hz : box.hx)).toBe(LANDING_RUN);
    expect(Math.abs(ns ? box.z : box.x) + LANDING_RUN / 2).toBe(CHUNK_HALF - ENTRY_ASPHALT);
  }
});

it('lowers the registered sea only while a hybrid resident lives, and the ordinary sea is the old body exactly', () => {
  expect(SHORE_LEVEL).toBe(0.8); expect(LOWERED_SEA).toBe(0);
  expect(manifest.ground.water).toEqual([DRIFTWOOD_SEA]);
  expect(DRIFTWOOD_SEA.level).toBe(0.8); expect(DRIFTWOOD_SEA.restAt(0, -200)).toBe(0.8);
  const resident = new Scope('test.driftwood.resident');
  lowerSea(resident);
  expect(seaLevel()).toBe(0); expect(DRIFTWOOD_SEA.level).toBe(0); expect(DRIFTWOOD_SEA.restAt(0, -200)).toBe(0);
  expect(DRIFTWOOD_SEA.inside(0, -200, -0.5)).toBe(true); expect(DRIFTWOOD_SEA.inside(0, -200, 0.5)).toBe(false);
  // the lowered sea is clipped out of the four 8 × 15 m entry sockets
  for (const [x, z] of [[0, -249], [3.9, -236], [0, 249], [249, 0], [-236, 3.9]] as const) { expect(DRIFTWOOD_SEA.restAt(x, z)).toBeNull(); expect(DRIFTWOOD_SEA.inside(x, z, -0.5)).toBe(false); }
  for (const [x, z] of [[0, -234], [4.2, -249]] as const) expect(DRIFTWOOD_SEA.restAt(x, z)).toBe(0);
  resident.dispose();
  expect(seaLevel()).toBe(0.8); expect(DRIFTWOOD_SEA.restAt(0, -200)).toBe(0.8);
});

it('starts every pier and jetty where its 15 m socket ends, on whole piling bays, its ramp rising from road height', () => {
  const { pierStart, seaRamp, level } = G164_LOWERED, deckY = level + 1.2;
  expect(pierStart).toBe(PIER_START); expect(PIER_START).toBe(ENTRY_ASPHALT); expect(pierStart % 3).toBe(0); // pilings stay put
  expect(deckY).toBeCloseTo(SHORE_LEVEL + 1.2 - WORLD_DROP, 12); // the deck where it stood, lowered
  const params: PierParams = { length: 60 - pierStart, width: 4, pileDepth: 8, landing: null, pennantDir: [0, 1], seaRamp: { run: seaRamp, landY: -deckY } };
  expect(deckY + pierDeckAt(params, 0)).toBe(0); // the ramp's foot is the socket's road height
  expect(pierDeckAt(params, seaRamp)).toBe(0); expect(pierDeckAt(params, seaRamp / 2)).toBeCloseTo(-deckY / 2);
  // council C3-R2-C2: the ramp runs >= 8 m at <= 8 deg from the socket's inner edge, and its collider is pitched the same
  expect(seaRamp).toBeGreaterThanOrEqual(8); expect(Math.atan2(deckY, seaRamp) * 180 / Math.PI).toBeLessThanOrEqual(8);
  const pitched = pierColliders(params).filter((d) => d.kind === 'box' && d.rot !== undefined);
  expect(pitched).toHaveLength(1);
  for (const d of pitched) if (d.kind === 'box' && d.rot !== undefined) expect(2 * Math.asin(Math.abs(d.rot.x)) * 180 / Math.PI).toBeLessThanOrEqual(8);
  // nothing of the pier stands in the socket above road height (own z = metres in from the pier's start): only the
  // ramp's 0.2 m foot slab reaches in, flush with the socket, its top at road height (the pitched ramp box rises from it)
  for (const desc of pierColliders(params)) {
    if (desc.kind !== 'box') throw new Error('The pier collides as boxes');
    if (desc.rot !== undefined || pierStart + desc.z - desc.hz >= ENTRY_ASPHALT - 1e-9) continue;
    expect(pierStart + desc.z - desc.hz).toBeCloseTo(ENTRY_ASPHALT - 0.2, 9); expect(deckY + desc.y + desc.hy).toBeCloseTo(0, 9);
  }
  for (const [along] of pierPosts(params).bollards) expect(pierStart + along - 0.32).toBeGreaterThan(ENTRY_ASPHALT);
  for (const j of JETTIES) expect(j.length - pierStart).toBeGreaterThan(seaRamp + 10);
  expect(BOAT_MOOR.z).toBeGreaterThan(-250 + pierStart + seaRamp); // the boat stays moored alongside the deck
  expect(PIER_PENNANT_AT - pierStart).toBeGreaterThan(seaRamp);
});

it("regenerated movers: the boat moored by the pier at road-height sea, the rope bridge on the lowered banks", () => {
  const boat = MOVERS.find((m) => m.id === 'driftwood.boat'), bridge = MOVERS.find((m) => m.id === 'driftwood.bridge');
  if (boat === undefined || bridge === undefined) throw new Error('Missing Driftwood movers');
  expect(boat.at).toEqual({ x: BOAT_MOOR.x, y: LOWERED_SEA, z: BOAT_MOOR.z }); expect(boat.boxes).toHaveLength(boatColliders().length);
  expect(boat.input.slice(0, 5)).toEqual([BOAT_MOOR.x, LOWERED_SEA, BOAT_MOOR.z, 0, seaDamp(LOWERED_SEA - (authored.heightAt(BOAT_MOOR.x, BOAT_MOOR.z) - WORLD_DROP))]);
  const legacy = ropeBridgeSegments(BRIDGE, authored.heightAt);
  const segments = bridge.chain?.segments ?? [];
  expect(segments).toHaveLength(legacy.length);
  segments.forEach((s, i) => { const l = legacy[i]; if (l === undefined) throw new Error('Missing segment'); expect(s.x).toBeCloseTo(l.x, 9); expect(s.z).toBeCloseTo(l.z, 9); expect(s.y).toBeCloseTo(l.y - WORLD_DROP, 9); });
});

it('stops the lowered sea at the shore revetment inner face once a grid cell confines it (G149), unbounded standalone', () => {
  const resident = new Scope('test.driftwood.resident.g149');
  lowerSea(resident);
  try {
    expect(G164_LOWERED.edgeInset).toBe(SHORE_INNER_FACE);
    expect(DRIFTWOOD_SEA.restAt(249, 100)).toBe(0); // standalone: the sea runs on past the cell edge
    waterExtent.uWaterHalf.value = CHUNK_HALF;
    try {
      const face = CHUNK_HALF - SHORE_INNER_FACE;
      for (const [x, z] of [[face + 0.01, 100], [-100, -face - 0.01], [face + 0.5, face + 0.5]] as const) { expect(DRIFTWOOD_SEA.restAt(x, z)).toBeNull(); expect(DRIFTWOOD_SEA.inside(x, z, -0.5)).toBe(false); }
      for (const [x, z] of [[face - 0.01, 100], [100, -face + 0.01]] as const) { expect(DRIFTWOOD_SEA.restAt(x, z)).toBe(0); expect(DRIFTWOOD_SEA.inside(x, z, -0.5)).toBe(true); }
    } finally { waterExtent.uWaterHalf.value = WATER_UNBOUNDED; }
  } finally { resident.dispose(); }
  // the shore sea (row OFF) keeps the plain cell square, exactly as before
  waterExtent.uWaterHalf.value = CHUNK_HALF;
  try { expect(DRIFTWOOD_SEA.restAt(CHUNK_HALF - 0.5, 100)).toBe(0.8); } finally { waterExtent.uWaterHalf.value = WATER_UNBOUNDED; }
});
