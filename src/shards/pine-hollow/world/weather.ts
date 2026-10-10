/**
 * Pine Hollow's weather, wired (PINE-HOLLOW-REMASTER PH-L10 + the weather half of PH-C7). One `installPineWeather` call in
 * main.ts, after the ambience and the quest; nothing else knows the weather exists. The state machine is
 * src/shards/pine-hollow/world/weatherProfile.ts, the rain and the puddles the SDK's rain system (@wildshard/sdk/looks/rainFx)
 * dressed by data/weatherLook.ts (its sizes, its programs, the bear cave's hood); this file turns their numbers into:
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
 * The mode: pause ▸ Settings ▸ Debug ▸ Sky & weather ▸ Weather (live | clear | fog | rain; clear = the look before the
 * weather; capture scripts set it with debugSettings); a held phase starts halfway in. Dev: `window.__pineWeather`.
 *
 * A scripted room can take the air over: `weatherHold.k` (0 … 1) stands the weather's fog down where the eye is — the
 * Antler King's sealed clearing sets it, so the fight's own fog (×26 on the clock's density) is the whole fog in there.
 * E322 F-L7: on top of the weather's ×29 old-growth fog it was ~100 % pale fog a few metres out, the King a white ghost.
 */
import type { Scope } from '@wildshard/engine/app/scope';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import type { Game } from '@wildshard/engine/core/Game';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { TIER } from '@wildshard/engine/core/tier';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { LevelContext } from '@wildshard/engine/level/context';
import { setting, onSettingChange } from '@wildshard/engine/ui/Settings';
import { fogUniforms, weatherUniforms, volumetricFog } from '@wildshard/engine/world/Atmosphere';
import type { TreeInstance } from '@wildshard/engine/world/forest/placement';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { waterWeather } from '@wildshard/engine/world/waterSurface';
import { windBoost, windUniforms, WIND_DIR } from '@wildshard/engine/world/wind';
import type { Particles } from '@wildshard/game/systems/looks/particles';
import type { ForestAmbience } from '../runtime/audio/ambience';
import { pineBackdrop } from '../look/skyBackdrop';
import { PineWeather, wetProjectile, type PineWeatherMode } from './weatherProfile';
import { RainFx } from '@wildshard/sdk/looks/rainFx';
import { HerdShelter } from '@wildshard/sdk/species/herdShelter';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { PINE_CAVE_HOOD, PINE_HERD_SHELTER, PINE_RAIN, PINE_RAIN_PROGRAMS } from '../data/weatherLook';
import { BEAR_CAVE, OLD_GROWTH } from '../layout';

/** 0 … 1: how far a scripted room's own air replaces the weather's fog (the Antler King's seal, src/shards/pine-hollow/combat/antlerKing.ts) */
export const weatherHold = { k: 0 };

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

export interface PineWeatherRig { weather: PineWeather; fx: InstanceType<typeof RainFx>; setMode: (m: PineWeatherMode, at?: number) => void }

const sm = THREE.MathUtils.smoothstep;

/** 0 → 1 inside the old-growth's ellipse (pine-hollow.ts oldGrowthMask) */
function oldGrowthAt(x: number, z: number): number {
  return sm(-Math.hypot((x - OLD_GROWTH.x) / OLD_GROWTH.ax, (z - OLD_GROWTH.z) / OLD_GROWTH.az), -1.0, -0.72);
}

export function installWeather(ctx: ShardContext, host: PineWeatherHost): PineWeatherRig | null {
  return installPineWeather(host, ctx, retainsRuntimeServices(ctx) ? ctx : undefined);
}

export function installPineWeather(h: PineWeatherHost, ctx?: LevelContext, entered?: ShardContext): PineWeatherRig | null {
  const pine = pineBackdrop(h.sky);
  if (pine === null) return null; // the fixed sky: no clock, no weather
  const atT = 0.5; // a held Fog / Rain starts halfway into its phase
  const weather = new PineWeather({ seed: SEED, mode: 'live' });
  weather.setMode(setting('weather'), atT);
  // the rain (PH-L10, E322 F-L5): the cover map's crowns and roofs, and the bear cave's mouth under its arch, where none falls
  const hood = { x: BEAR_CAVE.x, z: BEAR_CAVE.z, rot: BEAR_CAVE.rot, hw: PINE_CAVE_HOOD.hw, lz0: PINE_CAVE_HOOD.lz0, lz1: PINE_CAVE_HOOD.lz1, top: terrainHeight(BEAR_CAVE.x, BEAR_CAVE.z) + PINE_CAVE_HOOD.up };
  const fx = new RainFx({ name: 'pine-weather', sky: h.sky, trees: h.trees, roofAt: h.roofAt, phone: TIER === 'phone', seed: SEED, look: PINE_RAIN, programs: PINE_RAIN_PROGRAMS, hood }).build();
  h.game.scene.add(fx.group); // hidden while dry; in the scene before the boot's precompile, so the rain's program is built then
  if (entered === undefined) {
    const stopSetting = onSettingChange('weather', (m) => { weather.setMode(m, atT); });
    (ctx?.scope ?? h.game.levelScope).onDispose(stopSetting);
  }

  // the height fog's own floor / falloff (Sky set them from the chunk's atmosphere): the dawn fog lifts and steepens them
  const baseH = fogUniforms.fogHeight.value, baseFall = fogUniforms.fogHeightFalloff.value;
  const baseMist = h.particles?.params.mistOpacity ?? 1;
  const shelter = new HerdShelter(h.animals, h.trees, (x, z) => fx.coverAt(x, z), PINE_HERD_SHELTER);
  const wind = { x: 0, z: 0 };
  const fogCol = new THREE.Color(0.6, 0.65, 0.72);

  const answers = (scope: Scope): void => {
    h.game.app.events.answer('projectile.modify', (input) => h.game.app.levelScope === h.game.levelScope ? wetProjectile(input, weather.rain) : input, scope);
    h.game.app.events.answer('creature.wander-goal', (query) => {
      if (h.game.app.levelScope !== h.game.levelScope) return query;
      return { ...query, goal: shelter.wanderGoal(query.herd, weather.rain) ?? query.goal };
    }, scope);
  };
  if (entered === undefined) answers(ctx?.scope ?? h.game.levelScope);
  else installEnteredRuntimeService(entered, (scope) => {
    const borrowed = {
      height: fogUniforms.fogHeight.value, falloff: fogUniforms.fogHeightFalloff.value,
      wet: weatherUniforms.uWet.value, fogBlob: weatherUniforms.fogBlob.value.clone(), fogBlobAmt: weatherUniforms.fogBlobAmt.value,
      rain: waterWeather.uRainRings.value, wind: windBoost.value, mod: { ...pine.mod },
      volumeHeight: volumetricFog.height, volumeFalloff: volumetricFog.falloff,
      mist: h.particles?.params.mistOpacity, veil: h.horizonVeil?.value.clone(),
    };
    answers(scope);
    scope.onDispose(onSettingChange('weather', (mode) => { weather.setMode(mode, atT); }));
    scope.onDispose(() => {
      fogUniforms.fogHeight.value = borrowed.height; fogUniforms.fogHeightFalloff.value = borrowed.falloff;
      weatherUniforms.uWet.value = borrowed.wet; weatherUniforms.fogBlob.value.copy(borrowed.fogBlob); weatherUniforms.fogBlobAmt.value = borrowed.fogBlobAmt;
      waterWeather.uRainRings.value = borrowed.rain; windBoost.value = borrowed.wind;
      volumetricFog.height = borrowed.volumeHeight; volumetricFog.falloff = borrowed.volumeFalloff;
      Object.assign(pine.mod, borrowed.mod);
      if (h.particles && borrowed.mist !== undefined) h.particles.params.mistOpacity = borrowed.mist;
      if (h.horizonVeil && borrowed.veil !== undefined) h.horizonVeil.value.copy(borrowed.veil);
      // Camera-local rain is an entered service; resident ground dressing and weather state stay frozen.
      fx.group.visible = false;
    });
    fx.group.visible = true;
  });

  const blob = new THREE.Vector3();
  /** C7: the Ghost Stag — the quest's lead when it is out, else the elite when it is within 140 m — in a fog bank at dawn */
  const stagInFog = (eye: THREE.Vector3, dt: number): void => {
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
    blob.lerp(p, blob.y < -1e3 ? 1 : 1 - 0.8 ** (dt * 60));
    weatherUniforms.fogBlob.value.set(blob.x, blob.y + 1.2, blob.z, 19);
    weatherUniforms.fogBlobAmt.value = 0.82 * weather.fog;
  };
  blob.set(0, -1e4, 0);

  const dev = { paused: false };
  const update = (dt: number): void => {
    if (dev.paused) return; // dev: the numbers below left as they are, to poke at one by hand
    const eye = h.viewer();
    const stay = 1 - THREE.MathUtils.clamp(h.game.app.events.ask('weather.hold', weatherHold.k), 0, 1); // a sealed boss room's own fog wins (F-L7)
    const fog = weather.fog * stay, haze = weather.rain * stay, og = oldGrowthAt(eye.x, eye.z);
    // the sky: the deck, and the fog's densities (dawn fog, the rain's haze on top of the clock's own, the old-growth thickest)
    pine.mod.overcast = weather.overcast;
    pine.mod.fogDist = 1 + fog * (2 + 26 * og) + 0.4 * haze;
    pine.mod.fogHeight = 1 + fog * (1.2 + 1.5 * og) + 0.6 * haze;
    pine.mod.mist = fog;
    // the fog's floor: from −14 m (a thin haze on the hills) up to the bowl's floor (≈ 0 m; the pond −3, the creek −5), and
    // steeper, so it lies in the lows: × 3 in the pond's basin, × 6 down the creek, a quarter of it on the old-growth's swell
    fogUniforms.fogHeight.value = baseH + (0 - baseH) * fog;
    fogUniforms.fogHeightFalloff.value = baseFall + 0.23 * fog;
    volumetricFog.height = baseH; volumetricFog.falloff = baseFall; // the shafts keep the clear-sky floor (else a white-out)
    if (h.horizonVeil) h.horizonVeil.value.set(0.7 * weather.overcast, 0.75 * fog);
    if (h.particles) h.particles.params.mistOpacity = baseMist * (1 + 1.6 * fog) * (1 - 0.5 * weather.rain);
    // the rain: wet surfaces (and the dew in the dawn fog), rings on the water, the wind up, the beds. A practice room (the
    // arena, a playground) is out of the weather: no wet sheen, no rain beds or wet steps in it (E350 F-X4; back on exit)
    const room = practiceRoom.open;
    weatherUniforms.uWet.value = room ? 0 : Math.max(weather.wet, 0.22 * fog);
    waterWeather.uRainRings.value = weather.rain;
    windBoost.value = weather.wind;
    if (h.ambience) h.ambience.rain = room ? 0 : weather.rain;
    const ws = 3 + 7 * windUniforms.uGust.value;
    wind.x = WIND_DIR.x * ws; wind.z = WIND_DIR.z * ws;
    const f = h.game.scene.fog;
    if (f instanceof THREE.Fog || f instanceof THREE.FogExp2) fogCol.copy(f.color);
    fx.update(dt, weather, fogCol, wind, h.game.camera);
    shelter.update(dt, weather.rain);
    stagInFog(eye, dt);
  };
  const state = (dt: number): void => { if (!dev.paused) weather.update(dt, pine.clock); };
  if (ctx) {
    ctx.system({ id: 'shard.pine.weather.state', phase: 'update', after: ['audio'], before: ['world.life', 'first hints', 'main.frame'], tick: 'weather', run: state });
    ctx.system({ id: 'shard.pine.weather', phase: 'update', after: ['shard.pine.weather.state'], before: ['world.life', 'first hints', 'main.frame'], run: update });
  } else {
    const system = { id: 'world.weather.state', phase: 'update' as const, tick: 'weather', run: state };
    h.game.onUpdate((dt) => { const due = h.game.app.scheduler.systemDt(system, dt); if (due > 0) state(due); }, 'world.weather.state');
    h.game.onUpdate(update, 'world.weather');
  }

  const rig: PineWeatherRig = { weather, fx, setMode: (m, t = 0.5) => { weather.setMode(m, t); } };
  const debug = {
    ...rig, dev, uniforms: { weatherUniforms, fogUniforms, waterWeather, windBoost, mod: pine.mod },
    /** dev (C7's evidence): every grazer's distance to the nearest big tree — the mean, and how many stand within 6 m */
    herdShelter: () => shelter.stats(),
  };
  if (ctx) ctx.debug.expose('pine.weather', debug);
  else h.game.levelScope.onDispose(h.game.app.debug.scopedExpose('pine.weather', debug));
  return rig;
}
