import { installNativePopulation, type NativePopulation, type NativePopulationConfig } from '@wildshard/game/riding/nativePopulation';
import { createNativeHunt } from '@wildshard/game/plugin/brain';
import { Rng, type RngState } from '@wildshard/engine/core/rng';
import { SpeciesSchema } from '@wildshard/format/speciesPrograms';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { nalatiWetAt } from '../wet';
import type { SimHost } from '@wildshard/engine/sim';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import { creatureFloor } from '@wildshard/game/shardfile/homeKeeper';
import { bakedSamplers, type BakedGrid } from '@wildshard/engine/world/BakedTerrain';
import { decodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { NALATI_GROUND_RES, NALATI_GROUND_SIZE, type NalatiBake, type NalatiBakedActor, type NalatiBootBody, type NalatiBootHerd, type NalatiBootRows } from './baked';
import type { EliteBindings } from '@wildshard/game/shardfile/eliteEncounters';
import { SEED, TERRAIN, RIVER } from '../world/geography';
import { GrassField } from '@wildshard/game/systems/looks/grassField';
import { TrampleField, installTrampleTrail } from '@wildshard/game/systems/looks/trample';
import bootMetadata from '../bootMetadata.generated.json' with { type: 'json' };
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import type { SkyKey } from '../look/skyRig';
import * as v from 'valibot';
import { Wind } from '@wildshard/engine/world/steppeWind';
import type { WildEnv } from '../creatures/env';
import type { WeatherReactions } from '@wildshard/game/plugin/weather';
import type { WeatherProgram } from '@wildshard/format/weatherProgram';
import type { SunClock } from '../look/wildLight';
import { steppeStorm, stormEnv, windEnv } from '../world/weatherStep';
import { TreeGrid } from '@wildshard/engine/world/forest/placement';
import { Vector3 } from 'three';
import { ATTACK_TURN, type HuntGround, type HuntNav, type HuntTree } from '@wildshard/engine/ai/hunt';

interface NalatiGrassView { readonly field: GrassField; readonly trample: TrampleField }

/** The page's clock, resolved from the same generated manifest sun and schedule. */
export function nalatiDayClock(): DayCycle<SkyKey> {
  return new DayCycle({ ...bootMetadata.dayClock, units: 'hour',
    schedule: bootMetadata.dayClock.schedule.map(row => ({ ...row, phase: v.parse(v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']), row.phase) })) });
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

/** Keep the page's player-first push and recovery order, and its saved wire id. */
export function installNalatiTrample(host: SimHost, trample: TrampleField): void {
  installTrampleTrail(host, trample, { id: 'nalati.trample', radius: .55, strength: 1, speedLimit: 30 });
}

const num = v.pipe(v.number(), v.finite());
const WindValue = v.strictObject({ speed: num, dir: num, gustiness: num, time: num, travel: num, wander: v.boolean(), baseSpeed: num, baseDir: num,
  target: v.strictObject({ speed: num, dir: num, gustiness: num, rate: num }) });
/** A save from before the storm ran on weather reactions: its continuation, timers and armed strike as registers. */
const OldStorm = v.object({ state: v.string(), phaseT: num, phaseLen: num, mode: v.string(), hold: v.boolean(), n: v.record(v.string(), num), rng: v.unknown(),
  flash: num, windSpeed: v.nullable(num), windGustiness: num, getLow: v.boolean(), stormFrom: num, pending: v.nullable(v.object({ x: num, y: num, z: num, kind: v.string(), t: num })),
  nextBolt: num, nextGust: num, windTarget: num, getLowFor: num, getLowTick: num });
const WeatherValue = v.strictObject({ wind: WindValue, storm: v.unknown(), asked: v.exactOptional(v.nullable(num)) });

/** A baked spruce as the lightning reads it: its trunk circle (the grid's bucket key) and its top. */
interface NalatiTree { readonly x: number; readonly z: number; readonly r: number; readonly top: number }
/** The baked forest's trunks in its own 16 m cells, in its order (the page's `forest.nearby`, engine TreeGrid), with their tops. */
export function nalatiLightningGround(bake: Pick<NalatiBake, 'trees' | 'tops'>): { readonly trees: TreeGrid<NalatiTree> } {
  const trees = new TreeGrid<NalatiTree>();
  bake.trees.forEach(([x, z, r], i) => {
    const top = bake.tops[i];
    if (top === undefined) throw new Error(`Nalati baked tree ${String(i)} has no top`);
    trees.add({ x, z, r, top });
  });
  return { trees };
}

/**
 * The steppe weather on the host's fixed step (SF72), the page's rules (world/weatherStep.ts) in its frame order: the wind
 * advances, the storm's reactions step (struck at the baked spruces' tops, sheltered by the baked yurts; never indoors and
 * never held: the host cannot enter the Golden King's dungeon nor host the Storm Titan), then the creatures' view takes the
 * light, the storm and the wind. A strike within 4 m hurts the player through the host's combat pipeline (`env.lightning`);
 * a landed strike scares the creatures within 60 m. The wind and the storm ride the snapshot (`nalati.weather`).
 */
export function installNalatiWeather(host: SimHost, ports: { program:WeatherProgram; heightAt: (x: number, z: number) => number; clock: SunClock; env: Pick<WildEnv, 'light' | 'storm' | 'wind' | 'playerCrouched' | 'playerMounted'>;
  bake: Pick<NalatiBake, 'trees' | 'tops' | 'yurts'>; scare: (x: number, z: number) => void }): { readonly wind: Wind; readonly storm: WeatherReactions } {
  const wind = new Wind({ value: 1 }), env = ports.env, clock = ports.clock, bake = ports.bake;
  const storm = steppeStorm(SEED, ports.program, bake.trees.map(([x, z], i) => [x, z, bake.tops[i] ?? 0]), bake.yurts, { host });
  Object.assign(storm.inputs, { calmSpeed: wind.speed, calmDir: wind.dir, calmGust: wind.gustiness, titanHeld: 0, crouched: 0, mounted: 0 });
  storm.on('strike', e => { ports.scare(e['x'] ?? 0, e['z'] ?? 0); });
  storm.on('wind', e => { wind.setTarget(e['speed'] ?? wind.speed, e['dir'] ?? wind.dir, e['gustiness'], e['seconds']); });
  storm.on('hurt', e => {
    host.combat.hit({ source: 'env', sourceTags: ['env.lightning', 'feel.jolt', 'cover.checked'], target: host.player.health, amount: host.events.ask('weather.damage', e['damage'] ?? 0),
      point: host.player.position.clone(), dir: new Vector3(), cause: { kind: 'env.lightning', label: 'Struck by lightning', text: 'Struck by lightning' }, toast: 'Struck by lightning — get low in a storm' });
  });
  const view = (): void => { stormEnv(env, clock, storm); windEnv(env, wind); };
  host.onStep('nalati.weather', dt => {
    wind.update(dt);
    const p = host.player.position, inputs = storm.inputs;
    inputs['px'] = p.x; inputs['py'] = p.y; inputs['pz'] = p.z; inputs['crouched'] = Number(env.playerCrouched); inputs['mounted'] = Number(env.playerMounted);
    storm.update(dt);
    view();
  }, {
    snapshot: () => { const w = wind.snapshot(); return { wind: { ...w, target: { ...w.target } }, storm: storm.snapshot() }; },
    restore: value => {
      const saved = v.parse(WeatherValue, value), old = v.safeParse(OldStorm, saved.storm);
      wind.restore(saved.wind);
      if (!old.success) storm.restore(saved.storm);
      else { const o = old.output, p = o.pending; storm.restore({ version: 1, weather: { version: 1, state: o.state, mode: o.mode, hold: o.hold, phaseT: o.phaseT, phaseLen: o.phaseLen, n: o.n, rng: o.rng },
        elapsed: Math.max(0, .1 - o.getLowTick), registers: { ...storm.weather.registers, flash: o.flash, windSpeed: o.windSpeed ?? -1, windGustiness: o.windGustiness, nextBolt: o.nextBolt, nextGust: o.nextGust,
          windTarget: o.windTarget, low: Number(o.getLow), lowFor: o.getLowFor, stormFrom: o.stormFrom, asked: saved.asked ?? -1, armed: Number(p !== null), pendingT: p?.t ?? 0,
          sx: p?.x ?? 0, sy: p?.y ?? 0, sz: p?.z ?? 0, skind: ['ground', 'tree', 'thing', 'player'].indexOf(p?.kind ?? 'ground') } }); }
      view();
    },
  });
  view();
  return { wind, storm };
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
  const floorAt = creatureFloor(host, s.heightAt);
  const bodies = roster.bodies.map((boot, i) => {
    const row = bake.actors[i];
    // the bake is the page's own roll: a divergent draw anywhere refuses the roster rather than simulating another world
    if (row?.id !== boot.id || row.kind !== boot.kind || row.variant !== boot.variant.id || row.seed !== boot.seed || row.scale !== boot.scale || row.herd !== boot.herd) throw new Error(`Nalati roster diverges from the page at ${boot.id}`);
    const { x, z } = boot.position, at = floorAt(x, z, Math.max(ports.spawnY, s.heightAt(x, z)) + 1);
    const actor = host.spawn({ id: boot.id, spec: row.spec, seed: boot.seed, scale: boot.scale, at: { x, y: at.y, z }, yaw: boot.yaw });
    actor.levelGround = at.structure;
    if (at.structure) actor.groundHeight = (px, pz, py) => floorAt(px, pz, py).y;
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

export function nalatiHuntGround(grid: BakedGrid, trees: (x: number, z: number, r: number) => readonly HuntTree[]): HuntGround {
  const s = bakedSamplers(grid), stream = TERRAIN.streamAt;
  return {
    heightAt: s.heightAt, normalY: (x, z) => s.normalAt(x, z)[1], trailDistance: TERRAIN.trailDistance, cabinMask: TERRAIN.cabinMask,
    inChunk: (x, z, margin) => Math.abs(x) <= NALATI_GROUND_SIZE / 2 - margin && Math.abs(z) <= NALATI_GROUND_SIZE / 2 - margin,
    streamAt: (x, z) => stream === undefined ? null : stream(x, z), waterLevel: () => TERRAIN.waterLevel(), pond: () => TERRAIN.pond,
    // the river is a basin body (manifest.ts ground.water), not an open sea
    sea: () => false, wetAt: nalatiWetAt, trees, treeless: () => false, terrain: () => true, chunkHalf: NALATI_GROUND_SIZE / 2,
  };
}

/** Bind this shard's native terrain queries once; all population ownership and
 * decisions then use the game's concrete owners and admitted data programs. */
export function installNalatiCreatures(host: SimHost, ports: { config: NativePopulationConfig; boot: NalatiBootRows; bodies: readonly NalatiBody[]; herds: readonly NalatiBootHerd[];
  grid: BakedGrid; nav: HuntNav; trees: (x: number, z: number, r: number) => readonly HuntTree[]; stream: RngState; wildStream: RngState;
  bake: NalatiBake; spawnY: number; elites: EliteBindings; snapshot?: Readonly<SimSnapshot> }): NativePopulation {
  const rng = new Rng(ports.boot.streamSeed);
  const { hunt } = createNativeHunt(host, { limit: 64, fight: { telegraphed: true }, player: 'origin', bands: null,
    hit: { namespace: 'creature', tags: ['feel.blow', 'cover.checked'] } }, { rng, ground: nalatiHuntGround(ports.grid, ports.trees), nav: ports.nav,
    species: new Map(Object.entries(ports.boot.hunt).map(([kind,row]) => [kind,v.parse(v.object(v.pick(SpeciesSchema,['aggressive','tuning','sounds','walkSpeed','chargeSpeed','chargeWindup','ringRadius']).entries),row)])) });
  hunt.navSteer = true;
  return installNativePopulation(host, hunt, rng, { config: ports.config, boot: ports.boot, bodies: ports.bodies, herds: ports.herds,
    stream: ports.stream, wildStream: ports.wildStream, bake: ports.bake, spawnY: ports.spawnY, elites: ports.elites,
    ...(ports.snapshot === undefined ? {} : { snapshot: ports.snapshot }) });
}
