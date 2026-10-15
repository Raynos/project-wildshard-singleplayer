import type { SkyBackdropTargets } from '@wildshard/engine/render/look';
import { setting } from '@wildshard/engine/ui/Settings';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import * as THREE from 'three';
import type { DayClock, DayCurves } from './dayClock';
import type { DayLookPreset, DayLookSchema } from './dayLookPresets';

/**
 * A keyed day clock on a page (SHARD-PLATFORM W2 C2; Pine Hollow's keyed sky and Driftwood's faceted day): the backdrop's
 * side of `dayClock` — the clock started where the URL or Settings ▸ Time of day put it (`runDayClock`) and the scene's key
 * lights turned with it (`driveDayLight`). The clock itself stays renderer-free (`./dayClock`, the headless host's).
 */

/**
 * The clock a backdrop runs, at the URL's / Settings' time: Settings ▸ Time of day parks it at a pick (paused), else `?tod=`
 * (a phase, or a name of the row's `phases`) or the row's start; `?clock=` seconds a cycle (default `cycleSeconds`).
 * `curves` replace the row's (a backdrop that lays its weather over them).
 */
export function runDayClock<S extends DayLookSchema>(day: DayClock<S>, cycleSeconds: number, curves: DayCurves = day.spec.curves): DayCycle<DayLookPreset<S>> {
  const style = day.style, qs = new URLSearchParams(location.search);
  const todRaw = qs.get('tod') ?? '';
  const named = style.phases !== undefined && Object.hasOwn(style.phases, todRaw) ? style.phases[todRaw] : undefined;
  const tod = named ?? Number.parseFloat(todRaw), cycle = Number.parseFloat(qs.get('clock') ?? '');
  const time = setting('time'); // 'live' whenever ?tod / ?clock are in the URL
  const frozen = time !== 'live';
  const clock = new DayCycle({ ...day.spec, curves, start: frozen ? style.fixed[time] : Number.isFinite(tod) ? ((tod % 1) + 1) % 1 : style.start });
  clock.cycle = Number.isFinite(cycle) && cycle > 1 ? cycle : cycleSeconds;
  clock.paused = frozen;
  return clock;
}


/** The key light a preset sets: its colour and intensity (before the fade), the hemisphere fill. */
export interface DayLightRow { readonly light: THREE.Color; readonly lightI: number; readonly hemiSky: THREE.Color; readonly hemiGround: THREE.Color; readonly hemiI: number }

const want = new THREE.Vector3();
/**
 * The scene's key lights at phase p (the same lights, never added or removed): the light body (`sun` by day, `moon` by night)
 * as the sun direction and the fog's in-scatter direction, the shadow direction in `step`-radian steps (`snap`: at once — a
 * boot, a Time of day pick; `hold`: a step still crossfading waits), the CSM lights' colour and intensity × `scale` × the
 * fade, the hemisphere fill. Returns the fade.
 */
export function driveDayLight<S extends DayLookSchema>(T: SkyBackdropTargets, day: DayClock<S>, p: number, sun: THREE.Vector3, moon: THREE.Vector3, row: DayLightRow, scale: number, step: number, snap: boolean, hold?: () => boolean): number {
  const dir = p < day.style.dayFraction ? sun : moon, fade = day.fadeAt(p, sun);
  T.sunDir.copy(dir);
  want.copy(dir).negate();
  // the sun ↔ moon swap is one big step; a small one waits for the last one's fade
  if (snap || (want.angleTo(T.lightDirection) > step && !(hold?.() ?? false))) T.lightDirection.copy(want);
  for (const l of T.lights) { l.color.copy(row.light); l.intensity = row.lightI * scale * fade; }
  T.hemi.color.copy(row.hemiSky); T.hemi.groundColor.copy(row.hemiGround); T.hemi.intensity = row.hemiI;
  T.fogU.fogSunDir.value.copy(dir);
  return fade;
}
