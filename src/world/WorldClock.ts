/**
 * WorldClock — one small interface over the two day clocks (NALATI-MERGE F8, the user's wave-8 pick: "one small interface
 * over DayNight + DayClock now, one engine clock later"): Driftwood's `DayNight` (src/world/DayNight.ts, the remaster's L7)
 * and Nalati's `DayClock` (src/world/DayClock.ts, B10). What reads or drives "the time of day" goes through this, never
 * through either clock, so it works on every shard that has one:
 *
 *   setActiveClock(dayNightClock(sky.dayNight))  /  setActiveClock(dayClockClock(weather.clock))   // main.ts, once
 *   activeClock()?.setTime('golden')     // Settings ▸ Time of day: park at a pick, or 'live' to run on
 *   activeClock()?.pin('dusk') … pin(null)   // Explore's light presets: hold a preset while you look, then give it back
 *   activeClock()?.hour / .phase / .night / .body   // the HUD's sun / moon glyph (H2) and anything else that only reads
 *
 * Pine Hollow has no clock: `activeClock()` is null there. The adapters only call what each clock already exposes, so
 * neither look changes.
 */
import type { OptionValue } from '../ui/Settings';
import type { DayNight } from './DayNight';
import type { DayClock, DayPhase } from './DayClock';
import { shardSlot } from '../core/shardState';

/** Settings ▸ Time of day's values: 'live' runs the clock, the rest park it */
export type TimePick = OptionValue<'time'>;
/** Explore's light presets */
export type LightPreset = 'dawn' | 'noon' | 'dusk' | 'night';

export interface WorldClock {
  /** the hour, 0..24 (sunrise 6, noon 12, sunset 18) */
  readonly hour: number;
  /** the part of the day, on DayClock's schedule */
  readonly phase: DayPhase;
  /** 0 = broad day … 1 = full night */
  readonly night: number;
  /** what lights the world now: the sun, or the moon */
  readonly body: 'sun' | 'moon';
  /** Settings ▸ Time of day: park the sky at a pick, or run the clock on from where it stands */
  setTime: (t: TimePick) => void;
  /** hold a light preset (Explore; call it every frame while held — a live clock would move on), null = back to how it was */
  pin: (preset: LightPreset | null) => void;
}

/** DayClock's schedule (DEFAULT_SCHEDULE) by the hour */
export function phaseOfHour(h: number): DayPhase {
  const x = ((h % 24) + 24) % 24;
  return x >= 4.5 && x < 7 ? 'dawn' : x >= 7 && x < 16.5 ? 'day' : x >= 16.5 && x < 18 ? 'golden' : x >= 18 && x < 19.75 ? 'dusk' : 'night';
}

const DAY = 20 / 24; // DayNight: [0, DAY) of its phase is sunrise → sunset, the rest the night
/** Explore's presets on DayNight's phase (what ModelExplorer pinned before F8) */
const DN_PRESET: Record<LightPreset, number> = { dawn: 0.03, noon: 0.42, dusk: 0.8, night: 0.92 };

/** Driftwood's clock (DayNight) behind the interface */
export function dayNightClock(dn: DayNight): WorldClock {
  let saved: number | null = null;
  const hourOf = (p: number): number => (p < DAY ? 6 + (12 * p) / DAY : (18 + (12 * (p - DAY)) / (1 - DAY)) % 24);
  return {
    get hour() { return hourOf(dn.phase); },
    get phase() { return phaseOfHour(hourOf(dn.phase)); },
    get night() { return dn.night; },
    get body() { return dn.phase < DAY ? 'sun' : 'moon'; },
    setTime: (t) => { dn.setTime(t); },
    pin: (preset) => {
      if (preset === null) { if (saved !== null) dn.phase = saved; saved = null; return; }
      saved ??= dn.phase;
      dn.phase = DN_PRESET[preset];
    },
  };
}

/** Settings ▸ Time of day's picks on DayClock's hours (sunset: the sun on the horizon, before DayClock's 'dusk' key) */
const DC_PICK: Record<Exclude<TimePick, 'live'>, number> = { midday: 12, golden: 17.1, sunset: 17.85, night: 22.5 };
const DC_PRESET: Record<LightPreset, number> = { dawn: 5.6, noon: 12, dusk: 18.15, night: 22.5 };

/** Nalati's clock (DayClock) behind the interface. `saved`: the pick to park at on boot (Settings ▸ Time of day), unless the URL set the time */
export function dayClockClock(c: DayClock, saved: TimePick = 'live'): WorldClock {
  let held: { hour: number; paused: boolean } | null = null;
  const setTime = (t: TimePick): void => {
    if (t === 'live') { c.paused = false; return; }
    c.set(DC_PICK[t]);
    c.paused = true;
  };
  if (saved !== 'live') setTime(saved);
  return {
    get hour() { return c.hour; },
    get phase() { return c.phase; },
    get night() { const el = c.sunElevation; return el >= 6 ? 0 : el <= -10 ? 1 : (6 - el) / 16; },
    get body() { return c.sunElevation > -2 ? 'sun' : 'moon'; },
    setTime,
    pin: (preset) => {
      if (preset === null) { if (held !== null) { c.set(held.hour); c.paused = held.paused; } held = null; return; }
      held ??= { hour: c.hour, paused: c.paused };
      if (Math.abs(c.hour - DC_PRESET[preset]) > 1e-3) c.set(DC_PRESET[preset]);
      c.paused = true;
    },
  };
}

let active: WorldClock | null = null;
/** main.ts: the shard's clock, once built (null: a shard with a fixed sun) */
export function setActiveClock(c: WorldClock | null): void { active = c; }
/** the running shard's clock, or null (Pine Hollow: a fixed sun) */
export function activeClock(): WorldClock | null { return active; }

// E155 (src/core/shardState.ts): the running shard's clock
shardSlot('world.clock', () => active, (v) => { active = v; });
