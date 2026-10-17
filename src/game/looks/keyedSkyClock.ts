import { parseKeyedSky, SKY_PRESET, type KeyedSkyStyle } from '@wildshard/format/keyedSky';
import { dayClock, type DayClock } from './dayClock';
import type { DayLookPreset } from './dayLookPresets';

export type SkyPreset = DayLookPreset<typeof SKY_PRESET>;
export type KeyedSkyDay = DayClock<typeof SKY_PRESET, KeyedSkyStyle>;
/** Renderer-free clock. Each field, curve and preset is admitted JSON. */
export function keyedSkyDay(input: unknown): KeyedSkyDay {
  return dayClock(SKY_PRESET, parseKeyedSky(input), { lamps: 'lamps' });
}
