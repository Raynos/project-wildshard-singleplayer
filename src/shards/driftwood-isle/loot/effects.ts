import { DRIFTWOOD_PLAYER_GRANTS, DRIFTWOOD_WORN_GRANTS, DRIFTWOOD_WEAPON_GRANTS } from '../data/economy';
import type { Scope } from '@wildshard/engine/app/scope';
import { selectEffectGrants, type EffectService } from '@wildshard/engine/combat/effects/EffectService';
import type { EffectId, EffectTarget } from '@wildshard/engine/combat/effects/types';
import type { PlayerHealth } from '@wildshard/engine/combat/health';
import type { OwnedId } from '@wildshard/game/loot/Owned';

interface OwnedEffects { has: (id: OwnedId) => boolean; worn?: (id: 'captain-hat' | 'cape') => boolean }
export function driftwoodPlayerGrants(owned: OwnedEffects): { id: EffectId; stacks?: number }[] {
  return [...selectEffectGrants(DRIFTWOOD_PLAYER_GRANTS, id => owned.has(id)),
    ...selectEffectGrants(DRIFTWOOD_WORN_GRANTS, id => owned.worn?.(id) === true)];
}
export function driftwoodWeaponGrants(owned: OwnedEffects): { id: EffectId }[] {
  return selectEffectGrants(DRIFTWOOD_WEAPON_GRANTS, id => owned.has(id));
}
export function bindDriftwoodEffects(o: {
  effects: EffectService; scope: Scope; owned: OwnedEffects & { onChange: (fn: () => void) => () => void };
  health: PlayerHealth; player: { dodgeCooldownScale: number };
  swords: readonly (EffectTarget & { damage: number; heavyMult: number })[]; hitCap: number; slug: string;
}): void {
  if (o.slug !== 'driftwood-isle') return;
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
