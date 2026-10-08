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
const result = vm.runInNewContext(expression, context);
assert.equal(reads, 0);
assert.equal(result.census.releasedAttributes.length, 2);
assert.equal(result.census.cpuAllocations.length, 2);
assert.equal(result.census.cpuAllocations[0].uses.length, 2, 'A shared backing buffer is counted once');
assert.equal(result.census.cpuAllocations.reduce((sum, row) => sum + row.bytes, 0), position.byteLength + interleaved.byteLength);
assert.equal(result.settings.memorySaver, 'on');
console.log('Native census: released getters untouched, backing buffers deduplicated, interleaved arrays observed.');

const htmlExpression = /const builtHtml = ([\s\S]*?);\nconst documentHtml/u.exec(source)?.[1];
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
