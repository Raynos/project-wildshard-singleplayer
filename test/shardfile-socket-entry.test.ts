import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile, type Shardfile } from '../src/game/shardfile/schema';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { validateEntrywayTerrain } from '../src/game/shardfile/entryways';
import { validateEntrywayClearance } from '../src/game/shardfile/entryClearance';
import { validateSocketLandings } from '../src/game/shardfile/entryLanding';
import { shardfileWater } from '../src/game/shardfile/water';
import { encodeTerrainTile } from '../src/engine/world/terrainTileData';
import { contentHash } from '../src/sdk/project';

function source(): Shardfile {
  const data = emptyShardfile({ slug: 'socket-test', name: 'Socket test', author: 'Fixture', seed: 1, revision: 1 });
  for (const entry of data.entryways) entry.kind = 'socketOverWater';
  data.props = { version: 1, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: [
    { id: 'north', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: -0.25, z: 234, hx: 4, hy: 0.25, hz: 1 }] },
    { id: 'south', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 0, y: -0.25, z: -234, hx: 4, hy: 0.25, hz: 1 }] },
    { id: 'east', panel: null, initialActive: true, shapes: [{ kind: 'box', x: 234, y: -0.25, z: 0, hx: 1, hy: 0.25, hz: 4 }] },
    { id: 'west', panel: null, initialActive: true, shapes: [{ kind: 'box', x: -234, y: -0.25, z: 0, hx: 1, hy: 0.25, hz: 4 }] },
  ] };
  data.water = [{ id: 'sea', kind: 'sea', level: -0.8, waves: true, dryEntries: ['north', 'east', 'south', 'west'] }];
  return data;
}
function native(data: Shardfile, heights = new Float32Array(257 ** 2).fill(-0.8)) {
  const wire = encodeTerrainTile({ resolution: 257, x: -250, z: -250, size: 500, heights }), hash = contentHash(wire);
  return { source: { ...data, terrain: { collider: hash } }, assets: new Map([[hash, wire]]) };
}
function firstBox(data: Shardfile) {
  const row = data.props?.colliders[0], shape = row?.shapes[0];
  if (row === undefined || shape?.kind !== 'box') throw new Error('Missing north landing');
  return { row, shape };
}

it('admits declared dry socket decks through full cartridge validation without crediting an implicit landing', () => {
  const data = source(); expect(validateShardfileAssets(data, new Map(), contentHash).entryways).toEqual(data.entryways);
  data.props = null;
  expect(() => validateShardfileAssets(data, new Map(), contentHash)).toThrow('full-width collision landing');
});

it('relaxes below-zero native footprint ground only for explicitly declared sockets with real landings', () => {
  const fixture = native(source());
  expect(() => validateEntrywayTerrain(fixture.source, fixture.assets)).not.toThrow();
  expect(() => validateSocketLandings(fixture.source, fixture.assets)).not.toThrow();
  const ordinary = { ...fixture.source, entryways: fixture.source.entryways.map((row) => ({ ...row, kind: 'ground' as const })) };
  expect(() => validateEntrywayTerrain(ordinary, fixture.assets)).toThrow('footprint must be flat');
  const heights = new Float32Array(257 ** 2).fill(-0.8); heights[250 * 257 + 128] = 0.001;
  const raised = native(source(), heights);
  expect(() => validateEntrywayTerrain(raised.source, raised.assets)).toThrow('cannot rise above');
});

it('admits a native terrain landing and refuses a lowered far-end line without a deck', () => {
  const data = source(); data.props = null;
  const flat = native(data, new Float32Array(257 ** 2));
  expect(() => validateSocketLandings(flat.source, flat.assets)).not.toThrow();
  const below = native(data);
  expect(() => validateSocketLandings(below.source, below.assets)).toThrow('full-width collision landing');
});

it('refuses narrow, elevated, lowered, inactive and panel-controlled landing claims', () => {
  for (const edit of [
    (data: Shardfile) => { firstBox(data).shape.hx = 3.999; },
    (data: Shardfile) => { firstBox(data).shape.y += 0.001; },
    (data: Shardfile) => { firstBox(data).shape.y -= 0.001; },
    (data: Shardfile) => { firstBox(data).row.initialActive = false; },
    (data: Shardfile) => { firstBox(data).row.panel = 'moving-deck'; },
  ]) { const data = source(); edit(data); expect(() => validateSocketLandings(data, new Map())).toThrow('full-width collision landing'); }
});

it('requires explicit clipping for any intersecting water, even when its rest surface is below road height', () => {
  const data = source();
  expect(() => validateEntrywayClearance(data, new Map())).not.toThrow();
  data.water = [{ id: 'sea', kind: 'sea', level: -2, waves: false, dryEntries: ['east', 'south', 'west'] }];
  expect(() => validateEntrywayClearance(data, new Map())).toThrow('footprint must be dry');
  data.water = [{ id: 'pool', kind: 'pool', level: -2, shape: { kind: 'circle', x: 0, z: 240, radius: 1 } }];
  expect(() => validateEntrywayClearance(data, new Map())).toThrow('footprint must be dry');
  data.water = [{ id: 'stream', kind: 'stream', width: 1, points: [{ x: -10, z: 240, level: -2 }, { x: 10, z: 240, level: -2 }] }];
  expect(() => validateEntrywayClearance(data, new Map())).toThrow('footprint must be dry');
});

it('clips every point of all four canonical rectangles in the actual swim/wade body, including their boundaries', () => {
  const water = shardfileWater(source().water)[0]; if (water === undefined) throw new Error('Missing sea');
  for (let along = -4; along <= 4; along += 0.5) for (let depth = 235; depth <= 250; depth += 0.5) {
    for (const [x, z] of [[along, depth], [along, -depth], [depth, along], [-depth, along]]) {
      if (x === undefined || z === undefined) throw new Error('Missing point');
      expect(water.restAt(x, z)).toBeNull(); expect(water.inside(x, z, -10)).toBe(false);
    }
  }
  expect(water.restAt(4.001, 240)).toBe(-0.8); expect(water.restAt(0, 234.999)).toBe(-0.8);
});

it('retains ordinary ground defaults and rejects forged kinds or duplicate water exclusions', () => {
  const data = source();
  expect(() => parseShardfile({ ...data, entryways: data.entryways.map((row) => ({ ...row, kind: 'bridge-anywhere' })) })).toThrow();
  expect(() => parseShardfile({ ...data, water: [{ id: 'sea', kind: 'sea', level: -0.8, waves: true, dryEntries: ['north', 'north'] }] })).toThrow();
  expect(validateShardfileAssets(emptyShardfile({ slug: 'ground', name: 'Ground', author: 'Fixture', seed: 1, revision: 1 }), new Map(), contentHash).entryways.every((entry) => entry.kind === undefined)).toBe(true);
  firstBox(data).shape.z = 240; firstBox(data).shape.y = 0;
  expect(() => validateEntrywayClearance(data, new Map())).toThrow('clear of props and colliders');
});
