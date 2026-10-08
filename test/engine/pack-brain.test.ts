import { afterAll, afterEach, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash every complete frame of the real shipping oracle without retaining large trace arrays.
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { PackBrain, type PackPorts } from '../../src/engine/ai/pack';
import { Animal } from '../../src/engine/entities/AnimalView';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { app } from '../../src/engine/app/runtime';
import { Rng } from '../../src/engine/core/rng';
import { Pack, type PackController } from '../../src/shards/nalati-grasslands/runtime/groupRegistry';
import { Pack as ShippingPack } from '../fixtures/nalati-group-oracle/pack';
import { declaredGroupFactories } from '../../src/shards/nalati-grasslands/runtime/groupDeclared';
import { wildEnv, playerVisibility, downwindOf, hearingRadius } from '../../src/shards/nalati-grasslands/creatures/env';
import { NALATI_STRIKES, sampleStrike } from '../../src/shards/nalati-grasslands/combat/strikes';
import { NALATI_PACK_BRAIN } from '../../src/shards/nalati-grasslands/data/brains';
import { creature } from '../fake/creature';

const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(restoreTerrain);
const originalEnv = { ...wildEnv };
afterEach(() => { Object.assign(wildEnv, originalEnv); });
function fixture(platform: boolean | 'bound', restoring = false): {
  policy: PackController | PackBrain<Animal>; members: Animal[]; context: ReturnType<typeof creature>['ctx'];
  events: unknown[]; prey: { position: Vector3; yaw: number; alive: boolean; applyDamage: () => boolean };
  ports: PackPorts<Animal>;
  construction: { beforeRng: ReturnType<Rng['snapshot']>; afterRng: ReturnType<Rng['snapshot']>; beforeMemory: Record<string, number>[]; afterMemory: Record<string, number>[] };
} {
  app.rng.seed(357);
  const f = creature('crab', 'small'), factory = new AnimalFactory(f.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const model = factory.model('crab', 'small');
  const members = Array.from({ length: 4 }, (_, i) => {
    const actor = new Animal(factory.instantiate(model, i / 10), model, i / 10, 1, `pack.${String(i)}`);
    actor.kind = 'wolf'; actor.variant = i === 0 ? 'alpha' : 'grey'; actor.position.set((i - 2) * 2, 0, -5); return actor;
  });
  const events: unknown[] = [];
  const prey = { position: new Vector3(0, 0, 8), yaw: 0, alive: true, applyDamage: (): boolean => { events.push('prey-contact'); return false; } };
  wildEnv.onEvent = (event, x, z) => { events.push([event, x, z]); };
  const ports: PackPorts<Animal> = {
    sharedRng: () => app.rng.stream('ai'), environment: () => wildEnv, visibility: playerVisibility,
    hearing: (radii, player, speed) => hearingRadius([...radii], player, speed), downwind: downwindOf,
    inBounds: (x, z, margin) => Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin, normalY: () => 1,
    register: (actor, director) => { app.aggression.register(actor, director); },
    bite: (actor, context, radius) => { sampleStrike(NALATI_STRIKES.wolf, actor, context.player, () => { f.ctx.hurt(actor.mods.chargeDamage); },
      { shape: { kind: 'point', radius, exclusive: true }, reach: () => f.ctx.reach(actor) }); },
    onEvent: (event, x, z) => { wildEnv.onEvent?.(event, x, z); },
    preyIdentity: value => { if (value !== prey) throw new Error('Unknown prey'); return 'sheep.0'; }, resolvePrey: id => id === 'sheep.0' ? prey : null,
  };
  const beforeRng = app.rng.stream('ai').snapshot(), beforeMemory = members.map(actor => ({ ...actor.mem }));
  const policy = platform === 'bound' ? declaredGroupFactories({ preyIdentity: value => { if (value !== prey) throw new Error('Unknown prey'); return 'sheep.0'; },
    resolvePrey: id => id === 'sheep.0' ? prey : null, resolveActor: id => members.find(actor => actor.entityId === id) ?? null }).pack(members, 0, 0)
    : platform ? new PackBrain(members, 0, 0, NALATI_PACK_BRAIN, ports) : new ShippingPack(members, 0, 0);
  const construction = { beforeRng, afterRng: app.rng.stream('ai').snapshot(), beforeMemory, afterMemory: members.map(actor => ({ ...actor.mem })) };
  if (policy instanceof PackBrain && platform !== 'bound' && !restoring) policy.initialize();
  f.ctx.rng = new Rng(357); f.ctx.herd = members;
  f.ctx.confine = actor => { actor.position.x = Math.max(-220, Math.min(220, actor.position.x)); actor.position.z = Math.max(-220, Math.min(220, actor.position.z)); };
  f.ctx.claim = actor => app.events.ask('ai.claim', actor);
  f.ctx.hurt = damage => { events.push(['damage', damage]); }; f.ctx.sound = cue => { events.push(['cue', cue]); };
  return { policy, members, context: f.ctx, events, prey, ports, construction };
}
const stateKeys = ['phase', 'awareness', 'homeX', 'homeZ', 'phaseT', 'roamX', 'roamZ', 'roamT', 'nextTokenT', 'boldT', 'calmT', 'hpStart', 'halfDone', 'deadSeen', 'shadowDur', 'howled', 'bites', 'scared'] as const;
function state(policy: PackController | PackBrain<Animal>): unknown[] {
  return stateKeys.map(key => { const value: unknown = Reflect.get(policy, key); if (!['number', 'string', 'boolean'].includes(typeof value)) throw new Error(`Missing group state ${key}`); return value; });
}
function step(f: ReturnType<typeof fixture>, tick: number, scenario: 'senses' | 'raid' | 'regroup' | 'mounted'): void {
  const c = f.context; c.t = tick / 60; c.dt = 0.1;
  const cx = f.members.reduce((sum, actor) => sum + actor.position.x, 0) / f.members.length;
  const cz = f.members.reduce((sum, actor) => sum + actor.position.z, 0) / f.members.length;
  c.player.set(tick < 60 ? 90 : tick < 4500 ? cx : 100, 0, tick < 60 ? 90 : tick < 4500 ? cz + 8 : 100);
  c.playerSpeed = tick < 4000 ? 3 : 0;
  wildEnv.playerMounted = scenario === 'mounted'; wildEnv.playerHealth01 = tick > 2400 ? 0.4 : 1;
  wildEnv.playerFwdX = Math.sin(tick / 600); wildEnv.playerFwdZ = Math.cos(tick / 600);
  if (scenario === 'raid' && tick === 300) f.policy.raid(f.prey);
  if (scenario === 'raid' && tick === 1800) f.prey.alive = false;
  const flank = f.members[1]; if (flank === undefined) throw new Error('Missing flank');
  if (scenario === 'regroup' && tick === 1200) flank.alive = false;
  if (tick === 2400) flank.lastHitT = c.t;
  if (tick === 4002) f.policy.scare(cx, cz, 500);
  if (tick % 6 === 0) for (const actor of f.members) if (actor.alive) { f.policy.tick(c); f.policy.drive(actor, c); c.confine(actor); }
  const body = { ...c, dt: 1 / 60 };
  for (const actor of f.members) { if (actor.alive) { f.policy.drive(actor, body, true); c.confine(actor); } actor.step(1 / 60); }
}
function replay(platform: boolean | 'bound', scenario: Parameters<typeof step>[2]): { hash: string; phases: string[]; groupRng: ReturnType<typeof app.rng.snapshot>; actorRng: ReturnType<Rng['snapshot']> } {
  const f = fixture(platform), hash = createHash('sha256'), phases = new Set<string>();
  for (let tick = 0; tick < 10000; tick++) {
    step(f, tick, scenario); phases.add(f.policy.phase);
    hash.update(JSON.stringify([state(f.policy), f.members.map(actor => actor.snapshot()), f.events])); f.events.length = 0;
  }
  return { hash: hash.digest('hex'), phases: [...phases], groupRng: app.rng.snapshot(), actorRng: f.context.rng.snapshot() };
}
describe('declared pack family', () => {
  it('binds the declared pack into the shipping species/prey/raid registry once', () => {
    const bound = fixture('bound');
    for (const actor of bound.members) expect(Pack.of(actor)).toBe(bound.policy);
    const before = app.rng.snapshot(); Pack.register(bound.policy);
    for (const actor of bound.members) expect(Pack.of(actor)).toBe(bound.policy); expect(app.rng.snapshot()).toEqual(before);
    expect(bound.policy.raid(bound.prey)).toBe(true);
  });
  it('keeps constructors pure and performs exactly the shipping setup draws and member writes once', () => {
    const native = fixture(false), expectedRng = app.rng.stream('ai').snapshot();
    const platform = fixture(true), policy = platform.policy; if (!(policy instanceof PackBrain)) throw new Error('Missing platform brain');
    expect(platform.construction.afterRng).toEqual(platform.construction.beforeRng);
    expect(platform.construction.afterMemory).toEqual(platform.construction.beforeMemory);
    expect(app.rng.stream('ai').snapshot()).toEqual(expectedRng);
    expect(platform.members.map(actor => actor.mem)).toEqual(native.members.map(actor => actor.mem));
    expect(() => { policy.initialize(); }).toThrow('already initialized');
    expect(app.rng.stream('ai').snapshot()).toEqual(expectedRng);
  });
  it.each(['senses', 'raid', 'regroup', 'mounted'] as const)('matches the actual shipping group, body, strikes and RNG for 10,000 fixed ticks: %s', scenario => {
    const actual = replay(true, scenario); expect(actual).toEqual(replay(false, scenario)); expect(replay('bound', scenario)).toEqual(actual);
    for (const phase of ['roam', 'shadow', 'encircle', 'break']) expect(actual.phases).toContain(phase);
    if (scenario === 'regroup') expect(actual.phases).toContain('regroup');
  });
  it('restores pending prey, group timers and token holders without consuming RNG, then matches a 10,000 tick suffix', () => {
    const before = fixture(true); if (!(before.policy instanceof PackBrain)) throw new Error('Missing platform brain');
    for (let tick = 0; tick < 1900; tick++) step(before, tick, 'mounted');
    before.policy.prey = before.prey;
    before.events.length = 0;
    const saved = before.policy.snapshot(), actors = before.members.map(actor => actor.snapshot()), groupRng = app.rng.snapshot(), actorRng = before.context.rng.snapshot();
    const expected = createHash('sha256');
    for (let tick = 1900; tick < 11900; tick++) { step(before, tick, 'mounted'); expected.update(JSON.stringify([before.policy.snapshot(), before.members.map(actor => actor.snapshot()), before.events])); before.events.length = 0; }
    const after = fixture(true, true); if (!(after.policy instanceof PackBrain)) throw new Error('Missing platform brain');
    after.members.forEach((actor, i) => { const data = actors[i]; if (data === undefined) throw new Error('Missing actor'); actor.restore(data); });
    app.rng.restore(groupRng); after.context.rng.restore(actorRng);
    after.policy.restore(saved); expect(app.rng.snapshot()).toEqual(groupRng);
    const actual = createHash('sha256');
    for (let tick = 1900; tick < 11900; tick++) { step(after, tick, 'mounted'); actual.update(JSON.stringify([after.policy.snapshot(), after.members.map(actor => actor.snapshot()), after.events])); after.events.length = 0; }
    expect(actual.digest('hex')).toBe(expected.digest('hex'));
  });
  it('refuses incompatible tuning and unresolved prey atomically', () => {
    const f = fixture(true); if (!(f.policy instanceof PackBrain)) throw new Error('Missing platform brain');
    const policy = f.policy; policy.prey = f.prey; const saved = policy.snapshot();
    const forged: unknown = JSON.parse(saved);
    if (typeof forged !== 'object' || forged === null) throw new Error('Invalid fixture');
    Reflect.set(forged, 'prey', 'missing'); expect(() => { policy.restore(JSON.stringify(forged)); }).toThrow();
    expect(policy.snapshot()).toBe(saved);
    expect(() => new PackBrain(f.members, 0, 0, { ...NALATI_PACK_BRAIN, runSpeed: Number.NaN }, f.ports)).toThrow('parameters');
  });
});
