import { DayCycle, compassDir } from '#engine';

/** The sun hangs low in the south-west (azimuth 235°, 14° up), front right of the spawn view: always golden hour. */
export const SUN_DIR = compassDir(235, 14);

/** A day clock pinned at golden hour: the sun path is constant, so the light never moves. */
export function createDay(): DayCycle {
  return new DayCycle({ units: 'hour', start: 17.2,
    schedule: [{ phase: 'golden', from: 0, to: 24, minutes: 600 }],
    sun: { path: (_p, out) => out.copy(SUN_DIR), moon: (_p, out) => out.set(0, -1, 0) },
    fixed: { midday: 17.2, golden: 17.2, sunset: 17.2, night: 17.2 }, presets: { dawn: 17.2, noon: 17.2, dusk: 17.2, night: 17.2 } });
}
