import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Events } from '../src/engine/events/events';
import { Scope } from '../src/engine/app/scope';
import { FlockBrain } from '../src/engine/ai/flock';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import type { ShardContext } from '../src/game/plugin/context';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import { installCombatTargets, type CombatTargetOwner } from '../src/game/shardfile/clientTargets';
import { CrowdRoster, CrowdTargets, CrowdWeaponTarget, type ForagerTargets } from '../src/game/shardfile/crowdRuntime';
import type { RayTargets } from '../src/engine/combat/targets';
import type { TargetHit } from '../src/engine/combat/types';
import type { AimTarget } from '../src/engine/player/AimTargets';
import rows from '../src/shards/nalati-grasslands/data/combatTargets.json' with { type: 'json' };


function fixture() {
  const scope = new Scope('target-page'), events = new Events();
  const ctx = { scope, app: { events } };
  return { scope, events, ctx };
}
function hit(distance: number): TargetHit {
  return { distance, point: new Vector3(0, 0, distance), headshot: false,
    animal: { kind: 'fixture', position: new Vector3(), alive: true, damageFor: () => 1, applyDamage: () => true } };
}
function request(previous: TargetHit | null = null): RayTargets {
  return { origin: new Vector3(), dir: new Vector3(0, 0, 1), maxDist: 20, hit: previous };
}

test('actual world rows refine prior/wildlife -> night -> arena in the same order and retain aim identity', () => {
  const f = fixture(), calls: string[] = [], previous = hit(19), wild = hit(15), nightHit = hit(10), arenaHit = hit(4);
  const heart: AimTarget = { alive: true, position: new Vector3(2, 3, 4) };
  const night = { target: (_origin: Vector3, _direction: Vector3, _maximum: number, incoming: TargetHit | null): TargetHit => { calls.push('night'); expect(incoming).toBe(wild); return nightHit; } };
  const arena = { target: (_origin: Vector3, _direction: Vector3, _maximum: number, incoming: TargetHit | null): TargetHit => { calls.push('arena'); expect(incoming).toBe(nightHit); return arenaHit; }, lockTarget: () => heart };
  f.events.answer('combat.targets.ray', value => { calls.push('wildlife'); expect(value.hit).toBe(previous); return { ...value, hit: wild }; }, f.scope);
  const { requires: _requires, ...ray } = rows.ray;
  installCombatTargets(f.ctx, { ...rows, ray }, new Map<string, CombatTargetOwner>([['night', night], ['titan', arena]]));
  const input = request(previous), output = f.events.ask('combat.targets.ray', input);
  expect(calls).toEqual(['wildlife', 'night', 'arena']); expect(output.hit).toBe(arenaHit); expect(output).not.toBe(input); expect(input.hit).toBe(previous);
  const plain: AimTarget = { alive: true, position: new Vector3() };
  const visible = { ...plain, mem: { hidden: 0, owned: 0 } }, nonObject = { ...plain, mem: 1 }, nullable = { ...plain, mem: null };
  const list = [plain, visible, { ...plain, mem: { hidden: 1 } }, { ...plain, mem: { owned: 1 } }, nonObject, nullable];
  expect(f.events.ask('combat.aimTargets', list)).toEqual([plain, visible, nonObject, nullable, heart]);
  expect(list).toHaveLength(6); f.scope.dispose();
});

test('wildlife readiness keeps the ray bank idle and does not gate original aim projection', () => {
  const f = fixture(), target = vi.fn(() => null), lockTarget = vi.fn(() => null);
  installCombatTargets(f.ctx, rows, new Map<string, CombatTargetOwner>([['night', { target }], ['titan', { target, lockTarget }]]), { wildlife: null });
  const input = request(hit(2)); expect(f.events.ask('combat.targets.ray', input)).toEqual(input); expect(target).not.toHaveBeenCalled();
  f.events.ask('combat.aimTargets', []); expect(lockTarget).toHaveBeenCalledOnce(); f.scope.dispose();
});

test('crowd rows keep the native CrowdRoster/CrowdWeaponTarget and in-place request law', () => {
  const f = fixture(), target = new CrowdWeaponTarget(new CrowdRoster<ForagerTargets>([], []), { kind: 'fixture', damage: 1 });
  const raycast = vi.spyOn(target, 'raycast');
  installCombatTargets(f.ctx, { ray: { result: 'in-place', sources: ['crowd.0'] } }, new Map([['crowd.0', target]]));
  const input = request(hit(3)); expect(f.events.ask('combat.targets.ray', input)).toBe(input); expect(input.hit?.distance).toBe(3); expect(raycast).toHaveBeenCalledOnce();
  f.scope.dispose();
});

test('whole suffix admission refuses before any event registration or native call', () => {
  const f = fixture(), target = vi.fn(() => null), owners = new Map<string, CombatTargetOwner>([['night', { target }]]);
  for (const input of [rows, { ray: { sources: ['night', 'night'], result: 'copy' } }, { aim: { exclude: [], append: ['night'] } },
    { ray: { sources: ['night'], result: 'copy', callback: target } }, { ray: { sources: ['night'], result: 'unknown' } }]) {
    expect(() => installCombatTargets(f.ctx, input, owners)).toThrow(); expect(f.events.census().answerers).toBe(0);
  }
  const getter = vi.fn(() => rows.ray), input = Object.defineProperty({}, 'ray', { enumerable: true, get: getter });
  expect(() => installCombatTargets(f.ctx, input, owners)).toThrow(); expect(getter).not.toHaveBeenCalled(); expect(target).not.toHaveBeenCalled(); f.scope.dispose();
});

test('replaced owner or callable refuses the complete bank before the first target call', () => {
  const f = fixture(), first = vi.fn(() => null), second = { target: vi.fn(() => null) }, owners = new Map<string, CombatTargetOwner>([['first', { target: first }], ['second', second]]);
  installCombatTargets(f.ctx, { ray: { result: 'copy', sources: ['first', 'second'] } }, owners);
  const original = second.target; second.target = vi.fn(() => null);
  expect(() => f.events.ask('combat.targets.ray', request())).toThrow('owner left or changed'); expect(first).not.toHaveBeenCalled();
  second.target = original; owners.set('second', { target: original });
  expect(() => f.events.ask('combat.targets.ray', request())).toThrow('owner left or changed'); expect(first).not.toHaveBeenCalled(); f.scope.dispose();
});

test('a native earlier call cannot replace the suffix callable before its effect', () => {
  const f = fixture(), original = vi.fn(() => null), second = { target: original }, replacement = vi.fn(() => null);
  const first = { target: (): null => { second.target = replacement; return null; } };
  installCombatTargets(f.ctx, { ray: { result: 'copy', sources: ['first', 'second'] } }, new Map([['first', first], ['second', second]]));
  expect(() => f.events.ask('combat.targets.ray', request())).toThrow('owner left or changed'); expect(original).not.toHaveBeenCalled(); expect(replacement).not.toHaveBeenCalled(); f.scope.dispose();
});

test('scope disposal removes both reducers; sliced ancestors refuse new publication', () => {
  const f = fixture(), target = vi.fn(() => null), lockTarget = vi.fn(() => null);
  installCombatTargets(f.ctx, { ray: { result: 'copy', sources: ['source'] }, aim: { exclude: [], append: ['source'] } }, new Map([['source', { target, lockTarget }]]));
  f.events.ask('combat.targets.ray', request()); expect(target).toHaveBeenCalledTimes(1);
  f.scope.dispose(); f.events.ask('combat.targets.ray', request()); expect(target).toHaveBeenCalledTimes(1);
  expect(f.events.census().answerers).toBe(0);
  const g = fixture(), steps = g.scope.disposeSteps(); steps.next();
  expect(() => installCombatTargets(g.ctx, { ray: { result: 'copy', sources: [] } }, new Map())).toThrow('owner left or changed');
  for (const step of steps) expect(step.scope).toBe('target-page');
});

test('a real native crowd hit retains its exact pending member through the row chain', () => {
  const brain = new FlockBrain({ heightAt: () => 0, normalY: () => 1, inBounds: () => true, wetAt: () => false,
    playerCrouched: () => false, grassHeightAt: () => 0, trample: () => undefined, centre: () => undefined },
  { x: 0, z: 0, count: 1, seed: 19, range: 25, runSpeed: 6, walkSpeed: 1.2, grazeStep: .3, bleatCue: 'deer.call' });
  brain.initialize();
  const crowd = new CrowdTargets(brain, { preyY: 1.4, hits: [[0, 1.4, .65]] });
  const owner = new CrowdWeaponTarget(new CrowdRoster([], [crowd]), { kind: 'deer', damage: 31 }), f = fixture();
  installCombatTargets(f.ctx, { ray: { result: 'in-place', sources: ['deer'] } }, new Map([['deer', owner]]));
  const point = crowd.positions(0, new Vector3()), input = { origin: point.clone().add(new Vector3(0, 0, -2)), dir: new Vector3(0, 0, 1), maxDist: 4, hit: null };
  const output = f.events.ask('combat.targets.ray', input); expect(output).toBe(input);
  if (output.hit === null) throw new Error('Missing native crowd hit');
  expect(output.hit.animal.damageFor(false, 2)).toBe(31);
  output.hit.animal.applyDamage(1, output.hit.point, input.dir); expect(crowd.alive).toBe(0); f.scope.dispose();
});

test('retained entry replay parks and restores the same native bank without duplicate handlers', () => {
  const f = fixture(), target = vi.fn(() => null);
  const base = legacyDouble<ShardContext>({ scope: f.scope, app: legacyDouble<ShardContext['app']>({ events: f.events,
    input: legacyDouble<ShardContext['app']['input']>({ refresh: () => undefined, repaint: () => undefined }) }) });
  const hooks = new RetainedRuntimeHooks(base);
  installCombatTargets(hooks.context, { ray: { result: 'copy', sources: ['source'] } }, new Map([['source', { target }]]));
  f.events.ask('combat.targets.ray', request()); expect(target).toHaveBeenCalledTimes(1);
  hooks.deactivate(); f.events.ask('combat.targets.ray', request()); expect(target).toHaveBeenCalledTimes(1);
  hooks.activate(); f.events.ask('combat.targets.ray', request()); expect(target).toHaveBeenCalledTimes(2);
  expect(f.events.census().answerers).toBe(1); f.scope.dispose(); expect(f.events.census().answerers).toBe(0);
});
