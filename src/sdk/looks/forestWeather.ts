/** Client-only weather composition over keyed sky, phase continuation, native
 * rain presentation and herd shelter. Shards provide rows and resource ids. */
import { forestWeatherObservations, type ForestWeatherObservations } from '@wildshard/game/looks/forestWeather';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import type { Scope } from '@wildshard/engine/app/scope';
import { installChannelPrograms } from '@wildshard/game/plugin/channelPrograms';
import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { setting, onSettingChange } from '@wildshard/engine/ui/Settings';
import { fogUniforms, weatherUniforms, volumetricFog } from '@wildshard/engine/world/Atmosphere';
import * as v from 'valibot';
import { ForestWeatherSchema, type ForestWeatherRows } from '@wildshard/format/forestWeather';
import { windBoost, windUniforms, WIND_DIR } from '@wildshard/engine/world/wind';
import { keyedSkyOf } from '@wildshard/game/looks/keyedSky';
import { installWeatherContinuation } from '@wildshard/game/plugin/weather';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import { parseWeatherProgram, type WeatherProgram } from '@wildshard/format/weatherProgram';
import { wetFlight } from '@wildshard/engine/combat/ammo';
import { RainPresentation } from './rainPresentation';
import { HerdShelter, populationShelter } from '../populationShelter';

type ShardContext = Parameters<typeof installEnteredRuntimeService>[0];
export interface ForestWeatherRig { weather: WeatherContinuation; fx: RainPresentation; setMode: (mode: string, at?: number) => void }

/** The page's weather: shared observations from native ids, the rain from world/rain.json's rows. */
export async function installForestWeather(ctx: ShardContext, input: unknown): Promise<ForestWeatherRig | null> {
  const policy = v.parse(ForestWeatherSchema, input);
  const host = forestWeatherObservations(ctx, await ctx.product.json(policy.files.observations));
  const fx = await RainPresentation.install(ctx, await ctx.product.json(policy.files.rain));
  const rows=parseWeatherProgram(JSON.parse(new TextDecoder().decode(await ctx.product.file(policy.files.program))));
  const shelterRows = populationShelter(JSON.parse(new TextDecoder().decode(await ctx.product.file(policy.files.shelter))));
  return installWeatherPresentation(host, fx, ctx, rows, shelterRows, policy, retainsRuntimeServices(ctx) ? ctx : undefined);
}

function installWeatherPresentation(h: ForestWeatherObservations, fx: RainPresentation, ctx: ShardContext, rows: WeatherProgram, shelterRows: ReturnType<typeof populationShelter>, policy: ForestWeatherRows, entered?: ShardContext): ForestWeatherRig | null {
  const sky = keyedSkyOf(h.sky);
  if (sky === null) return null; // the fixed sky: no clock, no weather
  const atT = policy.heldPhase; // a held Fog / Rain starts halfway into its phase
  const dev={paused:false};
  const installation={seed:SEED,system:ctx.system,state:dev};
  const weather=installWeatherContinuation(installation,rows,sky.clock,'live');
  weather.setMode(setting('weather'), atT);
  h.game.scene.add(fx.group); // hidden while dry; in the scene before the boot's precompile, so the rain's program is built then
  if (entered === undefined) {
    const stopSetting = onSettingChange('weather', (m) => { weather.setMode(m, atT); });
    ctx.scope.onDispose(stopSetting);
  }

  const baseH = fogUniforms.fogHeight.value, baseFall = fogUniforms.fogHeightFalloff.value;
  const baseMist = h.particles.params.mistOpacity;
  const shelter = new HerdShelter(h.animals, h.trees.map(tree => ({ x: tree.x, z: tree.z, r: tree.r, height: tree.height, cover: fx.coverAt(tree.x, tree.z) })), shelterRows.look, ReturnProgram.page(shelterRows.program, ctx.scope));
  const wind = { x: 0, z: 0 };

  const veil = { x: { value: 0 }, y: { value: 0 } };
  const roots = new Map<string, unknown>(Object.entries({ mod: sky.mod, fog: fogUniforms, weather: weatherUniforms, volume: volumetricFog,
    veil, particles: h.particles.params, water: fx.rings, wind: windBoost, windVector: wind }));
  const channels=installChannelPrograms(ctx.product.shardfile.clientChannels,policy.channels,roots);
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
    const mod = { ...sky.mod }, fogBlob = weatherUniforms.fogBlob.value.clone(), horizon = h.horizonVeil?.value.clone();
    answers(scope);
    scope.onDispose(onSettingChange('weather', (mode) => { weather.setMode(mode, atT); }));
    scope.onDispose(() => {
      restore();
      weatherUniforms.fogBlob.value.copy(fogBlob); Object.assign(sky.mod, mod);
      if (h.horizonVeil && horizon !== undefined) h.horizonVeil.value.copy(horizon);
      fx.group.visible = false;
    });
    fx.group.visible = true;
  });

  const blob = new THREE.Vector3();
  const focusInFog = (eye: THREE.Vector3, dt: number): void => {
    let p = h.guideAt();
    if (p === null) {
      let bd = policy.focus.near * policy.focus.near;
      for (const a of h.animals.animals) {
        if (!a.alive || a.kind !== policy.focus.kind || a.variant !== policy.focus.variant) continue;
        const d = a.position.distanceToSquared(eye);
        if (d < bd) { bd = d; p = a.position; }
      }
    }
    if (p === null || weather.fog < policy.focus.threshold) { weatherUniforms.fogBlobAmt.value = 0; return; }
    blob.lerp(p, blob.y < -1e3 ? 1 : 1 - policy.focus.retention ** (dt * 60));
    weatherUniforms.fogBlob.value.set(blob.x, blob.y + policy.focus.height, blob.z, policy.focus.radius);
    weatherUniforms.fogBlobAmt.value = policy.focus.gain * weather.fog;
  };
  blob.set(0, -1e4, 0);

  const update = (dt: number): void => {
    if (dev.paused) return; // dev: the numbers below left as they are, to poke at one by hand
    const eye = h.viewer();
    const hold = h.game.app.events.ask('weather.hold', 0); // a sealed boss room's own fog wins (F-L7)
    const room = practiceRoom.open;
    const values = [weather.overcast, weather.fog, weather.rain, weather.wet, weather.wind, windUniforms.uGust.value,
      hold, eye.x, eye.z, baseH, baseFall, baseMist, Number(room), WIND_DIR.x, WIND_DIR.z];
    channels.evaluate({time:0,delta:dt,values});
    if (h.horizonVeil) h.horizonVeil.value.set(veil.x.value, veil.y.value);
    h.ambience.inputs['rain'] = room ? 0 : weather.rain;
    fx.update(dt, weather, wind, h.game.camera);
    shelter.update(dt, weather.rain);
    focusInFog(eye, dt);
  };
  ctx.system({ ...policy.system, phase: 'update', run: update });

  const rig: ForestWeatherRig = { weather, fx, setMode: (m, t = policy.heldPhase) => { weather.setMode(m, t); } };
  const debug = {
    ...rig, dev, uniforms: { weatherUniforms, fogUniforms, waterWeather: fx.rings, windBoost, mod: sky.mod },
    /** dev (C7's evidence): every grazer's distance to the nearest big tree — the mean, and how many stand within 6 m */
    herdShelter: () => shelter.stats(),
  };
  ctx.debug.expose(policy.debug, debug);
  return rig;
}
