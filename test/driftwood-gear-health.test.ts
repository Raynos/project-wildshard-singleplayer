import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { Flags } from '../src/engine/world/interact/flags';
import { PlayerHealth } from '../src/engine/combat/health';
import { EffectService } from '../src/engine/combat/effects/EffectService';
import { Owned } from '../src/game/loot/Owned';
import { Purse } from '../src/game/loot/Purse';
import { bindDriftwoodEffects } from '../src/shards/driftwood-isle/loot/effects';
import { driftwoodLootPresentation } from '../src/shards/driftwood-isle/loot/presentation';
import { DRIFTWOOD_EFFECTS } from '../src/shards/driftwood-isle/data/economy';

test('GEAR borrows live player max health through upgrades, revokes and other health-owner changes', async () => {
  const scope = new Scope('gear-health'), owned = new Owned('driftwood-isle');
  const health = new PlayerHealth(new Events(), { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => new Vector3() });
  const effects = new EffectService(DRIFTWOOD_EFFECTS);
  const purse = new Purse('driftwood-isle', { read: () => 0, write: () => true });
  try {
    bindDriftwoodEffects({ effects, scope, owned, health, player: { dodgeCooldownScale: 1 }, swords: [], hitCap: 20, slug: 'driftwood-isle' });
    const view = await driftwoodLootPresentation({ adventure: { flags: new Flags('driftwood-isle', false), trader: null },
      owned, health, scope, audio: { voices: { play: () => undefined } }, toast: () => undefined, hold: () => undefined });
    const check = (max: number, hearts: number): void => {
      expect(health.attributes.maxHealth).toBe(max);
      expect(view.gear(purse).health).toEqual({ max, hearts });
      expect(view.gear(purse).coins).toBe(0);
    };
    check(100, 0);
    owned.grant('heart-1'); check(120, 1);
    owned.grant('heart-2'); check(140, 2);
    owned.grant('charm-1'); check(150, 2);
    owned.revoke('heart-2'); check(130, 1);
    owned.revoke('heart-1'); check(110, 0);
    owned.revoke('charm-1'); check(100, 0);
    health.setMaxHealth(175); check(175, 0);
  } finally { scope.dispose(); }
});
