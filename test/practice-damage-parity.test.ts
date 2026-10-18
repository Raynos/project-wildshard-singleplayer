import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline, type Actor, type DamageRequest } from '../src/engine/combat/pipeline';
import { sweptMoveDamage } from '../src/engine/combat/sweptMeleeCore';
import { bindBorrowedGuard } from '../src/game/shardfile/borrowedGuard';
import { heavyMult } from '../src/shards/driftwood-isle-legacy/loot/perks';

function body(id: string): Actor {
  const attributes = { health: 1000, maxHealth: 1000, damageTakenMul: .8 };
  return { id, tags: ['actor.creature'], state: [], attributes,
    get alive() { return attributes.health > 0; },
    damageMul: req => req.dir.z < 0 ? .5 : 1,
    applyDamage: req => { attributes.health = Math.max(0, attributes.health - req.amount); return attributes.health === 0; } };
}
function request(target: Actor, amount: number, headshot = false): DamageRequest {
  return { source: 'env', sourceTags: ['dmg.melee'], target, amount, headshot,
    point: new Vector3(), dir: new Vector3(0, 0, -1) };
}

for (const heavy of [false, true]) for (const headshot of [false, true]) {
  test(`routed ${heavy ? 'heavy' : 'light'} preserves weapon/perk formula and body guards (headshot ${headshot})`, () => {
    const scope = new Scope('parity'), bout = scope.child('bout');
    const worldEvents = new Events(), localEvents = new Events();
    const world = new CombatPipeline(worldEvents, scope), local = new CombatPipeline(localEvents, bout);
    const ordinary = body('ordinary'), practice = body('practice');
    const memory = { window: 1 }, guard = { field: 'window', activeValue: 1, multiplier: .2 };
    bindBorrowedGuard(worldEvents, scope, ordinary, memory, guard);
    bindBorrowedGuard(localEvents, bout, practice, memory, guard);
    world.routeTarget(bout, practice, input => local.hit(input));
    const perk = heavyMult({ has: id => id === 'bear-claw' });
    const move = { windup: .1, slashEnd: .3, total: .5, damage: 2 };
    const amount = sweptMoveDamage(12, move, heavy, perk);
    expect(amount).toBe(24 * (heavy ? perk : 1));
    for (const window of [1, 0, 1]) {
      memory.window = window;
      const expected = world.hit(request(ordinary, amount, headshot));
      const actual = world.hit(request(practice, amount, headshot));
      expect(actual?.dealt).toBe(expected?.dealt);
      expect(practice.attributes.health).toBe(ordinary.attributes.health);
    }
    scope.dispose();
  });
}

test('practice exposure is applied once and its damage/death events remain local', () => {
  const scope = new Scope('world'), bout = scope.child('bout');
  const worldEvents = new Events(), localEvents = new Events();
  const world = new CombatPipeline(worldEvents, scope), local = new CombatPipeline(localEvents, bout);
  const target = body('practice'); target.attributes.health = 10;
  const counts = { worldDamage: 0, worldDeath: 0, localDamage: 0, localDeath: 0 };
  worldEvents.on('damage.dealt', () => { counts.worldDamage++; }, scope);
  worldEvents.on('actor.died', () => { counts.worldDeath++; }, scope);
  localEvents.on('damage.dealt', () => { counts.localDamage++; }, bout);
  localEvents.on('actor.died', () => { counts.localDeath++; }, bout);
  bindBorrowedGuard(localEvents, bout, target, { core: 1 }, { field: 'core', activeValue: 1, multiplier: 1.5 });
  world.routeTarget(bout, target, input => local.hit(input));
  expect(world.hit(request(target, 20))?.dealt).toBe(12);
  worldEvents.flush('update'); localEvents.flush('update');
  expect(counts).toEqual({ worldDamage: 0, worldDeath: 0, localDamage: 1, localDeath: 1 });
  scope.dispose();
});

// Deliberate limitation: arbitrary world callbacks/rules are not inherited. A future effect must be admitted
// as bout-owned data before claiming parity; copying world listeners could mutate quests or persistent rewards.
test('arbitrary world modifiers remain unsupported rather than leaking into the isolated encounter', () => {
  const scope = new Scope('world'), bout = scope.child('bout');
  const world = new CombatPipeline(new Events(), scope), local = new CombatPipeline(new Events(), bout);
  const ordinary = body('ordinary'), practice = body('practice');
  world.rule({ id: 'world-only', order: 100, when: {}, op: 'override', value: 777 }, scope);
  world.routeTarget(bout, practice, input => local.hit(input));
  expect(world.hit(request(ordinary, 20))?.dealt).toBe(777);
  expect(world.hit(request(practice, 20))?.dealt).toBe(8);
  scope.dispose();
});
