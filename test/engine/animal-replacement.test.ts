import { expect, it } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';
import { manager } from '../fake/manager';

it('replaces only its own retired actor once with fresh state, same species/identity and ordinary spawn RNG', () => {
  const scope = new Scope('animal.replace'), previous = app.levelScope;
  app.levelScope = scope;
  try {
    withOwner(scope, () => {
      const first = manager().manager, control = manager().manager;
      const retired = first.spawn('boar', 0, 0, 0, 'boar', { entityId: 'home:boar' });
      const original = control.spawn('boar', 0, 0, 0, 'boar', { entityId: 'home:boar' });
      const foreign = control.spawn('boar', 0, 0, 0, 'boar');
      expect(() => first.replace(retired, 2, 3, 1, 'boar')).toThrow('unreplaced retired actor');
      control.retire(foreign);
      expect(() => first.replace(foreign, 2, 3, 1, 'boar')).toThrow('unreplaced retired actor');
      // Keep the control RNG aligned after the foreign-owner refusal (which must consume no draws).
      first.spawn('boar', 0, 0, 0, 'boar');
      retired.hp = 1; retired.mem['old'] = 42;
      first.retire(retired); control.retire(original);
      const replacement = first.replace(retired, 2, 3, 1, 'boar'), ordinary = control.spawn('boar', 2, 3, 1, 'boar');
      expect(replacement).not.toBe(retired); expect(replacement.mesh).not.toBe(retired.mesh);
      expect(replacement.kind).toBe(retired.kind); expect(replacement.entityId).toBe(retired.entityId);
      expect(replacement.hp).toBe(replacement.maxHp); expect(replacement.mem['old']).toBeUndefined();
      expect({ ...replacement.snapshot(), id: ordinary.entityId }).toEqual(ordinary.snapshot());
      expect(first.animals.filter(actor => actor.entityId === retired.entityId)).toEqual([replacement]);
      expect(() => first.replace(retired, 2, 3, 1, 'boar')).toThrow('unreplaced retired actor');
      first.retire(retired); // Repeating retirement cannot rearm an already consumed replacement token.
      expect(() => first.replace(retired, 2, 3, 1, 'boar')).toThrow('unreplaced retired actor');
      first.retire(replacement);
      const again = first.replace(replacement, 4, 5, 2, 'boar');
      expect(again.entityId).toBe(retired.entityId);
    });
  } finally { scope.dispose(); app.levelScope = previous; }
});
