import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline, type Actor, type DamageRequest } from '../src/engine/combat/pipeline';

function actor(id: string): Actor {
  const attributes = { health: 20, maxHealth: 20, damageTakenMul: .5 };
  return { id, tags: ['actor.creature'], state: [], attributes,
    get alive() { return attributes.health > 0; },
    applyDamage: hit => { attributes.health = Math.max(0, attributes.health - hit.amount); return attributes.health === 0; } };
}
function request(target: Actor, amount: number): DamageRequest {
  return { source: 'env', sourceTags: ['dmg.melee'], target, amount, point: new Vector3(), dir: new Vector3(0, 0, 1) };
}

test('exact-target routing returns real damage/death and leaves world events and unrelated actors alone', () => {
  const worldScope = new Scope('world'), bout = worldScope.child('bout');
  const worldEvents = new Events(), localEvents = new Events();
  const world = new CombatPipeline(worldEvents, worldScope), local = new CombatPipeline(localEvents, bout);
  const practice = actor('practice'), unrelated = actor('world');
  let worldHits = 0, worldDeaths = 0, localDeaths = 0;
  worldEvents.on('damage.dealt', () => { worldHits++; }, worldScope);
  worldEvents.on('actor.died', () => { worldDeaths++; }, worldScope);
  localEvents.on('actor.died', () => { localDeaths++; }, bout);
  world.routeTarget(bout, practice, input => local.hit(input));
  expect(() => world.routeTarget(bout, practice, input => local.hit(input))).toThrow('already');
  expect(world.hit(request(practice, 10))?.dealt).toBe(5);
  expect(practice.attributes.health).toBe(15);
  expect(world.hit(request(practice, 30))?.killed).toBe(true);
  worldEvents.flush('update'); localEvents.flush('update');
  expect([worldHits, worldDeaths, localDeaths]).toEqual([0, 0, 1]);
  expect(world.hit(request(practice, 10))).toBeNull();
  expect(world.hit(request(unrelated, 4))?.dealt).toBe(2);
  worldEvents.flush('update'); expect(worldHits).toBe(1);
  worldScope.dispose();
});

test('disposing a bout removes only its route and rejects retired route owners', () => {
  const scope = new Scope('world'), bout = scope.child('bout'), events = new Events();
  const combat = new CombatPipeline(events, scope), target = actor('target');
  let calls = 0;
  combat.routeTarget(bout, target, () => { calls++; return null; });
  expect(combat.hit(request(target, 4))).toBeNull(); expect(calls).toBe(1);
  bout.dispose();
  expect(combat.hit(request(target, 4))?.dealt).toBe(2); expect(calls).toBe(1);
  expect(() => combat.routeTarget(bout, target, () => null)).toThrow('retired');
  scope.dispose();
});
