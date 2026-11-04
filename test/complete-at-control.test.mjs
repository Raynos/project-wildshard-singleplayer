import { expect, test } from 'vitest';
import { lapPops, splitRequests } from '../scripts/complete-at-control-snapshot.mjs';

// a snapshot's mesh row: [uuid, chain, signature `geometry|positions|indices|material:map:width`, shown, within reach, skinned]
const row = (id, chain, geometry, map, shown = true, close = true, skinned = false) => [id, chain, `${geometry}|36|0|mat:${map}:256`, shown, close, skinned];
const sample = list => ({ scene: { list, lods: [], texturesPending: [] }, fine: [] });

test('content not resident at control is red; distance design on resident models is listed', () => {
  const at = sample([
    row('pier', 'Mesh<pier', 'g-pier', 't-wood'),
    row('cover-far', 'ground-cover-tuft-far<ground-cover', 'g-tuft-far', 't-plant', false),
    row('npc', 'Mesh<npc-castaway', 'g-npc', 't-npc', false),
    row('rock-lo', 'Mesh<rock', 'g-rock-lo', 't-rock'),
    row('rock-hi-elsewhere', 'Mesh<rock2', 'g-rock-hi', 't-rock'),
    row('crate', 'Mesh<crate', 'g-crate', 't-crate'),
  ]);
  at.scene.lods = ['tree@1'];
  const lap = [sample([
    row('pier', 'Mesh<pier', 'g-pier', 't-wood'),
    row('cover-far', 'ground-cover-tuft-far<ground-cover', 'g-tuft-far', 't-plant'),     // shown: a resident model
    row('npc', 'Mesh<npc-castaway', 'g-npc', 't-npc'),                                   // shown by distance
    row('rock-lo', 'Mesh<rock', 'g-rock-hi', 't-rock'),                                  // swapped to resident geometry
    row('crate', 'Mesh<crate', 'g-crate', 't-crate-ktx2'),                               // swapped to a texture nobody held
    row('pier-2', 'Mesh<driftwood-isle/pier<piers.world-1', 'g-pier-1', 't-wood'),     // added after control
    row('far-away', 'Mesh<far', 'g-far', 't-far', true, false),                          // beyond reach: ignored
    row('deer', 'SkinnedMesh<animals', 'g-deer', 't-deer', true, true, true),            // an actor
  ])];
  const found = lapPops(at, lap, undefined);
  expect(found.pops).toEqual(['swapped to non-resident data Mesh<crate', 'added Mesh<driftwood-isle/pier<piers.world-1']);
  expect(found.distanceLod).toEqual(['shown ground-cover-tuft-far<ground-cover', 'shown Mesh<npc-castaway', 'swapped Mesh<rock']);
  expect(found.lods).toEqual(['tree@1']);
  expect(found.actors).toEqual(['SkinnedMesh<animals']);
});

test('a lap that changes nothing has no pops and no distance LOD', () => {
  const at = sample([row('a', 'Mesh<a', 'g-a', 't-a')]);
  expect(lapPops(at, [sample([row('a', 'Mesh<a', 'g-a', 't-a')])], undefined)).toEqual({ fine: [], pops: [], neighbourPops: [], actors: [], distanceLod: [], lods: [], textures: [] });
});

test('in the grid, a mesh under another cell is the neighbour\'s', () => {
  const at = sample([]);
  const found = lapPops(at, [sample([row('n', 'Mesh<region-scene:far-reach<region:far-reach', 'g-n', 't-n'), row('h', 'Mesh<region:driftwood-isle', 'g-h', 't-h')])], 'driftwood-isle');
  expect(found.neighbourPops).toEqual(['added Mesh<region-scene:far-reach<region:far-reach']);
  expect(found.pops).toEqual(['added Mesh<region:driftwood-isle']);
});

test('a worker fetch the page never requests in the visit is precache; any page request stays the level\'s (G872 (a))', () => {
  const level = url => !url.includes('/version.json');
  const rows = [
    { url: 'https://x.test/assets/late-Explore-a1.js', by: 'service-worker' },            // offline precache: never read by the page
    { url: 'https://x.test/assets/packs/spawn-b2.bin', by: 'service-worker' },            // the worker fetches it ...
    { url: 'https://x.test/assets/packs/spawn-b2.bin?v=1', by: 'page' },                   // ... and the page reads it (query ignored)
    { url: 'https://x.test/assets/gpu/horizon/day-c3.ktx2', by: 'page' },                  // a page read answered from the worker's cache
    { url: 'https://x.test/version.json', by: 'service-worker' },                          // not level content at all
  ];
  const { level: levelRows, precache } = splitRequests(rows, level);
  expect(precache.map(entry => entry.url)).toEqual(['https://x.test/assets/late-Explore-a1.js']);
  expect(levelRows.map(entry => entry.url)).toEqual(['https://x.test/assets/packs/spawn-b2.bin', 'https://x.test/assets/packs/spawn-b2.bin?v=1', 'https://x.test/assets/gpu/horizon/day-c3.ktx2']);
});
