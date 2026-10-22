import { expect,test,vi } from 'vitest';
import * as v from 'valibot';
import { SkinnedMesh } from 'three';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import type { Animal } from '../src/engine/entities/AnimalView';
import { SpawnInputV2Schema } from '../src/format/spawnScriptV2';
import { Scope } from '../src/engine/app/scope';
import { StalkerBrain } from '../src/engine/ai/stalker';
import pouncer from '../src/shards/nalati-grasslands/data/aqbarsProfile.json' with { type: 'json' };
import { SpawnScript } from '../src/game/population/spawnScript';
import { PageWildEnvironment } from '../src/game/population/pageGroups';
import type { AnimalManager } from '../src/engine/entities/AnimalManager';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { fixtureBytes } from './fixtures/nativeBytes';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { legacyDouble } from './fake/FakeGame';
import { parseSpawnScript,spawnScriptRegistries } from '../src/format/spawnScripts';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { scriptAdmissionRows,decisionModuleContracts } from '../src/format/scriptContract';
import { layoutV2 } from '../src/format/scriptWireV2';
import { compileSimV2 } from '../src/sdk/bake/compileSimV2';
import { compileDecisionScripts } from '../src/sdk/buildDecisionScripts';

const capacities = [{ kind: 1,capacity: 1 },{ kind: 2,capacity: 1 },{ kind: 3,capacity: 1 },{ kind: 5,capacity: 1 },{ kind: 6,capacity: 3 },{ kind: 7,capacity: 1 },{ kind: 9,capacity: 32 },{ kind: 10,capacity: 32 },{ kind: 21,capacity: 1 },{ kind: 22,capacity: 1 }];
const layout = layoutV2(2048,1,new Map(capacities.map(row => [row.kind,row.capacity])));
let compiled: ReturnType<typeof programs> | undefined;
async function programs() {
  const original = parseSpawnScript({ step: 'watch',roster: 'animals',seed: 3,maximum: 1,controlState: 'sidestep',bytes: '',
    slots: [{ id: 'main',handle: 1 }],species: [{ id: 'boar',kind: 'boar',variant: 'plain' }],sites: [{ id: 'home',slot: 'main',point: [3,4],face: 'player' }],spawns: [{ id: 'boar',species: 'boar',site: 'home' }],
    fields: [{ id: 'engaged',source: 'observed' },{ id: 'grass',source: 'observed' },{ id: 'unset',source: 'observed' }],flags: [],cues: [],channels: ['value'],moves: [],strikes: [{ id: 'bite',row: { id: 'strike.bite',shape: { kind: 'point',radius: 3 },windup: .1,active: .2,recover: .2,cooldown: 10,range: 3,damage: 7,tags: ['cover.checked'],weight: { kind: 'constant',value: 1 } },trauma: .2,stun: .5 }],
    script: { id: 'watch',abi: '1.0',side: 'sim',module: `blobs/wasm/${'0'.repeat(64)}.wasm`,source: 'behaviour/watch.as',binding: { shard: true },pages: 1,onFail: 'hold',tick: 10,on: ['start','tick','signal'],reads: ['field'],commands: ['channel','strike'],strikes: { bite: 'strike.bite' },stateVersion: 1,state: [{ name: 'calls',type: 'i32',default: 0,scope: 'binding',min: 0,max: 100 }],params: {},actors: { main: 'main' },fields: { engaged: 'engaged',grass: 'grass' },channels: { value: 'value' } } });
  const built = await compileDecisionScripts([original.script],spawnScriptRegistries(original),new Map([['behaviour/watch.as',`import {Do,Channel,State} from './generated/watch';export function onStart():void{}export function onTick(dt:f64):void{State.calls++;Do.channel(Channel.value,State.calls);}export function onSignal(sender:i32,n:f64,subject:i32):void{}`]]),{ asLineCeiling: 10 });
  const script = built.rows[0], blob = built.blobs[0];if (script === undefined || blob === undefined) throw new Error('Missing original program');
  const v1 = parseSpawnScript({ ...original,script,bytes: btoa(String.fromCodePoint(...blob.bytes)) });
  const modern = await compileSimV2(`import * as ws from './sdk/as/wsV2';export function onBinding():void{assert(ws.fieldPresent(0)&&ws.fieldPresent(1)&&!ws.fieldPresent(2));if(ws.field(0)==2&&ws.state(0)==0)ws.actorCommand(2,ws.self(),1,ws.player(),0);ws.setState(0,ws.state(0)+1);ws.actorCommand(13,0,1,ws.field(0)+ws.field(1),0);}`,{ io: 2048,ioBytes: layout.bytes });
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(modern)))).map(byte => byte.toString(16).padStart(2,'0')).join('');
  return { v1,v2: parseSpawnScript({ ...v1,v2: { version: 1,artifact: { abi: 2,minor: SCRIPT_V2_REVISIONS.minor,compilerRevision: SCRIPT_V2_REVISIONS.compiler,admissionRevision: SCRIPT_V2_REVISIONS.admission,hash,lane: 'sim',pages: 1,ioBytes: layout.bytes },bytes: btoa(String.fromCodePoint(...modern)),io: 2048,capacities,divisor: 6,fuel: 100000,initFuel: 10000,self: 'main',columns: [{ name: 'grass',id: 2,source: { kind: 'grass',at: 'self' } }] } }) };
}
async function fixture() {
  compiled ??= programs();const rows = await compiled;
  const rapier = await loadRapier(Uint8Array.from(fixtureBytes(new URL('../public/assets/physics/rapier.wasm',import.meta.url))));
  const sample = SIM_LEVEL.entities[0];if (sample === undefined) throw new Error('Missing native recipe');
  const host = createSimHost({ ...SIM_LEVEL,quests: [],entities: [{ ...sample,spec: { ...sample.spec,kind: 'boar',variant: 'plain' } }] },{ rapier });
  const native = host.entities.get(sample.id);if (native === undefined) throw new Error('Missing concrete body');
  const motor = native.motor;if (motor !== null && !(motor instanceof CharacterMotor)) throw new Error('Expected original native motor');
  const body = legacyDouble<Animal>(Object.assign(native,{ motor,mesh: new SkinnedMesh() }));
  const environment = new PageWildEnvironment();environment.grassHeightAt = (x,z) => x+z;body.position.set(3,2,4);
  const animals = legacyDouble<AnimalManager>({ animals: [body] }), owners = { scope: host.scope,environment };
  return { host,body,rows,animals,owners };
}
test('production PAGE SpawnScript executes compiled v2 on the SAME adopted native body and staged authority', async () => {
  const f = await fixture();try {
    const runner = SpawnScript.page(f.animals,f.rows.v2,f.host.physics,f.owners);runner.adopt('main',f.body.entityId);
    const bodies = [...f.host.entities], rng = f.host.rng.snapshot();runner.frame({ x: 90,y: 2,z: 100 },0,{ engaged: 1 });
    for (let tick = 1; tick <= 6; tick++) runner.advanceFrame(1/60);
    expect(runner.channel(1)).toBe(0);expect(runner.host.snapshot().staged).toHaveLength(1);
    runner.advanceFrame(1/60);expect(runner.channel(1)).toBe(8);expect(runner.body('main')).toBe(f.body);expect(f.animals.animals[0]).toBe(f.body);
    expect([...f.host.entities]).toEqual(bodies);expect(f.host.rng.snapshot()).toEqual(rng);expect(runner.failure).toBeNull();
    expect(() => runner.observe({ grass: 7 })).toThrow('Duplicate');
  } finally { f.host.dispose(); }
});
test('old SpawnScript saves migrate pending inputs at their old tick and v2 re-saves are byte-exact', async () => {
  const f = await fixture();try {
    const old = SpawnScript.page(f.animals,f.rows.v1,f.host.physics);for (let i = 0; i < 5; i++) old.advance(1/60,{ x: 0,y: 0,z: 0 },0,1,[]);
    old.signal('main',9);const saved = old.snapshot();old.restore(saved);expect(old.snapshot()).toBe(saved);
    const modern = SpawnScript.page(f.animals,f.rows.v2,f.host.physics,f.owners);modern.restore(saved);
    const restored = v.parse(v.object({ v2Input: SpawnInputV2Schema }),JSON.parse(modern.snapshot()));expect(restored.v2Input.input.events.map(row => row.atTick)).toEqual([5,5]);
    const v2Save = modern.snapshot(), instantiate = vi.spyOn(WebAssembly,'Instance');
    try { modern.prepareRestore(v2Save)();expect(modern.snapshot()).toBe(v2Save);expect(instantiate).not.toHaveBeenCalled(); } finally { instantiate.mockRestore(); }
    modern.frame({ x: 0,y: 0,z: 0 },0,{ engaged: 1 });modern.advanceFrame(2/60);expect(modern.channel(1)).toBe(1);
  } finally { f.host.dispose(); }
});
test('ABI2 simulation metadata survives exact named-product contract reconstruction', async () => {
  compiled ??= programs();const { v2 } = await compiled;if (v2.v2 === undefined) throw new Error('Missing production selection');
  const rows = scriptAdmissionRows(new Map([['actors/spawn-scripts',[{ ...v2,bytes: '',v2: { ...v2.v2,bytes: '' } }]]]));
  const hash = v2.v2.artifact.hash;
  const files = [{ kind: 'wasm',hash: v2.script.module.slice(11,-5),path: v2.script.module },{ kind: 'wasm',hash,path: `blobs/wasm/${hash}.wasm` }];
  expect(decisionModuleContracts(rows,files).get(hash)).toMatchObject({ abi: 2,lane: 'sim',ioBytes: layout.bytes });
  expect(() => decisionModuleContracts(rows,files.slice(0,1))).toThrow('exact declared');
});

test('an observe-only slot leaves a native Stalker mid-tell across interrupt, quiet restore and entry disposal', async () => {
  const f = await fixture(), scope = new Scope('observe');
  try {
    const brain = new StalkerBrain({ pattern: 'pouncer',spec: pouncer.spec,ports: { player: f.host.player,lair: { x: 3,z: 4 },ledges: [],heightAt: () => 0,phase2: () => false,awareRadius: 30,isHead: () => false,
      ring: { setTime: () => undefined,ring: () => undefined,hide: () => undefined },hurt: () => undefined,knock: () => undefined,opened: () => undefined,growl: () => undefined,signature: () => undefined } });
    brain.restore({ st: 'tell',stT: .2,cd: 1,from: [3,2,4],to: [9,0,12],goal: null,hitDone: 0 });
    f.body.scripted = false;f.body.herd = 4;f.body.setMotion(.7,2,1);f.body.startAttack(.8);
    const body = f.body.snapshot(), native = brain.snapshot(), rng = f.host.rng.snapshot();
    const rows = parseSpawnScript({ ...f.rows.v2,slots: [{ id: 'main',handle: 1,authority: 'observe' }] });
    const runner = SpawnScript.page(f.animals,rows,f.host.physics,{ ...f.owners,scope });runner.adopt('main',f.body.entityId);
    runner.frame({ x: 90,y: 2,z: 100 },0,{ engaged: 1 });runner.advanceFrame(7/60);
    const saved = runner.snapshot();runner.interrupt();runner.prepareRestore(saved)();
    expect(f.body.snapshot()).toEqual(body);expect(brain.snapshot()).toEqual(native);expect(f.host.rng.snapshot()).toEqual(rng);
    expect(() => runner.retire('main')).toThrow('Read-only');expect(() => runner.activate('boar',0)).toThrow('Invalid lifecycle');
    scope.dispose();expect(() => runner.advanceFrame(1/60)).toThrow('Retired');
    expect(f.body.snapshot()).toEqual(body);expect(brain.snapshot()).toEqual(native);expect(f.host.rng.snapshot()).toEqual(rng);
  } finally { scope.dispose();f.host.dispose(); }
});

test('compiled v2 strike commands retain the native contact kernel and consume a hit once', async () => {
  const f = await fixture();try {
    const runner = SpawnScript.page(f.animals,f.rows.v2,f.host.physics,f.owners);runner.adopt('main',f.body.entityId);
    f.host.player.position.copy(f.body.position);f.host.player.position.z += 1;
    runner.frame(f.host.player.position,0,{ engaged: 2 });
    const hits = [];
    for (let tick = 1; tick <= 30; tick++) { runner.advanceFrame(1/60);hits.push(...runner.drainEffects().filter(row => row.kind === 'hit')); }
    expect(hits).toHaveLength(1);expect(hits[0]).toMatchObject({ kind: 'hit',actor: 1,hit: { damage: 7,tags: ['cover.checked'] } });
    const saved = runner.snapshot();runner.prepareRestore(saved)();
    for (let tick = 31; tick <= 60; tick++) { runner.advanceFrame(1/60);expect(runner.drainEffects().filter(row => row.kind === 'hit')).toEqual([]); }
    expect(runner.failure).toBeNull();
  } finally { f.host.dispose(); }
});
