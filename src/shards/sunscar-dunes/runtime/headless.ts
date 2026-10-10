import * as v from 'valibot';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import type { AnimalSim, AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { addBakedTerrainCollider } from '@wildshard/engine/physics/terrainTiles';
import { addPiece } from '@wildshard/engine/physics/pieces';
import type { Material } from '@wildshard/engine/physics/surface';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';
import { SCOUT_FLAG } from '../data/flags';
import { installSpeciesHomes, type HomeObservation, type SpeciesPolicy } from '@wildshard/game/shardfile/speciesBrains';
import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from '../data/brains';
import { SEED } from '../data/layout';
import { MatriarchBrain } from './species/matriarch';
import { installSignalWhip, WHIP_ID, type WhipCommand, type WhipWorldTarget } from './whip';
import { installSignalQuest, type SignalSpots } from './quest';
import { SIGNAL_INTERACT, SIGNAL_INTERACTIONS } from '../quests/interactions';
import { installSignalMatriarch } from './matriarch';
import { proveSignalEntries } from './entries';
import { SIGNAL_SPAWNS } from '../data/spawns';
import { MATRIARCH_ID } from '../combat/matriarchFight';
import baked from './physics.baked.json' with { type: 'json' };

/** `fight.attackers` in manifest.ts (E297); the headless test holds the two equal (the manifest itself imports views). */
export const SIGNAL_ATTACKERS = 2;
/** The homes keeper's fixed-step id; its continuation also names the live roster to reinstall before restore. */
export const HOMES_STEP = 'sunscar.homes';
/** The browser's 'legacy' decision band: 10 Hz decisions, bodies every frame (AnimalManager scheduler). */
const THINK = { every: 6, dt: 0.1 } as const;
/** The runtime's own policy for the one kind that declares no brain: the Matriarch's fight. */
function signalPolicy(kind: string, actor: AnimalSim): SpeciesPolicy<HomeObservation> {
  if (kind === 'duneMatriarch') return new MatriarchBrain<AnimalSim>(actor);
  throw new Error(`Signal Dunes has no policy for ${kind}`);
}

const finite = v.pipe(v.number(), v.finite());
/** One baked native simulation spec, strictly: an unknown or missing field refuses the bake rather than defaulting. */
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.optional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }),
  flight: v.optional(v.strictObject({ altitude: finite, above: v.optional(v.picklist(['ground', 'world'])), climbRate: finite, diveRate: finite, lockRange: v.optional(finite), bank: v.optional(finite) })) });

const Spot = v.strictObject({ id: v.string(), x: finite, y: finite, z: finite, radius: v.pipe(finite, v.minValue(0)) });
/** The built world's prompt spots and crack targets (baked from the browser, world/build.ts order), strictly. */
export function signalSpots(): SignalSpots { return v.parse(v.strictObject({ interact: v.array(Spot), crack: v.array(Spot) }), baked.spots); }

/** The baked native specs by kind (scripts/bake-signal-physics.mjs); every home of a kind shares one recipe. */
export function signalSpecs(): ReadonlyMap<string, AnimalSimSpec> {
  const specs = new Map<string, AnimalSimSpec>();
  [...baked.actors, ...baked.bosses].forEach(actor => {
    const { flight, lockable, ...rest } = v.parse(BakedSpec, actor.spec);
    const spec: AnimalSimSpec = { ...rest, ...(lockable === undefined ? {} : { lockable }),
      ...(flight === undefined ? {} : { flight: { altitude: flight.altitude, climbRate: flight.climbRate, diveRate: flight.diveRate,
        ...(flight.above === undefined ? {} : { above: flight.above }), ...(flight.lockRange === undefined ? {} : { lockRange: flight.lockRange }),
        ...(flight.bank === undefined ? {} : { bank: flight.bank }) } }) };
    const known = specs.get(actor.kind);
    if (spec.kind !== actor.kind || (known !== undefined && JSON.stringify(known) !== JSON.stringify(spec))) throw new Error(`Divergent native Signal spec ${actor.kind}`);
    specs.set(actor.kind, spec);
  });
  return specs;
}

/**
 * Signal Dunes' renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the admitted terrain
 * collider and heights, the browser-baked native colliders, and the 13 declared homes on the platform's species homes
 * (SF27 `installSpeciesHomes`: the ray's, the skitterer's (an admitted species script) and the strider's declared brains
 * from data/brains.ts, the Matriarch's runtime policy; the creature stream, attack tokens and respawn clocks; the ray holds its strikes until
 * the player has met Sefa), the whip as its declared item row (a player command's attack is
 * its light crack), the signal quest with its declared interaction rows (`script` commands on `sunscar.interact`, quests/interactions.ts),
 * and the Dune Matriarch's encounter (runtime/matriarch.ts), armed by the signal fire, her body the keeper's after the
 * homes, and the entry proof: a player capsule walks in from every declared entryway on the native terrain
 * (runtime/entries.ts), so `finish` answers with real lanes and steps.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  if (shard.terrain === null) throw new Error('Signal Dunes declares its admitted terrain collider');
  const bytes = assets.get(shard.terrain.collider);
  if (bytes === undefined) throw new Error('Missing admitted Signal terrain collider');
  const terrain = decodeTerrainTile(bytes), heightAt = (x: number, z: number): number => terrainTileHeight(terrain, x, z), specs = signalSpecs();
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: 0 },
    player: { at: { x: shard.spawn.x, y: heightAt(shard.spawn.x, shard.spawn.z) + 0.1, z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never the whip: the whip is its declared item row (runtime/whip.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  const colliders = (host: SimHost): void => {
    addBakedTerrainCollider(host.physics, bytes, host.scope);
    baked.pieces.forEach(piece => {
      if (!piece.active) return;
      addPiece(host.physics, { id: piece.id, name: piece.name, category: 'props', file: piece.file, surface: surface(piece.surface),
        colliders: piece.colliders.map(c => ({ kind: 'box' as const, x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...('yaw' in c ? { yaw: c.yaw } : {}), ...('surface' in c ? { surface: surface(c.surface) } : {}) })), colliderOwner: piece.id });
    });
  };
  const whip = shard.items.rows.find(row => row.id === WHIP_ID), spots = signalSpots();
  if (whip?.kind !== 'weapon') throw new Error('Signal Dunes declares its whip row');
  // the crack rows' spots (a crack row's `at` is `crack.<baked crack spot id>`)
  const cracks = SIGNAL_INTERACTIONS.rows.flatMap((row): WhipWorldTarget[] => {
    if (row.crack === undefined) return [];
    const spot = spots.crack.find(s => `crack.${s.id}` === row.at); if (spot === undefined) throw new Error(`Signal's crack row ${row.id} has no baked spot`);
    return [{ act: row.act, at: spot, radius: spot.radius, crack: row.crack }];
  });
  const reach = { light: whip.light.range, heavy: whip.heavy.range }, matriarchRow = SIGNAL_SPAWNS.bosses.find(row => row.id === MATRIARCH_ID);
  if (matriarchRow === undefined) throw new Error('Signal Dunes declares the Matriarch\'s boss row');
  if (SIGNAL_SPAWNS.homes.length !== 13) throw new Error('Signal declares 13 homes');
  const brains = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES);
  return { level, ports: { ground: false, heightAt }, proveEntries: host => proveSignalEntries(host.physics, shard.entryways, heightAt), install: (host, context) => {
    if (!context.restoring) colliders(host);
    const keeper = installSpeciesHomes(host, { step: HOMES_STEP, seed: SEED, homes: SIGNAL_SPAWNS.homes, boss: matriarchRow, specs, species: SIGNAL_SPECIES, brains,
      attackers: SIGNAL_ATTACKERS, think: THINK, contactMove: kind => `sunscar.${kind}.contact`, custom: signalPolicy,
      // the ray (home 0) circles its home without striking until the player has met Sefa (R1B-13)
      beforeStep: homes => { const actor = homes[0]?.actor; if (actor) actor.mem['held'] = host.flags.has(SCOUT_FLAG) ? 0 : 1; } }, context.snapshot);
    if (keeper.boss === null) throw new Error('Signal Dunes declares the Matriarch\'s body');
    const fact = (name: string, actorId: string): void => { context.emit({ kind: 'fact', name, actorId }); };
    const coins = (amount: number, actorId: string): void => { context.emit({ kind: 'coins', amount, actorId }); };
    const matriarch = installSignalMatriarch(host, { body: keeper.boss, fact, coins });
    // the browser disables the player's weapons through her intro (BossPorts.lockInput)
    // a crack command on a crack row's act (the crank's double crack, a waymark's light one) is the whip's own crack at that row's spot
    const signalWhip = installSignalWhip(host, whip, () => matriarch.locked() ? [] : context.commands().flatMap((command): WhipCommand[] => {
      if (command.kind === 'player') return command.attack === undefined ? [] : [{ targetId: command.attack.targetId }];
      const crack = command.kind === 'script' && command.actorId === SIGNAL_INTERACT ? cracks.find(row => row.act === command.value) : undefined;
      return crack === undefined ? [] : [{ world: crack.act, heavy: crack.crack === 'heavy' }];
    }), cracks);
    installSignalQuest(host, { quests: shard.quests, spots, reach, cracked: signalWhip.cracked,
      commands: () => context.commands().flatMap(command => command.kind === 'script' ? [command] : []), fact, coins, lit: matriarch.summon });
    keeper.settle();
  } };
};
const SURFACES: readonly Material[] = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand'];
function surface(value: string): Material {
  const known = SURFACES.find(name => name === value); if (known === undefined) throw new Error(`Unknown baked surface ${value}`); return known;
}
