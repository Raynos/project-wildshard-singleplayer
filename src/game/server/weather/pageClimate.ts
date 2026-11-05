import { SEED } from '@wildshard/engine/core/config';
import type { Scope } from '@wildshard/engine/app/scope';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { WeatherContinuation } from '@wildshard/engine/world/weatherContinuation';
import type { Player } from '@wildshard/engine/player/Player';
import { wind as steppeWind } from '@wildshard/engine/world/steppeWind';
import type { ForestWeatherRows } from '@wildshard/format/forestWeather';
import type { parsePopulationShelter } from '@wildshard/format/herdShelter';
import { parseWeatherProgram, WeatherWorldSchema, type WeatherProgram, type WeatherReactionRows } from '@wildshard/format/weatherProgram';
import * as v from 'valibot';
import type { ShardContext } from '../../client/plugin/context';
import { ReturnProgram } from '../../shared/population/returnProgram';
import type { ClimateFeed } from '../../shared/weather/feed';
import { wildEnv } from '../population/pageGroups';
import { HerdShelter, type Herd, type Tree } from '../population/shelter';
import { clientWildlife } from '../../shared/population/wildlifeOwner';
import { installWeatherContinuation } from './continuation';
import { bindPageWeatherHit } from './pageHit';
import { applyWeatherCover, installWeatherReactions, nativeWeatherBundle, weatherWorldLight, type WeatherReactions } from './reactions';

/** What a page's sim draws its climate from. */
export interface PageClimatePorts {
  readonly ctx: ShardContext; readonly policy: ForestWeatherRows; readonly clock: Pick<DayCycleClock, 'phase' | 'sunElevation'>;
  /** the phase program, or the storm's bundle when the rows declare a storm */
  readonly program: unknown;
  /** the forest's crowns a bolt strikes: `[x, z, top]` */
  readonly points: () => [number, number, number][];
  readonly scope: Scope; readonly dev: { paused: boolean };
  /** A page on a server reads its sky off rows (J130): nothing here steps, and these program rows name the fields. */
  readonly net?: (rows: { readonly weather: WeatherProgram; readonly reactions?: WeatherReactionRows }) => ClimateFeed;
}
/** The page's climate: the view's port over the sim it still runs itself. The flip swaps this for `netClimate`. */
export interface PageClimate extends ClimateFeed {
  readonly weather: WeatherContinuation;
  readonly storm: WeatherReactions | null;
  /** What the sky does to the world beyond the view: its wind, its scares and its hurts on `player`. */
  bind: (player: Player) => void;
  /** The herd's shelter from the rain, stepped by the same lane as the view. */
  shelter: (animals: { readonly herds: readonly Herd[] }, trees: readonly Tree[], rows: ReturnType<typeof parsePopulationShelter>) => HerdShelter<Tree>;
}

/** Run the page's own climate from its rows. Everything here is the page sim's and leaves with it. */
export function pageClimate(ports: PageClimatePorts): PageClimate {
  const { ctx, policy, clock, program, points, scope, dev, net } = ports;
  let weather: WeatherContinuation, reactions: WeatherReactions | null = null, declared: Parameters<NonNullable<PageClimatePorts['net']>>[0];
  if (net !== undefined) dev.paused = true; // what reads these reads the server's sky: they stand still and take its rows
  if (policy.storm === undefined) { declared = { weather: parseWeatherProgram(program) }; weather = installWeatherContinuation({ seed: SEED, system: ctx.system, state: dev }, declared.weather, clock, 'live'); }
  else {
    // the storm's reactions step the continuation, struck at the forest's crowns and sheltered by the bundle's baked circles
    const bundle = nativeWeatherBundle(program, policy.storm.shelters);
    declared = { weather: bundle.weather, reactions: bundle.reactions };
    weather = installWeatherContinuation({ seed: SEED }, bundle.weather, { phase: 0 }, undefined);
    reactions = installWeatherReactions(weather, { ...bundle.reactions, points: points() }, { scope });
  }
  const world = policy.storm === undefined ? null : v.parse(WeatherWorldSchema, policy.storm.world), storm = reactions;
  const feed = net?.(declared) ?? null;
  if (feed !== null && storm !== null) for (const event of new Set(storm.rows.steps.flatMap(step => step.emit.map(row => row.event)))) feed.storm?.on(event, ({ age: _age, ...fields }) => { storm.raise(event, fields); });
  return { weather, storm,
    setMode: (mode, at) => { weather.setMode(mode, at); },
    force: (phase, at) => { weather.force(phase, at); },
    frame: (dt, seen) => {
      if (feed !== null) { feed.frame(dt, null); weather.state = feed.weather.state; Object.assign(weather.n, feed.weather.n); Object.assign(weather.registers, feed.weather.registers); return; }
      if (storm === null || world === null || seen === null) return;
      const inputs = storm.inputs;
      inputs['px'] = seen.x; inputs['py'] = seen.y; inputs['pz'] = seen.z; inputs['crouched'] = Number(seen.crouched); inputs['mounted'] = Number(wildEnv.playerMounted);
      applyWeatherCover(weather, inputs, seen.indoors, seen.held); // indoors no storm starts; a held storm runs on until its fight ends
      storm.update(dt);
      wildEnv.light = weatherWorldLight(world.light, clock.sunElevation, storm.stormActive); wildEnv.storm = storm.stormActive;
    },
    bind: player => {
      if (storm === null || world === null || feed !== null) return;
      Object.assign(storm.inputs, { calmSpeed: steppeWind.speed, calmDir: steppeWind.dir, calmGust: steppeWind.gustiness, held: 0, crouched: 0, mounted: 0 });
      storm.on('wind', (e) => { steppeWind.setTarget(e['speed'] ?? steppeWind.speed, e['dir'] ?? steppeWind.dir, e['gustiness'], e['seconds']); });
      storm.on('strike', (e) => { clientWildlife(ctx)?.scare(e['x'] ?? 0, e['z'] ?? 0, world.scareRadius); });
      bindPageWeatherHit(ctx, player, storm, world);
    },
    shelter: (animals, trees, rows) => new HerdShelter(animals, trees, rows.look, ReturnProgram.page(rows.program, ctx.scope)),
  };
}
