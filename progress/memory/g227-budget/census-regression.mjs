// Run with node. Exercise the actual sampler expression, without booting a game or restoring released GPU arrays.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { snapshotExpression } from './inspect.mjs';

const source = readFileSync(new URL('./native.mjs', import.meta.url), 'utf8');
const expression = snapshotExpression;
assert.ok(expression, 'The native census expression must exist');
let reads = 0;
const released = { count: 3, itemSize: 3, get array() { reads++; throw new Error('Census restored a released array'); } };
const position = new Float32Array(9), interleaved = new Float32Array(12);
const object = { name: 'owned-mesh', type: 'Mesh', isMesh: true, material: [], geometry: {
  attributes: { position: { array: position }, color: { array: position }, normal: released, uv: { data: { array: interleaved } } },
  index: released,
} };
const grid = { state: () => ({}), residency: () => [], roadResident: () => ({}) };
const context = { ArrayBuffer, Float32Array, localStorage: { getItem: () => JSON.stringify({ keys: { settings: { data: { memorySaver: 'on' } } } }) }, window: {
  __sc_gl: () => [], __wildshard: { shard: { grid }, world: { game: { rootScene: { traverse: fn => fn(object) }, level: { id: 'fixture' } } } },
} };
context.window.__g227Audio = [
  { source: '/title.m4a', buffer: new WeakRef({length: 100, numberOfChannels: 2}) },
  { source: '/retired.m4a', buffer: {deref: () => undefined} },
];
const result = vm.runInNewContext(expression, context);
assert.equal(result.audioDecodes[0].source, '/title.m4a');
assert.equal(result.audioDecodes[0].pcmBytes, 800);
assert.equal(result.audioDecodes[1].source, '/retired.m4a', 'Historical decode provenance survives buffer retirement');
assert.equal(result.audioDecodes[1].live, false);
assert.equal(result.audioDecodes[1].pcmBytes, null, 'A retired buffer does not become zero-byte saving credit');
assert.equal(reads, 0);
assert.equal(result.census.releasedAttributes.length, 2);
assert.equal(result.census.cpuAllocations.length, 2);
assert.equal(result.census.cpuAllocations[0].uses.length, 2, 'A shared backing buffer is counted once');
assert.equal(result.census.cpuAllocations.reduce((sum, row) => sum + row.bytes, 0), position.byteLength + interleaved.byteLength);
assert.equal(result.settings.memorySaver, 'on');
console.log('Native census: released getters untouched, backing buffers deduplicated, interleaved arrays observed.');

const htmlExpression = /const builtHtml = ([\s\S]*?);\nconst /u.exec(source)?.[1];
assert.ok(htmlExpression);
const html = '<head><script data-g227-fixture>window.__g227Errors=[];oldOn();</script><script>window.__g227Errors=[];oldOff();</script><script type="module" src="/assets/game.js"></script></head>';
const cleaned = vm.runInNewContext(htmlExpression, { readFileSync: () => html, dist: '/fixture' });
assert.equal(cleaned, '<head><script type="module" src="/assets/game.js"></script></head>');
console.log('Cold variants remove only prior harness fixtures; production module retained.');

const mesh = (name, x, visible = true) => ({ name, type: 'Mesh', isMesh: true, visible, material: [], frustumCulled: true,
  matrixWorld: { getMaxScaleOnAxis: () => 1 }, geometry: { attributes: {}, boundingSphere: {radius:0.1,center:{clone:()=>({applyMatrix4:()=>({x,y:0,z:0})})}} } });
const gridMeshes = [mesh('grid-in-view', 0), mesh('grid-outside', 3), mesh('grid-hidden', 0, false)];
context.window.__wildshard.world.game.camera = { projectionMatrix: {clone:()=>({multiply:()=>({elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]})})},
  position: {toArray:()=>[0,0,0]}, quaternion:{toArray:()=>[0,0,0,1]}, fov:60 };
context.window.__wildshard.world.game.rootScene.traverse = fn => gridMeshes.forEach(fn);
const views = vm.runInNewContext(expression, context).roots;
assert.equal(views[0].inFrustum, true);
assert.equal(views[1].inFrustum, false);
assert.equal(views[2].visible, false);
assert.equal(reads, 0);
console.log('Platform view diagnostics distinguish in-frustum, off-view and hidden roots without reading attribute arrays.');

// The ruler fix (E435 ruler lane): no in-page census before a pose's native samples, and the default is one final census.
assert.match(source, /\?\.slice\('--census='\.length\) \?\? 'final'/u, 'The default census mode is final');
assert.match(source, /\?\.slice\('--vmmap='\.length\) \?\? 'last'/u, 'vmmap runs only after the last reading by default');
assert.match(source, /if \(vmmapMode === 'every'\) \{\n {6}try \{ vmmap = execFileSync\('vmmap'/u, 'A pose runs vmmap only in the legacy mode');
const snapshotBody = /const snapshot = async label => \{([\s\S]*?)\n {2}\};/u.exec(source)?.[1] ?? '';
const firstSample = snapshotBody.indexOf('waitNativeSample'), firstCensus = snapshotBody.indexOf('evaluate(snapshotExpression)');
assert.ok(firstSample >= 0 && firstCensus > firstSample, 'A pose samples the footprint before any census');
assert.match(snapshotBody, /censusMode === 'every' \? await evaluate\(snapshotExpression\)/u, 'Only the legacy mode runs a census at every pose');
const lightSource = /const lightExpression = `([\s\S]*?)`;/u.exec(source)?.[1];
assert.ok(lightSource);
const light = vm.runInNewContext(lightSource, { localStorage: context.localStorage, window: { __sc_gl: () => [
  { gl: {}, totalBytes: 30, reconciled: true, top: [], resources: [{ bytes: 20, labelled: true }, { bytes: 10, labelled: false }] },
] } });
assert.deepEqual(JSON.parse(JSON.stringify(light.gl)), [{ totalBytes: 30, reconciled: true, unlabelledBytes: 10 }]);
assert.equal(light.settings.memorySaver, 'on');
console.log('Ruler: footprint before census, final census by default, light GL read returns totals without resource rows.');
