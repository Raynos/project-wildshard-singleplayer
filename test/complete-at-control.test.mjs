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
  expect(lapPops(at, [sample([row('a', 'Mesh<a', 'g-a', 't-a')])], undefined)).toEqual({ fine: [], pops: [], neighbourPops: [], actors: [], distanceLod: [], lods: [], textures: [], reattached: [] });
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
    { url: 'https://x.test/assets/late-Explore-a1.js', by: 'service-worker', start: 50, end: 60 },   // offline precache: never read by the page
    { url: 'https://x.test/assets/packs/spawn-b2.bin', by: 'service-worker', start: 10, end: 40 },   // the worker fetches it ...
    { url: 'https://x.test/assets/packs/spawn-b2.bin?v=1', by: 'page', start: 30, end: null },        // ... while the page still reads it
    { url: 'https://x.test/assets/main-d4.js', by: 'page', start: 1, end: 5 },                        // the page read it before control ...
    { url: 'https://x.test/assets/main-d4.js', by: 'service-worker', start: 70, end: 80 },           // ... and the worker caches it later
    { url: 'https://x.test/assets/gpu/horizon/day-c3.ktx2', by: 'page', start: 90, end: 95 },         // a page read answered from the worker's cache
    { url: 'https://x.test/assets/gpu/horizon/day-c3.ktx2', by: 'service-worker', start: 85, end: 99 },// the worker fetching it for that read
    { url: 'https://x.test/version.json', by: 'service-worker', start: 1, end: 2 },                   // not level content at all
  ];
  const { level: levelRows, precache } = splitRequests(rows, level);
  expect(precache.map(entry => entry.url)).toEqual(['https://x.test/assets/late-Explore-a1.js', 'https://x.test/assets/main-d4.js']);
  expect(levelRows.map(entry => `${entry.by} ${entry.url}`)).toEqual(['service-worker https://x.test/assets/packs/spawn-b2.bin', 'page https://x.test/assets/packs/spawn-b2.bin?v=1',
    'page https://x.test/assets/main-d4.js', 'page https://x.test/assets/gpu/horizon/day-c3.ktx2', 'service-worker https://x.test/assets/gpu/horizon/day-c3.ktx2']);
});

test('a model re-attached by the ring after control is listed, a new one is a pop (DL5 target)', () => {
  const at = sample([row('pier-a', 'Mesh<driftwood-isle/pier<piers.world-0<Scene', 'g-pier', 't-wood')]);
  const found = lapPops(at, [sample([row('pier-b', 'Mesh<driftwood-isle/pier<Scene', 'g-pier-2', 't-wood'), row('crate', 'Mesh<crate<Scene', 'g-crate', 't-crate')])], undefined);
  expect(found.reattached).toEqual(['re-attached Mesh<driftwood-isle/pier<Scene']);
  expect(found.pops).toEqual(['added Mesh<crate<Scene']);
});

test('a look-alike is a pop: another texture, or the control mesh never retired (sp-x9)', () => {
  const at = sample([row('pier-a', 'Mesh<driftwood-isle/pier<piers.world-0<Scene', 'g-pier', 't-wood')]);
  // the original left the scene, but the newcomer draws another texture: new content, not the same model
  const retexture = lapPops(at, [sample([row('pier-b', 'Mesh<driftwood-isle/pier<Scene', 'g-pier-2', 't-gold')])], undefined);
  expect(retexture.reattached).toEqual([]); expect(retexture.pops).toEqual(['added Mesh<driftwood-isle/pier<Scene']);
  // same signature, but the control mesh is still there: a second copy appeared, nothing was re-attached
  const extra = lapPops(at, [sample([row('pier-a', 'Mesh<driftwood-isle/pier<piers.world-0<Scene', 'g-pier', 't-wood'), row('pier-b', 'Mesh<driftwood-isle/pier<Scene', 'g-pier-2', 't-wood')])], undefined);
  expect(extra.reattached).toEqual([]); expect(extra.pops).toEqual(['added Mesh<driftwood-isle/pier<Scene']);
});
