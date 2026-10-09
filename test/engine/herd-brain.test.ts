import { afterAll, afterEach, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash complete replay frames from the actual shipping group without retaining large arrays.
import { createHash } from 'node:crypto';
import { HerdBrain, type HerdPorts } from '../../src/engine/ai/herd';
import { Animal } from '../../src/engine/entities/AnimalView';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import type { CharacterMotor } from '../../src/engine/physics/CharacterMotor';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { app } from '../../src/engine/app/runtime';
import { Rng } from '../../src/engine/core/rng';
import { HorseHerd, Pack } from '../../src/shards/nalati-grasslands/runtime/groupRegistry';
import { HorseHerd as ShippingHorseHerd } from '../fixtures/nalati-group-oracle/herd';
import { declaredGroupFactories } from '../../src/shards/nalati-grasslands/runtime/groupDeclared';
import { APP_GROUP_HOST } from '../../src/shards/nalati-grasslands/runtime/groupHost';
import { wildEnv, playerVisibility, downwindOf, hearingRadius } from '../../src/shards/nalati-grasslands/creatures/env';
import { NALATI_STRIKES, sampleStrike } from '../../src/shards/nalati-grasslands/combat/strikes';
import { NALATI_HERD_BRAIN } from '../../src/shards/nalati-grasslands/data/brains';
import { creature } from '../fake/creature';
import { legacyDouble } from '../fake/FakeGame';

const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100, streamAt: () => null });
afterAll(restoreTerrain);
const originalEnv = { ...wildEnv };
afterEach(() => { Object.assign(wildEnv, originalEnv); });
function fixture(platform: boolean | 'bound', restoring = false): { policy: ShippingHorseHerd | HerdBrain<Animal>; members: Animal[]; context: ReturnType<typeof creature>['ctx']; events: unknown[]; ports: HerdPorts<Animal>;
  construction: { beforeRng: ReturnType<Rng['snapshot']>; afterRng: ReturnType<Rng['snapshot']>; beforeMemory: Record<string, number>[]; afterMemory: Record<string, number>[] } } {
  app.rng.seed(357);
  const f = creature('crab', 'small'), factory = new AnimalFactory(f.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } }), model = factory.model('crab', 'small');
  const events: unknown[] = [];
  const members = Array.from({ length: 5 }, (_, i) => {
    const actor = new Animal(factory.instantiate(model, i / 10), model, i / 10, i === 2 ? 0.6 : 1, `herd.${String(i)}`);
    actor.kind = 'horse'; actor.variant = i === 0 ? 'stallion' : i === 2 ? 'foal-bay' : 'bay'; actor.position.set((i - 2) * 3, 0, 0);
    actor.motor = legacyDouble<CharacterMotor>({ move: (feet, want) => { feet.x += want.x; feet.z += want.z;
      return { grounded: true, groundNormalY: 1, downhillX: 0, downhillZ: 0, horizontalFreedom: 1, groundCollider: null }; }, dispose: () => undefined,
      passThrough: groups => { events.push(['filter', actor.entityId, groups]); } }); return actor;
  });
  wildEnv.onEvent = (event, x, z) => { events.push([event, x, z]); };
  wildEnv.onKnockdown = (x, z, strength) => { events.push(['knockdown', x, z, strength]); };
  const ports: HerdPorts<Animal> = {
    sharedRng: () => app.rng.stream('ai'), environment: () => wildEnv, visibility: playerVisibility,
    hearing: (radii, player, speed) => hearingRadius([...radii], player, speed), downwind: downwindOf,
    inBounds: (x, z, margin) => Math.abs(x) <= 250 - margin && Math.abs(z) <= 250 - margin, normalY: () => 1,
    passThrough: (actor, player) => { actor.motor?.passThrough(player ? ['PLAYER'] : []); },
    chargeContact: (actor, _context, radius) => { sampleStrike(NALATI_STRIKES.stallion, actor, f.ctx.player, () => { f.ctx.hurt(actor.mods.chargeDamage); },
      { shape: { kind: 'point', radius, exclusive: true }, reach: () => f.ctx.reach(actor) }); },
    scarePack: (actor, radius) => { const pack = Pack.of(actor); if (pack === null) return false; pack.scare(actor.position.x, actor.position.z, radius); return true; },
    onEvent: (event, x, z) => { wildEnv.onEvent?.(event, x, z); }, onKnockdown: (x, z, strength) => { wildEnv.onKnockdown?.(x, z, strength); },
  };
  const beforeRng = app.rng.stream('ai').snapshot(), beforeMemory = members.map(actor => ({ ...actor.mem }));
  const policy = platform === 'bound' ? declaredGroupFactories({ preyIdentity: () => 'prey.none', resolvePrey: () => null,
    resolveActor: id => members.find(actor => actor.entityId === id) ?? null }, APP_GROUP_HOST).herd(members)
    : platform ? new HerdBrain(members, NALATI_HERD_BRAIN, ports) : new ShippingHorseHerd(members);
  if (!(policy instanceof HerdBrain) && !(policy instanceof ShippingHorseHerd)) throw new Error('Missing fixture policy');
  const construction = { beforeRng, afterRng: app.rng.stream('ai').snapshot(), beforeMemory, afterMemory: members.map(actor => ({ ...actor.mem })) };
  if (policy instanceof HerdBrain && platform !== 'bound' && !restoring) policy.initialize();
  f.ctx.rng = new Rng(357); f.ctx.herd = members;
  f.ctx.hurt = damage => { events.push(['damage', damage]); }; f.ctx.sound = cue => { events.push(['cue', cue]); };
  f.ctx.confine = actor => { actor.position.x = Math.max(-220, Math.min(220, actor.position.x)); actor.position.z = Math.max(-220, Math.min(220, actor.position.z)); };
  policy.onStallionState = (guardState: string) => { events.push(['guard', guardState]); }; policy.onBeaten = (actor: Animal) => { events.push(['beaten', actor.entityId]); };
  policy.onFlight = (stampede: boolean) => { events.push(['flight', stampede]); };
  return { policy, members, context: f.ctx, events, ports, construction };
}
const stateKeys = ['mode', 'stampeding', 'stallionState', 'trust', 'alert', 'alertOwned', 'cx', 'cz', 'spotX', 'spotZ', 'spotT', 'fleeX', 'fleeZ', 'fleeRun', 'fleeLen', 'fleeFromX', 'fleeFromZ', 'modeT', 'sT', 'chargeCd', 'beatenT', 'beaten', 'knockCd'] as const;
function state(policy: ShippingHorseHerd | HerdBrain<Animal>): unknown[] {
  return stateKeys.map(key => { const value: unknown = Reflect.get(policy, key); if (!['number', 'string', 'boolean'].includes(typeof value)) throw new Error(`Missing group state ${key}`); return value; });
}
function step(f: ReturnType<typeof fixture>, tick: number, scenario: 'senses' | 'stampede' | 'guard' | 'taming'): void {
  const c = f.context; c.t = tick / 60; c.dt = 0.1;
  c.player.set(tick < 600 || tick > 4500 ? 150 : f.policy.cx, 0, tick < 600 || tick > 4500 ? 150 : f.policy.cz + 8);
  c.playerSpeed = scenario === 'guard' ? 0 : 3;
  c.calm = scenario === 'guard'; wildEnv.playerMounted = false; wildEnv.playerCrouched = false;
  const guard = f.policy.stallion; if (guard === null) throw new Error('Missing guard');
  if (scenario === 'guard' && tick >= 600 && tick <= 4500) c.player.set(guard.position.x, 0, guard.position.z + 8);
  if (scenario === 'guard' && tick === 600) { guard.mem['aw'] = 0.6; c.calm = false; }
  if (scenario === 'stampede' && tick === 1200) f.policy.stampede(f.policy.cx, f.policy.cz - 8);
  if (scenario === 'taming') {
    if (tick === 300) f.policy.addTrust(65);
    if (tick === 600) { f.policy.alertOwned = true; f.policy.alert = 25; }
    if (tick === 1200) f.policy.setRidden(guard);
    if (tick === 1800) f.policy.setRidden(null);
    if (tick === 2200) guard.hp = guard.maxHp * 0.24;
    if (tick === 2400) f.policy.leadAway(f.policy.cx, f.policy.cz - 5);
  }
  if (tick % 6 === 0) for (const actor of f.members) if (actor.alive) { f.policy.tick(c); f.policy.drive(actor, c); }
  for (const actor of f.members) { if (actor.alive) f.policy.drive(actor, { ...c, dt: 1 / 60 }, true); actor.step(1 / 60); }
}
function replay(platform: boolean | 'bound', scenario: Parameters<typeof step>[2]): { hash: string; modes: string[]; guards: string[]; rng: ReturnType<typeof app.rng.snapshot>; actorRng: ReturnType<Rng['snapshot']> } {
  const f = fixture(platform), hash = createHash('sha256'), modes = new Set<string>(), guards = new Set<string>();
  for (let tick = 0; tick < 10000; tick++) { step(f, tick, scenario); modes.add(f.policy.mode); guards.add(f.policy.stallionState);
    hash.update(JSON.stringify([state(f.policy), f.members.map(actor => actor.snapshot()), f.events])); f.events.length = 0; }
  return { hash: hash.digest('hex'), modes: [...modes], guards: [...guards], rng: app.rng.snapshot(), actorRng: f.context.rng.snapshot() };
}
describe('declared guarded-herd family', () => {
  it('binds riding, taming and an adopted elite into the same declared herd without extra setup', () => {
    const bound = fixture('bound');
    for (const actor of bound.members) expect(HorseHerd.of(actor)).toBe(bound.policy);
    const elite = creature('crab', 'small').animal, before = app.rng.snapshot();
    bound.policy.adoptStallion(elite); expect(HorseHerd.of(elite)).toBe(bound.policy);
    for (const actor of bound.members) expect(HorseHerd.of(actor)).toBe(bound.policy); expect(app.rng.snapshot()).toEqual(before);
    bound.policy.setRidden(elite); expect(bound.policy.ridden).toBe(elite); expect(elite.mem['ridden']).toBe(1);
    bound.policy.setRidden(null); bound.policy.addTrust(35); expect(bound.policy.trust).toBe(35);
  });
  it('keeps constructors pure and initializes the shipping timer exactly once after preflight', () => {
    const native = fixture(false), expectedRng = app.rng.stream('ai').snapshot();
    const platform = fixture(true), policy = platform.policy; if (!(policy instanceof HerdBrain)) throw new Error('Missing platform herd');
    expect(platform.construction.afterRng).toEqual(platform.construction.beforeRng);
    expect(platform.construction.afterMemory).toEqual(platform.construction.beforeMemory);
    expect(app.rng.stream('ai').snapshot()).toEqual(expectedRng); expect(state(platform.policy)).toEqual(state(native.policy));
    expect(() => { policy.initialize(); }).toThrow('already initialized');
    expect(app.rng.stream('ai').snapshot()).toEqual(expectedRng);
  });
  it.each(['senses', 'stampede', 'guard', 'taming'] as const)('matches the actual shipping boids, guard, contact/filter recipes and RNG for 10,000 fixed ticks: %s', scenario => {
    const actual = replay(true, scenario); expect(actual).toEqual(replay(false, scenario)); expect(replay('bound', scenario)).toEqual(actual);
    if (scenario === 'stampede') for (const mode of ['flee', 'settle', 'graze']) expect(actual.modes).toContain(mode);
    if (scenario === 'taming') for (const guard of ['ridden', 'beaten', 'watch']) expect(actual.guards).toContain(guard);
    if (scenario === 'guard') for (const guard of ['watch', 'warn', 'display', 'charge', 'wheel']) expect(actual.guards).toContain(guard);
  });
  it('restores flight, mothers and taming state without callbacks or RNG, then matches a 10,000-tick suffix', () => {
    const before = fixture(true); if (!(before.policy instanceof HerdBrain)) throw new Error('Missing platform herd');
    for (let tick = 0; tick < 1300; tick++) step(before, tick, 'stampede'); before.events.length = 0;
    const saved = before.policy.snapshot(), actors = before.members.map(actor => actor.snapshot()), rng = app.rng.snapshot(), actorRng = before.context.rng.snapshot();
    const expected = createHash('sha256');
    for (let tick = 1300; tick < 11300; tick++) { step(before, tick, 'stampede'); expected.update(JSON.stringify([before.policy.snapshot(), before.members.map(actor => actor.snapshot()), before.events])); before.events.length = 0; }
    const after = fixture(true, true); if (!(after.policy instanceof HerdBrain)) throw new Error('Missing platform herd');
    after.members.forEach((actor, i) => { const data = actors[i]; if (data === undefined) throw new Error('Missing actor'); actor.restore(data); });
    app.rng.restore(rng); after.context.rng.restore(actorRng); after.policy.restore(saved);
    expect(app.rng.snapshot()).toEqual(rng); expect(after.events).toEqual([]);
    const actual = createHash('sha256');
    for (let tick = 1300; tick < 11300; tick++) { step(after, tick, 'stampede'); actual.update(JSON.stringify([after.policy.snapshot(), after.members.map(actor => actor.snapshot()), after.events])); after.events.length = 0; }
    expect(actual.digest('hex')).toBe(expected.digest('hex'));
  });
});
