import type { RGB } from '@wildshard/engine/level/data';
import { DayCycle, type DayCycleSpec, type ScheduleSeg } from '@wildshard/engine/world/dayCycle';
import type { SkyKey as SteppeKey } from './skyRig';

export const DEFAULT_SCHEDULE: ScheduleSeg[] = [
  { phase: 'dawn', from: 4.5, to: 7, minutes: 2.5 },
  { phase: 'day', from: 7, to: 16.5, minutes: 10 },
  { phase: 'golden', from: 16.5, to: 18, minutes: 3 },
  { phase: 'dusk', from: 18, to: 19.75, minutes: 3.5 },
  { phase: 'night', from: 19.75, to: 28.5, minutes: 7 },
];


export function nightKeys(day: SteppeKey): SteppeKey[] {
  const golden: SteppeKey = {
    ...day, el: 6,
    sun: [1.0, 0.72, 0.44], sunI: day.sunI * 0.85,
    zenith: [0.12, 0.26, 0.72], horizon: [0.95, 0.74, 0.55], glow: [1.0, 0.62, 0.3],
    hemiSky: [0.55, 0.62, 0.85], hemiGround: [0.32, 0.3, 0.16], hemiI: day.hemiI * 0.9, env: day.env * 0.85,
    fog: [0.86, 0.72, 0.6], fogSun: [1.0, 0.7, 0.42],
    shade: [0.12, 0.13, 0.34], rim: [1.7, 1.15, 0.7],
    cloudSun: [1.0, 0.72, 0.48], cloud: [1.0, 0.93, 0.88], planet: [1.0, 0.92, 0.84],
    shadowTint: [0.9, 0.94, 1.12], highTint: [1.1, 1.0, 0.88], sat: day.sat + 0.04,
    vol: [1.0, 0.72, 0.45], volS: day.volS * 1.2,
  };
  const sunset: SteppeKey = {
    ...golden, el: 1,
    sun: [1.0, 0.46, 0.22], sunI: day.sunI * 0.45,
    zenith: [0.1, 0.16, 0.45], horizon: [1.0, 0.5, 0.28], ground: [0.2, 0.18, 0.2], glow: [1.0, 0.42, 0.16],
    hemiSky: [0.42, 0.42, 0.66], hemiGround: [0.22, 0.17, 0.12], hemiI: day.hemiI * 0.75, env: day.env * 0.6,
    fog: [0.75, 0.46, 0.38], fogSun: [1.0, 0.45, 0.2],
    shade: [0.12, 0.1, 0.3], rim: [1.8, 0.8, 0.45],
    cloudSun: [1.0, 0.5, 0.3], cloud: [0.95, 0.72, 0.7], planet: [0.95, 0.75, 0.7],
    shadowTint: [0.88, 0.9, 1.15], highTint: [1.12, 0.96, 0.86],
    vol: [1.0, 0.5, 0.25], volS: day.volS * 1.1,
  };
  const afterglow: SteppeKey = {
    ...sunset, el: -3,
    sun: [0.8, 0.4, 0.3], sunI: 0,
    zenith: [0.06, 0.09, 0.28], horizon: [0.7, 0.34, 0.26], ground: [0.12, 0.1, 0.14], glow: [0.9, 0.3, 0.14],
    hemiSky: [0.3, 0.32, 0.55], hemiGround: [0.12, 0.1, 0.1], hemiI: day.hemiI * 0.7, env: day.env * 0.35,
    fog: [0.42, 0.3, 0.36], fogSun: [0.9, 0.4, 0.22],
    shade: [0.09, 0.08, 0.24], rim: [0.9, 0.5, 0.45],
    cloudSun: [0.9, 0.42, 0.34], cloud: [0.62, 0.46, 0.52], planet: [0.8, 0.62, 0.66],
    shadowTint: [0.86, 0.9, 1.18], highTint: [1.06, 0.95, 0.92], sat: day.sat - 0.02,
    vol: [0.8, 0.4, 0.3], volS: day.volS * 0.4, rays: 0,
  };
  const blue: SteppeKey = {
    ...afterglow, el: -9,
    sun: [0.5, 0.6, 1.0], sunI: 0,
    zenith: [0.02, 0.045, 0.14], horizon: [0.14, 0.14, 0.26], ground: [0.05, 0.06, 0.09], glow: [0.35, 0.16, 0.14], stars: 0.35,
    hemiSky: [0.22, 0.28, 0.5], hemiGround: [0.06, 0.07, 0.08], hemiI: day.hemiI * 0.7, env: day.env * 0.18,
    fog: [0.12, 0.13, 0.22], fogSun: [0.3, 0.22, 0.3],
    shade: [0.05, 0.07, 0.2], rim: [0.5, 0.55, 0.9],
    cloudSun: [0.4, 0.35, 0.5], cloud: [0.2, 0.2, 0.3], planet: [0.72, 0.72, 0.85],
    shadowTint: [0.84, 0.94, 1.24], highTint: [0.94, 0.98, 1.14], sat: day.sat - 0.12,
    vol: [0.4, 0.45, 0.7], volS: day.volS * 0.15, rays: 0,
  };
  const night: SteppeKey = {
    ...blue, el: -16,
    sun: [0.5, 0.6, 1.0], sunI: 0,
    zenith: [0.012, 0.026, 0.085], horizon: [0.06, 0.08, 0.16], ground: [0.03, 0.04, 0.06], glow: [0.1, 0.1, 0.16], stars: 1,
    hemiSky: [0.2, 0.28, 0.55], hemiGround: [0.05, 0.06, 0.08], hemiI: day.hemiI * 0.65, env: day.env * 0.12,
    fog: [0.05, 0.07, 0.14], fogSun: [0.14, 0.18, 0.32],
    shade: [0.04, 0.06, 0.18], rim: [0.45, 0.6, 1.05],
    cloudSun: [0.3, 0.34, 0.5], cloud: [0.1, 0.12, 0.2], planet: [0.62, 0.66, 0.8],
    shadowTint: [0.82, 0.95, 1.28], highTint: [0.9, 0.98, 1.16], lift: [0.0, 0.006, 0.02], sat: day.sat - 0.18,
    vol: [0.35, 0.45, 0.8], volS: day.volS * 0.25, rays: 0,
  };
  return [golden, sunset, afterglow, blue, night];
}

export const NALATI_DAY: DayCycleSpec<SteppeKey> = {
 units: 'hour', start: 16, schedule: DEFAULT_SCHEDULE, sun: { maxElevation: 58, azimuthOffset: 0 }, pauseOnPin: true,
 fixed: { midday: 12, golden: 17.1, sunset: 17.85, night: 22.5 }, presets: { dawn: 5.6, noon: 12, dusk: 18.15, night: 22.5 },
};
export interface DayClockOpts { start?: number; schedule?: ScheduleSeg[]; maxElevation?: number; azimuthOffset?: number }
export function steppeClock(opts: DayClockOpts = {}): DayCycle<SteppeKey> {
 return new DayCycle({ ...NALATI_DAY, start: opts.start ?? 16, schedule: opts.schedule ?? DEFAULT_SCHEDULE, sun: { maxElevation: opts.maxElevation ?? 58, azimuthOffset: opts.azimuthOffset ?? 0 } });
}
export function clockForSun(sun: { azimuth: number; elevation: number }, opts: Omit<DayClockOpts, 'start' | 'azimuthOffset'> = {}): DayCycle<SteppeKey> {
 const maxEl = opts.maxElevation ?? 58;
 const x = Math.PI - Math.asin(Math.min(1, Math.max(-1, sun.elevation / maxEl)));
 const hour = 6 + x * 12 / Math.PI, az = 90 + (hour - 6) * 15;
 return steppeClock({ ...opts, start: hour, azimuthOffset: sun.azimuth - az });
}

/** Numeric keyframes; the clock selects/interpolates, the rig only applies them. */
export function blendSteppeKey(out: SteppeKey, a: SteppeKey, b: SteppeKey, t: number): void {
 const rgb = (target: RGB, x: RGB, y: RGB): void => { target[0]=x[0]+(y[0]-x[0])*t; target[1]=x[1]+(y[1]-x[1])*t; target[2]=x[2]+(y[2]-x[2])*t; };
 const n = (x: number, y: number): number => x+(y-x)*t;
 rgb(out.sun,a.sun,b.sun);
 out.sunI = n(a.sunI,b.sunI);
 rgb(out.zenith,a.zenith,b.zenith);
 rgb(out.horizon,a.horizon,b.horizon);
 rgb(out.ground,a.ground,b.ground);
 rgb(out.glow,a.glow,b.glow);
 out.stars = n(a.stars,b.stars);
 rgb(out.hemiSky,a.hemiSky,b.hemiSky);
 rgb(out.hemiGround,a.hemiGround,b.hemiGround);
 out.hemiI = n(a.hemiI,b.hemiI);
 out.env = n(a.env,b.env);
 rgb(out.fog,a.fog,b.fog);
 rgb(out.fogSun,a.fogSun,b.fogSun);
 rgb(out.shade,a.shade,b.shade);
 rgb(out.rim,a.rim,b.rim);
 rgb(out.cloudSun,a.cloudSun,b.cloudSun);
 rgb(out.cloud,a.cloud,b.cloud);
 rgb(out.planet,a.planet,b.planet);
 rgb(out.shadowTint,a.shadowTint,b.shadowTint);
 rgb(out.highTint,a.highTint,b.highTint);
 rgb(out.lift,a.lift,b.lift);
 rgb(out.gain,a.gain,b.gain);
 out.sat = n(a.sat,b.sat);
 out.contrast = n(a.contrast,b.contrast);
 rgb(out.vol,a.vol,b.vol);
 out.volS = n(a.volS,b.volS);
 out.rays = n(a.rays,b.rays);
}
