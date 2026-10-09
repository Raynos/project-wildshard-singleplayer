import { shardContentIdentity } from '@wildshard/game/shard/list';
import type { Scope } from '@wildshard/engine/app/scope';
import { EffectService } from '@wildshard/engine/combat/effects/EffectService';
import type { EffectDef, EffectId, EffectTarget, AttributeSet } from '@wildshard/engine/combat/effects/types';
import type { PlayerHealth } from '@wildshard/engine/combat/health';
import type { OwnedId } from '@wildshard/game/loot/Owned';

const permanent = (id: EffectId, modifiers: EffectDef['modifiers'] = [], grants: EffectDef['grants'] = []): EffectDef =>
  ({ id, kind: 'permanent', tags: [], modifiers, grants, stacking: 'none' });
export const DRIFTWOOD_EFFECTS: readonly EffectDef[] = [
  { ...permanent('effect.sturdy-heart', [{ attr: 'maxHealth', op: 'add', value: 20 }]), stacking: { max: 2 } },
  permanent('effect.charm.1', [{ attr: 'maxHealth', op: 'add', value: 10 }]),
  permanent('effect.charm.2', [{ attr: 'dodgeCooldownMul', op: 'mul', value: 0.7 }]),
  permanent('effect.charm.3', [], ['cosmetic.seaglass-glow']),
  { ...permanent('effect.whetstone.1', [{ attr: 'damage', op: 'mul', value: 1.25 }]), group: 'whetstone' },
  { ...permanent('effect.whetstone.2', [{ attr: 'damage', op: 'mul', value: 1.5 }]), group: 'whetstone', removes: ['effect.whetstone.1'] },
  permanent('effect.bear-claw', [{ attr: 'heavyDamageMul', op: 'mul', value: 1.2 }]),
  permanent('effect.boar-tusk', [], ['guard.dodge']),
  permanent('effect.hit-cap', [{ attr: 'incomingCap', op: 'override', value: 20 }]),
  permanent('effect.captain-hat', [], ['cosmetic.hat.captain']),
  permanent('effect.cape', [], ['cosmetic.cape']),
];
interface OwnedEffects { has: (id: OwnedId) => boolean; worn?: (id: 'captain-hat' | 'cape') => boolean }
export function driftwoodPlayerGrants(owned: OwnedEffects): { id: EffectId; stacks?: number }[] {
  const grants: { id: EffectId; stacks?: number }[] = [];
  const hearts = owned.has('heart-2') ? 2 : owned.has('heart-1') ? 1 : 0;
  if (hearts > 0) grants.push({ id: 'effect.sturdy-heart', stacks: hearts });
  for (const id of ['charm-1', 'charm-2', 'charm-3', 'boar-tusk'] as const) if (owned.has(id)) {
    grants.push({ id: id === 'boar-tusk' ? 'effect.boar-tusk' : `effect.charm.${id.slice(-1)}` });
  }
  for (const id of ['captain-hat', 'cape'] as const) if (owned.worn?.(id)) grants.push({ id: `effect.${id}` });
  return grants;
}
export function driftwoodWeaponGrants(owned: OwnedEffects): { id: EffectId }[] {
  const grants: { id: EffectId }[] = [];
  if (owned.has('whetstone-2')) grants.push({ id: 'effect.whetstone.2' });
  else if (owned.has('whetstone-1')) grants.push({ id: 'effect.whetstone.1' });
  if (owned.has('bear-claw')) grants.push({ id: 'effect.bear-claw' });
  return grants;
}
/** Pure legacy reads derive from the same rows while their presentation consumers move. */
export function driftwoodAttributes(owned: OwnedEffects): { attributes: AttributeSet; tags: readonly string[] } {
  const player: EffectTarget = { attributes: { maxHealth: 100, dodgeCooldownMul: 1 } };
  const weapon: EffectTarget = { attributes: { damage: 1, heavyDamageMul: 1 } };
  const effects = new EffectService(DRIFTWOOD_EFFECTS);
  effects.sync(player, driftwoodPlayerGrants(owned)); effects.sync(weapon, driftwoodWeaponGrants(owned));
  return { attributes: { ...player.attributes, ...weapon.attributes }, tags: player.effectTags ?? [] };
}
export function bindDriftwoodEffects(o: {
  effects: EffectService; scope: Scope; owned: OwnedEffects & { onChange: (fn: () => void) => () => void };
  health: PlayerHealth; player: { dodgeCooldownScale: number };
  swords: readonly (EffectTarget & { damage: number; heavyMult: number })[]; hitCap: number; slug: string;
}): void {
  if (shardContentIdentity(o.slug) !== 'driftwood-isle') return;
  const { effects, scope, health } = o;
  health.attributes['dodgeCooldownMul'] = 1;
  effects.bind(health, (previous) => {
    const max = health.attributes.maxHealth;
    health.attributes.maxHealth = previous['maxHealth'] ?? max;
    health.setMaxHealth(max);
    o.player.dodgeCooldownScale = health.attributes['dodgeCooldownMul'] ?? 1;
  }, scope);
  for (const sword of o.swords) {
    sword.attributes['damage'] = sword.damage; sword.attributes['heavyDamageMul'] = sword.heavyMult;
    effects.bind(sword, () => { sword.damage = Math.round(sword.attributes['damage'] ?? 0); sword.heavyMult = sword.attributes['heavyDamageMul'] ?? 1; }, scope);
  }
  const apply = (): void => {
    if (scope.disposed) return;
    effects.sync(health, [...driftwoodPlayerGrants(o.owned), ...(Number.isFinite(o.hitCap) ? [{ id: 'effect.hit-cap' as const }] : [])]);
    for (const sword of o.swords) effects.sync(sword, driftwoodWeaponGrants(o.owned));
  };
  apply(); scope.onDispose(o.owned.onChange(apply));
}
