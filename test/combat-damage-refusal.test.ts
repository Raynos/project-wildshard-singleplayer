import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline, type Actor, type DamageRequest } from '../src/engine/combat/pipeline';
import { DamageRefusalError } from '../src/engine/combat/damageRefusal';

function fixture() {
  const scope = new Scope('damage-refusal'), events = new Events(), combat = new CombatPipeline(events, scope);
  const target: Actor = { id: 'target', tags: ['actor.creature'], state: [], attributes: { health: 10, maxHealth: 10 }, alive: true,
    applyDamage: () => { throw new DamageRefusalError('contact overlap'); } };
  const request: DamageRequest = { source: 'env', sourceTags: [], target, amount: 10, point: new Vector3(), dir: new Vector3(0, 0, 1) };
  return { scope, events, combat, target, request };
}

test('only the explicit applyDamage refusal is a null hit, including encounter routes', () => {
  const f = fixture(), outer = new CombatPipeline(new Events(), f.scope);
  let hits = 0, deaths = 0;
  try {
    f.events.on('damage.dealt', () => { hits++; }, f.scope);
    f.events.on('actor.died', () => { deaths++; }, f.scope);
    outer.routeTarget(f.scope, f.target, request => f.combat.hit(request));
    for (let i = 0; i < 10; i++) expect(outer.hit(f.request)).toBeNull();
    f.events.flush('update');
    expect([hits, deaths, f.target.attributes.health]).toEqual([0, 0, 10]);
  } finally { f.scope.dispose(); }
});

test.each([new Error('allocation failed'), new AggregateError([new Error('cleanup failed')], 'cleanup failed'),
  new TypeError('programmer error'), Object.assign(new Error('contact overlap'), { name: 'DamageRefusalError' })])('genuine errors are never masked: %s', failure => {
  const f = fixture();
  try {
    f.target.applyDamage = () => { throw failure; };
    expect(() => f.combat.hit(f.request)).toThrow(failure);
  } finally { f.scope.dispose(); }
});

test('refusal does not change terminal fall semantics', () => {
  const f = fixture();
  try { expect(() => f.combat.fall(f.target, new Vector3(), { kind: 'fall', label: 'fall' })).toThrow(DamageRefusalError); }
  finally { f.scope.dispose(); }
});

test('refusal outside applyDamage is still a fault', () => {
  const f = fixture();
  try {
    f.target.onDamageRequest = () => { throw new DamageRefusalError('invalid hook'); };
    expect(() => f.combat.hit(f.request)).toThrow('invalid hook');
  } finally { f.scope.dispose(); }
});
