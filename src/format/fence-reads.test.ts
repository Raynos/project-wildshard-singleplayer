import { expect, test } from 'vitest';
import { assetIdentities, assetStem, audioTableRefs, bundlerSources, identityFiles, standInRefs, type AssetDigests, fenceReadAliases, fenceReadIdentities, fenceReadIdentity, joinRefs, packMembers, readFenceReads, resolveFenceReads, sectionRefs } from './fenceReads.ts';

// DL22: Pine's cold boot read 143 files before control that its spawn set lacked (late models by name, props tiles by
// tile); the recorded list keeps stable identities so a content edit (new hashes) still maps to the right files.
const h = (seed: string): string => seed.repeat(64).slice(0, 64);
const sections = (tileFile: string, extra: string): Map<string, unknown> => new Map([['world/props', { props: { tiles: [
  { lod: 0, x: 3, z: 5, file: tileFile, additionalFiles: [extra] }, { lod: 1, x: 1, z: 2, file: h('9') },
] } }]]);

test('identities: props tile files by tile and slot, named files by name; unnamed others are absent', () => {
  const files = [{ hash: h('a'), name: 'models/creatures/bear.glb' }, { hash: h('b') }, { hash: h('c') }, { hash: h('d') }];
  const ids = fenceReadIdentities(files, sections(h('c'), h('d'))), first = (hash: string) => fenceReadIdentity(ids, hash);
  expect(first(h('a'))).toBe('name:models/creatures/bear.glb');
  expect(first(h('c'))).toBe('props-tile:0/3/5:file'); expect(first(h('d'))).toBe('props-tile:0/3/5:0');
  expect(first(h('9'))).toBe('props-tile:1/1/2:file'); expect(ids.has(h('b'))).toBe(false);
});

test('a recorded list maps to the current product\'s hashes after an edit renames the content', () => {
  const reads = readFenceReads({ version: 1, files: ['props-tile:0/3/5:file', 'name:models/creatures/bear.glb', 'name:models/gone.glb'] });
  // The edit rewrote the bear and the tile: new hashes, same identities; a removed model is reported.
  const after = resolveFenceReads(reads, [{ hash: h('e'), name: 'models/creatures/bear.glb' }, { hash: h('f') }], sections(h('f'), h('0')));
  expect([...after.hashes].sort()).toEqual([h('e'), h('f')].sort());
  // The removed model is reported, so the build refuses the stale list instead of skipping it (sp-x8's review).
  expect(after.unresolved).toEqual(['name:models/gone.glb']);
});

test('the committed list is checked and normalised', () => {
  expect(readFenceReads({ version: 1, files: ['name:b', 'name:a', 'name:a'] }).files).toEqual(['name:a', 'name:b']);
  expect(() => readFenceReads({ version: 1, files: ['blobs/glb/x.glb'] })).toThrow('Invalid fence reads');
  expect(() => readFenceReads({ version: 2, files: [] })).toThrow('Invalid fence reads');
});

test('a hashed name is recorded by its section reference, and two rows sharing a file both resolve (sp-x8\'s review)', () => {
  // The painted atlas's name carries its content hash; a section names it, so the recording keeps the section path.
  const atlas = { hash: h('1'), name: `models/painted/atlas-${h('1')}.ktx2` };
  const looks = new Map<string, unknown>([['look/materials', { painted: { atlas: atlas.name, alias: atlas.name } }]]);
  const ids = fenceReadIdentities([atlas], looks);
  expect(fenceReadIdentity(ids, h('1'))).toBe('ref:look/materials:/painted/atlas');
  // After an edit the atlas has new bytes and a new name; the section path still finds it, and so does its alias.
  const edited = { hash: h('2'), name: `models/painted/atlas-${h('2')}.ktx2` };
  const now = new Map<string, unknown>([['look/materials', { painted: { atlas: edited.name, alias: edited.name } }]]);
  const resolved = resolveFenceReads(readFenceReads({ version: 1, files: ['ref:look/materials:/painted/atlas', 'ref:look/materials:/painted/alias'] }), [edited], now);
  expect([...resolved.hashes]).toEqual([h('2')]); expect(resolved.unresolved).toEqual([]);
});

test('a section key with a dot and a nested path never share a ref identity (sp-x8\'s review)', () => {
  const ids = fenceReadIdentities([{ hash: h('3') }, { hash: h('4') }], new Map<string, unknown>([['look/materials', { 'a.b': h('3'), a: { b: h('4') }, 'c/d': h('3') }]]));
  expect(ids.get(h('3'))).toEqual(['ref:look/materials:/a.b', 'ref:look/materials:/c~1d']);
  expect(ids.get(h('4'))).toEqual(['ref:look/materials:/a/b']);
});

test('every alias of a shared file is recorded, so a later split leaves a stale entry the build refuses', () => {
  const shared = [{ hash: h('5'), name: 'models/a.glb' }, { hash: h('5'), name: 'models/b.glb' }];
  const recorded = fenceReadAliases(fenceReadIdentities(shared, new Map()), h('5'));
  expect([...recorded].sort()).toEqual(['name:models/a.glb', 'name:models/b.glb']);
  // b gets its own bytes: both names still resolve, to their own files, and nothing is silently dropped.
  const split = resolveFenceReads({ version: 1, files: recorded }, [{ hash: h('5'), name: 'models/a.glb' }, { hash: h('6'), name: 'models/b.glb' }], new Map());
  expect([...split.hashes].sort()).toEqual([h('5'), h('6')].sort()); expect(split.unresolved).toEqual([]);
});

// A build where every hex suffix is the file's real hash: its digest starts with it.
const real: AssetDigests = path => { const hex = /[-.]([a-f0-9]{8,})(?=\.[a-z0-9]+$)/u.exec(path)?.[1]; return hex === undefined ? [] : [`${hex}ff`]; };

test('/assets identities: hash-free stems, pack parts by their members, and unstable names only by a section reference', () => {
  expect(assetStem('/assets/gpu/x/rifle.phone-fd73a325.glb', real)).toBe('/assets/gpu/x/rifle.phone.glb');
  expect(assetStem('/assets/sfx/best/bed-forest-2-0cd11be5.m4a', real)).toBe('/assets/sfx/best/bed-forest-2.m4a');
  expect(assetStem('/assets/baked/p/navmesh.bin?v=93aaa10d', real)).toBe('/assets/baked/p/navmesh.bin');
  const table = (first: string[], second: string[]) => packMembers({ 'pine-hollow': { phone: { parts: [
    { url: '/assets/packs/pine.phone-11111111.bin', files: first.map(path => [path, 0, 1, 'x']) },
    { url: '/assets/packs/pine.phone-22222222.bin', files: second.map(path => [path, 0, 1, 'x']) }] } } });
  const before = table(['/assets/m/a-0cd11be5.m4a'], ['/assets/m/b-7faf0468.m4a']);
  const cabin = `/assets/pine-hollow/baked/cabin-materials/${h('7')}.glb`;
  const ids = assetIdentities(['/assets/packs/pine.phone-22222222.bin', '/assets/sfx/a-0cd11be5.m4a', '/assets/x/b-aaaaaaaa.png',
    '/assets/x/b-bbbbbbbb.png', cabin, '/assets/y/c-BpZPbf24.bin'], before, new Map([[cabin, ['ref:world/props:/cabins/0/material']]]), {digests: real});
  expect(ids.get('/assets/packs/pine.phone-22222222.bin')).toEqual(['asset-pack-member:pine-hollow:phone:/assets/m/b.m4a']);
  expect(ids.get('/assets/sfx/a-0cd11be5.m4a')).toEqual(['asset:/assets/sfx/a.m4a']);
  expect(ids.has('/assets/x/b-aaaaaaaa.png')).toBe(false); // two files share the stem
  expect(ids.get(cabin)).toEqual(['ref:world/props:/cabins/0/material']); // a pure-hash name: its section references
  expect(ids.get('/assets/y/c-BpZPbf24.bin')).toEqual(['asset:/assets/y/c-BpZPbf24.bin']); // no hash its bytes confirm: a name
  // A rebuild moves member b into the other part: its identity now resolves to that part, never to the old ordinal.
  const after = table(['/assets/m/b-7faf0468.m4a'], ['/assets/m/a-0cd11be5.m4a']);
  expect(assetIdentities(['/assets/packs/pine.phone-11111111.bin'], after, new Map(), {digests: real}).get('/assets/packs/pine.phone-11111111.bin'))
    .toEqual(['asset-pack-member:pine-hollow:phone:/assets/m/b.m4a']);
  expect(readFenceReads({ version: 1, files: ['asset:/assets/sfx/a.m4a', 'asset-pack-member:pine-hollow:phone:/assets/m/b.m4a'] }).files).toHaveLength(2);
});

test('sp-x8\'s third round: colliding member stems and hash-only members refuse their part; every /assets reference is kept', () => {
  const part = (url: string, files: string[]) => ({ url, files: files.map(path => [path, 0, 1, 'x']) });
  // Two revisions of one slot in different parts share a stem: both parts are refused, never one silently chosen.
  const revisions = packMembers({ p: { phone: { parts: [part('/assets/packs/p-11111111.bin', ['/assets/t/diffuse-11111111.ktx2']),
    part('/assets/packs/p-22222222.bin', ['/assets/t/diffuse-22222222.ktx2'])] } } });
  const both = assetIdentities(['/assets/packs/p-11111111.bin', '/assets/packs/p-22222222.bin'], revisions, new Map(), {digests: real});
  expect(both.has('/assets/packs/p-11111111.bin')).toBe(false); expect(both.has('/assets/packs/p-22222222.bin')).toBe(false);
  // A pure-hash member needs a section reference, or its part is refused.
  const hashed = `/assets/m/${h('8')}.glb`, pack = packMembers({ p: { phone: { parts: [part('/assets/packs/q-33333333.bin', [hashed, '/assets/m/rock-0cd11be5.glb'])] } } });
  expect(assetIdentities(['/assets/packs/q-33333333.bin'], pack, new Map(), {digests: real}).has('/assets/packs/q-33333333.bin')).toBe(false);
  expect(assetIdentities(['/assets/packs/q-33333333.bin'], pack, new Map([[hashed, ['ref:world/props:/rocks/0']]]), {digests: real}).get('/assets/packs/q-33333333.bin'))
    .toEqual(['asset-pack-ref:p:phone:ref:world/props:/rocks/0', 'asset-pack-member:p:phone:/assets/m/rock.glb']);
  // A hash-only /assets file two sections name keeps both references; when one is split off, the other still resolves to
  // the old file and the split one is a different file, so a recording made before the split no longer covers it.
  const shared = `/assets/x/${h('9')}.bin`;
  const refs = sectionRefs(new Map<string, unknown>([['a', { file: shared }], ['b', { file: shared }]]), new Set([shared]));
  expect(refs.get(shared)).toEqual(['ref:a:/file', 'ref:b:/file']);
  expect(assetIdentities([shared], new Map(), refs).get(shared)).toEqual(['ref:a:/file', 'ref:b:/file']);
});

test('DL11: colliding sfx revisions are told apart by their slot in the boot tables\' sfx manifest', () => {
  // Pine's 8: two revisions of one clip both ship, so neither has a unique stem; the table names the one the game reads.
  const urls = ['/assets/sfx/best/bed-forest-2-0cd11be5.m4a', '/assets/sfx/best/bed-forest-2-11112222.m4a',
    '/assets/sfx/best/footstep-planks-2-ebb5a80c.m4a', '/assets/sfx/best/footstep-planks-2-33334444.m4a', '/assets/music/calm/theme-aaaabbbb.m4a'];
  const refs = audioTableRefs({sfx: {best: {model: 'x', beds: {forest: {file: 'bed-forest-2-0cd11be5.m4a'}}, oneshots: {'footstep-planks': {files: ['a.m4a', 'footstep-planks-2-ebb5a80c.m4a']}}}},
    music: {calm: {tracks: ['theme-aaaabbbb.m4a']}}});
  expect(refs.get('/assets/sfx/best/bed-forest-2-0cd11be5.m4a')).toEqual(['ref:boot-sfx:/best/beds/forest/file']);
  expect(refs.get('/assets/sfx/best/footstep-planks-2-ebb5a80c.m4a')).toEqual(['ref:boot-sfx:/best/oneshots/footstep-planks/files/1']);
  expect(refs.get('/assets/music/calm/theme-aaaabbbb.m4a')).toEqual(['ref:boot-music:/calm/tracks/0']);
  const ids = assetIdentities(urls, new Map(), joinRefs(new Map(), refs), {digests: real});
  expect(ids.get('/assets/sfx/best/bed-forest-2-0cd11be5.m4a')).toEqual(['ref:boot-sfx:/best/beds/forest/file']);
  expect(ids.has('/assets/sfx/best/bed-forest-2-11112222.m4a')).toBe(false); // the unshipped revision has no slot
  expect(readFenceReads({version: 1, files: ['ref:boot-sfx:/best/beds/forest/file']}).files).toEqual(['ref:boot-sfx:/best/beds/forest/file']);
});

test('a suffix is stripped only when the file\'s bytes confirm it: `forest-2` is a name (sp-x1, wildshard-new)', () => {
  // Pine's bed-forest-2: its 0cd11be5 is the file's sha1; `-forest-2` was refused as a bundler hash by its shape.
  const forest = '/assets/sfx/best/bed-forest-2-0cd11be5.m4a', sha1: AssetDigests = path => path === forest ? ['0cd11be5a176ffff'] : [];
  expect(assetStem(forest, sha1)).toBe('/assets/sfx/best/bed-forest-2.m4a');
  expect(assetIdentities([forest], new Map(), new Map(), {digests: sha1}).get(forest)).toEqual(['asset:/assets/sfx/best/bed-forest-2.m4a']);
  expect(assetIdentities(['/assets/sfx/best/footstep-litter-1.m4a'], new Map()).get('/assets/sfx/best/footstep-litter-1.m4a'))
    .toEqual(['asset:/assets/sfx/best/footstep-litter-1.m4a']);
  // A hex suffix the bytes do not confirm is neither stripped nor trusted: no identity.
  expect(assetStem(forest)).toBe(forest);
  expect(assetIdentities([forest], new Map()).has(forest)).toBe(false);
});

test('a bundler file is named by its source module from the build manifest, never by guessing its hash', () => {
  const emitted = '/assets/pine-hollow-C8hPt5PZ.jpg', source = 'src/shards/pine-hollow/thumbs/pine-hollow.jpg';
  expect(assetIdentities([emitted], new Map(), new Map(), {sources: new Map([[emitted, [source]]])}).get(emitted)).toEqual([`asset-source:${source}`]);
  expect(readFenceReads({version: 1, files: [`asset-source:${source}`]}).files).toEqual([`asset-source:${source}`]);
});

test('a bundler output two sources share keeps both aliases; once they split, each names only its own file (sp-x2)', () => {
  // The 816bfefffc build: assets/nine-gate-live-BGIZ18T-.jpg is legacy/explore/nine-gate-live.jpg AND current/... (same bytes).
  const shared = '/assets/nine-gate-live-BGIZ18T-.jpg', legacy = 'legacy/explore/nine-gate-live.jpg', current = 'current/explore/nine-gate-live.jpg';
  const before = assetIdentities([shared], new Map(), new Map(), {sources: new Map([[shared, [legacy, current]]])});
  expect(before.get(shared)).toEqual([`asset-source:${legacy}`, `asset-source:${current}`]);
  // legacy changes alone: two outputs now; the recorded legacy alias resolves to the new file, never the unchanged peer
  const split = '/assets/nine-gate-live-Xq81ZZ2a.jpg';
  const after = assetIdentities([shared, split], new Map(), new Map(), {sources: new Map([[shared, [current]], [split, [legacy]]])});
  expect(after.get(split)).toEqual([`asset-source:${legacy}`]);
  expect(after.get(shared)).toEqual([`asset-source:${current}`]);
});

test('audio table refs take every format the engine reads (.webm too, sp-x2)', () => {
  expect(audioTableRefs({sfx: {best: {beds: {rain: {file: 'bed-rain-1.webm'}}}}}).get('/assets/sfx/best/bed-rain-1.webm')).toEqual(['ref:boot-sfx:/best/beds/rain/file']);
});

test('a vendor source is keyed by its package path, wherever the build ran (5591d76604 failed CI on a mirror path)', () => {
  const file = 'assets/basis_transcoder-Bq3x9ZQe.wasm', wanted = 'node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm';
  const mirror = bundlerSources({'../../../../node_modules/.pnpm/three@0.186.0/node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm': {file}});
  const checkout = bundlerSources({'node_modules/.pnpm/three@0.186.0/node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm': {file}});
  expect(mirror.get(`/${file}`)).toEqual([wanted]);
  expect(checkout.get(`/${file}`)).toEqual([wanted]);
  // project sources keep their key; code is not an asset
  expect(bundlerSources({'src/shards/pine-hollow/thumbs/pine-hollow.jpg': {file: 'assets/pine-hollow-C8hPt5PZ.jpg'}, 'src/main.ts': {file: 'assets/main-x.js'}}))
    .toEqual(new Map([['/assets/pine-hollow-C8hPt5PZ.jpg', ['src/shards/pine-hollow/thumbs/pine-hollow.jpg']]]));
  expect(readFenceReads({version: 1, files: [`asset-source:${wanted}`]}).files).toEqual([`asset-source:${wanted}`]);
});

test('sp-x9: a project folder named node_modules keeps its project path, and two vendor versions under one key are ambiguous', () => {
  const lookalike = bundlerSources({'src/generated/my_node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm': {file: 'assets/a-1.wasm'},
    'src/vendor/node_modules/three/x.wasm': {file: 'assets/b-1.wasm'}});
  expect(lookalike.get('/assets/a-1.wasm')).toEqual(['src/generated/my_node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm']);
  expect(lookalike.get('/assets/b-1.wasm')).toEqual(['src/vendor/node_modules/three/x.wasm']);
  // three@0.186.0 and three@0.187.0 both retained: one package key, two distinct outputs
  const sources = bundlerSources({
    'node_modules/.pnpm/three@0.186.0/node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm': {file: 'assets/old-1.wasm'},
    'node_modules/.pnpm/three@0.187.0/node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm': {file: 'assets/new-1.wasm'}});
  const owners = identityFiles(assetIdentities(['/assets/old-1.wasm', '/assets/new-1.wasm'], new Map(), new Map(), {sources}));
  expect(owners.get('asset-source:node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm')).toEqual(['/assets/old-1.wasm', '/assets/new-1.wasm']);
  // one output's own aliases stay one file
  const shared = identityFiles(new Map([['/assets/s.jpg', ['asset-source:a.jpg', 'asset-source:b.jpg']]]));
  expect(shared.get('asset-source:a.jpg')).toEqual(['/assets/s.jpg']);
});

test('DL11: two packed variants of one texture set are told apart by the source each stands in for (Pine\'s pine_bark)', () => {
  const plain = '/assets/gpu/tex/pine_bark/diffuse-e1721a67.ktx2', layer = '/assets/gpu/tex/pine_bark/diffuse-74f225f1.ktx2';
  const refs = standInRefs({phone: {'/assets/tex/pine_bark/diffuse_1k.phone.webp': plain, '/assets/tex/pine_bark/diffuse_1k.phone.webp#layer': layer,
    '/assets/tex/pine_bark/diffuse.jpg': plain}});
  expect(refs.get(plain)).toEqual(['ref:gpu-phone:/~1assets~1tex~1pine_bark~1diffuse_1k.phone.webp', 'ref:gpu-phone:/~1assets~1tex~1pine_bark~1diffuse.jpg']);
  expect(refs.get(layer)).toEqual(['ref:gpu-phone:/~1assets~1tex~1pine_bark~1diffuse_1k.phone.webp#layer']);
  // the two parts share member stems, so only these references can name them
  const pack = packMembers({'pine-hollow': {phone: {parts: [
    {url: '/assets/packs/pine-hollow.phone-cd012952.bin', files: [[layer, 0, 1, 'x']]},
    {url: '/assets/packs/pine-hollow.phone-7949990b.bin', files: [[plain, 0, 1, 'x']]}]}}});
  const ids = assetIdentities(['/assets/packs/pine-hollow.phone-cd012952.bin', '/assets/packs/pine-hollow.phone-7949990b.bin'], pack, refs, {digests: real});
  expect(ids.get('/assets/packs/pine-hollow.phone-cd012952.bin')).toEqual(['asset-pack-ref:pine-hollow:phone:ref:gpu-phone:/~1assets~1tex~1pine_bark~1diffuse_1k.phone.webp#layer']);
  expect(ids.get('/assets/packs/pine-hollow.phone-7949990b.bin')?.[0]).toBe('asset-pack-ref:pine-hollow:phone:ref:gpu-phone:/~1assets~1tex~1pine_bark~1diffuse_1k.phone.webp');
  expect(readFenceReads({version: 1, files: ['asset-pack-ref:pine-hollow:phone:ref:gpu-phone:/~1assets~1tex~1pine_bark~1diffuse_1k.phone.webp#layer']}).files).toHaveLength(1);
  // the loose copy of a packed member carries the same stand-in reference: the part's name stays its own, one file each
  const loose = assetIdentities(['/assets/packs/pine-hollow.phone-cd012952.bin', layer], pack, refs, {digests: real});
  const owners = identityFiles(loose);
  expect([...owners.values()].every(files => files.length === 1)).toBe(true);
  expect(loose.get(layer)).toEqual(['asset:/assets/gpu/tex/pine_bark/diffuse.ktx2']);
});
