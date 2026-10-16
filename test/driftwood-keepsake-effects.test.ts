import { declaredLootEconomy } from '../src/game/shard/declaredRows';
import LOOT from '../src/shards/driftwood-isle/data/loot.generated.json' with { type: 'json' };
import { parseRows } from '../src/format/rows';
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { PlayerHealth } from '../src/engine/combat/health';
import { EffectService } from '../src/engine/combat/effects/EffectService';
import type { OwnedId } from '../src/game/loot/Owned';
import { bindDriftwoodEffects } from '../src/shards/driftwood-isle/loot/effects';
import { DRIFTWOOD_EFFECTS } from '../src/shards/driftwood-isle/generators/economy';

const economy = declaredLootEconomy(parseRows({ strikes: [], weather: [], days: [], species: [], looks: [], compendiums: [], loot: [LOOT] }).loot);

test('owned keepsakes apply and revoke gameplay through the existing effect binding', () => {
  const scope = new Scope('keepsake-effects'), have = new Set<OwnedId>(), listeners = new Set<() => void>();
  const effects = new EffectService(DRIFTWOOD_EFFECTS), player = { dodgeCooldownScale: 1 };
  const health = new PlayerHealth(new Events(), { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => new Vector3() });
  const sword = { attributes: { damage: 24, heavyDamageMul: 1 }, damage: 24, heavyMult: 1 };
  const owned = { has: (id: OwnedId) => have.has(id), onChange: (run: () => void) => {
    listeners.add(run); return () => { listeners.delete(run); };
  } };
  const change = (id: OwnedId, on = true): void => {
    if (on) have.add(id); else have.delete(id);
    for (const run of listeners) run();
  };
  bindDriftwoodEffects({ grants: economy.grants, effects, scope, owned, health, player, swords: [sword], hitCap: 20, slug: 'driftwood-isle' });
  expect(health.attributes.maxHealth).toBe(100);
  change('heart-1'); expect(health.attributes.maxHealth).toBe(120);
  change('heart-2'); expect(health.attributes.maxHealth).toBe(140);
  change('charm-1'); expect(health.attributes.maxHealth).toBe(150);
  change('charm-2'); expect(player.dodgeCooldownScale).toBe(0.7);
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
