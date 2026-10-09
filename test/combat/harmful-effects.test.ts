import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { Events } from '../../src/engine/events/events';
import { CombatPipeline } from '../../src/engine/combat/pipeline';
import { PlayerHealth } from '../../src/engine/combat/health';
import { bindPlayerEffects, EffectService } from '../../src/engine/combat/effects/EffectService';
import { harmfulEffect, type EffectDef } from '../../src/engine/combat/effects/types';
import { STARTER_EFFECTS } from '@wildshard/sdk/runtime/effects';

it('clears poison, slow and other harmful data without changing a timed buff or cosmetic', () => {
  const scope = new Scope('effects.safe'), events = new Events();
  const buff: EffectDef = { id: 'effect.fixture-buff', tags: ['buff.speed'], kind: 'timed', duration: 20,
    modifiers: [{ attr: 'moveSpeedMul', op: 'mul', value: 1.2 }], stacking: { max: 3 } };
  const cosmetic: EffectDef = { id: 'effect.fixture-cosmetic', tags: ['effect.cosmetic'], kind: 'permanent', modifiers: [], stacking: 'none' };
  const debuff: EffectDef = { id: 'effect.fixture-weakness', tags: ['debuff.weakness'], kind: 'timed', duration: 10,
    modifiers: [{ attr: 'damage', op: 'mul', value: 0.5 }], stacking: 'none' };
  const untagged: EffectDef = { id: 'effect.fixture-damage', tags: [], kind: 'timed', duration: 10, period: 1,
    tickDamage: 2, modifiers: [], stacking: 'none' };
  const effects = new EffectService([...STARTER_EFFECTS, buff, cosmetic, debuff, untagged], scope, events);
  const health = new PlayerHealth(events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
  const movement = { effectMoveLocked: false, effectMoveScale: 1 };
  const removed: string[] = [];
  events.on('effect.removed', ({ id }) => { removed.push(id); }, scope);
  bindPlayerEffects({ effects, target: health, movement, combat: new CombatPipeline(events, scope), position: () => new Vector3(), scope });
  try {
    for (const def of [...STARTER_EFFECTS, buff, cosmetic, debuff, untagged]) effects.apply(health, def.id);
    effects.apply(health, buff.id); effects.update(0.25);
    expect(movement.effectMoveLocked).toBe(true);
    const retained = effects.active(health).filter((effect) => !harmfulEffect(effect.def)).map((effect) => ({ def: effect.def, stacks: effect.stacks, remaining: effect.remaining, elapsed: effect.elapsed, source: effect.source, sourceTags: effect.sourceTags }));
    const hp = health.attributes.health;
    effects.clearHarmful(health); events.flush('update');
    expect(effects.active(health)).toEqual(retained);
    expect(movement).toEqual({ effectMoveLocked: false, effectMoveScale: 1.44 });
    expect(removed.sort()).toEqual([...STARTER_EFFECTS, debuff, untagged].map((def) => def.id).sort());
    effects.update(1); expect(health.attributes.health).toBe(hp);
    expect(effects.active(health).find((effect) => effect.def.id === buff.id)).toMatchObject({ stacks: 2, remaining: 18.75 });
  } finally { scope.dispose(); }
});

it('derives untagged attribute harm from original bases while keeping buffs and nonlowering overrides', () => {
  const effects = new EffectService([
    { id: 'effect.fixture-add-loss', tags: [], kind: 'permanent', modifiers: [{ attr: 'damage', op: 'add', value: -3 }], stacking: 'none' },
    { id: 'effect.fixture-mul-loss', tags: [], kind: 'permanent', modifiers: [{ attr: 'speed', op: 'mul', value: 0.5 }], stacking: 'none' },
    { id: 'effect.fixture-override-loss', tags: [], kind: 'permanent', modifiers: [{ attr: 'armour', op: 'override', value: 2 }], stacking: 'none' },
    { id: 'effect.fixture-buff', tags: [], kind: 'permanent', modifiers: [{ attr: 'damage', op: 'add', value: 5 }], stacking: 'none' },
    { id: 'effect.fixture-neutral', tags: [], kind: 'permanent', modifiers: [{ attr: 'armour', op: 'override', value: 10 }], stacking: 'none' },
    { id: 'effect.fixture-negative-base', tags: [], kind: 'permanent', modifiers: [{ attr: 'offset', op: 'mul', value: 0.5 }], stacking: 'none' },
  ]);
  const target = { attributes: { damage: 10, speed: 1, armour: 10, offset: -2 } };
  for (const id of ['effect.fixture-add-loss', 'effect.fixture-mul-loss', 'effect.fixture-override-loss', 'effect.fixture-buff', 'effect.fixture-neutral', 'effect.fixture-negative-base'] as const) effects.apply(target, id);
  effects.clearHarmful(target);
  expect(effects.active(target).map(effect => effect.def.id)).toEqual(['effect.fixture-buff', 'effect.fixture-neutral', 'effect.fixture-negative-base']);
  expect(target.attributes).toEqual({ damage: 15, speed: 1, armour: 10, offset: -1 });
  effects.clear(target);
});
