import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { castRay } from '@wildshard/engine/physics/query';
import { bakedSamplers, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { NALATI_GROUND_RES, NALATI_GROUND_SIZE, type NalatiBake, type NalatiBakedActor, type NalatiBootBody, type NalatiBootHerd, type NalatiBootRows } from './baked';
import type { EliteBindings } from '@wildshard/game/shardfile/eliteEncounters';
import type { RngState } from '@wildshard/engine/core/rng';
import { SEED, TERRAIN, RIVER } from '../world/geography';
import type { NalatiGrassView } from './groups';
import { GrassField } from '@wildshard/game/systems/looks/grassField';
import { TrampleField, type TrampleState } from '@wildshard/game/systems/looks/trample';
import bootMetadata from '../bootMetadata.generated.json' with { type: 'json' };
import { PLAYER_TRAMPLE_RADIUS, pushPlayerTrail, type PlayerTrail } from '../look/trampleMovers';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import type { SkyKey } from '../look/skyRig';
import * as v from 'valibot';
import { Wind } from '@wildshard/engine/world/steppeWind';
import type { WildEnv } from '../creatures/env';
import type { LightningPlayer, Lightning } from '../world/Lightning';
import type { WeatherProgram } from '@wildshard/format/weatherProgram';
import type { SunClock } from '../look/wildLight';
import { exposeTrees, steppeStorm, stepStorm, stormEnv, stormWind, windEnv, yurtShelters, type StormWind, type YurtCircle } from '../world/weatherStep';
import { TreeGrid } from '@wildshard/engine/world/forest/placement';
import { Vector3 } from 'three';
import { ATTACK_TURN } from '@wildshard/engine/ai/hunt';

/** The manifest's sun (manifest.ts `sky.sun`, test-pinned): the page's clock starts on it (world/installWeather.ts
 *  the generated day-clock row, 16.2 h, the day phase), so its first frame is the look the shard was painted with. */
export const NALATI_SUN = { azimuth: 250, elevation: 26 } as const;
/** The page's clock, resolved from the same generated manifest sun and schedule. */
export function nalatiDayClock(): DayCycle<SkyKey> {
  return new DayCycle({ ...bootMetadata.dayClock, units: 'hour',
    schedule: bootMetadata.dayClock.schedule.map(row => ({ from: row.from, to: row.to, minutes: row.minutes, phase: v.parse(v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), row.phase) })) });
}
/** The boot's clock for the roster's elite rules (combat/elites.ts `condition`): the clock's day phase at install and no
 *  storm (the weather starts clear; the storm state machine is not hosted yet). */
export function nalatiBootClock(clock: { readonly dayPhase: string }): { phase: string; storm: boolean } { return { phase: clock.dayPhase, storm: false }; }

/** The page's terrain grid (the boot roster's ground, the bodies' height query) from the admitted query terrain's sampling
 *  bytes (shard.config `terrain`, G384: the page's own native heights and splat, re-encoded without resampling), refused
 *  unless it is Nalati's own 256² lattice over the 500 m chunk. The level's seed stands in for the WSTR header's. */
export function nalatiTerrainGrid(bytes: Uint8Array | undefined, seed: number): BakedGrid {
  const tile = bytes === undefined ? null : decodeTerrainTile(bytes);
  if (tile?.splat === undefined || tile.colours !== undefined || tile.resolution !== NALATI_GROUND_RES || tile.size !== NALATI_GROUND_SIZE
    || tile.x !== -NALATI_GROUND_SIZE / 2 || tile.z !== -NALATI_GROUND_SIZE / 2) throw new Error('Nalati headless needs its admitted query terrain sampling');
  return { res: tile.resolution, size: tile.size, seed, landscapeHash: 0, heights: tile.heights, splat: tile.splat, undergrowth: null };
}

/**
 * The host's grass (SF72): the page's field (game/systems/looks/grassField.ts GrassField) over the samplers the page binds,
 * the baked grid's height, normal and splat and Nalati's terrain field's trails, pads and water, with the authored meadow
 * (look/grassFieldLayout.ts) on the level's noise seed; its height channel is the page's, sample for sample (the bake's
 * `grass` rows, test/shards/nalati-grasslands/headless-runtime.test.ts). The colour channels (the level's ground paint)
 * are the field's plain default: no headless reader asks them. And a trample map of the host's own (TrampleField).
 */
export function nalatiGrassView(grid: BakedGrid, seed: number): NalatiGrassView & { readonly trample: TrampleField } {
  const s = bakedSamplers(grid);
  const field = new GrassField({ seed, half: NALATI_GROUND_SIZE / 2, heightAt: s.heightAt, normalAt: (x, z, eps) => s.normalAt(x, z, eps), splatAt: s.splatAt,
    trailDistance: TERRAIN.trailDistance, cabinMask: TERRAIN.cabinMask, pondMask: TERRAIN.pondMask, waterLevel: TERRAIN.waterLevel, paint: () => false, layout: { ...bootMetadata.grassLayout, riverZ: RIVER.z, riverHalf: RIVER.half } });
  return { field, trample: new TrampleField() };
}

/** The host's trample continuation: the player's last spot (null before the first step) and the map's own state. */
interface NalatiTrampleState { trail: [number, number] | null; map: TrampleState }
const isPair = (pair: unknown): pair is [number, number] => Array.isArray(pair) && pair.length === 2 && pair.every(n => typeof n === 'number');
function trampleState(value: SimValue): NalatiTrampleState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RangeError('Invalid Nalati trample state');
  const { trail, map } = value;
  if (!(trail === null || isPair(trail)) || typeof map !== 'object' || map === null || Array.isArray(map)) throw new RangeError('Invalid Nalati trample state');
  const { cells, origin, centre, anyFlat, dirty, tick } = map;
  if (!Array.isArray(cells) || !cells.every((n): n is number => typeof n === 'number') || !(origin === null || isPair(origin)) || !isPair(centre)
    || typeof anyFlat !== 'boolean' || typeof dirty !== 'boolean' || typeof tick !== 'number') throw new RangeError('Invalid Nalati trample state');
  return { trail, map: { cells, origin, centre, anyFlat, dirty, tick } };
}

/**
 * The trample map on the host's fixed step (SF72), in the page's frame order: the painterly grass's update first (main.world,
 * look/grass.ts: the player's push at its feet with its velocity from the last step, look/trampleMovers.ts, then the map's
 * `update`, which re-centres the window on the player, re-pushes nothing tracked and runs the 10 Hz recovery), so every later
 * push this step (the groups' senses through the wild view) lands in this step's window, as the page's wildlife pushes land
 * after the grass. Its trail and map are snapshot state (`nalati.trample`), restored before any step pushes. Not yet: the
 * wildlife's pushes from its moving wolves, horses and dog (creatures/wildlife.ts): nothing here moves them until the
 * groups tick.
 */
export function installNalatiTrample(host: SimHost, trample: TrampleField): void {
  const trail: PlayerTrail = { lastX: Number.NaN, lastZ: Number.NaN };
  const push = (x: number, z: number, r: number, s: number, vx: number, vz: number): void => { trample.push(x, z, r, s, vx, vz); };
  host.onStep('nalati.trample', dt => {
    const p = host.player.position;
    pushPlayerTrail(trail, dt, p.x, p.z, PLAYER_TRAMPLE_RADIUS, push);
    trample.update(dt, p);
  }, {
    snapshot: () => {
      const { cells, origin, centre, anyFlat, dirty, tick } = trample.snapshot();
      return { trail: Number.isNaN(trail.lastX) ? null : [trail.lastX, trail.lastZ], map: { cells, origin, centre, anyFlat, dirty, tick } };
    },
    restore: value => {
      const saved = trampleState(value);
      trample.restore(saved.map);
      [trail.lastX, trail.lastZ] = saved.trail ?? [Number.NaN, Number.NaN];
    },
  });
}

/** The host's weather: its own steppe wind, the storm on the page's seed and the wind the storm last asked for. */
export interface NalatiHostWeather { readonly wind: Wind; readonly storm: Lightning; readonly ask: StormWind }
const weathers = new WeakMap<SimHost, NalatiHostWeather>();
/** The weather installed into `host` (its tests read it), or undefined. */
export function nalatiWeatherOf(host: SimHost): NalatiHostWeather | undefined { return weathers.get(host); }

const num = v.pipe(v.number(), v.finite());
const WindValue = v.strictObject({ speed: num, dir: num, gustiness: num, time: num, travel: num, wander: v.boolean(), baseSpeed: num, baseDir: num,
  target: v.strictObject({ speed: num, dir: num, gustiness: num, rate: num }) });
const StormValue = v.strictObject({ state: v.string(), phaseT: num, phaseLen: num, mode: v.string(), hold: v.boolean(),
  n: v.strictObject({ overcast: num, rain: num, wet: num, wind: num, fog: num, front: num, rainbow: num }),
  rng: v.strictObject({ version: num, state: num, initial: num, scrambledFork: v.boolean() }),
  flash: num, windSpeed: v.nullable(num), windGustiness: num, getLow: v.boolean(), stormFrom: num,
  pending: v.nullable(v.strictObject({ x: num, y: num, z: num, kind: v.picklist(['tree', 'player', 'ground', 'thing']), t: num })),
  nextBolt: num, nextGust: num, windTarget: num, getLowFor: num, getLowTick: num });
const WeatherValue = (states:readonly string[]) => v.strictObject({ wind: WindValue, storm: v.strictObject({...StormValue.entries,state:v.picklist(states)}), asked: v.nullable(num) });

/** A baked spruce as the lightning reads it: its trunk circle (the grid's bucket key) and its top. */
interface NalatiTree { readonly x: number; readonly z: number; readonly r: number; readonly top: number }
/** The lightning's world from the bake: the forest's trunks in its own 16 m cells, in its order (the page's `forest.nearby`,
 *  engine TreeGrid) with their tops, and the yurts' shelter circles. */
export function nalatiLightningGround(bake: Pick<NalatiBake, 'trees' | 'tops' | 'yurts'>): { readonly trees: TreeGrid<NalatiTree>; readonly yurts: readonly YurtCircle[] } {
  const trees = new TreeGrid<NalatiTree>();
  bake.trees.forEach(([x, z, r], i) => {
    const top = bake.tops[i];
    if (top === undefined) throw new Error(`Nalati baked tree ${String(i)} has no top`);
    trees.add({ x, z, r, top });
  });
  return { trees, yurts: bake.yurts.map(([x, z, r]) => ({ x, z, r })) };
}

/**
 * The steppe weather on the host's fixed step (SF72), the page's rules (world/weatherStep.ts) in its frame order: the wind
 * advances (the painterly grass's `wind.update`, look/grass.ts), the storm steps after the day clock (world/installWeather.ts:
 * its state machine on the page's seed, the wind it asks for), then the creatures' view takes the light, the storm and the
 * wind (the page's weather and Wildlife frames). The host's wind is its own (`new Wind(box)`: the page's tree sway untouched).
 * Its wind, storm and ask ride the snapshot (`nalati.weather`), exactly.
 *
 * The lightning's world is the page's: the baked spruces in the forest's 16 m cells with their tops (`exposeTrees`, the page's
 * `exposed`; a host's tree carries no live reference, so an armed strike on one is a plain saved value), the ground, and the
 * player as the page's `player()` builds it — the host's position; crouched and mounted as the wild view says (command-v1 crouch and the owned mounted driver supply those flags); sheltered beside a baked yurt (`yurtShelters`), never indoors (the host cannot
 * enter the Golden King's dungeon) and never held (the Storm Titan, who needs a rider, is not hosted), so `hold` stays off.
 * A strike within 4 m hurts the player through the host's combat pipeline as the page's `hurt` does (60, the weather's
 * damage ask, `env.lightning`). A landed strike scares the creatures within 60 m (`ports.scare`, Wildlife's `scare` as the page
 * binds it: the packs break, the herds stampede, the flock bolts, the 'scare' signal); strikes land only in the storm phase,
 * 12–18 min in.
 */
export function installNalatiWeather(host: SimHost, ports: { program:WeatherProgram; heightAt: (x: number, z: number) => number; clock: SunClock; env: Pick<WildEnv, 'light' | 'storm' | 'wind' | 'playerCrouched' | 'playerMounted'>;
  bake: Pick<NalatiBake, 'trees' | 'tops' | 'yurts'>; scare: (x: number, z: number) => void }): NalatiHostWeather {
  const wind = new Wind({ value: 1 }), env = ports.env, clock = ports.clock, ground = nalatiLightningGround(ports.bake);
  const lp: LightningPlayer = { x: 0, y: 0, z: 0, crouched: false, mounted: false, sheltered: false };
  const storm = steppeStorm(SEED, {
    heightAt: ports.heightAt,
    exposed: (x, z, r, out) => { exposeTrees(ground.trees.nearby(x, z, r), t => t.top, () => undefined, x, z, r, out); },
    player: () => {
      const p = host.player.position;
      lp.x = p.x; lp.y = p.y; lp.z = p.z;
      lp.crouched = env.playerCrouched; lp.mounted = env.playerMounted;
      lp.sheltered = yurtShelters(ground.yurts, p.x, p.z);
      return lp;
    },
  }, ports.program, host);
  const savedSchema=WeatherValue(storm.weather.profile.states);
  storm.onStrike(strike => { ports.scare(strike.x, strike.z); });
  storm.onPlayerHit(dmg => {
    const health = host.player.health;
    host.combat.hit({ source: 'env', sourceTags: ['env.lightning', 'feel.jolt', 'cover.checked'], target: health, amount: host.events.ask('weather.damage', dmg),
      point: host.player.position.clone(), dir: new Vector3(), cause: { kind: 'env.lightning', label: 'Struck by lightning', text: 'Struck by lightning' }, toast: 'Struck by lightning — get low in a storm' });
  });
  const ask = stormWind(wind);
  const view = (): void => { stormEnv(env, clock, storm); windEnv(env, wind); };
  host.onStep('nalati.weather', dt => {
    wind.update(dt);
    stepStorm(storm, ask, wind, dt, false);
    view();
  }, {
    snapshot: () => {
      const w = wind.snapshot(), s = storm.snapshot();
      return { wind: { ...w, target: { ...w.target } }, storm: { ...s, n: { ...s.n }, rng: { ...s.rng }, pending: s.pending === null ? null : { ...s.pending } }, asked: ask.asked };
    },
    restore: value => {
      const saved = v.parse(savedSchema, value);
      wind.restore(saved.wind); storm.restore(saved.storm); ask.asked = saved.asked;
      view();
    },
  });
  view();
  const out = { wind, storm, ask };
  weathers.set(host, out);
  return out;
}

/** One manager body in the host: the roster's recipe, its baked native spec, the live actor. */
export interface NalatiBody { readonly boot: NalatiBootBody; readonly baked: NalatiBakedActor; readonly actor: AnimalSim }

/**
 * The creature manager's load-time bodies in a renderer-free host (SF72): the boot roster (runtime/bootRoster.ts, the
 * manager's and Wildlife's streams over the page's terrain grid), every id, kind, coat, seed, scale and herd checked against
 * the trusted bake, each at its tick-0 spot and heading (the bake's, which the roster reproduces) on the manager's creature
 * floor (the first WORLD hit under a ray from a metre over the higher of the level's spawn height and the terrain; the
 * terrain itself when that is the ground's heightfield). The Golden King stays parked (no body), as the page parks him.
 * The host runs on the page's distance bands, installed before any spawn (and before a restoring host restores its clocks).
 */
export function installNalatiRoster(host: SimHost, ports: { boot: NalatiBootRows; bake: NalatiBake; grid: BakedGrid; spawnY: number; clock: { readonly phase: string; readonly storm: boolean }; elites: EliteBindings }): {
  bodies: readonly NalatiBody[]; herds: readonly NalatiBootHerd[]; stream: RngState; wildStream: RngState;
} {
  const { bake } = ports, s = bakedSamplers(ports.grid);
  host.useBodyBands({ present: a => !ports.elites.absent.has(a) && (!('hidden' in a) || a.hidden !== true), rate: a => a.driven || a.state === 'sidestep' || ports.elites.pinned.has(a) ? 'always' : 'ai' });
  if (!ports.boot.phases.includes(ports.clock.phase) || ports.clock.storm) throw new Error('Nalati boot phase is not hosted');
  const roster = structuredClone(ports.boot.roster);
  if (roster.bodies.length !== bake.actors.length || JSON.stringify(roster.herds.map(h => ({ kind: h.kind, members: h.members.map(m => m.id) }))) !== JSON.stringify(bake.herds))
    throw new Error('Nalati roster diverges from the page\'s list');
  const origin = { x: 0, y: 0, z: 0 }, down = { x: 0, y: -1, z: 0 }, sees = ['WORLD'] as const;
  const creatureFloor = (x: number, z: number, fromY: number): { y: number; structure: boolean } => {
    const terrain = s.heightAt(x, z);
    origin.x = x; origin.y = fromY; origin.z = z;
    const hit = castRay(host.physics, origin, down, Math.max(201, fromY - terrain + 1), sees);
    if (hit === null || (hit.material === 'ground' && hit.collider.shape.type === host.physics.R.ShapeType.HeightField)) return { y: terrain, structure: false };
    return { y: hit.point.y, structure: true };
  };
  const bodies = roster.bodies.map((boot, i) => {
    const row = bake.actors[i];
    // the bake is the page's own roll: a divergent draw anywhere refuses the roster rather than simulating another world
    if (row?.id !== boot.id || row.kind !== boot.kind || row.variant !== boot.variant.id || row.seed !== boot.seed || row.scale !== boot.scale || row.herd !== boot.herd) throw new Error(`Nalati roster diverges from the page at ${boot.id}`);
    const { x, z } = boot.position, at = creatureFloor(x, z, Math.max(ports.spawnY, s.heightAt(x, z)) + 1);
    const actor = host.spawn({ id: boot.id, spec: row.spec, seed: boot.seed, scale: boot.scale, at: { x, y: at.y, z }, yaw: boot.yaw });
    actor.levelGround = at.structure;
    if (at.structure) actor.groundHeight = (px, pz, py) => creatureFloor(px, pz, py).y;
    actor.herd = boot.herd; actor.scripted = row.scripted;
    // a melee shard's manager caps an attacking body's turn (AnimalManager.spawnAnimal: ATTACK_TURN)
    actor.attackTurnCap = ATTACK_TURN;
    return { boot, baked: row, actor };
  });
  return { bodies, herds: roster.herds, stream: roster.stream, wildStream: roster.wildStream };
}

/** Native queries retain the page's strict riding bounds and water mask. */
export function nalatiWorldQueries(grid: BakedGrid): {
  normalY: (x: number, z: number) => number; surfaceAt: (x: number, z: number) => number | null;
  inBounds: (x: number, z: number, margin: number) => boolean;
} {
  const normal = bakedSamplers(grid).normalAt;
  return { normalY: (x, z) => normal(x, z)[1], surfaceAt: (x, z) => TERRAIN.pondMask(x, z) > 0 ? TERRAIN.waterLevel() : null,
    inBounds: (x, z, margin) => Math.abs(x) < NALATI_GROUND_SIZE / 2 - margin && Math.abs(z) < NALATI_GROUND_SIZE / 2 - margin };
}
