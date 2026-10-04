import { describe, expect, it } from 'vitest';
import { steppeClock } from '#shards/nalati-grasslands/look/dayKeys';
import { phaseOfHour } from '#engine-internal/world/dayCycle';

describe('WorldClock over DayClock (NALATI-MERGE F8)', () => {
  it('Settings ▸ Time of day parks the clock at a pick and "live" lets it run on', () => {
    const c = steppeClock({ start: 10 });
    const w = c;
    w.setTime('night');
    expect(c.paused).toBe(true);
    expect(w.dayPhase).toBe('night');
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
    const c = steppeClock({ start: 10 });
    c.setTime('golden');
    expect(c.dayPhase).toBe('golden');
    expect(c.paused).toBe(true);
  });
  it("Explore's light presets hold the clock and give it back as it was", () => {
    const c = steppeClock({ start: 9.5 });
    const w = c;
    w.pin('dusk');
    expect(w.dayPhase).toBe('dusk');
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
