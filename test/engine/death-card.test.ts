import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '#engine/app/scope';
import { Events } from '#engine/events/events';
import { LevelRegistrations } from '#engine/level/registrations';
import { respawnWhere } from '#engine/ui/HurtArc';
import { installPlayerDeath } from '#engine/ui/playerDeath';
import { PlayerHealth } from '#engine/combat/health';
import { STRINGS } from '#shards/nine-dragon-stack/strings';

describe('death presentation belongs to the current level', () => {
  it('Nine Dragon uses its Lantern Square string, named places win, and parked tables do not leak', () => {
    const rows = new LevelRegistrations(), nd = new Scope('nd'), pine = new Scope('pine');
    rows.strings(STRINGS, nd.child('strings'));
    const def = { slug: 'nine-dragon-stack' };
    expect(respawnWhere(def, null, rows.findText('respawn.default', nd))).toBe('respawning in Lantern Square');
    expect(respawnWhere(def, 'Lantern Bridge', rows.findText('respawn.default', nd))).toBe('respawning at Lantern Bridge');
    expect(rows.findText('respawn.default', pine)).toBeUndefined();
    expect(respawnWhere({ slug: 'pine-hollow' }, null, rows.findText('respawn.default', pine))).toBe('respawning at the south gate');
    nd.dispose(); expect(rows.findText('respawn.default')).toBeUndefined();
  });
  it('queued death subscribers ignore parked actors and dispose without publishing another respawn', () => {
    const events = new Events(), scope = new Scope('death'), position = new Vector3(0, 4, 0);
    const health = new PlayerHealth(events, { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => position });
    const other = new PlayerHealth(events, { now: () => 0, dodging: () => false, dodgeGuard: () => false, position: () => position });
    let active = true, shown = 0;
    const positions: number[] = [];
    events.on('player.respawned', ({ at }) => { positions.push(at.x); }, scope);
    installPlayerDeath(events, scope, health, { active: () => active, position: () => position, died: () => { shown++; position.x = 7; } });
    events.emit('player.died', { actor: other, checkpoint: false }); events.flush('update'); expect(shown).toBe(0);
    active = false; events.emit('player.died', { actor: health, checkpoint: false }); events.flush('update'); expect(shown).toBe(0);
    active = true; events.emit('player.died', { actor: health, checkpoint: false }); events.flush('update'); events.flush('update');
    expect(shown).toBe(1); expect(positions).toEqual([7]);
    scope.dispose(); events.emit('player.died', { actor: health, checkpoint: false }); events.flush('update'); expect(shown).toBe(1);
  });
});
