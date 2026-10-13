// oxlint-disable-next-line import/no-nodejs-modules -- A fresh V8 process enables real GC for the transport-retention regression.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node executable as the focused test worker.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';

const script = String.raw`
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers';
import {clientGround} from './src/game/shardfile/clientGround.ts';
import {emptyShardfile} from './src/sdk/author.ts';
import {encodeTerrainTile} from './src/format/terrainTileBytes.ts';
import {encodeMeshCollision} from './src/format/meshCollisionBytes.ts';
function fixture(mode) {
  const source=emptyShardfile({slug:'ground-retention',name:'Ground',author:'test',revision:1,seed:1});
  const wire=mode==='query' ? encodeTerrainTile({resolution:256,x:-250,z:-250,size:500,
    heights:new Float32Array(256*256).fill(4.25),splat:Uint8Array.from({length:256*256*4},(_,i)=>i%4===0?255:0)})
    : encodeMeshCollision({vertices:Float32Array.of(0,-2,0,10,-2,0,0,-2,10),indices:Uint32Array.of(0,2,1)});
  if(mode==='query') source.terrain={form:'query',collider:'wire',sampling:{law:'bilinear',file:'wire',normalEpsilon:0.6,datum:-0.8}};
  else source.meshCollision={version:1,tiles:[{x:4,z:4,file:'wire'}],panels:[]};
  const assets=new Map([['wire',wire]]), ground=clientGround(source,assets,0);
  return {ground,assets:new WeakRef(assets),wire:new WeakRef(wire)};
}
const held=fixture(MODE);
if(typeof globalThis.gc!=='function') throw new Error('Missing real GC');
for(let i=0;i<8;i++){await new Promise(resolve=>setImmediate(resolve));globalThis.gc();}
assert(held.assets.deref()===undefined,'query closures retain the admitted transport Map');
assert(held.wire.deref()===undefined,'query closures retain the raw transport buffer');
assert.equal(held.ground.heightAt(2,2),MODE==='query'?4.25:-2);
assert.deepEqual(held.ground.normalAt(2,2),[0,1,0]);
assert.deepEqual(held.ground.splatAt(2,2),[1,0,0,0]);
`;

it.each(['query', 'mesh'])('keeps decoded %s queries alive while collecting their admitted transports', mode => {
  const result = spawnSync(execPath, ['--expose-gc', '--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', `const MODE=${JSON.stringify(mode)};\n${script}`],
    { encoding: 'utf8', timeout: 15_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}, 20_000);
