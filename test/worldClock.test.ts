import { describe, expect, it } from 'vitest';
import { DayClock } from '../src/world/DayClock';
import { dayClockClock, phaseOfHour } from '../src/world/WorldClock';

describe('WorldClock over DayClock (NALATI-MERGE F8)', () => {
  it('Settings ▸ Time of day parks the clock at a pick and "live" lets it run on', () => {
    const c = new DayClock({ start: 10 });
    const w = dayClockClock(c);
    w.setTime('night');
    expect(c.paused).toBe(true);
    expect(w.phase).toBe('night');
    expect(w.body).toBe('moon');
    expect(w.night).toBe(1);
    w.setTime('midday');
    expect(w.hour).toBe(12);
    expect(w.body).toBe('sun');
    expect(w.night).toBe(0);
    w.setTime('live');
    expect(c.paused).toBe(false);
  });
  it('a saved pick parks the clock on boot', () => {
    const c = new DayClock({ start: 10 });
    dayClockClock(c, 'golden');
    expect(c.phase).toBe('golden');
    expect(c.paused).toBe(true);
  });
  it("Explore's light presets hold the clock and give it back as it was", () => {
    const c = new DayClock({ start: 9.5 });
    const w = dayClockClock(c);
    w.pin('dusk');
    expect(w.phase).toBe('dusk');
    expect(c.paused).toBe(true);
    w.pin('dusk'); // held every frame: no jump
    w.pin(null);
    expect(c.hour).toBeCloseTo(9.5);
    expect(c.paused).toBe(false);
  });
  it('names the hour on DayClock\'s schedule', () => {
    expect(phaseOfHour(5)).toBe('dawn');
    expect(phaseOfHour(12)).toBe('day');
    expect(phaseOfHour(17)).toBe('golden');
    expect(phaseOfHour(19)).toBe('dusk');
    expect(phaseOfHour(2)).toBe('night');
  });
});
