import { expect, test } from 'vitest';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline, type Actor } from '../src/engine/combat/pipeline';
import { BorrowedDecisionSchema } from '../src/format/decisionScripts';
import { bindBorrowedGuard } from '../src/game/shardfile/borrowedGuard';

function body(id: string): Actor {
  const attributes = { health: 100, maxHealth: 100 };
  return { id, tags: ['actor.creature'], state: [], attributes,
    get alive() { return attributes.health > 0; },
    applyDamage: req => { attributes.health -= req.amount; return attributes.health <= 0; } };
}
function fixture() {
  const scope = new Scope('test-guard'), events = new Events(), combat = new CombatPipeline(events, scope);
  const actor = body('guarded'), memory = { guard: 1 };
  bindBorrowedGuard(events, scope, actor, memory, { field: 'guard', activeValue: 1, multiplier: .25 });
  const hit = (target: Actor, amount = 20) => combat.hit({ source: 'env', sourceTags: ['weapon.test'], target, amount, point: new Vector3(), dir: new Vector3(0, 0, 1) });
  return { scope, events, combat, actor, memory, hit };
}

test('guard samples declared field and affects only exact actor', () => {
  const f = fixture();
  expect(f.hit(f.actor)?.dealt).toBe(5);
  expect(f.hit(body('guarded'))?.dealt).toBe(20);
  f.memory.guard = 0; expect(f.hit(f.actor)?.dealt).toBe(20);
  f.scope.dispose();
});
test('guarded hits still emit real post-modifier damage for decision counterplay', () => {
  const f = fixture(), dealt: number[] = [];
  f.events.on('damage.dealt', event => { dealt.push(event.dealt); f.memory.guard = 0; }, f.scope);
  expect(f.hit(f.actor)?.dealt).toBe(5); f.events.flush('update');
  expect(dealt).toEqual([5]); expect(f.hit(f.actor)?.dealt).toBe(20);
  f.scope.dispose();
});
test('guard disposal removes modifier without touching other pipeline rules', () => {
  const root = new Scope('root'), guardScope = root.child('guard'), events = new Events(), combat = new CombatPipeline(events, root), actor = body('one');
  bindBorrowedGuard(events, guardScope, actor, { guard: 1 }, { field: 'guard', activeValue: 1, multiplier: .25 });
  const req = { source: 'env' as const, sourceTags: [] as const, target: actor, amount: 20, point: new Vector3(), dir: new Vector3() };
  expect(combat.hit(req)?.dealt).toBe(5); guardScope.dispose(); expect(combat.hit(req)?.dealt).toBe(20);
  expect(() => bindBorrowedGuard(events, guardScope, actor, {}, { field: 'guard', activeValue: 1, multiplier: 1 })).toThrow('retired');
  root.dispose();
});
test('guard declarations reject invalid amplification and nonfinite values', () => {
  const row = { script: 'test.script', actor: 'test.actor', strikeEffects: [] };
  expect(v.safeParse(BorrowedDecisionSchema, { ...row, guard: { field: 'guard', activeValue: 1, multiplier: .25 } }).success).toBe(true);
  for (const multiplier of [-.1, 4.1, Infinity, Number.NaN])
    expect(v.safeParse(BorrowedDecisionSchema, { ...row, guard: { field: 'guard', activeValue: 1, multiplier } }).success).toBe(false);
});

test('declared exposure increases damage once on its exact body', () => {
  const scope = new Scope('exposure'), events = new Events(), combat = new CombatPipeline(events, scope), actor = body('boss');
  bindBorrowedGuard(events, scope, actor, { exposed: 1 }, { field: 'exposed', activeValue: 1, multiplier: 1.5 });
  expect(combat.hit({ source: 'env', sourceTags: [], target: actor, amount: 20, point: new Vector3(), dir: new Vector3() })?.dealt).toBe(30);
  scope.dispose();
});
