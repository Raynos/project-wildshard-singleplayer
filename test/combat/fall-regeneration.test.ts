import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { Events } from '../../src/engine/events/events';
import { PlayerHealth } from '../../src/engine/combat/health';
import { CombatPipeline } from '../../src/engine/combat/pipeline';
import { installPlayerDeath } from '../../src/engine/ui/playerDeath';

it('emits a terminal fall death after the regeneration clock elapsed, preserving the fall clock', () => {
  const scope = new Scope('fall'), events = new Events(), position = new Vector3(0, -251, 0);
  const health = new PlayerHealth(events, { now: () => 10_000, dodging: () => false, dodgeGuard: () => false, position: () => position });
  const combat = new CombatPipeline(events, scope);
  let deaths = 0;
  installPlayerDeath(events, scope, health, { position: () => position, died: () => { deaths++; } });
  try {
    combat.fall(health, position, { kind: 'out-of-world', label: '' });
    expect(health.alive).toBe(false); expect(health.lastHurt).toBe(0);
    health.update(1 / 60); events.flush('update');
    expect(deaths).toBe(1); expect(health.attributes.health).toBe(100); expect(health.lastHurt).toBe(0);
    health.update(1 / 60); events.flush('update'); expect(deaths).toBe(1);
    health.attributes.health = 90; health.update(1); expect(health.attributes.health).toBe(94);
  } finally { scope.dispose(); }
});
