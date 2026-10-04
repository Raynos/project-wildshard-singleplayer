import { describe, expect, it } from 'vitest';
import { EffectService } from '#engine-internal/combat/effects/EffectService';
import type { EffectDef } from '#engine-internal/combat/effects/types';
import { Scope } from '#engine-internal/app/scope';

const stun: EffectDef = { id: 'effect.stun', kind: 'timed', duration: 1.3, modifiers: [{ attr: 'moveLocked', op: 'override', value: 1 }], stacking: 'refresh', tags: [], grants: ['state.stunned'] };
describe('starter effect core ports', () => {
  it('refreshes with the source duration and preserves max(remaining, new)', () => {
    const effects = new EffectService([stun]), target = { attributes: { moveLocked: 0 } };
    effects.apply(target, stun.id, undefined, { duration: 3 }); effects.update(0.5);
    effects.apply(target, stun.id, undefined, { duration: 1.3 });
    expect(effects.active(target)[0]?.remaining).toBe(2.5);
    effects.update(2.5); expect(target.attributes.moveLocked).toBe(0);
    expect(() => effects.apply(target, stun.id, undefined, { duration: 0 })).toThrow('Invalid duration');
  });
  it('loadout sync preserves timed statuses and tick listeners release with their scope', () => {
    const poison: EffectDef = { ...stun, id: 'effect.poison', duration: 2, period: 1, modifiers: [] };
    const effects = new EffectService([poison, stun]), target = { attributes: {} }, scope = new Scope('ticks');
    let ticks = 0; effects.onTick(() => { ticks++; }, scope);
    effects.apply(target, poison.id); effects.sync(target, []); effects.update(1);
    expect(ticks).toBe(1); expect(effects.active(target)).toHaveLength(1);
    scope.dispose(); effects.update(1); expect(ticks).toBe(1); expect(effects.active(target)).toHaveLength(0);
  });
});
