import { expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { EffectService } from '../../src/engine/combat/effects/EffectService';
import { STARTER_EFFECTS } from '@wildshard/sdk/runtime/effects';

it('detaches entered observers while preserving player statuses and restoring the parent callback', () => {
  const scope = new Scope('effects'), effects = new EffectService(STARTER_EFFECTS, scope);
  const target = { attributes: { moveSpeedMul: 1 } };
  let parent = 0, entered = 0;
  effects.bind(target, () => { parent++; }, scope);
  try {
    for (let entry = 0; entry < 2; entry++) {
      const cell = scope.child('entry');
      effects.bind(target, () => { entered++; }, cell, { clearOnDispose: false });
      effects.apply(target, 'effect.slow'); effects.update(0.25);
      const continuation = effects.active(target).map((effect) => ({ id: effect.def.id, remaining: effect.remaining, stacks: effect.stacks }));
      const entryCalls = entered;
      cell.dispose();
      expect(effects.active(target).map((effect) => ({ id: effect.def.id, remaining: effect.remaining, stacks: effect.stacks }))).toEqual(continuation);
      expect(target.attributes.moveSpeedMul).toBeLessThan(1);
      effects.setBase(target, 'moveSpeedMul', 1);
      expect(entered).toBe(entryCalls); expect(parent).toBe(entry + 1);
    }
    effects.update(4); expect(effects.active(target)).toHaveLength(0); expect(target.attributes.moveSpeedMul).toBe(1);
  } finally { scope.dispose(); }
});

it('keeps the default scoped binding teardown clearing its target effects', () => {
  const scope = new Scope('effects'), effects = new EffectService(STARTER_EFFECTS), target = { attributes: {} };
  effects.bind(target, () => undefined, scope); effects.apply(target, 'effect.burn');
  expect(effects.active(target)).toHaveLength(1);
  scope.dispose(); expect(effects.active(target)).toHaveLength(0);
});
