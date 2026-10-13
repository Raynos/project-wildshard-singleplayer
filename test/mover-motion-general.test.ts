import { beforeAll, describe, expect, it } from 'vitest';
import { AnimationClip, Euler, Group, LinearInterpolant, Quaternion, QuaternionKeyframeTrack, QuaternionLinearInterpolant, VectorKeyframeTrack } from 'three';
import { Mover } from '../src/sdk/movers';
import { compileMoverDriver } from '../src/sdk/compileMovers';
import { MOVER_DRIVER_MODULES } from '../src/format/moverMotion';
import { parseMovers } from '../src/format/movers';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { tagOf } from '../src/engine/physics/surface';
import { MoverScriptDriver, MoverRuntime } from '../src/game/plugin/mover';
import { installMoverFixture as installHeadlessMovers, type FixtureMovers as HeadlessMovers } from './fixtures/mover-installation';
import { createShardfileComposedLane } from '../src/game/shardfile/scriptComposition';
import { compileScript } from '../src/sdk/compileScript';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { parseShardfile, shardfileRules } from '@wildshard/format/shardSchema';
import empty from './fixtures/shardfile/empty.json';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

let rapier: Awaited<ReturnType<typeof loadRapier>>, bytes: Uint8Array;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); bytes = await compileMoverDriver('clip'); });
const modules = () => new Map([[MOVER_DRIVER_MODULES.clip, bytes]]);
const level = { ...SIM_LEVEL, entities: [], player: { ...SIM_LEVEL.player, at: { x: 12, y: 0, z: 12 } } };
const rest = { id: 'fixture.clip', entity: 8020, kind: 'platform' as const, at: { x: 0, y: 2, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true,
  boxes: [{ x: 0, y: -0.5, z: 0, hx: 2, hy: 0.5, hz: 2, rot: { x: 0, y: 0, z: 0, w: 1 } }] };
const body = new Group(); body.name = rest.id;
const position = new VectorKeyframeTrack(`${body.name}.position`, [0, 0.5, 1.5, 2], [0, 2, 0, 1, 3, 0, 2, 4, 1, 0, 2, 0]);
const rotations = [0, 0.4, -0.2, 0].flatMap(angle => new Quaternion().setFromEuler(new Euler(angle, angle / 2, angle / 3, 'YXZ')).toArray());
const quaternion = new QuaternionKeyframeTrack(`${body.name}.quaternion`, [0, 0.5, 1.5, 2], rotations);
const clip = new AnimationClip('moving-platform', 2, [position, quaternion]);
const always = { kind: 'always' } as const;
const row = (loop: 'once' | 'repeat' | 'pingpong' = 'repeat', trigger: Mover['options']['trigger'] = always) => new Mover(body, { clip, loop, trigger, driver: { kind: 'track' } }).toMoverData(rest);
const install = (host: SimHost, rows: ReturnType<typeof parseMovers>, restoring = false, sharedState?: (id: number) => number | boolean | undefined) => installHeadlessMovers(host, rows, modules(), { systemId: 'fixture.movers', restoring, ...(sharedState === undefined ? {} : { sharedState }) });

describe('general fixed mover channels', () => {
  it('reads both real channels, bounds the union of keys and refuses independently changed executable inputs', () => {
    const data = row(); expect(data.track?.times).toEqual([0, 0.5, 1.5, 2]); expect(data.track?.quaternion).toHaveLength(4);
    expect(parseMovers([data])[0]?.trigger).toEqual({ kind: 'always' });
    expect(() => parseMovers([{ ...data, input: [] }])).toThrow('ABI disagree');
    expect(() => new Mover(body, { clip: new AnimationClip('too-many', 11, [new VectorKeyframeTrack(`${body.name}.position`, Array.from({ length: 12 }, (_, i) => i), Array.from({ length: 36 }, (_, i) => i % 3))]), trigger: { kind: 'always' }, driver: { kind: 'track' } }).toMoverData(rest)).toThrow();
    expect(() => new Mover(body, { ...new Mover(body, { clip, trigger: { kind: 'always' }, driver: { kind: 'track' } }).options, clip: new AnimationClip('duplicates', 2, [position, position]) }).toMotionData()).toThrow('once');
  });

  it.each(['once', 'repeat', 'pingpong'] as const)('matches real three.js position/quaternion interpolation and restores the complete %s continuation', loop => {
    const data = row(loop), host = createSimHost(level, { rapier }), movers = install(host, [data]);
    const vector = new LinearInterpolant(position.times, position.values, 3, new Float64Array(3));
    const rotation = new QuaternionLinearInterpolant(quaternion.times, quaternion.values, 4, new Float64Array(4));
    let restored: SimHost | undefined;
    try {
      for (let tick = 1; tick <= 600; tick++) {
        host.step();
        const t = tick / 60, phase = loop === 'once' ? Math.min(t / 2, 1) : loop === 'repeat' ? t % 2 / 2 : t % 4 / 4;
        const time = (loop === 'pingpong' ? phase < 0.5 ? phase * 2 : (1 - phase) * 2 : phase) * 2;
        const p = vector.evaluate(time), q = rotation.evaluate(time), expected = new Euler().setFromQuaternion(new Quaternion().fromArray(q), 'YXZ');
        const actual = movers.runtime.pose(data.id); const [px, py, pz] = p; if (px === undefined || py === undefined || pz === undefined) throw new Error('Missing sample');
        expect(Math.max(Math.abs(actual.position.x - px), Math.abs(actual.position.y - py), Math.abs(actual.position.z - pz))).toBeLessThan(1e-9);
        expect(Math.max(Math.abs(actual.euler.x - expected.x), Math.abs(actual.euler.y - expected.y), Math.abs(actual.euler.z - expected.z))).toBeLessThan(3e-7);
        if (tick === 377) { const saved = snapshotSimHost(host); restored = restoreSimHost(level, { rapier }, saved, h => { install(h, [data], true); }); expect(snapshotSimHost(restored)).toEqual(saved); }
        else if (tick > 377 && restored !== undefined) { restored.step(); if (tick === 400 || tick === 600) expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(host)); }
      }
      expect(movers.failures()).toBe(0);
    } finally { restored?.dispose(); host.dispose(); }
  });

  it('uses the actual grounded owner and continuous stand delay, freezes on leaving, and refuses absent authority before allocating', () => {
    const still = new AnimationClip('standing', 2, [new VectorKeyframeTrack(`${body.name}.position`, [0, 2], [0, 2, 0, 0, 2, 0])]);
    const data = new Mover(body, { clip: still, loop: 'repeat', trigger: { kind: 'stand', delay: 0.2 }, driver: { kind: 'track' } }).toMoverData(rest);
    const onDeck = { ...level, player: { ...level.player, at: { x: 0, y: 2.02, z: 0 } } }, host = createSimHost(onDeck, { rapier });
    let movers: HeadlessMovers | undefined;
    try {
      const before = host.physics.world.bodies.len();
      expect(() => installHeadlessMovers(host, [data], modules(), { systemId: 'refused', restoring: false, activation: false })).toThrow('real player ground');
      expect(host.physics.world.bodies.len()).toBe(before);
      movers = install(host, [data]);
      for (let i = 0; i < 10; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      expect(host.player.motor.result.grounded).toBe(true); const collider = host.player.motor.result.groundCollider; if (collider === null) throw new Error('Missing actual contact'); expect(tagOf(collider)?.owner).toBe(data.id);
      expect(movers.runtime.scriptInput(data.id, host.state.tick)[10]).toBe(0);
      for (let i = 0; i < 30; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      expect(movers.runtime.scriptInput(data.id, host.state.tick)[10]).toBeGreaterThan(0);
      host.player.position.set(12, 0.02, 12); host.player.motor.resetAt(host.player.position); host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      const phase = movers.runtime.scriptInput(data.id, host.state.tick)[10]; for (let i = 0; i < 30; i++) host.step({ moveX: 0, moveZ: 0, yaw: 0 });
      expect(movers.runtime.scriptInput(data.id, host.state.tick)[10]).toBe(phase); expect(movers.failures()).toBe(0);
    } finally { host.dispose(); }
  });

  it('reads real composed shared state in one host, retains every clock on restore and rejects missing or mistyped fields', async () => {
    const data = row('repeat', { kind: 'shared', field: 101, equals: 1 });
    const numeric = await compileScript(`export function abi_version():i32{return 0;} export function init(lo:i32,hi:i32):void{}
export function in_ptr():i32{return 16384;} export function in_cap():i32{return 4096;} export function out_ptr():i32{return 24576;} export function out_cap():i32{return 1;} export function out_count():i32{return 1;}
export function on_tick():void{store<f64>(24576,5);store<f64>(24584,101);store<f64>(24592,1);store<f64>(24600,0);store<f64>(24608,0);}`, { maximumPages: 1 });
    const hash = hashImmutableBytes(numeric), host = createSimHost(level, { rapier }), driver = new MoverScriptDriver([data], () => []);
    let runtime: MoverRuntime | undefined;
    const lane = createShardfileComposedLane({ identity: { seed: 1 }, sim: { scripts: [hash, data.module], scriptTickDivisor: 1, bindings: [{ module: hash, entity: 2001, actorId: 'player', kind: 'server' }] }, state: { shared: [{ id: 101, name: 'switch', type: 'i32', privacy: 'public', default: 0 }], player: [] } }, new Map([...modules(), [hash, numeric]]), {
      rules: { fields: {}, archetypes: [], events: [], maxEntities: 2 }, entities: [{ id: 2001, name: 'player', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }], actors: new Map([[2001, 'player']]), query: () => [],
    }, undefined, { roles: [driver.role()], schedules: [driver.schedule(() => { if (runtime === undefined) throw new Error('Missing runtime'); return runtime; })] });
    try {
      const ports = { host: lane.host, physics: () => host.physics, scope: host.scope };
      expect(() => new MoverRuntime([data], ports)).toThrow('typed host field');
      expect(() => new MoverRuntime([data], { ...ports, activation: { shared: () => true } })).toThrow('typed host field');
      runtime = new MoverRuntime([data], { ...ports, activation: { shared: () => { const value = lane.world.view('player').shared['switch']; return typeof value === 'number' ? value : undefined; } } });
      for (let tick = 1; tick <= 100; tick++) { expect(lane.step(tick).every(call => call.ok)).toBe(true); host.physics.step(); }
      expect(runtime.pose(data.id).position.x).toBeGreaterThan(0); const saved = lane.snapshot(); lane.restore(saved); expect(lane.snapshot()).toBe(saved);
      expect(runtime.scriptInput(data.id, 101)[4]).toBe(1);
    } finally { host.dispose(); }
  });

  it('gates interaction start/stop/restart by the declared permission without changing the clock on refusal', () => {
    const data = row('repeat', { kind: 'interact', permission: 3 }), host = createSimHost(level, { rapier });
    let permission = 0;
    const movers = installHeadlessMovers(host, [data], modules(), { systemId: 'fixture.movers', restoring: false, permissions: () => new Map([[data.id, permission]]) });
    try {
      movers.runtime.command(data.id, 1); host.step(); expect(movers.runtime.scriptInput(data.id, 1)[10]).toBe(0);
      permission = 3; movers.runtime.command(data.id, 1); for (let i = 0; i < 30; i++) host.step();
      expect(movers.runtime.scriptInput(data.id, 31)[10]).toBeGreaterThan(0);
      movers.runtime.command(data.id, 2); host.step(); const paused = movers.runtime.scriptInput(data.id, 32)[10];
      for (let i = 0; i < 20; i++) host.step(); expect(movers.runtime.scriptInput(data.id, 52)[10]).toBe(paused);
      movers.runtime.command(data.id, 3); host.step(); expect(movers.runtime.scriptInput(data.id, 53)[10]).toBe(1 / 120);
      expect(movers.failures()).toBe(0);
    } finally { host.dispose(); }
  });

  it('requires the shared trigger to reference an admitted shared field of the exact declared type', () => {
    const base = parseShardfile(empty), data = row('repeat', { kind: 'shared', field: 101, equals: 1 });
    const issue = 'mover trigger requires an admitted numeric or boolean shared field';
    expect(shardfileRules({ ...base, movers: [data] })).toContain(issue);
    const field = { id: 101, name: 'switch', type: 'i32' as const, privacy: 'host' as const, default: 0 };
    expect(shardfileRules({ ...base, movers: [data], state: { ...base.state, shared: [field] } })).not.toContain(issue);
    expect(shardfileRules({ ...base, movers: [data], state: { ...base.state, player: [field] } })).toContain(issue);
    expect(shardfileRules({ ...base, movers: [data], state: { ...base.state, shared: [{ ...field, type: 'bool', default: false }] } })).toContain(issue);
  });

  it.each(['x', 'y', 'z'] as const)('runs a bounded %s pendulum on the same guest clock and replays every pose', axis => {
    const data = new Mover(body, { trigger: { kind: 'always' }, driver: { kind: 'pendulum', axis, amplitude: 0.4, period: 2 } }).toMoverData(rest);
    const host = createSimHost(level, { rapier }), movers = install(host, [data]);
    try {
      for (let tick = 1; tick <= 600; tick++) { host.step(); const pose = movers.runtime.pose(data.id); expect(Math.abs(pose.euler[axis] - 0.4 * Math.sin(tick / 60 * Math.PI))).toBeLessThan(1e-9); }
      expect(movers.failures()).toBe(0);
    } finally { host.dispose(); }
  });
});
