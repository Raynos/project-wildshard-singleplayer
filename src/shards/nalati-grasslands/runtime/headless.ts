import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimHost, type SimLevel, type SimValue } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { withOwner } from '@wildshard/engine/app/ownership';
import { tagCollider } from '@wildshard/engine/physics/surface';
import { castRay } from '@wildshard/engine/physics/query';
import { bakedSamplers, parseBakedTerrain, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { NALATI_GROUND_RES, NALATI_GROUND_SIZE, nalatiBake, type NalatiBake, type NalatiBakedActor } from './baked';
import { nalatiBootRoster, type NalatiBootBody, type NalatiBootClock, type NalatiBootHerd } from './bootRoster';
import { installNalatiElites, nalatiEliteBindings, type NalatiEliteBindings } from './headlessElites';
import { installNalatiCreatures, type NalatiHostCreatures } from './headlessCreatures';
import { parseNavmesh, type Navmesh } from '@wildshard/engine/physics/navmesh';
import type { RngState } from '@wildshard/engine/core/rng';
import { SEED, TERRAIN } from '../world/terrain';
import { nalatiWetAt } from '../wet';
import { installNalatiGroups, nalatiHeadlessEnv, type NalatiGrassView } from './groups';
import { GrassField } from '@wildshard/game/systems/looks/grassField';
import { TrampleField, type TrampleState } from '@wildshard/game/systems/looks/trample';
import { NALATI_GRASS_LAYOUT } from '../look/grassFieldLayout';
import { PLAYER_TRAMPLE_RADIUS, pushPlayerTrail, type PlayerTrail } from '../look/trampleMovers';
import { clockForSun } from '../look/dayKeys';
import * as v from 'valibot';
import { Wind } from '@wildshard/engine/world/steppeWind';
import type { WildEnv } from '../creatures/env';
import type { LightningPlayer, SteppeStorm } from '../world/Weather';
import { STORM_PHASES } from '../world/weatherProfile';
import type { SunClock } from '../look/wildLight';
import { exposeTrees, steppeStorm, stepStorm, stormEnv, stormWind, windEnv, yurtShelters, type StormWind, type YurtCircle } from '../world/weatherStep';
import { TreeGrid } from '@wildshard/engine/world/forest/placement';
import { Vector3 } from 'three';
import { ATTACK_TURN } from '@wildshard/engine/ai/hunt';
import { installNalatiMountedPlayer, nalatiMountedOf } from './headlessMounted';
import { HITCH_HORSE_SPOTS } from '../world/layout';
import { N_ROAD_PTS, S_ROAD_PTS, W_ROAD_PTS, E_ROAD_PTS, SKY_ROAD, CAMP_SPUR, BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL } from '../layout';

/** The page's terrain grid, handed to the trusted runtime by path (the boot roster's ground, the bodies' height query). */
export const NALATI_TERRAIN_ASSET = 'public/assets/baked/nalati-grasslands/terrain.bin';
/** The page's baked navmesh (boot/files.ts), the creatures' paths and navmesh steering, handed over by path too. */
export const NALATI_NAVMESH_ASSET = 'public/assets/baked/nalati-grasslands/navmesh.bin';
/** The manifest's sun (manifest.ts `sky.sun`, test-pinned): the page's clock starts on it (world/installWeather.ts
 *  `clockForSun(def.sky.sun)`, 16.2 h, the day phase), so its first frame is the look the shard was painted with. */
export const NALATI_SUN = { azimuth: 250, elevation: 26 } as const;
/** The page's day clock as its weather builds it (look/dayKeys.ts clockForSun over the steppe schedule). */
export function nalatiDayClock(): ReturnType<typeof clockForSun> { return clockForSun(NALATI_SUN); }
/** The boot's clock for the roster's elite rules (combat/elites.ts `condition`): the clock's day phase at install and no
 *  storm (the weather starts clear; the storm state machine is not hosted yet). */
export function nalatiBootClock(clock: { readonly dayPhase: string }): NalatiBootClock { return { phase: clock.dayPhase, storm: false }; }

const buffer = (bytes: Uint8Array): ArrayBuffer => { const copy = new ArrayBuffer(bytes.byteLength); new Uint8Array(copy).set(bytes); return copy; };
/** The page's navmesh from its trusted bytes, in its own (authored) frame: this host shifts no level. */
export function nalatiNavmesh(bytes: Uint8Array | undefined): Navmesh {
  const nav = bytes === undefined ? null : parseNavmesh(buffer(bytes));
  if (nav === null) throw new Error(`Nalati headless needs its baked navmesh (${NALATI_NAVMESH_ASSET})`);
  nav.datum = () => 0;
  return nav;
}

/** Install the browser-baked native world into the host's physics, owned by its scope: Rapier's own 256² heightfield and
 *  every solid WORLD collider the page built (cuboids, capsules, meshes, convex hulls). */
export function addNalatiWorld(host: SimHost, bake: NalatiBake): void {
  const { R, world } = host.physics, g = bake.ground, n = NALATI_GROUND_RES - 1;
  withOwner(host.scope, () => {
    const ground = world.createCollider(R.ColliderDesc.heightfield(n, n, g.heights, g.scale).setTranslation(g.at.x, g.at.y, g.at.z).setCollisionGroups(g.groups).setFriction(g.friction));
    tagCollider(ground, 'ground');
    bake.solids.forEach(solid => {
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0], solid.half[1], solid.half[2])
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 6 && solid.points !== undefined && solid.indices !== undefined ? R.ColliderDesc.trimesh(solid.points, solid.indices)
            : solid.shape === 9 && solid.points !== undefined ? R.ColliderDesc.convexHull(solid.points) : null;
      if (desc === null) throw new Error(`Unbuildable baked Nalati collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(solid.at[0], solid.at[1], solid.at[2]).setRotation({ x: solid.rot[0], y: solid.rot[1], z: solid.rot[2], w: solid.rot[3] })
        .setCollisionGroups(solid.groups).setFriction(solid.friction));
    });
  });
}

/** The page's terrain grid from its trusted bytes, refused unless it is Nalati's own 256² lattice over the 500 m chunk. */
export function nalatiTerrainGrid(bytes: Uint8Array | undefined, seed: number): BakedGrid {
  const grid = bytes === undefined ? null : parseBakedTerrain(buffer(bytes));
  if (grid === null || grid.res !== NALATI_GROUND_RES || grid.size !== NALATI_GROUND_SIZE || grid.seed !== seed) throw new Error(`Nalati headless needs its baked terrain grid (${NALATI_TERRAIN_ASSET})`);
  return grid;
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
    trailDistance: TERRAIN.trailDistance, cabinMask: TERRAIN.cabinMask, pondMask: TERRAIN.pondMask, waterLevel: TERRAIN.waterLevel, paint: () => false, layout: NALATI_GRASS_LAYOUT });
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
export interface NalatiHostWeather { readonly wind: Wind; readonly storm: SteppeStorm; readonly ask: StormWind }
const weathers = new WeakMap<SimHost, NalatiHostWeather>();
/** The weather installed into `host` (its tests read it), or undefined. */
export function nalatiWeatherOf(host: SimHost): NalatiHostWeather | undefined { return weathers.get(host); }

const num = v.pipe(v.number(), v.finite());
const WindValue = v.strictObject({ speed: num, dir: num, gustiness: num, time: num, travel: num, wander: v.boolean(), baseSpeed: num, baseDir: num,
  target: v.strictObject({ speed: num, dir: num, gustiness: num, rate: num }) });
const StormValue = v.strictObject({ state: v.picklist(STORM_PHASES), phaseT: num, phaseLen: num, mode: v.string(), hold: v.boolean(),
  n: v.strictObject({ overcast: num, rain: num, wet: num, wind: num, fog: num, front: num, rainbow: num }),
  rng: v.strictObject({ version: num, state: num, initial: num, scrambledFork: v.boolean() }),
  flash: num, windSpeed: v.nullable(num), windGustiness: num, getLow: v.boolean(), stormFrom: num,
  pending: v.nullable(v.strictObject({ x: num, y: num, z: num, kind: v.picklist(['tree', 'player', 'ground', 'thing']), t: num })),
  nextBolt: num, nextGust: num, windTarget: num, getLowFor: num, getLowTick: num });
const WeatherValue = v.strictObject({ wind: WindValue, storm: StormValue, asked: v.nullable(num) });

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
export function installNalatiWeather(host: SimHost, ports: { heightAt: (x: number, z: number) => number; clock: SunClock; env: Pick<WildEnv, 'light' | 'storm' | 'wind' | 'playerCrouched' | 'playerMounted'>;
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
  });
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
      const saved = v.parse(WeatherValue, value);
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
export function installNalatiRoster(host: SimHost, ports: { bake: NalatiBake; grid: BakedGrid; spawnY: number; clock: NalatiBootClock; elites: NalatiEliteBindings }): {
  bodies: readonly NalatiBody[]; herds: readonly NalatiBootHerd[]; stream: RngState; wildStream: RngState;
} {
  const { bake } = ports, s = bakedSamplers(ports.grid);
  host.useBodyBands({ present: a => !ports.elites.absent.has(a), rate: a => a.driven || a.state === 'sidestep' || ports.elites.pinned.has(a) ? 'always' : 'ai' });
  const roster = nalatiBootRoster({ normalY: (x, z) => s.normalAt(x, z)[1], heightAt: s.heightAt, waterLevel: () => TERRAIN.waterLevel(), wetAt: nalatiWetAt }, ports.clock);
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

/**
 * Nalati Grasslands' renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the browser-baked native
 * world (the terrain heightfield as Rapier built it and every solid WORLD collider; `ground: false`), the page's terrain grid
 * as the height query, the page's day clock on the host's tick (from the manifest's sun; the level's `day.start` moves it), the
 * steppe weather (its own wind and the storm's state machine on the page's seed, the creatures' light, storm and wind;
 * the lightning's world from the bake's tree tops and yurts, its player damage and a landed strike's scare), the player's trail on the host's trample map, and the creature manager's 35 load-time bodies at their tick-0 spots on the page's distance bands,
 * restored exactly by an identical install before the host restores, the declared groups (runtime/groups.ts: the pack,
 * the wild herd and Argymaq's herd, seeded on the 'ai' stream as the page seeds them) deciding on the host's clocks, the flock
 * and its dog (runtime/headlessCreatures.ts). Not yet owned (fail-closed, see
 * progress/shard-platform/handoffs/sf72-nalati12.md): the remaining dusk/night/storm elite brains, the
 * Golden King and the Storm Titan, taming/companions, the weapons, the dusk / night spawns as the day clock
 * passes them, the quests and their facts, and the entry proof; `finish` refuses.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  const bake = nalatiBake(), grid = nalatiTerrainGrid(assets.get(NALATI_TERRAIN_ASSET), shard.identity.seed), heightAt = bakedSamplers(grid).heightAt;
  const nav = nalatiNavmesh(assets.get(NALATI_NAVMESH_ASSET));
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: NALATI_GROUND_SIZE, height: 0 },
    player: { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAt(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never the sabre or the bow: the weapons are declared items (data/items.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  return { level, ports: { ground: false, heightAt }, install: (host, context) => {
    // the creature floor casts into this world at install, restoring too (the saved physics then replaces it)
    addNalatiWorld(host, bake);
    // The manifest's basinBody('river', TERRAIN): the Kunes and brook mask, at their shared rest level.
    // Install before restore too, so the saved swimmer uses the same water on its first resumed tick.
    const surfaceAt = (x: number, z: number): number | null => TERRAIN.pondMask(x, z) > 0 ? TERRAIN.waterLevel() : null;
    host.useWater({ surfaceAt });
    // the page's day clock, stepped at the start of every tick (restoring too: the host then restores its saved `day`); the
    // roster reads it at install, the boot's phase (the level's `day.start`, if any, moves both)
    const clock = host.useDayClock(nalatiDayClock());
    const bindings = nalatiEliteBindings();
    const roster = installNalatiRoster(host, { bake, grid, spawnY: shard.spawn.y, clock: nalatiBootClock(clock), elites: bindings }), bodies = roster.bodies, normal = bakedSamplers(grid).normalAt;
    // the groups' setup draws on the 'ai' stream, restoring too (the host then restores the stream and the bodies' memories)
    const grass = nalatiGrassView(grid, shard.identity.seed);
    installNalatiTrample(host, grass.trample);
    // the weather after the grass (the page's frame order), into the wild view the groups read
    const env = nalatiHeadlessEnv(grass);
    // a landed strike scares the creatures (installWeather.ts `bind({ scare })`: Wildlife.scare within 60 m), installed below
    let scare: ((x: number, z: number) => void) | null = null;
    installNalatiWeather(host, { heightAt, clock, env, bake, scare: (x, z) => {
      if (scare === null) throw new Error('Nalati headless strike before its creatures are installed');
      scare(x, z);
    } });
    const groups = installNalatiGroups(host, { bodies, herds: bake.herds, normalY: (x, z) => normal(x, z)[1], grass, env });
    const installed: { creatures?: NalatiHostCreatures } = {};
    const manager = (): NalatiHostCreatures => { const value = installed.creatures; if (value === undefined) throw new Error('Nalati elite used before manager install'); return value; };
    // The page's elite rules run after weather and BEFORE Wildlife. Setup adopts the already rolled boot actors;
    // a restoring install only reconnects saved identities after the manager has reinstalled its deferred roster.
    const elites = installNalatiElites(host, { bindings, heightAt, ledges: bake.ledges, phase: () => clock.dayPhase, storm: () => env.storm,
      environment: () => env, packs: () => groups.packs,
      spawnPack: (x, z, variants) => manager().spawnElitePack(x, z, variants), retirePack: pack => { manager().retirePack(pack); },
      bodies: () => installed.creatures?.bodies ?? bodies.map(b => b.actor), herd: () => groups.herds[1] ?? null,
      spawn: (kind, x, z, yaw, variant) => manager().spawnElite(kind, x, z, yaw, variant), retire: a => { manager().retireElite(a); } });
    // the creatures' frame after the weather (Wildlife's, then the manager's), its brain on the manager's stream
    const forest = nalatiLightningGround(bake).trees;
    installed.creatures = installNalatiCreatures(host, { elites: bindings, bodies, herds: roster.herds, groups, grid, nav, trees: (x, z, r) => forest.nearby(x, z, r), stream: roster.stream, wildStream: roster.wildStream, bake, spawnY: shard.spawn.y, mounted: () => nalatiMountedOf(host)?.mounted === true, crouching: () => nalatiMountedOf(host)?.rider.crouching === true, ...(context.snapshot === undefined ? {} : { snapshot: context.snapshot }) });
    // The same two camp identities and authored road order as ride/ride.ts; taming adds other mountables later.
    const mountable = bodies.filter(b => HITCH_HORSE_SPOTS.some(p => p.x === b.boot.position.x && p.z === b.boot.position.z)).map(b => b.actor.entityId);
    installNalatiMountedPlayer(host, { groups, mountable, heightAt, waterLevel: TERRAIN.waterLevel, surfaceAt, wetAt: nalatiWetAt,
      inBounds: (x, z, margin) => Math.abs(x) < NALATI_GROUND_SIZE / 2 - margin && Math.abs(z) < NALATI_GROUND_SIZE / 2 - margin,
      roads: [S_ROAD_PTS, N_ROAD_PTS, E_ROAD_PTS, W_ROAD_PTS, SKY_ROAD, CAMP_SPUR, ...BOWL_TRACKS, EAGLE_TRAIL, CAVE_TRAIL, ARGYMAQ_TRAIL] });
    scare = (x, z) => { manager().scare(x, z, 60); };
    if (!context.restoring) elites.initialize();
  } };
};
