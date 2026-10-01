import { describe, expect, it } from 'vitest';
import { EncounterService, type EventMap } from '#engine';
import { captainFixture } from '../../fake/captain';

describe('Captain terminal attempts', () => {
  it('one wake and a kill emit one won event, with no started or checkpoint event', () => {
    const f = captainFixture(), attempts: EventMap['boss.attempt'][] = [];
    f.events.on('boss.attempt', (event) => { attempts.push(event); }, f.scope);
    f.flags.add('used:altar'); f.boss.update(1 / 60, 0); f.boss.wake();
    f.actor.alive = false; f.actor.hp = 0; f.boss.update(1 / 60, 0); f.boss.update(1 / 60, 0);
    f.events.flush('fixed.post'); expect(attempts).toEqual([{ boss: 'boss.captain', level: 'driftwood-isle', outcome: 'won' }]);
    f.scope.dispose();
  });
  it('a death before the altar cannot prevent the first wake', () => {
    const f = captainFixture(); expect(f.boss.onPlayerDeath()).toBe(false);
    f.flags.add('used:altar'); f.boss.update(1 / 60, 0); expect(f.actor.mem['awake']).toBe(1);
    f.scope.dispose();
  });
  it('death is lost and returns false; only returning to the arena opens another attempt', () => {
    const f = captainFixture(), attempts: string[] = [];
    f.events.on('boss.attempt', ({ outcome }) => { attempts.push(outcome); }, f.scope);
    f.flags.add('used:altar'); f.boss.update(1 / 60, 0);
    expect(f.boss.onPlayerDeath()).toBe(false); expect(f.boss.onPlayerDeath()).toBe(false);
    f.boss.update(1 / 60, 0); f.boss.update(1 / 60, 0); f.events.flush('fixed.post'); expect(attempts).toEqual(['lost']);
    f.player.position.z = 22; f.boss.update(1 / 60, 0);
    f.player.position.z = 3; f.boss.update(1 / 60, 0); f.actor.alive = false; f.boss.update(1 / 60, 0);
    f.events.flush('fixed.post'); expect(attempts).toEqual(['lost', 'won']); f.scope.dispose();
  });
  it('leaving ends one attempt; the scoped encounter retires without duplicating it', () => {
    const f = captainFixture(), attempts: string[] = [], registry = new EncounterService(() => f.scope);
    f.events.on('boss.attempt', ({ outcome }) => { attempts.push(outcome); }, f.scope);
    registry.boss('boss.captain', f.boss, f.scope); f.flags.add('used:altar'); f.boss.update(1 / 60, 0);
    f.player.position.z = 22; f.boss.update(1 / 60, 0); f.boss.disarm();
    f.events.flush('fixed.post'); expect(attempts).toEqual(['left']); f.scope.dispose(); expect(registry.runtime('boss.captain')).toBeUndefined();
  });
});
