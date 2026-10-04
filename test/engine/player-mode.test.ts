import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { PlayerHealth, type PlayerMode } from '../../src/engine/combat/health';
import { Events } from '../../src/engine/events/events';

describe('public player movement mode', () => {
  it('reads immediately and publishes only changed frame modes to scoped subscribers', () => {
    const events = new Events(), scope = new Scope('mode');
    let mode: PlayerMode = 'foot';
    const health = new PlayerHealth(events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false, mode: () => mode });
    const changes: { prev: PlayerMode; next: PlayerMode }[] = [];
    events.on('player.mode', (change) => { changes.push(change); }, scope);
    health.update(0); events.flush('update'); expect(changes).toEqual([]);
    for (const next of ['board', 'swim', 'ride', 'foot'] as const) {
      const prev = health.mode; mode = next; expect(health.mode).toBe(next);
      expect(changes.at(-1)?.next).not.toBe(next);
      health.update(0); health.update(0); events.flush('update');
      expect(changes.at(-1)).toEqual({ prev, next });
    }
    expect(changes).toHaveLength(4);
    mode = 'board'; mode = 'ride'; health.update(0); events.flush('update');
    expect(changes.at(-1)).toEqual({ prev: 'foot', next: 'ride' });
    scope.dispose(); mode = 'foot'; health.update(0); events.flush('update'); expect(changes).toHaveLength(5);
  });
  it('defaults to foot for health-only ports and starts without a synthetic change', () => {
    const events = new Events();
    const health = new PlayerHealth(events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false });
    expect(health.mode).toBe('foot');
    const boarded = new PlayerHealth(events, { now: () => 0, position: () => new Vector3(), dodging: () => false, dodgeGuard: () => false, mode: () => 'board' });
    let changes = 0; const scope = new Scope('initial'); events.on('player.mode', () => { changes++; }, scope);
    boarded.update(0); events.flush('update'); expect(changes).toBe(0); scope.dispose();
  });
});
