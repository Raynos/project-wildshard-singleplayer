// oxlint-disable-next-line import/no-nodejs-modules -- The actual host consumes the shipped native physics bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { compileScript } from '../src/sdk/compileScript';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseDecisionScripts } from '../src/format/decisionScripts';
import { parseActorMoves } from '../src/format/actorMoves';
import { scriptV1Layout } from '../src/format/scriptAbiV1';
import { createShardfileSim, bindShardfileSim, type ShardfileSimulation } from '../src/game/plugin/simulation';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { DecisionModule } from '../src/engine/script/decisionModule';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const rapier = loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
const io = scriptV1Layout(1, 0), state = 16384 + io.state * 8, out = 16384 + io.outbox * 8;
let bytes: Uint8Array = new Uint8Array(), refused: Uint8Array = new Uint8Array();
function command(at: number, op: number, target: number, a: number, b: number): string {
  return [op, target, a, b, 0].map((value, slot) => `store<f64>(${out + (at * 5 + slot) * 8},${value});`).join('');
}
function module(body: string) { return compileScript(`@external("env","ws_list") declare function list(op:i32,a:f64,b:f64,out:i32,cap:i32):i32; export function ws_abi():i32{return 1;} export function ws_init(lo:i32,hi:i32):void{} export function ws_io():i32{return 16384;} export function ws_handle():i32 { if(load<f64>(${state})>0)return 0;store<f64>(${state},1);${body}}`, { abi: 1 }); }
beforeAll(async () => {
  bytes = await module(`${command(0, 1, 1, 1, 2)}${command(1, 2, 1, 1, 2)}${command(2, 4, 1, 89, 1)}${command(3, 7, 0, 1, 1)}return 4;`);
  refused = await module(`${command(0, 1, 1, 1, 2)}${command(1, 4, 1, 89, 99)}return 2;`);
});
function fixture(wasm = bytes, binding?: { shard: true } | { encounter: string }) {
  const source = emptyShardfile({ slug: 'decision-sim', name: 'Decision Sim', author: 'Test', seed: 2, revision: 1 });
  const native = SIM_LEVEL.entities[0]; if (native === undefined) throw new Error('Missing creature fixture');
  source.rows.species = [{ id: 'boar', kind: 'boar', label: 'Boar', aggressive: false, lockable: true, dims: structuredClone(native.spec.dims),
    variants: [{ id: 'boar', label: 'Boar', rarity: 'common', weight: 1, scale: [1, 1], hp: 100, mods: structuredClone(native.spec.mods) }] }];
  source.rows.strikes = [{ id: 'bump', shape: { kind: 'sphere', radius: 3 }, windup: 0.02, active: 0.05, recover: 0.02, cooldown: 0.02, range: 3, damage: 7, tags: ['dmg.melee'], weight: 1, speed: 0 }];
  source.creatures.spawns = ['actor.a', 'actor.b'].map((id, index) => ({ id, species: 'boar', variant: 'boar', brain: null, strike: null, seed: index + 1, scale: 1, at: [0, 0, 5 + index * 2], yaw: 0 }));
  source.encounters = ['actor.a', 'actor.b'].map((entity, index) => ({ id: `encounter.${index}`, entity, kind: 'boss', panel: null, name: entity, title: 'Test', retry: 'Retry', arena: { at: [0, 0, 6], radius: 20 }, intro: 0, introShort: 0, respawn: { at: [0, 0, 0], yaw: 0 }, phases: [{ at: 1, name: 'Fight', caption: 'Fight', speed: 0, stopDistance: 0, turnRate: 2 }] }));
  source.state.shared = [{ id: 89, name: 'phase', type: 'i32', privacy: 'public', default: 0, min: 0, max: 3 }];
  source.quests.flags = ['done'];
  const moves = parseActorMoves([{ id: 'approach', kind: 'stalk', speed: 1, turn: 2, ground: true, altitude: 0, standOff: 0, ready: { kind: 'band', tolerance: 0.05 } }]);
  const hash = hashImmutableBytes(wasm), scripts = parseDecisionScripts([{ id: 'controller', abi: '1.0', side: 'sim', module: `blobs/wasm/${hash}.wasm`, source: 'behaviour/controller.as', binding: binding ?? { shard: true }, onFail: 'hold',
    on: ['start', 'move.done', 'strike.done', 'hit', 'death'], reads: [], commands: ['move', 'strike', 'field', 'flag'], stateVersion: 1, state: [{ name: 'calls', type: 'i32', default: 0, scope: 'binding' }], params: {},
    actors: { a: 'actor.a', b: 'actor.b' }, moves: { approach: 'approach' }, strikes: { bump: 'bump' }, fields: { phase: 'phase' }, flags: { done: 'done' } }]);
  const sections = new Map<string, unknown>([['sim/scripts', scripts], ['actors/moves', moves]]), assets = new Map([[hash, wasm]]);
  return { source, assets, sections, scripts, options: { sections } };
}

test('two actors execute rows on the real fixed-step move, strike, field and flag owners', async () => {
  const f = fixture(), sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: await rapier });
  try {
    for (let i = 0; i < 6; i++) sim.host.step();
    expect(sim.decisions?.host.state(1)).toEqual({ calls: 0 }); expect(sim.host.flags.has('done')).toBe(false);
    sim.host.step(); expect(sim.decisions?.host.state(1)).toEqual({ calls: 1 }); expect(sim.host.flags.has('done')).toBe(true);
    expect(sim.decisions?.publication().fields).toContainEqual({ actor: 1, field: 89, value: 1 });
    expect(sim.decisions?.publication().events.map(row => row.kind)).toEqual(['move', 'strike']);
    for (let i = 0; i < 30; i++) sim.host.step();
    expect(sim.host.entities.get('actor.b')?.hp).toBe(93);
    expect(sim.host.entities.get('actor.a')?.position.z).toBeGreaterThan(5);
    expect(sim.decisions?.host.metrics()[0]?.refusals).toBe(0);
  } finally { sim.dispose(); }
});

test('a bad last command refuses motion and world fields together with proposed script state', async () => {
  const f = fixture(refused), sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: await rapier });
  try {
    for (let i = 0; i < 8; i++) sim.host.step();
    expect(sim.decisions?.host.state(1)).toEqual({ calls: 0 }); expect(sim.decisions?.host.metrics()[0]?.refusals).toBe(1);
    expect(sim.decisions?.publication().fields).toContainEqual({ actor: 1, field: 89, value: 0 });
    expect(sim.host.entities.get('actor.a')?.position.z).toBe(5); expect(sim.host.flags.has('done')).toBe(false);
  } finally { sim.dispose(); }
});

test('fresh-host restore retains a staged strike catalogue and logical decision without Wasm during restore', async () => {
  const f = fixture(), R = await rapier, sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: R });
  let resumed: ShardfileSimulation | undefined;
  try {
    for (let i = 0; i < 6; i++) sim.host.step();
    const saved = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier: R }, saved, host => { resumed = bindShardfileSim(host, f.source, f.assets, { ...f.options, rapier: R, restoring: true }); });
    const invoke = vi.spyOn(DecisionModule.prototype, 'invoke');
    try { const adapter = restored.adapters.get('decision.declared'); const value = adapter?.snapshot(); if (adapter === undefined || value === undefined) throw new Error('Missing adapter'); adapter.restore(value); expect(invoke).not.toHaveBeenCalled(); }
    finally { invoke.mockRestore(); }
    for (let i = 0; i < 30; i++) { sim.host.step(); restored.step(); }
    expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(sim.host));
  } finally { sim.dispose(); resumed?.dispose(); }
});

test('SDK worker executes the declared v1 section and reports its real fuel rather than admitting it as v0', async () => {
  const { HeadlessSimulation } = await import('../src/sdk/headless');
  const { nameBlob } = await import('../src/sdk/blobs');
  const { mergeProjectBlobs } = await import('../src/sdk/projectOutput');
  const f = fixture(); f.source.budgets.sim.resident = 1_000_000;
  const blob = nameBlob('behaviour/controller.wasm', 'wasm', bytes, { script: { abi: 1, pages: 1 }, critical: true });
  const product = mergeProjectBlobs(f.source, new Map(), [blob]);
  const session = await HeadlessSimulation.create(product.shard, product.assets, undefined, { deadline: 'advisory', sections: f.sections });
  try {
    for (let i = 0; i < 5; i++) await session.step();
    const staged = await session.step(); expect(staged.fuelUsed).toBeGreaterThan(0);
    const committed = await session.step(); expect(committed.fuelUsed).toBe(0);
    expect(session.quarantined).toBe(false);
    expect(committed.snapshot).toContain('decision.declared');
    expect(committed.decisions?.fields).toContainEqual({ actor: 1, field: 89, value: 1 });
    expect(committed.decisions?.events.map(row => row.kind)).toEqual(['move', 'strike']);
  } finally { await session.dispose(); }
});

test('encounter bindings sleep until the real fight starts and retain inactive checkpoint state', async () => {
  const f = fixture(bytes, { encounter: 'encounter.0' }), R = await rapier;
  const sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: R });
  let resumed: ShardfileSimulation | undefined;
  try {
    const snapshot = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier: R }, snapshot, host => { resumed = bindShardfileSim(host, f.source, f.assets, { ...f.options, rapier: R, restoring: true }); });
    expect(sim.decisions?.host.metrics()[0]?.calls).toBe(0);
    expect(resumed?.decisions?.host.snapshot()).toEqual(sim.decisions?.host.snapshot());
    for (let i = 0; i < 7; i++) { sim.host.step(); restored.step(); }
    expect(sim.decisions?.host.state(1)).toEqual({ calls: 1 });
    expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(sim.host));
  } finally { sim.dispose(); resumed?.dispose(); }
});

test('forged auxiliary restore refuses before changing the logical decision or public fields', async () => {
  const f = fixture(), sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: await rapier });
  try {
    for (let i = 0; i < 7; i++) sim.host.step();
    const adapter = sim.host.adapters.get('decision.declared'); if (adapter === undefined) throw new Error('Missing adapter');
    const before = adapter.snapshot(); if (typeof before !== 'string') throw new Error('Missing logical string');
    const forged: unknown = JSON.parse(before);
    if (typeof forged !== 'object' || forged === null) throw new Error('Missing parsed state');
    Reflect.set(forged, 'fields', [[1, 89, 99]]);
    expect(() => adapter.restore(JSON.stringify(forged))).toThrow('field bounds');
    expect(adapter.snapshot()).toBe(before);
  } finally { sim.dispose(); }
});

test('ground queries use the authoritative height and failure reset uses the existing encounter owner', async () => {
  const ground = await module(`if(list(3,0,0,32768,1)!=1 || load<f64>(32768)!=0)unreachable();return 0;`);
  const f = fixture(ground), row = f.scripts[0]; if (row === undefined) throw new Error('Missing script'); row.reads = ['groundHeight'];
  const sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: await rapier });
  try { for (let i = 0; i < 7; i++) sim.host.step(); expect(sim.decisions?.host.state(1)).toEqual({ calls: 1 }); expect(sim.decisions?.host.metrics()[0]?.refusals).toBe(0); }
  finally { sim.dispose(); }
  const reset = fixture(refused, { encounter: 'encounter.0' }), script = reset.scripts[0]; if (script === undefined) throw new Error('Missing script'); script.onFail = 'reset';
  const notices: string[] = [], native = createShardfileSim(reset.source, reset.assets, { ...reset.options, rapier: await rapier, scriptDisabled: event => { notices.push(event.reason); } });
  try {
    for (let i = 1; i <= 18; i++) { if (i === 8 || i === 14) native.decisions?.host.enqueue(1, [1, 0, 0, 0, 0, 0]); native.host.step(); }
    expect(native.decisions?.host.metrics()[0]).toMatchObject({ refusals: 3, disabled: true });
    expect(native.encounters.get('encounter.0')?.boss.state).toBe('armed'); expect(notices).toHaveLength(1);
  } finally { native.dispose(); }
});

test('a v1 boss does not consume an unrelated legacy interaction prompt', async () => {
  const f = fixture();
  f.source.targets.interactions = [{ id: 'button', scene: 'button', label: 'Button', radius: 8, at: [f.source.spawn.x, f.source.spawn.y + 1.62, f.source.spawn.z + 1] }];
  const sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: await rapier });
  try { expect(sim.selectedInteraction()).toBe('button'); expect(() => sim.interact('button')).toThrow('Interaction requires an admitted scene lane'); }
  finally { sim.dispose(); }
});

test('stop cancels movement and windup without cutting an already active strike', async () => {
  const wasm = await compileScript(`export function ws_abi():i32{return 1;} export function ws_init(lo:i32,hi:i32):void{} export function ws_io():i32{return 16384;}
  export function ws_handle():i32 { let count=load<f64>(${state});store<f64>(${state},count+1);if(count==0){${command(0, 2, 1, 1, 2)}return 1;}if(count==1){${command(0, 3, 1, 0, 0)}return 1;}return 0;}`, { abi: 1 });
  const f = fixture(wasm), script = f.scripts[0], strike = f.source.rows.strikes[0]; if (script === undefined || strike === undefined) throw new Error('Missing stop fixture');
  script.on.push('tick'); script.tick = 10; script.commands.push('stop'); strike.active = 0.5;
  const sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: await rapier });
  try {
    for (let i = 0; i < 13; i++) sim.host.step();
    expect(sim.decisions?.host.state(1)).toEqual({ calls: 2 });
    expect(sim.host.strikes.get('actor.a')?.state).toBe('active');
    expect(sim.host.entities.get('actor.b')?.hp).toBe(93);
  } finally { sim.dispose(); }
});

test('a staged orbit samples its starting pose at commit, including fresh-host continuation', async () => {
  const f = fixture();
  f.sections.set('actors/moves', parseActorMoves([{ id: 'approach', kind: 'orbit', center: [0, 0], r: 10, y: 0, speed: 1, turn: 2, ground: true }]));
  const R = await rapier, sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: R }); let resumed: ShardfileSimulation | undefined;
  try {
    sim.host.entities.get('actor.a')?.setMotion(0, 2);
    for (let i = 0; i < 6; i++) sim.host.step();
    const saved = snapshotSimHost(sim.host);
    const restored = restoreSimHost(sim.host.level, { rapier: R }, saved, host => { resumed = bindShardfileSim(host, f.source, f.assets, { ...f.options, rapier: R, restoring: true }); });
    for (let i = 0; i < 20; i++) { sim.host.step(); restored.step(); }
    expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(sim.host));
  } finally { sim.dispose(); resumed?.dispose(); }
});

test('activation delivers the real player handle even without a start subscription', async () => {
  const f = fixture(), row = f.scripts[0]; if (row === undefined) throw new Error('Missing join fixture'); row.on = ['player.join'];
  const sim = createShardfileSim(f.source, f.assets, { ...f.options, rapier: await rapier });
  try {
    expect(sim.decisions?.host.snapshot().bindings[0]?.pending[0]).toEqual([15, 0x7fffffff, 0, 0, 0, 0]);
    for (let i = 0; i < 7; i++) sim.host.step();
    expect(sim.decisions?.host.state(1)).toEqual({ calls: 1 });
  } finally { sim.dispose(); }
});
