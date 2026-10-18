import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { PlayerHealth } from '../src/engine/combat/health';
import { EffectService } from '../src/engine/combat/effects/EffectService';
import type { OwnedId } from '../src/game/loot/Owned';
import { bindFixtureEffects } from './fixtures/item-effects';
import { STARTER_EFFECTS } from '../src/game/plugin/ui';
import { DRIFTWOOD_EFFECTS } from '../src/shards/driftwood-isle/generators/economy';


test('owned keepsakes apply and revoke gameplay through the existing effect binding', () => {
  const scope = new Scope('keepsake-effects'), have = new Set<OwnedId>(), listeners = new Set<() => void>();
  const effects = new EffectService([...DRIFTWOOD_EFFECTS, ...STARTER_EFFECTS]), player = { dodgeCooldownScale: 1, effectMoveLocked: false, effectMoveScale: 1 };
  const health = new PlayerHealth(new Events(), { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => new Vector3() });
  const attributes = { damage: 24, heavyDamageMul: 1 };
  const sword = { attributes, get damage() { return attributes.damage; }, get heavyMult() { return attributes.heavyDamageMul; } };
  const owned = { has: (id: OwnedId) => have.has(id), onChange: (run: () => void) => {
    listeners.add(run); return () => { listeners.delete(run); };
  } };
  const change = (id: OwnedId, on = true): void => {
    if (on) have.add(id); else have.delete(id);
    for (const run of listeners) run();
  };
  bindFixtureEffects({ effects, scope, owned, health, player, swords: [sword], hitCap: 20 });
  expect(health.attributes.maxHealth).toBe(100);
  change('heart-1'); expect(health.attributes.maxHealth).toBe(120);
  change('heart-2'); expect(health.attributes.maxHealth).toBe(140);
  change('charm-1'); expect(health.attributes.maxHealth).toBe(150);
  change('charm-2'); expect(player.dodgeCooldownScale).toBe(0.7);
  effects.apply(health, 'effect.stun'); effects.apply(health, 'effect.slow');
  expect(player.effectMoveLocked).toBe(true); expect(player.effectMoveScale).toBe(.6);
  change('heart-1', false); expect(player.effectMoveLocked).toBe(true); expect(player.effectMoveScale).toBe(.6);
  effects.update(4); expect(player.effectMoveLocked).toBe(false); expect(player.effectMoveScale).toBe(1);
  expect(player.dodgeCooldownScale).toBe(.7);
  change('bear-claw'); expect(sword.heavyMult).toBe(1.2);
  change('whetstone-2'); expect(sword.damage).toBe(36);
  change('boar-tusk'); expect(health.effectTags).toContain('guard.dodge');
  expect(health.attributes.incomingCap).toBe(20);
  change('charm-2', false); expect(player.dodgeCooldownScale).toBe(1);
  change('bear-claw', false); expect(sword.heavyMult).toBe(1);
  change('boar-tusk', false); expect(health.effectTags).not.toContain('guard.dodge');
  scope.dispose(); expect(listeners.size).toBe(0);
  change('charm-2'); expect(player.dodgeCooldownScale).toBe(1);
});
