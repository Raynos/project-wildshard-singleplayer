import type { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import type { Scope } from '@wildshard/engine/app/scope';
import { selectEffectGrants, type EffectService } from '@wildshard/engine/combat/effects/EffectService';
import type { EffectTarget } from '@wildshard/engine/combat/effects/types';
import type { PlayerHealth } from '@wildshard/engine/combat/health';
import type { OwnedId } from '@wildshard/game/loot/Owned';

interface OwnedEffects { has: (id: OwnedId) => boolean; worn?: (id: 'captain-hat' | 'cape') => boolean }
export function bindDriftwoodEffects(o: {
  grants: ReturnType<typeof declaredLootEconomy>['grants'];
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
    effects.sync(health, [...selectEffectGrants(o.grants.player, id => o.owned.has(id)),
      ...selectEffectGrants(o.grants.worn, id => o.owned.worn?.(id) === true),
      ...(Number.isFinite(o.hitCap) ? [{ id: 'effect.hit-cap' as const }] : [])]);
    for (const sword of o.swords) effects.sync(sword, selectEffectGrants(o.grants.weapons, id => o.owned.has(id)));
  };
  apply(); scope.onDispose(o.owned.onChange(apply));
}
