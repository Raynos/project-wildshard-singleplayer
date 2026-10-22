import { expect,test } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { prepareV2Rng,type V2RngInput } from '../src/format/scriptRngV2';
import { layoutV2,writeV2Frame,validateV2Frame } from '../src/format/scriptWireV2';
import { prepareV2Observations } from '../src/engine/script/observationsV2';
import { ScriptModuleV2 } from '../src/engine/script/moduleV2';
import { compileSimV2 } from '../src/sdk/bake/compileSimV2';
import { DecisionHost,type DecisionScript } from '../src/engine/script/decision';
import { compileScript } from '@wildshard/sdk/compileScript';

const layout = layoutV2(1024,1,new Map([[1,1],[2,2],[3,2],[5,1],[21,2],[22,2]]));
function at(kind: number): number { const region = layout.regions[kind-1];if (region === undefined) throw new Error('Missing RNG fixture bank');return layout.io+region.offset; }
const inputs: readonly V2RngInput[] = [
  { binding: 1,stream: 1,algorithm: 1,state: [0xffffffff,42,1,0,0,0] },
  { binding: 1,stream: 2,algorithm: 2,state: [123,456,2**32-1,2**40+3,2**41+7,0] },
];
let bytes: Promise<Uint8Array> | undefined;
async function fixture() {
  bytes ??= compileSimV2(`import * as ws from './sdk/as/wsV2';export function onBinding():void{for(let i=0;i<20;i++){ws.setState(0,ws.random(1));ws.setState(1,ws.random(2));}}`,{ io: 1024,ioBytes: layout.bytes });
  const module = new ScriptModuleV2(await bytes,{ seed: [1,2],initFuel: 10000,ioBytes: layout.bytes,output: [{ offset: at(3),count: 2,width: 8 }] });
  const observations = prepareV2Observations(layout,0,{ bindings: [{ identity: 'a',handle: 1,self: 0,player: 0,observed: new Set(),enabled: true,due: true,divisor: 6,fuel: 400000,previousTick: 0,currentTick: 0,state: [0,0],parameters: [],fields: [],sample: { atTick: 0,target: 0 } }],players: [],edges: [],events: [],actions: new Set(),eventKinds: new Set() });
  const rng = prepareV2Rng(layout,inputs), counts = new Map(observations.counts);counts.set(21,rng.count);
  function run() {
    const frame: { authority: ReturnType<typeof writeV2Frame> | undefined } = { authority: undefined };
    return module.step(0,400000,view => {
      frame.authority = writeV2Frame(view,layout,{ lane: 1,module: 1,sequence: 1,tick: 0,due: 1 },counts);observations.write(view);new Uint8Array(view.buffer,at(21),rng.bytes.length).set(rng.bytes);
    },view => {
      if (frame.authority === undefined) throw new Error('Missing RNG fixture authority');
      const outputCounts = validateV2Frame(view,layout,frame.authority);
      return { values: [view.getFloat64(at(3),true),view.getFloat64(at(3)+8,true)],rng: rng.readCandidate(view,outputCounts[21] ?? 0,new Set([1])) };
    });
  }
  return { module,rng,run };
}

test('guest Mulberry32 reproduces the native continuation and repeated calls rewind the borrowed bank', async () => {
  const f = await fixture(), native = new Rng(42);native.restore({ version: 1,state: 0xffffffff,initial: 42,scrambledFork: true });
  let last = 0;for (let i = 0; i < 20; i++) last = native.next();
  const a = f.run().value, b = f.run().value;
  expect(a).toEqual(b);expect(a.values[0]).toBe(last);expect(a.rng[0]).toEqual({ ...inputs[0],draws: 20,state: [native.snapshot().state,42,1,0,0,0] });
  expect(inputs[0]?.state[0]).toBe(0xffffffff);
});

test('guest decision RNG matches the real v1 host across the 32-bit counter and logical-id boundaries', async () => {
  const f = await fixture(), script: DecisionScript = { id: 'rng',module: 'rng',side: 'sim',on: ['start'],tick: null,onFail: 'hold',stateVersion: 1,state: [],params: {},ids: {},reads: ['random'],lists: [],commands: [] };
  const oldBytes = await compileScript(`@external("env","ws_read") declare function read(op:i32,a:f64,b:f64):f64;
export function ws_abi():i32{return 1;} export function ws_io():i32{return 16384;} export function ws_init(lo:i32,hi:i32):void{} export function ws_handle():i32{for(let i=0;i<20;i++)read(12,0,0);return 0;}`,{ abi: 1 });
  let commits = 0, refusals = 0;
  const values: number[] = [], host = new DecisionHost({ scripts: [script],modules: new Map([['rng',oldBytes]]),seed: [123,456],bindings: [{ id: 2**40+3,script: 'rng',self: 0,actors: [],instance: 2**41+7 }],world: { read: () => 0,list: () => 0,prepare: () => ({ commit: () => { commits++; } }),failed: () => { refusals++; } },trace: entry => { if (entry.kind === 'read') values.push(entry.result); } });
  const saved = host.snapshot();for (const row of saved.bindings) row.rng = 2**32-1;host.restore(saved);
  host.enqueue(2**40+3,[1,0,0,0,0,0]);for (let tick = 1; tick <= 7; tick++) host.step(tick);
  expect(refusals).toBe(0);expect(commits).toBe(1);expect(values).toHaveLength(20);const answer = f.run().value;expect(answer.values[1]).toBe(values[19]);expect(answer.rng[1]?.state).toEqual([123,456,2**32+19,2**40+3,2**41+7,0]);
});

test('candidate RNG refuses forged seeds, counters, owners and inactive draws atomically', async () => {
  const f = await fixture();f.run();const view = new DataView(f.module.memory.buffer), original = new Uint8Array(view.buffer).slice();
  for (const [offset,value] of [[0,2],[4,99],[8,2],[16,12],[24,99],[32,0]]) {
    new Uint8Array(view.buffer).set(original);
    if (offset === undefined || value === undefined) throw new Error('Invalid fixture mutation');
    if (offset < 16) view.setUint32(at(22)+offset,value,true);else view.setFloat64(at(22)+offset,value,true);
    expect(() => f.rng.readCandidate(view,2,new Set([1]))).toThrow();
  }
  new Uint8Array(view.buffer).set(original);expect(() => f.rng.readCandidate(view,1,new Set([1]))).toThrow();expect(() => f.rng.readCandidate(view,2,new Set())).toThrow();
  expect(() => prepareV2Rng(layout,[...inputs,inputs[0] ?? inputs[1] ?? { binding: 0,stream: 0,algorithm: 1,state: [0,0,0,0,0,0] }])).toThrow();
  expect(() => prepareV2Rng(layout,[{ binding: 1,stream: 1,algorithm: 2,state: [0,0,Number.MAX_SAFE_INTEGER+1,1,0,0] }])).toThrow();
});
