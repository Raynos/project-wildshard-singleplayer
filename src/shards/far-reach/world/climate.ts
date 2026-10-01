import { DayCycle } from '#engine';

/** Sky Reach stays at golden hour: the clock starts at 17.4 h and a day lasts a week of play, so the sun barely moves. */
export function createGoldenDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 17.4,
    schedule: [{ phase: 'day', from: 0, to: 24, minutes: 10080 }],
    sun: { maxElevation: 55, azimuthOffset: 250 },
    fixed: { midday: 12, golden: 17.4, sunset: 18, night: 0 }, presets: { dawn: 6, noon: 12, dusk: 17.4, night: 0 } });
}
