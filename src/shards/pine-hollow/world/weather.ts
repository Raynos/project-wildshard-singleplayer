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
import { createClientChannels } from '@wildshard/game/plugin/ui';
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
import { waterWeather } from './water';
import { windBoost, windUniforms, WIND_DIR } from '@wildshard/engine/world/wind';
import type { Particles } from '@wildshard/game/systems/looks/particles';
import type { ForestAmbience } from '../runtime/audio/ambience';
import { pineBackdrop } from '../look/skyBackdrop';
import { PineWeather, wetProjectile, type PineWeatherMode } from './weatherProfile';
import { loadRainBake, RainFx, type RainBake } from '../runtime/looks/rainFx';
import rainRows from '../data/rain.json' with { type: 'json' };
import { HerdShelter } from '../runtime/species/herdShelter';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { PINE_CAVE_HOOD, PINE_HERD_SHELTER, PINE_RAIN, PINE_RAIN_PROGRAMS } from '../data/weatherLook';
import { BEAR_CAVE } from '../data/layout';
import { PINE_WEATHER_CHANNELS } from '../data/weatherChannels';

type ShardContext = Parameters<typeof installEnteredRuntimeService>[0];
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
  /** the rain's offline bake (`loadPineRain`) */
  rain: RainBake;
}

/** The tier's rain bake (generators/bake-pine-rain.mjs: the puddles, the crowns' cover), fetched before `installWeather`. */
export const loadPineRain = (): Promise<RainBake> => loadRainBake(`/assets/pine-hollow/baked/rain${TIER === 'phone' ? '.phone' : ''}.bin`, rainRows[TIER]);

export interface PineWeatherRig { weather: PineWeather; fx: InstanceType<typeof RainFx>; setMode: (m: PineWeatherMode, at?: number) => void }

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
  const fx = new RainFx({ name: 'pine-weather', roofAt: h.roofAt, phone: TIER === 'phone', seed: SEED, look: PINE_RAIN, programs: PINE_RAIN_PROGRAMS, baked: h.rain, hood }).build();
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

  const veil = { x: { value: 0 }, y: { value: 0 } };
  const roots = new Map<string, unknown>(Object.entries({ mod: pine.mod, fog: fogUniforms, weather: weatherUniforms, volume: volumetricFog,
    veil, particles: h.particles?.params ?? null, water: waterWeather, wind: windBoost, windVector: wind }));
  const channels = PINE_WEATHER_CHANNELS.flatMap(row => {
    if (row.program === null) return [];
    const lane = createClientChannels(row.program);
    return [{ lane, ports: lane.bindNumeric([{ property: 'value', target: row.owner, path: row.path, nullable: row.owner === 'volume' }], roots) }];
  });
  const first = channels[0]; if (first === undefined) throw new Error('Weather projections missing');
  const borrowed = first.lane.bindNumeric(PINE_WEATHER_CHANNELS.filter(row => row.restore).map(row => ({ property: 'value', target: row.owner, path: row.path, restore: true, nullable: row.owner === 'volume' })), roots);
  const answers = (scope: Scope): void => {
    h.game.app.events.answer('projectile.modify', (input) => h.game.app.levelScope === h.game.levelScope ? wetProjectile(input, weather.rain) : input, scope);
    h.game.app.events.answer('creature.wander-goal', (query) => {
      if (h.game.app.levelScope !== h.game.levelScope) return query;
      return { ...query, goal: shelter.wanderGoal(query.herd, weather.rain) ?? query.goal };
    }, scope);
  };
  if (entered === undefined) answers(ctx?.scope ?? h.game.levelScope);
  else installEnteredRuntimeService(entered, (scope) => {
    const restore = borrowed.capture();
    const mod = { ...pine.mod }, fogBlob = weatherUniforms.fogBlob.value.clone(), horizon = h.horizonVeil?.value.clone();
    answers(scope);
    scope.onDispose(onSettingChange('weather', (mode) => { weather.setMode(mode, atT); }));
    scope.onDispose(() => {
      restore();
      weatherUniforms.fogBlob.value.copy(fogBlob); Object.assign(pine.mod, mod);
      if (h.horizonVeil && horizon !== undefined) h.horizonVeil.value.copy(horizon);
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
    const hold = h.game.app.events.ask('weather.hold', weatherHold.k); // a sealed boss room's own fog wins (F-L7)
    const room = practiceRoom.open;
    const values = [weather.overcast, weather.fog, weather.rain, weather.wet, weather.wind, windUniforms.uGust.value,
      hold, eye.x, eye.z, baseH, baseFall, baseMist, Number(room), WIND_DIR.x, WIND_DIR.z];
    for (const { ports, lane } of channels) {
      lane.evaluate({ time: 0, delta: dt, values }); ports.apply(lane.frame);
    }
    if (h.horizonVeil) h.horizonVeil.value.set(veil.x.value, veil.y.value);
    if (h.ambience) h.ambience.rain = room ? 0 : weather.rain;
    fx.update(dt, weather, wind, h.game.camera);
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
