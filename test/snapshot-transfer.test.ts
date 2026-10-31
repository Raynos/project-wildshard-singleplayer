// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns a real shipped Rapier continuation.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {beforeAll,expect,test} from 'vitest';
import {createSimHost} from '../src/engine/sim';
import {loadRapier} from '../src/engine/physics/rapier';
import {serializeSimSnapshot,serializeSimSnapshotForTransfer,decodeSimSnapshotBytes,snapshotSimHostBytes,
  type SimSnapshotBytes} from '../src/engine/sim/snapshot';
import {MAX_TICK_SNAPSHOT_CHARS} from '../src/sdk/tickProtocol';
import {SIM_LEVEL} from './fixtures/sim-level/level';
import {beginProductSession} from './fixtures/headless/productSession';

let initial:SimSnapshotBytes;
beforeAll(async()=>{
  const host=createSimHost(SIM_LEVEL,{rapier:await loadRapier(readFileSync('public/assets/physics/rapier.wasm'))});
  try{initial=snapshotSimHostBytes(host);}finally{host.dispose();}
});
function failure(run:()=>unknown):{name:string;message:string}{
  try{run();}catch(error){if(!(error instanceof Error))throw error;return {name:error.name,message:error.message};}
  throw new Error('Expected original strict refusal');
}
const record=v.record(v.string(),v.unknown());
function encoding(wire:string):unknown{
  return v.parse(record,v.parse(record,v.parse(record,JSON.parse(wire))['snapshot'])['physics'])['encoding'];
}

test('transient base64 retains every decoded field, native byte and signed zero without changing stored bytes',()=>{
  const backing=new Uint8Array(4096+19).fill(73),physics=backing.subarray(7,7+4096),before=backing.slice();
  const saved={...initial,physics,adapters:[{id:'exact',state:{values:[-0,0,Infinity,-Infinity,'é😀\n"']}}]};
  const stored=serializeSimSnapshot(saved),wire=serializeSimSnapshotForTransfer(saved,MAX_TICK_SNAPSHOT_CHARS);
  expect(encoding(stored)).toBe('deflate-lz-base64-v1');expect(encoding(wire)).toBe('base64');
  expect(wire.length).toBeLessThanOrEqual(MAX_TICK_SNAPSHOT_CHARS);
  expect(decodeSimSnapshotBytes(wire)).toStrictEqual(decodeSimSnapshotBytes(stored));
  expect(serializeSimSnapshot(saved)).toBe(stored);expect(backing).toEqual(before);
  backing.fill(0);expect(decodeSimSnapshotBytes(wire).physics).toEqual(before.subarray(7,7+4096));
});

test('metadata counts toward the transfer fence and a raw miss retains the exact original stored wire and refusal',()=>{
  const saved={...initial,physics:new Uint8Array(65537).fill(31),adapters:[{id:'metadata',state:'é😀\\\n"'.repeat(20)}]};
  const stored=serializeSimSnapshot(saved),raw=serializeSimSnapshotForTransfer(saved,MAX_TICK_SNAPSHOT_CHARS);
  expect(raw.length).toBeGreaterThan(stored.length);
  expect(serializeSimSnapshotForTransfer(saved,raw.length)).toBe(raw);
  expect(serializeSimSnapshotForTransfer(saved,raw.length-1)).toBe(stored);
  expect(serializeSimSnapshotForTransfer(saved,stored.length)).toBe(stored);
  const fence=(wire:string)=>v.parse(v.pipe(v.string(),v.maxLength(stored.length-1)),wire);
  expect(failure(()=>fence(serializeSimSnapshotForTransfer(saved,stored.length-1)))).toEqual(failure(()=>fence(stored)));
});

test.each(['pose','identity','accessor','cycle','legacy-byte','empty','too-large','multiple'] as const)('transient %s refusal keeps the original validation and error order',kind=>{
  const saved=structuredClone(initial);
  if(kind==='pose'||kind==='multiple')saved.player.position[0]=Number.NaN;
  if(kind==='identity')saved.flags.push('duplicate','duplicate');
  if(kind==='accessor')Object.defineProperty(saved,'unexpected',{enumerable:true,get:()=>1});
  if(kind==='cycle')Reflect.set(saved,'unexpected',saved);
  if(kind==='legacy-byte')Reflect.set(saved,'physics',[256]);
  if(kind==='empty'||kind==='multiple')saved.physics=new Uint8Array();
  if(kind==='too-large')saved.physics=new Uint8Array(32_000_001);
  expect(failure(()=>serializeSimSnapshotForTransfer(saved,MAX_TICK_SNAPSHOT_CHARS))).toEqual(failure(()=>serializeSimSnapshot(saved)));
});

test.each([Number.NaN,Infinity,-1,1.5])('an invalid explicit transfer bound refuses: %s',bound=>{
  expect(()=>serializeSimSnapshotForTransfer(initial,bound)).toThrow('Invalid snapshot character bound');
});

test('transient checkpoint selection refuses a foreign proof owner before product admission',async()=>{
  await expect(beginProductSession('pine-hollow','pine-verbs',undefined,true)).rejects.toThrow('chapter proof owner');
});
