import { expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { entrywayRules } from '../../../src/game/shardfile/entryways';
import { validateProject } from '../../../src/sdk/project';
import manifest, { BOAT_MOOR, JETTIES, OCEAN, PIER_PENNANT_AT } from '../../../src/shards/driftwood-isle/manifest';
import { pierColliders, pierDeckAt, pierPosts, type PierParams } from '../../../src/shards/driftwood-isle/models/pier';
import { G134_LOWERED } from '../../../src/shards/driftwood-isle/world/build';
import { ENTRY_ASPHALT as ENTRY_ASPHALT_CLEAR, ENTRY_WIDTH } from '../../../src/engine/core/config';
import { DRIFTWOOD_SEA, LOWERED_SEA, SHORE_LEVEL, lowerSea, seaLevel } from '../../../src/shards/driftwood-isle/world/sea';
import source from '../../../src/shards/driftwood-isle/shard.config';

// SHARD-PLATFORM SF46 (Jake's G134): the hybrid world lowers Driftwood's sea and its pier, jetties and boat 0.8 m to road
// level; the four 8 m midpoint entries stand on the island's real boundary rows; the ordinary entry is untouched.

it('declares four 8 m midpoint entries over the real boundary rows, flat at road height across each opening', () => {
  expect(validateProject(source, new Map())).toEqual(source);
  expect(source.entryways.map((row) => [row.edge, row.width])).toEqual([['north', ENTRY_WIDTH], ['east', ENTRY_WIDTH], ['south', ENTRY_WIDTH], ['west', ENTRY_WIDTH]]);
  expect(entrywayRules(source)).toEqual([]);
  for (const edge of ['north', 'east', 'south', 'west'] as const) {
    const row = source.edge[edge].heights, terrain = manifest.ground.terrain;
    if (terrain === undefined) throw new Error('Driftwood has an analytic terrain');
    expect(row).toHaveLength(256);
    expect(Math.min(...row)).toBe(-2.6); // the seabed off the entries: the seam's shore rule is the platform's (council round 2)
    row.forEach((height, i) => {
      const along = -250 + i * 500 / (row.length - 1);
      const [x, z] = edge === 'north' ? [along, 250] : edge === 'south' ? [along, -250] : edge === 'east' ? [250, along] : [-250, along];
      expect(Math.abs(terrain.heightAt(x, z) - height)).toBeLessThan(1e-3);
      if (Math.abs(along) <= ENTRY_WIDTH / 2) expect(height).toBe(0);
    });
  }
});

it('lowers the registered sea only while a hybrid resident lives, and the ordinary sea is the old body exactly', () => {
  expect(OCEAN.level).toBe(0.8); expect(SHORE_LEVEL).toBe(0.8); expect(LOWERED_SEA).toBe(0);
  expect(manifest.ground.water).toEqual([DRIFTWOOD_SEA]);
  expect(DRIFTWOOD_SEA.level).toBe(0.8); expect(DRIFTWOOD_SEA.restAt(0, -200)).toBe(0.8);
  const resident = new Scope('test.driftwood.resident');
  lowerSea(resident);
  expect(seaLevel()).toBe(0); expect(DRIFTWOOD_SEA.level).toBe(0); expect(DRIFTWOOD_SEA.restAt(0, -200)).toBe(0);
  expect(DRIFTWOOD_SEA.inside(0, -200, -0.5)).toBe(true); expect(DRIFTWOOD_SEA.inside(0, -200, 0.5)).toBe(false);
  // G134 (a): the lowered sea is clipped out of the four 8 × 15 m entry sockets
  for (const [x, z] of [[0, -249], [3.9, -236], [0, 249], [249, 0], [-236, 3.9]] as const) { expect(DRIFTWOOD_SEA.restAt(x, z)).toBeNull(); expect(DRIFTWOOD_SEA.inside(x, z, -0.5)).toBe(false); }
  for (const [x, z] of [[0, -234], [4.2, -249]] as const) expect(DRIFTWOOD_SEA.restAt(x, z)).toBe(0);
  resident.dispose();
  expect(seaLevel()).toBe(0.8); expect(DRIFTWOOD_SEA.restAt(0, -200)).toBe(0.8);
});

it('starts every pier and jetty past its 8 × 15 m entry socket, on whole piling bays, with a ramp up from the sandbar', () => {
  const { pierStart, seaRamp, level } = G134_LOWERED, deckY = level + 1.2;
  expect(ENTRY_WIDTH).toBe(8); expect(pierStart).toBe(18);
  expect(pierStart % 3).toBe(0); // the pilings stand where they stood
  expect(pierStart).toBeGreaterThan(ENTRY_ASPHALT_CLEAR);
  const params: PierParams = { length: 60 - pierStart, width: 4, pileDepth: 8, landing: null, pennantDir: [0, 1], seaRamp: { run: seaRamp, landY: 0.05 - deckY } };
  expect(pierDeckAt(params, 0)).toBeCloseTo(0.05 - deckY); expect(pierDeckAt(params, seaRamp)).toBe(0); expect(pierDeckAt(params, seaRamp / 2)).toBeCloseTo((0.05 - deckY) / 2);
  // nothing of the pier (its colliders, own z = metres in from its own start) reaches back into the 15 m socket
  for (const desc of pierColliders(params)) {
    if (desc.kind !== 'box') throw new Error('The pier collides as boxes');
    expect(pierStart + desc.z - desc.hz - 0.2).toBeGreaterThan(ENTRY_ASPHALT_CLEAR); // 0.2: the ramp box's pitch
  }
  const { bollards } = pierPosts(params);
  for (const [along] of bollards) expect(pierStart + along - 0.32).toBeGreaterThan(ENTRY_ASPHALT_CLEAR);
  // the jetties and the pier keep a deck past their ramp and the boat's mooring alongside
  for (const j of JETTIES) expect(j.length - pierStart).toBeGreaterThan(seaRamp + 10);
  expect(BOAT_MOOR.z).toBeGreaterThan(-250 + pierStart + seaRamp);
  // the coordinator's pick A: the lowered world's boat rides at anchor off the sandbar in ≥ 0.8 m of water (the legacy draught)
  const terrain = manifest.ground.terrain; if (terrain === undefined) throw new Error('Driftwood has an analytic terrain');
  expect(level - terrain.heightAt(G134_LOWERED.boat.x, G134_LOWERED.boat.z)).toBeGreaterThan(0.8);
  expect(PIER_PENNANT_AT - pierStart).toBeGreaterThan(seaRamp);
});
