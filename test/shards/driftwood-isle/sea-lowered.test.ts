import { expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { entrywayRules } from '../../../src/game/shardfile/entryways';
import { validateProject } from '../../../src/sdk/project';
import manifest, { BOAT_MOOR, JETTIES, OCEAN, PIER_PENNANT_AT, WRECK } from '../../../src/shards/driftwood-isle/manifest';
import { pierColliders, pierDeckAt, pierPosts, type PierParams } from '../../../src/shards/driftwood-isle/models/pier';
import { G134_LOWERED } from '../../../src/shards/driftwood-isle/world/build';
import { BEAM, BOAT_LADDER, boatColliders, boatLadderColliders } from '../../../src/shards/driftwood-isle/models/boat';
import { MOVERS } from '../../../src/shards/driftwood-isle/data/movers';
import { WATER_UNBOUNDED, WAVES, seaDamp, waterExtent } from '../../../src/engine/world/waves';
import * as THREE from 'three';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { setTerrainHeight } from '../../../src/engine/world/terrainHeight';
import { Seabed } from '../../../src/shards/driftwood-isle/world/Seabed';
import { jsonSlot } from '../../../src/engine/saves/slots';
import { CHUNK_HALF, ENTRY_ASPHALT as ENTRY_ASPHALT_CLEAR, ENTRY_WIDTH } from '../../../src/engine/core/config';
import { CORAL_CLEARANCE, DRIFTWOOD_SEA, LOWERED_SEA, SHORE_INNER_FACE, hybridRowOn, SHORE_LEVEL, lowerSea, seaLevel } from '../../../src/shards/driftwood-isle/world/sea';
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

it('hangs a boarding ladder on the anchored boat that a wading player walks up, step by step, on any heave of the swell', () => {
  const STEP_UP = 0.35, GUNWALE = 0.8; // the player's autostep (engine/player/Player.ts); the walls' top, own space
  const terrain = manifest.ground.terrain; if (terrain === undefined) throw new Error('Driftwood has an analytic terrain');
  const { x, z } = G134_LOWERED.boat, level = G134_LOWERED.level;
  const boxes = boatLadderColliders().map((d) => { if (d.kind !== 'box') throw new Error('The ladder collides as boxes'); return d; });
  const steps = boxes.slice(0, BOAT_LADDER.steps.length), board = boxes[boxes.length - 1];
  if (board === undefined) throw new Error('No board over the cap');
  // the board over the cap clears the gunwale wall and sits one step over the top step; it reaches in past the wall
  expect(board.y + board.hy).toBeGreaterThan(GUNWALE);
  expect(board.x - board.hx).toBeLessThan(BEAM / 2 - 0.08);
  // each step one STEP_UP over the next one out, outside the hull's wall; no step under another
  const tops = [board.y + board.hy, ...steps.map((b) => b.y + b.hy)];
  for (let i = 1; i < tops.length; i++) expect((tops[i - 1] ?? 0) - (tops[i] ?? 0)).toBeLessThanOrEqual(STEP_UP + 1e-9);
  steps.forEach((b, i) => { expect(b.x - b.hx).toBeGreaterThanOrEqual(BEAM / 2 + 0.08 - 1e-9); const prev = steps[i - 1]; if (prev !== undefined) expect(b.x - b.hx).toBeCloseTo(prev.x + prev.hx); });
  // wading (≥ 0.8 m deep, not swimming) up to it: the lowest step is never more than a STEP_UP over the seabed, at the
  // swell's full heave (the waves' amplitude sum, damped by the depth there)
  const lowest = steps[steps.length - 1]; if (lowest === undefined) throw new Error('No steps');
  const heave = WAVES.reduce((sum, w) => sum + w[2], 0) * seaDamp(level - terrain.heightAt(x, z));
  for (const lx of [lowest.x - lowest.hx, lowest.x + lowest.hx]) expect(level + lowest.y + lowest.hy + heave - terrain.heightAt(x + lx, z + lowest.z)).toBeLessThan(STEP_UP);
  // the boat everywhere else (row OFF, the Explorer's default) collides exactly as before; the anchored boat's mover
  // carries the ladder's boxes
  expect(boatColliders()).toHaveLength(5);
  const mover = MOVERS.find((m) => m.id === 'driftwood.boat'); if (mover === undefined) throw new Error('Missing boat mover');
  expect(mover.boxes).toHaveLength(5 + boxes.length);
});

it('leaves out the corals that would stand out of the lowered sea, and moves the fish school where it stays under water', () => {
  const terrain = manifest.ground.terrain; if (terrain === undefined) throw new Error('Driftwood has an analytic terrain');
  setTerrainHeight((x, z) => terrain.heightAt(x, z));
  const sky = { setupMaterial(_m: THREE.Material): void { /* no renderer in a test */ }, csm: { lightDirection: new THREE.Vector3(0, -1, 0) } } as Sky;
  const lagoon = Seabed.scatterLagoon(manifest.seed, 360, [{ x: WRECK.x, z: WRECK.z, r: 18 }]);
  const legacy = new Seabed(sky).build(lagoon), level = G134_LOWERED.level, below = level - CORAL_CLEARANCE;
  const lowered = new Seabed(sky).build(Seabed.lowered(lagoon, level), { below });
  expect(legacy.hidden).toBe(0); expect(legacy.count).toBe(lagoon.items.length);
  expect(lowered.hidden).toBeGreaterThan(0); expect(lowered.count).toBe(lagoon.items.length - lowered.hidden);
  // every coral copy the lowered reef placed tops out under the clearance
  const corals = lowered.placed.find((p) => p.model.endsWith('coral'));
  if (corals === undefined) throw new Error('No coral placed');
  const box = new THREE.Box3();
  for (let i = 0; i < corals.copies; i++) expect(corals.copyBox(i, box).max.y).toBeLessThanOrEqual(below);
  expect(legacy.placed.find((p) => p.model.endsWith('coral'))?.copies).toBe(corals.copies + lowered.hidden);
  // the school: its highest fish (±0.9 m about its centre) under the lowered surface, its lowest over the seabed
  const school = Seabed.lowered(lagoon, level).school; if (school === undefined) throw new Error('No school');
  expect(school.y + 0.9).toBeLessThan(level); expect(school.y - 0.9).toBeGreaterThan(terrain.heightAt(school.x, school.z));
  expect(school).not.toEqual(lagoon.school); expect(lagoon.school?.y).toBeCloseTo(OCEAN.level - Math.min(3, (OCEAN.level - terrain.heightAt(lagoon.school?.x ?? 0, lagoon.school?.z ?? 0)) * 0.55));
});

it("declares its open sea to the map and the grid's edge reader at road height with the hybrid row ON, the shore level OFF", () => {
  const row = jsonSlot('debug.plugin.driftwood-isle.driftwoodHybrid', 'device');
  expect(hybridRowOn()).toBe(false); expect(manifest.minimap?.openWater?.level).toBe(OCEAN.level);
  row.write('on');
  try { expect(hybridRowOn()).toBe(true); expect(manifest.minimap?.openWater?.level).toBe(LOWERED_SEA); expect(manifest.minimap?.openWater?.deepDepth).toBe(OCEAN.deepDepth); }
  finally { row.write('off'); }
  expect(manifest.minimap?.openWater?.level).toBe(0.8);
});

it('stops the lowered sea at the shore revetment inner face once a grid cell confines it (G149), unbounded standalone', () => {
  const resident = new Scope('test.driftwood.resident.g149');
  lowerSea(resident);
  try {
    expect(G134_LOWERED.edgeInset).toBe(SHORE_INNER_FACE);
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
