/**
 * Pine Hollow's weather, wired (PINE-HOLLOW-REMASTER PH-L10 + the weather half of PH-C7). One `installPineWeather` call in
 * main.ts, after the ambience and the quest; nothing else knows the weather exists. The state machine is
 * src/world/PineWeather.ts, the rain and the puddles src/world/PineWeatherFX.ts; this file turns their numbers into:
 *
 *   · THE SKY — the clock's `PineDayNight.mod` (overcast: the sun behind the deck, the sky and the IBL greyed; the fog
 *     thickened by the dawn fog, the rain's haze and the old-growth)
 *   · THE DAWN FOG — the height fog's floor raised and steepened so it pools in the bowl, the pond's basin and the creek's
 *     valley (the height term integrates along the ray: from the lookout the Hollow fills), the ground-mist sheets
 *     (Particles) thickened, dew on everything (a little uWet), thickest in the old-growth (a distance-fog × while the eye
 *     is in it); it burns off by mid-morning with the clock
 *   · THE RAIN — the wet PBR (`weatherUniforms.uWet`), the rings on the pond / creek / puddles (`waterWeather`), the wind
 *     up (`windBoost`), the ambience's rain beds (canopy vs open are its own) and its wet footsteps
 *   · C7 — in the rain the grazing herds drift in under the nearest big trees (their herd centre is held there from outside
 *     the AI: AnimalManager's own wander logic walks stragglers back to it) and back out after; in the dawn fog a fog bank
 *     closes round the Ghost Stag (the quest's pale lead, or the elite when it is near) — `weatherUniforms.fogBlob`
 *
 * Flags: `?weather=live|clear|fog|rain` (Settings ▸ Debug ▸ Weather; clear = the look before the weather); a held phase
 * starts halfway in. Dev: `window.__pineWeather`.
 */
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { TreeInstance } from '../world/placement';
import type { AnimalManager, Herd } from '../entities/AnimalManager';
import type { Particles } from '../world/Particles';
import type { ForestAmbience } from '../audio/ForestAmbience';
import { PineWeather, type PineWeatherMode } from '../world/PineWeather';
import { PineWeatherFX } from '../world/PineWeatherFX';
import { fogUniforms, weatherUniforms, volumetricFog } from '../world/Atmosphere';
import { waterWeather } from '../world/waterSurface';
import { windBoost, windUniforms, WIND_DIR } from '../world/wind';
import { OLD_GROWTH } from '../chunks/pineHollowLayout';
import { setting, onSettingChange } from '../ui/Settings';
import { TIER } from '../core/tier';
import { SEED } from '../core/config';

export interface PineWeatherHost {
  game: Game;
  sky: Sky;
  trees: readonly TreeInstance[];
  animals: AnimalManager;
  particles: Particles | null;
  ambience: ForestAmbience | null;
  /** a roof over (x, z) — the cabins' floors and porch decks */
  roofAt: (x: number, z: number) => boolean;
  /** the quest's pale stag, when it is out */
  stagAt: () => THREE.Vector3 | null;
  /** the eye (the player, or the free camera) */
  viewer: () => THREE.Vector3;
  /** the painted horizon's veil (HorizonMatte PaintedHorizon.veil): x the deck over it all, y the fog on its low rows */
  horizonVeil: { value: THREE.Vector2 } | null;
}

export interface PineWeatherRig { weather: PineWeather; fx: PineWeatherFX; setMode: (m: PineWeatherMode, at?: number) => void }

const sm = THREE.MathUtils.smoothstep;
/** the herds that shelter (the bear sits it out) */
const GRAZERS = new Set(['deer', 'elk', 'boar']);
/** a tree this tall (m) is a shelter; a herd looks this far (m) for one */
const BIG_TREE = 20, SHELTER_R = 90;
/** seconds the old home is held after the rain, so the herd walks back out */
const HOME_HOLD = 90;

/** 0 → 1 inside the old-growth's ellipse (pine-hollow.ts oldGrowthMask) */
function oldGrowthAt(x: number, z: number): number {
  return sm(-Math.hypot((x - OLD_GROWTH.x) / OLD_GROWTH.ax, (z - OLD_GROWTH.z) / OLD_GROWTH.az), -1.0, -0.72);
}

interface Shelter { home: { x: number; z: number }; spot: { x: number; z: number } | null; hold: number }

export function installPineWeather(h: PineWeatherHost): PineWeatherRig | null {
  const pine = h.sky.pine;
  if (pine === null) return null; // the fixed sky: no clock, no weather
  const atT = 0.5; // a held Fog / Rain starts halfway into its phase
  const weather = new PineWeather({ seed: SEED, mode: 'live' });
  weather.setMode(setting('weather'), atT);
  const fx = new PineWeatherFX({ sky: h.sky, trees: h.trees, roofAt: h.roofAt, phone: TIER === 'phone', seed: SEED }).build();
  h.game.scene.add(fx.group); // hidden while dry; in the scene before the boot's precompile, so the rain's program is built then
  onSettingChange('weather', (m) => { weather.setMode(m, atT); });

  // the height fog's own floor / falloff (Sky set them from the chunk's atmosphere): the dawn fog lifts and steepens them
  const baseH = fogUniforms.fogHeight.value, baseFall = fogUniforms.fogHeightFalloff.value;
  const baseMist = h.particles?.params.mistOpacity ?? 1;
  const big = h.trees.filter((t) => t.height >= BIG_TREE);
  const shelters = new Map<Herd, Shelter>();
  const wind = { x: 0, z: 0 };
  const fogCol = new THREE.Color(0.6, 0.65, 0.72);

  const pickShelter = (hd: Herd): { x: number; z: number } | null => {
    let best: TreeInstance | null = null, score = Infinity;
    for (const t of big) {
      const d = Math.hypot(t.x - hd.cx, t.z - hd.cz);
      if (d > SHELTER_R) continue;
      const s = d - 0.8 * t.height - 12 * fx.coverAt(t.x, t.z);
      if (s < score) { score = s; best = t; }
    }
    if (best === null) return null;
    const dx = hd.cx - best.x, dz = hd.cz - best.z, dl = Math.hypot(dx, dz) || 1;
    return { x: best.x + dx / dl * (best.r + 2.2), z: best.z + dz / dl * (best.r + 2.2) }; // under the crown, clear of the trunk
  };

  /**
   * C7: through the rain every grazing herd's wanders walk in under its shelter tree (AnimalManager.wanderGoal) and its
   * centre is held there; after it, the wanders walk back home a while, then the herd is its own again
   */
  const shelterHerds = (dt: number): void => {
    const raining = weather.rain > 0.3;
    for (const hd of h.animals.herds) {
      if (!GRAZERS.has(hd.kind)) continue;
      let s = shelters.get(hd);
      if (raining) {
        if (s === undefined) { s = { home: { x: hd.cx, z: hd.cz }, spot: pickShelter(hd), hold: HOME_HOLD }; shelters.set(hd, s); }
        s.hold = HOME_HOLD;
        if (s.spot !== null) { hd.cx = s.spot.x; hd.cz = s.spot.z; }
      } else if (s !== undefined && weather.rain < 0.05) {
        s.hold -= dt;
        if (s.hold <= 0) shelters.delete(hd);
      }
    }
  };
  h.animals.wanderGoal = (a) => {
    const hd = h.animals.herds[a.herd];
    if (hd === undefined) return null;
    const s = shelters.get(hd);
    if (s === undefined) return null;
    if (weather.rain > 0.3) return s.spot !== null ? { x: s.spot.x, z: s.spot.z, r: 3.5 } : null;
    return { x: s.home.x, z: s.home.z, r: 10 };   // the rain is over: back out to graze
  };

  const blob = new THREE.Vector3();
  /** C7: the Ghost Stag — the quest's lead when it is out, else the elite when it is within 140 m — in a fog bank at dawn */
  const stagInFog = (eye: THREE.Vector3): void => {
    let p = h.stagAt();
    if (p === null) {
      let bd = 140 * 140;
      for (const a of h.animals.animals) {
        if (!a.alive || a.kind !== 'deer' || a.variant !== 'ghost') continue;
        const d = a.position.distanceToSquared(eye);
        if (d < bd) { bd = d; p = a.position; }
      }
    }
    if (p === null || weather.fog < 0.02) { weatherUniforms.fogBlobAmt.value = 0; return; }
    blob.lerp(p, blob.y < -1e3 ? 1 : 0.2);
    weatherUniforms.fogBlob.value.set(blob.x, blob.y + 1.2, blob.z, 19);
    weatherUniforms.fogBlobAmt.value = 0.82 * weather.fog;
  };
  blob.set(0, -1e4, 0);

  const dev = { paused: false };
  h.game.onUpdate((dt) => {
    if (dev.paused) return; // dev: the numbers below left as they are, to poke at one by hand
    weather.update(dt, pine.phase);
    const eye = h.viewer();
    const fog = weather.fog, og = oldGrowthAt(eye.x, eye.z);
    // the sky: the deck, and the fog's densities (dawn fog, the rain's haze on top of the clock's own, the old-growth thickest)
    pine.mod.overcast = weather.overcast;
    pine.mod.fogDist = 1 + fog * (2 + 26 * og) + 0.4 * weather.rain;
    pine.mod.fogHeight = 1 + fog * (1.2 + 1.5 * og) + 0.6 * weather.rain;
    pine.mod.mist = fog;
    // the fog's floor: from −14 m (a thin haze on the hills) up to the bowl's floor (≈ 0 m; the pond −3, the creek −5), and
    // steeper, so it lies in the lows: × 3 in the pond's basin, × 6 down the creek, a quarter of it on the old-growth's swell
    fogUniforms.fogHeight.value = baseH + (0 - baseH) * fog;
    fogUniforms.fogHeightFalloff.value = baseFall + 0.23 * fog;
    volumetricFog.height = baseH; volumetricFog.falloff = baseFall; // the shafts keep the clear-sky floor (else a white-out)
    if (h.horizonVeil) h.horizonVeil.value.set(0.7 * weather.overcast, 0.75 * fog);
    if (h.particles) h.particles.params.mistOpacity = baseMist * (1 + 1.6 * fog) * (1 - 0.5 * weather.rain);
    // the rain: wet surfaces (and the dew in the dawn fog), rings on the water, the wind up, the beds
    weatherUniforms.uWet.value = Math.max(weather.wet, 0.22 * fog);
    waterWeather.uRainRings.value = weather.rain;
    windBoost.value = weather.wind;
    if (h.ambience) h.ambience.rain = weather.rain;
    const ws = 3 + 7 * windUniforms.uGust.value;
    wind.x = WIND_DIR.x * ws; wind.z = WIND_DIR.z * ws;
    const f = h.game.scene.fog;
    if (f instanceof THREE.Fog || f instanceof THREE.FogExp2) fogCol.copy(f.color);
    fx.update(dt, weather, fogCol, wind);
    shelterHerds(dt);
    stagInFog(eye);
  }, 'world.weather');

  const rig: PineWeatherRig = { weather, fx, setMode: (m, t = 0.5) => { weather.setMode(m, t); } };
  (window as unknown as { __pineWeather: unknown }).__pineWeather = {
    ...rig, dev, uniforms: { weatherUniforms, fogUniforms, waterWeather, windBoost, mod: pine.mod },
    /** dev (C7's evidence): every grazer's distance to the nearest big tree — the mean, and how many stand within 6 m */
    herdShelter: () => {
      const d: number[] = [];
      for (const hd of h.animals.herds) if (GRAZERS.has(hd.kind)) for (const m of hd.members) if (m.alive) {
        let best = Infinity;
        for (const t of big) best = Math.min(best, Math.hypot(t.x - m.position.x, t.z - m.position.z));
        d.push(best);
      }
      return { n: d.length, mean: Math.round(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length) * 10) / 10, under6: d.filter((v) => v < 6).length, sheltering: [...shelters.values()].filter((s) => s.spot !== null).length };
    },
  };
  return rig;
}
