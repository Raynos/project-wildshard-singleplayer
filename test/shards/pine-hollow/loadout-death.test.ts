import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { Events } from '../../../src/engine/events/events';
import { PlayerHealth } from '../../../src/engine/combat/health';
import { installPlayerDeath } from '../../../src/engine/ui/playerDeath';
import { Quiver } from '../../../src/shards/pine-hollow/loadout/ammo';
import { bindLoadoutDeath } from '../../../src/shards/pine-hollow/loadout/events';

describe('Pine death resets ammunition before the shell refill', () => {
  it('refills iron, preserves special pouches and ignores foreign, parked and disposed actors', () => {
    const events = new Events(), scope = new Scope('pine'), position = new Vector3();
    const ports = { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => position };
    const health = new PlayerHealth(events, ports), other = new PlayerHealth(events, ports);
    const quiver = new Quiver({ pitch: 6, broadhead: 9 });
    let live = quiver.select('pitch', 12) ?? 0, active = true, resets = 0;
    // Register presentation first, as the shell does before plugin.play.
    installPlayerDeath(events, scope, health, { active: () => active, position: () => position, died: () => undefined });
    events.on('player.respawned', () => { live += 30 - live; }, scope);
    bindLoadoutDeath(events, scope, health, { active: () => active, reset: () => { resets++; live = quiver.select('iron', live) ?? live; } });
    events.emit('player.died', { actor: other, checkpoint: false }); events.flush('update');
    expect(resets).toBe(0); expect(quiver.selected).toBe('pitch');
    active = false;
    events.emit('player.died', { actor: health, checkpoint: false }); events.flush('update');
    expect(resets).toBe(0); expect(live).toBe(6);
    active = true; live = 4;
    events.emit('player.died', { actor: health, checkpoint: true }); events.flush('update');
    expect(resets).toBe(1); expect(quiver.selected).toBe('iron'); expect(live).toBe(30);
    expect(quiver.counts.pitch).toBe(4); expect(quiver.counts.broadhead).toBe(9);
    scope.dispose(); events.emit('player.died', { actor: health, checkpoint: false }); events.flush('update');
    expect(resets).toBe(1);
  });
});
