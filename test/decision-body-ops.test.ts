import nightSource from '../src/shards/pine-hollow/behaviour/night.as?raw';
import { expect, test } from 'vitest';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';
import { decisionScriptContract, parseDecisionScripts } from '../src/format/decisionScripts';
import { decisionBindingMap } from '../src/format/decisionBindings';
import { DecisionHost, type DecisionScript } from '../src/engine/script/decision';
import { NIGHT_SPAWN } from '../src/shards/pine-hollow/generators/nightSpawn';
import { spawnScriptRegistries } from '../src/format/spawnScripts';
import { SCRIPT_V1_READS, type ScriptV1ReadName, type ScriptV1Command } from '../src/format/scriptAbiV1';

const row = { id: 'test.bodies', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`,
  source: 'behaviour/bodies.as', binding: { shard: true }, onFail: 'hold', on: ['start'],
  reads: ['bodyX', 'bodyY', 'bodyZ', 'bodyAlive', 'bodyYaw', 'bodyVisible', 'playerIntent', 'x', 'z'],
  commands: ['body.spawn', 'body.teleport', 'body.place', 'body.visible', 'body.retire', 'collider.enabled'],
  bodies: { guide: 'actor.guide', crate: 'prop.crate', old: 'actor.old' }, colliders: { door: 'gate.door' },
  stateVersion: 1, state: [], params: {} };
const registries = { bodies: new Map([['actor.guide', 71], ['prop.crate', 8], ['actor.old', 12]]), colliders: new Map([['gate.door', 9]]) };
async function fixture(body: string, deniedReads: readonly ScriptV1ReadName[] = []) {
  const source = `import {Body,Collider,Read,Do} from './generated/testBodies';\nexport function onStart():void{${body}}`;
  const built = await compileDecisionScripts([row], registries, new Map([['behaviour/bodies.as', source]]), { asLineCeiling: 10 });
  const script = built.rows[0], blob = built.blobs[0];
  if (script === undefined || blob === undefined) throw new Error('Missing body program');
  const map = decisionBindingMap(script, registries), committed: ScriptV1Command[] = [];
  let prepared = 0;
  const declaration: DecisionScript = { ...script, ids: map.ids, reads: script.reads.filter((read): read is ScriptV1ReadName => Object.hasOwn(SCRIPT_V1_READS, read)).filter(read => !deniedReads.includes(read)), lists: [] };
  const host = new DecisionHost({ scripts: [declaration], bindings: [{ id: 1, script: row.id, self: 0, actors: [], instance: 0 }],
    seed: [1, 2], modules: new Map([[script.module, blob.bytes]]), world: { player: 101,
      read: () => 0, list: () => 0, failed: () => undefined,
      prepare: commands => { prepared++; const copy = structuredClone(commands); return { commit: () => { committed.push(...copy); } }; },
    } });
  host.enqueue(1, [1, 0, 0, 0, 0, 0]);
  const step = (from: number, to: number): void => { for (let tick = from; tick <= to; tick++) host.step(tick); };
  return { host, committed, prepared: () => prepared, step };
}

test('generated body ops use declared identities and commit atomically at the existing fixed-step boundary', async () => {
  const f = await fixture('if(!Read.bodyAlive(Body.guide))Do.bodySpawn(Body.guide);Do.bodyPlace(Body.guide,2,3,0.5);Do.bodyVisible(Body.guide,true);Do.bodyTeleport(Body.crate,4,5,6);Do.colliderEnabled(Collider.door,false);Do.bodyRetire(Body.old);');
  f.step(1, 6); expect(f.committed).toEqual([]);
  const saved = f.host.snapshot(); f.host.restore(saved); f.step(7, 7);
  expect(f.committed).toEqual([[17, 0, 71, 0, 0], [20, 71, 2, 3, .5], [21, 71, 1, 0, 0], [18, 8, 4, 5, 6], [19, 0, 9, 0, 0], [22, 12, 0, 0, 0]]);
});

test.each(['Do.bodySpawn(999);', 'Do.bodyPlace(999,0,0,0);', 'Do.bodyTeleport(999,0,0,0);', 'Do.bodyVisible(999,true);', 'Do.bodyRetire(999);', 'Do.colliderEnabled(999,true);', 'Read.bodyX(999);', 'Read.playerIntent(2);', 'Read.playerIntent(-1);'])('refuses undeclared body or collider authority before any command publishes: %s', async invalid => {
  const f = await fixture(`Do.bodySpawn(Body.guide);${invalid}`); f.step(1, 7);
  expect(f.host.metrics()[0]?.refusals).toBe(1); expect(f.prepared()).toBe(0); expect(f.committed).toEqual([]);
});

test('body spawning shares the existing four-spawn allowance', async () => {
  const f = await fixture('for(let i=0;i<5;i++)Do.bodySpawn(Body.guide);'); f.step(1, 7);
  expect(f.host.metrics()[0]?.refusals).toBe(1); expect(f.prepared()).toBe(0); expect(f.committed).toEqual([]);
});

test('restoring forged body boolean or reserved fields refuses the complete staged call', async () => {
  const f = await fixture('Do.bodyVisible(Body.guide,true);Do.colliderEnabled(Collider.door,false);'); f.step(1, 6);
  const saved = f.host.snapshot();
  for (const [index, field, value] of [[0, 2, 2], [0, 3, 1], [1, 1, 71], [1, 4, 1]]) {
    const bad = structuredClone(saved), command = bad.staged[0]?.commands[index ?? -1];
    if (command === undefined || field === undefined) throw new Error('Missing staged body command');
    Reflect.set(command, field, value);
    expect(() => f.host.restore(bad)).toThrow(); expect(f.host.snapshot()).toEqual(saved);
  }
  expect(f.committed).toEqual([]); f.step(7, 7); expect(f.committed).toHaveLength(2);
});


test('pre-extension scripts keep the exact saved mechanical declaration', () => {
  const parsed = parseDecisionScripts([{ ...row, reads: [], commands: [], bodies: {}, colliders: {} }])[0];
  if (parsed === undefined) throw new Error('Missing admitted script');
  const { sourceHash: _sourceHash, bodies: _bodies, colliders: _colliders, ...old } = parsed;
  expect(JSON.stringify(decisionScriptContract(parsed))).toBe(JSON.stringify(old));
  const extended = parseDecisionScripts([row])[0];
  if (extended === undefined) throw new Error('Missing body script');
  expect(decisionScriptContract(extended).bodies).toEqual(row.bodies);
  expect(decisionScriptContract(extended).colliders).toEqual(row.colliders);
});


test('additive body capabilities preserve the existing night director Wasm identity', async () => {
  const built = await compileDecisionScripts([NIGHT_SPAWN.script], spawnScriptRegistries(NIGHT_SPAWN),
    new Map([['behaviour/night.as', nightSource]]), { asLineCeiling: 2130 });
  expect(built.blobs[0]?.file.hash).toBe('3ecd8e5debc556c6c8aa1576f4bfee55d8e4f328a74b3627e6d238ec0ff8b135');
});


test('requested player intent requires an explicit read capability', async () => {
  const f = await fixture('Do.bodySpawn(Body.guide);Read.playerIntent(0);', ['playerIntent']);
  f.step(1, 7); expect(f.host.metrics()[0]?.refusals).toBe(1);
  expect(f.prepared()).toBe(0); expect(f.committed).toEqual([]);
});


test.each([true, false])('requested motion grants observation of only the lent player: %s', async granted => {
  const f = await fixture('Do.bodySpawn(Body.guide);Read.x(101);Read.z(101);', granted ? [] : ['playerIntent']);
  f.step(1, 7); expect(f.host.metrics()[0]?.refusals).toBe(granted ? 0 : 1);
  expect(f.prepared()).toBe(granted ? 1 : 0);
  const foreign = await fixture('Read.x(102);'); foreign.step(1, 7);
  expect(foreign.host.metrics()[0]?.refusals).toBe(1); expect(foreign.prepared()).toBe(0);
});
