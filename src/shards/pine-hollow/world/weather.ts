/**
 * Pine Hollow's weather, wired (PINE-HOLLOW-REMASTER PH-L10 + the weather half of PH-C7). One `installPineWeather` call in
 * main.ts, after the ambience and the quest; nothing else knows the weather exists. The state machine is
 * the admitted world/weather.json numeric program, the rain and the puddles the SDK's rain presentation
 * (@wildshard/sdk/looks/rainPresentation) on world/rain.json's rows; this file turns their numbers into:
 *
 *   · THE SKY — the clock's `PineDayNight.mod` (overcast: the sun behind the deck, the sky and the IBL greyed; the fog
 *     thickened by the dawn fog, the rain's haze and the old-growth)
 *   · THE DAWN FOG — the height fog's floor raised and steepened so it pools in the bowl, the pond's basin and the creek's
 *     valley (the height term integrates along the ray: from the lookout the Hollow fills), the ground-mist sheets
 *     (Particles) thickened, dew on everything (a little uWet), thickest in the old-growth (a distance-fog × while the eye
 *     is in it); it burns off by mid-morning with the clock
 *   · THE RAIN — the wet PBR (`weatherUniforms.uWet`), the rings on the pond / creek / puddles (the rain's `rings`), the wind
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
import type { ForestWeatherObservations } from '@wildshard/game/looks/forestWeather';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import type { Scope } from '@wildshard/engine/app/scope';
import { installChannelPrograms } from '@wildshard/game/plugin/channelPrograms';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { setting, onSettingChange } from '@wildshard/engine/ui/Settings';
import { fogUniforms, weatherUniforms, volumetricFog } from '@wildshard/engine/world/Atmosphere';
import { windBoost, windUniforms, WIND_DIR } from '@wildshard/engine/world/wind';
import { keyedSkyOf } from '@wildshard/game/looks/keyedSky';
import { installWeatherContinuation } from '@wildshard/game/plugin/weather';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import { parseWeatherProgram, type WeatherProgram } from '@wildshard/format/weatherProgram';
import { wetFlight } from '@wildshard/engine/combat/ammo';
import type { RainPresentation } from '@wildshard/sdk/looks/rainPresentation';
import { HerdShelter, populationShelter } from '@wildshard/sdk/populationShelter';

type ShardContext = Parameters<typeof installEnteredRuntimeService>[0];
/** 0 … 1: how far a scripted room's own air replaces the weather's fog (the Antler King's seal, src/shards/pine-hollow/combat/antlerKing.ts) */
export const weatherHold = { k: 0 };

export interface PineWeatherRig { weather: WeatherContinuation; fx: RainPresentation; setMode: (m: string, at?: number) => void }

export async function installWeather(ctx: ShardContext, host: ForestWeatherObservations, fx: RainPresentation): Promise<PineWeatherRig | null> {
  const rows=parseWeatherProgram(JSON.parse(new TextDecoder().decode(await ctx.product.file('world/weather.json'))));
  const shelterRows = populationShelter(JSON.parse(new TextDecoder().decode(await ctx.product.file('actors/shelter.json'))));
  return installPineWeather(host, fx, ctx, rows, shelterRows, retainsRuntimeServices(ctx) ? ctx : undefined);
}

function installPineWeather(h: ForestWeatherObservations, fx: RainPresentation, ctx: ShardContext, rows: WeatherProgram, shelterRows: ReturnType<typeof populationShelter>, entered?: ShardContext): PineWeatherRig | null {
  const pine = keyedSkyOf(h.sky);
  if (pine === null) return null; // the fixed sky: no clock, no weather
  const atT = 0.5; // a held Fog / Rain starts halfway into its phase
  const dev={paused:false};
  const installation={seed:SEED,system:ctx.system,state:dev};
  const weather=installWeatherContinuation(installation,rows,pine.clock,'live');
  weather.setMode(setting('weather'), atT);
  h.game.scene.add(fx.group); // hidden while dry; in the scene before the boot's precompile, so the rain's program is built then
  if (entered === undefined) {
    const stopSetting = onSettingChange('weather', (m) => { weather.setMode(m, atT); });
    ctx.scope.onDispose(stopSetting);
  }

  // the height fog's own floor / falloff (Sky set them from the chunk's atmosphere): the dawn fog lifts and steepens them
  const baseH = fogUniforms.fogHeight.value, baseFall = fogUniforms.fogHeightFalloff.value;
  const baseMist = h.particles.params.mistOpacity;
  const shelter = new HerdShelter(h.animals, h.trees.map(tree => ({ x: tree.x, z: tree.z, r: tree.r, height: tree.height, cover: fx.coverAt(tree.x, tree.z) })), shelterRows.look, ReturnProgram.page(shelterRows.program, ctx.scope));
  const wind = { x: 0, z: 0 };

  const veil = { x: { value: 0 }, y: { value: 0 } };
  const roots = new Map<string, unknown>(Object.entries({ mod: pine.mod, fog: fogUniforms, weather: weatherUniforms, volume: volumetricFog,
    veil, particles: h.particles.params, water: fx.rings, wind: windBoost, windVector: wind }));
  const channels=installChannelPrograms(ctx.product.shardfile.clientChannels,'weather',roots);
  const answers = (scope: Scope): void => {
    h.game.app.events.answer('projectile.modify', (input) => h.game.app.levelScope === h.game.levelScope ? (input.ammo.wet === undefined ? input : { ...input, ...wetFlight(input, rows.wetProjectile, weather.rain) }) : input, scope);
    h.game.app.events.answer('creature.wander-goal', (query) => {
      if (h.game.app.levelScope !== h.game.levelScope) return query;
      return { ...query, goal: shelter.wanderGoal(query.herd, weather.rain) ?? query.goal };
    }, scope);
  };
  if (entered === undefined) answers(ctx.scope);
  else installEnteredRuntimeService(entered, (scope) => {
    const restore = channels.capture();
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
    let p = h.guideAt();
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

  const update = (dt: number): void => {
    if (dev.paused) return; // dev: the numbers below left as they are, to poke at one by hand
    const eye = h.viewer();
    const hold = h.game.app.events.ask('weather.hold', weatherHold.k); // a sealed boss room's own fog wins (F-L7)
    const room = practiceRoom.open;
    const values = [weather.overcast, weather.fog, weather.rain, weather.wet, weather.wind, windUniforms.uGust.value,
      hold, eye.x, eye.z, baseH, baseFall, baseMist, Number(room), WIND_DIR.x, WIND_DIR.z];
    channels.evaluate({time:0,delta:dt,values});
    if (h.horizonVeil) h.horizonVeil.value.set(veil.x.value, veil.y.value);
    h.ambience.inputs['rain'] = room ? 0 : weather.rain;
    fx.update(dt, weather, wind, h.game.camera);
    shelter.update(dt, weather.rain);
    stagInFog(eye, dt);
  };
  ctx.system({ id: 'shard.pine.weather', phase: 'update', after: ['shard.pine.weather.state'], before: ['world.life', 'first hints', 'main.frame'], run: update });

  const rig: PineWeatherRig = { weather, fx, setMode: (m, t = 0.5) => { weather.setMode(m, t); } };
  const debug = {
    ...rig, dev, uniforms: { weatherUniforms, fogUniforms, waterWeather: fx.rings, windBoost, mod: pine.mod },
    /** dev (C7's evidence): every grazer's distance to the nearest big tree — the mean, and how many stand within 6 m */
    herdShelter: () => shelter.stats(),
  };
  ctx.debug.expose('pine.weather', debug);
  return rig;
}
